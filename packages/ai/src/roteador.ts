import {
  GATILHOS,
  type MotorDecisao,
  type Pergunta,
  type ResultadoRoteamento,
  type SaidaRoteamento,
  type Urgencia,
} from '@ramais/contracts';

/**
 * Roteador: monta as perguntas fechadas sobre uma mensagem e converte as respostas
 * do motor em `ResultadoRoteamento`. As opções de setor já chegam filtradas por
 * permissão em código; o motor nunca vê um destino proibido.
 */

export interface EntradaRoteamento {
  /** Mensagem original (o motor de regras lê esta). */
  texto: string;
  /** Mensagem pivotada para inglês, quando houver tradução. */
  textoIngles?: string | null;
  /** Dois últimos turnos, já em inglês quando possível. */
  historico: { autor: 'guest' | 'staff' | 'assistant'; texto: string }[];
  /** Fatos vindos do código: unidade, local, horário, setor atual. */
  fatos: Record<string, string>;
  setores: { chave: string; descricao: string; casosDeBorda?: string[] }[];
  /** Setor atual, para "setor errado". */
  setorAtual?: string | null;
}

const BOOL = ['nao', 'sim'];
const PERGUNTAS_BOOL: Record<(typeof GATILHOS)[number] | 'insatisfeito', string> = {
  emergencia: 'Is this an emergency with risk to health, life or safety (fire, medical, violence)?',
  pede_humano: 'Does the person explicitly ask to talk to a human/staff member?',
  quer_encerrar: 'Does the person want to end the conversation or say they no longer need anything?',
  setor_errado: 'Does the person say they were sent to the wrong department or the reply is about something else?',
  reclama_demora: 'Does the person complain about waiting or that nobody has come yet?',
  insatisfeito: 'Is the person clearly dissatisfied or angry?',
};

export function montarEstado(e: EntradaRoteamento): string {
  const linhas: string[] = [];
  linhas.push('Departments (choose by what the person needs, not by keywords):');
  for (const s of e.setores) {
    linhas.push(`- ${s.chave}: ${s.descricao}`);
    for (const c of s.casosDeBorda ?? []) linhas.push(`    edge case: ${c}`);
  }
  linhas.push('- vago: the message has no actionable request yet (greeting, "I need help", "hello").');
  linhas.push('- nenhum: there is a request but no department above fits.');
  linhas.push('');
  for (const [k, v] of Object.entries(e.fatos)) linhas.push(`Fact: ${k} = ${v}`);
  if (e.setorAtual) linhas.push(`Fact: current department = ${e.setorAtual}`);
  if (e.historico.length) {
    linhas.push('Recent conversation:');
    for (const h of e.historico.slice(-2)) linhas.push(`  ${h.autor}: ${h.texto}`);
  }
  linhas.push(`Message (original): ${e.texto}`);
  if (e.textoIngles && e.textoIngles !== e.texto) linhas.push(`Message (English): ${e.textoIngles}`);
  return linhas.join('\n');
}

export function montarPerguntas(e: EntradaRoteamento): Pergunta[] {
  const permitidos = e.setores.filter((s) => s.chave !== e.setorAtual);
  const descSetor: Record<string, string> = Object.fromEntries(
    permitidos.map((s) => [s.chave, [s.descricao, ...(s.casosDeBorda ?? []).map((c) => `Edge case: ${c}`)].join(' ')]),
  );
  descSetor.vago = 'The message has no actionable request yet (greeting, "I need help", "hello").';
  descSetor.nenhum = 'There is a request but none of the departments above fits.';
  return [
    {
      id: 'setor',
      texto: 'Which department should handle this message? Choose by what the person needs, not by keywords.',
      opcoes: [...permitidos.map((s) => s.chave), 'vago', 'nenhum'],
      descricoes: descSetor,
    },
    {
      id: 'urgencia',
      texto: 'How urgent is it? (rotina = routine, hoje = today, agora = right now)',
      opcoes: ['rotina', 'hoje', 'agora'],
      descricoes: {
        rotina: 'Routine: can be handled in normal time.',
        hoje: 'Should be handled today, the person mentions a time later today.',
        agora: 'Needs action right now: the person is blocked, in a hurry or something is getting worse.',
      },
    },
    ...Object.entries(PERGUNTAS_BOOL).map(([id, texto]) => ({
      id,
      texto: `${texto} (nao = no, sim = yes)`,
      opcoes: BOOL,
      tipo: 'sim_nao' as const,
      descricoes: { sim: texto.replace(/^(Is|Does) /, 'Yes: '), nao: 'No.' },
    })),
    {
      id: 'idioma',
      texto: 'Which language is the original message written in?',
      opcoes: ['pt', 'es', 'en', 'outro'],
      descricoes: { pt: 'Portuguese', es: 'Spanish', en: 'English', outro: 'Any other language' },
    },
  ];
}

export class Roteador {
  constructor(private readonly motor: MotorDecisao) {}

  get nome(): string {
    return this.motor.nome;
  }

  async rotear(e: EntradaRoteamento): Promise<ResultadoRoteamento & { perguntas: Pergunta[] }> {
    const perguntas = montarPerguntas(e);
    const r = await this.motor.decidir({ estado: montarEstado(e), perguntas });
    const por = new Map(r.respostas.map((x) => [x.id, x]));
    const val = (id: string) => por.get(id)?.escolha;
    const conf = (id: string) => por.get(id)?.confianca ?? 0;
    const bool = (id: string) => val(id) === 'sim';
    // Confiança de um booleano = confiança na resposta escolhida; quando a resposta é "não",
    // a confiança no "sim" é o complemento.
    const confSim = (id: string) => (bool(id) ? conf(id) : 1 - conf(id));

    const saida: SaidaRoteamento = {
      setor: val('setor') ?? 'nenhum',
      urgencia: (val('urgencia') as Urgencia) ?? 'rotina',
      emergencia: bool('emergencia'),
      pede_humano: bool('pede_humano'),
      quer_encerrar: bool('quer_encerrar'),
      setor_errado: bool('setor_errado'),
      reclama_demora: bool('reclama_demora'),
      insatisfeito: bool('insatisfeito'),
      idioma: val('idioma') ?? 'pt',
    };
    const metodo = r.motor.startsWith('regras')
      ? 'regra'
      : r.motor.endsWith(':logprobs')
        ? 'logprobs'
        : r.motor.endsWith(':nativa')
          ? 'nativa'
          : 'autoconsistencia';
    return {
      saida,
      confianca: {
        setor: conf('setor'),
        urgencia: conf('urgencia'),
        idioma: conf('idioma'),
        emergencia: confSim('emergencia'),
        pede_humano: confSim('pede_humano'),
        quer_encerrar: confSim('quer_encerrar'),
        setor_errado: confSim('setor_errado'),
        reclama_demora: confSim('reclama_demora'),
        insatisfeito: confSim('insatisfeito'),
      },
      probsSetor: por.get('setor')?.probs,
      motor: r.motor,
      latenciaMs: r.latenciaMs,
      metodoConfianca: metodo,
      perguntas,
    };
  }
}
