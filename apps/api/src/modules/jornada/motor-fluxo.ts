import { Injectable } from '@nestjs/common';
import type { AcaoGate, BlocoFluxo, CampoColeta, ConfigUnidade, ResultadoRoteamento, Urgencia } from '@ramais/contracts';
import {
  aplicarGate,
  avaliarCondicoes,
  lerCampo,
  mascararCampo,
  NOMES_CAMPO,
  relogioLocal,
  sobrenomeConfere,
  type ValorColetado,
} from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

/** O que o motor precisa da análise da mensagem (fase 2 do orquestrador). */
export interface AnaliseFluxo {
  textoBase: string;
  resumoPt: string;
  roteamento: (ResultadoRoteamento & { perguntas: unknown[] }) | null;
  conhecimento: { responde: boolean; resposta: string | null; confianca: number; fontes: string[]; modelo: string } | null;
  temMidia: boolean;
}

interface Pedido {
  texto: string;
  setor: string | null;
  acao: AcaoGate;
  confianca: number | null;
  urgencia: Urgencia;
  decisaoId: string | null;
}

/** Estado do fluxo de uma conversa, guardado em `solicitacao.contexto.fluxo`. */
export interface EstadoFluxo {
  /** 0 = entrada, 1 = identificação, 2 = resolução, 3 = atendimento. */
  etapa: number;
  bloco: number;
  aguardando: { blocoId: string; motivo: 'coletar' | 'detalhe'; tentativas: number } | null;
  dados: Record<string, ValorColetado>;
  pedido: Pedido | null;
  decisao: Pedido | null;
  perguntouDetalhe: boolean;
  encaminhou: boolean;
  concluido: boolean;
}

type Passo = { r: 'seguir' } | { r: 'aguardar' } | { r: 'fim' };

/**
 * Resposta a "bom dia", "oi", "preciso de ajuda" no chat do quarto. Fora de PT/ES/EN, sai em inglês
 * e a saída traduz para o idioma do hóspede.
 */
const SAUDACAO_CHAT = {
  pt: 'Olá! Escreva aqui o que você precisa, do seu jeito, que a gente encaminha para o setor certo. Se preferir ir direto a um setor, toque em "Menu principal", no alto do chat, e escolha.',
  es: '¡Hola! Escriba aquí lo que necesita, como prefiera, y lo enviamos al sector indicado. Si prefiere ir directo a un sector, toque "Menú principal", arriba del chat, y elija.',
  en: 'Hi! Write what you need here, in your own words, and we will send it to the right team. If you would rather go straight to a department, tap "Main menu" at the top of the chat and choose.',
};

const ETAPAS_AUTOMACAO = ['entrada', 'identificacao', 'resolucao', 'atendimento'] as const;

function novoEstado(): EstadoFluxo {
  return { etapa: 0, bloco: 0, aguardando: null, dados: {}, pedido: null, decisao: null, perguntouDetalhe: false, encaminhou: false, concluido: false };
}

const DICA: Partial<Record<CampoColeta, { pt: string; es: string; en: string }>> = {
  quarto_sobrenome: { pt: 'Por exemplo: 302 Silva', es: 'Por ejemplo: 302 García', en: 'For example: 302 Smith' },
  cpf: { pt: 'Digite os 11 números do CPF.', es: 'Escriba los 11 números del CPF.', en: 'Please type the 11 digits of your CPF.' },
  email: { pt: 'Por exemplo: nome@email.com', es: 'Por ejemplo: nombre@email.com', en: 'For example: name@email.com' },
  reserva: { pt: 'O código está no e-mail de confirmação.', es: 'El código está en el correo de confirmación.', en: 'The code is in your confirmation e-mail.' },
  nome: { pt: 'Nome e sobrenome, por favor.', es: 'Nombre y apellido, por favor.', en: 'First and last name, please.' },
  data: { pt: 'No formato dia/mês, por exemplo 05/10.', es: 'En formato día/mes, por ejemplo 05/10.', en: 'As day/month, for example 05/10.' },
};

/**
 * Executa o fluxo configurado (construtor) enquanto a conversa está na automação.
 * A cada mensagem: responde a quem estava esperando, atualiza o pedido e roda os blocos
 * de onde parou, até um bloco esperar resposta, encaminhar ou encerrar.
 */
@Injectable()
export class MotorFluxo {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
  ) {}

  async executar(c: Ctx, s: SolicitacaoRow, a: AnaliseFluxo, decisaoId: string | null): Promise<void> {
    const cfg = await this.acoes.config(c, s);
    const primeira = !(s.contexto as { fluxo?: unknown }).fluxo;
    const st: EstadoFluxo = { ...novoEstado(), ...((s.contexto as { fluxo?: EstadoFluxo }).fluxo ?? {}) };
    const trilha: { bloco: string; tipo: string; r: string }[] = [];
    const rot = a.roteamento;
    const gate = rot ? aplicarGate(rot, cfg.limites) : { acao: 'recepcao' as const, setor: null };

    const salvar = async (fim = false) => {
      if (fim) st.concluido = true;
      // Recarrega: blocos podem ter mudado a solicitação (fila, triagem, contexto).
      s = await this.acoes.carregar(c, s.id);
      s = await this.acoes.atualizar(c, s, { contexto: { ...s.contexto, fluxo: st } });
      await this.nucleo.evento(c, {
        solicitacaoId: s.id,
        tipo: 'fluxo',
        atorTipo: 'sistema',
        dados: { versao: s.jornada_versao_id, trilha, etapa: st.etapa, aguardando: st.aguardando?.blocoId ?? null },
      });
    };

    // 1. Resposta a um bloco que esperava.
    let respondeuColeta = false;
    if (st.aguardando) {
      const b = this.acharBloco(cfg, st.aguardando.blocoId);
      if (b?.tipo === 'coletar') {
        respondeuColeta = true;
        const v = lerCampo(b.campo, a.textoBase);
        if (v) {
          s = await this.registrarDado(c, s, st, b.campo, v, b.conferir);
          trilha.push({ bloco: b.id, tipo: b.tipo, r: 'respondido' });
          st.aguardando = null;
          st.bloco += 1;
        } else {
          st.aguardando.tentativas += 1;
          if (st.aguardando.tentativas < b.tentativas) {
            await this.perguntar(c, s, b, true);
            trilha.push({ bloco: b.id, tipo: b.tipo, r: 'resposta_invalida' });
            await salvar();
            return;
          }
          trilha.push({ bloco: b.id, tipo: b.tipo, r: `sem_resposta:${b.seFalhar}` });
          st.aguardando = null;
          if (b.seFalhar === 'humano') {
            await this.encaminharFallback(c, s, st, cfg, a, 'coleta_sem_resposta');
            await salvar(true);
            return;
          }
          st.bloco += 1;
        }
      } else {
        // Esperava detalhe de um pedido vago: esta mensagem é o pedido; o bloco roda de novo.
        st.aguardando = null;
      }
    }

    // 2. A mensagem que não é resposta de coleta é (parte d)o pedido.
    if (!respondeuColeta && (gate.acao !== 'perguntar' || !st.pedido)) {
      st.pedido = {
        texto: a.resumoPt,
        setor: gate.setor,
        acao: gate.acao,
        confianca: rot?.confianca.setor ?? null,
        urgencia: rot?.saida.urgencia ?? 'rotina',
        decisaoId,
      };
    }

    // 3. Roda os blocos de onde parou.
    const { hora, diaSemana } = relogioLocal(new Date(), cfg.fuso);
    for (; st.etapa < ETAPAS_AUTOMACAO.length; st.etapa++, st.bloco = 0) {
      const blocos = cfg.fluxo[ETAPAS_AUTOMACAO[st.etapa]!];
      for (; st.bloco < blocos.length; st.bloco++) {
        const b = blocos[st.bloco]!;
        const setor = st.decisao?.setor ?? st.pedido?.setor ?? null;
        const ok = avaliarCondicoes(b.quando, {
          primeiraMensagem: primeira,
          hora,
          diaSemana,
          setor,
          setorExigeIdentificacao: cfg.setores.find((x) => x.chave === setor)?.exigeIdentificacao ?? false,
          idioma: s.idioma,
          identificado: s.identificado,
          temQuarto: s.local_id !== null,
          dados: st.dados,
          urgencia: st.pedido?.urgencia ?? 'rotina',
        });
        if (!ok) {
          trilha.push({ bloco: b.id, tipo: b.tipo, r: 'pulado' });
          continue;
        }
        const passo = await this.rodar(c, s, st, b, a, cfg, respondeuColeta);
        s = await this.acoes.carregar(c, s.id);
        trilha.push({ bloco: b.id, tipo: b.tipo, r: passo.r });
        if (passo.r === 'aguardar') return salvar();
        if (passo.r === 'fim') return salvar(true);
      }
    }

    // 4. Rede de segurança: o fluxo acabou sem encaminhar nem encerrar.
    if (!st.encaminhou) {
      trilha.push({ bloco: '(automatico)', tipo: 'encaminhar', r: 'seguranca' });
      await this.encaminharDecidido(c, s, st, cfg, true);
    }
    await salvar(true);
  }

  private acharBloco(cfg: ConfigUnidade, id: string): BlocoFluxo | undefined {
    for (const e of ETAPAS_AUTOMACAO) {
      const b = cfg.fluxo[e].find((x) => x.id === id);
      if (b) return b;
    }
    return undefined;
  }

  private async rodar(
    c: Ctx,
    s: SolicitacaoRow,
    st: EstadoFluxo,
    b: BlocoFluxo,
    a: AnaliseFluxo,
    cfg: ConfigUnidade,
    respondeuColeta: boolean,
  ): Promise<Passo> {
    switch (b.tipo) {
      case 'mensagem':
        await this.acoes.enviarConteudo(c, s, b.conteudo, this.vars(st, cfg, s));
        return { r: 'seguir' };

      case 'coletar': {
        const jaTem = b.campo === 'quarto_sobrenome' ? s.identificado : st.dados[b.campo] !== undefined;
        if (jaTem) return { r: 'seguir' };
        await this.perguntar(c, s, b, false);
        // Depois de encaminhar, ninguém fica esperando: a resposta é registrada quando chegar.
        if (b.bloqueia && !st.encaminhou) {
          st.aguardando = { blocoId: b.id, motivo: 'coletar', tentativas: 0 };
          return { r: 'aguardar' };
        }
        await this.acoes.atualizar(c, s, {
          contexto: { ...s.contexto, coletaPendente: { campo: b.campo, conferir: b.conferir, blocoId: b.id } },
        });
        return { r: 'seguir' };
      }

      case 'base_conhecimento': {
        const kb = a.conhecimento;
        if (respondeuColeta || !kb?.responde || !kb.resposta || kb.confianca < cfg.limites.respostaAutomatica) return { r: 'seguir' };
        await this.acoes.enviarAoSolicitante(c, s, { texto: kb.resposta, idioma: 'pt', autor: { tipo: 'ia' } });
        await this.nucleo.evento(c, {
          solicitacaoId: s.id,
          tipo: 'resposta_automatica',
          atorTipo: 'ia',
          dados: { fontes: kb.fontes, confianca: kb.confianca, modelo: kb.modelo },
        });
        const atual = await this.acoes.atualizar(c, s, { resumo: s.resumo ?? a.resumoPt });
        await this.acoes.resolver(c, atual, { tipo: 'ia' });
        return { r: 'fim' };
      }

      case 'decidir_setor': {
        if (st.decisao) return { r: 'seguir' };
        const p = st.pedido;
        if (!p || (!a.textoBase && !a.temMidia)) return { r: 'seguir' };
        if (p.acao === 'perguntar') {
          if (b.perguntarSeVago && !st.perguntouDetalhe) {
            st.perguntouDetalhe = true;
            st.aguardando = { blocoId: b.id, motivo: 'detalhe', tentativas: 0 };
            // Chat do quarto tem o Menu principal no alto: a saudação ensina os dois caminhos.
            if (await this.chatDoQuarto(c, s)) await this.acoes.enviarConteudo(c, s, { tipo: 'livre', texto: SAUDACAO_CHAT });
            else await this.acoes.enviarTextoFixo(c, s, 'pedir_detalhe');
            return { r: 'aguardar' };
          }
          st.decisao = { ...p, setor: cfg.setorFallback, acao: 'recepcao' };
          return { r: 'seguir' };
        }
        st.decisao = { ...p, setor: p.setor ?? cfg.setorFallback };
        return { r: 'seguir' };
      }

      case 'encaminhar': {
        if (st.encaminhou) return { r: 'seguir' };
        if (b.destino === 'decidido') {
          await this.encaminharDecidido(c, s, st, cfg, b.avisar, b.urgencia);
        } else {
          const setor = await this.unidades.setorPorChave(c.tx, s.unidade_id, b.destino.slice(6));
          if (!setor) throw new Error(`setor do fluxo não existe: ${b.destino}`);
          const nova = await this.acoes.colocarNaFila(c, s, setor.id, {
            ator: { tipo: 'sistema' },
            motivo: `fluxo:${b.id}`,
            urgencia: b.urgencia ?? st.pedido?.urgencia ?? 'rotina',
            resumo: s.resumo ?? st.pedido?.texto ?? null,
          });
          if (b.avisar) await this.acoes.enviarEncaminhado(c, nova, setor);
        }
        st.encaminhou = true;
        return { r: 'seguir' };
      }

      case 'encerrar': {
        if (b.conteudo) await this.acoes.enviarConteudo(c, s, b.conteudo, this.vars(st, cfg, s));
        await this.acoes.transicionar(c, s, 'resolver', { resolvida_em: new Date(), resumo: s.resumo ?? st.pedido?.texto ?? null });
        await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'encerrada_pelo_fluxo', atorTipo: 'sistema', dados: { bloco: b.id } });
        return { r: 'fim' };
      }

      case 'pesquisa':
        return { r: 'seguir' }; // só roda no encerramento
    }
  }

  private async chatDoQuarto(c: Ctx, s: SolicitacaoRow): Promise<boolean> {
    if (!s.canal_id) return false;
    const r = await c.tx.client.query<{ tipo: string }>('SELECT tipo FROM canal_whatsapp WHERE id = $1', [s.canal_id]);
    return r.rows[0]?.tipo === 'web';
  }

  private vars(st: EstadoFluxo, cfg: ConfigUnidade, s: SolicitacaoRow): Record<string, string> {
    const chave = st.decisao?.setor ?? st.pedido?.setor;
    const setor = chave ? cfg.setores.find((x) => x.chave === chave) : undefined;
    const i = s.idioma.slice(0, 2);
    const nome = setor ? ((i === 'es' && setor.nomes.es) || (i === 'en' && setor.nomes.en) || setor.nome) : '';
    return { setor: nome };
  }

  private async perguntar(c: Ctx, s: SolicitacaoRow, b: Extract<BlocoFluxo, { tipo: 'coletar' }>, repetir: boolean) {
    await this.acoes.enviarConteudo(c, s, b.pergunta, {});
    const dica = DICA[b.campo];
    if (repetir && dica) {
      const i = s.idioma.slice(0, 2) as 'pt' | 'es' | 'en';
      await this.acoes.enviarAoSolicitante(c, s, { texto: dica[i] ?? dica.en, idioma: i in dica ? i : 'en', autor: { tipo: 'sistema' } });
    }
  }

  /** Encaminha ao setor decidido pelo gate, respeitando o modo sombra (triagem). */
  async encaminharDecidido(c: Ctx, s: SolicitacaoRow, st: EstadoFluxo, cfg: ConfigUnidade, avisar: boolean, urgencia?: Urgencia) {
    const d = st.decisao ?? (st.pedido ? { ...st.pedido, setor: st.pedido.acao === 'perguntar' ? null : st.pedido.setor } : null);
    const acao: AcaoGate = d?.acao === 'perguntar' ? 'recepcao' : (d?.acao ?? 'recepcao');
    const chave = acao === 'recepcao' ? cfg.setorFallback : (d?.setor ?? cfg.setorFallback);
    const setor =
      (await this.unidades.setorPorChave(c.tx, s.unidade_id, chave)) ?? (await this.unidades.setorPorChave(c.tx, s.unidade_id, cfg.setorFallback));
    if (!setor) throw new Error(`unidade sem setor de fallback (${cfg.setorFallback})`);

    // Modo sombra: o setor decidido ainda não está liberado para o automático. O pedido vai
    // para a triagem (setor de fallback) com a sugestão, e alguém confirma ou corrige.
    const triagem = await this.unidades.setorPorChave(c.tx, s.unidade_id, cfg.setorFallback);
    const sombra = setor.modoIa === 'sombra' && triagem !== null && triagem.id !== setor.id && acao !== 'recepcao';
    const destino = sombra ? triagem! : setor;
    let nova = await this.acoes.colocarNaFila(c, s, destino.id, {
      ator: { tipo: 'ia' },
      motivo: sombra ? `sombra:${acao}` : acao,
      baixaCerteza: !sombra && acao !== 'encaminhar',
      urgencia: urgencia ?? d?.urgencia ?? 'rotina',
      resumo: s.resumo ?? d?.texto ?? null,
    });
    if (sombra) nova = await this.acoes.atualizar(c, nova, { triagem: true, setor_sugerido_id: setor.id, decisao_sugerida_id: d?.decisaoId ?? null });
    if (d?.decisaoId) {
      await c.tx.client.query('UPDATE decisao_ia SET acao = $2, sombra = $3 WHERE id = $1', [d.decisaoId, acao, sombra]);
    }
    if (avisar) {
      if (acao === 'encaminhar' && !sombra) await this.acoes.enviarEncaminhado(c, nova, setor);
      else await this.acoes.enviarTextoFixo(c, nova, 'encaminhado_baixa_certeza');
    }
    st.encaminhou = true;
  }

  private async encaminharFallback(c: Ctx, s: SolicitacaoRow, st: EstadoFluxo, cfg: ConfigUnidade, a: AnaliseFluxo, motivo: string) {
    const setor = await this.unidades.setorPorChave(c.tx, s.unidade_id, cfg.setorFallback);
    if (!setor) return;
    await this.acoes.enviarTextoFixo(c, s, 'humano');
    await this.acoes.colocarNaFila(c, s, setor.id, { ator: { tipo: 'sistema' }, motivo, resumo: s.resumo ?? st.pedido?.texto ?? a.resumoPt });
    st.encaminhou = true;
  }

  /**
   * Guarda um dado coletado. Quarto + sobrenome com `conferir` confronta com a lista de
   * hóspedes ativos; os outros dados viram uma nota interna para a equipe.
   */
  async registrarDado(c: Ctx, s: SolicitacaoRow, st: EstadoFluxo | null, campo: CampoColeta, v: ValorColetado, conferir: boolean): Promise<SolicitacaoRow> {
    if (st) st.dados[campo] = v;
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'dado_coletado', atorTipo: 'solicitante', atorId: s.solicitante_id, dados: { campo } });
    if (campo === 'quarto_sobrenome' && typeof v !== 'string' && conferir) {
      return this.identificarPorSobrenome(c, s, v.quarto, v.sobrenome);
    }
    await this.acoes.notaInterna(c, s.id, `Hóspede informou ${NOMES_CAMPO[campo]}: ${mascararCampo(campo, v)}`, { tipo: 'sistema' });
    if (!st) {
      const dados = { ...((s.contexto as { dados?: Record<string, unknown> }).dados ?? {}), [campo]: v };
      return this.acoes.atualizar(c, s, { contexto: { ...s.contexto, dados } });
    }
    return s;
  }

  async identificarPorSobrenome(c: Ctx, s: SolicitacaoRow, quarto: string, sobrenome: string): Promise<SolicitacaoRow> {
    const r = await c.tx.client.query<{ local_id: string; sobrenome: string; checkout: string }>(
      `SELECT h.local_id, h.sobrenome, h.checkout::text FROM hospede_ativo h
         JOIN local l ON l.id = h.local_id
        WHERE h.unidade_id = $1 AND lower(l.identificador) = lower($2) AND current_date BETWEEN h.checkin AND h.checkout`,
      [s.unidade_id, quarto],
    );
    const achado = r.rows.find((h) => sobrenomeConfere(sobrenome, h.sobrenome));
    if (!achado || !s.solicitante_id) {
      await this.acoes.enviarTextoFixo(c, s, 'identificacao_pendente');
      await this.acoes.notaInterna(c, s.id, `Identificação não conferiu automaticamente: quarto ${quarto}, sobrenome "${sobrenome}". Confirme com um toque.`, {
        tipo: 'sistema',
      });
      return this.acoes.atualizar(c, s, { contexto: { ...s.contexto, identificacaoPendente: { quarto, sobrenome } } });
    }
    await c.tx.client.query(
      `INSERT INTO vinculo (org_id, unidade_id, solicitante_id, local_id, origem, confirmado, fim)
       VALUES ($1, $2, $3, $4, 'sobrenome', true, $5)`,
      [c.tx.orgId, s.unidade_id, s.solicitante_id, achado.local_id, new Date(`${achado.checkout}T12:00:00-03:00`)],
    );
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'identificado', atorTipo: 'solicitante', atorId: s.solicitante_id, dados: { origem: 'sobrenome' } });
    await this.acoes.enviarTextoFixo(c, s, 'identificacao_ok');
    return this.acoes.atualizar(c, s, { local_id: achado.local_id, identificado: true });
  }
}
