import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-line-control bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-command selection:text-on-command file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-primary placeholder:text-fg-secondary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-line-control/30',
        'focus-visible:border-focus focus-visible:ring-[3px] focus-visible:ring-focus/50',
        'aria-invalid:border-status-danger aria-invalid:ring-status-danger/20 dark:aria-invalid:ring-status-danger/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
