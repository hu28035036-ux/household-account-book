'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Props = { title?: string; userEmail?: string | null };

export function Header({ title, userEmail }: Props) {
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-20 bg-pageBackground/90 backdrop-blur border-b border-borderDefault">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <h1 className="text-base sm:text-lg font-semibold text-textPrimary truncate">{title ?? ''}</h1>
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="hidden sm:inline text-xs text-textSecondary truncate max-w-[200px]">
              {userEmail}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={signOut} aria-label="로그아웃">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
