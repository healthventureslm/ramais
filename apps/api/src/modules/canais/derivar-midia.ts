import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ServicosIA } from '@ramais/ai';
import { sala } from '@ramais/contracts';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { Nucleo } from '../../infra/nucleo.js';
import { IA } from '../../infra/tokens.js';
import { comContextoIA, marcarSolicitacaoIA } from '../../infra/uso-ia.js';

export interface DadosDerivarMidia {
  orgId: string;
  mensagemId: string;
  /** mensagem: conversa com o solicitante (ou nota interna). direta: mensagem direta entre a equipe. */
  origem: 'mensagem' | 'direta';
}

/**
 * Áudio da equipe vira texto: aparece embaixo do áudio, estilo WhatsApp, e é o que se traduz
 * para o hóspede. Sem IA (ou se ela falhar), o áudio segue sem transcrição; nunca trava o envio.
 */
@Injectable()
export class DerivarMidia {
  private readonly log = new Logger('midia');

  constructor(
    private readonly nucleo: Nucleo,
    @Inject(IA) private readonly ia: ServicosIA,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
  ) {}

  async processar(d: DadosDerivarMidia): Promise<void> {
    return comContextoIA({ orgId: d.orgId }, () => this.processarNoContexto(d));
  }

  private async processarNoContexto(d: DadosDerivarMidia): Promise<void> {
    const tabela = d.origem === 'mensagem' ? 'mensagem' : 'mensagem_interna';
    const m = await this.nucleo.executar(d.orgId, async (c) => {
      const r = await c.tx.client.query<{ midia_chave: string | null; midia_mime: string | null; tipo: string; solicitacao_id: string | null }>(
        `SELECT midia_chave, midia_mime, tipo, ${d.origem === 'mensagem' ? 'solicitacao_id' : 'NULL::uuid AS solicitacao_id'} FROM ${tabela} WHERE id = $1`,
        [d.mensagemId],
      );
      return r.rows[0];
    });
    if (!m?.midia_chave || m.tipo !== 'audio') return;
    marcarSolicitacaoIA(m.solicitacao_id);

    let transcricao: { texto: string; idioma: string; modelo: string } | null = null;
    if (this.ia.multimodal.disponivel) {
      try {
        const dados = await this.armazenamento.ler(m.midia_chave);
        transcricao = await this.ia.multimodal.transcrever(dados, m.midia_mime ?? 'audio/wav');
      } catch (e) {
        this.log.warn(`transcrição falhou (${d.mensagemId}): ${(e as Error).message}`);
      }
    }

    await this.nucleo.executar(d.orgId, async (c) => {
      if (d.origem === 'direta') {
        const r = await c.tx.client.query<{ conversa_id: string; participantes: string[] }>(
          `UPDATE mensagem_interna m SET transcricao = $2 FROM conversa_interna c
            WHERE m.id = $1 AND c.id = m.conversa_id RETURNING m.conversa_id, c.participantes`,
          [d.mensagemId, transcricao?.texto ?? null],
        );
        const l = r.rows[0];
        if (l && transcricao) {
          c.ef.depois(() =>
            this.nucleo.tempoReal.emitir(l.participantes.map((p) => sala.pessoa(p)), 'direta:atualizada', { conversaId: l.conversa_id, mensagemId: d.mensagemId }),
          );
        }
        return;
      }
      const r = await c.tx.client.query<{ solicitacao_id: string; status_envio: string }>(
        'SELECT solicitacao_id, status_envio FROM mensagem WHERE id = $1',
        [d.mensagemId],
      );
      const l = r.rows[0]!;
      if (transcricao) {
        await c.tx.client.query(
          `INSERT INTO mensagem_derivado (org_id, mensagem_id, tipo, idioma, texto, modelo) VALUES ($1, $2, 'transcricao', $3, $4, $5)`,
          [d.orgId, d.mensagemId, transcricao.idioma, transcricao.texto, transcricao.modelo],
        );
        c.ef.depois(() =>
          this.nucleo.tempoReal.emitir(sala.solicitacao(l.solicitacao_id), 'solicitacao:mensagem', {
            solicitacaoId: l.solicitacao_id,
            mensagemId: d.mensagemId,
          }),
        );
      }
      // Para o solicitante, o envio espera a transcrição (é ela que vai traduzida).
      if (l.status_envio === 'pendente') await this.nucleo.enfileirar(c, 'mensagem-saida', { orgId: d.orgId, mensagemId: d.mensagemId });
    });
  }
}
