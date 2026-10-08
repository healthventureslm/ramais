import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ServicosIA } from '@ramais/ai';
import { sala } from '@ramais/contracts';
import { idiomaDosTextos } from '@ramais/domain';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { ClienteMeta, ErroMeta } from '../../infra/meta.js';
import { audioAceitoNoWhatsapp } from '../../infra/midia.js';
import { comContextoIA, marcarSolicitacaoIA } from '../../infra/uso-ia.js';
import { Nucleo } from '../../infra/nucleo.js';
import { IA } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';

const MAX_TENTATIVAS = 8;
/** Corpo do aviso no navegador do hóspede quando a equipe manda foto ou áudio sem texto. */
const AVISO_MIDIA = { pt: 'Nova mensagem do hotel', es: 'Nuevo mensaje del hotel', en: 'New message from the hotel' } as const;
const JANELA_MS = 24 * 3600_000;

/**
 * Envio pela Meta. A equipe escreve em português; quem recebe lê no idioma dele.
 * O original fica guardado, e a tradução enviada vira um derivado com o ID do WhatsApp.
 * Fora da janela de 24 h, sai como template aprovado.
 * Foto vai com a legenda traduzida. Áudio vai como áudio (se o formato servir ao WhatsApp)
 * seguido da transcrição traduzida, para quem não pode ouvir na hora.
 * No chat do quarto (canal web) não há Meta: a mensagem fica pronta para o navegador do hóspede
 * buscar, já com a tradução, e não existe janela de 24 h.
 */
@Injectable()
export class Saida {
  private readonly log = new Logger('saida');

  constructor(
    private readonly nucleo: Nucleo,
    private readonly meta: ClienteMeta,
    private readonly unidades: Unidades,
    @Inject(IA) private readonly ia: ServicosIA,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
  ) {}

  async enviar(orgId: string, mensagemId: string): Promise<void> {
    return comContextoIA({ orgId }, () => this.enviarNoContexto(orgId, mensagemId));
  }

  private async enviarNoContexto(orgId: string, mensagemId: string): Promise<void> {
    // 1. Ler (transação curta).
    const dados = await this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query(
        `SELECT m.id, m.texto, m.idioma, m.autor_tipo, m.status_envio, m.tentativas_envio, m.tipo, m.midia_chave, m.midia_mime,
                (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'transcricao'
                  ORDER BY d.criado_em DESC LIMIT 1) AS transcricao,
                s.id AS solicitacao_id, s.idioma AS idioma_destino, s.ultima_msg_solicitante_em, s.jornada_versao_id,
                s.resumo, s.unidade_id, s.teste, s.local_id, st.telefone, cw.phone_number_id, cw.credencial_ref, cw.tipo AS canal_tipo,
                (SELECT u.nome FROM unidade u WHERE u.id = s.unidade_id) AS hotel,
                (SELECT l.codigo_qr FROM local l WHERE l.id = s.local_id) AS codigo_qr
           FROM mensagem m
           JOIN solicitacao s ON s.id = m.solicitacao_id
           JOIN solicitante st ON st.id = s.solicitante_id
           JOIN canal_whatsapp cw ON cw.id = s.canal_id
          WHERE m.id = $1`,
        [mensagemId],
      );
      const l = r.rows[0];
      if (!l || l.status_envio !== 'pendente') return null;
      const cfg = await this.unidades.configDaVersao(c.tx, l.jornada_versao_id);
      return { ...l, cfg };
    });
    if (!dados) return;
    marcarSolicitacaoIA(dados.solicitacao_id, dados.unidade_id);

    // 2. Traduzir (sem transação). Textos fixos já estão no idioma certo.
    // No áudio, o que se traduz é a transcrição; na foto, a legenda.
    const midia = dados.tipo === 'imagem' || dados.tipo === 'audio' ? (dados.tipo as 'imagem' | 'audio') : null;
    const original: string | null = dados.tipo === 'audio' ? dados.transcricao : dados.texto;
    let texto: string = original ?? '';
    let traducao: { texto: string; modelo: string; alerta: string | null; idioma: string } | null = null;
    // Textos fixos existem em PT/ES/EN; para outro idioma (japonês, alemão…) saem em inglês e
    // são traduzidos aqui, como a fala da equipe.
    const fixoForaDoIdioma =
      dados.autor_tipo === 'sistema' && /^[a-z]{2}$/.test(dados.idioma_destino ?? '') && idiomaDosTextos(dados.idioma_destino) !== dados.idioma_destino;
    const precisaTraduzir =
      Boolean(texto) &&
      (dados.autor_tipo === 'pessoa' || dados.autor_tipo === 'ia' || fixoForaDoIdioma) &&
      dados.idioma_destino &&
      dados.idioma_destino !== dados.idioma;
    if (precisaTraduzir && this.ia.tradutor.disponivel) {
      try {
        const t = await this.ia.tradutor.traduzir(texto, dados.idioma_destino, { de: dados.idioma, glossario: dados.cfg.glossario });
        traducao = { texto: t.texto, modelo: t.modelo, alerta: t.alerta, idioma: dados.idioma_destino };
        texto = t.texto;
      } catch (e) {
        this.log.warn(`tradução falhou, enviando original (${mensagemId}): ${(e as Error).message}`);
      }
    }

    // 3. Enviar.
    const canal = { phoneNumberId: dados.phone_number_id, credencialRef: dados.credencial_ref };
    const ultima = dados.ultima_msg_solicitante_em ? new Date(dados.ultima_msg_solicitante_em).getTime() : 0;
    const web = dados.canal_tipo === 'web';
    const foraDaJanela = !web && Date.now() - ultima > JANELA_MS;
    let waId: string;
    try {
      if (dados.teste) {
        // Simulador: registra como enviada sem falar com a Meta.
        waId = `teste.${randomUUID()}`;
      } else if (web) {
        waId = `web.${randomUUID()}`;
      } else if (foraDaJanela) {
        const tpl = dados.cfg.templates.find((t: { nome: string }) => t.nome === 'atualizacao_solicitacao');
        if (!tpl) throw new ErroMeta('fora da janela de 24 h e sem template configurado', 0, true);
        waId = await this.meta.enviarTemplate(canal, dados.telefone, tpl.nome, idiomaDosTextos(dados.idioma_destino), [
          (texto || (midia === 'imagem' ? '[foto]' : '[áudio]')).slice(0, 1000),
        ]);
      } else if (midia) {
        waId = await this.enviarMidia(canal, dados.telefone, midia, dados.midia_chave, dados.midia_mime, texto);
      } else {
        waId = await this.meta.enviarTexto(canal, dados.telefone, texto);
      }
    } catch (e) {
      await this.falhou(orgId, mensagemId, dados.solicitacao_id, dados.unidade_id, e, dados.tentativas_envio + 1);
      return;
    }

    // 4. Registrar.
    await this.nucleo.executar(orgId, async (c) => {
      await c.tx.client.query(
        `UPDATE mensagem SET status_envio = 'enviada', wa_message_id = $2, tentativas_envio = tentativas_envio + 1, erro_envio = NULL
          WHERE id = $1`,
        [mensagemId, waId],
      );
      if (traducao) {
        await c.tx.client.query(
          `INSERT INTO mensagem_derivado (org_id, mensagem_id, tipo, idioma, texto, modelo, alerta)
           VALUES ($1, $2, 'traducao', $3, $4, $5, $6)`,
          [orgId, mensagemId, traducao.idioma, traducao.texto, traducao.modelo, traducao.alerta],
        );
      }
      if (foraDaJanela) {
        await this.nucleo.evento(c, { solicitacaoId: dados.solicitacao_id, tipo: 'enviada_por_template', atorTipo: 'sistema', dados: { mensagemId } });
      }
      // Chat do quarto: o hóspede pode estar com a página fechada. Avisa no navegador dele
      // (o service worker não mostra nada se o chat estiver aberto na tela).
      if (web && !dados.teste && dados.local_id && dados.codigo_qr) {
        await this.nucleo.enfileirar(c, 'notificacao', {
          orgId,
          localId: dados.local_id,
          titulo: dados.hotel ?? 'Hotel',
          corpo: (texto || AVISO_MIDIA[idiomaDosTextos(dados.idioma_destino)]).slice(0, 180),
          dados: { tipo: 'chat', solicitacaoId: dados.solicitacao_id },
          alta: false,
          url: `/q/${dados.codigo_qr}`,
        });
      }
      c.ef.depois(() =>
        this.nucleo.tempoReal.emitir(sala.solicitacao(dados.solicitacao_id), 'solicitacao:mensagem', {
          solicitacaoId: dados.solicitacao_id,
          mensagemId,
        }),
      );
    });
  }

  private async enviarMidia(
    canal: { phoneNumberId: string; credencialRef: string },
    para: string,
    tipo: 'imagem' | 'audio',
    chave: string | null,
    mime: string | null,
    texto: string,
  ): Promise<string> {
    const ouvivel = tipo === 'imagem' || (mime !== null && audioAceitoNoWhatsapp(mime));
    if (chave && mime && ouvivel) {
      const dados = await this.armazenamento.ler(chave);
      const id = await this.meta.enviarMidia(canal, para, { tipo, dados, mime, legenda: tipo === 'imagem' ? texto || null : null });
      // A transcrição vai logo depois do áudio.
      if (tipo === 'audio' && texto) await this.meta.enviarTexto(canal, para, texto);
      return id;
    }
    // Formato que o WhatsApp não toca (ex.: wav gravado no navegador): vai a transcrição.
    if (texto) return this.meta.enviarTexto(canal, para, texto);
    throw new ErroMeta('áudio em formato que o WhatsApp não aceita e sem transcrição', 0, true);
  }

  private async falhou(orgId: string, mensagemId: string, solicitacaoId: string, unidadeId: string, erro: unknown, tentativa: number) {
    const definitivo = erro instanceof ErroMeta && erro.definitivo;
    const desistir = definitivo || tentativa >= MAX_TENTATIVAS;
    await this.nucleo.executar(orgId, async (c) => {
      await c.tx.client.query(
        `UPDATE mensagem SET tentativas_envio = $2, erro_envio = $3, status_envio = CASE WHEN $4 THEN 'falhou' ELSE status_envio END
          WHERE id = $1`,
        [mensagemId, tentativa, (erro as Error).message.slice(0, 500), desistir],
      );
      if (desistir) {
        await this.nucleo.evento(c, { solicitacaoId, tipo: 'envio_falhou', atorTipo: 'sistema', dados: { mensagemId, erro: (erro as Error).message } });
        c.ef.depois(() => {
          this.nucleo.tempoReal.emitir(sala.solicitacao(solicitacaoId), 'solicitacao:mensagem', { solicitacaoId, mensagemId });
          this.nucleo.tempoReal.emitir(sala.unidade(unidadeId), 'aviso', { texto: 'Uma mensagem não pôde ser entregue ao hóspede.' });
        });
      }
    });
    // Erro transitório: lança para o pg-boss tentar de novo com espera crescente.
    if (!desistir) throw erro;
  }
}
