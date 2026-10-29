import { NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/shared/schema';
import { generateCaseStudyService } from '@/backend/task-service';
import { checkRateLimit } from '@/backend/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = checkRateLimit(ip, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan generate. Silakan tunggu ${rateCheck.retryAfterSec} detik sebelum mencoba lagi.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Check if client provided custom key in header
    const headerKey = req.headers.get('x-openai-api-key') || req.headers.get('x-groq-api-key') || req.headers.get('x-api-key');
    if (headerKey && !body.customApiKey) {
      body.customApiKey = headerKey;
    }

    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input form tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const caseStudy = await generateCaseStudyService(parseResult.data);
    return NextResponse.json({ success: true, caseStudy });
  } catch (error) {
    console.error('API /api/generate error:', error);
    const message = (error as Error).message || 'Terjadi kesalahan internal server saat generate soal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
