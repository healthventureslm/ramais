import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Sessao } from '../../infra/auth.js';
import { Presencas } from './presenca.service.js';

/** Atividade no app mantém a presença viva (sem bloquear a requisição). */
@Injectable()
export class BatimentoInterceptor implements NestInterceptor {
  constructor(private readonly presencas: Presencas) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const s: Sessao | undefined = ctx.switchToHttp().getRequest().sessao;
    if (s?.tipo === 'turno') this.presencas.batimento(s).catch(() => undefined);
    return next.handle();
  }
}
