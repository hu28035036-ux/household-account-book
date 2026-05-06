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
