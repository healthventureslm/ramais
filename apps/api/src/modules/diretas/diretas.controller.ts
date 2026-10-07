import { randomUUID } from 'node:crypto';
import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { MensagemDiretaReq, MidiaDiretaReq, sala } from '@ramais/contracts';
import type { Response } from 'express';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { pessoaDa, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { lerArquivo } from '../../infra/midia.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';

type Conteudo = { tipo: 'texto'; texto: string } | { tipo: 'imagem' | 'audio'; id: string; chave: string; mime: string; legenda: string | null };

/**
 * Mensagem direta, como ramal: para uma pessoa exata, com status. Não é solicitação.
 * Urgente pede "ciente". Leva texto, foto ou áudio (o áudio ganha transcrição).
 */
@Controller('diretas')
export class DiretasController {
  constructor(
    private readonly nucleo: Nucleo,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
  ) {}

  @Post()
  @HttpCode(201)
  enviar(@SessaoAtual() s: Sessao, @Body(new Zod(MensagemDiretaReq)) b: MensagemDiretaReq) {
    return this.nucleo.executar(s.orgId, (c) => this.gravar(c, s, b, { tipo: 'texto', texto: b.texto }));
  }

  @Post('midia')
  @HttpCode(201)
  enviarMidia(@SessaoAtual() s: Sessao, @Body(new Zod(MidiaDiretaReq)) b: MidiaDiretaReq) {
    const arquivo = lerArquivo(b);
    const id = randomUUID();
    const chave = `org/${s.orgId}/direta/${id}.${arquivo.ext}`;
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await this.gravar(c, s, b, { tipo: b.tipo, id, chave, mime: arquivo.mime, legenda: b.legenda?.trim() || null });
      // Só guarda o arquivo depois de saber que o destinatário existe.
      await this.armazenamento.salvar(chave, arquivo.dados, arquivo.mime);
      return r;
    });
  }

  private async gravar(c: Ctx, s: Sessao, b: { paraPessoaId: string; urgente: boolean; solicitacaoId?: string }, m: Conteudo) {
    const eu = pessoaDa(s);
    if (b.paraPessoaId === eu) throw new BadRequestException('não dá para mandar para si mesmo');
    // A conversa fica na unidade de quem recebe; gerência e administração (sem setor) usam a de quem envia.
    const destino = await c.tx.client.query<{ nome: string; em_turno: boolean; unidade_id: string | null }>(
      `SELECT p.nome,
              EXISTS (SELECT 1 FROM presenca pr WHERE pr.pessoa_id = p.id AND pr.fim IS NULL) AS em_turno,
              coalesce(
                (SELECT st.unidade_id FROM lotacao l JOIN setor st ON st.id = l.setor_id WHERE l.pessoa_id = p.id LIMIT 1),
                (SELECT st.unidade_id FROM lotacao l JOIN setor st ON st.id = l.setor_id WHERE l.pessoa_id = $2 LIMIT 1),
                (SELECT u.id FROM unidade u ORDER BY u.criado_em LIMIT 1)
              ) AS unidade_id
         FROM pessoa p WHERE p.id = $1 AND p.ativo`,
      [b.paraPessoaId, eu],
    );
    const d = destino.rows[0];
    if (!d?.unidade_id) throw new NotFoundException('pessoa não encontrada');
    const participantes = [eu, b.paraPessoaId].sort();
    let conversa = await c.tx.client.query<{ id: string }>(
      `SELECT id FROM conversa_interna WHERE participantes = $1::uuid[] AND solicitacao_id IS NOT DISTINCT FROM $2`,
      [participantes, b.solicitacaoId ?? null],
    );
    if (!conversa.rows[0]) {
      conversa = await c.tx.client.query(
        'INSERT INTO conversa_interna (org_id, unidade_id, participantes, solicitacao_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [s.orgId, d.unidade_id, participantes, b.solicitacaoId ?? null],
      );
    }
    const conversaId = conversa.rows[0]!.id;
    const ins = await c.tx.client.query<{ id: string }>(
      m.tipo === 'texto'
        ? 'INSERT INTO mensagem_interna (org_id, conversa_id, autor_id, urgente, texto) VALUES ($1, $2, $3, $4, $5) RETURNING id'
        : `INSERT INTO mensagem_interna (org_id, conversa_id, autor_id, urgente, id, tipo, midia_chave, midia_mime, texto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      m.tipo === 'texto'
        ? [s.orgId, conversaId, eu, b.urgente, m.texto]
        : [s.orgId, conversaId, eu, b.urgente, m.id, m.tipo, m.chave, m.mime, m.legenda],
    );
    const mensagemId = ins.rows[0]!.id;
    if (m.tipo === 'audio') await this.nucleo.enfileirar(c, 'midia-derivar', { orgId: s.orgId, mensagemId, origem: 'direta' });
    await this.nucleo.enfileirar(c, 'notificacao', {
      orgId: s.orgId,
      pessoaId: b.paraPessoaId,
      titulo: b.urgente ? 'URGENTE · mensagem direta' : 'Mensagem direta',
      corpo: m.tipo === 'texto' ? m.texto.slice(0, 140) : m.tipo === 'imagem' ? 'Foto' : 'Mensagem de voz',
      dados: { tipo: 'direta', conversaId, urgente: String(b.urgente) },
      alta: b.urgente,
    });
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(sala.pessoa(b.paraPessoaId), 'direta:nova', { conversaId, mensagemId, de: eu, urgente: b.urgente }),
    );
    // Aviso se a pessoa está fora do turno.
    return { conversaId, mensagemId, foraDoTurno: !d.em_turno, destinatario: d.nome };
  }

  @Get()
  listar(@SessaoAtual() s: Sessao) {
    const eu = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query(
        `SELECT c.id, c.solicitacao_id,
                (SELECT json_agg(json_build_object('id', p.id, 'nome', p.nome)) FROM pessoa p WHERE p.id = ANY(c.participantes) AND p.id <> $1) AS outros,
                (SELECT row_to_json(x) FROM (SELECT m.texto, m.tipo, m.criado_em, m.autor_id, m.urgente, m.ciente_em FROM mensagem_interna m
                   WHERE m.conversa_id = c.id ORDER BY m.criado_em DESC LIMIT 1) x) AS ultima,
                (SELECT count(*)::int FROM mensagem_interna m WHERE m.conversa_id = c.id AND m.autor_id <> $1 AND m.urgente AND m.ciente_em IS NULL) AS urgentes_pendentes
           FROM conversa_interna c WHERE $1 = ANY(c.participantes)
          ORDER BY (SELECT max(m.criado_em) FROM mensagem_interna m WHERE m.conversa_id = c.id) DESC NULLS LAST LIMIT 50`,
        [eu],
      );
      return r.rows;
    });
  }

  @Get(':id')
  mensagens(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    const eu = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const conv = await c.tx.client.query('SELECT 1 FROM conversa_interna WHERE id = $1 AND $2 = ANY(participantes)', [id, eu]);
      if (!conv.rowCount) throw new NotFoundException();
      const r = await c.tx.client.query(
        `SELECT m.id, m.texto, m.tipo, m.transcricao, m.urgente, m.ciente_em, m.criado_em, m.autor_id, p.nome AS autor_nome,
                CASE WHEN m.midia_chave IS NOT NULL THEN '/diretas/midia/' || m.id END AS midia_url
           FROM mensagem_interna m JOIN pessoa p ON p.id = m.autor_id WHERE m.conversa_id = $1 ORDER BY m.criado_em`,
        [id],
      );
      return r.rows;
    });
  }

  /** Arquivo de uma mensagem direta: só para quem participa da conversa. */
  @Get('midia/:mensagemId')
  async midia(@SessaoAtual() s: Sessao, @Param('mensagemId', Uuid) mensagemId: string, @Res() res: Response) {
    const eu = pessoaDa(s);
    const m = await this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query<{ midia_chave: string; midia_mime: string | null }>(
        `SELECT m.midia_chave, m.midia_mime FROM mensagem_interna m JOIN conversa_interna c ON c.id = m.conversa_id
          WHERE m.id = $1 AND $2 = ANY(c.participantes) AND m.midia_chave IS NOT NULL`,
        [mensagemId, eu],
      );
      return r.rows[0];
    });
    if (!m) throw new NotFoundException();
    const dados = await this.armazenamento.ler(m.midia_chave);
    res.setHeader('content-type', m.midia_mime ?? 'application/octet-stream');
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(dados);
  }

  @Post('mensagens/:id/ciente')
  @HttpCode(200)
  ciente(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    const eu = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query<{ autor_id: string; conversa_id: string }>(
        `UPDATE mensagem_interna m SET ciente_em = now()
           FROM conversa_interna c
          WHERE m.id = $1 AND c.id = m.conversa_id AND $2 = ANY(c.participantes) AND m.autor_id <> $2 AND m.ciente_em IS NULL
          RETURNING m.autor_id, m.conversa_id`,
        [id, eu],
      );
      const l = r.rows[0];
      if (l) {
        c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(l.autor_id), 'aviso', { texto: 'Sua mensagem urgente foi lida (ciente).' }));
      }
      return { ok: Boolean(l) };
    });
  }
}
