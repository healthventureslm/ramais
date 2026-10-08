/**
 * Quem está com o app ou a web aberta agora (socket de tempo real conectado), contado no
 * processo da api. Uma api só por enquanto; com várias, isto passa para o adaptador
 * (fetchSockets) ou para uma tabela.
 */
class Conectados {
  private readonly contagem = new Map<string, number>();

  entrou(pessoaId: string): void {
    this.contagem.set(pessoaId, (this.contagem.get(pessoaId) ?? 0) + 1);
  }

  saiu(pessoaId: string): void {
    const n = (this.contagem.get(pessoaId) ?? 0) - 1;
    if (n > 0) this.contagem.set(pessoaId, n);
    else this.contagem.delete(pessoaId);
  }

  online(pessoaId: string): boolean {
    return this.contagem.has(pessoaId);
  }
}

export const conectados = new Conectados();
