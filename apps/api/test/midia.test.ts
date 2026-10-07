/**
 * Foto e áudio em qualquer conversa: a equipe manda para o hóspede, em nota interna e em
 * mensagem direta. Áudio sempre ganha transcrição, e é ela que vai traduzida para o hóspede.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

// 1×1 px PNG e um WAV curto (o conteúdo não importa: a transcrição é fingida).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const WAV = Buffer.concat([Buffer.from('RIFF\x24\x08\x00\x00WAVEfmt ', 'latin1'), Buffer.alloc(2048)]).toString('base64');

describe.skipIf(!temBanco)('mídia nas conversas', () => {
  let A: Ambiente;
  let tokMarcos: string;
  let tokMilton: string;
  let tokRita: string;
  let solicitacaoId: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    const { h, req, login } = A;
    tokMarcos = await login(h.pessoas.marcos.email);
    tokMilton = await login(h.pessoas.milton.email);
    tokRita = await login(h.pessoas.rita.email);
    await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tokMarcos);

    // Um pedido da manutenção, aceito pelo Marcos (o único no turno).
    const tel = '5521977770001';
    await A.hospede(tel, 'A lâmpada do banheiro queimou');
    const oferta = await A.esperar(async () => {
      const s = await A.solicitacaoDe(tel);
      if (!s) return null;
      return (await A.consulta(`SELECT id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0];
    });
    expect((await req('POST', `/ofertas/${oferta.id}/aceitar`, undefined, tokMarcos)).status).toBe(200);
    solicitacaoId = (await A.solicitacaoDe(tel)).id;
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const mensagem = (id: string) => A.consulta(`SELECT * FROM mensagem WHERE id = $1`, [id]).then((r) => r[0]);

  it('foto com legenda vai ao hóspede e a equipe vê o arquivo', async () => {
    const r = await A.req('POST', `/solicitacoes/${solicitacaoId}/midia`, { tipo: 'imagem', mime: 'image/png', base64: PNG, legenda: 'É esta a lâmpada?' }, tokMarcos);
    expect(r.status).toBe(201);
    const m = await A.esperar(async () => {
      const x = await mensagem(r.corpo.mensagemId);
      return x.status_envio === 'enviada' ? x : null;
    });
    expect(m).toMatchObject({ tipo: 'imagem', texto: 'É esta a lâmpada?', midia_mime: 'image/png', autor_tipo: 'pessoa' });

    const arq = await fetch(`${A.base}/midia/${m.id}`, { headers: { authorization: `Bearer ${tokMarcos}` } });
    expect(arq.status).toBe(200);
    expect(arq.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await arq.arrayBuffer()).equals(Buffer.from(PNG, 'base64'))).toBe(true);

    // Quem respondeu passou a esperar o hóspede.
    expect((await A.solicitacaoDe('5521977770001')).estado).toBe('aguardando_solicitante');
  });

  it('áudio ganha transcrição antes de sair; formato que o WhatsApp não toca vai como texto', async () => {
    A.fingirTranscricao('Já estou subindo com a lâmpada nova.');
    const r = await A.req('POST', `/solicitacoes/${solicitacaoId}/midia`, { tipo: 'audio', mime: 'audio/wav', base64: WAV }, tokMarcos);
    expect(r.status).toBe(201);
    await A.esperar(async () => (await mensagem(r.corpo.mensagemId)).status_envio === 'enviada');

    const det = await A.req('GET', `/solicitacoes/${solicitacaoId}`, undefined, tokMarcos);
    const v = det.corpo.mensagens.find((x: { id: string }) => x.id === r.corpo.mensagemId);
    expect(v).toMatchObject({ tipo: 'audio', transcricao: 'Já estou subindo com a lâmpada nova.', midiaUrl: `/midia/${r.corpo.mensagemId}` });
  });

  it('nota interna em áudio não vai ao hóspede, mas é transcrita', async () => {
    A.fingirTranscricao('Vou precisar da escada grande.');
    const r = await A.req('POST', `/solicitacoes/${solicitacaoId}/midia`, { tipo: 'audio', mime: 'audio/ogg', base64: WAV, visibilidade: 'interna' }, tokMarcos);
    expect(r.status).toBe(201);
    const t = await A.esperar(async () =>
      (await A.consulta(`SELECT texto FROM mensagem_derivado WHERE mensagem_id = $1 AND tipo = 'transcricao'`, [r.corpo.mensagemId]))[0],
    );
    expect(t.texto).toBe('Vou precisar da escada grande.');
    expect((await mensagem(r.corpo.mensagemId)).status_envio).toBe('nao_enviar');
  });

  it('recusa arquivo do tipo errado, formato estranho e quem não atende', async () => {
    const url = `/solicitacoes/${solicitacaoId}/midia`;
    expect((await A.req('POST', url, { tipo: 'imagem', mime: 'audio/wav', base64: WAV }, tokMarcos)).status).toBe(400);
    expect((await A.req('POST', url, { tipo: 'imagem', mime: 'image/gif', base64: PNG }, tokMarcos)).status).toBe(400);
    expect((await A.req('POST', url, { tipo: 'imagem', mime: 'image/png', base64: PNG }, tokRita)).status).toBe(403);
  });

  it('áudio do hóspede pelo WhatsApp é guardado, transcrito e roteado', async () => {
    A.fingirTranscricao('O chuveiro está sem água quente');
    const de = '5521977770009';
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '+5521900000000', phone_number_id: A.h.phoneNumberId },
                contacts: [{ wa_id: de, profile: { name: 'Hóspede' } }],
                messages: [
                  {
                    from: de,
                    id: `wamid.${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'audio',
                    // Meta em dry-run: o "id" da mídia é a própria data URL.
                    audio: { id: `data:audio/wav;base64,${WAV}`, mime_type: 'audio/wav', voice: true },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const { createHmac } = await import('node:crypto');
    const r = await fetch(`${A.base}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', process.env.META_APP_SECRET ?? 'segredo-dev-do-app').update(payload).digest('hex')}` },
      body: payload,
    });
    expect(r.status).toBe(200);
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(de);
      return x?.setor ? x : null;
    }, 20_000);
    expect(s.setor).toBe('manutencao');
    const [m] = await A.consulta(
      `SELECT m.midia_chave, (SELECT texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'transcricao') AS transcricao
         FROM mensagem m WHERE m.solicitacao_id = $1 AND m.autor_tipo = 'solicitante'`,
      [s.id],
    );
    expect(m.midia_chave).toBeTruthy();
    expect(m.transcricao).toBe('O chuveiro está sem água quente');
  }, 30_000);

  it('mensagem direta com áudio: transcrição e arquivo só para quem participa', async () => {
    A.fingirTranscricao('Milton, pode me cobrir no 412?');
    const r = await A.req('POST', '/diretas/midia', { paraPessoaId: A.h.pessoas.milton.id, tipo: 'audio', mime: 'audio/wav', base64: WAV }, tokMarcos);
    expect(r.status).toBe(201);
    const msg = await A.esperar(async () => {
      const l = await A.req('GET', `/diretas/${r.corpo.conversaId}`, undefined, tokMilton);
      const m = l.corpo.find((x: { id: string }) => x.id === r.corpo.mensagemId);
      return m?.transcricao ? m : null;
    });
    expect(msg).toMatchObject({ tipo: 'audio', texto: null, transcricao: 'Milton, pode me cobrir no 412?', midia_url: `/diretas/midia/${r.corpo.mensagemId}` });
    const ok = await fetch(`${A.base}${msg.midia_url}`, { headers: { authorization: `Bearer ${tokMilton}` } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('audio/wav');
    const fora = await fetch(`${A.base}${msg.midia_url}`, { headers: { authorization: `Bearer ${tokRita}` } });
    expect(fora.status).toBe(404);

    const foto = await A.req('POST', '/diretas/midia', { paraPessoaId: A.h.pessoas.milton.id, tipo: 'imagem', mime: 'image/png', base64: PNG }, tokMarcos);
    expect(foto.status).toBe(201);
    const lista = await A.req('GET', '/diretas', undefined, tokMilton);
    expect(lista.corpo.find((c: { id: string }) => c.id === r.corpo.conversaId).ultima.tipo).toBe('imagem');
  }, 30_000);
});
