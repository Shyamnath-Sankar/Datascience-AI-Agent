import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  // Excel-inspired button styling
  const baseClasses = 'font-medium rounded-sm transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1';

  const variantClasses = {
    primary: 'bg-[var(--excel-green)] hover:bg-[#1a5e38] text-white focus:ring-[var(--excel-green)]',
    secondary: 'bg-[var(--excel-blue)] hover:bg-[#0062a3] text-white focus:ring-[var(--excel-blue)]',
    outline: 'border border-[var(--excel-border)] hover:bg-[#F3F3F3] text-[var(--excel-text-primary)] focus:ring-[var(--excel-border)]'
  };

  const sizeClasses = {
    sm: 'py-1 px-3 text-sm',
    md: 'py-2 px-4 text-base',
    lg: 'py-3 px-6 text-lg'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
