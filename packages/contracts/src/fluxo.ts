import { z } from 'zod';
import { TextoI18n, Urgencia } from './comum.js';

/**
 * Fluxo da conversa: um ciclo fixo de 5 etapas com encaixes de blocos.
 * Não é um canvas livre: o que muda entre instituições são os blocos dentro de cada etapa.
 *
 *   entrada → identificação → resolução → atendimento → encerramento
 *
 * Os blocos das 4 primeiras etapas rodam em ordem a cada mensagem enquanto a conversa está
 * na automação; um bloco pode esperar a resposta do hóspede (coletar, pedir detalhe).
 * O encerramento roda quando a equipe resolve o pedido.
 * Cada bloco pode ter condições (`quando`): todas precisam valer para ele rodar.
 */

// ---------- Condições ----------

const Base = { nao: z.boolean().default(false) };

export const Condicao = z.discriminatedUnion('tipo', [
  /** Primeira mensagem da conversa. */
  z.object({ tipo: z.literal('primeira_mensagem'), ...Base }),
  /** Hora local da unidade entre `de` e `ate` (atravessa a meia-noite se `de` > `ate`). */
  z.object({
    tipo: z.literal('horario'),
    de: z.string().regex(/^\d{2}:\d{2}$/, 'use HH:MM'),
    ate: z.string().regex(/^\d{2}:\d{2}$/, 'use HH:MM'),
    ...Base,
  }),
  /** Dias da semana (0 = domingo … 6 = sábado). */
  z.object({ tipo: z.literal('dia_semana'), dias: z.array(z.number().int().min(0).max(6)).min(1), ...Base }),
  /** Setor que a IA decidiu (ou sugeriu) está na lista. */
  z.object({ tipo: z.literal('setor'), setores: z.array(z.string()).min(1), ...Base }),
  /** O setor decidido exige identificação (configurado no setor). */
  z.object({ tipo: z.literal('setor_exige_identificacao'), ...Base }),
  /** Idioma do hóspede. */
  z.object({ tipo: z.literal('idioma'), idiomas: z.array(z.string()).min(1), ...Base }),
  /** Quarto confirmado (sobrenome ou recepção). */
  z.object({ tipo: z.literal('identificado'), ...Base }),
  /** Quarto conhecido, mesmo sem confirmação (QR). */
  z.object({ tipo: z.literal('tem_quarto'), ...Base }),
  /** Um dado já foi coletado. */
  z.object({ tipo: z.literal('dado'), campo: z.string(), ...Base }),
  /** Urgência que a IA leu no pedido. */
  z.object({ tipo: z.literal('urgencia'), niveis: z.array(Urgencia).min(1), ...Base }),
]);
export type Condicao = z.infer<typeof Condicao>;
export type TipoCondicao = Condicao['tipo'];

// ---------- Blocos ----------

export const CAMPOS_COLETA = ['quarto_sobrenome', 'nome', 'email', 'cpf', 'reserva', 'data', 'texto'] as const;
export const CampoColeta = z.enum(CAMPOS_COLETA);
export type CampoColeta = z.infer<typeof CampoColeta>;

const ChaveTextoFixo = z.string().min(1);

/** Texto do bloco: um texto fixo da configuração (por chave) ou um texto livre em 3 idiomas. */
export const ConteudoTexto = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('fixo'), chave: ChaveTextoFixo }),
  z.object({ tipo: z.literal('livre'), texto: TextoI18n }),
]);
export type ConteudoTexto = z.infer<typeof ConteudoTexto>;

const Comum = {
  id: z.string().min(1).max(40),
  /** Rótulo livre que aparece no construtor ("Boas-vindas de madrugada"). */
  rotulo: z.string().max(80).optional(),
  quando: z.array(Condicao).default([]),
};

export const BlocoFluxo = z.discriminatedUnion('tipo', [
  /** Manda uma mensagem e segue. */
  z.object({ tipo: z.literal('mensagem'), conteudo: ConteudoTexto, ...Comum }),
  /**
   * Pede um dado. Se `bloqueia`, espera a resposta antes de seguir; senão, pergunta e segue
   * (a resposta é registrada quando chegar). Para `quarto_sobrenome`, `conferir` confronta
   * com a lista de hóspedes ativos.
   */
  z.object({
    tipo: z.literal('coletar'),
    campo: CampoColeta,
    pergunta: ConteudoTexto,
    bloqueia: z.boolean().default(false),
    conferir: z.boolean().default(true),
    tentativas: z.number().int().min(1).max(5).default(2),
    /** Esgotadas as tentativas: segue sem o dado ou passa para uma pessoa. */
    seFalhar: z.enum(['seguir', 'humano']).default('seguir'),
    ...Comum,
  }),
  /** Tenta responder pela base de conhecimento; se responder, o pedido é resolvido pela IA. */
  z.object({ tipo: z.literal('base_conhecimento'), ...Comum }),
  /** Decide o setor com o gate de confiança. Se o pedido for vago, pode perguntar uma vez. */
  z.object({ tipo: z.literal('decidir_setor'), perguntarSeVago: z.boolean().default(true), ...Comum }),
  /**
   * Põe o pedido na fila: do setor decidido (respeitando o modo sombra) ou de um setor fixo.
   * Depois dele, os blocos seguintes da etapa ainda rodam, mas sem esperar resposta.
   */
  z.object({
    tipo: z.literal('encaminhar'),
    destino: z.union([z.literal('decidido'), z.string().regex(/^setor:[a-z][a-z0-9_]*$/)]),
    avisar: z.boolean().default(true),
    urgencia: Urgencia.optional(),
    ...Comum,
  }),
  /** Encerra a conversa sem atendimento humano (ex.: fora do horário de um serviço). */
  z.object({ tipo: z.literal('encerrar'), conteudo: ConteudoTexto.optional(), ...Comum }),
  /** Pesquisa de satisfação de 1 a 5 (só no encerramento). */
  z.object({
    tipo: z.literal('pesquisa'),
    pergunta: TextoI18n,
    agradecimento: TextoI18n,
    ...Comum,
  }),
]);
export type BlocoFluxo = z.infer<typeof BlocoFluxo>;
export type TipoBloco = BlocoFluxo['tipo'];

export const ETAPAS = ['entrada', 'identificacao', 'resolucao', 'atendimento', 'encerramento'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Que blocos cabem em cada etapa (o construtor oferece só estes). */
export const BLOCOS_POR_ETAPA: Record<Etapa, readonly TipoBloco[]> = {
  entrada: ['mensagem', 'coletar', 'encaminhar', 'encerrar'],
  identificacao: ['coletar', 'mensagem', 'encaminhar'],
  resolucao: ['base_conhecimento', 'decidir_setor', 'mensagem', 'coletar', 'encaminhar', 'encerrar'],
  atendimento: ['encaminhar', 'mensagem', 'coletar', 'encerrar'],
  encerramento: ['mensagem', 'pesquisa'],
};



export const Fluxo = z
  .object({
    entrada: z.array(BlocoFluxo).default([]),
    identificacao: z.array(BlocoFluxo).default([]),
    resolucao: z.array(BlocoFluxo).default([]),
    atendimento: z.array(BlocoFluxo).default([]),
    encerramento: z.array(BlocoFluxo).default([]),
  })
  .superRefine((f, ctx) => {
    const ids = new Set<string>();
    for (const etapa of ETAPAS) {
      f[etapa].forEach((b, i) => {
        if (ids.has(b.id)) ctx.addIssue({ code: 'custom', message: `id de bloco repetido: ${b.id}`, path: [etapa, i, 'id'] });
        ids.add(b.id);
        if (!BLOCOS_POR_ETAPA[etapa].includes(b.tipo)) {
          ctx.addIssue({ code: 'custom', message: `bloco "${b.tipo}" não cabe na etapa ${etapa}`, path: [etapa, i, 'tipo'] });
        }
      });
    }
  });
export type Fluxo = z.infer<typeof Fluxo>;

/** Fluxo padrão: o comportamento do MVP antes do construtor. */
export const FLUXO_PADRAO: z.input<typeof Fluxo> = {
  entrada: [],
  identificacao: [],
  resolucao: [
    { id: 'kb', tipo: 'base_conhecimento', rotulo: 'Responder pela base de conhecimento', quando: [] },
    { id: 'decidir', tipo: 'decidir_setor', rotulo: 'Decidir o setor', perguntarSeVago: true, quando: [] },
  ],
  atendimento: [
    { id: 'encaminhar', tipo: 'encaminhar', rotulo: 'Encaminhar ao setor decidido', destino: 'decidido', avisar: true, quando: [] },
    {
      id: 'identificar',
      tipo: 'coletar',
      rotulo: 'Pedir quarto e sobrenome quando o setor exige',
      campo: 'quarto_sobrenome',
      pergunta: { tipo: 'fixo', chave: 'pedir_identificacao' },
      bloqueia: false,
      conferir: true,
      tentativas: 2,
      seFalhar: 'seguir',
      quando: [{ tipo: 'setor_exige_identificacao', nao: false }, { tipo: 'identificado', nao: true }],
    },
  ],
  encerramento: [{ id: 'resolvido', tipo: 'mensagem', rotulo: 'Avisar que foi concluído', conteudo: { tipo: 'fixo', chave: 'resolvido' }, quando: [] }],
};
