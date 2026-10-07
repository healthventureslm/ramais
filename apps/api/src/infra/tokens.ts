/** Tokens de injeção para provedores que não são classes. */
export const POOL = Symbol('POOL');
export const BOSS = Symbol('BOSS');
export const IA = Symbol('IA');
export const CONFIG = Symbol('CONFIG');
export const PROCESSO = Symbol('PROCESSO');

export type Processo = 'api' | 'worker';
