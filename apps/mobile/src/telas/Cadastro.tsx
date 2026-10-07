import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Api } from '../api';
import { estilos, useCores } from '../estilo';

/**
 * O admin gera um QR no painel com o endereço do servidor e o código de uso único:
 *   ramais://cadastro?servidor=https://api...&codigo=XXXX
 * Também dá para digitar os dois à mão.
 */
export function Cadastro({ aoCadastrar }: { aoCadastrar: (servidor: string, token: string) => Promise<void> }) {
  const c = useCores();
  const s = estilos(c);
  const [permissao, pedir] = useCameraPermissions();
  const [lendo, setLendo] = useState(false);
  const [servidor, setServidor] = useState('http://10.0.2.2:3000');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(srv = servidor, cod = codigo) {
    setErro('');
    setEnviando(true);
    try {
      const base = srv.replace(/\/+$/, '');
      const r = await new Api(base, null).cadastrar(cod.trim(), nome.trim() || 'Celular do setor', Platform.OS === 'ios' ? 'ios' : 'android');
      await aoCadastrar(base, r.token);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (lendo) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            setLendo(false);
            try {
              // O URL do React Native não implementa searchParams por completo: lê a query à mão.
              if (!data.startsWith('ramais://cadastro?')) throw new Error('QR inválido');
              const params = new Map(
                data
                  .split('?')[1]!
                  .split('&')
                  .map((p) => p.split('=').map(decodeURIComponent) as [string, string]),
              );
              const srv = params.get('servidor');
              const cod = params.get('codigo');
              if (!srv || !cod) throw new Error('QR inválido');
              setServidor(srv);
              setCodigo(cod);
              void cadastrar(srv, cod);
            } catch {
              setErro('Este QR não é de cadastro do Ramais.');
            }
          }}
        />
        <Pressable style={[s.botao2, { margin: 16 }]} onPress={() => setLendo(false)}>
          <Text style={s.botao2Texto}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={s.titulo}>Cadastrar este celular</Text>
      <Text style={s.mudo}>Peça ao administrador o QR de cadastro. Isso é feito uma vez por aparelho.</Text>
      <Pressable
        style={s.botao}
        onPress={async () => {
          if (!permissao?.granted) {
            const r = await pedir();
            if (!r.granted) return setErro('Sem câmera: digite o código abaixo.');
          }
          setLendo(true);
        }}
      >
        <Text style={s.botaoTexto}>Ler QR de cadastro</Text>
      </Pressable>
      <Text style={[s.mudo, { textAlign: 'center' }]}>ou</Text>
      <TextInput style={s.entrada} value={servidor} onChangeText={setServidor} autoCapitalize="none" autoCorrect={false} placeholder="Servidor" placeholderTextColor={c.texto2} />
      <TextInput style={s.entrada} value={codigo} onChangeText={setCodigo} autoCapitalize="none" autoCorrect={false} placeholder="Código de cadastro" placeholderTextColor={c.texto2} />
      <TextInput style={s.entrada} value={nome} onChangeText={setNome} placeholder="Nome do aparelho (ex.: Celular Governança)" placeholderTextColor={c.texto2} />
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      <Pressable style={[s.botao2, enviando && { opacity: 0.5 }]} disabled={enviando || !codigo} onPress={() => cadastrar()}>
        <Text style={s.botao2Texto}>{enviando ? 'Cadastrando…' : 'Cadastrar'}</Text>
      </Pressable>
    </ScrollView>
  );
}
