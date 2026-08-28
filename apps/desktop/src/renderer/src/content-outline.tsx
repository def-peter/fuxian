import type { DocumentHeading } from '@fuxian/markdown-renderer';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildContentOutline,
  findOutlinePath,
  type ContentOutlineNode,
} from '@/content-outline-model';

export type ContentOutlinePreference = 'collapsed' | 'expanded';

interface ContentOutlineProps {
  activeHeadingId: string | undefined;
  headings: DocumentHeading[];
  onNavigate(id: string): void;
  onOpenStructureMap(): void;
}

export function ContentOutline({
  activeHeadingId,
  headings,
  onNavigate,
  onOpenStructureMap,
}: ContentOutlineProps): React.JSX.Element {
  const outline = useMemo(() => buildContentOutline(headings), [headings]);
  const [expandedHeadings, setExpandedHeadings] = useState<ReadonlySet<string>>(new Set());
  const activeItem = useRef<HTMLButtonElement>(null);
  const visibleExpandedHeadings = useMemo(() => {
    const visible = new Set(expandedHeadings);
    if (activeHeadingId) {
      const path = findOutlinePath(outline, activeHeadingId);
      for (const ancestor of path?.slice(0, -1) ?? []) {
        visible.add(ancestor.heading.id);
      }
    }
    return visible;
  }, [activeHeadingId, expandedHeadings, outline]);

  useEffect(() => {
    activeItem.current?.scrollIntoView({ block: 'nearest' });
  }, [activeHeadingId, visibleExpandedHeadings]);

  const toggleHeading = (headingId: string): void => {
    setExpandedHeadings((current) => {
      const next = new Set(current);
      if (next.has(headingId)) {
        next.delete(headingId);
      } else {
        next.add(headingId);
      }
      return next;
    });
  };

  const renderNode = (node: ContentOutlineNode): React.JSX.Element => {
    const isExpanded = visibleExpandedHeadings.has(node.heading.id);
    const hasDeeperChildren = node.children.some((child) => child.heading.depth > 3);
    const visibleChildren = node.children.filter((child) => child.heading.depth <= 3 || isExpanded);
    const isActive = node.heading.id === activeHeadingId;

    return (
      <li key={node.heading.id}>
        <div
          className="group flex min-h-8 items-center border-l-2 border-transparent pr-2 data-[active=true]:bg-selected"
          data-active={isActive || undefined}
          style={{ paddingLeft: `${10 + Math.min(node.heading.depth - 1, 4) * 14}px` }}
        >
          {hasDeeperChildren ? (
            <Button
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? '折叠' : '展开'}“${node.heading.text}”下的深层标题`}
              className="mr-0.5 text-muted-foreground"
              onClick={() => toggleHeading(node.heading.id)}
              size="icon-xs"
              title={`${isExpanded ? '折叠' : '展开'}深层标题`}
              variant="ghost"
            >
              {isExpanded ? (
                <ChevronDown aria-hidden="true" />
              ) : (
                <ChevronRight aria-hidden="true" />
              )}
            </Button>
          ) : null}
          <button
            aria-current={isActive ? 'location' : undefined}
            className="min-w-0 flex-1 truncate py-1.5 text-left text-xs leading-5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=location]:font-medium aria-[current=location]:text-selected-foreground"
            onClick={() => onNavigate(node.heading.id)}
            ref={isActive ? activeItem : undefined}
            title={node.heading.text}
            type="button"
          >
            {node.heading.text}
          </button>
        </div>
        {visibleChildren.length > 0 ? (
          <ul>{visibleChildren.map((child) => renderNode(child))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <aside
      className="grid min-h-0 grid-rows-[40px_minmax(0,1fr)] border-l bg-muted"
      aria-label="内容目录"
    >
      <header className="flex items-center justify-between border-b px-3">
        <h2 className="text-xs font-semibold text-foreground">内容目录</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="查看文章结构图"
                disabled={headings.length === 0}
                onClick={onOpenStructureMap}
                size="icon-xs"
                variant="ghost"
              >
                <Network aria-hidden="true" data-icon="inline-start" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>文章结构图</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>
      <nav className="min-h-0 overflow-y-auto py-2" aria-label="文档标题">
        {outline.length > 0 ? (
          <ul>{outline.map((node) => renderNode(node))}</ul>
        ) : (
          <p className="px-4 py-3 text-xs text-muted-foreground">当前文档没有标题</p>
        )}
      </nav>
    </aside>
  );
}
