import {
  ChevronRight,
  CircleArrowUp,
  FileText,
  FileWarning,
  FolderOpen,
  FolderSearch,
  PanelLeftClose,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  OpenDocumentItem,
  RecentDocument,
  UnavailableSessionDocument,
} from '@/document-session';
import { FuxianLockup } from '@/fuxian-mark';
import { cn } from '@/lib/utils';

interface DocumentSessionSidebarProps {
  activeDocumentPath: string | undefined;
  isOpening: boolean;
  onActivate(path: string): void;
  onClose(path: string): void;
  onCollapse(): void;
  onLocate(path: string): void;
  onOpen(): void;
  onOpenSettings(): void;
  onRemoveUnavailable(path: string): void;
  onReopen(path: string): void;
  onRetry(path: string): void;
  openDocuments: OpenDocumentItem[];
  recentDocuments: RecentDocument[];
  updateAttention?: 'available' | 'downloaded' | 'downloading';
}

interface UnavailableDocumentItemProps {
  document: UnavailableSessionDocument;
  disabled: boolean;
  onLocate(): void;
  onRemove(): void;
  onRetry(): void;
}

interface DocumentItemProps {
  active?: boolean;
  document: { name: string; path: string };
  loading?: boolean;
  onActivate(): void;
  onClose?: () => void;
}

function UnavailableDocumentItem({
  document,
  disabled,
  onLocate,
  onRemove,
  onRetry,
}: UnavailableDocumentItemProps): React.JSX.Element {
  return (
    <div
      aria-label={`${document.name}，文档不可用。${document.message}`}
      className="flex min-h-10 items-center border-l-2 border-warning/60 px-1 pl-3"
      role="group"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={`${document.name}。${document.message}`}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="note"
            tabIndex={0}
          >
            <FileWarning aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
            <span className="min-w-0 flex-1 truncate">{document.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          <p>{document.path}</p>
          <p>{document.message}</p>
        </TooltipContent>
      </Tooltip>
      <Button
        aria-label={`重试 ${document.name}`}
        disabled={disabled}
        onClick={onRetry}
        size="icon-xs"
        title={`重试 ${document.name}`}
        variant="ghost"
      >
        <RotateCcw aria-hidden="true" />
      </Button>
      <Button
        aria-label={`定位 ${document.name}`}
        disabled={disabled}
        onClick={onLocate}
        size="icon-xs"
        title={`定位 ${document.name}`}
        variant="ghost"
      >
        <FolderSearch aria-hidden="true" />
      </Button>
      <Button
        aria-label={`移除 ${document.name}`}
        disabled={disabled}
        onClick={onRemove}
        size="icon-xs"
        title={`移除 ${document.name}`}
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

function DocumentItem({
  active,
  document,
  loading,
  onActivate,
  onClose,
}: DocumentItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'group flex min-h-9 w-full min-w-0 max-w-full items-center overflow-hidden border-l-2 border-transparent pr-1',
        active && 'border-primary bg-selected text-selected-foreground',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`${document.name}${loading ? '，正在更新' : ''}`}
            aria-current={active ? 'page' : undefined}
            className="flex w-full min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden py-2 pl-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onActivate}
            type="button"
          >
            {loading ? (
              <Spinner aria-hidden="true" className="size-3.5 shrink-0" />
            ) : (
              <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{document.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          {document.path}
        </TooltipContent>
      </Tooltip>
      {onClose ? (
        <Button
          aria-label={`关闭 ${document.name}`}
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onClose}
          size="icon-xs"
          title={`关闭 ${document.name}`}
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

interface SessionSectionProps {
  children: React.ReactNode;
  count: number;
  title: string;
}

function SessionSection({ children, count, title }: SessionSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger asChild>
        <Button className="group w-full justify-start px-3" size="sm" variant="ghost">
          <ChevronRight
            aria-hidden="true"
            className="transition-transform group-data-[state=open]:rotate-90"
          />
          {title}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function DocumentSessionSidebar({
  activeDocumentPath,
  isOpening,
  onActivate,
  onClose,
  onCollapse,
  onLocate,
  onOpen,
  onOpenSettings,
  onRemoveUnavailable,
  onReopen,
  onRetry,
  openDocuments,
  recentDocuments,
  updateAttention,
}: DocumentSessionSidebarProps): React.JSX.Element {
  return (
    <aside
      aria-label="文档会话"
      className="grid h-full min-h-0 w-full min-w-0 grid-rows-[44px_minmax(0,1fr)] overflow-hidden border-r bg-muted"
    >
      <header className="flex min-w-0 items-center gap-1 border-b bg-card px-2">
        <FuxianLockup className="mr-auto h-7 w-auto" decorative={false} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="收起文档会话" onClick={onCollapse} size="icon-sm" variant="ghost">
              <PanelLeftClose aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            收起文档会话
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="添加文档"
              disabled={isOpening}
              onClick={onOpen}
              size="icon-sm"
              variant="ghost"
            >
              <FolderOpen aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            添加文档
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={updateAttention ? '设置，有可用更新' : '设置'}
              onClick={onOpenSettings}
              size="icon-sm"
              variant="ghost"
            >
              {updateAttention === 'downloading' ? (
                <Spinner aria-hidden="true" />
              ) : updateAttention ? (
                <CircleArrowUp aria-hidden="true" />
              ) : (
                <Settings aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            {updateAttention ? '有可用更新' : '设置'}
          </TooltipContent>
        </Tooltip>
      </header>

      <ScrollArea className="min-h-0 min-w-0 overflow-hidden">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden py-2">
          <SessionSection count={openDocuments.length} title="正在查看">
            {openDocuments.map((document) =>
              document.status !== 'unavailable' ? (
                <DocumentItem
                  active={
                    (document.status === 'available' ? document.document.path : document.path) ===
                    activeDocumentPath
                  }
                  document={document.status === 'available' ? document.document : document}
                  key={document.status === 'available' ? document.document.path : document.path}
                  loading={document.status === 'loading'}
                  onActivate={() =>
                    onActivate(
                      document.status === 'available' ? document.document.path : document.path,
                    )
                  }
                  onClose={() =>
                    onClose(
                      document.status === 'available' ? document.document.path : document.path,
                    )
                  }
                />
              ) : (
                <UnavailableDocumentItem
                  disabled={isOpening}
                  document={document}
                  key={document.path}
                  onLocate={() => onLocate(document.path)}
                  onRemove={() => onRemoveUnavailable(document.path)}
                  onRetry={() => onRetry(document.path)}
                />
              ),
            )}
          </SessionSection>

          <SessionSection count={recentDocuments.length} title="最近查看">
            {recentDocuments.map((document) => (
              <DocumentItem
                document={document}
                key={document.path}
                onActivate={() => onReopen(document.path)}
              />
            ))}
          </SessionSection>
        </div>
      </ScrollArea>
    </aside>
  );
}
