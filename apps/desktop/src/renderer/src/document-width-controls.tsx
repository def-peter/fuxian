import {
  readerPreferenceLimits,
  type DocumentWidthMode,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { Scaling } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface DocumentWidthControlsProps {
  onChange(documentWidth: ReaderPreferences['documentWidth']): void;
  value: ReaderPreferences['documentWidth'];
}

const widthModeLabels: Record<DocumentWidthMode, string> = {
  adaptive: '自适应',
  a4: 'A4',
  custom: '自定义',
};

export function DocumentWidthControls({
  onChange,
  value,
}: DocumentWidthControlsProps): React.JSX.Element {
  const selectMode = (mode: string): void => {
    if (mode === 'adaptive' || mode === 'a4' || mode === 'custom') {
      onChange({ ...value, mode });
    }
  };

  return (
    <div className="space-y-4">
      <ToggleGroup
        aria-label="文档宽度模式"
        className="w-full"
        onValueChange={selectMode}
        type="single"
        value={value.mode}
        variant="outline"
      >
        {(Object.keys(widthModeLabels) as DocumentWidthMode[]).map((mode) => (
          <ToggleGroupItem className="flex-1" key={mode} value={mode}>
            {widthModeLabels[mode]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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
            aria-label="自定义文档宽度"
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
  onChange,
  value,
}: DocumentWidthControlsProps): React.JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="文档宽度" size="icon-sm" title="文档宽度" variant="ghost">
          <Scaling aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>文档宽度</PopoverTitle>
          <PopoverDescription>统一调整正文、表格、代码和图表的内容宽度。</PopoverDescription>
        </PopoverHeader>
        <div className="mt-4">
          <DocumentWidthControls onChange={onChange} value={value} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
