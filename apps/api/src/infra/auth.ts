import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify, SignJWT } from 'jose';
import type { Config } from '../config.js';
import { CONFIG } from './tokens.js';

/**
 * Tokens:
 *   web          pessoa logada no computador (recepção, supervisão, admin)
 *   turno        pessoa no app, com presença aberta naquele dispositivo
 *   dispositivo  o celular cadastrado na unidade, antes de alguém entrar no turno
 */
export type TipoSessao = 'web' | 'turno' | 'dispositivo';

export interface Sessao {
  tipo: TipoSessao;
  orgId: string;
  pessoaId: string | null;
  dispositivoId: string | null;
  unidadeId: string | null;
  presencaId: string | null;
}

const DURACAO: Record<TipoSessao, string> = { web: '12h', turno: '16h', dispositivo: '365d' };

@Injectable()
export class Tokens {
  private readonly chave: Uint8Array;
  constructor(@Inject(CONFIG) cfg: Config) {
    this.chave = new TextEncoder().encode(cfg.JWT_SEGREDO);
  }

  assinar(s: Sessao): Promise<string> {
    return new SignJWT({
      tipo: s.tipo,
      org: s.orgId,
      disp: s.dispositivoId,
      uni: s.unidadeId,
      pres: s.presencaId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.pessoaId ?? '')
      .setIssuedAt()
      .setIssuer('ramais')
      .setExpirationTime(DURACAO[s.tipo])
      .sign(this.chave);
  }

  async verificar(token: string): Promise<Sessao> {
    const { payload } = await jwtVerify(token, this.chave, { issuer: 'ramais', algorithms: ['HS256'] });
    const tipo = payload.tipo as TipoSessao;
    if (!['web', 'turno', 'dispositivo'].includes(tipo) || typeof payload.org !== 'string') {
      throw new UnauthorizedException('token inválido');
    }
    return {
      tipo,
      orgId: payload.org,
      pessoaId: payload.sub || null,
      dispositivoId: (payload.disp as string | null) ?? null,
      unidadeId: (payload.uni as string | null) ?? null,
      presencaId: (payload.pres as string | null) ?? null,
    };
  }
}

export const PUBLICO = 'rota:publica';
export const TIPOS = 'rota:tipos';

/** Rota sem autenticação (webhook, login). */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Restringe a rota a tipos de sessão. Padrão: web e turno. */
export const ApenasSessoes = (...tipos: TipoSessao[]) => SetMetadata(TIPOS, tipos);

@Injectable()
export class GuardaAuth implements CanActivate {
  constructor(
    private readonly tokens: Tokens,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;
    const req = ctx.switchToHttp().getRequest();
    const cab: string | undefined = req.headers.authorization;
    if (!cab?.startsWith('Bearer ')) throw new UnauthorizedException();
    let sessao: Sessao;
    try {
      sessao = await this.tokens.verificar(cab.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const tipos = this.reflector.getAllAndOverride<TipoSessao[] | undefined>(TIPOS, alvos) ?? ['web', 'turno'];
    if (!tipos.includes(sessao.tipo)) throw new ForbiddenException('sessão não permitida nesta rota');
    req.sessao = sessao;
    return true;
  }
}

export const SessaoAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Sessao => {
  return ctx.switchToHttp().getRequest().sessao;
});

/** Sessão de pessoa (web ou turno): garante pessoaId. */
export function pessoaDa(s: Sessao): string {
  if (!s.pessoaId) throw new ForbiddenException('é preciso entrar como pessoa');
  return s.pessoaId;
}
