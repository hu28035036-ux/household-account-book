import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFile, setFileStatus } from '@/services/fileService';
import { saveOcrResult, getLatestOcrResult } from '@/services/ocrService';
import { fail, ok } from '@/lib/http/response';

const Body = z.object({
  rawText: z.string().min(1).max(50_000),
  maskedText: z.string().max(50_000).optional(),
  confidence: z.number().min(0).max(1).default(0),
  engine: z.enum(['tesseract_js', 'manual', 'other']).default('tesseract_js'),
});

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const file = await getFile(supabase, u.user.id, params.fileId);
    if (!file) return fail('NOT_FOUND', '파일을 찾을 수 없습니다.');
    if (file.status === 'deleted') return fail('BAD_REQUEST', '삭제된 파일입니다.');

    await setFileStatus(supabase, u.user.id, params.fileId, 'ocr_processing');

    const body = Body.parse(await req.json());
    const row = await saveOcrResult(supabase, u.user.id, {
      uploadedFileId: params.fileId,
      rawText: body.rawText,
      maskedText: body.maskedText,
      confidence: body.confidence,
      engine: body.engine,
    });
    return ok(row, { status: 201 });
  } catch (e) {
    try {
      await setFileStatus(supabase, u.user.id, params.fileId, 'failed');
    } catch {
      // ignore
    }
    return fail('BAD_REQUEST', e instanceof Error ? e.message : 'OCR 저장 실패');
  }
}

export async function GET(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const row = await getLatestOcrResult(supabase, u.user.id, params.fileId);
    if (!row) return fail('NOT_FOUND', 'OCR 결과가 없습니다.');
    return ok(row);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
