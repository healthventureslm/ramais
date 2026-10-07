import { randomUUID } from 'node:crypto';
import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ConfigUnidade } from '@ramais/contracts';
import { linkWhatsApp, relatorio, sugerirLimite } from '@ramais/domain';
import { z } from 'zod';
import { pessoaDa, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Presencas } from '../equipes/presenca.service.js';

const Hospedes = z.object({
  unidadeId: z.uuid(),
  /** Substitui a lista inteira (importação da planilha do dia). */
  substituir: z.boolean().default(true),
  hospedes: z
    .array(z.object({ quarto: z.string().min(1), sobrenome: z.string().min(2), checkin: z.iso.date(), checkout: z.iso.date() }))
    .max(5000),
});

/**
 * Administração do MVP. Nas primeiras instalações quem configura somos nós;
 * a tela de autoatendimento vem quando o processo estiver aprendido.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly presencas: Presencas,
  ) {}

  private async exigirAdmin(c: Ctx, s: Sessao) {
    const r = await c.tx.client.query('SELECT admin FROM pessoa WHERE id = $1', [pessoaDa(s)]);
    if (!r.rows[0]?.admin) throw new ForbiddenException('só administradores');
  }

  /** Gera o código (QR) para cadastrar um celular compartilhado do setor. */
  @Post('dispositivos')
  @HttpCode(201)
  dispositivo(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ unidadeId: z.uuid(), nome: z.string().min(1).max(60) }))) b: { unidadeId: string; nome: string }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      return this.presencas.gerarCodigoDispositivo(c, b.unidadeId, b.nome);
    });
  }

  /** Locais com o link do QR (wa.me com o token do quarto). */
  @Get('locais')
  locais(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const canal = await c.tx.client.query(`SELECT numero_exibicao FROM canal_whatsapp WHERE unidade_id = $1 AND ativo AND tipo = 'whatsapp' LIMIT 1`, [unidadeId]);
      const numero = canal.rows[0]?.numero_exibicao as string | undefined;
      const r = await c.tx.client.query('SELECT id, identificador, codigo_qr FROM local WHERE unidade_id = $1 ORDER BY identificador', [unidadeId]);
      return r.rows.map((l) => ({
        id: l.id,
        identificador: l.identificador,
        link: numero ? linkWhatsApp(numero, l.codigo_qr, 'Olá! Preciso de ajuda.') : null,
      }));
    });
  }

  /** Lista de hóspedes ativos (planilha). Base da confirmação por quarto e sobrenome. */
  @Post('hospedes')
  @HttpCode(200)
  hospedes(@SessaoAtual() s: Sessao, @Body(new Zod(Hospedes)) b: z.infer<typeof Hospedes>) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      if (b.substituir) await c.tx.client.query('DELETE FROM hospede_ativo WHERE unidade_id = $1', [b.unidadeId]);
      const locais = await c.tx.client.query<{ id: string; identificador: string }>(
        'SELECT id, identificador FROM local WHERE unidade_id = $1',
        [b.unidadeId],
      );
      const porQuarto = new Map(locais.rows.map((l) => [l.identificador.toLowerCase(), l.id]));
      const ignorados: string[] = [];
      let importados = 0;
      for (const h of b.hospedes) {
        const localId = porQuarto.get(h.quarto.toLowerCase());
        if (!localId) {
          ignorados.push(h.quarto);
          continue;
        }
        await c.tx.client.query(
          'INSERT INTO hospede_ativo (org_id, unidade_id, local_id, sobrenome, checkin, checkout) VALUES ($1, $2, $3, $4, $5, $6)',
          [s.orgId, b.unidadeId, localId, h.sobrenome, h.checkin, h.checkout],
        );
        importados++;
      }
      return { importados, ignorados };
    });
  }

  @Get('jornada')
  jornada(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `SELECT j.id, j.numero, j.config, j.publicada_em, (u.jornada_versao_id = j.id) AS vigente
           FROM jornada_versao j JOIN unidade u ON u.id = j.unidade_id WHERE j.unidade_id = $1 AND NOT j.rascunho ORDER BY j.numero DESC LIMIT 10`,
        [unidadeId],
      );
      // Versões antigas não têm os campos novos: o editor recebe sempre a forma atual (com padrões).
      return r.rows.map((l) => {
        const p = ConfigUnidade.safeParse(l.config);
        return { ...l, config: p.success ? p.data : l.config };
      });
    });
  }

  /** Validação ao vivo do editor: mesmos erros da publicação, sem publicar nada. */
  @Post('jornada/validar')
  @HttpCode(200)
  validar(@SessaoAtual() s: Sessao, @Body() b: { unidadeId: string; config: unknown }) {
    const unidadeId = new Uuid().transform(b?.unidadeId);
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await this.checar(c, unidadeId, b?.config);
      return { valido: r.erros.length === 0, erros: r.erros, avisos: r.avisos };
    });
  }

  /**
   * Publica uma nova versão. Validação ao publicar (schema, janela de 24 h, setores).
   * Setores novos do catálogo são criados (em modo sombra); os removidos são desativados,
   * a menos que tenham pedidos abertos. Conversas em andamento ficam na versão em que começaram.
   */
  @Post('jornada')
  @HttpCode(201)
  publicar(@SessaoAtual() s: Sessao, @Body() b: { unidadeId: string; config: unknown; nota?: string }) {
    const unidadeId = new Uuid().transform(b?.unidadeId);
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await this.checar(c, unidadeId, b?.config);
      if (r.erros.length || !r.cfg) throw new BadRequestException({ mensagem: 'configuração inválida', erros: r.erros });
      const cfg = r.cfg;
      for (const st of cfg.setores) {
        await c.tx.client.query(
          `INSERT INTO setor (org_id, unidade_id, chave, nome) VALUES ($1, $2, $3, $4)
           ON CONFLICT (unidade_id, chave) DO UPDATE SET nome = EXCLUDED.nome, ativo = true`,
          [s.orgId, unidadeId, st.chave, st.nome],
        );
      }
      await c.tx.client.query(`UPDATE setor SET ativo = false WHERE unidade_id = $1 AND NOT (chave = ANY($2::text[]))`, [
        unidadeId,
        cfg.setores.map((x) => x.chave),
      ]);
      const n = await c.tx.client.query<{ n: number }>('SELECT coalesce(max(numero), 0) + 1 AS n FROM jornada_versao WHERE unidade_id = $1 AND NOT rascunho', [unidadeId]);
      const v = await c.tx.client.query<{ id: string }>(
        'INSERT INTO jornada_versao (org_id, unidade_id, numero, config, publicada_por) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [s.orgId, unidadeId, n.rows[0]!.n, JSON.stringify(cfg), s.pessoaId],
      );
      await c.tx.client.query('UPDATE unidade SET jornada_versao_id = $2 WHERE id = $1', [unidadeId, v.rows[0]!.id]);
      await this.nucleo.evento(c, {
        tipo: 'jornada_publicada',
        atorTipo: 'pessoa',
        atorId: s.pessoaId,
        dados: { unidadeId, numero: n.rows[0]!.n, nota: b?.nota?.slice(0, 200) ?? null },
      });
      return { id: v.rows[0]!.id, numero: n.rows[0]!.n, avisos: r.avisos };
    });
  }

  // ---------------------------------------------------------------------------
  // Simulador do construtor: o admin conversa como hóspede usando o rascunho.
  // ---------------------------------------------------------------------------

  /** Telefone do hóspede de teste de cada admin. Começa com 00: nenhum número real de WhatsApp é assim. */
  private telefoneTeste(pessoaId: string): string {
    return `00${BigInt(`0x${pessoaId.replace(/-/g, '').slice(0, 12)}`).toString()}`;
  }

  @Post('simulador/mensagem')
  @HttpCode(202)
  simularMensagem(
    @SessaoAtual() s: Sessao,
    @Body() b: { unidadeId: string; config: unknown; texto: string; quarto?: string | null },
  ) {
    const unidadeId = new Uuid().transform(b?.unidadeId);
    const texto = typeof b?.texto === 'string' ? b.texto.trim().slice(0, 2000) : '';
    if (!texto) throw new BadRequestException('mensagem vazia');
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await this.checar(c, unidadeId, b?.config);
      if (r.erros.length || !r.cfg) throw new BadRequestException({ mensagem: 'o rascunho tem erros', erros: r.erros });
      // Um rascunho por configuração: testar de novo a mesma versão reaproveita a linha.
      const json = JSON.stringify(r.cfg);
      let versao = await c.tx.client.query<{ id: string }>(
        'SELECT id FROM jornada_versao WHERE unidade_id = $1 AND rascunho AND config = $2::jsonb LIMIT 1',
        [unidadeId, json],
      );
      if (!versao.rows[0]) {
        versao = await c.tx.client.query<{ id: string }>(
          'INSERT INTO jornada_versao (org_id, unidade_id, numero, config, publicada_por, rascunho) VALUES ($1, $2, 0, $3, $4, true) RETURNING id',
          [s.orgId, unidadeId, json, s.pessoaId],
        );
      }
      const canal = await c.tx.client.query<{ id: string }>(`SELECT id FROM canal_whatsapp WHERE unidade_id = $1 AND ativo AND tipo = 'whatsapp' LIMIT 1`, [unidadeId]);
      if (!canal.rows[0]) throw new BadRequestException('a unidade não tem número de WhatsApp cadastrado');
      const de = this.telefoneTeste(s.pessoaId!);
      let corpo = texto;
      if (b.quarto) {
        const l = await c.tx.client.query<{ codigo_qr: string }>('SELECT codigo_qr FROM local WHERE unidade_id = $1 AND identificador = $2', [unidadeId, b.quarto]);
        if (l.rows[0]) corpo = `${texto} (código #R-${l.rows[0].codigo_qr})`;
      }
      await this.nucleo.enfileirar(
        c,
        'mensagem-entrada',
        {
          orgId: s.orgId,
          unidadeId,
          canalId: canal.rows[0].id,
          waMessageId: `sim.${randomUUID()}`,
          de,
          nomePerfil: 'Teste do construtor',
          tipo: 'texto',
          texto: corpo,
          midiaId: null,
          midiaMime: null,
          recebidaEm: new Date().toISOString(),
          versaoForcada: versao.rows[0]!.id,
          teste: true,
        },
        { singletonKey: `${canal.rows[0].id}:${de}` },
      );
      return { ok: true };
    });
  }

  /** Fecha a conversa de teste: a próxima mensagem começa do zero (e com o rascunho atual). */
  @Post('simulador/reiniciar')
  @HttpCode(200)
  simularReiniciar(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ unidadeId: z.uuid() }))) b: { unidadeId: string }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      await c.tx.client.query(
        `UPDATE solicitacao so SET estado = 'cancelada', encerrada_em = now(), versao = versao + 1
           FROM solicitante st
          WHERE so.solicitante_id = st.id AND st.telefone = $1 AND so.unidade_id = $2 AND so.teste
            AND so.estado NOT IN ('encerrada', 'cancelada')`,
        [this.telefoneTeste(s.pessoaId!), b.unidadeId],
      );
      return { ok: true };
    });
  }

  /** A conversa de teste com o que aconteceu a cada mensagem (decisões da IA e trilha dos blocos). */
  @Get('simulador')
  simulador(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const sol = await c.tx.client.query(
        `SELECT so.id, so.estado, so.triagem, so.contexto, st.nome AS setor, sg.nome AS sugerido, j.rascunho, j.numero
           FROM solicitacao so
           JOIN solicitante sl ON sl.id = so.solicitante_id
           JOIN jornada_versao j ON j.id = so.jornada_versao_id
           LEFT JOIN setor st ON st.id = so.setor_id
           LEFT JOIN setor sg ON sg.id = so.setor_sugerido_id
          WHERE sl.telefone = $1 AND so.unidade_id = $2 AND so.teste
          ORDER BY so.criado_em DESC LIMIT 1`,
        [this.telefoneTeste(s.pessoaId!), unidadeId],
      );
      const l = sol.rows[0];
      if (!l) return { conversa: null };
      const msgs = await c.tx.client.query(
        `SELECT m.id, m.autor_tipo, m.visibilidade, m.texto, m.criado_em,
                (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao'
                  AND d.idioma <> 'pt' AND m.autor_tipo <> 'solicitante' ORDER BY d.criado_em DESC LIMIT 1) AS enviado
           FROM mensagem m WHERE m.solicitacao_id = $1 ORDER BY m.criado_em, m.id`,
        [l.id],
      );
      const evs = await c.tx.client.query(
        `SELECT e.tipo, e.dados, e.criado_em FROM evento e
          WHERE e.solicitacao_id = $1 AND e.tipo IN ('fluxo', 'decisao_ia', 'encaminhada', 'transferida', 'reaberta', 'resolvida',
                'resposta_automatica', 'dado_coletado', 'identificado', 'encerrada_pelo_fluxo', 'pesquisa_respondida', 'cancelada', 'vinculo_qr')
          ORDER BY e.id`,
        [l.id],
      );
      return {
        conversa: {
          id: l.id,
          estado: l.estado,
          setor: l.setor,
          triagem: l.triagem ? l.sugerido : null,
          versao: l.rascunho ? 'rascunho' : `versão ${l.numero}`,
          dados: l.contexto?.fluxo?.dados ?? {},
        },
        mensagens: msgs.rows.map((m) => ({
          id: m.id,
          autor: m.autor_tipo,
          interna: m.visibilidade === 'interna',
          texto: (m.enviado ?? m.texto ?? '').replace(/\s*\(c[oó]digo #R-[A-Za-z0-9]+\)/, ''),
          criadoEm: m.criado_em,
        })),
        eventos: evs.rows,
      };
    });
  }

  /** Erros bloqueiam a publicação; avisos só informam. */
  private async checar(c: Ctx, unidadeId: string, bruto: unknown) {
    const erros: { campo: string; erro: string }[] = [];
    const avisos: string[] = [];
    const p = ConfigUnidade.safeParse(bruto);
    if (!p.success) {
      for (const i of p.error.issues) erros.push({ campo: i.path.join('.'), erro: i.message });
      return { cfg: null, erros, avisos };
    }
    const cfg = p.data;
    const atuais = await c.tx.client.query<{ chave: string; nome: string; abertos: number }>(
      `SELECT st.chave, st.nome,
              (SELECT count(*)::int FROM solicitacao s WHERE s.setor_id = st.id
                 AND s.estado IN ('automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante')) AS abertos
         FROM setor st WHERE st.unidade_id = $1 AND st.ativo`,
      [unidadeId],
    );
    const novas = new Set(cfg.setores.map((x) => x.chave));
    for (const st of atuais.rows) {
      if (novas.has(st.chave)) continue;
      if (st.abertos > 0) erros.push({ campo: 'setores', erro: `${st.nome} tem ${st.abertos} pedido(s) aberto(s): transfira antes de remover` });
      else avisos.push(`${st.nome} será desativado`);
    }
    const existentes = new Set(atuais.rows.map((x) => x.chave));
    for (const st of cfg.setores) if (!existentes.has(st.chave)) avisos.push(`${st.nome} será criado em modo sombra (sem equipe lotada ainda)`);
    for (const st of cfg.setores) {
      if (st.palavrasChave.length === 0) avisos.push(`${st.nome}: sem palavras-chave, o roteamento de reserva (sem IA) nunca escolhe este setor`);
      if (!st.nomes.es || !st.nomes.en) avisos.push(`${st.nome}: sem nome em espanhol/inglês, o hóspede estrangeiro vê o nome em português`);
    }
    // Escada: pessoas citadas precisam existir; degrau que não chama ninguém merece aviso.
    const supervisores = await c.tx.client.query<{ chave: string; n: number }>(
      `SELECT st.chave, count(p.id)::int AS n FROM setor st
         LEFT JOIN lotacao l ON l.setor_id = st.id AND l.papel = 'supervisor'
         LEFT JOIN pessoa p ON p.id = l.pessoa_id AND p.ativo
        WHERE st.unidade_id = $1 GROUP BY st.chave`,
      [unidadeId],
    );
    const temSupervisor = new Map(supervisores.rows.map((x) => [x.chave, x.n > 0]));
    const escadas = [
      { onde: 'escalonamento', nome: 'Escada padrão', escada: cfg.escalonamento, setor: null as string | null },
      ...cfg.setores.flatMap((st, i) => (st.escalonamento ? [{ onde: `setores.${i}.escalonamento`, nome: st.nome, escada: st.escalonamento, setor: st.chave }] : [])),
    ];
    const pessoas = escadas.flatMap((e) => e.escada.avisos.flatMap((a) => (a.alvo.tipo === 'pessoa' ? [a.alvo.pessoaId] : [])));
    const ativas = new Set(
      pessoas.length
        ? (await c.tx.client.query<{ id: string }>('SELECT id FROM pessoa WHERE id = ANY($1::uuid[]) AND ativo', [pessoas])).rows.map((x) => x.id)
        : [],
    );
    const usamPadrao = cfg.setores.filter((st) => !st.escalonamento).map((st) => st.chave);
    const gerentes = (await c.tx.client.query<{ n: number }>('SELECT count(*)::int AS n FROM pessoa WHERE gerente AND ativo')).rows[0]!.n;
    for (const e of escadas) {
      if (e.escada.avisos.length === 0) avisos.push(`${e.nome}: sem avisos, ninguém da supervisão é chamado quando um pedido fica parado`);
      e.escada.avisos.forEach((a, i) => {
        if (a.alvo.tipo === 'pessoa' && !ativas.has(a.alvo.pessoaId)) {
          erros.push({ campo: `${e.onde}.avisos.${i}`, erro: `${e.nome}, aviso ${i + 1}: a pessoa não existe ou foi desativada` });
        }
        if (a.alvo.tipo === 'gerentes' && gerentes === 0) {
          avisos.push(`${e.nome}, aviso ${i + 1}: ninguém está marcado como gerente na Equipe (o degrau não chama ninguém)`);
        }
        if (a.alvo.tipo === 'supervisores') {
          const alvos = a.alvo.setor ? [a.alvo.setor] : e.setor ? [e.setor] : usamPadrao;
          const sem = alvos.filter((ch) => temSupervisor.get(ch) === false).map((ch) => cfg.setores.find((x) => x.chave === ch)?.nome ?? ch);
          if (sem.length) avisos.push(`${e.nome}, aviso ${i + 1}: sem supervisor lotado em ${sem.join(', ')} (o degrau não chama ninguém lá)`);
        }
      });
    }
    return { cfg, erros, avisos };
  }

  /** Laço semanal: matriz de confusão e sugestão de limites a partir das correções. */
  @Get('calibracao')
  calibracao(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Query('dias') dias = '7') {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `SELECT d.setor_escolhido AS previsto, coalesce(sc.chave, d.setor_escolhido) AS correto, d.confianca, d.motor,
                (SELECT cr.texto FROM correcao cr WHERE cr.decisao_id = d.id LIMIT 1) AS texto
           FROM decisao_ia d
           JOIN solicitacao s ON s.id = d.solicitacao_id
           LEFT JOIN correcao co ON co.decisao_id = d.id
           LEFT JOIN setor sc ON sc.id = co.setor_correto_id
          WHERE s.unidade_id = $1 AND NOT s.teste AND d.criado_em > now() - make_interval(days => $2)
            AND d.setor_escolhido NOT IN ('vago') AND d.acao NOT LIKE 'gatilho:%' AND d.confianca IS NOT NULL
            AND (co.id IS NOT NULL OR s.estado IN ('resolvida', 'encerrada'))`,
        [unidadeId, Number(dias) || 7],
      );
      const amostras = r.rows.map((l) => ({ previsto: l.previsto, correto: l.correto, confianca: Number(l.confianca) }));
      return {
        ...relatorio(amostras),
        limiteSugeridoEncaminhar: sugerirLimite(amostras, 0.95),
        limiteSugeridoBaixaCerteza: sugerirLimite(amostras, 0.8),
        erros: r.rows.filter((l) => l.previsto !== l.correto).slice(0, 50).map((l) => ({ previsto: l.previsto, correto: l.correto, confianca: l.confianca, texto: l.texto })),
        observacao: 'Amostras sem correção contam como acerto quando o caso foi resolvido no setor previsto.',
      };
    });
  }

  /**
   * Automação setor a setor: acerto da IA nos últimos 30 dias e recomendação.
   * Em sombra, conta cada sugestão confirmada ou corrigida na triagem. No automático,
   * conta o que foi resolvido sem transferência (acerto) e as correções (erro).
   */
  @Get('automacao')
  automacao(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `WITH d AS (
           SELECT d.setor_escolhido, d.sombra, d.revisao, d.confianca, so.estado
             FROM decisao_ia d JOIN solicitacao so ON so.id = d.solicitacao_id
            WHERE so.unidade_id = $1 AND NOT so.teste AND d.criado_em > now() - interval '30 days'
              AND d.acao IN ('encaminhar', 'encaminhar_baixa_certeza'))
         SELECT st.id, st.chave, st.nome, st.modo_ia,
                count(*) FILTER (WHERE d.sombra AND d.revisao = 'confirmada')::int AS confirmadas,
                count(*) FILTER (WHERE d.sombra AND d.revisao = 'corrigida')::int AS corrigidas_sombra,
                count(*) FILTER (WHERE d.sombra AND d.revisao IS NULL)::int AS sem_revisao,
                count(*) FILTER (WHERE NOT d.sombra AND d.revisao IS NULL AND d.estado IN ('resolvida', 'encerrada'))::int AS acertos_auto,
                count(*) FILTER (WHERE NOT d.sombra AND d.revisao = 'corrigida')::int AS corrigidas_auto
           FROM setor st LEFT JOIN d ON d.setor_escolhido = st.chave
          WHERE st.unidade_id = $1 AND st.ativo
          GROUP BY st.id ORDER BY st.nome`,
        [unidadeId],
      );
      const MINIMO = 20;
      return r.rows.map((l) => {
        const acertos = l.confirmadas + l.acertos_auto;
        const avaliadas = acertos + l.corrigidas_sombra + l.corrigidas_auto;
        const acerto = avaliadas ? acertos / avaliadas : null;
        let recomendacao: 'pode_liberar' | 'voltar_sombra' | null = null;
        if (avaliadas >= MINIMO && acerto !== null) {
          if (l.modo_ia === 'sombra' && acerto >= 0.95) recomendacao = 'pode_liberar';
          if (l.modo_ia === 'automatico' && acerto < 0.85) recomendacao = 'voltar_sombra';
        }
        return {
          setorId: l.id,
          chave: l.chave,
          nome: l.nome,
          modo: l.modo_ia,
          avaliadas,
          acerto,
          pendentes: l.sem_revisao,
          faltam: Math.max(0, MINIMO - avaliadas),
          recomendacao,
        };
      });
    });
  }

  @Post('setores/modo-ia')
  @HttpCode(200)
  modoIa(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ setorId: z.uuid(), modo: z.enum(['sombra', 'automatico']) }))) b: { setorId: string; modo: 'sombra' | 'automatico' }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const r = await c.tx.client.query('UPDATE setor SET modo_ia = $2 WHERE id = $1 RETURNING nome', [b.setorId, b.modo]);
      if (!r.rowCount) throw new BadRequestException('setor não encontrado');
      await this.nucleo.evento(c, { tipo: 'modo_ia_alterado', atorTipo: 'pessoa', atorId: s.pessoaId, dados: { setorId: b.setorId, modo: b.modo } });
      return { ok: true };
    });
  }
}
