import { randomBytes } from 'node:crypto';
import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { gerarCodigoLocal, linkWhatsApp } from '@ramais/domain';
import type { Request } from 'express';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { CONFIG } from '../../infra/tokens.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { exigirAdmin } from './guarda.js';

const aleatorio = (n: number) => new Uint8Array(randomBytes(n));

/**
 * Expande "101-110, 201, 301-303" em ["101", ..., "110", "201", "301", "302", "303"].
 * Intervalos só com números; o resto entra como está ("Suíte Master").
 */
export function expandirIdentificadores(texto: string): string[] {
  const saida: string[] = [];
  for (const parte of texto.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(parte);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (b < a || b - a > 500) throw new BadRequestException(`intervalo inválido: ${parte}`);
      for (let i = a; i <= b; i++) saida.push(String(i).padStart(m[1]!.length, '0'));
    } else {
      saida.push(parte.slice(0, 40));
    }
  }
  return [...new Set(saida)];
}

/**
 * Quartos (locais) da unidade e o QR de cada um. O código do QR é aleatório: não dá para
 * adivinhar o de outro quarto. Se um QR vazar, gere um código novo para aquele quarto.
 * O QR leva ao WhatsApp da unidade ou ao chat do quarto no navegador (sem custo da Meta).
 */
@Controller('admin/quartos')
export class LocaisController {
  constructor(
    private readonly nucleo: Nucleo,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  /**
   * Endereço do app web nos QR: WEB_URL_PUBLICA, se configurado. Senão, o endereço por onde o
   * admin está acessando (o proxy do Vite repassa o host original, então por um túnel do ngrok o
   * QR já sai com o domínio do túnel). Por fim, o primeiro de WEB_ORIGEM.
   */
  private urlWeb(req: Request) {
    const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim() || null;
    const host = primeiro(req.headers['x-forwarded-host']);
    const proto = primeiro(req.headers['x-forwarded-proto']) ?? 'http';
    const doAcesso = host && /^[a-z0-9.-]+(:\d+)?$/i.test(host) && /^https?$/.test(proto) ? `${proto}://${host}` : null;
    return (this.cfg.WEB_URL_PUBLICA ?? doAcesso ?? this.cfg.WEB_ORIGEM.split(',')[0]!.trim()).replace(/\/+$/, '');
  }

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Req() req: Request) {
    const urlWeb = this.urlWeb(req);
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const canal = await c.tx.client.query(`SELECT numero_exibicao FROM canal_whatsapp WHERE unidade_id = $1 AND ativo AND tipo = 'whatsapp' LIMIT 1`, [
        unidadeId,
      ]);
      const numero = canal.rows[0]?.numero_exibicao as string | undefined;
      const destino = (await c.tx.client.query('SELECT qr_destino FROM unidade WHERE id = $1', [unidadeId])).rows[0]?.qr_destino as 'whatsapp' | 'web';
      const r = await c.tx.client.query(
        `SELECT l.id, l.identificador, l.tipo, l.ativo, l.codigo_qr,
                (SELECT h.sobrenome FROM hospede_ativo h WHERE h.local_id = l.id AND current_date BETWEEN h.checkin AND h.checkout LIMIT 1) AS hospede
           FROM local l WHERE l.unidade_id = $1
          ORDER BY l.ativo DESC, length(l.identificador), l.identificador`,
        [unidadeId],
      );
      return {
        numeroWhatsapp: numero ?? null,
        destino,
        quartos: r.rows.map((l) => ({
          id: l.id,
          identificador: l.identificador,
          tipo: l.tipo,
          ativo: l.ativo,
          hospede: l.hospede,
          link:
            destino === 'web' ? `${urlWeb}/q/${l.codigo_qr}` : numero ? linkWhatsApp(numero, l.codigo_qr, 'Olá! Preciso de ajuda.') : null,
        })),
      };
    });
  }

  /** Para onde o QR leva: WhatsApp da unidade ou chat do quarto no navegador. Muda o QR impresso. */
  @Put('destino')
  destino(
    @SessaoAtual() s: Sessao,
    @Body(new Zod(z.object({ unidadeId: z.uuid(), destino: z.enum(['whatsapp', 'web']) }))) b: { unidadeId: string; destino: 'whatsapp' | 'web' },
  ) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const adminId = await exigirAdmin(c, s);
      const r = await c.tx.client.query('UPDATE unidade SET qr_destino = $2 WHERE id = $1', [b.unidadeId, b.destino]);
      if (!r.rowCount) throw new NotFoundException();
      await this.nucleo.evento(c, { tipo: 'qr_destino', atorTipo: 'pessoa', atorId: adminId, dados: b });
      return { ok: true };
    });
  }

  /** Cadastro em lote: "101-120, 201-220, Suíte Master". Os que já existem são ignorados. */
  @Post()
  @HttpCode(201)
  criar(
    @SessaoAtual() s: Sessao,
    @Body(new Zod(z.object({ unidadeId: z.uuid(), identificadores: z.string().min(1).max(5000), tipo: z.enum(['quarto', 'leito', 'sala']).default('quarto') })))
    b: { unidadeId: string; identificadores: string; tipo: 'quarto' | 'leito' | 'sala' },
  ) {
    const lista = expandirIdentificadores(b.identificadores);
    if (lista.length > 2000) throw new BadRequestException('no máximo 2000 por vez');
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      let criados = 0;
      for (const id of lista) {
        const r = await c.tx.client.query(
          `INSERT INTO local (org_id, unidade_id, tipo, identificador, codigo_qr) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (unidade_id, identificador) DO NOTHING`,
          [s.orgId, b.unidadeId, b.tipo, id, gerarCodigoLocal(aleatorio)],
        );
        criados += r.rowCount ?? 0;
      }
      return { criados, existentes: lista.length - criados };
    });
  }

  @Put(':id')
  atualizar(
    @SessaoAtual() s: Sessao,
    @Param('id', Uuid) id: string,
    @Body(new Zod(z.object({ identificador: z.string().trim().min(1).max(40), ativo: z.boolean() }))) b: { identificador: string; ativo: boolean },
  ) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      try {
        await c.tx.client.query('SAVEPOINT quarto');
        const r = await c.tx.client.query('UPDATE local SET identificador = $2, ativo = $3 WHERE id = $1', [id, b.identificador, b.ativo]);
        if (!r.rowCount) throw new NotFoundException();
      } catch (e) {
        await c.tx.client.query('ROLLBACK TO SAVEPOINT quarto');
        if ((e as { code?: string }).code === '23505') throw new BadRequestException('já existe um quarto com este número');
        throw e;
      }
      return { ok: true };
    });
  }

  /** QR vazou (foto em rede social, hóspede antigo)? Um código novo invalida o anterior. */
  @Post(':id/novo-codigo')
  @HttpCode(200)
  novoCodigo(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const adminId = await exigirAdmin(c, s);
      const r = await c.tx.client.query('UPDATE local SET codigo_qr = $2 WHERE id = $1', [id, gerarCodigoLocal(aleatorio)]);
      if (!r.rowCount) throw new NotFoundException();
      // Quem abriu o chat com o QR antigo perde o acesso; o hóspede lê o QR novo.
      await c.tx.client.query('UPDATE chat_sessao SET expira_em = now() WHERE local_id = $1 AND expira_em > now()', [id]);
      await this.nucleo.evento(c, { tipo: 'qr_regenerado', atorTipo: 'pessoa', atorId: adminId, dados: { localId: id } });
      return { ok: true };
    });
  }
}
