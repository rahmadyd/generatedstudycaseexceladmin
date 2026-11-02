import { NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/shared/schema';
import { generateCaseStudyService } from '@/backend/task-service';
import { checkRateLimit } from '@/backend/rate-limit';
import { DatasetValidationError } from '@/shared/dataset-validation';
import { UnknownColumnTypeError } from '@/lib/column-types';
import {
  GroqApiError,
  GroqJsonValidationError,
  GroqResponseParseError,
} from '@/backend/ai-client';
import {
  GENERATION_CONFIG,
  GENERATION_RATE_LIMIT_REQUESTS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
} from '@/shared/generation-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const body = await req.json();

    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input form tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const request = parseResult.data;
    const rateCheck = checkRateLimit(
      `generate:${req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'}`,
      GENERATION_RATE_LIMIT_REQUESTS,
      GENERATION_RATE_LIMIT_WINDOW_MS,
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Batas perlindungan aplikasi tercapai (${GENERATION_RATE_LIMIT_REQUESTS} permintaan per menit). Coba lagi dalam ${rateCheck.retryAfterSec} detik.`,
          code: 'APP_RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSec,
        },
        { status: 429, headers: NO_STORE_HEADERS },
      );
    }

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
    if (error instanceof DatasetValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'DATASET_VALIDATION_ERROR',
          issues: error.issues.slice(0, 5),
        },
        { status: 422, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof UnknownColumnTypeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'UNKNOWN_COLUMN_TYPE',
          column: error.columnName,
        },
        { status: 422, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof GroqJsonValidationError) {
      return NextResponse.json(
        {
          error: 'Groq gagal memvalidasi JSON setelah satu kali percobaan ulang. Coba generate kembali; output mentah model tersedia di log server.',
          code: 'AI_JSON_VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS },
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
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            ...(error.retryAfterSeconds === undefined
              ? {}
              : { 'Retry-After': String(error.retryAfterSeconds) }),
          },
        },
      );
    }
    if (error instanceof GroqApiError && error.status === 401) {
      return NextResponse.json(
        {
          error: 'Autentikasi Groq gagal (HTTP 401). Periksa GROQ_API_KEY pada environment server yang aktif, lalu restart atau redeploy.',
          code: 'AI_AUTHENTICATION_ERROR',
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof GroqApiError && error.status >= 500) {
      return NextResponse.json(
        {
          error: `Layanan Groq sedang mengalami gangguan (HTTP ${error.status}). Coba lagi nanti.`,
          code: 'AI_PROVIDER_UNAVAILABLE',
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof GroqResponseParseError ||
      (error instanceof Error && (
        error.message.includes('Gagal parse JSON dari AI') ||
        error.message.includes('Gagal membaca formula clues dan kunci jawaban') ||
        error.message.includes('bukan JSON valid')
      ))) {
      return NextResponse.json(
        {
          error: 'Groq mengembalikan output yang bukan JSON valid setelah percobaan perbaikan. Silakan coba generate ulang.',
          code: 'AI_INVALID_JSON',
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }
    const message = (error as Error).message || 'Terjadi kesalahan internal server saat generate soal.';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
