import * as React from "react";

export interface TableColumn<T = any> {
  /** Unique key; also the default cell accessor (row[key]). */
  key: string;
  header: React.ReactNode;
  /** Custom cell renderer. */
  render?: (row: T) => React.ReactNode;
  /** Right-align (numbers). */
  align?: "left" | "right";
  /** Render the cell in the mono typeface (codes, MRN, vitals). */
  mono?: boolean;
  /** Fixed column width (CSS value). */
  width?: string;
  /** Opt a column out of sorting. */
  sortable?: boolean;
  /** Value used for sorting if different from row[key]. */
  sortAccessor?: (row: T) => any;
}

/**
 * Data table — sticky-style header, hover rows, optional click, sortable
 * columns, mono cells for clinical data. Pass a <Pagination> as `footer`.
 *
 * @startingPoint section="Data" subtitle="Sortable table with pagination" viewport="760x420"
 */
export interface TableProps<T = any> {
  /**
   * No mobile a tabela vira LISTA DE CARDS. Cinco colunas em 360px ou obrigam
   * a rolar na horizontal — gesto ambiguo dentro de uma pagina que ja rola na
   * vertical — ou espremem as colunas ate o dado ficar ilegivel.
   *
   * A montagem: primeira coluna vira titulo, segunda vira subtitulo, o resto
   * vira pares rotulo/valor. Use `primary`, `secondary` e `hideOnMobile` na
   * coluna quando a ordem natural nao servir. @default true
   */
  responsive?: boolean;

  columns: TableColumn<T>[];
  data: T[];
  /** Field used as the React key. @default "id" */
  rowKey?: string;
  onRowClick?: (row: T) => void;
  /** Enable column sorting. @default false */
  sortable?: boolean;
  emptyText?: React.ReactNode;
  /** Footer slot — usually a <Pagination>. */
  footer?: React.ReactNode;
  className?: string;
}

export function Table<T = any>(props: TableProps<T>): React.JSX.Element;

/** Page navigator. Pair with Table via its `footer` prop. */
export interface PaginationProps {
  /** @default "de" */
  ofLabel?: string;
  /** @default "Página" */
  pageLabel?: string;

  page: number;
  pageCount: number;
  /** Total item count (enables the "1–10 de 42" readout). */
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** Noun in the readout. @default "registros" */
  itemLabel?: string;
  className?: string;
}

export function Pagination(props: PaginationProps): React.JSX.Element;
