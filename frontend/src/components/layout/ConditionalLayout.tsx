'use client';

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isAgent = pathname === '/agent';

  // Agent page: full-screen, no chrome
  if (isAgent) {
    return <>{children}</>;
  }

  // All other pages: minimal header
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-secondary)]">
      <header className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-shadow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="font-semibold text-lg text-[var(--text-primary)] tracking-tight">
                Data<span className="text-[var(--accent)]">Agent</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/agent"
                className="btn btn-primary text-sm px-4 py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Open Agent
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-[var(--border-color)] mt-auto">
        <div className="max-w-6xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            DataAgent — AI-powered data science platform
          </p>
        </div>
      </footer>
    </div>
  );
}
