import { z } from 'zod';
import { TextoI18n } from './comum.js';
import { Escada, type AlvoAviso } from './escalonamento.js';
import { ETAPAS, FLUXO_PADRAO, Fluxo, type BlocoFluxo } from './fluxo.js';

/**
 * Configuração da unidade, versionada em `jornada_versao`.
 * O ciclo da jornada é fixo no código; aqui só mudam textos, tempos, limites e catálogo.
 */

export const SetorCatalogo = z.object({
  chave: z.string().regex(/^[a-z][a-z0-9_]*$/, 'use só letras minúsculas, números e _'),
  nome: z.string().min(1),
  /** Nome mostrado ao hóspede no idioma dele ("enviado a Mantenimiento"). Sem tradução, usa `nome`. */
  nomes: z.object({ es: z.string().optional(), en: z.string().optional() }).default({}),
  /** Descrição na linguagem de quem pede, em inglês: é o que o roteador lê (pivot). */
  descricao: z.string().min(10),
  exemplos: z.array(z.string()).default([]),
  /** Palavras que o motor de fallback (sem IA) usa. Sem acento, minúsculas. */
  palavrasChave: z.array(z.string()).default([]),
  casosDeBorda: z.array(z.string()).default([]),
  /** Pedidos deste setor exigem quarto e sobrenome confirmados (ex.: cobrança, dados da reserva). */
  exigeIdentificacao: z.boolean().default(false),
  /** Escada própria do setor. Sem ela, vale a da unidade. */
  escalonamento: Escada.optional(),
});
export type SetorCatalogo = z.infer<typeof SetorCatalogo>;

export const Tempos = z.object({
  /** Sem resposta do solicitante: aviso e depois encerramento. Precisam caber na janela de 24 h. */
  inatividadeAvisoMin: z.number().int().min(1).default(30),
  inatividadeEncerraMin: z.number().int().min(2).default(60),
  /** Nova mensagem depois de resolvida reabre dentro desta janela; depois abre outra. */
  reaberturaHoras: z.number().min(0).max(24).default(24),
  /** Presença encerrada depois deste tempo sem atividade no app. */
  presencaInatividadeMin: z.number().int().min(10).default(240),
});

export const Limites = z.object({
  encaminha: z.number().min(0).max(1).default(0.85),
  baixaCerteza: z.number().min(0).max(1).default(0.6),
  /** Emergência tem limite baixo de propósito: melhor um falso alarme que uma emergência perdida. */
  emergencia: z.number().min(0).max(1).default(0.3),
  gatilho: z.number().min(0).max(1).default(0.7),
  /** Resposta automática pela base de conhecimento. */
  respostaAutomatica: z.number().min(0).max(1).default(0.8),
});

export const ChaveTexto = z.enum([
  'boas_vindas',
  'pedir_detalhe',
  'pedir_identificacao',
  'identificacao_ok',
  'identificacao_pendente',
  'encaminhado',
  'encaminhado_baixa_certeza',
  'posicao_fila',
  'emergencia',
  'humano',
  'aviso_inatividade',
  'encerramento',
  'encerrado_pelo_solicitante',
  'resolvido',
  'espera_longa',
  'nao_entendi_midia',
]);
export type ChaveTexto = z.infer<typeof ChaveTexto>;

export const PalavrasChaveGlobais = z.object({
  encerrar: z.array(z.string()).default([]),
  humano: z.array(z.string()).default([]),
  emergencia: z.array(z.string()).default([]),
});

export const ItemConhecimento = z.object({
  id: z.string(),
  pergunta: z.string(),
  resposta: z.string(),
  tags: z.array(z.string()).default([]),
});
export type ItemConhecimento = z.infer<typeof ItemConhecimento>;

export const TemplateMeta = z.object({
  nome: z.string(),
  categoria: z.literal('UTILITY'),
  corpo: TextoI18n,
  /** Quantidade de variáveis {{1}}, {{2}}... no corpo. */
  variaveis: z.number().int().min(0),
});
export type TemplateMeta = z.infer<typeof TemplateMeta>;

export const ConfigUnidade = z
  .object({
    vertical: z.string(),
    fuso: z.string().default('America/Sao_Paulo'),
    setores: z.array(SetorCatalogo).min(1),
    /** Para onde vai o que ninguém sabe rotear. */
    setorFallback: z.string(),
    tempos: Tempos.prefault({}),
    /** Escada padrão da unidade (cada setor pode ter a sua). Tempo de oferta, lembretes e avisos. */
    escalonamento: Escada.prefault({}),
    limites: Limites.prefault({}),
    textos: z.record(ChaveTexto, TextoI18n),
    palavrasChave: PalavrasChaveGlobais.prefault({}),
    glossario: z.array(z.string()).default([]),
    templates: z.array(TemplateMeta).default([]),
    /** Fluxo da conversa (construtor). Versões antigas sem fluxo usam o padrão. */
    fluxo: Fluxo.prefault(FLUXO_PADRAO),
  })
  .superRefine((cfg, ctx) => {
    const chaves = new Set(cfg.setores.map((s) => s.chave));
    if (chaves.size !== cfg.setores.length) {
      ctx.addIssue({ code: 'custom', message: 'chaves de setor repetidas', path: ['setores'] });
    }
    if (!chaves.has(cfg.setorFallback)) {
      ctx.addIssue({ code: 'custom', message: 'setorFallback não existe no catálogo', path: ['setorFallback'] });
    }
    // Avisos de inatividade precisam caber na janela de 24 h do WhatsApp.
    if (cfg.tempos.inatividadeEncerraMin <= cfg.tempos.inatividadeAvisoMin) {
      ctx.addIssue({ code: 'custom', message: 'encerramento precisa vir depois do aviso', path: ['tempos'] });
    }
    if (cfg.tempos.inatividadeEncerraMin > 24 * 60) {
      ctx.addIssue({ code: 'custom', message: 'encerramento fora da janela de 24 h exige template', path: ['tempos'] });
    }
    if (cfg.limites.baixaCerteza > cfg.limites.encaminha) {
      ctx.addIssue({ code: 'custom', message: 'baixaCerteza deve ser <= encaminha', path: ['limites'] });
    }
    // Referências do fluxo: textos fixos e setores precisam existir.
    const chavesTexto = new Set<string>(ChaveTexto.options);
    const textoOk = (c: { tipo: string; chave?: string } | undefined) => !c || c.tipo !== 'fixo' || chavesTexto.has(c.chave!);
    for (const etapa of ETAPAS) {
      cfg.fluxo[etapa].forEach((b: BlocoFluxo, i: number) => {
        const caminho = ['fluxo', etapa, i];
        if ((b.tipo === 'mensagem' || b.tipo === 'encerrar') && !textoOk(b.conteudo)) {
          ctx.addIssue({ code: 'custom', message: 'texto fixo inexistente', path: [...caminho, 'conteudo'] });
        }
        if (b.tipo === 'coletar' && !textoOk(b.pergunta)) {
          ctx.addIssue({ code: 'custom', message: 'texto fixo inexistente', path: [...caminho, 'pergunta'] });
        }
        if (b.tipo === 'encaminhar' && b.destino !== 'decidido' && !chaves.has(b.destino.slice(6))) {
          ctx.addIssue({ code: 'custom', message: `setor inexistente: ${b.destino.slice(6)}`, path: [...caminho, 'destino'] });
        }
        for (const q of b.quando) {
          if (q.tipo === 'setor') {
            for (const s of q.setores) {
              if (!chaves.has(s)) ctx.addIssue({ code: 'custom', message: `setor inexistente na condição: ${s}`, path: [...caminho, 'quando'] });
            }
          }
        }
      });
    }
    // Escadas: setores citados precisam existir; lembrar vem antes de passar adiante.
    const conferirEscada = (e: Escada, caminho: (string | number)[]) => {
      e.avisos.forEach((a, i) => {
        const setor = (a.alvo as Extract<AlvoAviso, { setor?: string }>).setor;
        if (setor !== undefined && !chaves.has(setor)) {
          ctx.addIssue({ code: 'custom', message: `setor inexistente no aviso: ${setor}`, path: [...caminho, 'avisos', i] });
        }
      });
      if (e.lembrarMin > 0 && e.repassarMin > 0 && e.lembrarMin >= e.repassarMin) {
        ctx.addIssue({ code: 'custom', message: 'o lembrete precisa vir antes de passar para outra pessoa', path: [...caminho, 'lembrarMin'] });
      }
    };
    conferirEscada(cfg.escalonamento, ['escalonamento']);
    cfg.setores.forEach((s, i) => s.escalonamento && conferirEscada(s.escalonamento, ['setores', i, 'escalonamento']));

    for (const chave of ChaveTexto.options) {
      if (!cfg.textos[chave]) {
        ctx.addIssue({ code: 'custom', message: `texto ausente: ${chave}`, path: ['textos', chave] });
      }
    }
  });
export type ConfigUnidade = z.infer<typeof ConfigUnidade>;
export type ConfigUnidadeEntrada = z.input<typeof ConfigUnidade>;
