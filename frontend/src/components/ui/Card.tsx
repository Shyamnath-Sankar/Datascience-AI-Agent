import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  noPadding?: boolean;
}

export function Card({ 
  title, 
  subtitle,
  children, 
  className = '',
  headerAction,
  noPadding = false,
}: CardProps) {
  return (
    <div className={`bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  );
}
