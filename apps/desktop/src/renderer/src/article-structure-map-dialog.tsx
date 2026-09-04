import type { DocumentHeading } from '@fuxian/markdown-renderer';
import type { Markmap as MarkmapInstance } from 'markmap-view';
import { AlertCircle, Scan, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildArticleStructureMap } from '@/article-structure-map';
import { useLocalization } from '@/localization-context';

interface ArticleStructureMapDialogProps {
  documentName: string;
  headings: DocumentHeading[];
  onOpenChange(open: boolean): void;
  open: boolean;
}

type RenderState = { status: 'loading' | 'ready' } | { message: string; status: 'failed' };

export function ArticleStructureMapDialog({
  documentName,
  headings,
  onOpenChange,
  open,
}: ArticleStructureMapDialogProps): React.JSX.Element {
  const { t } = useLocalization();
  const root = useMemo(
    () => buildArticleStructureMap(headings, documentName, t('文章结构')),
    [documentName, headings, t],
  );
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const markmapRef = useRef<MarkmapInstance | undefined>(undefined);
  const [renderState, setRenderState] = useState<RenderState>({ status: 'loading' });

  useEffect(() => {
    const svg = svgElement;
    if (!open || !root || !svg) return;
    let disposed = false;
    let resizeFrame = 0;
    let markmap: MarkmapInstance | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let mutationObserver: MutationObserver | undefined;
    queueMicrotask(() => {
      if (!disposed) setRenderState({ status: 'loading' });
    });

    const enhanceFoldControls = (): void => {
      for (const circle of svg.querySelectorAll<SVGCircleElement>('g.markmap-node > circle')) {
        const node = Reflect.get(circle, '__data__') as { payload?: { fold?: number } } | undefined;
        circle.setAttribute('aria-expanded', node?.payload?.fold ? 'false' : 'true');
        circle.setAttribute('aria-label', t('折叠或展开此标题'));
        circle.setAttribute('role', 'button');
        circle.setAttribute('tabindex', '0');
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      const circle = (event.target as Element | null)?.closest<SVGCircleElement>(
        'g.markmap-node > circle',
      );
      if (!circle || (event.key !== 'Enter' && event.key !== ' ') || !markmap) return;
      const node = Reflect.get(circle, '__data__');
      if (!node) return;
      event.preventDefault();
      void markmap.toggleNode(node).then(enhanceFoldControls);
    };

    svg.addEventListener('keydown', handleKeyDown);
    void (async () => {
      try {
        const module = await import('markmap-view');
        await document.fonts.ready;
        const { Markmap } = module;
        if (disposed) return;
        markmap = new Markmap(svg, {
          autoFit: false,
          duration: 0,
          fitRatio: 0.92,
          id: 'fuxian-article-structure',
          initialExpandLevel: -1,
          maxInitialScale: 1.4,
          maxWidth: 320,
          pan: true,
          scrollForPan: false,
          zoom: true,
        });
        markmapRef.current = markmap;
        await markmap.setData(root);
        if (disposed) return;
        await markmap.fit();
        if (disposed) return;
        enhanceFoldControls();
        mutationObserver = new MutationObserver(enhanceFoldControls);
        mutationObserver.observe(svg, { childList: true, subtree: true });
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame || disposed || !markmap) return;
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = 0;
            if (!disposed) void markmap?.fit();
          });
        });
        resizeObserver.observe(svg);
        setRenderState({ status: 'ready' });
      } catch (error) {
        if (!disposed) {
          setRenderState({
            message: error instanceof Error ? error.message : t('无法生成文章大纲图。'),
            status: 'failed',
          });
        }
      }
    })();

    return () => {
      disposed = true;
      svg.removeEventListener('keydown', handleKeyDown);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      markmap?.destroy();
      if (markmapRef.current === markmap) markmapRef.current = undefined;
      svg.replaceChildren();
    };
  }, [open, root, svgElement, t]);

  const ready = renderState.status === 'ready';

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="h-[min(82vh,800px)] max-w-[min(1100px,calc(100vw-2rem))] grid-rows-[52px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,calc(100vw-2rem))]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-4 text-left">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm">{t('文章大纲图')}</DialogTitle>
            <DialogDescription className="truncate text-xs">
              {t('{name} · {count} 个标题', {
                count: headings.length,
                name: documentName,
              })}
            </DialogDescription>
          </div>
          <TooltipProvider>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t('缩小文章大纲图')}
                    disabled={!ready}
                    onClick={() => void markmapRef.current?.rescale(1 / 1.2)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ZoomOut aria-hidden="true" data-icon="inline-start" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('缩小')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t('放大文章大纲图')}
                    disabled={!ready}
                    onClick={() => void markmapRef.current?.rescale(1.2)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ZoomIn aria-hidden="true" data-icon="inline-start" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('放大')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t('适应文章大纲图窗口')}
                    disabled={!ready}
                    onClick={() => void markmapRef.current?.fit()}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Scan aria-hidden="true" data-icon="inline-start" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('适应窗口')}</TooltipContent>
              </Tooltip>
              <Separator className="mx-1 h-5" orientation="vertical" />
              <DialogClose asChild>
                <Button aria-label={t('关闭大纲图')} size="icon-sm" variant="ghost">
                  <X aria-hidden="true" data-icon="inline-start" />
                </Button>
              </DialogClose>
            </div>
          </TooltipProvider>
        </DialogHeader>
        <div className="relative min-h-0 overflow-hidden bg-muted/30">
          <svg
            aria-label={t('当前文章的大纲思维导图')}
            className="article-structure-map size-full touch-none"
            ref={setSvgElement}
            role="img"
          />
          {renderState.status === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center" role="status">
              <Spinner />
              <span className="sr-only">{t('正在生成文章大纲图')}</span>
            </div>
          ) : null}
          {renderState.status === 'failed' ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <Alert className="max-w-md" variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t('无法生成文章大纲图')}</AlertTitle>
                <AlertDescription>{renderState.message}</AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
