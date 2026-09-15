import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useLocalization } from '@/localization-context';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Separator } from './ui/separator';
import { SettingsSection } from './settings-section';

const skillInstallCommand = 'npx skills add def-peter/fuxian --skill fuxian-diagram';
const repositoryUrl = 'https://github.com/def-peter/fuxian';

function SkillControls(): React.JSX.Element {
  const { locale, t } = useLocalization();
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyCommand = async (): Promise<void> => {
    try {
      await window.fuxian.copyText(skillInstallCommand);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };
  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => {
        setExpanded(open);
        setCopyState('idle');
      }}
    >
      <SettingsSection
        id="diagram-skill-title"
        title={t('图表创作 Skill')}
        description={t(
          '安装到 Codex、Claude Code 等 AI 工具，指导 AI 为 Markdown 文档编写流程图、数据图表和信息图代码。',
        )}
        actions={
          <>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="link">
                {expanded ? t('收起安装步骤') : t('查看安装步骤')}
              </Button>
            </CollapsibleTrigger>
            <Button asChild size="sm" variant="ghost">
              <a
                href={`${repositoryUrl}/blob/main/skills/fuxian-diagram/README${locale === 'zh-CN' ? '.zh-CN' : ''}.md`}
                target="_blank"
                rel="noreferrer"
              >
                {t('使用指南')}
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </>
        }
      >
        <CollapsibleContent>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm leading-6 text-fg-secondary">
              {t('安装 Node.js 后，在终端运行以下命令，按提示选择你的 AI 工具和安装范围。')}
            </p>
            <div className="flex min-w-0 items-start gap-3 rounded-md bg-surface-sidebar p-3">
              <code
                className="min-w-0 flex-1 self-center whitespace-pre-wrap break-all text-xs leading-6"
                dir="ltr"
              >
                {skillInstallCommand}
              </code>
              <Button onClick={() => void copyCommand()} size="sm" variant="ghost">
                {copyState === 'copied' ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copyState === 'copied' ? t('已复制') : t('复制命令')}
              </Button>
            </div>
            <p className="text-xs leading-5 text-fg-secondary">
              {t(
                '安装后，告诉 AI：「使用 fuxian-diagram 为这份文档添加图表。」再用浮现打开生成的 Markdown。',
              )}
            </p>
            <div aria-live="polite" className="text-xs text-fg-secondary">
              {copyState === 'failed' ? (
                t('复制失败，请选中命令手动复制。')
              ) : copyState === 'copied' ? (
                <span className="sr-only">{t('已复制')}</span>
              ) : null}
            </div>
          </div>
        </CollapsibleContent>
      </SettingsSection>
    </Collapsible>
  );
}

export function ExtensionsSettings(): React.JSX.Element {
  const { t } = useLocalization();
  return (
    <section
      aria-labelledby="extensions-title"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <h2 id="extensions-title" className="text-base font-semibold">
        {t('扩展')}
      </h2>
      <Separator />
      <SkillControls />
    </section>
  );
}
