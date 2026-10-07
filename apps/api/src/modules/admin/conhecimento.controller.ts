import { Body, ConflictException, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import type { ServicosIA } from '@ramais/ai';
import { normalizar } from '@ramais/domain';
import { z } from 'zod';
import { SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { IA } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { exigirAdmin } from './guarda.js';

const Item = z.object({
  pergunta: z.string().trim().min(3).max(300),
  resposta: z.string().trim().min(2).max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  ativo: z.boolean().default(true),
});
type Item = z.infer<typeof Item>;

/** Identificador estável a partir da pergunta ("Qual a senha do Wi-Fi?" → "qual-a-senha-do-wi-fi"). */
function chaveDe(pergunta: string): string {
  return normalizar(pergunta).replace(/\s+/g, '-').slice(0, 60) || 'item';
}

/**
 * Base de conhecimento: o que a IA pode responder sozinha. Em português; a resposta sai
 * traduzida para o idioma do hóspede. Tags ajudam o motor de reserva (sem IA).
 */
@Controller('admin/conhecimento')
export class ConhecimentoController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly unidades: Unidades,
    @Inject(IA) private readonly ia: ServicosIA,
  ) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `SELECT b.id, b.chave, b.pergunta, b.resposta, b.tags, b.ativo,
                (SELECT count(*)::int FROM evento e WHERE e.tipo = 'resposta_automatica' AND e.dados->'fontes' ? b.chave
                    AND e.criado_em > now() - interval '30 days') AS usos
           FROM base_conhecimento b WHERE b.unidade_id = $1 ORDER BY b.ativo DESC, b.pergunta`,
        [unidadeId],
      );
      return r.rows;
    });
  }

  @Post()
  @HttpCode(201)
  criar(@SessaoAtual() s: Sessao, @Body(new Zod(Item.extend({ unidadeId: z.uuid() }))) b: Item & { unidadeId: string }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      let chave = chaveDe(b.pergunta);
      const ja = await c.tx.client.query('SELECT 1 FROM base_conhecimento WHERE unidade_id = $1 AND chave = $2', [b.unidadeId, chave]);
      if (ja.rowCount) chave = `${chave.slice(0, 54)}-${Date.now().toString(36).slice(-5)}`;
      const r = await c.tx.client.query<{ id: string }>(
        'INSERT INTO base_conhecimento (org_id, unidade_id, chave, pergunta, resposta, tags, ativo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [s.orgId, b.unidadeId, chave, b.pergunta, b.resposta, b.tags, b.ativo],
      );
      return { id: r.rows[0]!.id, chave };
    });
  }

  @Put(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(Item)) b: Item) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const r = await c.tx.client.query('UPDATE base_conhecimento SET pergunta = $2, resposta = $3, tags = $4, ativo = $5 WHERE id = $1', [
        id,
        b.pergunta,
        b.resposta,
        b.tags,
        b.ativo,
      ]);
      if (!r.rowCount) throw new NotFoundException();
      return { ok: true };
    });
  }

  /**
   * Testa uma pergunta como se fosse um hóspede: a IA responderia sozinha? Com qual item?
   * Não envia nada para ninguém.
   */
  @Post('testar')
  @HttpCode(200)
  testar(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ unidadeId: z.uuid(), pergunta: z.string().trim().min(2).max(500) }))) b: { unidadeId: string; pergunta: string }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const { cfg } = await this.unidades.versaoAtual(c.tx, b.unidadeId);
      const itens = await c.tx.client.query(
        'SELECT chave AS id, pergunta, resposta, tags FROM base_conhecimento WHERE unidade_id = $1 AND ativo',
        [b.unidadeId],
      );
      if (!itens.rowCount) {
        return { responderia: false, resposta: null, confianca: 0, limite: cfg.limites.respostaAutomatica, fontes: [], motor: null, motivo: 'nenhum item ativo na base' };
      }
      const r = await this.ia.respondedor.responder(b.pergunta, itens.rows).catch((e) => {
        throw new ConflictException(`a IA não respondeu: ${(e as Error).message}`);
      });
      return {
        responderia: r.responde && r.confianca >= cfg.limites.respostaAutomatica,
        resposta: r.resposta,
        confianca: r.confianca,
        limite: cfg.limites.respostaAutomatica,
        fontes: r.fontes,
        motor: r.modelo,
      };
    });
  }
}
