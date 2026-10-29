export interface AICompletionOptions {
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function callChatAI(options: AICompletionOptions): Promise<string> {
  // Resolve API key: prefer passed-in key, then env vars
  const apiKey =
    options.apiKey ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY;

  console.log('[ai-client] Resolving API key...');
  console.log('[ai-client] Has GROQ_API_KEY env:', Boolean(process.env.GROQ_API_KEY));
  console.log('[ai-client] Has OPENAI_API_KEY env:', Boolean(process.env.OPENAI_API_KEY));
  console.log('[ai-client] Final key prefix:', apiKey ? apiKey.slice(0, 6) + '...' : 'NONE');

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'API Key tidak ditemukan. Pastikan environment variable GROQ_API_KEY sudah diset di Vercel dan deployment sudah diperbarui.'
    );
  }

  const cleanKey = apiKey.replace(/^[\"']|[\"']$/g, '').trim();

  // Detect provider from key prefix
  const isGroqKey = cleanKey.startsWith('gsk_');

  const endpoint = isGroqKey
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  // Use stable Groq models
  const defaultModel = isGroqKey ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
  const model = options.model || defaultModel;

  console.log('[ai-client] Using endpoint:', endpoint);
  console.log('[ai-client] Using model:', model);

  const messages: { role: string; content: string }[] = [];
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

  // If llama-3.3-70b fails, fallback to mixtral
  if (!response.ok && isGroqKey && model === 'llama-3.3-70b-versatile') {
    console.warn('[ai-client] Primary model failed, falling back to mixtral-8x7b-32768');
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 3500,
        response_format: { type: 'json_object' },
      }),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[ai-client] API error:', response.status, errorBody);
    if (response.status === 429) {
      throw new Error(
        'Limit kuota API tercapai (Rate Limit 429). Tunggu beberapa saat sebelum mencoba lagi.'
      );
    }
    if (response.status === 401) {
      throw new Error(
        'API Key tidak valid (401 Unauthorized). Periksa kembali API Key di environment variable Vercel.'
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
    throw new Error('AI tidak mengembalikan konten JSON yang valid.');
  }

  return content;
}

// Backwards-compatible export
export const callGroqChat = callChatAI;
