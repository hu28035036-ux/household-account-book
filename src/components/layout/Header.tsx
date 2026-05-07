'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeSwitcher } from './ThemeSwitcher';
import { HelpSheet } from './HelpSheet';
import { AssistantSheet } from '@/components/assistant/AssistantSheet';

type Props = { title?: string; userEmail?: string | null };

export function Header({ title, userEmail }: Props) {
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-20 bg-pageBackground/90 backdrop-blur border-b border-borderDefault overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-3 max-w-full">
        <h1 className="text-base sm:text-lg font-semibold text-textPrimary truncate min-w-0 flex-1">{title ?? ''}</h1>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <HelpSheet />
          <AssistantSheet />
          <ThemeSwitcher />
          <NotificationBell />
          <HouseholdSwitcher />
          {userEmail && (
            <span className="hidden md:inline text-xs text-textSecondary truncate max-w-[200px]">
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
