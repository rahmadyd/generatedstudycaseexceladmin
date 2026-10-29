export interface GroqCompletionOptions {
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callGroqChat(options: GroqCompletionOptions): Promise<string> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY tidak ditemukan. Harap masukkan API Key Anda di Pengaturan (Mode BYOK) atau atur Environment Variable di Vercel.'
    );
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const model = 'llama-3.3-70b-versatile';

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.userPrompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 3500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error('Limit kuota Groq API tercapai (Rate Limit 429). Tunggu beberapa detik sebelum mencoba lagi.');
    }
    if (response.status === 401) {
      throw new Error('Groq API Key tidak valid (401 Unauthorized). Periksa kembali API Key Anda.');
    }
    throw new Error(`Groq API Error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API tidak mengembalikan konten jawaban yang valid.');
  }

  return content;
}
