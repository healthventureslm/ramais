import { describe, expect, it } from 'vitest';
import { ConfigUnidade } from '@ramais/contracts';
import { configHotel } from './index.js';

describe('modelo de hotel', () => {
  it('é uma configuração válida', () => {
    expect(() => ConfigUnidade.parse(configHotel)).not.toThrow();
    expect(configHotel.setores.map((s) => s.chave)).toContain(configHotel.setorFallback);
  });

  it('textos usam as mesmas variáveis nos três idiomas', () => {
    for (const [chave, t] of Object.entries(configHotel.textos)) {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      expect(vars(t.es), chave).toBe(vars(t.pt));
      expect(vars(t.en), chave).toBe(vars(t.pt));
    }
  });

  it('rejeita encerramento por inatividade fora da janela de 24 h', () => {
    const r = ConfigUnidade.safeParse({ ...configHotel, tempos: { ...configHotel.tempos, inatividadeEncerraMin: 25 * 60 } });
    expect(r.success).toBe(false);
  });
});
