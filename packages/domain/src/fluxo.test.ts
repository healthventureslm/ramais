import { describe, expect, it } from 'vitest';
import { avaliarCondicoes, cpfValido, dentroDoHorario, lerCampo, mascararCampo, relogioLocal, type ContextoCondicao } from './index.js';

const ctx = (o: Partial<ContextoCondicao> = {}): ContextoCondicao => ({
  primeiraMensagem: true,
  hora: '14:00',
  diaSemana: 3,
  setor: 'manutencao',
  setorExigeIdentificacao: false,
  idioma: 'pt',
  identificado: false,
  temQuarto: true,
  dados: {},
  urgencia: 'rotina',
  ...o,
});

describe('condições do fluxo', () => {
  it('horário atravessa a meia-noite', () => {
    expect(dentroDoHorario('23:30', '23:00', '07:00')).toBe(true);
    expect(dentroDoHorario('06:59', '23:00', '07:00')).toBe(true);
    expect(dentroDoHorario('07:00', '23:00', '07:00')).toBe(false);
    expect(dentroDoHorario('12:00', '09:00', '18:00')).toBe(true);
  });

  it('todas precisam valer, e "nao" nega', () => {
    const quando = [
      { tipo: 'setor_exige_identificacao' as const, nao: false },
      { tipo: 'identificado' as const, nao: true },
    ];
    expect(avaliarCondicoes(quando, ctx({ setorExigeIdentificacao: true }))).toBe(true);
    expect(avaliarCondicoes(quando, ctx({ setorExigeIdentificacao: true, identificado: true }))).toBe(false);
    expect(avaliarCondicoes([], ctx())).toBe(true);
    expect(avaliarCondicoes([{ tipo: 'setor', setores: ['spa'], nao: false }], ctx())).toBe(false);
    expect(avaliarCondicoes([{ tipo: 'dia_semana', dias: [0, 6], nao: false }], ctx({ diaSemana: 6 }))).toBe(true);
    expect(avaliarCondicoes([{ tipo: 'dado', campo: 'nome', nao: false }], ctx({ dados: { nome: 'Ana Silva' } }))).toBe(true);
  });

  it('relógio local no fuso da unidade', () => {
    // 2026-10-05 02:30 UTC = 23:30 de domingo em São Paulo.
    expect(relogioLocal(new Date('2026-10-05T02:30:00Z'), 'America/Sao_Paulo')).toEqual({ hora: '23:30', diaSemana: 0 });
  });
});

describe('dados coletados', () => {
  it('CPF com dígito verificador', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(lerCampo('cpf', 'meu cpf é 529.982.247-25')).toBe('52998224725');
    expect(mascararCampo('cpf', '52998224725')).toBe('***.982.***-25');
  });

  it('lê nome, e-mail, reserva, data e quarto+sobrenome', () => {
    expect(lerCampo('nome', 'Lucía Fernández')).toBe('Lucía Fernández');
    expect(lerCampo('nome', 'oi')).toBeNull();
    expect(lerCampo('email', 'É ana.silva@gmail.com, obrigada')).toBe('ana.silva@gmail.com');
    expect(lerCampo('reserva', 'reserva: abc12345')).toBe('ABC12345');
    expect(lerCampo('reserva', 'não sei')).toBeNull();
    expect(lerCampo('data', 'chego dia 5/10/26')).toBe('05/10/2026');
    expect(lerCampo('quarto_sobrenome', '302 Silva')).toEqual({ quarto: '302', sobrenome: 'silva' });
  });
});
