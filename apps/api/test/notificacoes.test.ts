/**
 * Notificação no navegador (Web Push): a equipe recebe direta, nota interna e pedido; o hóspede
 * do chat do quarto recebe a resposta da equipe. O envio de verdade é trocado por um gravador;
 * a criptografia do Web Push é provada à parte, contra um serviço de push falso local.
 */
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import http, { createServer, type IncomingMessage } from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

interface Enviado {
  endpoint: string;
  aviso: { titulo: string; corpo: string; url: string; etiqueta?: string; insistente?: boolean };
}

const inscricao = (nome: string) => ({
  endpoint: `https://push.exemplo.dev/${nome}/${randomUUID()}`,
  keys: { p256dh: randomBytes(65).toString('base64url'), auth: randomBytes(16).toString('base64url') },
});

describe.skipIf(!temBanco)('notificação no navegador', () => {
  let A: Ambiente;
  let enviados: Enviado[];
  let expiradas: Set<string>;
  let tokMarcos: string;
  let tokRita: string;
  let tokMauro: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    // @ts-ignore: módulo compilado
    const { PushWeb } = await import('../dist/infra/push-web.js');
    const push = A.worker.get(PushWeb);
    enviados = [];
    expiradas = new Set();
    Object.defineProperty(push, 'disponivel', { value: true });
    push.enviar = async (i: { endpoint: string }, aviso: Enviado['aviso']) => {
      enviados.push({ endpoint: i.endpoint, aviso });
      return expiradas.has(i.endpoint) ? 'expirada' : 'ok';
    };
    tokMarcos = await A.login(A.h.pessoas.marcos.email);
    tokRita = await A.login(A.h.pessoas.rita.email);
    tokMauro = await A.login(A.h.pessoas.mauro.email);
    await A.req('POST', '/turno/entrar-web', { unidadeId: A.h.unidadeId }, tokMarcos);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const para = (endpoint: string) => enviados.filter((e) => e.endpoint === endpoint);

  it('mensagem direta chega no navegador de quem recebe, e o toque abre as mensagens', async () => {
    const nav = inscricao('marcos');
    expect((await A.req('POST', '/notificacoes/inscricao', nav, tokMarcos)).status).toBe(200);
    await A.req('POST', '/diretas', { paraPessoaId: A.h.pessoas.marcos.id, texto: 'Pode passar no 302?', urgente: false }, tokRita);
    const [e] = await A.esperar(async () => (para(nav.endpoint).length ? para(nav.endpoint) : null));
    expect(e!.aviso).toMatchObject({ titulo: 'Mensagem direta', corpo: 'Pode passar no 302?', url: '/?tela=diretas' });
  });

  it('o navegador passa a ser de quem entrou por último nele', async () => {
    const nav = inscricao('compartilhado');
    await A.req('POST', '/notificacoes/inscricao', nav, tokMarcos);
    await A.req('POST', '/notificacoes/inscricao', nav, tokRita);
    const donos = await A.consulta('SELECT pessoa_id FROM push_web WHERE endpoint = $1', [nav.endpoint]);
    expect(donos).toEqual([{ pessoa_id: A.h.pessoas.rita.id }]);
    // Sair da conta tira a inscrição.
    expect((await A.req('POST', '/notificacoes/inscricao/remover', { endpoint: nav.endpoint }, tokRita)).status).toBe(200);
    expect(await A.consulta('SELECT 1 FROM push_web WHERE endpoint = $1', [nav.endpoint])).toEqual([]);
  });

  it('o hóspede recebe a resposta da equipe; a nota interna do supervisor chega a quem atende', async () => {
    const sessao = await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr, idioma: 'pt-BR' });
    const nav = inscricao('hospede');
    const r = await fetch(`${A.base}/chat/notificacoes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat': sessao.corpo.token },
      body: JSON.stringify(nav),
    });
    expect(r.status).toBe(200);

    await fetch(`${A.base}/chat/mensagens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat': sessao.corpo.token },
      body: JSON.stringify({ id: randomUUID(), texto: 'O ar-condicionado está pingando' }),
    });
    const oferta = await A.esperar(async () => {
      const o = await A.consulta(`SELECT o.id, o.solicitacao_id FROM oferta o WHERE o.pessoa_id = $1 AND o.resultado = 'pendente'`, [A.h.pessoas.marcos.id]);
      return o[0];
    });
    expect((await A.req('POST', `/ofertas/${oferta.id}/aceitar`, undefined, tokMarcos)).status).toBe(200);
    expect(
      (await A.req('POST', `/solicitacoes/${oferta.solicitacao_id}/mensagens`, { texto: 'Já estou subindo.', visibilidade: 'externa' }, tokMarcos)).status,
    ).toBe(201);
    const resposta = await A.esperar(async () => para(nav.endpoint).find((e) => e.aviso.corpo === 'Já estou subindo.'));
    expect(resposta.aviso).toMatchObject({ titulo: 'Hotel Teste', url: `/q/${A.h.codigoQr}` });

    // Mensagem interna também avisa: a nota do supervisor chega ao Marcos, que está com o atendimento.
    const navMarcos = inscricao('marcos-nota');
    await A.req('POST', '/notificacoes/inscricao', navMarcos, tokMarcos);
    expect(
      (await A.req('POST', `/solicitacoes/${oferta.solicitacao_id}/mensagens`, { texto: 'Leva a escada grande', visibilidade: 'interna' }, tokMauro)).status,
    ).toBe(201);
    const nota = await A.esperar(async () => para(navMarcos.endpoint).find((e) => e.aviso.titulo === 'Nota interna de Mauro'));
    expect(nota.aviso.url).toBe(`/?abrir=${oferta.solicitacao_id}`);
    expect(nota.aviso.corpo).toContain('Leva a escada grande');
  }, 60_000);

  it('inscrição que o navegador cancelou é apagada no primeiro envio', async () => {
    const nav = inscricao('cancelada');
    await A.req('POST', '/notificacoes/inscricao', nav, tokMarcos);
    expiradas.add(nav.endpoint);
    await A.req('POST', '/diretas', { paraPessoaId: A.h.pessoas.marcos.id, texto: 'teste', urgente: false }, tokRita);
    await A.esperar(async () => ((await A.consulta('SELECT 1 FROM push_web WHERE endpoint = $1', [nav.endpoint])).length === 0 ? true : null));
  });
});

describe('Web Push de verdade (serviço de push falso)', () => {
  it('cifra para a chave do navegador, assina com VAPID e entende 201 e 410', async () => {
    const webpush = (await import('web-push')).default;
    const vapid = webpush.generateVAPIDKeys();
    // @ts-ignore: módulo compilado
    const { PushWeb } = await import('../dist/infra/push-web.js');
    const push = new PushWeb({ VAPID_PUBLICA: vapid.publicKey, VAPID_PRIVADA: vapid.privateKey, VAPID_CONTATO: 'mailto:teste@ramais.dev' });

    const recebidos: { cabecalhos: IncomingMessage['headers']; corpo: Buffer }[] = [];
    let status = 201;
    const servidor = createServer((req, res) => {
      const partes: Buffer[] = [];
      req.on('data', (p: Buffer) => partes.push(p));
      req.on('end', () => {
        recebidos.push({ cabecalhos: req.headers, corpo: Buffer.concat(partes) });
        res.writeHead(status).end();
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    const porta = (servidor.address() as AddressInfo).port;
    const navegador = createECDH('prime256v1');
    navegador.generateKeys();
    const alvo = {
      // A biblioteca só fala HTTPS; no teste, a chamada vai em HTTP para o serviço falso local.
      endpoint: `https://127.0.0.1:${porta}/push/abc`,
      p256dh: navegador.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    };
    const requestOriginal = https.request;
    https.request = http.request as unknown as typeof https.request;
    try {
      const aviso = { titulo: 'Hotel', corpo: 'Já estou subindo.', url: '/q/abc' };
      expect(await push.enviar(alvo, aviso)).toBe('ok');
      const [r] = recebidos;
      expect(r!.cabecalhos['content-encoding']).toBe('aes128gcm');
      expect(String(r!.cabecalhos.authorization)).toMatch(new RegExp(`^vapid t=.+, k=${vapid.publicKey}$`));
      expect(r!.cabecalhos.ttl).toBe('600');
      // Cifrado: o texto não passa em claro.
      expect(r!.corpo.includes(Buffer.from('subindo'))).toBe(false);
      status = 410;
      expect(await push.enviar(alvo, aviso)).toBe('expirada');
    } finally {
      https.request = requestOriginal;
      servidor.close();
    }
    // Sem chaves, desligado.
    expect(new PushWeb({ VAPID_PUBLICA: null, VAPID_PRIVADA: null, VAPID_CONTATO: 'mailto:x@y.z' }).disponivel).toBe(false);
  });
});
