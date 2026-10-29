import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const keyPrefix = process.env.GROQ_API_KEY
    ? process.env.GROQ_API_KEY.slice(0, 6) + '...'
    : process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY.slice(0, 6) + '...'
    : 'NOT SET';

  return NextResponse.json({
    status: 'ok',
    env: {
      GROQ_API_KEY: hasGroqKey ? `SET (${keyPrefix})` : 'NOT SET ❌',
      OPENAI_API_KEY: hasOpenAIKey ? `SET (${keyPrefix})` : 'NOT SET ❌',
    },
    ready: hasGroqKey || hasOpenAIKey,
  });
}
