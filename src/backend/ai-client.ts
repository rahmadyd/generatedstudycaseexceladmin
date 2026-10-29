export interface AICompletionOptions {
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

function normalizeApiKey(value?: string): string | null {
  if (!value) return null;
  const cleaned = value.replace(/^\s*["']|["']\s*$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function resolveApiKey(explicitApiKey?: string): { key: string; source: string } | null {
  const candidates: Array<{ value?: string; source: string }> = [
    { value: explicitApiKey, source: 'request' },
    { value: process.env.GROQ_API_KEY, source: 'GROQ_API_KEY' },
    { value: process.env.OPENAI_API_KEY, source: 'OPENAI_API_KEY' },
    { value: process.env.NEXT_PUBLIC_GROQ_API_KEY, source: 'NEXT_PUBLIC_GROQ_API_KEY' },
    { value: process.env.NEXT_PUBLIC_OPENAI_API_KEY, source: 'NEXT_PUBLIC_OPENAI_API_KEY' },
    { value: process.env.AI_API_KEY, source: 'AI_API_KEY' },
    { value: process.env.OPENAI_KEY, source: 'OPENAI_KEY' },
  ];

  for (const candidate of candidates) {
    const normalized = normalizeApiKey(candidate.value);
    if (normalized) {
      return { key: normalized, source: candidate.source };
    }
  }

  return null;
}

function getGroqPrimaryModel(): string {
  const configured = process.env.GROQ_MODEL?.trim();
  return configured && configured.length > 0 ? configured : 'llama-3.3-70b-versatile';
}

function getGroqFallbackModel(): string {
  const configured = process.env.GROQ_FALLBACK_MODEL?.trim();
  return configured && configured.length > 0 ? configured : 'llama-3.1-8b-instant';
}

export async function callChatAI(options: AICompletionOptions): Promise<string> {
  const resolved = resolveApiKey(options.apiKey);
  if (!resolved) {
    throw new Error(
      'API Key tidak ditemukan. Pastikan environment variable GROQ_API_KEY atau OPENAI_API_KEY sudah diset di Vercel.'
    );
  }

  const cleanKey = resolved.key;

  // Detect provider dari prefix key
  const isGroqKey = cleanKey.startsWith('gsk_');

  const endpoint = isGroqKey
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const defaultModel = isGroqKey ? getGroqPrimaryModel() : 'gpt-4o-mini';
  const fallbackModel = isGroqKey ? getGroqFallbackModel() : 'gpt-4o-mini';
  const model = options.model || defaultModel;

  const messages: { role: string; content: string }[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.userPrompt });

  const buildBody = (m: string) =>
    JSON.stringify({
      model: m,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 3500,
      response_format: { type: 'json_object' },
    });

  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: buildBody(model),
  });

  // Fallback to a still-supported Groq model if the main model fails.
  if (!response.ok && isGroqKey && model === defaultModel && fallbackModel !== defaultModel) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: buildBody(fallbackModel),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error(
        'Limit kuota API tercapai (429). Tunggu beberapa saat lalu coba lagi.'
      );
    }
    if (response.status === 401) {
      throw new Error(
        'API Key tidak valid (401). Periksa kembali nilai GROQ_API_KEY atau OPENAI_API_KEY di Vercel.'
      );
    }
    let parsedMsg = errorBody;
    try {
      parsedMsg = JSON.parse(errorBody)?.error?.message || errorBody;
    } catch {}
    throw new Error(`AI Error (${response.status}): ${parsedMsg}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI tidak mengembalikan konten yang valid.');
  }

  return content;
}

// Backwards-compatible alias
export const callGroqChat = callChatAI;
