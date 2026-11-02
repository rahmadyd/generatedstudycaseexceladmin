import { NextRequest, NextResponse } from 'next/server';
import { GenerateMissingCaseContentRequestSchema } from '@/shared/schema';
import {
  generateMissingCaseContentService,
  StagedContentGenerationError,
} from '@/backend/task-service';
import { GroqApiError, GroqResponseParseError } from '@/backend/ai-client';
import { checkRateLimit } from '@/backend/rate-limit';
import {
  ANSWER_KEY_RATE_LIMIT_REQUESTS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const parseResult = GenerateMissingCaseContentRequestSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Data studi kasus tidak valid.' },
        { status: 400 },
      );
    }

    const rateCheck = checkRateLimit(
      `missing-content:${ip}`,
      ANSWER_KEY_RATE_LIMIT_REQUESTS,
      GENERATION_RATE_LIMIT_WINDOW_MS,
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Batas perlindungan aplikasi tercapai (${ANSWER_KEY_RATE_LIMIT_REQUESTS} permintaan per menit). Coba lagi dalam ${rateCheck.retryAfterSec} detik.`,
          code: 'APP_RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec,
        },
        { status: 429 },
      );
    }

    const caseStudy = await generateMissingCaseContentService(parseResult.data.caseStudy);
    return NextResponse.json({ success: true, caseStudy });
  } catch (error) {
    console.error('API /api/generate-missing-content error:', error);
    if (error instanceof StagedContentGenerationError) {
      const providerError = error.originalError instanceof GroqApiError ? error.originalError : null;
      if (providerError?.status === 429) {
        const waitMessage = providerError.retryAfterSeconds === undefined
          ? 'Groq tidak menyertakan estimasi waktu reset pada header.'
          : `Coba lagi dalam sekitar ${providerError.retryAfterSeconds} detik.`;
        return NextResponse.json(
          {
            error: `Groq menolak permintaan karena rate limit/kuota (HTTP 429). ${waitMessage}`,
            code: 'AI_RATE_LIMITED',
            retryAfterSeconds: providerError.retryAfterSeconds,
            providerMessage: providerError.providerMessage,
            rateLimitHeaders: providerError.rateLimitHeaders,
            caseStudy: error.partialCaseStudy,
          },
          {
            status: 429,
            headers: providerError.retryAfterSeconds === undefined
              ? undefined
              : { 'Retry-After': String(providerError.retryAfterSeconds) },
          },
        );
      }
      if (providerError?.status === 401) {
        return NextResponse.json(
          {
            error: 'Autentikasi Groq gagal (HTTP 401). Periksa GROQ_API_KEY pada environment server yang aktif.',
            code: 'AI_AUTHENTICATION_ERROR',
            caseStudy: error.partialCaseStudy,
          },
          { status: 401 },
        );
      }
      if (providerError && providerError.status >= 500) {
        return NextResponse.json(
          {
            error: `Layanan Groq sedang mengalami gangguan (HTTP ${providerError.status}). Coba lagi nanti.`,
            code: 'AI_PROVIDER_UNAVAILABLE',
            caseStudy: error.partialCaseStudy,
          },
          { status: 502 },
        );
      }
      if (error.originalError instanceof GroqResponseParseError ||
        (error.originalError instanceof Error &&
          error.originalError.message.includes('Gagal membaca kunci jawaban bertahap'))) {
        return NextResponse.json(
          {
            error: 'Groq mengembalikan output kunci jawaban yang bukan JSON valid.',
            code: 'AI_INVALID_JSON',
            caseStudy: error.partialCaseStudy,
          },
          { status: 502 },
        );
      }
      return NextResponse.json(
        {
          error: error.message,
          caseStudy: error.partialCaseStudy,
        },
        { status: 500 },
      );
    }
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
      (error instanceof Error && error.message.includes('Gagal membaca kunci jawaban bertahap'))) {
      return NextResponse.json(
        { error: 'Groq mengembalikan output yang bukan JSON valid.', code: 'AI_INVALID_JSON' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: (error as Error).message || 'Gagal melengkapi kunci dan bagian portofolio.' },
      { status: 500 },
    );
  }
}
