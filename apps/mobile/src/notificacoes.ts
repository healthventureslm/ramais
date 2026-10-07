import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

type RemoteMessage = Parameters<Parameters<typeof onMessage>[1]>[0];

/**
 * Notificação confiável:
 *  - Android: o servidor manda FCM de alta prioridade só com dados; o app monta a
 *    notificação no canal "Atribuições" (importância alta, som em loop até abrir).
 *    Não usamos intenção de tela cheia: o Android 14 restringe a apps de chamada/alarme.
 *  - iOS: APNs com nível "sensível ao tempo" (não exige aprovação, ao contrário dos alertas críticos).
 * Nenhuma notificação é garantida: quem garante é o escalonamento no servidor.
 */
export const CANAL = 'atribuicoes';

export async function prepararCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CANAL,
    name: 'Atribuições',
    description: 'Pedidos novos, escalonamentos e mensagens urgentes',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: false,
  });
}

export async function pedirPermissao(): Promise<boolean> {
  const n = await notifee.requestPermission({ alert: true, sound: true, badge: true });
  await requestPermission(getMessaging()).catch(() => undefined);
  return n.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function tokenPush(): Promise<string | null> {
  try {
    return await getToken(getMessaging());
  } catch {
    // Sem google-services.json / GoogleService-Info.plist o build não tem FCM: segue sem push.
    return null;
  }
}

export function aoTrocarToken(fn: (t: string) => void): () => void {
  try {
    return onTokenRefresh(getMessaging(), fn);
  } catch {
    return () => undefined;
  }
}

type Dados = Record<string, string>;

export async function mostrar(dados: Dados): Promise<void> {
  const alta =
    dados.tipo === 'oferta' ||
    dados.tipo === 'emergencia' ||
    dados.tipo === 'escalonamento' ||
    dados.tipo === 'lembrete' ||
    (dados.tipo === 'direta' && dados.urgente === 'true');
  await prepararCanal();
  await notifee.displayNotification({
    id: dados.ofertaId ?? dados.solicitacaoId ?? dados.conversaId,
    title: dados.titulo ?? 'Ramais',
    body: dados.corpo ?? '',
    data: dados,
    android: {
      channelId: CANAL,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.MESSAGE,
      pressAction: { id: 'default', launchActivity: 'default' },
      // Som insistente até a pessoa abrir: oferta tem prazo para aceitar.
      loopSound: alta,
      autoCancel: true,
      timeoutAfter: dados.tipo === 'oferta' ? 90_000 : undefined,
    },
    ios: {
      sound: 'default',
      interruptionLevel: alta ? 'timeSensitive' : 'active',
    },
  });
}

function dadosDe(m: RemoteMessage): Dados {
  return Object.fromEntries(Object.entries(m.data ?? {}).map(([k, v]) => [k, String(v)]));
}

/** App fechado ou em segundo plano. */
export function registrarSegundoPlano(): void {
  try {
    setBackgroundMessageHandler(getMessaging(), async (m) => {
      // No iOS o sistema já mostra o alerta do APNs.
      if (Platform.OS === 'android') await mostrar(dadosDe(m));
    });
  } catch {
    // build sem Firebase
  }
}

/** App aberto: o tempo real atualiza a tela; a notificação local garante o som. */
export function ouvirPrimeiroPlano(fn: (dados: Dados) => void): () => void {
  try {
    return onMessage(getMessaging(), async (m) => {
      const d = dadosDe(m);
      fn(d);
      if (d.tipo !== 'mensagem') await mostrar(d);
    });
  } catch {
    return () => undefined;
  }
}

export async function cancelar(id: string): Promise<void> {
  await notifee.cancelNotification(id).catch(() => undefined);
}

export async function testar(): Promise<void> {
  await mostrar({ tipo: 'oferta', titulo: 'Teste de notificação', corpo: 'Se você ouviu o som, está tudo certo.', ofertaId: 'teste' });
}

export async function economiaDeBateriaAtiva(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return notifee.isBatteryOptimizationEnabled();
}

export async function abrirAjustesBateria(): Promise<void> {
  if (Platform.OS === 'android') await notifee.openBatteryOptimizationSettings();
}
