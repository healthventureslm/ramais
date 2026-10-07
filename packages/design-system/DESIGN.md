# DESIGN.md

Folha de consulta para quem **escreve código** neste repositório — humano ou agente.
Leia isto antes de escrever a primeira linha de CSS.

Não substitui o [`readme.md`](readme.md), que é o guia de marca completo (contexto de empresa,
produtos, tom de voz, iconografia). Este arquivo é a versão curta e imperativa: as regras que
um agente quebra por omissão quando busca "o padrão mais comum do código" em vez da decisão
que alguém tomou.

---

## 01 · Visão geral

**Produto:** design system da Health Ventures — uma venture builder de saúde brasileira,
operator-first, e seus produtos clínicos (VoiceHealth/VoxFlow Enfermagem, Leito Liberado,
Campainha).

**Público:** enfermeiro e médico em plantão, já sob pressão, muitas vezes na décima segunda
hora de turno, muitas vezes de madrugada. A interface é um instrumento, não um destino.

**Modo dominante:** **operar.** Telas densas de trabalho. Há uma faixa de marketing, e só ali
os degraus grandes da escala se justificam.

**Personalidade visual:** calmo · clínico · competente · humano · engenheirado.

**Anti-referências** — o que este sistema **nunca** pode parecer:

1. Healthtech de azul frio. Sem azul, sem roxo. É a armadilha genérica que a paleta evita de propósito.
2. Gradiente como decoração. Gradiente só quando ele **é** o dado (a trilha da escala de dor no Slider).
3. App que comemora. Sem emoji, sem exclamação, sem "Ops!", sem confete.
4. A marca AI-generated anterior. Este sistema existe para substituí-la — toda decisão visual aqui é original.
5. Dashboard de SaaS. Nada de tile com pastilha pastel, número gigante e seta verde de porcentagem.

**Elemento assinatura:** o **estado LIVE** — `--live` coral, o `hv-pulse-live` e o `VoiceWaveform`.
É a marca de "algo acontecendo AGORA": captura de áudio correndo, leito em higienização,
chamado aberto. É a única coisa no sistema que tem permissão de pulsar.

> **Regra de contenção.** A ousadia mora no elemento assinatura. Tudo em volta fica quieto.
> Se dois elementos da tela estão competindo por atenção, um deles está errado.

---

## 02 · Cores

Tokens em [`tokens/colors.css`](tokens/colors.css). **Sempre referencie o alias semântico, nunca o degrau da rampa.**

| Papel | Token | Uso |
|---|---|---|
| Canvas | `--surface-canvas` | Fundo de aplicação (areia quente, não branco) |
| Cartão | `--surface-card` | Cards, folhas, superfícies de conteúdo |
| Flutuante | `--surface-float` | Popover, menu, tooltip de gráfico, painel de chat — o que abre **sobre** um cartão |
| Afundado | `--surface-sunken` | Poços, trilhos, cabeçalho de tabela |
| Marca | `--surface-brand` | Sidebar, chrome de marca |
| Texto | `--text-strong` · `--text-body` · `--text-muted` · `--text-subtle` | Quatro níveis, nesta ordem. `--text-subtle` **não** passa AA (3,1:1) |
| Ação | `--action-primary` / `-hover` / `-press` / `-text` | Ação primária |
| Limite de controle | `--border-control` / `-hover` | Contorno de campo e de botão secundário |
| Estrutura | `--border-subtle` / `-default` / `-strong` | Divisórias, guias, trilhos |
| Semântica | `--positive-*` `--warning-*` `--danger-*` `--info-*` | Pares fg/bg + `-border` `-hover` `-subtle` |
| Assinatura | `--live` · `--live-strong` · `--live-bg` | Processo em andamento AGORA |
| Véu | `--veil-line` · `--veil-hover` · `--veil-fill` · `--veil-press` · `--veil-edge` · `--veil-fg-off` · `--veil-brand` | Luz **sobre superfície de marca**, onde tinta não aparece |

**Regras**

- **Um acento só.** A ação secundária é a ausência de cor, não outra cor.
- **`--text-subtle` é para o que ninguém precisa ler.** Mede 3,1:1 no claro e 3,7:1 no escuro.
  Serve para placeholder (o rótulo carrega a informação), separador decorativo com
  `aria-hidden` e o "+" de uma régua. Rótulo de grupo, descrição de passo, tamanho de arquivo,
  marca de escala, contador: tudo isso é lido, e vai em `--text-muted` (5,9:1 no cartão, 4,8:1
  sobre `--surface-sunken`). Até a 2.1.0 onze componentes e a moldura de 26 cards usavam o
  subtle para texto de verdade — o `test:contrast` achou todos.
- **`--live` é reservado.** Só para processo em andamento com relógio correndo. Estado parado
  (concluído, com erro, pendente sem cronômetro) vai em `positive` / `danger` / `warning`.
  Os lugares onde ele vazou até a 2.1.0, para você reconhecer o padrão: contador de não lidos
  (era o padrão do `Indicator`), série de gráfico (era a 2ª cor das paletas), parte já tocada
  de um áudio gravado, faixa "intensa" da escala de dor, e anéis decorativos numa tela de login.
  Nenhum desses tem relógio correndo.
- **Cor literal fora dos tokens é bug.** Sem hex, sem `rgba()`. Precisa de branco que não
  inverte no escuro? É `--white`. Glifo sobre preenchimento de sotaque? É `--text-on-accent`.
  Texto sobre a ação primária? É `--action-primary-text` — que no escuro **não** é branco.
- **Sobre superfície de marca, o instrumento é luz, não tinta.** `--state-hover`/`--state-press`
  são tinta de areia e somem sobre petrol-900. Lá use `--veil-*`. Esses tokens **não** têm
  override no escuro de propósito: a superfície de marca é petrol-900 nos dois temas, então
  a luz por cima dela não muda. Véu que invertesse por tema estaria assumindo um fundo que
  nunca existiu.
- **Nunca use `--danger-bg` como cor de fundo de botão.** Ela é a tinta de faixa. Botão
  destrutivo é `--action-danger`.
- **Categorização não é semântica.** Onze categorias clínicas não viram onze matizes: use o
  eixo duplo `--cat-*` (família × tratamento). Um chip de "Medicações" em `--danger-bg` lê como alerta.
- O tema escuro funciona **redefinindo as rampas por papel**. Se você usou o token do papel
  certo, o escuro já funciona e você não precisa escrever nada. Se precisou de um override
  em `theme-dark.css`, quase sempre o token do claro estava errado.

---

## 03 · Tipografia

Tokens em [`tokens/typography.css`](tokens/typography.css).

| Papel | Face | Uso |
|---|---|---|
| Display | Schibsted Grotesk (`--font-display`) | Títulos, com contenção. Tracking apertado em tamanho grande. |
| Corpo | IBM Plex Sans (`--font-sans`) | Toda a UI, todo o texto de leitura |
| Dado | IBM Plex Mono (`--font-mono`) | **Obrigatório** para sinal vital, código, MRN, timestamp, transcrição, e o valor de um StatCard |

**Escala:** `--text-2xs` (11px) a `--text-6xl` (68px), razão ~1.2. Corpo em app: 14–15px.
**11px é o piso** — não existe degrau abaixo, e isso é decisão. Precisou de menos? O problema
é densidade de informação, não tamanho de fonte.

**Regras**

- **Os atalhos de papel são quatro, e só quatro:** `--type-body`, `--type-body-sm`,
  `--type-caption`, `--type-mono`. Existiam nove. Os cinco de título — hero, display, title,
  heading, subhead — foram removidos por terem **zero** consumidores, e o motivo importa: a
  `font` shorthand funde cinco decisões num token e a que o componente precisa variar é a
  entrelinha. Com `--text-xl` os componentes escrevem `/1.2`, `/1.25` e `/var(--leading-snug)`
  conforme o contexto. Título vai empilhado à mão mesmo; o que **não** vai à mão é tracking.
- **Mono significa "isto é dado, não prosa".** Número que a pessoa vai comparar, conferir ou
  ditar vai em mono. Isso não é estética, é leitura.
- **Sentence case em tudo** — botões, menus, títulos, cabeçalho de tabela. Nunca Title Case.
- Caixa alta **só** em rótulo curto tracked-out (`.hv-overline`, `--tracking-wider`) e em
  sigla clínica (UTI, PA, FC, SpO₂).
- Tracking tem **cinco** tokens — `--tracking-tight` · `-snug` · `-normal` · `-wide` · `-wider` —
  e nenhum valor escrito à mão. Havia 25 call sites com valor cravado e **oito** valores
  distintos, cinco deles sem degrau na escala (`.1em`, `.08em`, `.06em`, `.01em`, `-0.005em`).
  Todos migraram. Se o valor que você quer não está na escala, o valor está errado, não a escala.

---

## 04 · Elevação, forma, espaço e movimento

**Radius:** `--radius-md: 9px` é o raio de controle. **Nove, não oito** — o 8px é a posição
neutra de fábrica e este sistema não mora nela. Cards em `--radius-lg` (12px), folhas em
`--radius-xl`. No mobile o raio de toque é `--radius-tap` (14px). Escreva o token, nunca o número.

**Sombras:** tintas de **petrol**, nunca preto. Cinco degraus em [`tokens/elevation.css`](tokens/elevation.css).

- Nunca combine fio de 1px com sombra larga no mesmo elemento. Camada flutuante (popover,
  menu, tooltip) separa por **sombra no claro e por luz no escuro**: fundo `--surface-float`,
  que no claro é o próprio cartão e no escuro é um degrau mais clara. Sem fio. A exceção é o
  `Toast`, onde o fio tingido **é** o portador do tom, não uma borda de separação.
- Nunca aninhe cards.
- O anel de foco **não anima** — anel que faz fade desorienta quem navega por teclado.
- O anel segue a **natureza da ação**, não a marca: `--shadow-focus-danger` em destrutivo,
  `--shadow-focus-on-brand` sobre superfície de marca. Anel verde em volta de botão vermelho
  é a única peça da tela dizendo "siga em frente" no controle que apaga.

**Espaçamento:** grade de 4px, `--space-1` a `--space-12`.

> **Regra do ritmo.** Apertado **dentro** do bloco, generoso **entre** blocos. Se todos os
> respiros da tela são iguais, ninguém decidiu o que pertence a quê — e é assim que uma tela
> parece gerada mesmo quando cada componente está certo.

**Ritmo e contrato são duas coisas, e a escala só governa uma.**

| | o que é | regra |
|---|---|---|
| **Ritmo** — `gap`, `margin` | espaço **entre** elementos | a escala. Fora dela é dívida, e o número é para zerar |
| **Contrato** — `padding` interno | medida que o controle precisa casar com os irmãos | não é grade. Declare com `@escala-livre: <motivo>` |

Isso não é tolerância: é o que o dado mostrou. Dos 243 px crus originais, **44% eram ímpares**
(5, 9, 11, 3, 7) e só 7% caíam na grade de 4px. Não há uma "grade de 2px escondida" — dentro
do controle não há grade nenhuma, e não deveria haver. O `padding: 5px 10px 5px 12px` do
MultiSelect é a compensação que o faz bater com o `0 12px` do Input em 13,0px de início de
conteúdo e 40px de altura; arredondar quebra os dois.

`npm run audit:refs` reporta os dois separados — `AVISO (ritmo)` e `NOTA (contrato)`. Somados
eram 243 avisos que ninguém abria.
- `--nudge-1/2/3` existe **só** para alinhar glifo com texto. Se você precisa de 2px de
  respiro entre dois elementos, o respiro está errado, não a escala.

**Movimento:** [`tokens/motion.css`](tokens/motion.css). Cinco durações, quatro curvas.

- Curva padrão `--ease-standard`; `--ease-entrance` para o que chega, `--ease-exit` para o que sai.
- **Nunca bounce, nunca elastic.** Contexto clínico.
- **Nunca anime `width`, `height`, `padding` ou `margin`** — exceto barra de progresso, onde a
  largura *é* o dado.
- **Nunca `transition: all`.**
- **Saída depende de quem fecha.** Até a 2.2.0 esta linha dizia só "a saída é mais lenta que a
  entrada" — e nenhum overlay fazia isso (`--ease-exit` tinha zero consumidores). Aplicada ao pé
  da letra, ela deixaria um menu dispensado pela pessoa com cara de travado. A regra agora é:
  - **Estado** (hover, press, tinta de fundo): acende rápido, apaga devagar.
  - **O que some sozinho** (`Toast`, `Snackbar`, `LiveActivity`): sai **mais devagar** que entra
    (`--dur-slow` + `--ease-exit`). Ninguém pediu para sumir; apagar devagar é o que dá a sensação
    de material.
  - **O que a pessoa dispensa** (`Drawer`, `Sheet`, `ContextMenu`): sai **no máximo** no tempo da
    entrada, com `--ease-exit`. A saída responde ao gesto.
  - Nada sai com `--ease-spring`: mola passa do ponto, e o elemento quicaria enquanto some.
  - O timer que desmonta o componente em JS tem de ser **maior** que a duração da saída, ou a
    animação é cortada. Hoje é 320ms para `--dur-slow` (280ms).
- **O press zera a transição** (`transition-duration: 0s`). Press com fade parece travado.
- Toda duração sai de `--dur-*`, porque `prefers-reduced-motion` zera esses tokens na raiz.
  Um valor em ms escrito à mão fura a preferência de quem pediu menos movimento.

**Token assinatura:** `--shadow-live` + `hv-pulse-live`. Nenhum kit traz isso. É a impressão digital.

---

## 05 · Componentes

Documente aqui só onde este sistema **decidiu diferente** do óbvio.

### Contrato de estados — vale para todo componente interativo

`default` · `hover` · **`pressed`** · `focus-visible` · `disabled`

- **`pressed` não é opcional.** É o estado que mais falta em código gerado, e é o único
  retorno que existe no toque, onde não há hover antecedendo o clique.
- **O press é sempre um degrau mais fundo que o hover, na mesma rampa.**
  `--petrol-50` → `--petrol-100` · `--state-hover` → `--state-press` → `--state-press-deep` ·
  `--action-primary-hover` → `--action-primary-press`.
- **Hover nunca é feito com `opacity`.** Opacidade mistura a cor com o que está atrás e você
  perde o controle da cor final. Mexa no tom.
- **Disabled nunca é `opacity: 0.5` num controle cujas cores o DS controla.** Use
  `--state-disabled-bg/-fg/-bd`. A opacidade (`--opacity-disabled`) fica para quando o
  conteúdo é do produto e não dá para reescrever cor por cor — item de Menu, linha de
  ListItem, Slider, Switch, Tag.

  **O motivo é previsibilidade, não contraste** — e isto foi medido, porque a versão
  anterior deste arquivo afirmava o contrário. No claro, sobre `--surface-card`:

  | | mede |
  |---|---|
  | `--state-disabled-fg` (`#8A958F`) | **3,10:1**, sempre, qualquer que seja o texto |
  | `opacity: 0.5` partindo de `--text-strong` | 3,28:1 |
  | `opacity: 0.5` partindo de `--text-muted` | 2,74:1 |
  | `opacity: 0.5` num subtítulo já apagado | **1,97:1** |
  | teto teórico de qualquer `opacity: 0.5` | 3,98:1 (preto puro) |

  Ou seja: o par desenhado **não** ganha em contraste — às vezes perde. O que ele dá é um
  resultado que não depende da cor de partida. Com opacidade, o mesmo papel visual sai
  entre 1,97 e 3,28 conforme o token de onde o texto partiu, e ninguém consegue prever
  qual. Nenhum dos dois alcança 4,5, e **não precisa**: a WCAG 1.4.3 isenta explicitamente
  componente inativo.

  **Decidido na 2.2.0.** `--state-disabled-fg` era `--text-subtle`, e sobre
  `--state-disabled-bg` (`--surface-sunken`) dava **2,49:1** — o pior par do sistema, num
  produto que roda de madrugada. Ir direto para `--text-muted` deixaria desabilitado idêntico a
  texto secundário. Ficou no meio: `color-mix` 50% entre muted e subtle. Mede **3,40:1** sobre
  o fundo desabilitado e 4,22:1 sobre cartão no claro; 5,4:1 no escuro. Lê, e continua
  visivelmente um degrau abaixo do texto secundário.
- **Elemento clicável é `<button>` ou `<a>`.** `<div>` com `cursor: pointer` é clicável no
  mouse e inexistente no teclado.

### Button
- **Variantes:** primary · secondary · ghost · quiet · danger.
- **Divergências:** tempo por estado (entrada rápida, saída lenta, press instantâneo);
  `scale(0.97)` no press **só** em `pointer: coarse`; `sm`/`md` crescem para `--tap-min` no
  toque; `busy` ≠ `disabled` — ocupado mantém a própria cor, porque a ação foi aceita e está correndo.

### Card
- **Divergências:** `accent` é **superfície** (`--surface-brand-soft`), não borda lateral —
  fio colorido numa aresta é o tell mais reconhecível de card gerado, e a aresta reta briga
  com o raio. Hover é degrau de borda + sombra, **sem `translateY`**. Press é tinta própria,
  não o desfazer de um lift: sem mouse não há hover, e o press existe justamente para o dedo.

### StatCard
- **Divergências:** o valor vai em **mono**, não em display — é dado clínico. O sotaque vive
  na tinta do glifo, nunca numa pastilha pastel de fundo. **Sem `translateY` no hover.**
- **Não existe `accent="coral"`.** Coral é `--live`, e `--live` é reservado a processo com
  relógio correndo — o valor de um StatCard é sempre um número parado. Cada número estático
  tingido de coral cobra um pouco do significado que a pílula LIVE precisa ter.

### Tag
- **Divergências:** no tratamento `neutral` a família é um **ponto**, não um filete na aresta.
  Os três tratamentos carregam a família por mecanismos diferentes — `filled` tinge o fundo,
  `outline` tinge a borda, `neutral` marca com cor pontual — em vez de três intensidades da
  mesma ideia. O glifo do `__lead` segue a família, não a marca.

### Toast e Snackbar
- **Divergências:** o tom **não** vai numa barra na lateral. O dispositivo segue a superfície:
  o `Toast` (claro) tinge o fio em volta e o glifo; o `Snackbar` (inverso, escuro) usa um anel
  de luz e o glifo. Tinta sobre claro, luz sobre escuro — a mesma lógica de `--state-*` e `--veil-*`.

### Indicator
- **Divergências:** o padrão é `brand`, não coral. Contagem de não lidos é estado parado.
  Sobre superfície de marca use `tone="on-brand"` (TabBar e NavBar fazem isso sozinhas na
  variante `brand`). `tone="live"` só para gravação em andamento.

### Gráficos
- **Divergências:** o eixo usa degraus redondos (`charts/scale.jsx`), nunca interpolação entre
  o menor e o maior dado — pressão arterial não tem quarto de mmHg. O número sai com **vírgula
  decimal** por padrão. O valor central do donut é **mono**. A paleta de séries não tem coral,
  e a 2ª série é neutra (`--ink-500`).

### Accordion, Drawer e PageHeader
- **Divergências:** o ícone é **glifo solto**, no tamanho do título, nunca um quadrado
  preenchido com o glifo dentro. É a mesma regra do `EmptyState` e do `StatCard`.

### Chat
- **Divergências:** o avatar padrão do assistente é uma caneta, não a faísca de "IA". O assistente
  não fica "online" e não cumprimenta com exclamação — ele rascunha.

### LiveActivity
- **Divergências:** o tom vive no **anel** (`--shadow-live`) e no pulso, nunca num fio lateral:
  sobre `--radius-pill` um `inset 3px` é recortado pelo canto e vira uma lasca em meia-lua.
  `--live-tone` alimenta os dois — um tom, dois lugares.

### RecordingDock
- **Quando:** captura que continua fora da tela onde começou e tem um **depois** — envio,
  transcrição, falha com áudio guardado. Processo com relógio e sem depois é `LiveActivity`.
- **Divergências:** montado **acima das rotas** e nunca na própria tela da captura. O tom
  vive no anel: `--shadow-live` gravando, anel de perigo quando o envio falhou — fundo
  neutro, porque a peça pode ficar minutos sobre qualquer conteúdo. `failed` é o estado que
  justifica o componente: quem saiu da tela precisa saber que há áudio por reenviar.

### TopNav
- **Barra ou coluna:** até ~6 destinos de primeiro nível, sem seção nem grupo, é barra — a
  `SidebarNav` cobra ~264px de largura permanente que tabela e prontuário aproveitariam.
- **Divergências:** responde à **própria** largura (container query), não à da janela. Some
  primeiro o nome do usuário, depois os rótulos (ficam os ícones), por último o nome da
  marca — nunca vira gaveta, que cobraria um toque a mais em toda navegação. Item ativo é
  camada (véu sobre marca, tingido da marca sobre claro), como a `SidebarNav activeStyle="pill"`.

### CopySection
- **Divergências:** um copiar **por seção**, e o texto copiado é montado do que está na tela
  com o comentário do profissional **rotulado** — quem cola distingue a leitura humana da
  saída do modelo. Sem cor por seção escolhida pelo título; alteração é marcada na **linha**
  de resultado, com seta e palavra além da tinta. Título em caixa normal, sem ícone em quadrado.

### EmptyState
- **Divergências:** alinhado à **esquerda** por padrão (`align="center"` é opt-in). Sem
  círculo com ícone dentro — o glifo é do tamanho do texto. O slot do ícone tem altura fixa
  de propósito: é o que faz `loading` e vazio terem a mesma altura e a lista não saltar.

### Tabela e listas densas
- `<th>` ordenável é `<button>` de verdade, com foco e press.
- Dado numérico em coluna vai em mono, alinhado à direita.

### Composição
- Frame fixo: sidebar 264px (72px colapsada), header 60px, conteúdo `--content-max` (1240px),
  leitura `--reading-max` (68ch).
- Um `PageHeader` por página. Ação primária à direita do título, nunca solta no corpo.
- Vazio, carregando e erro são **a mesma caixa** em três estados. Mantenha a estrutura para a
  tela não saltar quando o dado chega.

---

## 06 · Do's & Don'ts

**Sempre**

- Token de papel semântico, não degrau de rampa, não literal.
- `pressed` em tudo que é clicável.
- Mono em dado clínico.
- Sentence case, PT-BR, `você`, imperativo e neutro.
- Vírgula decimal (`36,5 °C`), 24 h (`14:32`), unidade colada ao valor.
- Rodar `npm run test:tokens-only` antes de abrir PR.

**Nunca**

- Azul, roxo, gradiente decorativo.
- Emoji em UI de produto. Em nenhum lugar. Nem em marketing.
- Copy que comemora, se desculpa ou promete que a IA acerta sempre.
- `transition: all`, bounce, `translateY` no hover de card ou de botão.
- **Barra colorida na lateral** de cartão, faixa, chip, toast ou snackbar. Apareceu seis vezes
  no sistema, escrita de três jeitos (`border-left`, `box-shadow: inset`, `::before` absoluto),
  e é por isso que nenhum grep isolado a encontra. Tom vai em fundo, fio, anel ou glifo.
- **Quadrado preenchido com ícone dentro** ("icon tile") ao lado ou acima de título.
- **Sobrancelha em caixa alta acima do título** repetindo o que o título já diz.
- **Prova social inventada em template:** nome de instituição real, métrica sem fonte,
  depoimento sem procedência. Em `ui_kits/` isso é lacuna tracejada, porque template é copiado.
- Hex ou `rgba()` cru; px cru em espaçamento; duração em ms cravada.
- Implicar que o sistema decide ou diagnostica. **A IA rascunha, a pessoa revisa e assina.**

**Regras nomeadas** — cite pelo nome em code review

| Nome | Regra |
|---|---|
| **Regra do papel** | Use o alias semântico. Se você escreveu um degrau de rampa, pergunte que papel ele cumpre. |
| **Regra do press** | Um degrau mais fundo que o hover, na mesma rampa, com `transition-duration: 0s`. |
| **Regra do ritmo** | Apertado dentro do bloco, generoso entre blocos. Respiro igual em tudo é ausência de decisão. |
| **Regra do mono** | Número que se compara, confere ou dita vai em mono. |
| **Regra da contenção** | A ousadia mora no LIVE. O resto fica quieto. |
| **Regra do nove** | O raio de controle é 9px. Oito é o default de fábrica; não voltamos para ele. |
| **Regra do fallback** | `var(--x, algo)` só quando `--x` vem de fora do DS. Dentro do DS, fallback esconde nome errado. |

---

## 07 · Como isto é fiscalizado

`npm run test:tokens-only` roda a suíte inteira. Os que importam para este arquivo:

| Script | Garante |
|---|---|
| `audit:refs` | **Reprova:** todo `var(--x)` aponta para um token que existe; nenhum hex cravado (no CSS **e** no `style` inline); `:hover` sem `:active` ou isenção declarada. **Avisa:** ritmo em px cru. **Nota:** padding em px cru. |
| `audit:dead` | A direção contrária: todo token declarado tem consumidor, ou isenção com o motivo escrito. Token órfão com nome plausível não é peso morto — é uma **sugestão**, e o próximo agente escreve `var(--radius-2xl)` achando que é doutrina. |
| `audit:roles` | Rampas no papel certo e blocos do tema escuro em sincronia. |
| `audit:copy` | Cópia entra por prop; nenhum componente preso a um produto. |
| `audit:css` | Nenhuma colisão de CSS auto-injetado entre componentes. |
| `audit:props` | Toda prop desestruturada tem tipo. |
| `test:contrast` | **Contraste medido renderizado**, não por tabela de pares: 59 cards × 2 temas, cada texto contra a pilha real de fundos e opacidades acima dele. Isenta desabilitado (WCAG 1.4.3) e `aria-hidden`. É relatório, não reprova — as exceções conhecidas estão no cabeçalho do script. |
| `test:visual` | **O que aparece na tela.** 59 cards × claro/escuro contra a baseline versionada. Comando separado, não entra em `test:tokens-only` — leva ~3 min. |

> **Dois gates, não um.** `--limiar` (0,1%) é a *proporção* de pixels tolerada; o
> `threshold` do pixelmatch é o quanto a *cor* de um pixel precisa mudar para contar. O
> segundo estava em `0.15` e engolia o primeiro: medido, a troca do fio lateral do
> LiveActivity pelo anel muda ~2.900 px e o pixelmatch contava **108**. A suíte via bem o que
> ninguém erra e era cega justo para a mudança típica deste sistema — areia sobre areia,
> sombra de petrol a 6%, anel a 18% de alfa. Hoje está em `0.05`, ajustável por
> `--sensibilidade`. Se você abaixar isso de novo, saiba o que está desligando.

**Duas listas de isenção, e as duas são para ler.** `SEM_PRESS_OK` no script lista os papéis
que legitimamente não têm press (campo de texto, glifo que reage ao hover do pai, marcador
decorativo), cada um com o motivo. E qualquer linha marcada com `@escala-livre: <motivo>` sai
da conta de px.

Essa segunda existe porque **o número de px cru não é "quanto falta migrar"**. Input, Select,
Combobox, MultiSelect e DatePicker terminam todos com o conteúdo começando em **13,0px** e
altura de **40px** — e chegam lá por paddings *diferentes*, porque cada um carrega estrutura
interna diferente. O `padding: 5px 10px 5px 12px` do MultiSelect não é desleixo: é a
compensação que o faz bater com o `0 12px` do Input. Arredondar para a escala quebraria os
dois de uma vez, e existe playground medindo isso em
[`tests/forms-playground.html`](tests/forms-playground.html).

Regra: se o valor está preso a um contrato que a escala não expressa, **declare** com
`@escala-livre` e o motivo. O que sobra na conta é dívida de verdade.

O que **ainda não é fiscalizado** e depende de você: caixa do texto (sentence case).

**Nos produtos, token inexistente reprova no lint.** `adherence.eslint.mjs` lê `tokens/*.css`
e marca qualquer `var(--x)` em JSX que não seja token do DS. Token local do produto entra por
`tokensLocais`; `var(--x, fallback)`, `--_privado` e `--hv-*` passam.

### Nos produtos

As regras acima valem para o DS. Os produtos herdam as suas por
[`adherence.eslint.mjs`](adherence.eslint.mjs) — 62 regras: hex, `rgba()`, espaço em px fora
da escala, raio em px, `transition: all`, duração em ms cravada, import de interno de
componente, e prop/variant inexistente por componente.

```js
// eslint.config.mjs do produto
import aderenciaHV from "@healthventureslm/design-system/adherence.eslint.mjs";
export default [...aderenciaHV];
```

> **Por que ESLint e não oxlint.** O `_adherence.oxlintrc.json` continua sendo a fonte — é
> ele que `fix-adherence-props.mjs` gera e mantém em dia — mas ele nunca rodou. Verificado
> contra o oxlint 1.80: a chave `x-omelette` faz o arquivo nem ser aceito, e mesmo sem ela o
> oxlint não implementa `no-restricted-syntax`, que é o veículo de 61 das 62 regras. Os
> seletores estão escritos em esquery, o dialeto do ESLint, e é lá que eles funcionam.
