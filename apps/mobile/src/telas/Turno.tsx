import type { MensagemView, Sessao, SolicitacaoDetalhe, SolicitacaoResumo } from '@ramais/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { ErroApi, type Api } from '../api';
import { Chaveiro, Lampada } from '../componentes';
import { F, estilos, useCores, type Cores } from '../estilo';
import { BarraMidia, MidiaBalao } from '../midia';
import { aoTrocarToken, cancelar, ouvirPrimeiroPlano } from '../notificacoes';
import { Diretas } from './Diretas';

type Oferta = Awaited<ReturnType<Api['ofertas']>>[number];

/**
 * Turno: ofertas no topo (aceite com tempo limite), depois as conversas da pessoa.
 * Pensado para quem está andando: botões grandes, poucas telas.
 */
export function Turno({ api, sessao, aoSair, aoExpirar }: { api: Api; sessao: Sessao; aoSair: () => void; aoExpirar: () => void }) {
  const c = useCores();
  const s = estilos(c);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [minhas, setMinhas] = useState<SolicitacaoResumo[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [, setTique] = useState(0);
  const socket = useRef<Socket | null>(null);
  const [aba, setAba] = useState<'atendimentos' | 'mensagens'>('atendimentos');
  const abaRef = useRef(aba);
  abaRef.current = aba;
  const [novas, setNovas] = useState(0);
  const [urgentes, setUrgentes] = useState(0);

  const tratarErro = useCallback(
    (e: unknown) => {
      if (e instanceof ErroApi && e.status === 401) aoExpirar();
    },
    [aoExpirar],
  );

  const carregar = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([api.ofertas(), api.minhas()]);
      setOfertas(o);
      setMinhas(m);
    } catch (e) {
      tratarErro(e);
    }
  }, [api, tratarErro]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => setTique((x) => x + 1), 1000);
    // Tempo real enquanto o app está aberto; ao voltar do segundo plano, sincroniza.
    const sk = io(api.base, { path: '/tempo-real', transports: ['websocket'], auth: { token: sessao.token } });
    socket.current = sk;
    sk.on('connect', () => void carregar());
    sk.onAny(() => void carregar());
    sk.on('direta:nova', () => {
      if (abaRef.current !== 'mensagens') setNovas((n) => n + 1);
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void carregar();
    });
    const offPush = ouvirPrimeiroPlano(() => void carregar());
    const offToken = aoTrocarToken((tk) => void api.pushToken(tk).catch(() => undefined));
    return () => {
      clearInterval(t);
      sk.disconnect();
      sub.remove();
      offPush();
      offToken();
    };
  }, [api, carregar, sessao.token]);

  if (aberta) {
    return <Conversa api={api} id={aberta} socket={socket.current} aoVoltar={() => { setAberta(null); void carregar(); }} cores={c} />;
  }

  const vivas = ofertas.filter((o) => new Date(o.expiraEm).getTime() > Date.now());

  return (
    <View style={s.tela}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>No turno</Text>
          <Text style={s.mudo}>
            {sessao.pessoa.nome} · {sessao.setores.map((x) => x.nome).join(', ')}
          </Text>
        </View>
        <Pressable
          style={[s.botao2, { paddingHorizontal: 14 }]}
          onPress={() =>
            Alert.alert('Sair do turno?', 'Suas conversas abertas voltam para a fila do setor e este celular para de receber.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: aoSair },
            ])
          }
        >
          <Text style={s.botao2Texto}>Sair</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        {(
          [
            ['atendimentos', `Atendimentos${vivas.length ? ` (${vivas.length})` : ''}`],
            ['mensagens', `Mensagens${novas + urgentes ? ` (${novas + urgentes})` : ''}`],
          ] as const
        ).map(([id, nome]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: aba === id }}
            style={[s.botao2, { flex: 1, paddingVertical: 10 }, aba === id && { backgroundColor: c.acento, borderColor: c.acento }]}
            onPress={() => {
              setAba(id);
              if (id === 'mensagens') setNovas(0);
            }}
          >
            <Text style={[s.botao2Texto, aba === id && { color: c.acentoTexto }, id === 'mensagens' && urgentes > 0 && aba !== id && { color: c.perigo }]}>
              {nome}
            </Text>
          </Pressable>
        ))}
      </View>
      {aba === 'mensagens' ? (
        <View style={{ flex: 1 }}>
          {vivas.length > 0 && (
            <Pressable
              style={[s.cartao, { marginHorizontal: 16, marginBottom: 10, borderColor: c.acento, borderWidth: 2 }]}
              onPress={() => setAba('atendimentos')}
            >
              <Text style={[s.texto, { fontFamily: F.forte }]}>
                {vivas.length === 1 ? 'Novo pedido esperando seu aceite' : `${vivas.length} pedidos esperando seu aceite`} · toque para ver
              </Text>
            </Pressable>
          )}
          <Diretas api={api} sessao={sessao} socket={socket.current} cores={c} aoMudarPendentes={setUrgentes} />
        </View>
      ) : (
      <FlatList
        data={minhas}
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
            {vivas.map((o) => {
              const resta = Math.max(0, Math.ceil((new Date(o.expiraEm).getTime() - Date.now()) / 1000));
              return (
                <View key={o.ofertaId} style={[s.cartao, { borderColor: o.urgencia === 'agora' ? c.perigo : c.vivo, borderWidth: 2 }]}>
                  <Lampada cor={o.urgencia === 'agora' ? c.perigo : c.vivo}>
                    <Text style={[s.texto, { fontFamily: F.forte }]}>
                      {o.urgencia === 'agora' ? 'Pedido urgente' : 'Pedido novo'} · {o.setor}
                    </Text>
                  </Lampada>
                  <Text style={[s.texto, { fontSize: 17 }]}>{o.resumo}</Text>
                  <Text style={[s.mudo, { fontFamily: F.dado }]}>Aceite em {resta}s</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[s.botao, { flex: 2 }]}
                      onPress={async () => {
                        try {
                          const r = await api.aceitar(o.ofertaId);
                          await cancelar(o.ofertaId);
                          setAberta(r.solicitacaoId);
                        } catch (e) {
                          tratarErro(e);
                          Alert.alert('Não deu', (e as Error).message);
                          void carregar();
                        }
                      }}
                    >
                      <Text style={s.botaoTexto}>Aceitar</Text>
                    </Pressable>
                    <Pressable
                      style={[s.botao2, { flex: 1 }]}
                      onPress={async () => {
                        await api.recusar(o.ofertaId).catch(() => undefined);
                        await cancelar(o.ofertaId);
                        void carregar();
                      }}
                    >
                      <Text style={s.botao2Texto}>Agora não</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Text style={[s.mudo, { marginTop: 8 }]}>MEUS ATENDIMENTOS</Text>
            {minhas.length === 0 && <Text style={s.mudo}>Nenhum atendimento com você agora.</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={s.cartao} onPress={() => setAberta(item.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.origem !== 'interna' && item.local && <Chaveiro numero={item.local.identificador} c={c} pendente={!item.local.confirmado} />}
              <Text style={[s.texto, { fontFamily: F.semi, flex: 1 }]} numberOfLines={1}>
                {item.origem === 'interna' ? `Apoio · ${item.setor?.nome}` : item.solicitante?.nome ?? 'Hóspede'}
              </Text>
              {item.urgencia === 'agora' && <Text style={[s.erro, { fontFamily: F.forte }]}>Urgente</Text>}
            </View>
            <Text style={s.texto} numberOfLines={2}>
              {item.resumo ?? item.ultimaMensagem}
            </Text>
          </Pressable>
        )}
      />
      )}
    </View>
  );
}

function Conversa({ api, id, socket, aoVoltar, cores: c }: { api: Api; id: string; socket: Socket | null; aoVoltar: () => void; cores: Cores }) {
  const s = estilos(c);
  const [d, setD] = useState<SolicitacaoDetalhe | null>(null);
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'externa' | 'interna'>('externa');
  const rolagem = useRef<ScrollView>(null);

  const carregar = useCallback(() => {
    api.detalhe(id).then(setD).catch(() => undefined);
  }, [api, id]);
  useEffect(() => {
    carregar();
    socket?.emit('assinar:solicitacao', id);
    const h = (p: { solicitacaoId: string }) => p?.solicitacaoId === id && carregar();
    socket?.on('solicitacao:mensagem', h);
    socket?.on('solicitacao:atualizada', h);
    return () => {
      socket?.emit('desassinar:solicitacao', id);
      socket?.off('solicitacao:mensagem', h);
      socket?.off('solicitacao:atualizada', h);
    };
  }, [carregar, id, socket]);

  if (!d) return <View style={s.tela} />;
  const podeExterna = d.origem === 'externa' && ['em_atendimento', 'aguardando_solicitante'].includes(d.estado);
  const modoReal = podeExterna ? modo : 'interna';

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.borda }}>
        <Pressable onPress={aoVoltar} hitSlop={12}>
          <Text style={[s.texto, { color: c.caneta }]}>Voltar</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.texto, { fontFamily: F.forte }]}>
            {d.origem === 'interna' ? `Apoio · ${d.setor?.nome}` : d.local ? `Quarto ${d.local.identificador}` : 'Hóspede'}
          </Text>
          <Text style={s.mudo}>{d.idioma !== 'pt' ? `Hóspede escreve em ${d.idioma.toUpperCase()} · você escreve em português` : d.setor?.nome}</Text>
        </View>
        {podeExterna && (
          <Pressable
            style={[s.botao2, { paddingHorizontal: 12 }]}
            onPress={async () => {
              await api.resolver(id).catch((e) => Alert.alert('Não deu', (e as Error).message));
              aoVoltar();
            }}
          >
            <Text style={s.botao2Texto}>Resolver</Text>
          </Pressable>
        )}
      </View>
      <ScrollView ref={rolagem} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => rolagem.current?.scrollToEnd()}>
        {d.mensagens.map((m) => (
          <Balao key={m.id} m={m} c={c} api={api} />
        ))}
      </ScrollView>
      <View style={{ padding: 10, gap: 8, borderTopWidth: 1, borderColor: c.borda, backgroundColor: c.superficie }}>
        {/* O texto digitado vira a legenda da foto. */}
        <BarraMidia
          c={c}
          aoEnviar={async (a) => {
            await api.enviarMidia(id, a, a.tipo === 'imagem' ? texto.trim() || null : null, modoReal);
            if (a.tipo === 'imagem') setTexto('');
            carregar();
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {podeExterna && (
            <Pressable onPress={() => setModo('externa')} style={[s.botao2, { flex: 1, paddingVertical: 8, backgroundColor: modoReal === 'externa' ? c.externa : c.superficie }]}>
              <Text style={s.botao2Texto}>Para o hóspede</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setModo('interna')} style={[s.botao2, { flex: 1, paddingVertical: 8, backgroundColor: modoReal === 'interna' ? c.interna : c.superficie }]}>
            <Text style={s.botao2Texto}>Nota interna</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[s.entrada, { flex: 1, backgroundColor: modoReal === 'externa' ? c.externa : c.interna }]}
            value={texto}
            onChangeText={setTexto}
            multiline
            placeholder={modoReal === 'externa' ? 'Mensagem para o hóspede' : 'Só a equipe vê'}
            placeholderTextColor={c.texto2}
          />
          <Pressable
            style={[s.botao, { paddingHorizontal: 16, justifyContent: 'center' }, !texto.trim() && { opacity: 0.5 }]}
            disabled={!texto.trim()}
            onPress={async () => {
              try {
                await api.responder(id, texto.trim(), modoReal);
                setTexto('');
                carregar();
              } catch (e) {
                Alert.alert('Não deu', (e as Error).message);
              }
            }}
          >
            <Text style={s.botaoTexto}>Enviar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Balao({ m, c, api }: { m: MensagemView; c: Cores; api: Api }) {
  const s = estilos(c);
  const [original, setOriginal] = useState(false);
  const deFora = m.autorTipo === 'solicitante';
  const interna = m.visibilidade === 'interna';
  const texto = deFora && m.traducao && !original ? m.traducao : m.texto;
  return (
    <Pressable
      onPress={() => m.traducao && setOriginal((v) => !v)}
      style={{
        alignSelf: interna ? 'center' : deFora ? 'flex-start' : 'flex-end',
        maxWidth: '85%',
        backgroundColor: interna ? c.interna : deFora ? c.superficie : c.externa,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: c.borda,
      }}
    >
      <MidiaBalao api={api} c={c} tipo={m.tipo} url={m.midiaUrl} transcricao={m.transcricao} criadoEm={m.criadoEm} />
      {m.descricao && <Text style={s.mudo}>Foto: {m.descricao}</Text>}
      {texto ? <Text style={m.tipo === 'audio' ? s.mudo : s.texto}>{m.tipo === 'audio' ? `Em português: ${texto}` : texto}</Text> : null}
      <Text style={[s.mudo, { fontSize: 11, marginTop: 4 }]}>
        {interna ? `nota · ${m.autorNome ?? 'sistema'}` : deFora ? (m.traducao ? (original ? 'original · toque para traduzir' : 'traduzido · toque para o original') : 'hóspede') : m.autorNome ?? 'automática'}
      </Text>
    </Pressable>
  );
}
