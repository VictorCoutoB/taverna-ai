export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Chamado a cada pedaço de texto recebido (streaming). */
  onToken?: (chunk: string) => void;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface TextProvider {
  id: string;
  listModels(): Promise<ModelInfo[]>;
  chat(messages: ChatMessage[], options: ChatOptions): Promise<string>;
  testKey(): Promise<void>;
}

export interface ImageOptions {
  model: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  /** Imagem de referência (data URI base64) para manter o personagem consistente. */
  referenceImage?: string;
  signal?: AbortSignal;
}

export interface ImageProvider {
  id: string;
  supportsReference: boolean;
  listModels(): Promise<ModelInfo[]>;
  /** Retorna a imagem como data URI (data:image/png;base64,...). */
  generate(prompt: string, options: ImageOptions): Promise<string>;
  testKey(): Promise<void>;
}

export interface Voice {
  id: string;
  name: string;
}

export interface SpeechProvider {
  id: string;
  listVoices(): Promise<Voice[]>;
  speak(text: string, voiceId?: string): Promise<void>;
  stop(): Promise<void>;
}

export type ProviderErrorKind = 'invalid_key' | 'no_credit' | 'plan_limit' | 'rate_limit' | 'network' | 'unavailable' | 'bad_response' | 'unknown';

export class ProviderError extends Error {
  constructor(
    public kind: ProviderErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
