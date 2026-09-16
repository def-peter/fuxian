import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/localization-context';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-surface-scrim data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

const dialogContentVariants = cva(
  'fixed z-50 grid bg-surface-shell shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  {
    variants: {
      presentation: {
        default:
          'top-1/2 left-1/2 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-line-subtle p-6 sm:max-w-lg',
        fullscreen:
          'inset-0 h-screen max-h-none w-screen max-w-none grid-rows-[52px_minmax(0,1fr)] gap-0 rounded-none border-0 p-0 sm:max-w-none',
        workspace:
          'top-1/2 left-1/2 h-[min(82vh,800px)] w-full max-w-[min(1100px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 grid-rows-[52px_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border border-line-subtle p-0 sm:max-w-[min(1100px,calc(100vw-2rem))]',
      },
    },
    defaultVariants: {
      presentation: 'default',
    },
  },
);

function DialogContent({
  className,
  children,
  presentation,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
} & VariantProps<typeof dialogContentVariants>) {
  const { t } = useLocalization();
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ presentation }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-surface-shell transition-opacity hover:opacity-100 focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-interactive-hover data-[state=open]:text-fg-secondary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{t('关闭对话框')}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

const dialogHeaderVariants = cva('flex flex-col gap-2 text-center sm:text-left', {
  variants: {
    variant: {
      default: '',
      toolbar:
        'flex-row items-center justify-between gap-4 border-b border-line-subtle px-4 text-left',
    },
  },
  defaultVariants: { variant: 'default' },
});

function DialogHeader({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof dialogHeaderVariants>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(dialogHeaderVariants({ variant }), className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  const { t } = useLocalization();
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t('关闭')}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

const dialogTitleVariants = cva('text-lg leading-none font-semibold', {
  variants: { variant: { default: '', toolbar: 'truncate text-sm' } },
  defaultVariants: { variant: 'default' },
});

function DialogTitle({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & VariantProps<typeof dialogTitleVariants>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(dialogTitleVariants({ variant }), className)}
      {...props}
    />
  );
}

const dialogDescriptionVariants = cva('text-sm text-fg-secondary', {
  variants: { variant: { default: '', toolbar: 'truncate text-xs' } },
  defaultVariants: { variant: 'default' },
});

function DialogDescription({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description> &
  VariantProps<typeof dialogDescriptionVariants>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(dialogDescriptionVariants({ variant }), className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
