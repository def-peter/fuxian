import type { PdfExportProgress } from '@fuxian/shared-types';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileDown, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

const runningStageLabel = {
  preparing: '正在准备文档',
  rendering: '正在渲染内容',
  saving: '正在写入 PDF',
} as const;

export function PdfExportPanel({
  onCancel,
  onRetry,
  progress,
}: {
  onCancel(): void;
  onRetry(): void;
  progress: PdfExportProgress;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const running = progress.status === 'running';
  const title =
    progress.status === 'running'
      ? runningStageLabel[progress.stage]
      : progress.status === 'completed'
        ? 'PDF 已导出'
        : progress.status === 'failed'
          ? '导出失败'
          : '导出已取消';

  return (
    <Collapsible
      className="absolute right-4 bottom-4 z-20 w-80 border bg-card shadow-lg"
      onOpenChange={setOpen}
      open={open}
    >
      <div className="flex h-11 items-center gap-2 px-3">
        {running ? (
          <Spinner aria-hidden="true" />
        ) : progress.status === 'completed' ? (
          <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
        ) : progress.status === 'failed' ? (
          <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
        ) : (
          <X aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <CollapsibleTrigger asChild>
          <Button
            aria-label={open ? '折叠导出进度' : '展开导出进度'}
            size="icon-xs"
            title={open ? '折叠导出进度' : '展开导出进度'}
            variant="ghost"
          >
            {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t px-3 py-3">
          {running ? (
            <>
              <Progress
                aria-label="PDF 导出进度"
                aria-valuetext={`${progress.progress}%`}
                value={progress.progress}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress.progress}%
                </span>
                <Button onClick={onCancel} size="xs" variant="outline">
                  取消
                </Button>
              </div>
            </>
          ) : progress.status === 'completed' ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileDown aria-hidden="true" className="size-4" />
              <span className="truncate" title={progress.outputPath}>
                {progress.outputPath}
              </span>
            </div>
          ) : progress.status === 'failed' ? (
            <>
              <p className="m-0 break-words text-xs text-muted-foreground">{progress.message}</p>
              <div className="flex justify-end">
                <Button onClick={onRetry} size="xs" variant="outline">
                  重试
                </Button>
              </div>
            </>
          ) : (
            <p className="m-0 text-xs text-muted-foreground">未写入 PDF 文件。</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
