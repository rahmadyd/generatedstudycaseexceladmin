import { NextRequest, NextResponse } from 'next/server';
import { RegenerateTaskRequestSchema } from '@/shared/schema';
import { regenerateTaskService } from '@/backend/task-service';
import { checkRateLimit } from '@/backend/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = checkRateLimit(ip, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit tercapai. Silakan tunggu ${rateCheck.retryAfterSec} detik.`,
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
    const message = (error as Error).message || 'Gagal meregenerate tugas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
