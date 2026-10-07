import { normalizar } from '@ramais/domain';

/**
 * Detecção de idioma por palavras frequentes. Serve de fallback quando não há IA
 * e de dica para o roteador; o roteador pode corrigir.
 */
const PALAVRAS: Record<string, string[]> = {
  pt: ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'que', 'nao', 'um', 'uma', 'para', 'com', 'meu', 'minha', 'esta', 'quarto',
    'obrigado', 'obrigada', 'por', 'favor', 'voce', 'ola', 'oi', 'preciso', 'tem', 'agua', 'esta', 'funciona', 'mais', 'tambem'],
  es: ['el', 'la', 'los', 'las', 'de', 'que', 'no', 'un', 'una', 'para', 'con', 'mi', 'esta', 'habitacion', 'gracias',
    'por', 'favor', 'usted', 'hola', 'necesito', 'hay', 'agua', 'funciona', 'mas', 'tambien', 'y', 'es', 'muy', 'pero'],
  en: ['the', 'a', 'an', 'of', 'to', 'and', 'is', 'not', 'my', 'room', 'thanks', 'thank', 'you', 'please', 'hello', 'hi',
    'need', 'there', 'water', 'working', 'can', 'could', 'we', 'i', 'it', 'does', 'more', 'also', 'with', 'for'],
};

const EXCLUSIVAS: Record<string, string[]> = {
  pt: ['nao', 'voce', 'obrigado', 'obrigada', 'preciso', 'tambem', 'quarto', 'ola', 'oi', 'ninguem', 'ainda', 'estou',
    'quero', 'tenho', 'onde', 'cade', 'veio', 'agora', 'muito', 'pra', 'nada'],
  es: ['habitacion', 'gracias', 'necesito', 'usted', 'hola', 'tambien', 'muy', 'y', 'nadie', 'vino', 'sigo', 'todavia',
    'aun', 'quiero', 'tengo', 'estoy', 'donde', 'ahora', 'mucho', 'toallas', 'llave', 'puede'],
  en: ['the', 'thanks', 'please', 'room', 'need', 'hello', 'and', 'is', 'nobody', 'still', 'waiting', 'came', 'want',
    'have', 'where', 'now', 'much', 'towels', 'key'],
};

export function detectarIdioma(texto: string): { idioma: string; confianca: number } {
  const palavras = normalizar(texto).split(' ').filter(Boolean);
  if (palavras.length === 0) return { idioma: 'pt', confianca: 0 };
  // "ñ" e "¿¡" denunciam espanhol; "ã/õ/ç" denunciam português.
  if (/[ñ¿¡]/i.test(texto)) return { idioma: 'es', confianca: 0.9 };
  if (/[ãõç]/i.test(texto)) return { idioma: 'pt', confianca: 0.9 };
  const pontos: Record<string, number> = { pt: 0, es: 0, en: 0 };
  for (const p of palavras) {
    for (const [lang, lista] of Object.entries(PALAVRAS)) if (lista.includes(p)) pontos[lang]! += 1;
    for (const [lang, lista] of Object.entries(EXCLUSIVAS)) if (lista.includes(p)) pontos[lang]! += 2;
  }
  const ordenado = Object.entries(pontos).sort((a, b) => b[1] - a[1]);
  const [primeiro, segundo] = ordenado;
  if (!primeiro || primeiro[1] === 0) return { idioma: 'pt', confianca: 0.2 };
  const confianca = Math.min(0.95, 0.5 + (primeiro[1] - (segundo?.[1] ?? 0)) / (2 * palavras.length + 2));
  return { idioma: primeiro[0], confianca };
}
