# Design do Ramais

O Ramais usa o **design system da Health Ventures** (`@healthventureslm/design-system`): os componentes, os tokens, o contrato de estados e as regras são dele. O Ramais só põe **a própria marca** por cima, trocando as rampas de cor.

- **Onde está:** a cópia versionada fica em `packages/design-system`, trazida de `Desktop/Health/DesignSystem` por `node tools/sincronizar-ds.mjs`. Não edite a cópia; mude no DS e sincronize.
- **Regras:** as do DS valem inteiras, em `packages/design-system/DESIGN.md`. Este arquivo só registra o que é do Ramais.

## Como uma tela é montada

- **Componentes do DS para tudo:** botão, campo, lista, cartão, tabela, abas, diálogo, gaveta, chat, navegação, aviso, gráfico. Se existe no DS, não se escreve à mão. A fiscalização acusa `<button>`, `<input>`, `<select>`, `<textarea>` e `<table>` crus.
- **Ícones:** `lucide-react`, passados como elemento (`iconLeft={<Plus />}`), como no DS.
- **Fontes:** as do DS, empacotadas no app (sem Google Fonts):
  - **Schibsted Grotesk:** títulos.
  - **IBM Plex Sans:** texto.
  - **IBM Plex Mono:** dados (tempo de espera, hora, contagem, PIN).
- **Moldura no computador:** `TopNav` com Atendimentos, Painel, Mensagens, Jornada e Administração. O menu da conta reúne turno, unidade, Minha conta e Sair.
- **Moldura no celular:**
  - `TabBar` embaixo com Atendimentos, Painel, Mensagens e Mais.
  - "Mais" abre um `ActionSheet`.
  - A lista de atendimentos tem `NavBar` com o botão de turno.
  - Dentro de uma conversa, a `TabBar` sai.
- **Páginas:** `PageHeader` + conteúdo dentro de `.pagina`, a cola de layout em `apps/web/src/estilo/layout.css`.

| Tela | Componentes |
|---|---|
| Atendimentos | `Tabs`, `ListGroup`/`ListItem`, `Banner` (fora do turno), `ChatBubble`, `SegmentedControl` + `Textarea` (resposta ou nota interna), `Card` (detalhes), `Dialog` (transferir, apoio, quarto), `Drawer` (detalhes em tela estreita) |
| Pedido tocando | `LiveActivity`, o "ao vivo" do DS e a única peça que pulsa |
| Painel | `PageHeader`, `StatCard`, `Table`, `ListGroup` |
| Mensagens | `ListItem` + `Avatar`, `ChatBubble`, `Switch` (urgente) |
| Avisos | `toast` (`ToastProvider`) |
| Confirmações | `useConfirm`, nunca `window.confirm` |

## O que é do Ramais

**A marca: a libré do hotel.** As cores vêm do uniforme do mensageiro: paletó azul-marinho e botões de latão. Ficam em `apps/web/src/estilo/tema-ramais.css`, que troca as rampas do DS nos dois temas:

| Rampa do DS | Vira | Papel |
|---|---|---|
| `petrol` | libré (azul-marinho) | ação, navegação, marca |
| `coral` | latão | ao vivo: pedido tocando, relógio correndo |
| `sand` | linho | superfícies, um neutro sem o amarelo do creme |
| `ink` | grafite | texto e estrutura |

`emerald`, `amber` e `crimson` (positivo, aviso, perigo) ficam como no DS. Também trocam os poucos literais com tinta verde: sombras, anel de foco, véu, vidro e o cartão do tema escuro.

**Duas peças próprias**, em `apps/web/src/componentes/ui.tsx`, porque o DS não tem:

- **Chaveiro do quarto:** o número do quarto como a etiqueta pendurada atrás da recepção. Contornado quando veio pelo QR e ainda não foi confirmado.
- **Recado:** a nota interna como o papel amarelo do balcão, que nunca vai para o hóspede.

**Estado do pedido com `StatusDot`:**
- `live`: na fila ou oferecido (o relógio corre).
- `danger`: escalado.
- `positive`: em atendimento.
- `info`: aguardando o hóspede.
- `neutral`: fechado.

## Fiscalização

`pnpm --filter @ramais/web test` roda `apps/web/scripts/auditar-estilo.mjs`, que também entra no `pnpm test` do monorepo.

**Reprova:**
- cor literal fora do `tema-ramais.css`;
- `var(--x)` para token que não existe no DS nem no tema;
- `transition: all` ou duração cravada;
- emoji ou símbolo em tela;
- `confirm`, `prompt` ou `alert` do navegador.

**Avisa:** elemento HTML cru onde há componente do DS.

## App do celular (Expo)

O DS é para a web (React DOM), então o app nativo não usa os componentes dele. `apps/mobile/src/estilo.ts` espelha a mesma marca: as cores da libré, a fonte mono para dados, o chaveiro e as lâmpadas de estado.
