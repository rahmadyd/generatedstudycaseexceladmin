export interface AICompletionOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
}

function normalizeApiKey(value: string): string | null {
  if (!value) return null;
  const cleaned = value.replace(/^\s*["']|["']\s*$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function getGroqApiKey(): string | null {
  return normalizeApiKey(process.env.GROQ_API_KEY ?? '');
}

function getGroqPrimaryModel(): string {
  const configured = process.env.GROQ_MODEL?.trim();
  return configured && configured.length > 0 ? configured : 'llama-3.3-70b-versatile';
}

function getGroqFallbackModel(primaryModel?: string): string {
  const configured = process.env.GROQ_FALLBACK_MODEL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }
  return primaryModel || 'llama-3.3-70b-versatile';
}

export async function callChatAI(options: AICompletionOptions): Promise<string> {
  const groqApiKey = getGroqApiKey();
  if (!groqApiKey) {
    throw new Error(
      'GROQ_API_KEY tidak ditemukan. Tambahkan API key Groq sebagai environment variable server di Vercel, lalu redeploy.'
    );
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const defaultModel = getGroqPrimaryModel();
  const fallbackModel = getGroqFallbackModel(defaultModel);
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
      ...(options.jsonMode === false ? {} : { response_format: { type: 'json_object' } }),
    });

  let activeModel = model;
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: buildBody(model),
  });

  // Fallback only to a second model if explicitly configured and different.
  if (!response.ok && response.status !== 429 && model === defaultModel && fallbackModel !== defaultModel) {
    activeModel = fallbackModel;
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: buildBody(fallbackModel),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMsg = errorBody;
    let providerCode = '';
    try {
      const providerError = JSON.parse(errorBody)?.error;
      parsedMsg = providerError?.message || errorBody;
      providerCode = providerError?.code || providerError?.type || '';
    } catch {}

    if (
      response.status === 400 &&
      options.jsonMode !== false &&
      /failed to generate json/i.test(parsedMsg)
    ) {
      return callChatAI({ ...options, model: activeModel, jsonMode: false });
    }

    if (response.status === 429) {
      const limitDetails = [
        providerCode && `kode: ${providerCode}`,
        response.headers.get('retry-after') && `coba lagi dalam ${response.headers.get('retry-after')} detik`,
        response.headers.get('x-ratelimit-reset-requests') &&
          `reset request: ${response.headers.get('x-ratelimit-reset-requests')}`,
        response.headers.get('x-ratelimit-reset-tokens') &&
          `reset token: ${response.headers.get('x-ratelimit-reset-tokens')}`,
      ].filter(Boolean);
      throw new Error(
        `Groq mengembalikan 429: ${parsedMsg}${limitDetails.length ? ` (${limitDetails.join('; ')})` : ''}`
      );
    }
    if (response.status === 401) {
      throw new Error(
        'GROQ_API_KEY ditolak Groq (401). Pastikan key valid dan sudah diatur pada environment deployment Vercel yang aktif, lalu redeploy.'
      );
    }
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
