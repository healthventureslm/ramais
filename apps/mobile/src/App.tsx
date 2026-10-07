import type { Sessao } from '@ramais/contracts';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { SchibstedGrotesk_600SemiBold, SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, View } from 'react-native';
import { Api, armazenamento } from './api';
import { useCores } from './estilo';
import { prepararCanal } from './notificacoes';
import { Cadastro } from './telas/Cadastro';
import { Entrar } from './telas/Entrar';
import { TesteNotificacao } from './telas/TesteNotificacao';
import { Turno } from './telas/Turno';

/**
 * Fluxo do celular compartilhado do setor:
 *   cadastro (QR do admin, uma vez) → teste de notificação → entrar com e-mail + PIN (= entrar no turno)
 *   → turno (ofertas, conversas) → sair (encerra presença, limpa tudo, desvincula o push).
 */
type Estado =
  | { tela: 'carregando' }
  | { tela: 'cadastro' }
  | { tela: 'teste'; api: Api }
  | { tela: 'entrar'; api: Api }
  | { tela: 'turno'; api: Api; sessao: Sessao };

export default function App() {
  const c = useCores();
  const [estado, setEstado] = useState<Estado>({ tela: 'carregando' });
  const [fontes] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    IBMPlexMono_500Medium,
  });

  const iniciar = useCallback(async () => {
    await prepararCanal().catch(() => undefined);
    const servidor = await armazenamento.servidor();
    const disp = await armazenamento.dispositivo();
    if (!servidor || !disp) return setEstado({ tela: 'cadastro' });
    const base = new Api(servidor, disp);
    const turno = await armazenamento.turno();
    if (turno) return setEstado({ tela: 'turno', api: base.comToken(turno.token), sessao: turno });
    setEstado({ tela: 'entrar', api: base });
  }, []);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }}>
      <StatusBar style="auto" />
      {(estado.tela === 'carregando' || !fontes) && (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      )}
      {fontes && estado.tela === 'cadastro' && (
        <Cadastro
          aoCadastrar={async (servidor, token) => {
            await armazenamento.salvarServidor(servidor);
            await armazenamento.salvarDispositivo(token);
            setEstado({ tela: 'teste', api: new Api(servidor, token) });
          }}
        />
      )}
      {fontes && estado.tela === 'teste' && <TesteNotificacao aoContinuar={() => setEstado({ tela: 'entrar', api: estado.api })} />}
      {fontes && estado.tela === 'entrar' && (
        <Entrar
          api={estado.api}
          aoEntrar={async (sessao) => {
            await armazenamento.salvarTurno(sessao);
            setEstado({ tela: 'turno', api: estado.api.comToken(sessao.token), sessao });
          }}
          aoTestar={() => setEstado({ tela: 'teste', api: estado.api })}
          aoEsquecer={async () => {
            await armazenamento.esquecerDispositivo();
            setEstado({ tela: 'cadastro' });
          }}
        />
      )}
      {fontes && estado.tela === 'turno' && (
        <Turno
          api={estado.api}
          sessao={estado.sessao}
          aoSair={async () => {
            await estado.api.sair().catch(() => undefined);
            await armazenamento.limparTurno();
            void iniciar();
          }}
          aoExpirar={async () => {
            await armazenamento.limparTurno();
            void iniciar();
          }}
        />
      )}
    </SafeAreaView>
  );
}
