'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  label: string;
  icon?: ReactNode;
}

export default function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        isActive
          ? 'bg-[var(--excel-green)] text-white'
          : 'text-[var(--excel-text-primary)] hover:text-[var(--excel-green)] hover:bg-[#F3F3F3]'
      }`}
    >
      {icon && (
        <span className={`mr-1.5 ${isActive ? 'text-white' : 'text-[var(--excel-text-muted)]'}`}>
          {icon}
        </span>
      )}
      {label}
    </Link>
  );
}
