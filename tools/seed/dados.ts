/**
 * Dados de piloto para desenvolvimento local. NUNCA use estas credenciais fora do
 * banco local: são públicas, estão no repositório.
 */
export const SENHA_DEV = 'ramais-dev-123';
export const PIN_DEV = '123456';

export const CANAL_DEV = {
  phoneNumberId: 'dev-phone-id',
  wabaId: 'dev-waba-id',
  numero: '+55 21 99999-0000',
};

export const PESSOAS: {
  nome: string;
  email: string;
  admin?: boolean;
  idiomas?: string[];
  lotacoes: { setor: string; papel?: 'membro' | 'supervisor'; recebe?: 'sempre' | 'ultimo_recurso' | 'nunca' }[];
}[] = [
  { nome: 'Ana Admin', email: 'admin@hotel.dev', admin: true, lotacoes: [] },
  { nome: 'Rita Recepção', email: 'rita@hotel.dev', idiomas: ['pt', 'es', 'en'], lotacoes: [{ setor: 'recepcao' }] },
  { nome: 'Rafael Supervisor', email: 'rafael@hotel.dev', idiomas: ['pt', 'en'], lotacoes: [{ setor: 'recepcao', papel: 'supervisor', recebe: 'ultimo_recurso' }] },
  { nome: 'Gabi Governança', email: 'gabi@hotel.dev', lotacoes: [{ setor: 'governanca' }] },
  { nome: 'Gustavo Supervisor', email: 'gustavo@hotel.dev', lotacoes: [{ setor: 'governanca', papel: 'supervisor', recebe: 'ultimo_recurso' }] },
  { nome: 'Marcos Manutenção', email: 'marcos@hotel.dev', lotacoes: [{ setor: 'manutencao' }] },
  { nome: 'Mauro Supervisor', email: 'mauro@hotel.dev', lotacoes: [{ setor: 'manutencao', papel: 'supervisor', recebe: 'ultimo_recurso' }] },
  { nome: 'Bia Restaurante', email: 'bia@hotel.dev', idiomas: ['pt', 'es'], lotacoes: [{ setor: 'alimentos_bebidas' }] },
  { nome: 'Carla Concierge', email: 'carla@hotel.dev', idiomas: ['pt', 'en', 'es'], lotacoes: [{ setor: 'concierge' }] },
];

export const QUARTOS = [
  ...Array.from({ length: 10 }, (_, i) => `${101 + i}`),
  ...Array.from({ length: 10 }, (_, i) => `${201 + i}`),
  ...Array.from({ length: 10 }, (_, i) => `${301 + i}`),
];

export const HOSPEDES = [
  { quarto: '302', sobrenome: 'Silva' },
  { quarto: '101', sobrenome: 'Fernández' },
  { quarto: '205', sobrenome: 'Smith' },
  { quarto: '108', sobrenome: 'Oliveira Santos' },
];
