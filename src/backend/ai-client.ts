export interface AICompletionOptions {
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function callChatAI(options: AICompletionOptions): Promise<string> {
  // Resolve API key dari Vercel environment variable
  const apiKey =
    options.apiKey ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'API Key tidak ditemukan. Pastikan environment variable GROQ_API_KEY sudah diset di Vercel.'
    );
  }

  const cleanKey = apiKey.replace(/^[\"']|[\"']$/g, '').trim();

  // Detect provider dari prefix key
  const isGroqKey = cleanKey.startsWith('gsk_');

  const endpoint = isGroqKey
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  // Model default stabil
  const defaultModel = isGroqKey ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
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

  // Fallback ke mixtral jika primary model Groq gagal
  if (!response.ok && isGroqKey && model === 'llama-3.3-70b-versatile') {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: buildBody('mixtral-8x7b-32768'),
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
        'API Key tidak valid (401). Periksa kembali nilai GROQ_API_KEY di Vercel.'
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
