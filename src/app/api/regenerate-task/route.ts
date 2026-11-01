import { NextRequest, NextResponse } from 'next/server';
import { RegenerateTaskRequestSchema } from '@/shared/schema';
import { regenerateTaskService } from '@/backend/task-service';
import { checkMinimumInterval, checkRateLimit } from '@/backend/rate-limit';
import { GroqApiError } from '@/backend/ai-client';
import {
  GENERATION_MIN_INTERVAL_MS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
  GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
  REGENERATE_RATE_LIMIT_REQUESTS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const cooldownCheck = checkMinimumInterval(`regenerate:${ip}`, GENERATION_MIN_INTERVAL_MS);
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

    const rateCheck = checkRateLimit(ip, REGENERATE_RATE_LIMIT_REQUESTS, GENERATION_RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit tercapai. Silakan tunggu ${rateCheck.retryAfterSec} detik.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    const parseResult = RegenerateTaskRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const updatedCaseStudy = await regenerateTaskService(parseResult.data);
    return NextResponse.json({ success: true, caseStudy: updatedCaseStudy });
  } catch (error) {
    console.error('API /api/regenerate-task error:', error);
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
    const message = (error as Error).message || 'Gagal meregenerate tugas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
