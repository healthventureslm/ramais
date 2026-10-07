import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { sala, type ChaveTexto, type ConfigUnidade, type ConteudoTexto, type Urgencia } from '@ramais/contracts';
import {
  acaoParaEncerrarPeloSolicitante,
  avaliarCondicoes,
  idiomaDosTextos,
  nomeSetor,
  podeTransicionar,
  proximaEspera,
  relogioLocal,
  texto,
  transicionar,
  type AcaoEstado,
} from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { atorId, atorTipo, type Ator, type SolicitacaoRow } from './tipos.js';

const COLUNAS_ATUALIZAVEIS = new Set([
  'setor_id', 'responsavel_id', 'responsavel_anterior_id', 'local_id', 'identificado', 'etapa', 'idioma', 'urgencia',
  'baixa_certeza', 'contexto', 'expiracoes', 'supervisor_notificado_em', 'resumo', 'entrou_fila_em',
  'primeira_resposta_em', 'ultima_msg_solicitante_em', 'ultima_msg_equipe_em', 'resolvida_em', 'encerrada_em',
  'triagem', 'setor_sugerido_id', 'decisao_sugerida_id', 'escada_feitos', 'escada_proxima_em', 'excluir_distribuicao',
]);

const instante = (d: Date | null | undefined) => (d ? new Date(d).getTime() : null);

/**
 * Ações sobre uma solicitação, usadas pela api e pelo worker. Toda mudança de estado
 * passa pela máquina de estados do domínio e incrementa `versao` (o que invalida
 * temporizadores pendentes).
 */
@Injectable()
export class Acoes {
  constructor(
    readonly nucleo: Nucleo,
    readonly unidades: Unidades,
  ) {}

  async carregar(c: Ctx, id: string, travar = true): Promise<SolicitacaoRow> {
    const r = await c.tx.client.query<SolicitacaoRow>(
      `SELECT * FROM solicitacao WHERE id = $1 ${travar ? 'FOR UPDATE' : ''}`,
      [id],
    );
    if (!r.rows[0]) throw new NotFoundException('solicitação não encontrada');
    return r.rows[0];
  }

  config(c: Ctx, s: SolicitacaoRow): Promise<ConfigUnidade> {
    return this.unidades.configDaVersao(c.tx, s.jornada_versao_id);
  }

  salas(s: SolicitacaoRow): string[] {
    const r = [sala.unidade(s.unidade_id), sala.solicitacao(s.id)];
    if (s.setor_id) r.push(sala.setor(s.setor_id));
    if (s.responsavel_id) r.push(sala.pessoa(s.responsavel_id));
    return r;
  }

  avisarAtualizacao(c: Ctx, s: SolicitacaoRow, antes?: SolicitacaoRow): void {
    const salas = new Set(this.salas(s));
    if (antes) for (const x of this.salas(antes)) salas.add(x);
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir([...salas], 'solicitacao:atualizada', {
        solicitacaoId: s.id,
        unidadeId: s.unidade_id,
        setorId: s.setor_id,
        estado: s.estado,
      }),
    );
  }

  /** Atualiza colunas e incrementa a versão, sem tocar no estado (uma cópia antiga não desfaz uma transição). */
  async atualizar(c: Ctx, s: SolicitacaoRow, campos: Partial<Record<keyof SolicitacaoRow, unknown>>): Promise<SolicitacaoRow> {
    return this.gravar(c, s, null, campos);
  }

  async transicionar(
    c: Ctx,
    s: SolicitacaoRow,
    acao: AcaoEstado,
    campos: Partial<Record<keyof SolicitacaoRow, unknown>> = {},
  ): Promise<SolicitacaoRow> {
    return this.gravar(c, s, { de: s.estado, para: transicionar(s.estado, acao) }, campos);
  }

  private async gravar(
    c: Ctx,
    s: SolicitacaoRow,
    estado: { de: string; para: string } | null,
    campos: Partial<Record<keyof SolicitacaoRow, unknown>>,
  ): Promise<SolicitacaoRow> {
    const sets = ['versao = versao + 1'];
    const valores: unknown[] = [s.id];
    const onde = ['id = $1'];
    if (estado) {
      valores.push(estado.para);
      sets.push(`estado = $${valores.length}`);
      // A transição parte do estado que o chamador viu; se mudou no meio, é conflito.
      valores.push(estado.de);
      onde.push(`estado = $${valores.length}`);
    }
    for (const [k, v] of Object.entries(campos)) {
      if (!COLUNAS_ATUALIZAVEIS.has(k)) throw new Error(`coluna não atualizável: ${k}`);
      valores.push(k === 'contexto' ? JSON.stringify(v) : v);
      sets.push(`${k} = $${valores.length}`);
    }
    // Escada: a espera é derivada do estado, aqui, para nenhum caminho esquecer de atualizá-la.
    const para = (estado?.para ?? s.estado) as SolicitacaoRow['estado'];
    const setorDepois = 'setor_id' in campos ? (campos.setor_id as string | null) : s.setor_id;
    const espera: { esperaDesde: Date | null; atendenteDesde: Date | null } = s.teste
      ? { esperaDesde: null, atendenteDesde: null }
      : proximaEspera(
          { estado: s.estado, setorId: s.setor_id, esperaDesde: s.espera_desde, atendenteDesde: s.atendente_desde },
          { estado: para, setorId: setorDepois },
          s.origem === 'externa',
          new Date(),
        );
    if (
      espera.esperaDesde &&
      para === 'em_atendimento' &&
      'responsavel_id' in campos &&
      campos.responsavel_id !== s.responsavel_id
    ) {
      espera.atendenteDesde = new Date();
    }
    const esperaNova = instante(espera.esperaDesde) !== instante(s.espera_desde);
    const atendenteNovo = instante(espera.atendenteDesde) !== instante(s.atendente_desde);
    if (esperaNova || atendenteNovo) {
      valores.push(espera.esperaDesde, espera.atendenteDesde);
      sets.push(`espera_desde = $${valores.length - 1}`, `atendente_desde = $${valores.length}`);
      // Espera nova começa a escada do zero.
      if (esperaNova && !('escada_feitos' in campos)) sets.push(`escada_feitos = '{}'`);
      if (!('escada_proxima_em' in campos)) sets.push(`escada_proxima_em = ${espera.esperaDesde ? 'now()' : 'NULL'}`);
    }
    const r = await c.tx.client.query<SolicitacaoRow>(
      `UPDATE solicitacao SET ${sets.join(', ')} WHERE ${onde.join(' AND ')} RETURNING *`,
      valores,
    );
    if (!r.rows[0]) throw new ConflictException('a solicitação mudou de estado enquanto isto acontecia; tente de novo');
    const nova = r.rows[0];
    if ((esperaNova || atendenteNovo) && espera.esperaDesde) {
      await this.nucleo.temporizador(c, { tipo: 'escada', orgId: c.tx.orgId, solicitacaoId: s.id }, new Date());
    }
    this.avisarAtualizacao(c, nova, s);
    return nova;
  }

  // ---------- Mensagens ----------

  /** Mensagem para o solicitante. Sai pela fila de envio (tradução e janela de 24 h lá). */
  async enviarAoSolicitante(
    c: Ctx,
    s: SolicitacaoRow,
    m: { texto: string; idioma: string; autor: Ator },
  ): Promise<string> {
    if (s.origem !== 'externa') throw new ConflictException('pedido interno não tem solicitante');
    const r = await c.tx.client.query<{ id: string }>(
      `INSERT INTO mensagem (org_id, solicitacao_id, autor_tipo, autor_pessoa_id, visibilidade, tipo, texto, idioma, status_envio)
       VALUES ($1, $2, $3, $4, 'externa', 'texto', $5, $6, 'pendente') RETURNING id`,
      [c.tx.orgId, s.id, atorTipo(m.autor), m.autor.tipo === 'pessoa' ? m.autor.id : null, m.texto, m.idioma],
    );
    const id = r.rows[0]!.id;
    await this.nucleo.enfileirar(c, 'mensagem-saida', { orgId: c.tx.orgId, mensagemId: id });
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(this.salas(s), 'solicitacao:mensagem', { solicitacaoId: s.id, mensagemId: id }),
    );
    return id;
  }

  /**
   * Foto ou áudio da equipe, para o solicitante (externa) ou como nota interna. O arquivo já está
   * guardado em `chave`. Áudio passa antes pela transcrição (fila midia-derivar), que libera o envio.
   */
  async registrarMidia(
    c: Ctx,
    s: SolicitacaoRow,
    m: { id: string; visibilidade: 'externa' | 'interna'; autorId: string; tipo: 'imagem' | 'audio'; chave: string; mime: string; legenda: string | null },
  ): Promise<string> {
    const externa = m.visibilidade === 'externa';
    if (externa && s.origem !== 'externa') throw new ConflictException('pedido interno não tem solicitante');
    await c.tx.client.query(
      `INSERT INTO mensagem (id, org_id, solicitacao_id, autor_tipo, autor_pessoa_id, visibilidade, tipo, texto, midia_chave, midia_mime, idioma, status_envio)
       VALUES ($1, $2, $3, 'pessoa', $4, $5, $6, $7, $8, $9, 'pt', $10)`,
      [m.id, c.tx.orgId, s.id, m.autorId, m.visibilidade, m.tipo, m.legenda, m.chave, m.mime, externa ? 'pendente' : 'nao_enviar'],
    );
    if (m.tipo === 'audio') await this.nucleo.enfileirar(c, 'midia-derivar', { orgId: c.tx.orgId, mensagemId: m.id, origem: 'mensagem' });
    else if (externa) await this.nucleo.enfileirar(c, 'mensagem-saida', { orgId: c.tx.orgId, mensagemId: m.id });
    c.ef.depois(() => this.nucleo.tempoReal.emitir(this.salas(s), 'solicitacao:mensagem', { solicitacaoId: s.id, mensagemId: m.id }));
    return m.id;
  }

  /** Texto fixo da configuração, no idioma do solicitante (fora de PT/ES/EN: inglês). */
  async enviarTextoFixo(c: Ctx, s: SolicitacaoRow, chave: ChaveTexto, vars: Record<string, string | number> = {}) {
    const cfg = await this.config(c, s);
    return this.enviarAoSolicitante(c, s, {
      texto: texto(cfg, chave, s.idioma, vars),
      idioma: idiomaDosTextos(s.idioma),
      autor: { tipo: 'sistema' },
    });
  }

  /** "Seu pedido foi encaminhado para X", com o nome do setor no idioma do hóspede. */
  async enviarEncaminhado(c: Ctx, s: SolicitacaoRow, setor: { chave: string; nome: string }) {
    const cfg = await this.config(c, s);
    return this.enviarTextoFixo(c, s, 'encaminhado', { setor: nomeSetor(cfg, setor.chave, s.idioma, setor.nome) });
  }

  /** Conteúdo de um bloco do fluxo: texto fixo da configuração ou texto livre em 3 idiomas. */
  async enviarConteudo(c: Ctx, s: SolicitacaoRow, conteudo: ConteudoTexto, vars: Record<string, string | number> = {}) {
    if (conteudo.tipo === 'fixo') return this.enviarTextoFixo(c, s, conteudo.chave as ChaveTexto, vars);
    const i = idiomaDosTextos(s.idioma);
    const modelo = conteudo.texto[i] || conteudo.texto.en || conteudo.texto.pt;
    const t = modelo.replace(/\{(\w+)\}/g, (_, nome: string) => String(vars[nome] ?? `{${nome}}`));
    return this.enviarAoSolicitante(c, s, { texto: t, idioma: i, autor: { tipo: 'sistema' } });
  }

  /**
   * Etapa de encerramento do fluxo: roda quando a equipe resolve o pedido
   * (mensagem final, pesquisa de satisfação de 1 a 5).
   */
  async rodarEncerramento(c: Ctx, s: SolicitacaoRow): Promise<void> {
    const cfg = await this.config(c, s);
    const { hora, diaSemana } = relogioLocal(new Date(), cfg.fuso);
    for (const b of cfg.fluxo.encerramento) {
      const ok = avaliarCondicoes(b.quando, {
        primeiraMensagem: false,
        hora,
        diaSemana,
        setor: null,
        setorExigeIdentificacao: false,
        idioma: s.idioma,
        identificado: s.identificado,
        temQuarto: s.local_id !== null,
        dados: ((s.contexto as { fluxo?: { dados?: Record<string, unknown> } }).fluxo?.dados ?? {}),
        urgencia: s.urgencia,
      });
      if (!ok) continue;
      if (b.tipo === 'mensagem') await this.enviarConteudo(c, s, b.conteudo);
      if (b.tipo === 'pesquisa') {
        await this.enviarConteudo(c, s, { tipo: 'livre', texto: b.pergunta });
        s = await this.atualizar(c, s, { contexto: { ...s.contexto, pesquisa: { blocoId: b.id } } });
      }
    }
  }

  /** Nota interna: nunca traduzida, nunca enviada. */
  async notaInterna(c: Ctx, solicitacaoId: string, textoNota: string, autor: Ator): Promise<string> {
    const r = await c.tx.client.query<{ id: string }>(
      `INSERT INTO mensagem (org_id, solicitacao_id, autor_tipo, autor_pessoa_id, visibilidade, tipo, texto, idioma, status_envio)
       VALUES ($1, $2, $3, $4, 'interna', 'texto', $5, 'pt', 'nao_enviar') RETURNING id`,
      [c.tx.orgId, solicitacaoId, atorTipo(autor), autor.tipo === 'pessoa' ? autor.id : null, textoNota],
    );
    const id = r.rows[0]!.id;
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(sala.solicitacao(solicitacaoId), 'solicitacao:mensagem', { solicitacaoId, mensagemId: id }),
    );
    return id;
  }

  // ---------- Fila ----------

  async cancelarOfertas(c: Ctx, solicitacaoId: string, motivo: 'cancelada' | 'pega' = 'cancelada'): Promise<void> {
    const r = await c.tx.client.query<{ id: string; pessoa_id: string }>(
      `UPDATE oferta SET resultado = 'cancelada', respondida_em = now()
        WHERE solicitacao_id = $1 AND resultado = 'pendente' RETURNING id, pessoa_id`,
      [solicitacaoId],
    );
    for (const o of r.rows) {
      c.ef.depois(() =>
        this.nucleo.tempoReal.emitir(sala.pessoa(o.pessoa_id), 'oferta:encerrada', { ofertaId: o.id, solicitacaoId, motivo }),
      );
    }
  }

  /**
   * Coloca na fila de um setor: a partir da automação (entrar_fila), de uma resolvida
   * (reabrir) ou de qualquer estado aberto (transferir).
   */
  async colocarNaFila(
    c: Ctx,
    s: SolicitacaoRow,
    setorId: string,
    o: {
      baixaCerteza?: boolean;
      urgencia?: Urgencia;
      ator: Ator;
      motivo: string;
      resumo?: string | null;
      /** Quem não deve receber de novo (passou adiante por falta de resposta). */
      excluir?: string[];
      /** Mesmo setor, mesma espera: mantém a marca de "já escalou" (relatório). */
      manterEscalonamento?: boolean;
    },
  ): Promise<SolicitacaoRow> {
    const acao: AcaoEstado =
      s.estado === 'automacao' ? 'entrar_fila' : s.estado === 'resolvida' ? 'reabrir' : 'transferir';
    await this.cancelarOfertas(c, s.id);
    const nova = await this.transicionar(c, s, acao, {
      setor_id: setorId,
      responsavel_id: null,
      responsavel_anterior_id: s.responsavel_id ?? s.responsavel_anterior_id,
      entrou_fila_em: new Date(),
      expiracoes: 0,
      supervisor_notificado_em: o.manterEscalonamento ? s.supervisor_notificado_em : null,
      excluir_distribuicao: o.excluir ?? [],
      baixa_certeza: o.baixaCerteza ?? false,
      urgencia: o.urgencia ?? s.urgencia,
      etapa: 'atendimento',
      resolvida_em: null,
      ...(o.resumo !== undefined ? { resumo: o.resumo } : {}),
    });
    await this.nucleo.evento(c, {
      solicitacaoId: s.id,
      tipo: acao === 'transferir' ? 'transferida' : acao === 'reabrir' ? 'reaberta' : 'encaminhada',
      atorTipo: atorTipo(o.ator),
      atorId: atorId(o.ator),
      dados: { de: s.setor_id, para: setorId, motivo: o.motivo, baixaCerteza: o.baixaCerteza ?? false },
    });
    await this.nucleo.distribuir(c, setorId);
    if (s.setor_id && s.setor_id !== setorId) await this.nucleo.distribuir(c, s.setor_id);
    return nova;
  }

  async resolver(c: Ctx, s: SolicitacaoRow, ator: Ator): Promise<SolicitacaoRow> {
    if (!podeTransicionar(s.estado, 'resolver')) throw new ConflictException(`não dá para resolver em ${s.estado}`);
    const nova = await this.transicionar(c, s, 'resolver', { resolvida_em: new Date() });
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'resolvida', atorTipo: atorTipo(ator), atorId: atorId(ator) });
    // Encerramento do fluxo (mensagem final, pesquisa). Resposta automática da IA não tem pesquisa.
    if (s.origem === 'externa' && ator.tipo !== 'ia') await this.rodarEncerramento(c, nova);
    if (s.pai_id) {
      const setor = s.setor_id ? await this.unidades.setorPorId(c.tx, s.setor_id) : null;
      await this.notaInterna(c, s.pai_id, `Pedido de apoio para ${setor?.nome ?? 'outro setor'} concluído: ${s.resumo ?? ''}`, {
        tipo: 'sistema',
      });
      await this.nucleo.evento(c, { solicitacaoId: s.pai_id, tipo: 'apoio_concluido', atorTipo: 'sistema', dados: { filho: s.id } });
      const pai = await this.carregar(c, s.pai_id, false);
      this.avisarAtualizacao(c, pai);
    }
    // Liberou capacidade: a fila do setor pode andar.
    if (s.setor_id) await this.nucleo.distribuir(c, s.setor_id);
    return nova;
  }

  /** Encerramento pela equipe, pelo solicitante ou por inatividade. */
  async encerrar(c: Ctx, s: SolicitacaoRow, ator: Ator, motivo: string): Promise<SolicitacaoRow | null> {
    const acao = s.estado === 'resolvida' ? 'encerrar' : acaoParaEncerrarPeloSolicitante(s.estado);
    if (!acao) return null;
    await this.cancelarOfertas(c, s.id);
    const nova = await this.transicionar(c, s, acao, { encerrada_em: new Date() });
    await this.nucleo.evento(c, {
      solicitacaoId: s.id,
      tipo: acao === 'cancelar' ? 'cancelada' : 'encerrada',
      atorTipo: atorTipo(ator),
      atorId: atorId(ator),
      dados: { motivo },
    });
    if (s.setor_id) await this.nucleo.distribuir(c, s.setor_id);
    return nova;
  }
}
