import { NextRequest, NextResponse } from 'next/server';
import { RegenerateTaskRequestSchema } from '@/shared/schema';
import { regenerateTaskService } from '@/backend/task-service';
import { checkRateLimit } from '@/backend/rate-limit';
import { GroqApiError, GroqResponseParseError } from '@/backend/ai-client';
import {
  GENERATION_RATE_LIMIT_WINDOW_MS,
  REGENERATE_RATE_LIMIT_REQUESTS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const body = await req.json();

    const parseResult = RegenerateTaskRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const rateCheck = checkRateLimit(
      `regenerate:${ip}`,
      REGENERATE_RATE_LIMIT_REQUESTS,
      GENERATION_RATE_LIMIT_WINDOW_MS,
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Batas perlindungan aplikasi tercapai (${REGENERATE_RATE_LIMIT_REQUESTS} permintaan per menit). Coba lagi dalam ${rateCheck.retryAfterSec} detik.`,
          code: 'APP_RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec,
        },
        { status: 429 },
      );
    }

    const updatedCaseStudy = await regenerateTaskService(parseResult.data);
    return NextResponse.json({ success: true, caseStudy: updatedCaseStudy });
  } catch (error) {
    console.error('API /api/regenerate-task error:', error);
    if (error instanceof GroqApiError && error.status === 429) {
      const waitMessage = error.retryAfterSeconds === undefined
        ? 'Groq tidak menyertakan estimasi waktu reset pada header.'
        : `Coba lagi dalam sekitar ${error.retryAfterSeconds} detik.`;
      return NextResponse.json(
        {
          error: `Groq menolak permintaan karena rate limit/kuota (HTTP 429). ${waitMessage}`,
          code: 'AI_RATE_LIMITED',
          retryAfterSeconds: error.retryAfterSeconds,
          providerMessage: error.providerMessage,
          rateLimitHeaders: error.rateLimitHeaders,
        },
        { status: 429 },
      );
    }
    if (error instanceof GroqApiError && error.status === 401) {
      return NextResponse.json(
        {
          error: 'Autentikasi Groq gagal (HTTP 401). Periksa GROQ_API_KEY pada environment server yang aktif.',
          code: 'AI_AUTHENTICATION_ERROR',
        },
        { status: 401 },
      );
    }
    if (error instanceof GroqApiError && error.status >= 500) {
      return NextResponse.json(
        {
          error: `Layanan Groq sedang mengalami gangguan (HTTP ${error.status}). Coba lagi nanti.`,
          code: 'AI_PROVIDER_UNAVAILABLE',
        },
        { status: 502 },
      );
    }
    if (error instanceof GroqResponseParseError ||
      (error instanceof Error && error.message.includes('Gagal parse JSON'))) {
      return NextResponse.json(
        { error: 'Groq mengembalikan output yang bukan JSON valid.', code: 'AI_INVALID_JSON' },
        { status: 502 },
      );
    }
    const message = (error as Error).message || 'Gagal meregenerate tugas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
