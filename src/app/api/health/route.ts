import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function pickEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value;
  }
  return null;
}

export async function GET() {
  const groqKey = pickEnvValue('GROQ_API_KEY', 'NEXT_PUBLIC_GROQ_API_KEY');
  const openAiKey = pickEnvValue('OPENAI_API_KEY', 'NEXT_PUBLIC_OPENAI_API_KEY', 'AI_API_KEY', 'OPENAI_KEY');
  const keyPrefix = groqKey
    ? groqKey.slice(0, 6) + '...'
    : openAiKey
    ? openAiKey.slice(0, 6) + '...'
    : 'NOT SET';

  return NextResponse.json({
    status: 'ok',
    env: {
      GROQ_API_KEY: groqKey ? `SET (${keyPrefix})` : 'NOT SET ❌',
      OPENAI_API_KEY: openAiKey ? `SET (${keyPrefix})` : 'NOT SET ❌',
    },
    ready: Boolean(groqKey || openAiKey),
  });
}
