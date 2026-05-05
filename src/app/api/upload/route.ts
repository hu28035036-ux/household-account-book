import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { uploadFile } from '@/services/fileService';
import { fail, ok } from '@/lib/http/response';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap (Vercel Hobby payload 한계 고려)

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  try {
    const form = await req.formData();
    const files = form.getAll('files').filter((v): v is File => v instanceof File);
    if (files.length === 0) return fail('BAD_REQUEST', '파일이 비어 있습니다.');

    const created: any[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        return fail('BAD_REQUEST', `파일이 너무 큽니다(>${MAX_BYTES / 1024 / 1024}MB): ${f.name}`);
      }
      if (!/^image\//.test(f.type) && !f.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) {
        return fail('BAD_REQUEST', `이미지 파일만 허용합니다: ${f.name}`);
      }
      const row = await uploadFile(supabase, u.user.id, f);
      created.push(row);
    }
    return ok({ files: created }, { status: 201 });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '업로드 실패');
  }
}
