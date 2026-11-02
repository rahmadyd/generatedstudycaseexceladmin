export interface AICompletionOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
  requestId?: string;
  callNumber?: number;
  level?: string;
  providerCallNumber?: number;
  allowModelFallback?: boolean;
}

export class GroqApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerCode?: string,
    readonly retryAfterSeconds?: number,
    readonly providerMessage?: string,
    readonly rateLimitHeaders?: Record<string, string>,
  ) {
    super(message);
    this.name = 'GroqApiError';
  }
}

export class GroqResponseParseError extends Error {
  constructor() {
    super('Groq mengembalikan respons yang bukan JSON valid.');
    this.name = 'GroqResponseParseError';
  }
}

export class GroqOutputTruncatedError extends Error {
  constructor() {
    super('Respons Groq terpotong karena mencapai batas token output.');
    this.name = 'GroqOutputTruncatedError';
  }
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

function parseResetDurationSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parts = Array.from(value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g));
  if (parts.length === 0 || parts.map((part) => part[0]).join('') !== value) return undefined;
  const seconds = parts.reduce((total, part) => {
    const amount = Number(part[1]);
    const multiplier = part[2] === 'h' ? 3600 : part[2] === 'm' ? 60 : part[2] === 'ms' ? 0.001 : 1;
    return total + amount * multiplier;
  }, 0);
  return Math.max(0, Math.ceil(seconds));
}

function getRateLimitHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (name.toLocaleLowerCase('en').startsWith('x-ratelimit-')) {
      headers[name] = value;
    }
  });
  return headers;
}

function getRetryAfterSeconds(
  response: Response,
  rateLimitHeaders: Record<string, string>,
): number | undefined {
  const retryAfter = parseRetryAfterSeconds(response.headers.get('retry-after'));
  if (retryAfter !== undefined) return retryAfter;

  const remainingRequests = Number(rateLimitHeaders['x-ratelimit-remaining-requests']);
  const remainingTokens = Number(rateLimitHeaders['x-ratelimit-remaining-tokens']);
  const resetRequests = parseResetDurationSeconds(rateLimitHeaders['x-ratelimit-reset-requests']);
  const resetTokens = parseResetDurationSeconds(rateLimitHeaders['x-ratelimit-reset-tokens']);
  const exhaustedLimitResets = [
    remainingRequests === 0 ? resetRequests : undefined,
    remainingTokens === 0 ? resetTokens : undefined,
  ].filter((value): value is number => value !== undefined);
  return exhaustedLimitResets.length > 0 ? Math.max(...exhaustedLimitResets) : undefined;
}

async function logGroqResponse(
  response: Response,
  options: AICompletionOptions,
  model: string,
  providerCallNumber: number,
): Promise<void> {
  const baseLog = {
    event: 'groq_completion',
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
    level: options.level,
    callNumber: options.callNumber,
    providerCallNumber,
    model,
    status: response.status,
  };

  if (response.ok) {
    let completion: {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      choices?: Array<{ finish_reason?: string }>;
    } | null = null;
    try {
      completion = await response.clone().json();
    } catch (error) {
      console.warn('Unable to parse Groq response metadata for logging:', (error as Error).message);
    }
    console.log(JSON.stringify({
      ...baseLog,
      usage: {
        prompt_tokens: completion?.usage?.prompt_tokens ?? null,
        completion_tokens: completion?.usage?.completion_tokens ?? null,
        total_tokens: completion?.usage?.total_tokens ?? null,
      },
      finishReason: completion?.choices?.[0]?.finish_reason ?? null,
    }));
    return;
  }

  const errorBody = await response.clone().text();
  let providerMessage = errorBody;
  try {
    const providerError = JSON.parse(errorBody)?.error;
    providerMessage = providerError?.message || errorBody;
  } catch (error) {
    console.warn('Groq error response was not JSON:', (error as Error).message);
  }

  const rateLimitHeaders = getRateLimitHeaders(response);
  console.log(JSON.stringify({
    ...baseLog,
    retryAfter: response.headers.get('retry-after'),
    rateLimitHeaders,
    providerMessage,
  }));
}

function logGroqTransportFailure(
  options: AICompletionOptions,
  model: string,
  providerCallNumber: number,
): void {
  console.log(JSON.stringify({
    event: 'groq_completion',
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
    level: options.level,
    callNumber: options.callNumber,
    providerCallNumber,
    model,
    status: null,
    errorType: 'transport',
  }));
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
  return configured && configured.length > 0 ? configured : 'llama-3.1-8b-instant';
}

function getGroqFallbackModel(primaryModel?: string): string {
  const configured = process.env.GROQ_FALLBACK_MODEL?.trim();
  return configured && configured.length > 0 ? configured : primaryModel || '';
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
      ...(m.toLocaleLowerCase('en').includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
      ...(options.jsonMode === true ? { response_format: { type: 'json_object' } } : {}),
    });

  let activeModel = model;
  let providerCallNumber = options.providerCallNumber ?? 0;
  providerCallNumber += 1;
  const trackedFetch: typeof fetch = async (input, init) => {
    try {
      return await globalThis.fetch(input, init);
    } catch (error) {
      logGroqTransportFailure(options, activeModel, providerCallNumber);
      throw error;
    }
  };
  let response = await trackedFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: buildBody(model),
  });

  // Only transient quota/provider failures should switch to the configured model.
  if (
    (response.status === 429 || (response.status >= 500 && response.status < 600)) &&
    options.allowModelFallback !== false &&
    model === defaultModel &&
    fallbackModel.length > 0 &&
    fallbackModel !== defaultModel
  ) {
    await logGroqResponse(response, options, model, providerCallNumber);
    activeModel = fallbackModel;
    providerCallNumber += 1;
    response = await trackedFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: buildBody(fallbackModel),
    });
  }

  await logGroqResponse(response, options, activeModel, providerCallNumber);

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMsg = errorBody;
    let providerCode = '';
    try {
      const providerError = JSON.parse(errorBody)?.error;
      parsedMsg = providerError?.message || errorBody;
      providerCode = providerError?.code || providerError?.type || '';
    } catch (error) {
      console.warn('Unable to parse Groq error payload:', (error as Error).message);
    }

    const rateLimitHeaders = getRateLimitHeaders(response);
    const retryAfterSeconds = response.status === 429
      ? getRetryAfterSeconds(response, rateLimitHeaders)
      : undefined;
    if (response.status === 429) {
      throw new GroqApiError(
        'Groq mengembalikan HTTP 429 (rate limit atau kuota).',
        429,
        providerCode,
        retryAfterSeconds,
        parsedMsg,
        rateLimitHeaders,
      );
    }
    if (response.status === 401) {
      throw new GroqApiError(
        'Groq menolak GROQ_API_KEY (HTTP 401). Periksa environment deployment dan redeploy.',
        401,
        providerCode,
        undefined,
        parsedMsg,
        rateLimitHeaders,
      );
    }
    throw new GroqApiError(
      `Groq mengembalikan HTTP ${response.status}: ${parsedMsg}`,
      response.status,
      providerCode,
      undefined,
      parsedMsg,
      rateLimitHeaders,
    );
  }

  let json: { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  try {
    json = await response.json();
  } catch {
    throw new GroqResponseParseError();
  }
  if (json.choices?.[0]?.finish_reason === 'length') {
    throw new GroqOutputTruncatedError();
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI tidak mengembalikan konten yang valid.');
  }

  return content;
}

// Backwards-compatible alias
export const callGroqChat = callChatAI;
