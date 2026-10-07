import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import type { Api, ArquivoMidia } from './api';
import { estilos, F, type Cores } from './estilo';

const LIMITE_SEG = 120;
const relogio = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Foto e áudio no compositor. A foto vem da câmera ou da galeria (reduzida, em JPEG); o áudio
 * é gravado em m4a, que o WhatsApp toca e a transcrição entende. Enquanto grava, a linha vira
 * a barra da gravação: tempo, descartar, enviar.
 */
export function BarraMidia({
  c,
  desativado,
  aoEnviar,
}: {
  c: Cores;
  desativado?: boolean;
  aoEnviar: (a: ArquivoMidia) => Promise<void>;
}) {
  const s = estilos(c);
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioRef = useRef(0);

  useEffect(
    () => () => {
      if (relogioRef.current) clearInterval(relogioRef.current);
    },
    [],
  );

  async function enviar(a: ArquivoMidia) {
    setEnviando(true);
    try {
      await aoEnviar(a);
    } catch (e) {
      Alert.alert('Não deu para enviar', (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function foto(origem: 'camera' | 'galeria') {
    const perm = origem === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Sem permissão', origem === 'camera' ? 'Libere a câmera nas configurações.' : 'Libere as fotos nas configurações.');
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, exif: false };
    const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
    const a = r.canceled ? null : r.assets[0];
    if (!a?.base64) return;
    await enviar({ tipo: 'imagem', mime: 'image/jpeg', base64: a.base64 });
  }

  async function gravar() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Sem permissão', 'Libere o microfone nas configurações para gravar áudio.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await gravador.prepareToRecordAsync();
    gravador.record();
    inicioRef.current = Date.now();
    setSegundos(0);
    setGravando(true);
    relogioRef.current = setInterval(() => {
      const seg = (Date.now() - inicioRef.current) / 1000;
      setSegundos(seg);
      if (seg >= LIMITE_SEG) void parar(true);
    }, 250);
  }

  async function parar(mandar: boolean) {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
    setGravando(false);
    await gravador.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = gravador.uri;
    if (!mandar || !uri) return;
    if (Date.now() - inicioRef.current < 500) return Alert.alert('Áudio muito curto', 'Grave um pouco mais antes de enviar.');
    const base64 = await new File(uri).base64();
    await enviar({ tipo: 'audio', mime: 'audio/mp4', base64 });
  }

  if (gravando) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="Gravando áudio">
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.perigo }} />
        <Text style={[s.texto, { fontFamily: F.dado, color: c.perigo, flex: 1 }]}>
          Gravando {relogio(segundos)} de {relogio(LIMITE_SEG)}
        </Text>
        <Pressable style={[s.botao2, { paddingHorizontal: 12, paddingVertical: 8 }]} onPress={() => void parar(false)}>
          <Text style={s.botao2Texto}>Descartar</Text>
        </Pressable>
        <Pressable style={[s.botao, { paddingHorizontal: 14, paddingVertical: 8 }]} onPress={() => void parar(true)}>
          <Text style={s.botaoTexto}>Enviar áudio</Text>
        </Pressable>
      </View>
    );
  }

  const parado = desativado || enviando;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Pressable
        style={[s.botao2, { paddingHorizontal: 12, paddingVertical: 8 }, parado && { opacity: 0.5 }]}
        disabled={parado}
        onPress={() =>
          Alert.alert('Enviar foto', undefined, [
            { text: 'Tirar foto', onPress: () => void foto('camera') },
            { text: 'Escolher da galeria', onPress: () => void foto('galeria') },
            { text: 'Cancelar', style: 'cancel' },
          ])
        }
      >
        <Text style={s.botao2Texto}>Foto</Text>
      </Pressable>
      <Pressable style={[s.botao2, { paddingHorizontal: 12, paddingVertical: 8 }, parado && { opacity: 0.5 }]} disabled={parado} onPress={() => void gravar()}>
        <Text style={s.botao2Texto}>Gravar áudio</Text>
      </Pressable>
      {enviando && <ActivityIndicator color={c.caneta} />}
    </View>
  );
}

/** Foto ou áudio dentro do balão. O áudio sempre com a transcrição embaixo, como no WhatsApp. */
export function MidiaBalao({
  api,
  c,
  tipo,
  url,
  transcricao,
  criadoEm,
}: {
  api: Api;
  c: Cores;
  tipo: string;
  url: string | null;
  transcricao: string | null;
  criadoEm: string;
}) {
  const s = estilos(c);
  if (!url || (tipo !== 'imagem' && tipo !== 'audio')) return null;
  const fonte = { uri: api.base + url, headers: api.cabecalhos };
  if (tipo === 'imagem') {
    return <Image source={fonte} style={{ width: 220, height: 165, borderRadius: 8, backgroundColor: c.superficie2 }} resizeMode="cover" accessibilityLabel="Foto" />;
  }
  const recente = Date.now() - new Date(criadoEm).getTime() < 90_000;
  return (
    <View style={{ gap: 6, minWidth: 200 }}>
      <PlayerAudio fonte={fonte} c={c} />
      {transcricao ? (
        <Text style={[s.texto, { borderTopWidth: 1, borderColor: c.borda, paddingTop: 6 }]}>{transcricao}</Text>
      ) : (
        <Text style={[s.mudo, { fontSize: 12 }]}>{recente ? 'Transcrevendo…' : 'Sem transcrição.'}</Text>
      )}
    </View>
  );
}

function PlayerAudio({ fonte, c }: { fonte: { uri: string; headers: Record<string, string> }; c: Cores }) {
  const s = estilos(c);
  const player = useAudioPlayer(fonte);
  const st = useAudioPlayerStatus(player);
  const tocando = st.playing;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        style={[s.botao, { width: 40, height: 40, borderRadius: 20, paddingVertical: 0, paddingHorizontal: 0, justifyContent: 'center' }]}
        accessibilityLabel={tocando ? 'Pausar' : 'Ouvir'}
        onPress={() => {
          if (tocando) return player.pause();
          if (st.duration > 0 && st.currentTime >= st.duration - 0.1) void player.seekTo(0);
          player.play();
        }}
      >
        {tocando ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View style={{ width: 4, height: 14, backgroundColor: c.acentoTexto }} />
            <View style={{ width: 4, height: 14, backgroundColor: c.acentoTexto }} />
          </View>
        ) : (
          // Triângulo de "tocar" desenhado com bordas: sem símbolo de fonte (que vira emoji em alguns aparelhos).
          <View
            style={{
              marginLeft: 3,
              width: 0,
              height: 0,
              borderTopWidth: 8,
              borderBottomWidth: 8,
              borderLeftWidth: 13,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: c.acentoTexto,
            }}
          />
        )}
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c.borda }}>
        <View style={{ width: `${st.duration ? Math.min(100, (st.currentTime / st.duration) * 100) : 0}%`, height: 4, borderRadius: 2, backgroundColor: c.caneta }} />
      </View>
      <Text style={[s.mudo, { fontFamily: F.dado, fontSize: 12 }]}>{relogio(tocando ? st.currentTime : st.duration || 0)}</Text>
    </View>
  );
}
