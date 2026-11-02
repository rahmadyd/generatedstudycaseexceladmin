import { NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/shared/schema';
import { generateCaseStudyService } from '@/backend/task-service';
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
export const revalidate = 0;
export const maxDuration = 60;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

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
        { status: 429, headers: NO_STORE_HEADERS },
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
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();

    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input form tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const request = parseResult.data;
    const clientRequestId = req.headers.get('x-client-request-id')?.slice(0, 80);
    console.log('[api/generate] accepted', JSON.stringify({
      clientRequestId,
      role: request.role,
      industry: request.industry ?? 'Acak',
      level: request.level,
      recentThemeCount: request.recentThemes?.length ?? 0,
    }));
    const taskCountConfig = GENERATION_CONFIG[request.level];
    if (
      request.taskCountMode === 'manual' &&
      !taskCountConfig.taskCountOptions.includes(request.taskCount)
    ) {
      return NextResponse.json(
        {
          error: `Jumlah tugas untuk level ${request.level} harus ${taskCountConfig.taskCountOptions.join(' atau ')}.`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const caseStudy = await generateCaseStudyService(request, clientRequestId);
    return NextResponse.json(
      { success: true, caseStudy },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('API /api/generate error:', error);
    if (error instanceof GroqApiError && error.status === 429) {
      return NextResponse.json(
        {
          error: 'Batas penggunaan AI tercapai. Coba lagi setelah batas Groq direset.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: error.retryAfterSeconds ?? GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
        },
        { status: 429, headers: NO_STORE_HEADERS },
      );
    }
    const message = (error as Error).message || 'Terjadi kesalahan internal server saat generate soal.';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
