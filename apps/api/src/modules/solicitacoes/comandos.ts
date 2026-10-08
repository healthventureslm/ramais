import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ServicosIA } from '@ramais/ai';
import { sala, type MidiaReq, type PedidoApoioReq, type ResponderReq, type TransferirReq } from '@ramais/contracts';
import { podeTransicionar } from '@ramais/domain';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { lerArquivo } from '../../infra/midia.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { comContextoIA } from '../../infra/uso-ia.js';
import { IA } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from './acoes.js';
import type { SolicitacaoRow } from './tipos.js';

export interface Permissao {
  admin: boolean;
  lotado: boolean;
  supervisor: boolean;
  responsavel: boolean;
}

/** Comandos da equipe sobre uma solicitação, com as regras de permissão. */
@Injectable()
export class Comandos {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
    @Inject(IA) private readonly ia: ServicosIA,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
  ) {}

  async permissao(c: Ctx, s: SolicitacaoRow, pessoaId: string): Promise<Permissao> {
    const r = await c.tx.client.query(
      `SELECT p.admin, p.gerente,
              EXISTS (SELECT 1 FROM lotacao l WHERE l.pessoa_id = p.id AND l.setor_id = $2) AS lotado,
              EXISTS (SELECT 1 FROM lotacao l WHERE l.pessoa_id = p.id AND l.setor_id = $2 AND l.papel = 'supervisor') AS supervisor,
              EXISTS (SELECT 1 FROM lotacao l JOIN solicitacao pai ON pai.id = $3 WHERE l.pessoa_id = p.id AND l.setor_id = pai.setor_id) AS lotado_pai,
              EXISTS (SELECT 1 FROM oferta o WHERE o.solicitacao_id = $4 AND o.pessoa_id = p.id AND o.resultado = 'pendente') AS ofertado,
              EXISTS (SELECT 1 FROM lotacao l JOIN setor st ON st.id = l.setor_id
                       WHERE l.pessoa_id = p.id AND st.unidade_id = $5 AND l.papel = 'supervisor') AS supervisor_unidade
         FROM pessoa p WHERE p.id = $1`,
      [pessoaId, s.setor_id, s.pai_id, s.id, s.unidade_id],
    );
    const l = r.rows[0];
    if (!l) throw new ForbiddenException();
    return {
      // "admin" aqui é gestão da operação: o gerente atende e supervisiona tudo, como o admin.
      admin: l.admin || l.gerente,
      // Quem está no setor do pai acompanha os pedidos de apoio; quem recebeu a oferta vê o pedido;
      // supervisores da unidade veem o que ainda não tem setor.
      lotado: l.lotado || l.lotado_pai || l.ofertado || (s.setor_id === null && l.supervisor_unidade),
      supervisor: l.supervisor,
      responsavel: s.responsavel_id === pessoaId,
    };
  }

  async exigirAcesso(c: Ctx, s: SolicitacaoRow, pessoaId: string): Promise<Permissao> {
    const p = await this.permissao(c, s, pessoaId);
    if (!(p.admin || p.lotado || p.responsavel)) throw new ForbiddenException('sem acesso a esta solicitação');
    return p;
  }

  /**
   * Supervisão assume uma conversa que já está com alguém (o atendente travou, saiu, ou o caso
   * pede outra pessoa). Quem estava com ela é avisado; o relógio de resposta do novo responsável
   * começa agora, mas a espera do hóspede continua contando.
   */
  async assumir(orgId: string, id: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      const p = await this.permissao(c, s, pessoaId);
      if (!(p.supervisor || p.admin)) throw new ForbiddenException('só a supervisão do setor, gerentes e administradores assumem um atendimento');
      if (!['em_atendimento', 'aguardando_solicitante'].includes(s.estado)) {
        throw new ConflictException('este atendimento não está com ninguém: use Pegar');
      }
      if (s.responsavel_id === pessoaId) return { ok: true };
      const anterior = s.responsavel_id;
      const eu = (await c.tx.client.query<{ nome: string }>('SELECT nome FROM pessoa WHERE id = $1', [pessoaId])).rows[0]!;
      await this.acoes.atualizar(c, s, { responsavel_id: pessoaId, responsavel_anterior_id: anterior });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'assumida', atorTipo: 'pessoa', atorId: pessoaId, dados: { de: anterior } });
      await this.acoes.notaInterna(c, s.id, `${eu.nome} assumiu o atendimento.`, { tipo: 'sistema' });
      if (anterior) {
        const texto = `${eu.nome} assumiu um atendimento que estava com você${s.resumo ? `: ${s.resumo}` : ''}`;
        await this.nucleo.enfileirar(c, 'notificacao', {
          orgId,
          pessoaId: anterior,
          titulo: 'Atendimento assumido',
          corpo: texto.slice(0, 140),
          dados: { tipo: 'assumida', solicitacaoId: s.id },
          alta: false,
        });
        c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(anterior), 'aviso', { texto }));
      }
      return { ok: true };
    });
  }

  async registrarVisualizacao(c: Ctx, solicitacaoId: string, pessoaId: string) {
    // Trilha de auditoria: quem viu, não só quem fez.
    await this.nucleo.evento(c, { solicitacaoId, tipo: 'visualizada', atorTipo: 'pessoa', atorId: pessoaId });
  }

  async responder(orgId: string, id: string, pessoaId: string, req: ResponderReq) {
    return this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      const p = await this.exigirAcesso(c, s, pessoaId);
      if (req.visibilidade === 'interna') {
        const mid = await this.acoes.notaInterna(c, s.id, req.texto, { tipo: 'pessoa', id: pessoaId });
        const mencionados = await this.mencoes(c, s, req.texto, pessoaId);
        await this.avisarNota(c, s, req.texto, pessoaId, mencionados);
        return { mensagemId: mid };
      }
      this.podeFalarComSolicitante(s, p);
      const mid = await this.acoes.enviarAoSolicitante(c, s, { texto: req.texto, idioma: 'pt', autor: { tipo: 'pessoa', id: pessoaId } });
      await this.respondeu(c, s);
      return { mensagemId: mid };
    });
  }

  /** Foto ou áudio da equipe, para o solicitante ou como nota interna. Áudio ganha transcrição. */
  async enviarMidia(orgId: string, id: string, pessoaId: string, req: MidiaReq) {
    const arquivo = lerArquivo(req);
    return this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      const p = await this.exigirAcesso(c, s, pessoaId);
      if (req.visibilidade === 'externa') this.podeFalarComSolicitante(s, p);
      const mensagemId = randomUUID();
      const chave = `org/${orgId}/mensagem/${mensagemId}.${arquivo.ext}`;
      await this.armazenamento.salvar(chave, arquivo.dados, arquivo.mime);
      await this.acoes.registrarMidia(c, s, {
        id: mensagemId,
        visibilidade: req.visibilidade,
        autorId: pessoaId,
        tipo: req.tipo,
        chave,
        mime: arquivo.mime,
        legenda: req.legenda?.trim() || null,
      });
      if (req.visibilidade === 'externa') await this.respondeu(c, s);
      else await this.avisarNota(c, s, req.legenda?.trim() || (req.tipo === 'audio' ? 'Mensagem de voz' : 'Foto'), pessoaId, []);
      return { mensagemId };
    });
  }

  /** Externa: só quem cuida do caso (ou supervisão) fala com o solicitante, e com o atendimento aberto. */
  private podeFalarComSolicitante(s: SolicitacaoRow, p: Permissao) {
    if (!(p.responsavel || p.supervisor || p.admin)) throw new ForbiddenException('aceite o atendimento para responder');
    if (s.origem !== 'externa') throw new BadRequestException('pedido interno: use nota interna');
    if (!['em_atendimento', 'aguardando_solicitante'].includes(s.estado)) {
      throw new ConflictException('aceite ou pegue o atendimento antes de responder');
    }
  }

  /** A equipe respondeu: marca a primeira resposta, espera o solicitante e agenda a inatividade. */
  private async respondeu(c: Ctx, s: SolicitacaoRow) {
    const orgId = c.tx.orgId;
    const campos = { primeira_resposta_em: s.primeira_resposta_em ?? new Date(), ultima_msg_equipe_em: new Date() };
    s =
      s.estado === 'em_atendimento'
        ? await this.acoes.transicionar(c, s, 'aguardar_solicitante', campos)
        : await this.acoes.atualizar(c, s, campos);
    // Inatividade: aviso e encerramento dentro da janela de 24 h. A versão invalida se alguém falar antes.
    const cfg = await this.acoes.config(c, s);
    const agora = Date.now();
    await this.nucleo.temporizador(
      c,
      { tipo: 'inatividade_aviso', orgId, solicitacaoId: s.id, versao: s.versao },
      new Date(agora + cfg.tempos.inatividadeAvisoMin * 60_000),
    );
    await this.nucleo.temporizador(
      c,
      { tipo: 'inatividade_encerra', orgId, solicitacaoId: s.id, versao: s.versao },
      new Date(agora + cfg.tempos.inatividadeEncerraMin * 60_000),
    );
  }

  /** Menção com @nome em nota interna avisa a pessoa. A IA nunca cria pedido em silêncio. */
  private async mencoes(c: Ctx, s: SolicitacaoRow, texto: string, autorId: string): Promise<string[]> {
    const nomes = [...texto.matchAll(/@([\p{L}][\p{L}.\-]*)/gu)].map((m) => m[1]!.toLowerCase());
    if (!nomes.length) return [];
    const r = await c.tx.client.query<{ id: string }>(
      `SELECT id FROM pessoa WHERE ativo AND id <> $2 AND lower(split_part(nome, ' ', 1)) = ANY($1::text[])`,
      [nomes, autorId],
    );
    for (const p of r.rows) {
      await this.nucleo.enfileirar(c, 'notificacao', {
        orgId: c.tx.orgId,
        pessoaId: p.id,
        titulo: 'Você foi mencionado',
        corpo: texto.slice(0, 140),
        dados: { tipo: 'mencao', solicitacaoId: s.id },
        alta: false,
      });
      c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(p.id), 'aviso', { texto: `Você foi mencionado: ${texto.slice(0, 80)}` }));
    }
    return r.rows.map((p) => p.id);
  }

  /**
   * Nota interna de outra pessoa no atendimento que está comigo: chega como aviso (mensagem
   * interna também notifica). Quem foi mencionado já recebeu o dele.
   */
  private async avisarNota(c: Ctx, s: SolicitacaoRow, texto: string, autorId: string, jaAvisados: string[]) {
    const dono = s.responsavel_id;
    if (!dono || dono === autorId || jaAvisados.includes(dono)) return;
    const autor = (await c.tx.client.query<{ nome: string }>('SELECT nome FROM pessoa WHERE id = $1', [autorId])).rows[0];
    const quem = autor?.nome.split(' ')[0] ?? 'Alguém da equipe';
    await this.nucleo.enfileirar(c, 'notificacao', {
      orgId: c.tx.orgId,
      pessoaId: dono,
      titulo: `Nota interna de ${quem}`,
      corpo: `${s.resumo ? `${s.resumo}: ` : ''}${texto}`.slice(0, 140),
      dados: { tipo: 'nota', solicitacaoId: s.id },
      alta: false,
    });
    c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(dono), 'aviso', { texto: `Nota de ${quem}: ${texto.slice(0, 80)}` }));
  }

  async previaTraducao(orgId: string, id: string, pessoaId: string, texto: string) {
    const s = await this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id, false);
      await this.exigirAcesso(c, s, pessoaId);
      return s;
    });
    if (s.idioma === 'pt') return { texto, idioma: 'pt', alerta: null, necessaria: false };
    if (!this.ia.tradutor.disponivel) return { texto, idioma: s.idioma, alerta: 'tradução indisponível', necessaria: true };
    const t = await comContextoIA({ orgId, unidadeId: s.unidade_id, solicitacaoId: s.id }, () => this.ia.tradutor.traduzir(texto, s.idioma, { de: 'pt' }));
    return { texto: t.texto, idioma: s.idioma, alerta: t.alerta, necessaria: true };
  }

  /**
   * Triagem do modo sombra: quem está na triagem confirma a sugestão da IA ou escolhe outro
   * setor. Cada revisão fica na decisão e alimenta o acerto por setor.
   */
  async triar(orgId: string, id: string, pessoaId: string, setorId: string) {
    await this.nucleo.executar(orgId, (c) => this.triarEm(c, id, pessoaId, setorId));
  }

  private async triarEm(c: Ctx, id: string, pessoaId: string, setorId: string) {
    const s = await this.acoes.carregar(c, id);
    // Antes do acesso: quem clicou duas vezes vê "já saiu da triagem", não "sem acesso".
    if (!s.triagem) throw new ConflictException('este pedido não está mais na triagem');
    const p = await this.exigirAcesso(c, s, pessoaId);
    if (!['automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante'].includes(s.estado)) {
      throw new ConflictException(`não dá para triar em ${s.estado}`);
    }
    if (!(p.lotado || p.supervisor || p.admin || p.responsavel)) throw new ForbiddenException();
    const destino = await this.unidades.setorPorId(c.tx, setorId);
    if (!destino || destino.unidadeId !== s.unidade_id) throw new BadRequestException('setor inválido');
    const confirmou = setorId === s.setor_sugerido_id;
    if (s.decisao_sugerida_id) {
      await c.tx.client.query(
        `UPDATE decisao_ia SET revisao = $2, revisada_por = $3, revisada_em = now(), setor_final_id = $4 WHERE id = $1`,
        [s.decisao_sugerida_id, confirmou ? 'confirmada' : 'corrigida', pessoaId, setorId],
      );
      if (!confirmou) await this.registrarCorrecao(c, s, s.decisao_sugerida_id, s.setor_sugerido_id, setorId, pessoaId);
    }
    await this.nucleo.evento(c, {
      solicitacaoId: s.id,
      tipo: confirmou ? 'sugestao_confirmada' : 'sugestao_corrigida',
      atorTipo: 'pessoa',
      atorId: pessoaId,
      dados: { sugerido: s.setor_sugerido_id, final: setorId },
    });
    const limpo = await this.acoes.atualizar(c, s, { triagem: false });
    if (setorId === s.setor_id) return; // a triagem fica com o pedido (ex.: a recepção resolve)
    await this.acoes.colocarNaFila(c, limpo, setorId, { ator: { tipo: 'pessoa', id: pessoaId }, motivo: confirmou ? 'triagem_confirmada' : 'triagem_corrigida' });
    if (s.origem === 'externa') await this.acoes.enviarEncaminhado(c, limpo, destino);
  }

  private async registrarCorrecao(c: Ctx, s: SolicitacaoRow, decisaoId: string, previsto: string | null, correto: string, pessoaId: string) {
    const texto = await c.tx.client.query<{ texto: string }>(
      `SELECT coalesce((SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma = 'en' LIMIT 1), m.texto) AS texto
         FROM mensagem m WHERE m.id = (SELECT mensagem_id FROM decisao_ia WHERE id = $1)`,
      [decisaoId],
    );
    await c.tx.client.query(
      `INSERT INTO correcao (org_id, decisao_id, setor_previsto_id, setor_correto_id, pessoa_id, texto) VALUES ($1, $2, $3, $4, $5, $6)`,
      [c.tx.orgId, decisaoId, previsto, correto, pessoaId, texto.rows[0]?.texto ?? s.resumo ?? ''],
    );
  }

  async transferir(orgId: string, id: string, pessoaId: string, req: TransferirReq) {
    await this.nucleo.executar(orgId, async (c) => {
      const pre = await this.acoes.carregar(c, id);
      // Transferir um pedido em triagem é a mesma coisa que corrigir a sugestão.
      if (pre.triagem) return this.triarEm(c, id, pessoaId, req.setorId);
      const s = pre;
      const p = await this.exigirAcesso(c, s, pessoaId);
      const naFila = s.estado === 'na_fila' || s.estado === 'oferecida' || s.estado === 'automacao';
      if (!(p.responsavel || p.supervisor || p.admin || (p.lotado && naFila))) throw new ForbiddenException();
      const destino = await this.unidades.setorPorId(c.tx, req.setorId);
      if (!destino || destino.unidadeId !== s.unidade_id) throw new BadRequestException('setor inválido');
      if (destino.id === s.setor_id) throw new BadRequestException('já está neste setor');
      if (req.correcao) {
        // Re-roteamento vira dado de calibração, ligado à decisão da IA que errou.
        // A decisão que encaminhou (não a de uma mensagem posterior qualquer).
        const d = await c.tx.client.query<{ id: string }>(
          `SELECT id FROM decisao_ia WHERE solicitacao_id = $1 AND acao IN ('encaminhar', 'encaminhar_baixa_certeza')
            ORDER BY criado_em DESC LIMIT 1`,
          [s.id],
        );
        if (d.rows[0]) {
          await c.tx.client.query(
            `UPDATE decisao_ia SET revisao = 'corrigida', revisada_por = $2, revisada_em = now(), setor_final_id = $3 WHERE id = $1`,
            [d.rows[0].id, pessoaId, destino.id],
          );
          await this.registrarCorrecao(c, s, d.rows[0].id, s.setor_id, destino.id, pessoaId);
        }
      }
      await this.acoes.colocarNaFila(c, s, destino.id, {
        ator: { tipo: 'pessoa', id: pessoaId },
        motivo: req.motivo ?? (req.correcao ? 'correcao' : 'transferencia'),
      });
      if (req.motivo) await this.acoes.notaInterna(c, s.id, `Transferido para ${destino.nome}: ${req.motivo}`, { tipo: 'pessoa', id: pessoaId });
    });
  }

  /**
   * Pedir apoio sem transferir: o dono continua com o caso e cria um pedido filho para
   * outro setor, com fila e tempo próprios. O filho carrega só o necessário.
   */
  async pedirApoio(orgId: string, id: string, pessoaId: string, req: PedidoApoioReq) {
    return this.nucleo.executar(orgId, async (c) => {
      const pai = await this.acoes.carregar(c, id);
      await this.exigirAcesso(c, pai, pessoaId);
      const destino = await this.unidades.setorPorId(c.tx, req.setorId);
      if (!destino || destino.unidadeId !== pai.unidade_id) throw new BadRequestException('setor inválido');
      const local = pai.local_id
        ? (await c.tx.client.query('SELECT identificador, tipo FROM local WHERE id = $1', [pai.local_id])).rows[0]
        : null;
      const resumo = local ? `${local.tipo === 'quarto' ? 'Quarto' : 'Local'} ${local.identificador}: ${req.texto}` : req.texto;
      const versao = await this.unidades.versaoAtual(c.tx, pai.unidade_id);
      const r = await c.tx.client.query<{ id: string }>(
        `INSERT INTO solicitacao (org_id, unidade_id, origem, pai_id, criado_por, setor_id, local_id, identificado, estado, etapa,
                                  urgencia, jornada_versao_id, resumo, entrou_fila_em, idioma)
         VALUES ($1, $2, 'interna', $3, $4, $5, $6, $7, 'na_fila', 'atendimento', $8, $9, $10, now(), 'pt') RETURNING id`,
        [orgId, pai.unidade_id, pai.id, pessoaId, destino.id, pai.local_id, pai.identificado, req.urgencia, versao.id, resumo],
      );
      const filhoId = r.rows[0]!.id;
      await this.acoes.notaInterna(c, filhoId, req.texto, { tipo: 'pessoa', id: pessoaId });
      await this.acoes.notaInterna(c, pai.id, `Pedido de apoio aberto para ${destino.nome}: ${req.texto}`, { tipo: 'pessoa', id: pessoaId });
      await this.nucleo.evento(c, { solicitacaoId: pai.id, tipo: 'apoio_pedido', atorTipo: 'pessoa', atorId: pessoaId, dados: { filhoId, setor: destino.id } });
      await this.nucleo.distribuir(c, destino.id);
      const filho = await this.acoes.carregar(c, filhoId, false);
      this.acoes.avisarAtualizacao(c, filho);
      this.acoes.avisarAtualizacao(c, pai);
      return { solicitacaoId: filhoId };
    });
  }

  async resolver(orgId: string, id: string, pessoaId: string) {
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      const p = await this.exigirAcesso(c, s, pessoaId);
      if (!(p.responsavel || p.supervisor || p.admin)) throw new ForbiddenException();
      await this.acoes.resolver(c, s, { tipo: 'pessoa', id: pessoaId });
    });
  }

  async encerrar(orgId: string, id: string, pessoaId: string) {
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      const p = await this.exigirAcesso(c, s, pessoaId);
      if (!(p.responsavel || p.supervisor || p.admin)) throw new ForbiddenException();
      const r = await this.acoes.encerrar(c, s, { tipo: 'pessoa', id: pessoaId }, 'equipe');
      if (!r) throw new ConflictException(`não dá para encerrar em ${s.estado}`);
      // O hóspede fica sabendo. Resolvida já avisou ("seu pedido foi concluído"), não repete.
      if (s.origem === 'externa' && s.estado !== 'resolvida') await this.acoes.enviarTextoFixo(c, r, 'encerramento');
    });
  }

  /** Recepção confirma o quarto com um toque (quando o sobrenome não conferiu). */
  async confirmarLocal(orgId: string, id: string, pessoaId: string, localId: string) {
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, id);
      await this.exigirAcesso(c, s, pessoaId);
      if (!s.solicitante_id) throw new BadRequestException('pedido interno');
      const l = await c.tx.client.query('SELECT id FROM local WHERE id = $1 AND unidade_id = $2', [localId, s.unidade_id]);
      if (!l.rowCount) throw new NotFoundException('local não encontrado');
      const h = await c.tx.client.query<{ checkout: string }>(
        `SELECT checkout::text FROM hospede_ativo WHERE local_id = $1 AND current_date BETWEEN checkin AND checkout ORDER BY checkout DESC LIMIT 1`,
        [localId],
      );
      const fim = h.rows[0] ? new Date(`${h.rows[0].checkout}T12:00:00-03:00`) : new Date(Date.now() + 24 * 3600_000);
      await c.tx.client.query(
        `INSERT INTO vinculo (org_id, unidade_id, solicitante_id, local_id, origem, confirmado, fim) VALUES ($1, $2, $3, $4, 'recepcao', true, $5)`,
        [orgId, s.unidade_id, s.solicitante_id, localId, fim],
      );
      await this.acoes.atualizar(c, s, {
        local_id: localId,
        identificado: true,
        contexto: { ...s.contexto, aguardandoIdentificacao: false, identificacaoPendente: null },
      });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'identificado', atorTipo: 'pessoa', atorId: pessoaId, dados: { origem: 'recepcao' } });
    });
  }

  podeResolver(estado: SolicitacaoRow['estado']): boolean {
    return podeTransicionar(estado, 'resolver');
  }
}
