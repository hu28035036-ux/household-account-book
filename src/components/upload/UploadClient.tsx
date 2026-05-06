'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { FileText } from 'lucide-react';
import { Dropzone } from './Dropzone';
import { OcrPreview } from './OcrPreview';
import { recognizeImage } from '@/lib/ocr/tesseract';
import { extractPdfText } from '@/lib/pdf/extract';
import { maskAll } from '@/lib/security/masking';
import { AiServerStatus } from '@/components/common/StatusBanner';

type Item = {
  localId: string;
  file: File;
  previewUrl: string;
  uploadedFileId?: string;
  uploadProgress: number;
  ocrProgress: number;
  ocrText: string;
  ocrConfidence: number;
  status:
    | 'queued'
    | 'uploading'
    | 'uploaded'
    | 'ocr_running'
    | 'ocr_done'
    | 'analyzing'
    | 'analyzed'
    | 'failed';
  error?: string;
};

export function UploadClient() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  function patch(localId: string, p: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...p } : it)));
  }

  async function uploadOne(item: Item) {
    patch(item.localId, { status: 'uploading', uploadProgress: 30 });
    const fd = new FormData();
    fd.append('files', item.file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) {
      patch(item.localId, { status: 'failed', error: json?.error?.message ?? '업로드 실패' });
      return;
    }
    const fileRow = json?.data?.files?.[0];
    patch(item.localId, { status: 'uploaded', uploadProgress: 100, uploadedFileId: fileRow?.id });
    runOcr({ ...item, uploadedFileId: fileRow?.id });
  }

  async function runOcr(item: Item) {
    if (!item.uploadedFileId) return;
    patch(item.localId, { status: 'ocr_running', ocrProgress: 0 });
    try {
      const isPdf = item.file.type === 'application/pdf' || /\.pdf$/i.test(item.file.name);
      let text = '';
      let confidence = 0;
      let engine: 'tesseract_js' | 'manual' | 'other' = 'tesseract_js';

      if (isPdf) {
        const r = await extractPdfText(item.file, (p) => patch(item.localId, { ocrProgress: p }));
        text = r.text;
        // 텍스트가 거의 안 나오면 영수증 사진 PDF일 가능성 → 사용자 안내
        confidence = r.text.replace(/\s/g, '').length > 20 ? 0.85 : 0.2;
        engine = 'other';
      } else {
        const r = await recognizeImage(item.file, (p) => patch(item.localId, { ocrProgress: p }));
        text = r.text;
        confidence = r.confidence;
        engine = 'tesseract_js';
      }

      const masked = maskAll(text);
      const res = await fetch(`/api/ocr/${item.uploadedFileId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawText: text || '(텍스트 없음)', maskedText: masked, confidence, engine }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? 'OCR 저장 실패');
      }
      patch(item.localId, { status: 'ocr_done', ocrProgress: 1, ocrText: text, ocrConfidence: confidence });
    } catch (e) {
      patch(item.localId, { status: 'failed', error: e instanceof Error ? e.message : 'OCR 실패' });
    }
  }

  async function analyze(item: Item) {
    if (!item.uploadedFileId) return;
    patch(item.localId, { status: 'analyzing' });
    const res = await fetch(`/api/extraction/${item.uploadedFileId}`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      patch(item.localId, { status: 'failed', error: json?.error?.message ?? '분석 실패' });
      return;
    }
    patch(item.localId, { status: 'analyzed' });
    router.push('/candidates');
  }

  function onFiles(files: File[]) {
    const nextItems: Item[] = files.map((f) => ({
      localId: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      uploadProgress: 0,
      ocrProgress: 0,
      ocrText: '',
      ocrConfidence: 0,
      status: 'queued' as const,
    }));
    setItems((prev) => [...nextItems, ...prev]);
    nextItems.forEach((it) => void uploadOne(it));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-semibold text-textPrimary">AI 업로드</h2>
        <Badge tone="muted">OCR은 브라우저에서 실행됩니다</Badge>
      </div>

      <AiServerStatus />

      <Card>
        <CardTitle>📸 영수증·내역 사진 / PDF 업로드 안내</CardTitle>
        <div className="mt-2 space-y-3 text-sm text-textSecondary leading-relaxed">
          <div>
            <div className="font-medium text-textPrimary mb-1">어떤 파일을 올리면 되나요?</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>편의점·마트·식당 등에서 받은 <b>종이 영수증 사진</b></li>
              <li>카드 결제 내역 / 계좌 거래내역 <b>화면 캡처</b></li>
              <li>은행 앱·카드사 앱이 발급한 <b>PDF 명세서</b></li>
              <li>SMS 결제 알림 캡처도 가능</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-textPrimary mb-1">잘 인식되려면</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>가맹점·금액·날짜가 <b>또렷하게</b> 보이도록</li>
              <li>조명이 충분한 곳에서, 영수증을 <b>평평하게</b> 펴고</li>
              <li>한 장에 한 영수증 — 여러 개면 따로 올려주세요</li>
              <li>너무 멀거나 흐릿하면 AI 분석 후 “확인 필요”로 표시됩니다</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-textPrimary mb-1">처리 흐름</div>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>업로드 → 본인 브라우저에서 <b>OCR</b>(텍스트 추출, 약 5~15초)</li>
              <li>민감정보 자동 <b>마스킹</b>(카드/주민/전화/계좌번호)</li>
              <li><b>OpenAI gpt-4o-mini</b> 가 가맹점·금액·카테고리 추정 (1~3초)</li>
              <li>‘분석 후보’ 페이지에 등록 → 검토 후 승인 → 거래내역에 반영</li>
            </ol>
          </div>

          <div className="rounded-md bg-softPinkBackground/60 px-3 py-2 text-xs">
            🔒 OCR 텍스트는 본인 PC/폰 안에서 처리되고, AI에 보내질 때는 카드번호·주민번호·
            전화번호가 자동으로 가려진 상태로 전송됩니다. 원본 텍스트는{' '}
            <b className="text-textPrimary">7일 후 자동 삭제</b>됩니다.
          </div>

          <div className="rounded-md border border-borderSoft px-3 py-2 text-xs text-textMuted">
            💡 비용: 영수증 1장당 약 <b className="text-textSecondary">0.3원</b> 정도 (gpt-4o-mini).
            같은 영수증을 다시 올리면 캐시로 LLM 호출이 생략되어 비용이 더 줄어듭니다.
          </div>
        </div>
      </Card>

      <Dropzone onFiles={onFiles} />

      {items.length === 0 && (
        <Card>
          <CardTitle>아직 올린 파일이 없어요</CardTitle>
          <CardSubtle className="mt-1">
            영수증/카드내역/계좌내역 캡처를 올리면 OCR로 텍스트를 뽑고, 사용자가 확인한 뒤 AI 분석을 시작합니다.
          </CardSubtle>
        </Card>
      )}

      <div className="space-y-4">
        {items.map((it) => (
          <Card key={it.localId} className="space-y-3">
            <div className="flex gap-3">
              {it.file.type === 'application/pdf' || /\.pdf$/i.test(it.file.name) ? (
                <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-lg border border-borderDefault bg-sectionBackground inline-flex items-center justify-center shrink-0 text-textPinkStrong">
                  <FileText className="h-8 w-8" strokeWidth={1.5} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.previewUrl}
                  alt={it.file.name}
                  className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg border border-borderDefault shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium text-textPrimary truncate">{it.file.name}</div>
                  <StatusBadge status={it.status} />
                </div>
                <div className="mt-2 space-y-1">
                  {(it.status === 'uploading' || it.status === 'queued') && (
                    <ProgressLine label="업로드" pct={it.uploadProgress} />
                  )}
                  {(it.status === 'ocr_running' || it.status === 'ocr_done') && (
                    <ProgressLine label="OCR" pct={Math.round(it.ocrProgress * 100)} />
                  )}
                  {it.status === 'failed' && (
                    <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2 mt-2">{it.error}</p>
                  )}
                </div>
              </div>
            </div>

            {(it.status === 'ocr_done' || it.status === 'analyzing' || it.status === 'analyzed') && (
              <OcrPreview
                text={it.ocrText}
                confidence={it.ocrConfidence}
                onChange={(t) => patch(it.localId, { ocrText: t })}
                onAnalyze={() => analyze(it)}
                pending={it.status === 'analyzing'}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProgressLine({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-textSecondary">
        <span>{label}</span>
        <span className="tabular">{pct}%</span>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-borderSoft overflow-hidden">
        <div className="h-full bg-primaryPink transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Item['status'] }) {
  const map: Record<Item['status'], { label: string; tone: any }> = {
    queued: { label: '대기', tone: 'muted' },
    uploading: { label: '업로드 중', tone: 'info' },
    uploaded: { label: '업로드 완료', tone: 'info' },
    ocr_running: { label: 'OCR 진행', tone: 'info' },
    ocr_done: { label: 'OCR 완료', tone: 'success' },
    analyzing: { label: '분석 중', tone: 'pink' },
    analyzed: { label: '후보 생성됨', tone: 'success' },
    failed: { label: '실패', tone: 'danger' },
  };
  const { label, tone } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
