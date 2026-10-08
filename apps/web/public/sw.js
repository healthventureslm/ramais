/*
 * Service worker do Ramais: só notificação no navegador (Web Push). Não guarda nada em cache.
 *
 * O servidor manda { titulo, corpo, url, etiqueta, insistente }. Se a página certa já está na
 * tela (a equipe com o Ramais aberto, o hóspede com o chat aberto), ela mesma mostra pelo tempo
 * real e o aviso do sistema não aparece em dobro. O toque abre ou foca a página e leva à `url`.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Chat do hóspede fica em /q/<código>; o resto é o app da equipe.
const doHospede = (url) => new URL(url, self.location.origin).pathname.startsWith('/q/');

self.addEventListener('push', (e) => {
  let a;
  try {
    a = e.data.json();
  } catch {
    return;
  }
  e.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hospede = doHospede(a.url || '/');
      if (janelas.some((j) => j.visibilityState === 'visible' && doHospede(j.url) === hospede)) return;
      await self.registration.showNotification(a.titulo, {
        body: a.corpo,
        tag: a.etiqueta || undefined,
        renotify: Boolean(a.etiqueta),
        requireInteraction: Boolean(a.insistente),
        data: { url: a.url || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  e.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hospede = doHospede(url.href);
      const aberta = janelas.find((j) => doHospede(j.url) === hospede);
      if (aberta) {
        await aberta.focus();
        // O app da equipe troca de tela sem recarregar (perderia o que estava digitado).
        if (!hospede) aberta.postMessage({ tipo: 'abrir', url: url.pathname + url.search });
        return;
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
