import { NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/shared/schema';
import { generateCaseStudyService } from '@/backend/task-service';
import { getCaseBankFallback } from '@/backend/case-bank';
import { checkMinimumInterval, checkRateLimit } from '@/backend/rate-limit';
import { GroqApiError } from '@/backend/ai-client';
import {
  GENERATION_CONFIG,
  GENERATION_MIN_INTERVAL_MS,
  GENERATION_RATE_LIMIT_REQUESTS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
  GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const cooldownCheck = checkMinimumInterval(`generate:${ip}`, GENERATION_MIN_INTERVAL_MS);
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

    const rateCheck = checkRateLimit(ip, GENERATION_RATE_LIMIT_REQUESTS, GENERATION_RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan generate. Silakan tunggu ${rateCheck.retryAfterSec} detik sebelum mencoba lagi.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input form tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const request = parseResult.data;
    const taskCountConfig = GENERATION_CONFIG[request.level];
    if (
      request.taskCountMode === 'manual' &&
      !taskCountConfig.taskCountOptions.includes(request.taskCount)
    ) {
      return NextResponse.json(
        {
          error: `Jumlah tugas untuk level ${request.level} harus ${taskCountConfig.taskCountOptions.join(' atau ')}.`,
        },
        { status: 400 }
      );
    }

    try {
      const caseStudy = await generateCaseStudyService(request);
      return NextResponse.json({ success: true, caseStudy });
    } catch (error) {
      if (error instanceof GroqApiError && error.status === 429) {
        const fallbackCase = getCaseBankFallback(request);
        if (fallbackCase) {
          return NextResponse.json({ success: true, caseStudy: fallbackCase });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('API /api/generate error:', error);
    if (error instanceof GroqApiError && error.status === 429) {
      return NextResponse.json(
        {
          error: 'Batas penggunaan AI tercapai. Coba lagi setelah batas Groq direset.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: error.retryAfterSeconds ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 },
      );
    }
    const message = (error as Error).message || 'Terjadi kesalahan internal server saat generate soal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
