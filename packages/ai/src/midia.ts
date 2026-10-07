import { lerJson, type ClienteChat } from './openrouter.js';

/**
 * Áudio vira transcrição no idioma original (depois traduzida pelo chamador).
 * Imagem vira descrição, usada para rotear e buscar; quem executa olha a foto.
 */

export interface Multimodal {
  readonly disponivel: boolean;
  transcrever(audio: Buffer, mime: string): Promise<{ texto: string; idioma: string; modelo: string } | null>;
  descrever(imagem: Buffer, mime: string, legenda?: string | null): Promise<{ texto: string; modelo: string } | null>;
}

function formatoAudio(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 'm4a';
  return 'ogg';
}

export class MultimodalLLM implements Multimodal {
  readonly disponivel = true;

  constructor(
    private readonly cliente: ClienteChat,
    private readonly modelo: string,
  ) {}

  async transcrever(audio: Buffer, mime: string) {
    const r = await this.cliente.chat({
      modelo: this.modelo,
      mensagens: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this voice message verbatim, in the language it is spoken. Do not translate. Reply with JSON {"language": ISO 639-1 code, "transcript": string}.',
            },
            { type: 'input_audio', input_audio: { data: audio.toString('base64'), format: formatoAudio(mime) } },
          ],
        },
      ],
      esquema: {
        nome: 'transcricao',
        schema: {
          type: 'object',
          properties: { language: { type: 'string' }, transcript: { type: 'string' } },
          required: ['language', 'transcript'],
          additionalProperties: false,
        },
      },
      maxTokens: 1500,
      timeoutMs: 30_000,
    });
    const j = lerJson(r.conteudo) as { language?: string; transcript?: string };
    if (!j.transcript?.trim()) return null;
    return { texto: j.transcript.trim(), idioma: (j.language ?? 'pt').slice(0, 2).toLowerCase(), modelo: r.modelo };
  }

  async descrever(imagem: Buffer, mime: string, legenda?: string | null) {
    const r = await this.cliente.chat({
      tarefa: 'descricao',
      modelo: this.modelo,
      mensagens: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'A hotel guest sent this photo. In one or two sentences in English, describe what is shown and what problem or request it suggests (e.g. "Water dripping from the air conditioning unit onto the floor").',
                'Do not describe people\'s faces or identify anyone.',
                legenda ? `The guest wrote: "${legenda}"` : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${imagem.toString('base64')}` } },
          ],
        },
      ],
      maxTokens: 200,
      timeoutMs: 20_000,
    });
    const texto = r.conteudo.trim();
    return texto ? { texto, modelo: r.modelo } : null;
  }
}

export class MultimodalNulo implements Multimodal {
  readonly disponivel = false;
  async transcrever() {
    return null;
  }
  async descrever() {
    return null;
  }
}
