import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
}
