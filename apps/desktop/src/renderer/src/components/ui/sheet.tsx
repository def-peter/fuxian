import { Dialog as SheetPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>): React.JSX.Element {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>): React.JSX.Element {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>): React.JSX.Element {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-40 bg-fg-primary/15 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

function SheetContent({
  children,
  className,
  showCloseButton = true,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean;
  side?: 'left' | 'right';
}): React.JSX.Element {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex h-full flex-col bg-surface-shell shadow-xl outline-none duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in',
          side === 'left'
            ? 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
            : 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
        data-side={side}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close asChild>
            <Button
              aria-label="关闭抽屉"
              className="absolute top-2 right-2"
              size="icon-sm"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetTitle(props: React.ComponentProps<typeof SheetPrimitive.Title>): React.JSX.Element {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

function SheetDescription(
  props: React.ComponentProps<typeof SheetPrimitive.Description>,
): React.JSX.Element {
  return <SheetPrimitive.Description data-slot="sheet-description" {...props} />;
}

export { Sheet, SheetContent, SheetDescription, SheetTitle };
