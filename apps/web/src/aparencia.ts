/**
 * Aparência escolhida pela pessoa: seguir o sistema, claro ou escuro. Os tokens do DS e o tema
 * Ramais leem `data-theme` no <html>, que vence o `prefers-color-scheme` do sistema.
 * Fica neste navegador (vale também para o chat do quarto aberto nele).
 */
export type Aparencia = 'sistema' | 'claro' | 'escuro';

export const NOMES_APARENCIA: Record<Aparencia, string> = {
  sistema: 'Seguir o sistema',
  claro: 'Claro',
  escuro: 'Escuro',
};

const CHAVE = 'ramais.aparencia';

export function aparenciaSalva(): Aparencia {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarAparencia(a: Aparencia) {
  const raiz = document.documentElement;
  if (a === 'sistema') delete raiz.dataset.theme;
  else raiz.dataset.theme = a === 'claro' ? 'light' : 'dark';
  // Barras de rolagem e campos nativos acompanham.
  raiz.style.colorScheme = a === 'sistema' ? 'light dark' : a === 'claro' ? 'light' : 'dark';
}

export function salvarAparencia(a: Aparencia) {
  aplicarAparencia(a);
  try {
    if (a === 'sistema') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, a);
  } catch {
    // sem armazenamento: vale até fechar a aba
  }
}
