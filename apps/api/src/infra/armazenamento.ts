import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Mídia (fotos, áudios) guardada fora do banco. As chaves sempre começam com o org,
 * e o acesso passa pela API, que confere o tenant antes de liberar.
 */
export interface Armazenamento {
  salvar(chave: string, dados: Buffer, mime: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  /** URL temporária para o cliente baixar direto, ou null se a API deve servir. */
  urlTemporaria(chave: string, segundos?: number): Promise<string | null>;
}

const CHAVE_VALIDA = /^[a-zA-Z0-9/_.-]+$/;

function validar(chave: string): string {
  if (!CHAVE_VALIDA.test(chave) || chave.includes('..')) throw new Error('chave de mídia inválida');
  return chave;
}

export class ArmazenamentoLocal implements Armazenamento {
  private readonly raiz: string;
  constructor(dir: string) {
    this.raiz = resolve(dir);
  }
  private caminho(chave: string) {
    return join(this.raiz, validar(chave));
  }
  async salvar(chave: string, dados: Buffer) {
    const p = this.caminho(chave);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, dados);
  }
  async ler(chave: string) {
    return readFile(this.caminho(chave));
  }
  async urlTemporaria() {
    return null;
  }
}

export class ArmazenamentoS3 implements Armazenamento {
  private readonly s3: S3Client;
  constructor(
    private readonly bucket: string,
    regiao: string,
  ) {
    this.s3 = new S3Client({ region: regiao });
  }
  async salvar(chave: string, dados: Buffer, mime: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: validar(chave),
        Body: dados,
        ContentType: mime,
        ServerSideEncryption: 'AES256',
      }),
    );
  }
  async ler(chave: string) {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: validar(chave) }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async urlTemporaria(chave: string, segundos = 300) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: validar(chave) }), { expiresIn: segundos });
  }
}
