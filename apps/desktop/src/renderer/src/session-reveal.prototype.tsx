// THROWAWAY #57: three document-item affordances on the existing renderer route.
// ?prototype=session-reveal&variant=A|B|C. All document actions are in-memory stubs.
import { useCallback, useEffect, useState } from 'react';
import { ContextMenu, DropdownMenu } from 'radix-ui';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  FolderSearch,
  Info,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FuxianMark } from '@/fuxian-mark';
import { cn } from '@/lib/utils';
import { documentThemeCss } from '@fuxian/document-theme';
import './session-reveal.prototype.css';

type Variant = 'A' | 'B' | 'C';
type Doc = { id: string; name: string; recent?: boolean; missing?: boolean };
const documents: Doc[] = [
  { id: 'guide', name: '产品设计说明.md' },
  { id: 'long', name: 'DEMOZ-8705鞋架类目曝光因子分布排查报告.md' },
  { id: 'plan', name: '九月迭代计划.md' },
  { id: 'notes', name: '会议纪要.md', recent: true },
  { id: 'draft', name: '新功能交互草稿.md', recent: true },
  { id: 'missing', name: '暂时无法访问的文档.md', recent: true, missing: true },
];
const variants: Record<Variant, { name: string; description: string; tradeoff: string }> = {
  A: {
    name: '更多菜单',
    description: '悬停文档 → 点击 … → 在访达中显示',
    tradeoff: '推荐。入口熟悉、可扩展；只有一个操作时多点一次。',
  },
  B: {
    name: '直接定位',
    description: '悬停文档 → 点击文件夹图标，一步定位',
    tradeoff: '最快。适合长期只有这一个操作；图标含义需要气泡解释。',
  },
  C: {
    name: '文档详情',
    description: '点击信息图标 → 确认完整文件名、路径 → 定位',
    tradeoff: '路径最清楚，但浮层更大，操作略重。',
  },
};
const article = `<html><head><style>${documentThemeCss}body{margin:0}.finished-document{padding:44px 40px;max-width:none;width:100%}h1{font-size:28px}</style></head><body><main class="finished-document"><h1>让阅读回到内容本身</h1><p>产品设计说明 · 2026 年 9 月</p><h2>01　文档与工作流</h2><p>一份完成的文档，应当在不同的场景下，都保持清晰、稳定的表达。阅读时关注内容，需要交付时再导出为 PDF。</p><blockquote><p>好的工具让操作自然发生，也让内容始终留在视线中央。</p></blockquote><h2>02　清晰的层次</h2><p>正在查看的文档与最近查看记录各有职责。文档操作应该就近出现，不打断当前阅读。</p><table><thead><tr><th>场景</th><th>期望</th></tr></thead><tbody><tr><td>查看其他文档的位置</td><td>当前文章保持不动</td></tr><tr><td>处理长文件名</td><td>标题省略，完整路径按需查看</td></tr><tr><td>回到阅读</td><td>点击空白或按 Esc 收起菜单</td></tr></tbody></table><h2>03　内容与交付</h2><p>相同的文档，无论是在屏幕上阅读，还是作为 PDF 分享，都应该有一致的排版。</p></main></body></html>`;

function Hint({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SessionRevealPrototype() {
  const initial = new URLSearchParams(location.search).get('variant');
  const [variant, setVariant] = useState<Variant>(
    initial === 'B' || initial === 'C' ? initial : 'A',
  );
  const [docs, setDocs] = useState(documents);
  const [active, setActive] = useState('guide');
  const [open, setOpen] = useState<string | null>(null);
  const [platform, setPlatform] = useState('mac');
  const [english, setEnglish] = useState(false);
  const [width, setWidth] = useState(216);
  const [feedback, setFeedback] = useState('试试对未选中的文档操作：正文应该保持不动。');
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [contextTarget, setContextTarget] = useState<string | null>(null);
  const label =
    platform === 'mac'
      ? english
        ? 'Reveal in Finder'
        : '在访达中显示'
      : english
        ? 'Show in File Explorer'
        : '在文件资源管理器中显示';
  const path = (doc: Doc) =>
    platform === 'mac'
      ? `/Users/demo/Documents/项目资料/${doc.name}`
      : `C:\\Users\\demo\\Documents\\项目资料\\${doc.name}`;
  const changeVariant = useCallback((next: Variant) => {
    setVariant(next);
    setOpen(null);
    setContextTarget(null);
    setLastTarget(null);
    setFeedback(variants[next].description);
    const url = new URL(location.href);
    url.searchParams.set('variant', next);
    history.replaceState(null, '', url);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('input, textarea, select, [contenteditable], [role="menu"]') ||
        open ||
        contextTarget
      )
        return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const keys: Variant[] = ['A', 'B', 'C'];
      changeVariant(keys[(keys.indexOf(variant) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, open, contextTarget, changeVariant]);
  const reveal = (doc: Doc) => {
    setLastTarget(doc.id);
    setOpen(null);
    setFeedback(
      failure || doc.missing
        ? `无法定位「${doc.name}」：文件不存在或没有访问权限。`
        : `模拟定位「${doc.name}」；当前阅读文档与阅读位置保持不变。`,
    );
  };
  const row = (doc: Doc) => (
    <ContextMenu.Root key={doc.id} onOpenChange={(next) => setContextTarget(next ? doc.id : null)}>
      <ContextMenu.Trigger asChild>
        <div
          className={cn('prototype-doc group', active === doc.id && 'prototype-doc-active')}
          data-document={doc.id}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault();
              setOpen(doc.id);
            }
          }}
        >
          <Hint label={path(doc)}>
            <button
              className="prototype-doc-name"
              onClick={() => {
                if (!doc.missing) {
                  setActive(doc.id);
                  setDocs((current) =>
                    current.map((d) => (d.id === doc.id ? { ...d, recent: false } : d)),
                  );
                } else setFeedback('此示例文档不可用。');
              }}
            >
              <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{doc.name}</span>
            </button>
          </Hint>
          <div className={cn('prototype-row-actions', open === doc.id && 'prototype-actions-open')}>
            {variant === 'C' ? (
              <Popover
                open={open === doc.id}
                onOpenChange={(next) => setOpen(next ? doc.id : null)}
              >
                <Hint label={english ? 'Document details' : '文档详情'}>
                  <PopoverTrigger asChild>
                    <Button aria-label={`文档详情 ${doc.name}`} size="icon-xs" variant="ghost">
                      <Info />
                    </Button>
                  </PopoverTrigger>
                </Hint>
                <PopoverContent side="right" align="start" sideOffset={10} className="w-80">
                  <div className="mb-3 flex items-start gap-2">
                    <FileText className="size-4 shrink-0" />
                    <strong className="text-sm break-all">{doc.name}</strong>
                  </div>
                  <p className="mb-4 text-xs break-all text-muted-foreground">{path(doc)}</p>
                  <Button
                    className="w-full justify-start"
                    size="sm"
                    variant="secondary"
                    disabled={doc.missing}
                    onClick={() => reveal(doc)}
                  >
                    <FolderSearch data-icon="inline-start" />
                    {label}
                  </Button>
                  {doc.missing ? (
                    <p className="mt-2 text-xs text-muted-foreground">无法确认文件位置</p>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : (
              <DropdownMenu.Root
                open={open === doc.id}
                onOpenChange={(next) => setOpen(next ? doc.id : null)}
              >
                {variant === 'A' ? (
                  <Hint label={english ? 'More actions' : '更多操作'}>
                    <DropdownMenu.Trigger asChild>
                      <Button aria-label={`更多操作 ${doc.name}`} size="icon-xs" variant="ghost">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenu.Trigger>
                  </Hint>
                ) : (
                  <Hint label={label}>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        aria-label={`${label} ${doc.name}`}
                        disabled={doc.missing}
                        size="icon-xs"
                        variant="ghost"
                        onPointerDown={(event) => event.preventDefault()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            reveal(doc);
                          }
                        }}
                        onClick={() => reveal(doc)}
                      >
                        <FolderSearch />
                      </Button>
                    </DropdownMenu.Trigger>
                  </Hint>
                )}
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="prototype-menu"
                  >
                    <DropdownMenu.Group>
                      <DropdownMenu.Item
                        className="prototype-menu-item"
                        disabled={!!doc.missing}
                        onSelect={() => reveal(doc)}
                      >
                        <FolderSearch />
                        {label}
                      </DropdownMenu.Item>
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            <Hint
              label={
                doc.recent
                  ? english
                    ? 'Remove from recent'
                    : '移除查看记录'
                  : english
                    ? 'Close document'
                    : '关闭当前文档'
              }
            >
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`关闭或移除 ${doc.name}`}
                onClick={() => {
                  setOpen(null);
                  setDocs((current) =>
                    doc.recent
                      ? current.filter((d) => d.id !== doc.id)
                      : current.map((d) => (d.id === doc.id ? { ...d, recent: true } : d)),
                  );
                  if (active === doc.id) setActive('');
                  setFeedback(
                    doc.recent
                      ? '模拟移除查看记录；没有删除文件。'
                      : '模拟关闭文档，移入最近查看。',
                  );
                }}
              >
                <X />
              </Button>
            </Hint>
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="prototype-menu">
          <ContextMenu.Group>
            <ContextMenu.Item
              className="prototype-menu-item"
              disabled={!!doc.missing}
              onSelect={() => reveal(doc)}
            >
              <FolderSearch />
              {label}
            </ContextMenu.Item>
          </ContextMenu.Group>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
  return (
    <TooltipProvider>
      <div className="prototype-review">
        <div className="prototype-review-top">
          <span>#57 · 交互原型</span>
          <span>悬停左侧文档，或右键试试</span>
          <div className="ml-auto flex items-center gap-4">
            <label>
              侧栏{' '}
              <input
                aria-label="侧栏宽度"
                type="range"
                min="176"
                max="360"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <select
              aria-label="平台"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={english}
                onChange={(e) => setEnglish(e.target.checked)}
              />{' '}
              英文操作文案
            </label>
            <label>
              <input
                type="checkbox"
                checked={failure}
                onChange={(e) => setFailure(e.target.checked)}
              />{' '}
              模拟定位失败
            </label>
          </div>
        </div>
        <div
          className="prototype-window"
          style={{ gridTemplateColumns: `${width}px minmax(0,1fr) 196px` }}
        >
          <aside className="prototype-sidebar">
            <header className="prototype-toolbar">
              <FuxianMark className="size-7" />
              <b className="mr-auto text-base">浮现</b>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="重置示例文档"
                onClick={() => {
                  setDocs(documents);
                  setActive('guide');
                  setOpen(null);
                }}
              >
                <FolderOpen />
              </Button>
              <PanelLeftClose className="size-4 text-muted-foreground" />
            </header>
            <div className="prototype-sidebar-body">
              {[false, true].map((recent) => (
                <section key={String(recent)}>
                  <div className="prototype-section-label">
                    <ChevronDown className="size-3" />
                    {recent ? '最近查看' : '正在查看'}
                    <span className="ml-auto">
                      {docs.filter((d) => !!d.recent === recent).length}
                    </span>
                  </div>
                  {docs.filter((d) => !!d.recent === recent).map(row)}
                </section>
              ))}
            </div>
            <footer className="prototype-toolbar">
              <Settings className="size-3.5" />
              <span>设置</span>
              <span className="ml-auto">v0.1.18</span>
            </footer>
          </aside>
          <main className="prototype-main">
            <header className="prototype-toolbar">
              <FileText className="size-3.5" />
              <span className="mr-auto min-w-0 truncate">
                {docs.find((d) => d.id === active)?.name ?? '没有正在查看的文档'}
              </span>
              <span className="prototype-mode">
                无界<span>纸张</span>
              </span>
              <span className="text-xs text-muted-foreground">自适应⌄</span>
              <Search className="size-4" />
              <Pencil className="size-4" />
              <Download className="size-4" />
            </header>
            <div className="prototype-paper-stage">
              <iframe title="示例阅读文档" srcDoc={article} />
            </div>
          </main>
          <aside className="prototype-outline">
            <header className="prototype-toolbar">
              <span className="mr-auto">大纲</span>
              <PanelRightClose className="size-4" />
            </header>
            <div className="px-4 py-5 text-xs leading-9 text-muted-foreground">
              <p className="text-foreground">让阅读回到内容本身</p>
              <p>01　文档与工作流</p>
              <p>02　清晰的层次</p>
              <p>03　内容与交付</p>
            </div>
          </aside>
        </div>
        <div className="prototype-explanation">
          <strong>
            {variant} · {variants[variant].name}
          </strong>
          <span>{variants[variant].tradeoff}</span>
          <p role="status">{feedback}</p>
          <details>
            <summary>查看原型状态（所有操作均为模拟）</summary>
            <pre>
              {JSON.stringify(
                {
                  variant,
                  platform,
                  english,
                  sidebarWidth: width,
                  active,
                  menu: open,
                  contextTarget,
                  lastTarget,
                  failure,
                  documents: docs,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
        <nav aria-label="原型方案切换" className="prototype-switcher">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="上一方案"
            onClick={() => changeVariant(variant === 'A' ? 'C' : variant === 'B' ? 'A' : 'B')}
          >
            <ArrowLeft />
          </Button>
          <span>
            {variant} / 3 · {variants[variant].name}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="下一方案"
            onClick={() => changeVariant(variant === 'A' ? 'B' : variant === 'B' ? 'C' : 'A')}
          >
            <ArrowRight />
          </Button>
        </nav>
      </div>
    </TooltipProvider>
  );
}
