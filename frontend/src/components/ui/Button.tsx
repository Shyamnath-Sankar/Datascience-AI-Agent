import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 
      'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white focus:ring-[var(--accent-primary)] shadow-sm hover:shadow-md',
    secondary: 
      'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] focus:ring-[var(--accent-primary)]',
    outline: 
      'border border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)] text-[var(--text-primary)] focus:ring-[var(--accent-primary)]',
    ghost:
      'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:ring-[var(--accent-primary)]',
    danger:
      'bg-[var(--error)] hover:opacity-90 text-white focus:ring-[var(--error)] shadow-sm',
  };

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs gap-1.5',
    md: 'py-2 px-4 text-sm gap-2',
    lg: 'py-2.5 px-5 text-base gap-2',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button 
      className={classes} 
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg 
          className="animate-spin h-4 w-4" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
