/**
 * Fiscalização da aderência ao design system da Health Ventures (docs/design.md).
 * Roda com `pnpm test` na web. REPROVA o que quebra o sistema; AVISA o que é dívida.
 *
 *  1. Cor literal (hex, rgb, hsl) fora de estilo/tema-ramais.css.
 *  2. var(--x) apontando para token que não existe no DS nem no tema do Ramais.
 *  3. transition: all; duração em ms cravada em CSS das telas.
 *  4. Emoji ou símbolo de enfeite em tela.
 *  5. Elemento HTML cru onde há componente do DS (<button>, <input>, <select>, <textarea>, <table>).
 *  6. window.confirm / window.prompt / alert: use useConfirm ou Dialog do DS.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(web, 'src');
const ds = join(web, '..', '..', 'packages', 'design-system');
const TEMA = 'tema-ramais.css';

function arquivos(dir, ext) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const erros = [];
const avisos = [];
const linhaDe = (texto, i) => texto.slice(0, i).split('\n').length;
const rel = (p) => relative(src, p);

// Tokens existentes: os do DS (tokens/ + variáveis declaradas no CSS dos componentes) e os do Ramais.
const declarados = new Set();
const coletar = (texto) => {
  for (const m of texto.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) declarados.add(m[1]);
};
for (const a of arquivos(join(ds, 'tokens'), ['.css'])) coletar(readFileSync(a, 'utf8'));
for (const a of arquivos(join(ds, 'dist'), ['.js'])) coletar(readFileSync(a, 'utf8'));
const css = arquivos(join(src, 'estilo'), ['.css']);
for (const a of css) coletar(readFileSync(a, 'utf8'));

const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

for (const arq of css) {
  const texto = semComentarios(readFileSync(arq, 'utf8'));
  for (const m of texto.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
    if (!declarados.has(m[1])) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} token inexistente ${m[1]}`);
  }
  if (/transition:\s*all/.test(texto)) erros.push(`${rel(arq)} transition: all`);
  if (arq.endsWith(TEMA)) continue;
  for (const m of texto.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} cor literal "${m[0]}": use um token do DS`);
  for (const m of texto.matchAll(/(transition|animation)[^;{}]*?\b(\d*\.?\d+)(ms|s)\b/g)) {
    if (Number(m[2]) !== 0) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} duração cravada ${m[2]}${m[3]}: use --dur-*`);
  }
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2713}-\u{2718}]/u;
const CRUS = /<(button|input|select|textarea|table)\b(?![^>]*\bhidden\b)/g;
for (const arq of arquivos(src, ['.tsx'])) {
  const texto = readFileSync(arq, 'utf8');
  for (const m of texto.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
    if (!declarados.has(m[1])) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} token inexistente ${m[1]}`);
  }
  for (const m of texto.matchAll(/['"`](#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})['"`]|\brgba?\(/g)) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} cor literal ${m[0]}`);
  for (const m of texto.matchAll(CRUS)) avisos.push(`${rel(arq)}:${linhaDe(texto, m.index)} <${m[1]}> cru: use o componente do DS`);
  for (const m of texto.matchAll(/\b(window\.)?(confirm|prompt|alert)\(/g)) {
    if (!/confirmar|useConfirm/.test(texto.slice(Math.max(0, m.index - 12), m.index + 10))) erros.push(`${rel(arq)}:${linhaDe(texto, m.index)} ${m[2]}() do navegador: use useConfirm ou Dialog do DS`);
  }
  texto.split('\n').forEach((l, i) => {
    if (EMOJI.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) erros.push(`${rel(arq)}:${i + 1} emoji ou símbolo em tela`);
  });
}

for (const a of avisos) console.log(`AVISO  ${a}`);
for (const e of erros) console.log(`ERRO   ${e}`);
console.log(`\naderência ao DS: ${erros.length} erro(s), ${avisos.length} aviso(s)`);
process.exit(erros.length ? 1 : 0);
