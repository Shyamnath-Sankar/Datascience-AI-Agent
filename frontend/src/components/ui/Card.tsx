import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`excel-card p-4 ${className}`}>
      {title && (
        <div className="flex items-center mb-4 pb-2 border-b border-[var(--excel-border)]">
          <h3 className="text-lg font-semibold text-[var(--excel-text-primary)]">{title}</h3>
        </div>
      )}
      <div className="text-[var(--excel-text-primary)]">
        {children}
      </div>
    </div>
  );
}
