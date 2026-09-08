import type { AppReleaseNotes, UiLocale } from '@fuxian/shared-types';
import { ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useLocalization } from '@/localization-context';
import { cn } from '@/lib/utils';

export function UpdateReleaseNotes({
  notes,
  onOpen,
}: {
  notes: AppReleaseNotes;
  onOpen(): void;
}): React.JSX.Element | null {
  const { locale, t } = useLocalization();
  const fallback: UiLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
  const blocks = notes[locale]?.length ? notes[locale] : notes[fallback];
  if (!blocks?.length) return null;
  const first = blocks[0];
  const content =
    first?.kind === 'heading' &&
    /^(本次更新|更新内容|主要更新|what(?: is|['’]s) new|release notes)$/iu.test(first.text)
      ? blocks.slice(1)
      : blocks;
  return (
    <section aria-labelledby="update-notes-title" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="update-notes-title" className="text-sm font-medium">
          {t('更新内容')}
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('查看完整更新日志')}
                onClick={onOpen}
                size="icon-sm"
                variant="ghost"
              >
                <ExternalLink />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('查看完整更新日志')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ScrollArea className="h-[min(14rem,28vh)] min-w-0" key={locale}>
        <div
          className="flex min-w-0 flex-col gap-3 pr-3 text-sm leading-6 text-fg-secondary [overflow-wrap:anywhere]"
          data-testid="update-notes-content"
        >
          {content.map((block, index) => {
            if (block.kind === 'heading')
              return (
                <h4 className="font-medium text-fg-primary" key={index}>
                  {block.text}
                </h4>
              );
            if (block.kind === 'paragraph') return <p key={index}>{block.text}</p>;
            if (block.kind !== 'list') return null;
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List
                className={cn(
                  'flex flex-col gap-2 pl-5',
                  block.ordered ? 'list-decimal' : 'list-disc',
                )}
                key={index}
              >
                {block.items.map((text, itemIndex) => (
                  <li key={itemIndex}>{text}</li>
                ))}
              </List>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
