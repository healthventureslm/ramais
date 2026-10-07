import { ErroMotor, type MotorDecisao, type Pergunta } from '@ramais/contracts';

/**
 * Cadeia de motores com disjuntor (circuit breaker): se um motor falha N vezes
 * seguidas, fica fora por um tempo e a cadeia vai direto para o próximo.
 * O último motor (regras) não pode falhar.
 */

interface EstadoDisjuntor {
  falhas: number;
  abertoAte: number;
}

export interface OpcoesCadeia {
  falhasParaAbrir?: number;
  abertoMs?: number;
  agora?: () => number;
  aoFalhar?: (motor: string, erro: unknown) => void;
}

export class CadeiaMotores implements MotorDecisao {
  readonly nome: string;
  private readonly estado = new Map<string, EstadoDisjuntor>();

  constructor(
    private readonly motores: MotorDecisao[],
    private readonly o: OpcoesCadeia = {},
  ) {
    if (motores.length === 0) throw new Error('cadeia vazia');
    this.nome = `cadeia(${motores.map((m) => m.nome).join(' > ')})`;
  }

  async decidir(r: { estado: string; perguntas: Pergunta[] }) {
    const agora = this.o.agora ?? Date.now;
    const limite = this.o.falhasParaAbrir ?? 3;
    let ultimoErro: unknown = null;
    for (const m of this.motores) {
      const e = this.estado.get(m.nome) ?? { falhas: 0, abertoAte: 0 };
      if (e.abertoAte > agora()) continue;
      try {
        const res = await m.decidir(r);
        this.estado.set(m.nome, { falhas: 0, abertoAte: 0 });
        return res;
      } catch (erro) {
        ultimoErro = erro;
        e.falhas += 1;
        if (e.falhas >= limite) e.abertoAte = agora() + (this.o.abertoMs ?? 60_000);
        this.estado.set(m.nome, e);
        this.o.aoFalhar?.(m.nome, erro);
      }
    }
    throw ultimoErro instanceof ErroMotor ? ultimoErro : new ErroMotor('indisponivel', 'todos os motores falharam');
  }

  /** Para o painel de saúde. */
  status(): { motor: string; aberto: boolean; falhas: number }[] {
    const agora = (this.o.agora ?? Date.now)();
    return this.motores.map((m) => {
      const e = this.estado.get(m.nome);
      return { motor: m.nome, aberto: (e?.abertoAte ?? 0) > agora, falhas: e?.falhas ?? 0 };
    });
  }
}
