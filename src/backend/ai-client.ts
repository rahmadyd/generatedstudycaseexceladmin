export interface AICompletionOptions {
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function callChatAI(options: AICompletionOptions): Promise<string> {
  const apiKey =
    options.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OPENAI_API_KEY tidak ditemukan. Harap masukkan API Key OpenAI Anda di tombol "API Key" navbar (Mode BYOK) atau atur Environment Variable di Vercel.'
    );
  }

  const cleanKey = apiKey.replace(/^["']|["']$/g, '').trim();

  // If user provides a Groq key (starts with 'gsk_'), route to Groq, otherwise default to OpenAI ChatGPT
  const isGroqKey = cleanKey.startsWith('gsk_');

  const endpoint = isGroqKey
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const defaultModel = isGroqKey ? 'openai/gpt-oss-120b' : 'gpt-4o-mini';
  const model = options.model || defaultModel;

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.userPrompt });

  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 3500,
      response_format: { type: 'json_object' },
    }),
  });

  // If model not found on Groq, fallback to openai/gpt-oss-20b
  if (!response.ok && isGroqKey && model === 'openai/gpt-oss-120b') {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 3500,
        response_format: { type: 'json_object' },
      }),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error(
        'Limit kuota API tercapai (Rate Limit 429). Tunggu beberapa saat sebelum mencoba lagi.'
      );
    }
    if (response.status === 401) {
      throw new Error(
        'API Key tidak valid (401 Unauthorized). Periksa kembali API Key Anda di menu Pengaturan.'
      );
    }
    let parsedMsg = errorBody;
    try {
      const errObj = JSON.parse(errorBody);
      parsedMsg = errObj.error?.message || errorBody;
    } catch {}
    throw new Error(`AI Provider Error (${response.status}): ${parsedMsg}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('ChatGPT tidak mengembalikan konten JSON yang valid.');
  }

  return content;
}

// Backwards-compatible export
export const callGroqChat = callChatAI;
