import {
  readerPreferenceLimits,
  type DocumentWidthMode,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { useLocalization } from '@/localization-context';

interface DocumentWidthControlsProps {
  onChange(documentWidth: ReaderPreferences['documentWidth']): void;
  value: ReaderPreferences['documentWidth'];
}

interface DocumentWidthPopoverProps extends DocumentWidthControlsProps {
  className?: string;
}

const widthModeLabels: Record<DocumentWidthMode, 'A4' | '自定义' | '自适应'> = {
  adaptive: '自适应',
  a4: 'A4',
  custom: '自定义',
};

export function DocumentWidthControls({
  onChange,
  value,
}: DocumentWidthControlsProps): React.JSX.Element {
  const { t } = useLocalization();
  const selectMode = (mode: string): void => {
    if (mode === 'adaptive' || mode === 'a4' || mode === 'custom') {
      onChange({ ...value, mode });
    }
  };

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label={t('文档宽度模式')}
        className="w-full"
        onValueChange={selectMode}
        type="single"
        value={value.mode}
      >
        {(Object.keys(widthModeLabels) as DocumentWidthMode[]).map((mode) => (
          <SegmentedControlItem className="flex-1" key={mode} value={mode}>
            {mode === 'a4' ? 'A4' : t(widthModeLabels[mode])}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>

      {value.mode === 'custom' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{readerPreferenceLimits.customWidth.min}px</span>
            <output className="font-medium tabular-nums text-foreground">
              {value.customWidth}px
            </output>
            <span>{readerPreferenceLimits.customWidth.max}px</span>
          </div>
          <Slider
            aria-label={t('自定义文档宽度')}
            max={readerPreferenceLimits.customWidth.max}
            min={readerPreferenceLimits.customWidth.min}
            onValueChange={([customWidth]) => {
              if (customWidth !== undefined) {
                onChange({ customWidth, mode: 'custom' });
              }
            }}
            step={10}
            value={[value.customWidth]}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DocumentWidthPopover({
  className,
  onChange,
  value,
}: DocumentWidthPopoverProps): React.JSX.Element {
  const { t } = useLocalization();
  const triggerLabel = value.mode === 'a4' ? 'A4' : t(widthModeLabels[value.mode]);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label={t('文档宽度')}
              className={cn('h-7 gap-1 px-2 text-xs font-normal text-muted-foreground', className)}
              size="sm"
              variant="ghost"
            >
              <span>{triggerLabel}</span>
              <ChevronDown aria-hidden="true" className="size-3" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {t('文档宽度')}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{t('文档宽度')}</PopoverTitle>
          <PopoverDescription>{t('文档宽度弹窗说明')}</PopoverDescription>
        </PopoverHeader>
        <div className="mt-4">
          <DocumentWidthControls onChange={onChange} value={value} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
