import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text } from 'react-native';
import { estilos, useCores } from '../estilo';
import { abrirAjustesBateria, economiaDeBateriaAtiva, pedirPermissao, testar } from '../notificacoes';

/** Tela de teste no onboarding: sem notificação confiável, o app não serve para quem está andando. */
export function TesteNotificacao({ aoContinuar }: { aoContinuar: () => void }) {
  const c = useCores();
  const s = estilos(c);
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [bateria, setBateria] = useState<boolean | null>(null);
  const [testado, setTestado] = useState(false);

  async function verificar() {
    setPermitido(await pedirPermissao());
    setBateria(await economiaDeBateriaAtiva());
  }
  useEffect(() => {
    void verificar();
  }, []);

  return (
    <ScrollView contentContainerStyle={s.conteudo}>
      <Text style={s.titulo}>Teste de notificação</Text>
      <Text style={s.mudo}>Os pedidos chegam com som até alguém abrir. Vamos conferir se este aparelho toca.</Text>

      <Text style={s.texto}>{permitido === null ? '…' : permitido ? 'Notificações permitidas' : 'Notificações bloqueadas: libere nos ajustes do celular'}</Text>
      {permitido === false && (
        <Pressable style={s.botao2} onPress={verificar}>
          <Text style={s.botao2Texto}>Permitir notificações</Text>
        </Pressable>
      )}

      {Platform.OS === 'android' && (
        <>
          <Text style={s.texto}>
            {bateria === null ? '…' : bateria ? 'Economia de bateria ativa para o app: desative para não perder pedidos' : 'Economia de bateria desativada'}
          </Text>
          {bateria && (
            <>
              <Text style={s.mudo}>
                Com a economia de bateria, o Android pode atrasar ou cortar as notificações. Em "Bateria", escolha "Sem restrições"
                para o Ramais.
              </Text>
              <Pressable
                style={s.botao2}
                onPress={async () => {
                  await abrirAjustesBateria();
                  setBateria(await economiaDeBateriaAtiva());
                }}
              >
                <Text style={s.botao2Texto}>Abrir ajustes de bateria</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      <Pressable
        style={s.botao2}
        onPress={async () => {
          await testar();
          setTestado(true);
        }}
      >
        <Text style={s.botao2Texto}>Tocar notificação de teste</Text>
      </Pressable>
      {testado && <Text style={s.mudo}>Ouviu o som e viu a notificação? Então pode continuar.</Text>}

      <Pressable style={s.botao} onPress={aoContinuar}>
        <Text style={s.botaoTexto}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );
}
