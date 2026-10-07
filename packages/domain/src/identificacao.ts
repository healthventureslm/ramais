import { normalizar } from './gate.js';

/**
 * O QR do quarto abre o WhatsApp com um texto pré-preenchido que carrega um token
 * aleatório do local: "... (código #R-k7Qp2x)". O token não é o número do quarto,
 * para que ninguém consiga reivindicar outro quarto adivinhando.
 */
const PADRAO_CODIGO = /#R-([A-Za-z0-9]{6,12})\b/;

export function extrairCodigoLocal(texto: string): string | null {
  return PADRAO_CODIGO.exec(texto)?.[1] ?? null;
}

/** Remove o código do texto, para que ele não vá para a IA nem para a equipe como se fosse o pedido. */
export function removerCodigoLocal(texto: string): string {
  return texto
    .replace(/\(?\s*(?:c[oó]digo|code)?\s*:?\s*#R-[A-Za-z0-9]{6,12}\s*\)?/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Token sem caracteres ambíguos (0/O, 1/l/I). */
export function gerarCodigoLocal(aleatorio: (n: number) => Uint8Array, tamanho = 8): string {
  const bytes = aleatorio(tamanho);
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}

export function linkWhatsApp(numeroE164: string, codigo: string, texto: string): string {
  const numero = numeroE164.replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(`${texto} (código #R-${codigo})`)}`;
}

/**
 * Fallback por quarto e sobrenome: "302 Silva", "quarto 302, sobrenome Silva", "Silva 302".
 * Devolve null se não achar um número e uma palavra.
 */
export function extrairQuartoSobrenome(texto: string): { quarto: string; sobrenome: string } | null {
  const t = normalizar(texto);
  const quarto = /\b(\d{1,5}[a-z]?)\b/.exec(t)?.[1];
  if (!quarto) return null;
  const ignorar = new Set([
    'quarto', 'apto', 'apartamento', 'room', 'habitacion', 'sobrenome', 'apellido', 'last', 'name',
    'surname', 'meu', 'mi', 'my', 'e', 'y', 'and', 'o', 'el', 'is', 'es', 'numero', 'number', 'do', 'de', 'da',
  ]);
  const palavras = t.split(' ').filter((p) => p !== quarto && p.length >= 2 && !/^\d+$/.test(p) && !ignorar.has(p));
  const sobrenome = palavras.at(-1);
  if (!sobrenome) return null;
  return { quarto, sobrenome };
}

export function sobrenomeConfere(informado: string, cadastrado: string): boolean {
  const a = normalizar(informado);
  const b = normalizar(cadastrado);
  if (!a || !b) return false;
  // Aceita qualquer parte do sobrenome composto ("silva" confere com "da silva santos").
  return b.split(' ').includes(a) || a === b;
}

/** Só dígitos, com DDI. O WhatsApp já envia assim (wa_id). */
export function normalizarTelefone(t: string): string {
  return t.replace(/\D/g, '');
}
