/**
 * Traz o design system da Health Ventures para dentro do monorepo (packages/design-system),
 * como pacote de workspace. O DS vive fora deste repositório; uma cópia versionada garante
 * que o build e o deploy não dependam de uma pasta na máquina de alguém.
 *
 * Uso: node tools/sincronizar-ds.mjs [caminho-do-DS]
 * Padrão: ../Health/DesignSystem (ao lado da pasta do repositório), ou HV_DS_PATH.
 *
 * Copia só o que o pacote publica e o consumidor usa: dist/, tokens/, styles.css,
 * index.d.ts, os .d.ts dos componentes, o logo e o package.json. Nada de node_modules,
 * testes ou scripts do DS.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = process.argv[2] ?? process.env.HV_DS_PATH ?? join(repo, '..', 'Health', 'DesignSystem');
const destino = join(repo, 'packages', 'design-system');

if (!existsSync(join(origem, 'package.json'))) {
  console.error(`DS não encontrado em ${origem}. Passe o caminho: node tools/sincronizar-ds.mjs <pasta>`);
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

for (const item of ['dist', 'tokens', 'styles.css', 'index.d.ts', 'DESIGN.md', 'CHANGELOG.md']) {
  if (existsSync(join(origem, item))) cpSync(join(origem, item), join(destino, item), { recursive: true });
}
mkdirSync(join(destino, 'assets'), { recursive: true });
cpSync(join(origem, 'assets', 'logo-monogram.svg'), join(destino, 'assets', 'logo-monogram.svg'));

// Só os tipos dos componentes (o JS vem do dist).
function tipos(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) tipos(p);
    else if (n.endsWith('.d.ts')) {
      const alvo = join(destino, relative(origem, p));
      mkdirSync(dirname(alvo), { recursive: true });
      cpSync(p, alvo);
    }
  }
}
tipos(join(origem, 'components'));

// package.json do DS, sem scripts nem devDependencies (não rodam aqui). React 19 entra no peer:
// os componentes não usam nenhuma API removida no 19 (sem defaultProps em função, findDOMNode, refs de string).
const pkg = JSON.parse(readFileSync(join(origem, 'package.json'), 'utf8'));
delete pkg.scripts;
delete pkg.devDependencies;
delete pkg.publishConfig;
pkg.private = true;
pkg.peerDependencies = { react: '^18.0.0 || ^19.0.0', 'react-dom': '^18.0.0 || ^19.0.0' };
// Os .d.ts do DS importam "react": sem os tipos ao alcance desta pasta, as props de HTML somem no consumidor.
pkg.devDependencies = { '@types/react': '^19.1.0', '@types/react-dom': '^19.1.0' };
pkg.exports = {
  '.': { types: './index.d.ts', default: './dist/index.js' },
  './styles.css': './styles.css',
  './tokens/*': './tokens/*',
  './assets/*': './assets/*',
};
writeFileSync(join(destino, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

writeFileSync(
  join(destino, 'LEIA-ME.md'),
  `# @healthventureslm/design-system (cópia)\n\nCópia da versão **${pkg.version}** do design system da Health Ventures, trazida por \`tools/sincronizar-ds.mjs\`.\n\n**Não edite aqui.** Mude no DS e sincronize de novo. A marca do Ramais (cores) fica em \`apps/web/src/estilo/tema-ramais.css\`, por cima dos tokens do DS.\n`,
);
console.log(`design system ${pkg.version} copiado para ${relative(repo, destino)}`);
