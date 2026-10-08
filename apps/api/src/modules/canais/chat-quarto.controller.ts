import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { ServicosIA } from '@ramais/ai';
import { ArquivoMidia, ChatMensagemReq, ChatSessaoReq, ChatTextosReq, InscricaoPushReq, type ChatView } from '@ramais/contracts';
import { resolverChat, resolverQuarto } from '@ramais/db';
import type { Response } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { Publico } from '../../infra/auth.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { lerArquivo } from '../../infra/midia.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { IA, POOL } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { comContextoIA } from '../../infra/uso-ia.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Orquestrador, solicitanteDoQuarto, type EntradaMensagem } from '../jornada/orquestrador.js';

const ChatSetorReq = z.object({ chave: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60) });

const ChatMidiaReq = ArquivoMidia.extend({ id: z.uuid(), legenda: z.string().trim().max(1000).optional() });
type ChatMidiaReq = z.infer<typeof ChatMidiaReq>;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

interface SessaoChat {
  id: string;
  orgId: string;
  unidadeId: string;
  localId: string;
  estadiaDesde: Date;
}

/**
 * Chat do quarto: o QR do quarto abre um chat no navegador, sem WhatsApp e sem custo da Meta.
 * A mensagem entra pelo mesmo caminho do WhatsApp (classificação, fila, escada), por um canal
 * do tipo "web" da unidade. Uma conversa por quarto; cada leitura do QR abre uma sessão presa à
 * estadia: o hóspede só vê o que foi dito a partir do check-in dele, e a sessão vence no check-out
 * (sem lista de hóspedes, em 24 h).
 */
@Controller('chat')
@Publico()
export class ChatQuartoController {
  constructor(
    private readonly nucleo: Nucleo,
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(IA) private readonly ia: ServicosIA,
    private readonly unidades: Unidades,
    private readonly orquestrador: Orquestrador,
  ) {}

  /** Textos da tela já traduzidos, por idioma e conteúdo: só o primeiro hóspede de cada idioma espera a IA. */
  private readonly textosTraduzidos = new Map<string, Promise<string[]>>();

  /**
   * A tela do chat vem pronta em PT/ES/EN; para qualquer outro idioma do celular, o navegador
   * manda os textos em inglês e recebe de volta traduzidos. Só com sessão aberta (QR lido).
   */
  @Post('textos')
  @HttpCode(200)
  async textos(@Headers('x-chat') token: string | undefined, @Body(new Zod(ChatTextosReq)) b: ChatTextosReq) {
    const { orgId } = await this.resolver(token);
    const idioma = b.idioma.toLowerCase().replace('_', '-');
    if (!this.ia.tradutor.disponivel) return { idioma, textos: b.textos, traduzido: false };
    const chave = `${idioma}:${createHash('sha256').update(JSON.stringify(b.textos)).digest('hex')}`;
    let pronto = this.textosTraduzidos.get(chave);
    if (!pronto) {
      pronto = comContextoIA({ orgId }, () => this.ia.tradutor.traduzirLote(b.textos, idioma));
      this.textosTraduzidos.set(chave, pronto);
      // Falhou: esquece, para a próxima tentativa chamar de novo.
      pronto.catch(() => this.textosTraduzidos.delete(chave));
    }
    try {
      return { idioma, textos: await pronto, traduzido: true };
    } catch {
      return { idioma, textos: b.textos, traduzido: false };
    }
  }

  /** Lê o QR: abre uma sessão para este navegador. O segredo fica só com ele (guardamos o hash). */
  @Post('sessao')
  @HttpCode(201)
  async abrir(@Body(new Zod(ChatSessaoReq)) b: ChatSessaoReq) {
    const q = await resolverQuarto(this.pool, b.codigo);
    if (!q) throw new NotFoundException('QR inválido ou desativado. Peça ajuda à recepção.');
    const token = randomBytes(32).toString('base64url');
    return this.nucleo.executar(q.orgId, async (c) => {
      // Estadia: com a lista de hóspedes, do check-in ao check-out. Sem ela, quem já está com
      // o chat aberto neste quarto (o casal no outro celular) define o começo; senão, agora.
      const h = await c.tx.client.query<{ desde: Date; ate: Date }>(
        `SELECT (h.checkin::timestamp AT TIME ZONE u.fuso) AS desde, ((h.checkout + time '12:00') AT TIME ZONE u.fuso) AS ate
           FROM hospede_ativo h JOIN unidade u ON u.id = h.unidade_id
          WHERE h.local_id = $1 AND current_date BETWEEN h.checkin AND h.checkout
          ORDER BY h.checkout DESC LIMIT 1`,
        [q.localId],
      );
      const viva = await c.tx.client.query<{ estadia_desde: Date }>(
        'SELECT estadia_desde FROM chat_sessao WHERE local_id = $1 AND expira_em > now() ORDER BY estadia_desde LIMIT 1',
        [q.localId],
      );
      const desde = h.rows[0]?.desde ?? viva.rows[0]?.estadia_desde ?? new Date();
      const ate = h.rows[0]?.ate ?? new Date(Date.now() + 24 * 3600_000);
      await c.tx.client.query(
        `INSERT INTO chat_sessao (org_id, unidade_id, local_id, token_hash, estadia_desde, expira_em, idioma)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [q.orgId, q.unidadeId, q.localId, hash(token), desde, ate, b.idioma ?? null],
      );
      await this.canalWeb(c, q.unidadeId);
      return { token, ...(await this.cabecalho(c, q.unidadeId, q.localId)), expiraEm: new Date(ate).toISOString() };
    });
  }

  /** Menu principal: o hóspede escolhe o setor; vai para lá a qualquer momento (ver Orquestrador.escolherSetor). */
  @Post('setor')
  @HttpCode(200)
  async escolherSetor(@Headers('x-chat') token: string | undefined, @Body(new Zod(ChatSetorReq)) b: z.infer<typeof ChatSetorReq>) {
    const { orgId, sessaoId } = await this.resolver(token);
    const { s, canalId } = await this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      return { s, canalId: await this.canalWeb(c, s.unidadeId) };
    });
    return this.orquestrador.escolherSetor({
      orgId,
      unidadeId: s.unidadeId,
      canalId,
      localId: s.localId,
      naoAntesDe: s.estadiaDesde.toISOString(),
      chave: b.chave,
    });
  }

  /** O hóspede pediu aviso quando a equipe responder: este navegador passa a receber (até a sessão vencer). */
  @Post('notificacoes')
  @HttpCode(200)
  async notificacoes(@Headers('x-chat') token: string | undefined, @Body(new Zod(InscricaoPushReq)) b: InscricaoPushReq) {
    const { orgId, sessaoId } = await this.resolver(token);
    return this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      await c.tx.client.query(
        `INSERT INTO push_web (org_id, chat_sessao_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint, chat_sessao_id) WHERE chat_sessao_id IS NOT NULL DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [orgId, s.id, b.endpoint, b.keys.p256dh, b.keys.auth],
      );
      return { ok: true };
    });
  }

  /** A conversa da estadia, do jeito que o hóspede vê: no idioma dele, sem notas internas. */
  @Get()
  async ver(@Headers('x-chat') token: string | undefined): Promise<ChatView> {
    const { orgId, sessaoId } = await this.resolver(token);
    return this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      await c.tx.client.query(`UPDATE chat_sessao SET ultimo_uso_em = now() WHERE id = $1 AND ultimo_uso_em < now() - interval '1 minute'`, [s.id]);
      const r = await c.tx.client.query(
        `SELECT m.id, m.autor_tipo, m.tipo, m.texto, m.status_envio, m.criado_em, m.wa_message_id, (m.midia_chave IS NOT NULL) AS tem_midia,
                split_part(p.nome, ' ', 1) AS autor_nome,
                (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'transcricao' ORDER BY d.criado_em DESC LIMIT 1) AS transcricao,
                (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma <> 'pt'
                  ORDER BY d.criado_em DESC LIMIT 1) AS traducao
           FROM mensagem m
           JOIN solicitacao so ON so.id = m.solicitacao_id
           JOIN solicitante st ON st.id = so.solicitante_id
           LEFT JOIN pessoa p ON p.id = m.autor_pessoa_id
          WHERE st.telefone = $1 AND so.unidade_id = $2 AND m.visibilidade = 'externa' AND m.criado_em >= $3
            AND (m.autor_tipo = 'solicitante' OR m.status_envio IN ('enviada', 'entregue', 'lida'))
          ORDER BY m.criado_em DESC, m.id DESC LIMIT 200`,
        [solicitanteDoQuarto(s.localId), s.unidadeId, s.estadiaDesde],
      );
      // O idioma da conversa (o último que a detecção firmou nesta estadia), para a tela segui-lo:
      // celular em inglês com o hóspede escrevendo em português mostra a tela em português.
      const conversa = await c.tx.client.query<{ idioma: string }>(
        `SELECT so.idioma FROM solicitacao so JOIN solicitante st ON st.id = so.solicitante_id
          WHERE st.telefone = $1 AND so.unidade_id = $2 AND so.criado_em >= $3 AND so.contexto->>'idiomaDefinido' = 'true'
          ORDER BY so.criado_em DESC LIMIT 1`,
        [solicitanteDoQuarto(s.localId), s.unidadeId, s.estadiaDesde],
      );
      const prefixo = `web.${s.id}.`;
      return {
        ...(await this.cabecalho(c, s.unidadeId, s.localId)),
        idioma: conversa.rows[0]?.idioma ?? null,
        ...(await this.menu(c, s)),
        mensagens: r.rows.reverse().map((l) => {
          const hospede = l.autor_tipo === 'solicitante';
          // Para o hóspede, a fala da equipe aparece já traduzida (no áudio, a transcrição traduzida).
          const texto = hospede ? l.texto : l.tipo === 'audio' ? l.texto : (l.traducao ?? l.texto);
          const transcricao = l.tipo === 'audio' ? (hospede ? l.transcricao : (l.traducao ?? l.transcricao)) : null;
          return {
            id: l.id,
            autor: hospede ? 'hospede' : l.autor_tipo === 'pessoa' ? 'equipe' : 'automatica',
            autorNome: l.autor_nome ?? null,
            tipo: l.tipo,
            texto,
            transcricao,
            midiaUrl: l.tem_midia ? `/chat/midia/${l.id}` : null,
            criadoEm: new Date(l.criado_em).toISOString(),
            // Só as deste navegador: casa a bolha otimista com a mensagem gravada.
            clienteId: hospede && String(l.wa_message_id ?? '').startsWith(prefixo) ? String(l.wa_message_id).slice(prefixo.length) : null,
          };
        }),
      };
    });
  }

  @Post('mensagens')
  @HttpCode(202)
  async escrever(@Headers('x-chat') token: string | undefined, @Body(new Zod(ChatMensagemReq)) b: ChatMensagemReq) {
    const { orgId, sessaoId } = await this.resolver(token);
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      await this.entrar(c, s, b.id, { tipo: 'texto', texto: b.texto.trim(), midiaChave: null, midiaMime: null });
    });
    return { ok: true };
  }

  @Post('midia')
  @HttpCode(202)
  async enviarMidia(@Headers('x-chat') token: string | undefined, @Body(new Zod(ChatMidiaReq)) b: ChatMidiaReq) {
    const { orgId, sessaoId } = await this.resolver(token);
    const arquivo = lerArquivo(b);
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      const chave = `org/${orgId}/mensagem/web-${randomUUID()}.${arquivo.ext}`;
      await this.armazenamento.salvar(chave, arquivo.dados, arquivo.mime);
      await this.entrar(c, s, b.id, { tipo: b.tipo, texto: b.legenda || null, midiaChave: chave, midiaMime: arquivo.mime });
    });
    return { ok: true };
  }

  /** Arquivo de uma mensagem da estadia. O navegador manda o segredo no cabeçalho e monta a URL local. */
  @Get('midia/:mensagemId')
  async midia(@Headers('x-chat') token: string | undefined, @Param('mensagemId', Uuid) mensagemId: string, @Res() res: Response) {
    const { orgId, sessaoId } = await this.resolver(token);
    const m = await this.nucleo.executar(orgId, async (c) => {
      const s = await this.sessao(c, sessaoId);
      const r = await c.tx.client.query<{ midia_chave: string; midia_mime: string | null }>(
        `SELECT m.midia_chave, m.midia_mime FROM mensagem m
           JOIN solicitacao so ON so.id = m.solicitacao_id JOIN solicitante st ON st.id = so.solicitante_id
          WHERE m.id = $1 AND st.telefone = $2 AND so.unidade_id = $3 AND m.criado_em >= $4
            AND m.visibilidade = 'externa' AND m.midia_chave IS NOT NULL`,
        [mensagemId, solicitanteDoQuarto(s.localId), s.unidadeId, s.estadiaDesde],
      );
      return r.rows[0];
    });
    if (!m) throw new NotFoundException();
    res.setHeader('content-type', m.midia_mime ?? 'application/octet-stream');
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(await this.armazenamento.ler(m.midia_chave));
  }

  // ------------------------------------------------------------------

  private async resolver(token: string | undefined) {
    if (!token || token.length > 100) throw new UnauthorizedException('leia o QR do quarto de novo');
    const r = await resolverChat(this.pool, hash(token));
    if (!r) throw new UnauthorizedException('a sessão do chat terminou; leia o QR do quarto de novo');
    return r;
  }

  private async sessao(c: Ctx, id: string): Promise<SessaoChat> {
    const r = await c.tx.client.query('SELECT id, org_id, unidade_id, local_id, estadia_desde FROM chat_sessao WHERE id = $1', [id]);
    const l = r.rows[0];
    if (!l) throw new UnauthorizedException();
    return { id: l.id, orgId: l.org_id, unidadeId: l.unidade_id, localId: l.local_id, estadiaDesde: new Date(l.estadia_desde) };
  }

  /** Setores do Menu principal (os do catálogo da jornada que estão ativos) e com qual o hóspede fala agora. */
  private async menu(c: Ctx, s: SessaoChat): Promise<Pick<ChatView, 'setores' | 'setorAtual'>> {
    const { cfg } = await this.unidades.versaoAtual(c.tx, s.unidadeId);
    const ativos = new Set((await this.unidades.setores(c.tx, s.unidadeId)).map((x) => x.chave));
    const atual = await c.tx.client.query<{ chave: string }>(
      `SELECT st.chave FROM solicitacao so JOIN solicitante sl ON sl.id = so.solicitante_id JOIN setor st ON st.id = so.setor_id
        WHERE sl.telefone = $1 AND so.unidade_id = $2 AND so.criado_em >= $3
          AND so.estado IN ('na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante')
        ORDER BY so.criado_em DESC LIMIT 1`,
      [solicitanteDoQuarto(s.localId), s.unidadeId, s.estadiaDesde],
    );
    return {
      setores: cfg.setores.filter((x) => ativos.has(x.chave)).map((x) => ({ chave: x.chave, nome: x.nome, nomes: x.nomes })),
      setorAtual: atual.rows[0]?.chave ?? null,
    };
  }

  private async cabecalho(c: Ctx, unidadeId: string, localId: string) {
    const r = await c.tx.client.query<{ hotel: string; quarto: string; tipo: string }>(
      'SELECT u.nome AS hotel, l.identificador AS quarto, l.tipo FROM local l JOIN unidade u ON u.id = l.unidade_id WHERE l.id = $1 AND u.id = $2',
      [localId, unidadeId],
    );
    const l = r.rows[0]!;
    return { hotel: l.hotel, quarto: l.quarto, tipoLocal: l.tipo };
  }

  /** Um canal "web" por unidade, criado na primeira leitura de QR. */
  private async canalWeb(c: Ctx, unidadeId: string): Promise<string> {
    const r = await c.tx.client.query<{ id: string }>(`SELECT id FROM canal_whatsapp WHERE unidade_id = $1 AND tipo = 'web'`, [unidadeId]);
    if (r.rows[0]) return r.rows[0].id;
    const n = await c.tx.client.query<{ id: string }>(
      `INSERT INTO canal_whatsapp (org_id, unidade_id, phone_number_id, waba_id, numero_exibicao, modo_credencial, credencial_ref, tipo)
       VALUES ($1, $2, $3, 'web', 'Chat do quarto', 'gerenciada', '', 'web')
       ON CONFLICT (phone_number_id) DO UPDATE SET ativo = true RETURNING id`,
      [c.tx.orgId, unidadeId, `web:${unidadeId}`],
    );
    return n.rows[0]!.id;
  }

  /** Entra na jornada como se fosse do WhatsApp, na mesma fila ordenada por conversa. */
  private async entrar(
    c: Ctx,
    s: SessaoChat,
    clienteId: string,
    m: { tipo: EntradaMensagem['tipo']; texto: string | null; midiaChave: string | null; midiaMime: string | null },
  ) {
    const canalId = await this.canalWeb(c, s.unidadeId);
    const de = solicitanteDoQuarto(s.localId);
    // Nome do solicitante: o quarto (a equipe vê "Quarto 412" na lista).
    await c.tx.client.query(
      `INSERT INTO solicitante (org_id, telefone, nome) SELECT $1, $2, 'Quarto ' || l.identificador FROM local l WHERE l.id = $3
       ON CONFLICT (org_id, telefone) DO NOTHING`,
      [s.orgId, de, s.localId],
    );
    const e: EntradaMensagem = {
      orgId: s.orgId,
      unidadeId: s.unidadeId,
      canalId,
      waMessageId: `web.${s.id}.${clienteId}`,
      de,
      nomePerfil: null,
      tipo: m.tipo,
      texto: m.texto,
      midiaId: null,
      midiaMime: m.midiaMime,
      midiaChave: m.midiaChave,
      recebidaEm: new Date().toISOString(),
      localId: s.localId,
      naoAntesDe: s.estadiaDesde.toISOString(),
    };
    await this.nucleo.enfileirar(c, 'mensagem-entrada', e, { singletonKey: `${canalId}:${de}` });
  }
}
