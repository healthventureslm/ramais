import { IDIOMAS_FIXOS, type ChaveTexto, type ConfigUnidade, type IdiomaFixo } from '@ramais/contracts';

/** Quem escreve fora de PT/ES/EN recebe os textos fixos em inglês. */
export function idiomaDosTextos(idioma: string | null | undefined): IdiomaFixo {
  const base = (idioma ?? '').toLowerCase().slice(0, 2);
  return (IDIOMAS_FIXOS as readonly string[]).includes(base) ? (base as IdiomaFixo) : 'en';
}

/** Nome do setor no idioma de quem vai ler (hóspede); sem tradução, o nome em português. */
export function nomeSetor(cfg: ConfigUnidade, chave: string, idioma: string | null | undefined, padrao?: string): string {
  const s = cfg.setores.find((x) => x.chave === chave);
  const i = idiomaDosTextos(idioma);
  if (!s) return padrao ?? chave;
  if (i === 'es' && s.nomes.es) return s.nomes.es;
  if (i === 'en' && s.nomes.en) return s.nomes.en;
  return s.nome;
}

export function texto(
  cfg: ConfigUnidade,
  chave: ChaveTexto,
  idioma: string | null | undefined,
  vars: Record<string, string | number> = {},
): string {
  const modelo = cfg.textos[chave][idiomaDosTextos(idioma)];
  return modelo.replace(/\{(\w+)\}/g, (_, nome: string) => String(vars[nome] ?? `{${nome}}`));
}

/**
 * A conversa troca de idioma? O primeiro idioma que dá para saber vale para a conversa; depois,
 * só uma frase de verdade (ou um áudio transcrito) com detecção confiável troca. Pouco texto não
 * diz o idioma de ninguém: a nota da pesquisa ("5"), quarto e sobrenome ("302 Silva"), "ok".
 */
export function trocarIdioma(c: {
  atual: string;
  definido: boolean;
  detectado: string | null;
  confianca: number;
  texto: string;
  transcrito: boolean;
}): boolean {
  if (!c.detectado || c.detectado === 'outro') return false;
  const letras = (c.texto.match(/\p{L}/gu) ?? []).length;
  const diz = c.transcrito || letras >= (c.definido ? 12 : 2);
  if (!diz || c.confianca < (c.definido ? 0.8 : 0.5)) return false;
  return c.detectado !== c.atual || !c.definido;
}
