import { BadRequestException } from '@nestjs/common';
import { MIDIA_MAX_BYTES, type ArquivoMidia } from '@ramais/contracts';

const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/webm': 'webm',
  'audio/amr': 'amr',
  'audio/3gpp': '3gp',
};

/** "audio/ogg; codecs=opus" → "audio/ogg". */
export const mimeBase = (mime: string) => mime.split(';')[0]!.trim().toLowerCase();

/** O WhatsApp aceita áudio aac, amr, mp3, m4a e ogg/opus. O resto vai como transcrição. */
export function audioAceitoNoWhatsapp(mime: string): boolean {
  return ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/opus'].includes(
    mimeBase(mime),
  );
}

/** Confere tipo, formato e tamanho de um arquivo enviado pela equipe ou pelo hóspede no chat web. */
export function lerArquivo(a: ArquivoMidia): { dados: Buffer; mime: string; ext: string } {
  const mime = mimeBase(a.mime);
  const ext = EXTENSAO[mime];
  if (!ext) throw new BadRequestException('formato de arquivo não aceito');
  if ((a.tipo === 'imagem') !== mime.startsWith('image/')) throw new BadRequestException('o arquivo não é do tipo informado');
  const dados = Buffer.from(a.base64.replace(/^data:[^,]*,/, ''), 'base64');
  if (!dados.length) throw new BadRequestException('arquivo vazio');
  if (dados.length > MIDIA_MAX_BYTES) throw new BadRequestException('arquivo maior que 10 MB');
  return { dados, mime, ext };
}
