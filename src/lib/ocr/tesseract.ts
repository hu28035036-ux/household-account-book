'use client';

/**
 * Tesseract.js 클라이언트 측 OCR 래퍼.
 * Vercel 서버리스 함수 시간 한계를 회피하기 위해 브라우저에서 실행한다.
 */

import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

function getLang(): string {
  return process.env.NEXT_PUBLIC_OCR_LANGUAGE ?? 'kor+eng';
}

async function getWorker(onProgress?: (p: number) => void) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import('tesseract.js');
      const w = await Tesseract.createWorker(getLang(), 1, {
        logger: (m: any) => {
          if (typeof m.progress === 'number' && m.status === 'recognizing text') {
            onProgress?.(m.progress);
          }
        },
      });
      return w;
    })();
  }
  return workerPromise;
}

export async function recognizeImage(
  file: File | Blob,
  onProgress?: (p: number) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(onProgress);
  const buffer = await file.arrayBuffer();
  const result = await worker.recognize(buffer as any);
  const text = result?.data?.text ?? '';
  const confidence =
    typeof result?.data?.confidence === 'number' ? Math.max(0, Math.min(1, result.data.confidence / 100)) : 0;
  return { text, confidence };
}

export async function terminateWorker() {
  if (!workerPromise) return;
  const w = await workerPromise;
  await w.terminate();
  workerPromise = null;
}
