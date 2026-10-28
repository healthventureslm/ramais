import { describe, expect, it } from 'vitest';
import { dataLocal, horariosLivres, instanteLocal, totalDoPedido, type ItemAgendavel } from './agenda.js';

const FUSO = 'America/Sao_Paulo';
// Massagem: seg a sex, 09:00 às 12:00, a cada hora, 60 min, duas salas.
const massagem: ItemAgendavel = {
  horarios: [{ dias: [1, 2, 3, 4, 5], inicio: '09:00', fim: '12:00', intervaloMin: 60 }],
  duracaoMin: 60,
  capacidade: 2,
  vagasPor: 'pedido',
  antecedenciaMin: 60,
  diasAFrente: 7,
};
// Quinta, 08/10/2026, 07:00 no Rio.
const agora = instanteLocal('2026-10-08', '07:00', FUSO);

describe('agenda do catálogo', () => {
  it('converte o relógio do hotel para o instante certo', () => {
    expect(instanteLocal('2026-10-08', '09:00', FUSO).toISOString()).toBe('2026-10-08T12:00:00.000Z');
    expect(dataLocal(new Date('2026-10-09T02:30:00Z'), FUSO)).toBe('2026-10-08');
  });

  it('lista os horários da grade que terminam dentro da janela', () => {
    expect(horariosLivres(massagem, '2026-10-09', FUSO, agora, []).map((h) => h.hora)).toEqual(['09:00', '10:00', '11:00']);
    // Sábado: fora da grade.
    expect(horariosLivres(massagem, '2026-10-10', FUSO, agora, [])).toEqual([]);
  });

  it('respeita a antecedência e o limite de dias à frente', () => {
    // Hoje às 07:00, com 60 min de antecedência: 09:00 ainda dá; às 08:30, não.
    expect(horariosLivres(massagem, '2026-10-08', FUSO, agora, []).map((h) => h.hora)).toEqual(['09:00', '10:00', '11:00']);
    const depois = instanteLocal('2026-10-08', '08:30', FUSO);
    expect(horariosLivres(massagem, '2026-10-08', FUSO, depois, []).map((h) => h.hora)).toEqual(['10:00', '11:00']);
    expect(horariosLivres(massagem, '2026-10-20', FUSO, agora, [])).toEqual([]);
  });

  it('tira o horário cheio e conta reserva que se sobrepõe', () => {
    const dez = instanteLocal('2026-10-09', '10:00', FUSO);
    const cheio = [{ inicio: dez, duracaoMin: 60, vagas: 1 }, { inicio: dez, duracaoMin: 60, vagas: 1 }];
    expect(horariosLivres(massagem, '2026-10-09', FUSO, agora, cheio).map((h) => h.hora)).toEqual(['09:00', '11:00']);
    // Uma reserva de 90 min às 09:30 ocupa uma sala às 09:00 e às 10:00.
    const longa = [{ inicio: instanteLocal('2026-10-09', '09:30', FUSO), duracaoMin: 90, vagas: 1 }];
    expect(horariosLivres(massagem, '2026-10-09', FUSO, agora, longa).map((h) => [h.hora, h.livres])).toEqual([
      ['09:00', 1],
      ['10:00', 1],
      ['11:00', 2],
    ]);
  });

  it('vaga por pessoa: o grupo só cabe onde há lugar para todos', () => {
    const passeio: ItemAgendavel = { ...massagem, capacidade: 10, vagasPor: 'pessoa' };
    const oito = [{ inicio: instanteLocal('2026-10-09', '09:00', FUSO), duracaoMin: 60, vagas: 8 }];
    expect(horariosLivres(passeio, '2026-10-09', FUSO, agora, oito, 3).map((h) => h.hora)).toEqual(['10:00', '11:00']);
    expect(horariosLivres({ ...passeio, capacidade: null }, '2026-10-09', FUSO, agora, oito, 50)).toHaveLength(3);
  });

  it('calcula o total', () => {
    expect(totalDoPedido({ tipo: 'compra', precoCentavos: 4800, porPessoa: false }, 2)).toBe(9600);
    expect(totalDoPedido({ tipo: 'agendamento', precoCentavos: 25000, porPessoa: true }, 3)).toBe(75000);
    expect(totalDoPedido({ tipo: 'agendamento', precoCentavos: 18000, porPessoa: false }, 3)).toBe(18000);
    expect(totalDoPedido({ tipo: 'compra', precoCentavos: null, porPessoa: false }, 2)).toBeNull();
  });
});
