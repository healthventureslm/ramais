import type { Sessao } from '@ramais/contracts';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput } from 'react-native';
import type { Api } from '../api';
import { estilos, useCores } from '../estilo';
import { tokenPush } from '../notificacoes';

/** Entrar no app é entrar no turno. */
export function Entrar({
  api,
  aoEntrar,
  aoTestar,
  aoEsquecer,
}: {
  api: Api;
  aoEntrar: (s: Sessao) => Promise<void>;
  aoTestar: () => void;
  aoEsquecer: () => Promise<void>;
}) {
  const c = useCores();
  const s = estilos(c);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  return (
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={s.titulo}>Entrar no turno</Text>
      <Text style={s.mudo}>Enquanto você estiver no turno, este celular recebe os pedidos dos seus setores.</Text>
      <TextInput
        style={s.entrada}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Seu e-mail"
        placeholderTextColor={c.texto2}
      />
      <TextInput
        style={s.entrada}
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        placeholder="PIN de 6 dígitos"
        placeholderTextColor={c.texto2}
      />
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      <Pressable
        style={[s.botao, (enviando || pin.length !== 6 || !email) && { opacity: 0.5 }]}
        disabled={enviando || pin.length !== 6 || !email}
        onPress={async () => {
          setErro('');
          setEnviando(true);
          try {
            const push = await tokenPush();
            await aoEntrar(await api.entrar(email.trim(), pin, push));
          } catch (e) {
            setErro((e as Error).message);
            setPin('');
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Text style={s.botaoTexto}>{enviando ? 'Entrando…' : 'Entrar no turno'}</Text>
      </Pressable>
      <Pressable style={s.botao2} onPress={aoTestar}>
        <Text style={s.botao2Texto}>Testar notificação</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          Alert.alert('Descadastrar aparelho?', 'Será preciso um novo QR do administrador.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Descadastrar', style: 'destructive', onPress: () => void aoEsquecer() },
          ])
        }
      >
        <Text style={[s.mudo, { textAlign: 'center', marginTop: 24 }]}>Descadastrar este aparelho</Text>
      </Pressable>
    </ScrollView>
  );
}
