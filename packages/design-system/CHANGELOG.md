# Changelog

## 2.3.0

Três peças trazidas do MetaBioma, onde nasceram dentro de um produto e provaram o valor.
Entram com a **estrutura e o comportamento** de lá, e com a linguagem visual daqui —
tokens, raios e tintas do DS, sem o lima e a floresta do MetaBioma.

**Sem mudança visual nos componentes existentes** (118 capturas iguais à baseline) e sem
remoção de API.

### Adicionado

- **`RecordingDock`** — a barra flutuante de uma captura que continua fora da tela onde
  começou. Cobre o que o `LiveActivity` não cobre: o **depois** da gravação — enviando,
  transcrevendo, e o envio que falhou com o áudio ainda guardado, com "Reenviar". Fases
  `recording · paused · sending · failed · idle`; cada ação só aparece se o handler vier.
  Montado acima das rotas, é o que torna a gravação assíncrona de verdade. Estreito, as
  ações secundárias ficam no glifo e, abaixo de 420px, descem para uma segunda linha.
- **`TopNav`** — navegação principal em barra, alternativa à `SidebarNav` para produtos com
  até ~6 destinos. Mesma API onde faz sentido (`brand`, `items`, `activeId`, `onSelect`,
  `user`, `surface`). `variant="bar" | "floating"`. Responde à própria largura: sai o nome do
  usuário, depois os rótulos, por último o nome da marca.
- **`CopySection`** — seção de conteúdo processado com um copiar por seção. Corpo livre e/ou
  linhas de resultado (parâmetro · resultado · referência) com `status` marcado por tinta,
  seta e palavra; observação; comentário do profissional, que vai **rotulado** no clipboard.
  Ficaram de fora da versão do MetaBioma o ícone em quadrado, o título em caixa-alta, o
  cabeçalho tingido e a cor da seção escolhida por palavra-chave no título.

### Alterado

- **`CopyButton`** aceita `value` e `html` como **função**, lida na hora do clique — para
  copiar o que só existe depois do render. String continua valendo.

### Fiscalização

- `audit:css` passa a ignorar blocos `@container`, como já fazia com `@media`/`@supports`:
  regra responsiva do próprio componente não é divergência.
- CONTRIBUTING: bloco novo do bundle precisa de uma linha de corpo — com ele vazio, a regex
  do gerador engolia o cabeçalho do bloco seguinte.

---

## 2.2.1

**Lint de props dizia que a API documentada não existia.** As listas de props de
`_adherence.oxlintrc.json` foram escritas à mão no commit inicial e nunca mais mudaram;
o `fix-adherence-props.mjs` só acrescentava os atributos herdados em cima delas. Resultado
medido no VoiceHealth ao subir para a 2.2.0: **40 avisos falsos** — `SidebarNav mobile`,
`persistKey`, `userActions`; `EmptyState loading`; `Avatar fromName`; `Tag family`.

- O script agora **regenera** a lista de props e as listas de valores (`variant`, `size`...)
  a partir da interface do `.d.ts`, seguindo `extends` entre interfaces do DS. O `--check`
  que já roda na suíte pega a deriva da próxima vez.
- 15 componentes estavam desatualizados. Entre eles, `IconButton variant="danger"` era
  acusado como valor inválido.
- Atributos de campo de texto entram nos herdados: `inputMode`, `enterKeyHint`,
  `spellCheck`, `autoCapitalize`, `autoCorrect`, `accept`, `multiple`, `list`.

Sem mudança visual e sem mudança de API.

---

## 2.2.0

Fecha as pontas que a 2.1.0 deixou em "Ainda aberto" e mede o que antes era afirmado:
**contraste renderizado**, tela por tela, nos dois temas. Eram 332 textos abaixo do mínimo
WCAG AA; sobraram 8, todos explicados no cabeçalho de `scripts/audit-contrast.mjs`.

**Sem remoção de API.** Mudança visual ampla mas de tom fino — leia "Confira suas telas".

### Confira suas telas

| Onde | Antes | Agora |
|---|---|---|
| **`--ink-500` / `--text-muted` (claro)** | `#65726C` — 4,04:1 sobre `--surface-sunken` | `#5A6761` — 4,76:1. Todo texto secundário fica um degrau mais firme |
| Rótulo de `ListGroup`, sobrancelha do `Drawer`, marcas do `Slider`, descrição do `Stepper`, tamanho e formatos do `FileUpload`, frase do `InsertDivider prominent` | `--text-subtle` (3,1:1) | `--text-muted` |
| `Banner` — descrição | 88% do tom misturado ao fundo (3,8:1) | a tinta cheia do par; a hierarquia vem do peso do título |
| `Indicator` tons `danger` / `positive` / `neutral` | número escuro sobre crimson no escuro (3,5:1) | preenchimento é o `-fg` do tom, glifo é `--surface-card` |
| `SidebarNav` — contador do item ativo | petrol-500 com tinta escura (3,9:1) | `--action-primary` + `--action-primary-text` |
| `SegmentedControl` — contador | `opacity: .8` | sem opacidade |
| **Popovers e tooltips** (`Select`, `Combobox`, `MultiSelect`, `DatePicker`, `Menu`, `Breadcrumbs`, tooltips dos 5 gráficos, painel do `ChatWidget`) | fio de 1px + sombra larga | só sombra no claro; no escuro, fundo `--surface-float` um degrau mais claro |
| `Calendar` | ponto de hoje coral; dias de outro mês com `opacity .55` | ponto petrol, número em `--brand-soft-fg`; um degrau de tinta só |
| `FileUpload` | glifo dentro de círculo de 44px | glifo solto, 24px |
| Desabilitado (`--state-disabled-fg`) | `--text-subtle` — 2,49:1 sobre o fundo desabilitado | 50% entre muted e subtle — 3,40:1 |
| `CopyField` | "Copiado!" · "Nao foi possivel copiar" | "Copiado" · "Não foi possível copiar" |

### Adicionado

- **`--surface-float`** — camada que abre sobre um cartão. No claro é o próprio cartão; no
  escuro, onde sombra quase não aparece, é um degrau mais clara.
- **`npm run test:contrast`** — renderiza os 59 cards nos dois temas e mede cada texto contra
  a pilha real de fundos e opacidades. A cor é resolvida pelo canvas: `getComputedStyle`
  devolve `oklab()`/`color-mix()`, e um parser ingênuo inventa dezenas de reprovações.
- **Lint de token inexistente** em `adherence.eslint.mjs`: `var(--x)` em JSX que não existe
  em `tokens/*.css` reprova. Token local do produto entra pela opção `tokensLocais`.
- **`Banner variant="positive"`** — o nome do par semântico. `success` continua aceito como
  apelido, assim como `critical` para `danger`.

### Movimento

`--ease-exit` tinha zero consumidores e o DESIGN.md dizia "a saída é mais lenta que a
entrada" sem nenhum overlay fazer isso. Agora são 12 consumidores e a regra distingue:

- **O que some sozinho** (`Toast`, `Snackbar`, `LiveActivity`) sai em `--dur-slow` com
  `--ease-exit`. O timer de desmontagem subiu para 320ms, acima da saída.
- **O que a pessoa dispensa** (`Drawer`, `Sheet`, `ContextMenu`) sai no máximo no tempo da
  entrada — a saída responde ao gesto.

### Corrigido

- **Login (template) e `guidelines/brand-logo` no escuro:** título e nome da marca em
  `--sand-50`, que **inverte** no escuro — texto escuro sobre petrol, 1,3:1. Agora
  `--text-on-brand`.
- Moldura de 26 cards e guias (rótulos de seção) saiu do `--text-subtle`. É o exemplo que se
  copia.
- Admin: o estado vazio ainda tinha o ícone num tile de 64px. Glifo solto.
- `guidelines/theme-dark`: a razão ao lado de cada par tinha `opacity: .8`.

### Fiscalização

- **Regressão visual:** o card de overlays mobile agora abre com o `Snackbar` visível, com
  glifo — ele deixa de ser o único componente sem captura.
- `--ease-exit` saiu da lista de isenção do `audit:dead`.

### Ainda aberto

- `Card` e `StatCard` clicáveis são `<div role="button">`. Virar `<button>` quebra ação
  aninhada dentro do cartão — fica para a próxima major.
- `toast.success()` mantém o nome: é a convenção da API de toast, não o nome de uma variante.

---

## 2.1.0

Varredura **visual** do sistema inteiro — as 59 telas renderizadas, não o código. É o método
que a 2.0.1 ensinou: a barra lateral do `Banner` passou por grep e só apareceu vista na tela.

**Sem remoção de API.** Tem mudança visual ampla e **uma cor padrão trocada** — leia
"Confira suas telas".

### Confira suas telas

| Onde | Antes | Agora |
|---|---|---|
| **Todo contador de notificação** (`Indicator`, `TabBar`, `NavBar`, `SidebarNav`, `ChatLauncher`) | coral | petrol; claro sobre superfície de marca |
| `SidebarNav activeStyle="accent"` (padrão) | fundo + barra coral | só a barra fina + peso |
| `Toast` | barra de 4px na lateral | fio tingido em volta + glifo na cor do tom |
| `Snackbar` | `inset` de 4px na lateral | anel de luz de 2px + glifo na cor do tom |
| `LineChart` / `BarChart` | eixo `79 · 92.25 · 118.75`, ponto decimal, 2ª série coral | eixo `60 · 80 · 100`, vírgula decimal, 2ª série neutra |
| `DonutChart` | valor central em display 700 | mono; paleta sem coral |
| `ScoredScale` | total em display bold | mono |
| `Accordion`, `Drawer`, `PageHeader` | ícone dentro de quadrado preenchido | glifo solto |
| `ChatBubble` / `Chat` | avatar padrão = faísca | avatar padrão = caneta |
| `VoiceWaveform` (reprodução) | parte tocada em coral | petrol (coral só gravando) |
| `Slider` EVA "Intensa" | fundo do LIVE | fundo de perigo |

Quem precisa do coral num contador específico passa `tone="live"` — mas só se for gravação acontecendo.

### Adicionado

- **`Indicator tone="on-brand"`** — contador claro sobre superfície de marca.
- **`charts/scale.jsx`** — degraus de eixo redondos e formato de número pt-BR, compartilhados
  por `LineChart`, `BarChart` e `GaugeChart`. `formatValue` continua público.
- **Cobertura:** `Card accent` e as 15 combinações de categoria da `Tag` passaram a ter captura.

### Corrigido nos demos e templates

- **Landing (`ui_kits/templates`):** nomes de hospitais reais sob "Equipes clínicas que
  confiam", métricas sem fonte (−72%, 12 min, 100%) e um depoimento sem instituição viraram
  **lacunas tracejadas**. Template é copiado; texto plausível passa numa revisão, lacuna não.
  Saíram as duas sobrancelhas, a faísca, o grid de 4 cards com tiles de 4 cores e o degradê da
  faixa escura. "Recursos" e "Como funciona" diziam a mesma coisa e viraram uma seção.
- **Login (`ui_kits/templates`):** saíram três anéis coral pulsando ("ambient live pulse") —
  nada grava numa tela de login — e o degradê do painel. "Bem-vindo de volta" virou "Entrar".
- **Login do VoiceHealth:** saiu o corte diagonal em degradê; a citação do rodapé caía sobre a
  metade areia e ficava ilegível.
- **Admin:** saiu o tile por linha da tabela; os nomes de hospital pararam de truncar.
- **`guidelines/brand-products`:** tiles de 3 cores com traço em hex cravado (um deles no âmbar
  antigo, reprovado em AA) viraram glifo solto numa tinta.
- `Avatar` recebia `initials=`, prop que não existe, e desenhava "?".
- Nome e metadado colados na lista do demo mobile ("Maria S. Andrade312-A").
- "Olá!"/"Oi!" em 3 demos e 3 `.prompt.md`; "Online agora" no assistente.
- Title Case nos demos de áudio, "Primario"/"Secundario" sem acento, `+1.2%` com ponto.

### Fiscalização

- **Gerador do bundle:** o import de `./_scale.jsx` resolvia como um arquivo chamado `"e"` —
  a barra no regex era opcional. O ordenador exigia a barra; os dois discordavam sobre
  dependência. Corrigido, e módulo que exporta valor não usa mais o prefixo `_`.
- **Regressão visual:** duas rodadas completas seguidas, 118/118, desde a espera determinística.

### Ainda aberto

- O `Snackbar` continua sem captura na regressão: o card o monta fechado.
- `variant="success"` vs par `positive` — renomear quebra API; fica para a próxima major.
- `--state-disabled-fg` sobre `--state-disabled-bg` a 2,49:1 e `--ease-exit` sem consumidor,
  como na 2.0.0.

---

## 2.0.1

**`Banner` — a quarta aba lateral do sistema.** Escapou da auditoria porque eu
varri `components/` procurando `border-left` em cartão e chip, e o Banner declara
o dele junto com um `border` completo, na mesma regra. Apareceu quando foi vista
renderizada numa tela de produto.

Era o trio empilhado no mesmo elemento: fundo tingido + fio de 1px em volta +
`border-left: 4px solid`. Três mecanismos de ênfase, quando o certo é escolher
um. Ficaram o fundo e o fio — que agora dá a volta inteira e respeita o raio nos
quatro cantos.

Junto:

- **Os quatro `--*-border` semânticos finalmente têm consumidor.** O Banner
  escrevia `--emerald-500`, `--amber-500`, `--crimson-500` e `--petrol-500` à mão,
  e o mapeamento com `--positive-border`, `--warning-border`, `--danger-border` e
  `--info-border` é 1:1 exato — a migração não mexeu um pixel de cor. Isso
  corrige uma leitura errada da 2.0.0: esses tokens não eram "superfície de API
  sem consumidor no repo", eram tokens **contornados** pelo componente que existe
  justamente para consumi-los.
- **Saiu a opacidade como tom.** `__desc` usava `opacity: 0.92` e o botão de
  fechar `opacity: 0.7`. Opacidade entrega o controle da cor final para o que
  estiver atrás — a mesma falha que o `DESIGN.md` proíbe no hover. Agora é
  `color-mix` com o fundo do próprio banner, o que dá o mesmo degrau de suavidade
  em qualquer variante e nos dois temas.

Sem mudança de API. Quem usa `Banner` não precisa fazer nada além de conferir a
tela: o diff visual é de ~5% do card, todo ele na borda.

### Anotado, não corrigido

A variante se chama `success` e o par semântico se chama `positive` — o mesmo
papel com dois nomes, que é o tell de vocabulário aplicado à API. Renomear quebra
`variant`, e a 2.0.0 acabou de sair; fica para a próxima major.

---

## 2.0.0

Auditoria de slop no sistema inteiro. **Tem remoção de API pública** — leia a
seção de migração antes de subir.

O resumo em uma linha: o `DESIGN.md` descrevia um sistema mais decidido do que o
código implementava, e a fiscalização tinha furos exatamente onde o sistema mais
mexe.

---

### Migração — o que quebra e o que colocar no lugar

**Tokens removidos.** Um `var()` apontando para token que não existe não falha o
build: a declaração inteira é descartada e o elemento fica sem a propriedade. Por
isso vale rodar a busca antes de subir:

```bash
grep -rnE "\-\-(type-(hero|display|title|heading|subhead)|transition-(all|transform)|radius-2xl|sheet-peek|pad-row|gap-list|content-max-m|pad-section|cat-fill-bd)" src/
```

| Removido | Por quê | Use |
|---|---|---|
| `--type-hero` `--type-display` `--type-title` `--type-heading` `--type-subhead` | A `font` shorthand crava a entrelinha, e é ela que o componente precisa variar. Zero consumidores no repo; os 80 componentes reescreviam o shorthand | Empilhe à mão: `font: var(--weight-semibold) var(--text-2xl)/1.15 var(--font-display)`. Tracking **sempre** de `--tracking-*` |
| `--transition-all` | Embalava `transition: all`, que está na lista de "nunca" do `DESIGN.md` | `--transition-colors`, `--transition-shadow`, ou liste as propriedades |
| `--transition-transform` | Sem consumidor | `transform var(--dur-normal) var(--ease-standard)` |
| `--radius-2xl` (24px) | Arredonda controle, campo e cartão no mesmo blob. O teto de forma é `--radius-xl` | `--radius-xl` (16px) |
| `--sheet-peek` | De um design anterior: o `Sheet` usa detent fracionário há tempos | `detents={[0.3, 0.9]}` |
| `--pad-row` `--gap-list` `--content-max-m` `--pad-section` | Apelidos de um degrau da escala, nunca ligados | `--space-4`, `--space-2`, `100%`, `--space-7` |
| `--cat-fill-bd` | Abandonado na metade do desenho de categorias | `--border-default` |

**Tipo estreitado.**

```ts
- type StatAccent = "petrol" | "emerald" | "amber" | "coral" | "crimson"
+ type StatAccent = "petrol" | "emerald" | "amber" | "crimson"
```

`coral` é `--live`, reservado a processo com relógio correndo — e o valor de um
StatCard é sempre um número parado. Use `warning` para o que está apertando,
`danger` para o que estourou, ou nenhum sotaque.

**Mudança visual sem quebra de API** — confira suas telas:

| Componente | Antes | Agora |
|---|---|---|
| `Card accent` | borda esquerda de 3px em petrol | superfície tingida (`--surface-brand-soft`), sem fio |
| `Card interactive` | `translateY(-1px)` no hover; press só desfazia o lift | hover é borda + sombra; press é tinta própria e **funciona no toque** |
| `Tag treatment="neutral"` | filete lateral por família | ponto de 6px; caiu o `padding-left` compensatório |
| `LiveActivity` | fio lateral `inset 3px` | anel `--shadow-live` em volta da pílula |
| `FileUpload` / `InsertDivider` / `ActionSheet` / `ContextMenu` desabilitados | `opacity: 0.5` | `--state-disabled-fg` |

---

### Adicionado

- **`--state-brand-hover` / `--state-brand-press`** — a terceira camada de estado
  do sistema, que estava sem nome. `--state-*` é tinta de areia (caminho neutro),
  `--veil-*` é luz (sobre superfície de marca); faltava o caso do meio: fundo
  neutro, interação que **pertence** ao caminho de marca. Estava escrito como
  `--petrol-50`/`--petrol-100` cravados em 14 componentes, sempre no mesmo par.
- **`npm run audit:dead`** — todo token declarado tem consumidor ou isenção com o
  motivo escrito. Token órfão com nome plausível não é peso morto: é uma
  *sugestão*, e o próximo agente escreve `var(--radius-2xl)` achando que é
  doutrina.
- **`--live-tone`** — o tom corrente do estado LIVE, lido pelo anel e pelo pulso.

### Corrigido

- **`--shadow-live` estava desligado.** O `DESIGN.md` o chama de "impressão
  digital do sistema" e ele tinha zero consumidores. Agora é o anel do
  `LiveActivity`.
- **Press em `Tabs`, `FileUpload`, `DateRangePicker` e `InsertDivider`**, que não
  tinham nenhum.
- **`hv-pulse-live` e `--shadow-focus-live`** deixaram de cravar
  `rgba(232,103,74)` e derivam de `--live-tone`. O pulso do `LiveActivity` em
  `tone="brand"` agora pulsa petrol, não coral por engano.
- **Tracking:** 25 valores cravados, oito distintos para uma escala de cinco,
  migrados para `--tracking-*`.
- **`Tag` com família:** o glifo era `--petrol-500` fixo, então o ícone de uma tag
  `crimson` saía verde.
- **`prefers-reduced-motion`** em `guidelines/motion.html` (a página que *ensina* a
  doutrina de movimento era a que não a respeitava) e nas três animações de
  `RecordScreen`, que são `style` inline e precisam ler a preferência em JS.

### Fiscalização

- **`audit-token-refs`** lia o sujeito do seletor errado: em
  `.hv-tab:hover:not(.hv-tab--active)` contava a classe que o `:not()` **exclui**,
  e o filtro `!base.includes("--")` dispensava todo modificador em vez de olhar a
  raiz. 19 seletores fora da conta, 8 sem press.
- **`test:visual` era cego para a mudança típica deste sistema.** São dois gates e
  só um estava documentado: `--limiar` é a *proporção* de pixels, o `threshold` do
  pixelmatch é o quanto a *cor* muda. O segundo, em `0.15`, engolia o primeiro —
  medido, a troca do fio pelo anel muda ~2.900 px e ele contava **108**. Agora em
  `0.05`, ajustável por `--sensibilidade`.
- **Espera determinística** no snapshot: era `waitForTimeout(1200)` fixo, que
  deixava de bastar numa rodada de 118 capturas e produzia flake raspando o
  limiar. Agora espera árvore montada + duas janelas de 100ms sem mutação de DOM.
- O relatório de px cru separou **ritmo** (`gap`/`margin`, para zerar) de
  **contrato** (`padding` interno, para declarar com `@escala-livre`). Somados
  eram 243 avisos que ninguém abria.

### Ainda aberto

Registrado aqui porque medi e não consertei:

- **`--state-disabled-fg` sobre `--state-disabled-bg` dá 2,49:1**, o pior par do
  sistema, num produto que roda de madrugada. Apontá-lo para `--text-muted`
  levaria a ~4:1, ao custo de desabilitado parecer texto secundário. Decisão de
  produto.
- **`--ease-exit` continua sem consumidor.** O `DESIGN.md` promete "a saída é mais
  lenta que a entrada" e os ~8 overlays usam uma transição só para as duas
  direções.
- **`Card` e `StatCard` interativos ainda são `<div role="button">`.**
- **As checagens do repo param na fronteira de `components/` e `tokens/`.** Foi
  assim que o `--type-caption` quase foi removido (17 usos em `ui_kits/`) e que
  duas páginas ficaram sem guarda de movimento. Só o `audit:dead` varre tudo.

---

## 1.35.0 e anteriores

Ver o histórico do git.
