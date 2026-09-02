import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type SegmentedControlProps = Extract<React.ComponentProps<typeof ToggleGroup>, { type: 'single' }>;

function SegmentedControl({ className, ...props }: SegmentedControlProps) {
  return (
    <ToggleGroup
      {...props}
      className={cn(
        'h-7 rounded-md border border-transparent bg-surface-sidebar p-0.5 shadow-none',
        className,
      )}
      data-slot="segmented-control"
      size="sm"
      spacing={1}
    />
  );
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupItem>) {
  return (
    <ToggleGroupItem
      className={cn(
        'h-6 min-w-8 rounded-sm border border-transparent px-2 text-xs font-normal text-fg-secondary shadow-none data-[state=on]:border-line-subtle data-[state=on]:bg-surface-panel data-[state=on]:text-fg-primary data-[state=on]:shadow-none',
        className,
      )}
      data-slot="segmented-control-item"
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
