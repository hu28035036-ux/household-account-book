'use client';

import { useRef, useState } from 'react';
import { Camera, Upload as UploadIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function Dropzone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handle(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size > 0);
    if (arr.length) onFiles(arr);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (disabled) return;
        handle(e.dataTransfer.files);
      }}
      className={cn(
        'rounded-card border-2 border-dashed bg-pageBackground transition-colors',
        drag ? 'border-primaryPink bg-primaryPinkSoft/40' : 'border-borderDefault',
        'p-6 sm:p-10 text-center',
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primaryPinkSoft text-textPinkStrong inline-flex items-center justify-center">
          <UploadIcon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="text-base font-semibold text-textPrimary">영수증/캡처 이미지를 올려주세요</div>
        <div className="text-xs text-textSecondary">JPG / PNG / WebP · 최대 8MB · 여러 장 동시 가능</div>
        <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="h-11 px-4 rounded-lg bg-primaryPink text-textOnPink font-medium hover:bg-primaryPinkHover disabled:opacity-50"
          >
            파일 선택
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="h-11 px-4 rounded-lg bg-white text-textPinkStrong border border-primaryPinkBorder font-medium hover:bg-primaryPinkSoft disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Camera className="h-4 w-4" strokeWidth={1.75} />
            카메라로 촬영
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
    </div>
  );
}
