'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * 디자인 시스템 모달 기반 confirm/alert hook.
 *
 * window.confirm() / alert() 는 jsdom 외 일부 환경에서 차단되며 디자인 시스템과
 * 톤이 안 맞음. 이 Provider 가 mount 되어있는 트리 안에서는 `useConfirm()` /
 * `useAlertModal()` 을 호출해 Promise 기반으로 일관된 UX 제공.
 *
 * 사용 예:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: '거래 삭제',
 *     message: '되돌릴 수 없습니다.',
 *     confirmText: '삭제',
 *     tone: 'danger',
 *   });
 *   if (!ok) return;
 */

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger';
};

type AlertOptions = {
  title?: string;
  message: ReactNode;
  okText?: string;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ kind: 'confirm', opts, resolve });
      }),
    [],
  );

  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        setPending({ kind: 'alert', opts, resolve });
      }),
    [],
  );

  function onClose() {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(false);
    else pending.resolve();
    setPending(null);
  }
  function onOk() {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(true);
    else pending.resolve();
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <Modal open={!!pending} onClose={onClose} title={pending?.opts.title ?? ''}>
        <div className="text-sm text-textSecondary leading-relaxed">
          {pending?.opts.message}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {pending?.kind === 'confirm' && (
            <Button variant="ghost" onClick={onClose}>
              {pending.opts.cancelText ?? '취소'}
            </Button>
          )}
          <Button
            variant={pending?.kind === 'confirm' && pending.opts.tone === 'danger' ? 'danger' : 'primary'}
            onClick={onOk}
          >
            {pending?.kind === 'confirm'
              ? pending.opts.confirmText ?? '확인'
              : pending?.kind === 'alert'
                ? pending.opts.okText ?? '확인'
                : '확인'}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Provider 가 없는 곳에서는 window.confirm 으로 fallback — SSR 안전.
    return (opts: ConfirmOptions) =>
      Promise.resolve(typeof window !== 'undefined' ? window.confirm(String(opts.message)) : false);
  }
  return ctx.confirm;
}

export function useAlertModal() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return (opts: AlertOptions) => {
      if (typeof window !== 'undefined') window.alert(String(opts.message));
      return Promise.resolve();
    };
  }
  return ctx.alert;
}
