import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { InscricaoPushReq } from '@ramais/contracts';
import { z } from 'zod';
import { pessoaDa, Publico, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { PushWeb } from '../../infra/push-web.js';
import { Zod } from '../../infra/validacao.js';

const RemoverReq = z.object({ endpoint: z.url().max(1000) });

/**
 * Notificação no navegador para a equipe: pedido novo, mensagem do hóspede, nota interna,
 * menção e mensagem direta chegam com a aba fechada. Cada navegador se inscreve uma vez.
 */
@Controller('notificacoes')
export class NotificacoesController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly pushWeb: PushWeb,
  ) {}

  /** Chave pública VAPID (nula: notificação no navegador desligada neste servidor). */
  @Publico()
  @Get('chave')
  chave() {
    return { chave: this.pushWeb.chavePublica };
  }

  @Post('inscricao')
  @HttpCode(200)
  inscrever(@SessaoAtual() s: Sessao, @Body(new Zod(InscricaoPushReq)) b: InscricaoPushReq) {
    const eu = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      // O navegador é de quem entrou por último nele: a inscrição de outra pessoa sai.
      await c.tx.client.query('DELETE FROM push_web WHERE endpoint = $1 AND pessoa_id IS NOT NULL AND pessoa_id <> $2', [b.endpoint, eu]);
      await c.tx.client.query(
        `INSERT INTO push_web (org_id, pessoa_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint, pessoa_id) WHERE pessoa_id IS NOT NULL DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [s.orgId, eu, b.endpoint, b.keys.p256dh, b.keys.auth],
      );
      return { ok: true };
    });
  }

  /** Sair da conta ou desligar: este navegador para de receber os avisos da pessoa. */
  @Post('inscricao/remover')
  @HttpCode(200)
  remover(@SessaoAtual() s: Sessao, @Body(new Zod(RemoverReq)) b: z.infer<typeof RemoverReq>) {
    const eu = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      await c.tx.client.query('DELETE FROM push_web WHERE endpoint = $1 AND pessoa_id = $2', [b.endpoint, eu]);
      return { ok: true };
    });
  }
}
