import * as React from "react";

/**
 * Seção de conteúdo gerado que o profissional confere e leva para outro lugar
 * — prontuário, sistema do hospital, mensagem ao paciente. Um botão de copiar
 * por seção, porque é assim que o texto é usado.
 *
 * O clipboard recebe o que está na tela, montado na hora do clique: título,
 * corpo, linhas de resultado, observação e o comentário do profissional
 * ROTULADO — quem cola precisa distinguir a leitura humana da saída do modelo.
 *
 * @startingPoint section="Data display" subtitle="Seção copiável de conteúdo processado" viewport="900x760"
 */
export interface CopySectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "onCopy"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Linhas de resultado, em grade de três colunas com cabeçalho. */
  rows?: CopySectionRow[];
  /** Observação ao pé da seção (ressalva, fonte). */
  note?: React.ReactNode;
  /** Comentário do profissional. Vai no clipboard com `commentLabel`. */
  comment?: string;
  commentAuthor?: string;
  /** Controles extras no cabeçalho, antes do copiar. */
  actions?: React.ReactNode;
  /** Substitui o texto montado. Como função, é lido na hora do clique. */
  copyText?: string | (() => string);
  onCopy?: (text: string) => void;
  /** @default "Parâmetro" */
  labelHeader?: string;
  /** @default "Resultado" */
  valueHeader?: string;
  /** @default "Referência" */
  referenceHeader?: string;
  /** @default "Acima" */
  highLabel?: string;
  /** @default "Abaixo" */
  lowLabel?: string;
  /** @default "Crítico" */
  criticalLabel?: string;
  /** @default "Observação" */
  noteLabel?: string;
  /** @default "Comentário do profissional" */
  commentLabel?: string;
  /** @default "Copiar seção" */
  copyLabel?: string;
  /** @default "Copiado" */
  copiedLabel?: string;
  /** Corpo livre (texto, lista, markdown já renderizado). Entra no texto copiado. */
  children?: React.ReactNode;
  className?: string;
}

export interface CopySectionRow {
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  reference?: React.ReactNode;
  /** Fora da referência: o valor muda de tinta e ganha seta + palavra. */
  status?: "normal" | "high" | "low" | "critical";
}

export function CopySection(props: CopySectionProps): React.JSX.Element;
