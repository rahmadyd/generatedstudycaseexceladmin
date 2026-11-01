import { NextRequest, NextResponse } from 'next/server';
import { GenerateMissingCaseContentRequestSchema } from '@/shared/schema';
import {
  generateMissingCaseContentService,
  StagedContentGenerationError,
} from '@/backend/task-service';
import { GroqApiError } from '@/backend/ai-client';
import { checkMinimumInterval, checkRateLimit } from '@/backend/rate-limit';
import {
  ANSWER_KEY_RATE_LIMIT_REQUESTS,
  GENERATION_MIN_INTERVAL_MS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
  GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const cooldownCheck = checkMinimumInterval(`missing-content:${ip}`, GENERATION_MIN_INTERVAL_MS);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Permintaan terlalu cepat. Silakan tunggu sebelum mencoba lagi.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: cooldownCheck.retryAfterSec ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 },
      );
    }

    const rateCheck = checkRateLimit(
      ip,
      ANSWER_KEY_RATE_LIMIT_REQUESTS,
      GENERATION_RATE_LIMIT_WINDOW_MS,
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan untuk melengkapi kasus. Tunggu ${rateCheck.retryAfterSec} detik.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 },
      );
    }

    const parseResult = GenerateMissingCaseContentRequestSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Data studi kasus tidak valid.' },
        { status: 400 },
      );
    }

    const caseStudy = await generateMissingCaseContentService(parseResult.data.caseStudy);
    return NextResponse.json({ success: true, caseStudy });
  } catch (error) {
    console.error('API /api/generate-missing-content error:', error);
    if (error instanceof StagedContentGenerationError) {
      const providerError = error.originalError instanceof GroqApiError ? error.originalError : null;
      if (providerError?.status === 429) {
        return NextResponse.json(
          {
            error: 'Batas penggunaan AI tercapai. Bagian yang belum lengkap dapat dicoba lagi nanti.',
            code: 'RATE_LIMITED',
            retryAfterSeconds:
              providerError.retryAfterSeconds ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
            caseStudy: error.partialCaseStudy,
          },
          { status: 429 },
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
      return NextResponse.json(
        {
          error: 'Batas penggunaan AI tercapai. Kunci belum berhasil dibuat; coba lagi setelah batas Groq direset.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: error.retryAfterSeconds ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: (error as Error).message || 'Gagal melengkapi kunci dan bagian portofolio.' },
      { status: 500 },
    );
  }
}
