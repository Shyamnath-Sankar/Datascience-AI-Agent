'use client';

import { usePathname } from "next/navigation";
import Link from "next/link";
import NavLink from "@/components/ui/NavLink";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isPlayground = pathname === '/playground';
  const isAgent = pathname === '/agent';
  const isAgentV2 = pathname === '/agent-v2';

  if (isPlayground || isAgent || isAgentV2) {
    // Return children without header/footer for playground and agent
    return <>{children}</>;
  }

  // Return children with normal layout
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-secondary)]">
      {/* Modern Top Navigation */}
      <header className="sticky top-0 z-20 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Area */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center text-white shadow-sm group-hover:bg-[var(--accent-hover)] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span className="font-bold text-lg text-[var(--text-primary)] tracking-tight">DataAgent</span>
              </Link>

              {/* Main Navigation */}
              <nav className="hidden md:flex items-center space-x-1">
                <NavLink href="/" label="Upload" />
                <NavLink href="/database" label="Database" />
                <NavLink href="/profile" label="Profile" />
                <NavLink href="/visualization" label="Visualize" />
                <NavLink href="/agent" label="Agent" />
              </nav>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <div className="h-8 w-[1px] bg-[var(--border-color)] mx-2"></div>
              <a href="https://github.com/vanna-ai/vanna" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      
      <footer className="bg-[var(--bg-primary)] border-t border-[var(--border-color)] mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-[var(--text-tertiary)]">
              &copy; {new Date().getFullYear()} Data Science Platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
