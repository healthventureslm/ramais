/**
 * Calibração do gate a partir de pares (confiança, acertou). Serve ao relatório semanal
 * e ao conjunto de regressão: o que importa é se a confiança separa acertos de erros.
 */

export interface Amostra {
  previsto: string;
  correto: string;
  confianca: number;
}

export interface Relatorio {
  total: number;
  acuracia: number;
  /** matriz[correto][previsto] = contagem */
  matriz: Record<string, Record<string, number>>;
  faixas: { de: number; ate: number; n: number; acuracia: number | null }[];
  /** Área sob a curva ROC da confiança como separador de acerto/erro (0,5 = inútil). */
  auroc: number | null;
}

export function relatorio(amostras: Amostra[], faixas = [0, 0.4, 0.6, 0.75, 0.85, 0.95, 1.0001]): Relatorio {
  const matriz: Record<string, Record<string, number>> = {};
  let acertos = 0;
  for (const a of amostras) {
    const linha = (matriz[a.correto] ??= {});
    linha[a.previsto] = (linha[a.previsto] ?? 0) + 1;
    if (a.previsto === a.correto) acertos++;
  }
  const fx = faixas.slice(0, -1).map((de, i) => {
    const ate = faixas[i + 1]!;
    const dentro = amostras.filter((a) => a.confianca >= de && a.confianca < ate);
    const ok = dentro.filter((a) => a.previsto === a.correto).length;
    return { de, ate: Math.min(ate, 1), n: dentro.length, acuracia: dentro.length ? ok / dentro.length : null };
  });
  return {
    total: amostras.length,
    acuracia: amostras.length ? acertos / amostras.length : 0,
    matriz,
    faixas: fx,
    auroc: auroc(amostras),
  };
}

function auroc(amostras: Amostra[]): number | null {
  const pos = amostras.filter((a) => a.previsto === a.correto).map((a) => a.confianca);
  const neg = amostras.filter((a) => a.previsto !== a.correto).map((a) => a.confianca);
  if (!pos.length || !neg.length) return null;
  let soma = 0;
  for (const p of pos) for (const n of neg) soma += p > n ? 1 : p === n ? 0.5 : 0;
  return soma / (pos.length * neg.length);
}

/**
 * Menor limite em que a acurácia das amostras com confiança >= limite atinge o alvo.
 * Exige um mínimo de amostras acima do limite para não calibrar com ruído.
 */
export function sugerirLimite(amostras: Amostra[], alvo: number, minAmostras = 20): number | null {
  const candidatos = [...new Set(amostras.map((a) => a.confianca))].sort((a, b) => a - b);
  for (const limite of candidatos) {
    const acima = amostras.filter((a) => a.confianca >= limite);
    if (acima.length < minAmostras) return null;
    const acc = acima.filter((a) => a.previsto === a.correto).length / acima.length;
    if (acc >= alvo) return limite;
  }
  return null;
}
