import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { CatalogoItemReq } from '@ramais/contracts';
import { z } from 'zod';
import { SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { exigirAdmin } from './guarda.js';

const COLUNAS = `ci.id, ci.setor_id, st.nome AS setor_nome, ci.tipo, ci.categoria, ci.nome, ci.descricao, ci.nomes, ci.descricoes,
  ci.preco_centavos, ci.por_pessoa, ci.max_quantidade, ci.duracao_min, ci.capacidade, ci.vagas_por, ci.horarios,
  ci.antecedencia_min, ci.dias_a_frente, ci.ativo, ci.ordem,
  (SELECT count(*)::int FROM pedido p WHERE p.item_id = ci.id AND p.criado_em > now() - interval '30 days') AS pedidos_30d`;

const valores = (b: CatalogoItemReq) => [
  b.setorId,
  b.tipo,
  b.categoria,
  b.nome,
  b.descricao,
  JSON.stringify(b.nomes),
  JSON.stringify(b.descricoes),
  b.precoCentavos,
  b.porPessoa,
  b.maxQuantidade,
  b.tipo === 'agendamento' ? b.duracaoMin : null,
  b.tipo === 'agendamento' ? b.capacidade : null,
  b.vagasPor,
  JSON.stringify(b.tipo === 'agendamento' ? b.horarios : []),
  b.antecedenciaMin,
  b.diasAFrente,
  b.ativo,
  b.ordem,
];

/**
 * Catálogo do hotel: o que o hóspede pode pedir ou reservar pelo chat do quarto. Só admin edita;
 * item fora de uso é desativado (os pedidos antigos continuam apontando para ele).
 */
@Controller('admin/catalogo')
export class CatalogoController {
  constructor(private readonly nucleo: Nucleo) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `SELECT ${COLUNAS} FROM catalogo_item ci JOIN setor st ON st.id = ci.setor_id WHERE ci.unidade_id = $1
          ORDER BY ci.ativo DESC, ci.categoria, ci.ordem, ci.nome`,
        [unidadeId],
      );
      return r.rows.map((l) => ({
        id: l.id,
        setorId: l.setor_id,
        setorNome: l.setor_nome,
        tipo: l.tipo,
        categoria: l.categoria,
        nome: l.nome,
        descricao: l.descricao,
        nomes: l.nomes,
        descricoes: l.descricoes,
        precoCentavos: l.preco_centavos,
        porPessoa: l.por_pessoa,
        maxQuantidade: l.max_quantidade,
        duracaoMin: l.duracao_min,
        capacidade: l.capacidade,
        vagasPor: l.vagas_por,
        horarios: l.horarios,
        antecedenciaMin: l.antecedencia_min,
        diasAFrente: l.dias_a_frente,
        ativo: l.ativo,
        ordem: l.ordem,
        pedidos30d: l.pedidos_30d,
      }));
    });
  }

  private async conferirSetor(c: Ctx, unidadeId: string, setorId: string) {
    const r = await c.tx.client.query('SELECT 1 FROM setor WHERE id = $1 AND unidade_id = $2', [setorId, unidadeId]);
    if (!r.rowCount) throw new BadRequestException('o setor precisa ser desta unidade');
  }

  @Post()
  @HttpCode(201)
  criar(@SessaoAtual() s: Sessao, @Body(new Zod(CatalogoItemReq.and(z.object({ unidadeId: z.uuid() })))) b: CatalogoItemReq & { unidadeId: string }) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      await this.conferirSetor(c, b.unidadeId, b.setorId);
      const r = await c.tx.client.query<{ id: string }>(
        `INSERT INTO catalogo_item (org_id, unidade_id, setor_id, tipo, categoria, nome, descricao, nomes, descricoes, preco_centavos,
                                    por_pessoa, max_quantidade, duracao_min, capacidade, vagas_por, horarios, antecedencia_min,
                                    dias_a_frente, ativo, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`,
        [s.orgId, b.unidadeId, ...valores(b)],
      );
      return { id: r.rows[0]!.id };
    });
  }

  @Put(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(CatalogoItemReq)) b: CatalogoItemReq) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const atual = await c.tx.client.query<{ unidade_id: string }>('SELECT unidade_id FROM catalogo_item WHERE id = $1', [id]);
      if (!atual.rows[0]) throw new NotFoundException();
      await this.conferirSetor(c, atual.rows[0].unidade_id, b.setorId);
      await c.tx.client.query(
        `UPDATE catalogo_item SET setor_id = $2, tipo = $3, categoria = $4, nome = $5, descricao = $6, nomes = $7, descricoes = $8,
                preco_centavos = $9, por_pessoa = $10, max_quantidade = $11, duracao_min = $12, capacidade = $13, vagas_por = $14,
                horarios = $15, antecedencia_min = $16, dias_a_frente = $17, ativo = $18, ordem = $19
          WHERE id = $1`,
        [id, ...valores(b)],
      );
      return { ok: true };
    });
  }
}
