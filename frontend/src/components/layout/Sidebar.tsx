'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NavItem = ({ href, label, icon, isActive, isCollapsed }: { href: string; label: string; icon: React.ReactNode; isActive: boolean; isCollapsed: boolean }) => (
    <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative
      ${isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
    >
        <div className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
            {icon}
        </div>

        <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
            {label}
        </span>

        {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-border">
                {label}
            </div>
        )}
    </Link>
);

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navItems = [
        {
            href: '/',
            label: 'Upload',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        },
        {
            href: '/database',
            label: 'Database',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
        },
        {
            href: '/agent',
            label: 'AI Agent',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        },
        {
            href: '/profile',
            label: 'Data Profile',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        },
        {
            href: '/clean', // Changed from /cleaning to be consistent or maybe not? Checking original file... it was /cleaning. I should keep it /cleaning.
            label: 'Data Cleaning',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        },
        {
            href: '/visualization',
            label: 'Visualization',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
        },
        {
            href: '/ml',
            label: 'Machine Learning',
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        }
    ];

    return (
        <aside
            className={`relative h-screen bg-background border-r border-border transition-all duration-300 flex flex-col
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
        >
            {/* Header */}
            <div className="h-16 flex items-center px-4 border-b border-border/50">
                <div className={`flex items-center gap-2 font-bold text-xl text-primary transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    <span className="text-secondary-foreground">DS</span> <span className="text-blue-500">Agent</span>
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="ml-auto p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-hide">
                {navItems.map((item) => (
                    <NavItem
                        key={item.href}
                        {...item}
                        href={item.href === '/clean' ? '/cleaning' : item.href} /* Fix href mismatch */
                        isActive={pathname === item.href || (item.href === '/cleaning' && pathname === '/clean')}
                        isCollapsed={isCollapsed}
                    />
                ))}
            </nav>

            {/* Footer / User Profile / Theme */}
            <div className="p-3 border-t border-border/50 bg-muted/20">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} transition-all duration-300`}>
                    <ThemeToggle />
                    {!isCollapsed && (
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">Theme</span>
                            <span className="text-xs text-muted-foreground">v2.0.0</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
