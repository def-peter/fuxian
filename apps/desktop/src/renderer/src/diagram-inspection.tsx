import { Check, Code2, Copy, Minus, Plus, Scan, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyDiagramContent, type CopyStatus } from '@/diagram-copy';
import type { DiagramSnapshot } from '@/finished-document';

interface CopyButtonProps {
  copyText(text: string): Promise<void>;
  disabled?: boolean;
  label: string;
  text: string;
}

function CopyButton({ copyText, disabled, label, text }: CopyButtonProps): React.JSX.Element {
  const [status, setStatus] = useState<CopyStatus>('idle');
  return (
    <Button
      disabled={disabled}
      onClick={() => void copyDiagramContent(copyText, text).then(setStatus)}
      size="sm"
      variant="outline"
    >
      {status === 'copied' ? (
        <Check aria-hidden="true" data-icon="inline-start" />
      ) : (
        <Copy aria-hidden="true" data-icon="inline-start" />
      )}
      {status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : label}
    </Button>
  );
}

interface DiagramSourceDrawerProps {
  copyText(text: string): Promise<void>;
  diagram: DiagramSnapshot;
  onClose(): void;
}

export function DiagramSourceDrawer({
  copyText,
  diagram,
  onClose,
}: DiagramSourceDrawerProps): React.JSX.Element {
  return (
    <aside
      aria-label="图表源码"
      className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)_52px] border-l bg-muted/35"
    >
      <header className="flex items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Code2 aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 className="truncate text-xs font-semibold">
            {diagram.kind === 'mermaid' ? 'Mermaid' : 'PlantUML'} 源码
          </h2>
        </div>
        <Button aria-label="关闭图表源码" onClick={onClose} size="icon-xs" variant="ghost">
          <X aria-hidden="true" data-icon="inline-start" />
        </Button>
      </header>
      <div className="min-h-0 overflow-auto p-3">
        <pre className="min-h-full whitespace-pre-wrap break-words rounded-sm border bg-background p-3 text-xs leading-5 selection:bg-primary selection:text-primary-foreground">
          <code>{diagram.source}</code>
        </pre>
      </div>
      <footer className="flex items-center gap-2 border-t px-3">
        <CopyButton copyText={copyText} label="复制源码" text={diagram.source} />
        <CopyButton
          copyText={copyText}
          disabled={!diagram.svg}
          label="复制 SVG"
          text={diagram.svg ?? ''}
        />
      </footer>
    </aside>
  );
}

interface DiagramFocusDialogProps {
  copyText(text: string): Promise<void>;
  diagram: DiagramSnapshot | undefined;
  onClose(): void;
}

const clampZoom = (value: number): number => Math.min(4, Math.max(0.25, value));

export function DiagramFocusDialog({
  copyText,
  diagram,
  onClose,
}: DiagramFocusDialogProps): React.JSX.Element {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);

  const fit = (): void => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Dialog open={Boolean(diagram)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="inset-0 top-0 left-0 h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[52px_minmax(0,1fr)] gap-0 rounded-none border-0 p-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-4 text-left">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm">全屏图表</DialogTitle>
            <DialogDescription className="sr-only">
              可缩放、平移、适应窗口并复制当前图表。
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label="缩小图表"
              onClick={() => setZoom((current) => clampZoom(current / 1.2))}
              size="icon-sm"
              title="缩小"
              variant="ghost"
            >
              <Minus aria-hidden="true" data-icon="inline-start" />
            </Button>
            <output className="w-14 text-center text-xs tabular-nums">
              {Math.round(zoom * 100)}%
            </output>
            <Button
              aria-label="放大图表"
              onClick={() => setZoom((current) => clampZoom(current * 1.2))}
              size="icon-sm"
              title="放大"
              variant="ghost"
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
            </Button>
            <Button onClick={fit} size="sm" title="适应窗口" variant="ghost">
              <Scan aria-hidden="true" data-icon="inline-start" />
              适应窗口
            </Button>
            <CopyButton copyText={copyText} label="复制源码" text={diagram?.source ?? ''} />
            <CopyButton copyText={copyText} label="复制 SVG" text={diagram?.svg ?? ''} />
            <Button
              aria-label="返回文档"
              onClick={onClose}
              size="icon-sm"
              title="返回"
              variant="ghost"
            >
              <X aria-hidden="true" data-icon="inline-start" />
            </Button>
          </div>
        </DialogHeader>
        <div
          aria-label="图表全屏画布"
          className="relative min-h-0 touch-none overflow-hidden bg-muted/30 select-none"
          onPointerDown={(event) => {
            if ((event.target as Element).closest('text, tspan')) return;
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const previous = drag.current;
            if (previous?.pointerId !== event.pointerId) return;
            const next = { x: event.clientX, y: event.clientY };
            setOffset((current) => ({
              x: current.x + next.x - previous.x,
              y: current.y + next.y - previous.y,
            }));
            drag.current = { pointerId: event.pointerId, ...next };
          }}
          onPointerCancel={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
          }}
          onWheel={(event) => {
            event.preventDefault();
            setZoom((current) => clampZoom(current * (event.deltaY < 0 ? 1.1 : 0.9)));
          }}
        >
          <div
            className="flex size-full items-center justify-center p-8 [&_svg]:max-h-full [&_svg]:max-w-full [&_svg_text]:select-text [&_svg_tspan]:select-text"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: diagram?.svg ?? '' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
