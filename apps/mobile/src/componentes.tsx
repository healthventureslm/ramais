import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { F, type Cores } from './estilo';

/** Etiqueta do quarto, como o chaveiro pendurado atrás da recepção. */
export function Chaveiro({ numero, c, pendente }: { numero: string; c: Cores; pendente?: boolean }) {
  return (
    <View
      style={{
        minWidth: 46,
        height: 26,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: pendente ? 'transparent' : c.chaveiro,
        borderWidth: pendente ? 1.5 : 0,
        borderColor: c.bordaForte,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
        borderBottomLeftRadius: 9,
      }}
      accessibilityLabel={`Quarto ${numero}`}
    >
      <Text style={{ fontFamily: F.titulo, fontSize: 16, color: pendente ? c.texto : c.chaveiroTexto }}>{numero}</Text>
    </View>
  );
}

/** Lâmpada de estado, como a da mesa de ramais. */
export function Lampada({ cor, children }: { cor: string; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: cor }} />
      {children}
    </View>
  );
}
