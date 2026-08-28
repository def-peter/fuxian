import { Check, Code2, Copy, LocateFixed, Minus, Plus, Scan, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyDiagramContent, type CopyStatus } from '@/diagram-copy';
import type { RenderedVisualSnapshot } from '@/finished-document';

const diagramKindLabel = (kind: RenderedVisualSnapshot['kind']): string =>
  kind === 'infographic'
    ? 'AntV Infographic'
    : kind === 'mermaid'
      ? 'Mermaid'
      : kind === 'plantuml'
        ? 'PlantUML'
        : 'Vega-Lite';

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
      aria-live="polite"
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
  diagram: RenderedVisualSnapshot;
  onClose(): void;
  onLocate(): void;
}

export function DiagramSourceDrawer({
  copyText,
  diagram,
  onClose,
  onLocate,
}: DiagramSourceDrawerProps): React.JSX.Element {
  return (
    <aside
      aria-label="图表源码"
      className="grid min-h-0 grid-rows-[52px_minmax(0,1fr)_52px] border-l bg-muted"
    >
      <header className="flex items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Code2 aria-hidden="true" className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold">
              {diagramKindLabel(diagram.kind)} 源码
            </h2>
            <p className="truncate text-xs text-muted-foreground">{diagram.contextLabel}</p>
          </div>
        </div>
        <Button aria-label="关闭图表源码" onClick={onClose} size="icon-xs" variant="ghost">
          <X aria-hidden="true" data-icon="inline-start" />
        </Button>
      </header>
      <div className="min-h-0 overflow-auto p-3">
        <pre
          aria-label={`${diagramKindLabel(diagram.kind)} 图表源码`}
          className="min-h-full whitespace-pre-wrap break-words rounded-sm border bg-background p-3 text-xs leading-5 outline-none selection:bg-primary selection:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          <code>{diagram.source}</code>
        </pre>
      </div>
      <footer className="flex items-center gap-2 border-t px-3">
        <Button onClick={onLocate} size="sm" variant="outline">
          <LocateFixed aria-hidden="true" data-icon="inline-start" />
          定位到图表
        </Button>
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
  diagram: RenderedVisualSnapshot | undefined;
  onClose(): void;
  onReturnFocus(diagram: RenderedVisualSnapshot): void;
}

const clampZoom = (value: number): number => Math.min(4, Math.max(0.25, value));

export function DiagramFocusDialog({
  copyText,
  diagram,
  onClose,
  onReturnFocus,
}: DiagramFocusDialogProps): React.JSX.Element {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const lastDiagram = useRef<RenderedVisualSnapshot | undefined>(diagram);
  useEffect(() => {
    if (diagram) lastDiagram.current = diagram;
  }, [diagram]);

  const fit = (): void => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Dialog open={Boolean(diagram)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="inset-0 top-0 left-0 h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[52px_minmax(0,1fr)] gap-0 rounded-none border-0 p-0 sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const closedDiagram = lastDiagram.current;
          if (closedDiagram) onReturnFocus(closedDiagram);
        }}
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-4 text-left">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm">全屏图表</DialogTitle>
            <DialogDescription className="sr-only" id="diagram-focus-description">
              可缩放、平移、适应窗口并复制当前图表。聚焦画布后可使用方向键平移、加减号缩放，按数字零恢复窗口大小。
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
            <output
              aria-label="图表缩放比例"
              aria-live="polite"
              className="w-14 text-center text-xs tabular-nums"
            >
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
          aria-describedby="diagram-focus-description"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
          aria-label="图表全屏画布"
          className="relative min-h-0 touch-none overflow-hidden bg-muted/30 outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onKeyDown={(event) => {
            const movement = event.shiftKey ? 80 : 24;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              setOffset((current) => ({
                ...current,
                x: current.x + (event.key === 'ArrowLeft' ? -movement : movement),
              }));
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              setOffset((current) => ({
                ...current,
                y: current.y + (event.key === 'ArrowUp' ? -movement : movement),
              }));
            } else if (event.key === '+' || event.key === '=') {
              event.preventDefault();
              setZoom((current) => clampZoom(current * 1.2));
            } else if (event.key === '-' || event.key === '_') {
              event.preventDefault();
              setZoom((current) => clampZoom(current / 1.2));
            } else if (event.key === '0') {
              event.preventDefault();
              fit();
            }
          }}
          onPointerDown={(event) => {
            if ((event.target as Element).closest('text, tspan, foreignObject')) return;
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
          role="group"
          tabIndex={0}
        >
          <div
            className="flex size-full items-center justify-center p-8 [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-auto [&_svg]:object-contain [&_svg_text]:select-text [&_svg_tspan]:select-text"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: diagram?.svg ?? '' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
