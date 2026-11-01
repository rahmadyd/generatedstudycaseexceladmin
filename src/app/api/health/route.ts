import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const groqKeyConfigured = Boolean(process.env.GROQ_API_KEY?.trim());

  return NextResponse.json({
    status: 'ok',
    env: {
      provider: 'Groq',
      GROQ_API_KEY: groqKeyConfigured ? 'SET' : 'NOT SET',
    },
    ready: groqKeyConfigured,
  });
}
