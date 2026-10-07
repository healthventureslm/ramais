import { StyleSheet, useColorScheme } from 'react-native';

/**
 * Mesmo contrato visual da web (docs/design.md): a libré do hotel. Azul-marinho para ação
 * e chaveiro, latão para o que está ao vivo (o pedido tocando), recado amarelo para nota interna.
 */
const claro = {
  fundo: '#f1f0ec',
  superficie: '#ffffff',
  superficie2: '#e5e3dd',
  borda: '#d3d6da',
  bordaForte: '#8a919b',
  texto: '#151b24',
  texto2: '#5b6470',
  acento: '#243a5f',
  caneta: '#2f4a75',
  acentoTexto: '#ffffff',
  externa: '#f0f3f8',
  interna: '#fbefb3',
  perigo: '#a32a1f',
  ambar: '#7a5410',
  vivo: '#c9922e',
  ok: '#1f6b3c',
  apagada: '#8a919b',
  chaveiro: '#121f36',
  chaveiroTexto: '#f8f7f4',
};
const escuro: typeof claro = {
  fundo: '#10151c',
  superficie: '#171e28',
  superficie2: '#0c1117',
  borda: '#2c3644',
  bordaForte: '#5a6575',
  texto: '#e9ecef',
  texto2: '#9aa3ae',
  acento: '#9db3d6',
  caneta: '#9db3d6',
  acentoTexto: '#0b1424',
  externa: '#1a2639',
  interna: '#3a3318',
  perigo: '#f2897a',
  ambar: '#ecc983',
  vivo: '#e0b35e',
  ok: '#7fcf98',
  apagada: '#6f7884',
  chaveiro: '#c9d3e3',
  chaveiroTexto: '#0e131a',
};
export type Cores = typeof claro;

export function useCores(): Cores {
  return useColorScheme() === 'dark' ? escuro : claro;
}

/** As fontes do design system da Health Ventures. No Android, peso de fonte própria é outra família. */
export const F = {
  normal: 'IBMPlexSans_400Regular',
  medio: 'IBMPlexSans_500Medium',
  semi: 'IBMPlexSans_600SemiBold',
  forte: 'IBMPlexSans_700Bold',
  titulo: 'SchibstedGrotesk_700Bold',
  tituloSemi: 'SchibstedGrotesk_600SemiBold',
  /** Dado: tempo, hora, contagem. O que se compara ou dita vai em mono. */
  dado: 'IBMPlexMono_500Medium',
};

export function estilos(c: Cores) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: c.fundo },
    conteudo: { padding: 16, gap: 12 },
    titulo: { fontSize: 24, fontFamily: F.titulo, color: c.texto },
    texto: { color: c.texto, fontSize: 16, fontFamily: F.normal },
    mudo: { color: c.texto2, fontSize: 14, fontFamily: F.normal },
    entrada: {
      borderWidth: 1,
      borderColor: c.bordaForte,
      backgroundColor: c.superficie,
      color: c.texto,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: F.normal,
    },
    botao: { backgroundColor: c.acento, borderRadius: 9, paddingVertical: 14, alignItems: 'center' },
    botaoTexto: { color: c.acentoTexto, fontFamily: F.semi, fontSize: 16 },
    botao2: { borderWidth: 1, borderColor: c.bordaForte, borderRadius: 9, paddingVertical: 12, alignItems: 'center', backgroundColor: c.superficie },
    botao2Texto: { color: c.texto, fontFamily: F.semi, fontSize: 15 },
    cartao: { backgroundColor: c.superficie, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.borda, gap: 8 },
    erro: { color: c.perigo, fontFamily: F.medio },
    forte: { fontFamily: F.forte },
  });
}
