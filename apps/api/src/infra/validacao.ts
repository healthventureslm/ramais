import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Valida o corpo com o schema zod compartilhado em @ramais/contracts. */
export class Zod<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}
  transform(valor: unknown): T {
    const r = this.schema.safeParse(valor);
    if (!r.success) {
      throw new BadRequestException({
        mensagem: 'dados inválidos',
        erros: r.error.issues.map((i) => ({ campo: i.path.join('.'), erro: i.message })),
      });
    }
    return r.data;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Uuid implements PipeTransform<string, string> {
  transform(v: string): string {
    if (!UUID.test(v)) throw new BadRequestException('id inválido');
    return v;
  }
}
