import { BANKS } from '@/lib/banking/banks';
import { getActiveProvider } from '@/lib/banking/providers';
import { ok } from '@/lib/http/response';

export async function GET() {
  const provider = getActiveProvider();
  const supported = new Set(provider.supportedBankCodes());
  const list = BANKS.map((b) => ({
    code: b.code,
    name: b.name,
    kind: b.kind,
    easyAuth: !!b.easyAuth,
    // mock 은 supports 가 모두 → 전체 활성. codef 가 비어있으면 전체 비활성.
    supported: supported.size === 0 ? false : supported.has(b.code),
  }));
  return ok({ providerId: provider.id, banks: list });
}

export const dynamic = 'force-dynamic';
