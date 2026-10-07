function passoRedondo(bruto) {
  const expoente = Math.floor(Math.log10(bruto));
  const base = Math.pow(10, expoente);
  const norm = bruto / base;
  const escolhido = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return escolhido * base;
}
function degraus(loDado, hiDado, quantos = 4) {
  if (!Number.isFinite(loDado) || !Number.isFinite(hiDado)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (loDado === hiDado) {
    loDado -= 1;
    hiDado += 1;
  }
  const passo = passoRedondo((hiDado - loDado) / Math.max(1, quantos));
  const lo = Math.floor(loDado / passo) * passo;
  const hi = Math.ceil(hiDado / passo) * passo;
  const ticks = [];
  for (let v = lo; v <= hi + passo * 1e-9; v += passo) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}
function formatarNumero(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return `${v}`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
export {
  degraus,
  formatarNumero
};
