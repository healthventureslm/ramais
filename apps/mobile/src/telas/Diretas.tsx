import type { Sessao } from '@ramais/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { Socket } from 'socket.io-client';
import type { Api, ConversaDireta, MensagemDireta, PessoaBusca } from '../api';
import { Lampada } from '../componentes';
import { F, estilos, type Cores } from '../estilo';
import { BarraMidia, MidiaBalao } from '../midia';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Mensagens diretas: o "ramal" entre pessoas da equipe. Para uma pessoa exata, com status;
 * a urgente pede "ciente" e toca como oferta no celular de quem recebe.
 */
export function Diretas({
  api,
  sessao,
  socket,
  cores: c,
  aoMudarPendentes,
}: {
  api: Api;
  sessao: Sessao;
  socket: Socket | null;
  cores: Cores;
  aoMudarPendentes: (n: number) => void;
}) {
  const s = estilos(c);
  const [conversas, setConversas] = useState<ConversaDireta[]>([]);
  const [aberta, setAberta] = useState<{ conversaId: string | null; outro: { id: string; nome: string } } | null>(null);
  const [nova, setNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const l = await api.diretas().catch(() => null);
    if (!l) return;
    setConversas(l);
    aoMudarPendentes(l.reduce((n, x) => n + x.urgentes_pendentes, 0));
  }, [api, aoMudarPendentes]);

  useEffect(() => {
    void carregar();
    const h = () => void carregar();
    socket?.on('direta:nova', h);
    socket?.on('direta:atualizada', h);
    return () => {
      socket?.off('direta:nova', h);
      socket?.off('direta:atualizada', h);
    };
  }, [carregar, socket]);

  if (aberta) {
    return (
      <ConversaDiretaTela
        api={api}
        eu={sessao.pessoa.id}
        conversaId={aberta.conversaId}
        outro={aberta.outro}
        socket={socket}
        cores={c}
        aoVoltar={() => {
          setAberta(null);
          void carregar();
        }}
      />
    );
  }
  if (nova) {
    return (
      <EscolherPessoa
        api={api}
        sessao={sessao}
        cores={c}
        aoVoltar={() => setNova(false)}
        aoEscolher={(p) => {
          setNova(false);
          const existente = conversas.find((x) => x.outros?.length === 1 && x.outros[0]!.id === p.id);
          setAberta({ conversaId: existente?.id ?? null, outro: { id: p.id, nome: p.nome } });
        }}
      />
    );
  }

  return (
    <FlatList
      data={conversas}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10 }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={async () => {
            setAtualizando(true);
            await carregar();
            setAtualizando(false);
          }}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 6 }}>
          <Pressable style={s.botao} onPress={() => setNova(true)}>
            <Text style={s.botaoTexto}>Equipe: quem está online</Text>
          </Pressable>
          {conversas.length === 0 && <Text style={s.mudo}>Nenhuma conversa ainda. Mande uma mensagem para alguém da equipe.</Text>}
        </View>
      }
      renderItem={({ item }) => {
        const outro = item.outros?.[0] ?? { id: '', nome: '—' };
        const minha = item.ultima?.autor_id === sessao.pessoa.id;
        return (
          <Pressable
            style={[s.cartao, item.urgentes_pendentes > 0 && { borderColor: c.perigo, borderWidth: 2 }]}
            onPress={() => setAberta({ conversaId: item.id, outro })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.texto, { fontFamily: F.forte, flex: 1 }]}>{item.outros?.map((o) => o.nome).join(', ')}</Text>
              {item.ultima && <Text style={s.mudo}>{hora(item.ultima.criado_em)}</Text>}
            </View>
            {item.ultima && (
              <Text style={s.texto} numberOfLines={2}>
                {minha ? 'Você: ' : ''}
                {item.ultima.urgente ? 'Urgente: ' : ''}
                {item.ultima.tipo === 'audio' ? 'Mensagem de voz' : item.ultima.tipo === 'imagem' ? `Foto${item.ultima.texto ? `: ${item.ultima.texto}` : ''}` : item.ultima.texto}
              </Text>
            )}
            {item.urgentes_pendentes > 0 && (
              <Text style={[s.erro, { fontFamily: F.forte }]}>
                {item.urgentes_pendentes} urgente{item.urgentes_pendentes > 1 ? 's' : ''} esperando seu "ciente"
              </Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

function EscolherPessoa({
  api,
  sessao,
  cores: c,
  aoVoltar,
  aoEscolher,
}: {
  api: Api;
  sessao: Sessao;
  cores: Cores;
  aoVoltar: () => void;
  aoEscolher: (p: PessoaBusca) => void;
}) {
  const s = estilos(c);
  const [busca, setBusca] = useState('');
  const [pessoas, setPessoas] = useState<PessoaBusca[]>([]);
  const unidadeId = sessao.unidades[0]?.id;

  // Sem busca, a equipe toda (online primeiro); atualiza sozinha enquanto a tela está aberta.
  useEffect(() => {
    if (!unidadeId) return;
    const buscar = () =>
      api
        .pessoas(unidadeId, busca)
        .then((l) => setPessoas(l.filter((p) => p.id !== sessao.pessoa.id)))
        .catch(() => undefined);
    const t = setTimeout(buscar, 250);
    const i = setInterval(buscar, 15_000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [api, busca, unidadeId, sessao.pessoa.id]);

  return (
    <View style={s.tela}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.borda }}>
        <Pressable onPress={aoVoltar} hitSlop={12} accessibilityLabel="Voltar">
          <Text style={[s.texto, { color: c.caneta }]}>Voltar</Text>
        </Pressable>
        <TextInput
          style={[s.entrada, { flex: 1 }]}
          value={busca}
          onChangeText={setBusca}
          placeholder="Filtrar por nome ou setor"
          placeholderTextColor={c.texto2}
        />
      </View>
      <FlatList
        data={pessoas}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={<Text style={s.mudo}>Ninguém encontrado.</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.cartao} onPress={() => aoEscolher(item)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.texto, { fontFamily: F.forte, flex: 1 }]}>{item.nome}</Text>
              <Lampada cor={item.online || item.emTurno ? c.ok : c.apagada}>
                <Text style={[s.mudo, (item.online || item.emTurno) && { color: c.ok }]}>
                  {item.online ? 'online' : item.emTurno ? 'no turno' : 'fora do turno'}
                </Text>
              </Lampada>
            </View>
            <Text style={s.mudo}>
              {[item.setores, item.atendendo > 0 ? `atendendo ${item.atendendo}` : item.online || item.emTurno ? 'livre' : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function ConversaDiretaTela({
  api,
  eu,
  conversaId: inicial,
  outro,
  socket,
  cores: c,
  aoVoltar,
}: {
  api: Api;
  eu: string;
  conversaId: string | null;
  outro: { id: string; nome: string };
  socket: Socket | null;
  cores: Cores;
  aoVoltar: () => void;
}) {
  const s = estilos(c);
  const [conversaId, setConversaId] = useState(inicial);
  const [msgs, setMsgs] = useState<MensagemDireta[]>([]);
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rolagem = useRef<ScrollView>(null);

  const carregar = useCallback(() => {
    if (!conversaId) return;
    api.direta(conversaId).then(setMsgs).catch(() => undefined);
  }, [api, conversaId]);

  useEffect(() => {
    carregar();
    const h = (p: { conversaId: string }) => p?.conversaId === conversaId && carregar();
    socket?.on('direta:nova', h);
    return () => {
      socket?.off('direta:nova', h);
    };
  }, [carregar, conversaId, socket]);

  function enviado(r: { conversaId: string; foraDoTurno: boolean; destinatario: string }) {
    setUrgente(false);
    if (r.conversaId !== conversaId) setConversaId(r.conversaId);
    else carregar();
    if (r.foraDoTurno) Alert.alert('Fora do turno', `${r.destinatario} não está no turno agora: a mensagem fica para quando entrar.`);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      enviado(await api.enviarDireta(outro.id, t, urgente));
      setTexto('');
    } catch (e) {
      Alert.alert('Não deu', (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.borda }}>
        <Pressable onPress={aoVoltar} hitSlop={12} accessibilityLabel="Voltar">
          <Text style={[s.texto, { color: c.caneta }]}>Voltar</Text>
        </Pressable>
        <Text style={[s.texto, { fontFamily: F.forte, flex: 1 }]}>{outro.nome}</Text>
      </View>
      <ScrollView ref={rolagem} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => rolagem.current?.scrollToEnd()}>
        {msgs.length === 0 && <Text style={s.mudo}>Escreva a primeira mensagem para {outro.nome.split(' ')[0]}.</Text>}
        {msgs.map((m) => {
          const minha = m.autor_id === eu;
          const pedeCiente = !minha && m.urgente && !m.ciente_em;
          return (
            <View
              key={m.id}
              style={{
                alignSelf: minha ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: minha ? c.externa : c.superficie,
                borderRadius: 12,
                padding: 10,
                borderWidth: m.urgente ? 2 : 1,
                borderColor: m.urgente ? c.perigo : c.borda,
                gap: 6,
              }}
            >
              {m.urgente && <Text style={[s.erro, { fontFamily: F.forte, fontSize: 12 }]}>URGENTE</Text>}
              <MidiaBalao api={api} c={c} tipo={m.tipo} url={m.midia_url} transcricao={m.transcricao} criadoEm={m.criado_em} />
              {m.texto ? <Text style={s.texto}>{m.texto}</Text> : null}
              <Text style={[s.mudo, { fontSize: 11 }]}>
                {hora(m.criado_em)}
                {m.urgente && m.ciente_em ? ` · ciente às ${hora(m.ciente_em)}` : m.urgente && minha ? ' · aguardando ciente' : ''}
              </Text>
              {pedeCiente && (
                <Pressable
                  style={[s.botao, { paddingVertical: 10 }]}
                  onPress={async () => {
                    await api.ciente(m.id).catch((e) => Alert.alert('Não deu', (e as Error).message));
                    carregar();
                  }}
                >
                  <Text style={s.botaoTexto}>Ciente</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={{ padding: 10, gap: 8, borderTopWidth: 1, borderColor: c.borda, backgroundColor: c.superficie }}>
        {/* O texto digitado vira a legenda da foto. */}
        <BarraMidia
          c={c}
          aoEnviar={async (a) => {
            enviado(await api.enviarDiretaMidia(outro.id, a, a.tipo === 'imagem' ? texto.trim() || null : null, urgente));
            if (a.tipo === 'imagem') setTexto('');
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch value={urgente} onValueChange={setUrgente} accessibilityLabel="Urgente" />
          <Text style={[s.texto, urgente && { color: c.perigo, fontFamily: F.forte }]}>
            {urgente ? 'Urgente: toca no celular e pede ciente' : 'Urgente'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[s.entrada, { flex: 1 }]}
            value={texto}
            onChangeText={setTexto}
            multiline
            placeholder={`Mensagem para ${outro.nome.split(' ')[0]}`}
            placeholderTextColor={c.texto2}
          />
          <Pressable
            style={[s.botao, { paddingHorizontal: 16, justifyContent: 'center' }, urgente && { backgroundColor: c.perigo }, (!texto.trim() || enviando) && { opacity: 0.5 }]}
            disabled={!texto.trim() || enviando}
            onPress={enviar}
          >
            <Text style={s.botaoTexto}>Enviar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
