import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';

type Props = { title?: string; userEmail?: string | null; children: ReactNode };

export function AppShell({ title, userEmail, children }: Props) {
  return (
    <div className="min-h-screen flex bg-appBackground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} userEmail={userEmail} />
        <main className="flex-1 px-4 sm:px-6 py-5 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
