import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-interactive-hover hover:text-interactive-hover-foreground focus-visible:border-focus focus-visible:ring-[3px] focus-visible:ring-focus/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-status-danger aria-invalid:ring-status-danger/20 data-[state=on]:bg-interactive-hover data-[state=on]:text-interactive-hover-foreground dark:aria-invalid:ring-status-danger/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-line-control bg-transparent shadow-xs hover:bg-interactive-hover hover:text-interactive-hover-foreground',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// The variant function is shared with ToggleGroup by the shadcn composition pattern.
// eslint-disable-next-line react-refresh/only-export-components
export { Toggle, toggleVariants };
