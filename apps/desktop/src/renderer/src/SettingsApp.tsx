import { renderMarkdown } from '@fuxian/markdown-renderer';
import {
  readerPreferenceLimits,
  type AppearancePreference,
  type DocumentBodyFamily,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { FileText, Image, Monitor, Moon, Network, Sun, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DocumentWidthControls } from '@/document-width-controls';
import { applyDocumentTheme, createFinishedDocumentSource } from '@/finished-document';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';

type SettingsSection = 'appearance' | 'diagram' | 'document' | 'plantuml';

const previewSource = `# 完成文档示例

浮现让 Markdown 回到清晰、安静的阅读状态。**正文排版**会随设置即时变化。

> 好的阅读体验，不应让工具本身盖过内容。

## 内容层次

- 标题保持清楚的层级
- 表格、代码与正文使用统一宽度

| 项目 | 当前状态 |
| --- | --- |
| 文档主题 | 实时预览 |
| 阅读宽度 | 全局生效 |

\`\`\`ts
const finishedDocument = render(markdown)
\`\`\`
`;

const previewHtml = renderMarkdown({ source: previewSource }).html;
const previewDocumentSource = createFinishedDocumentSource(previewHtml);

const settingsSections: Array<{
  icon: typeof Sun;
  id: SettingsSection;
  label: string;
}> = [
  { icon: Sun, id: 'appearance', label: '外观' },
  { icon: FileText, id: 'document', label: '文档' },
  { icon: Image, id: 'diagram', label: '图表' },
  { icon: Network, id: 'plantuml', label: 'PlantUML' },
];

const appearanceOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: AppearancePreference;
}> = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '跟随系统', value: 'system' },
];

const updateDocumentTypography = (
  preferences: ReaderPreferences,
  patch: Partial<ReaderPreferences['documentTypography']>,
): ReaderPreferences => ({
  ...preferences,
  documentTypography: { ...preferences.documentTypography, ...patch },
});

export function SettingsApp(): React.JSX.Element {
  const { preferences, ready, resolvedAppearance, updatePreferences } = useReaderPreferences();
  const [section, setSection] = useState<SettingsSection>('appearance');
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const documentTheme = toDocumentThemePreferences(preferences, resolvedAppearance);

  useEffect(() => {
    const frameDocument = previewFrame.current?.contentDocument;
    if (frameDocument) {
      applyDocumentTheme(frameDocument, documentTheme);
    }
  }, [documentTheme]);

  const handlePreviewLoad = (): void => {
    const frameDocument = previewFrame.current?.contentDocument;
    if (frameDocument) {
      applyDocumentTheme(frameDocument, documentTheme);
    }
  };

  const selectAppearance = (appearance: string): void => {
    if (appearance === 'light' || appearance === 'dark' || appearance === 'system') {
      updatePreferences({ ...preferences, appearance });
    }
  };

  const selectBodyFamily = (bodyFamily: string): void => {
    if (bodyFamily === 'serif' || bodyFamily === 'sans-serif') {
      updatePreferences(updateDocumentTypography(preferences, { bodyFamily }));
    }
  };

  return (
    <div className="grid h-full grid-rows-[52px_minmax(0,1fr)] bg-background">
      <header className="flex items-center border-b px-5">
        <div>
          <h1 className="text-sm font-semibold">设置</h1>
          <p className="text-xs text-muted-foreground">更改会自动保存并应用到所有文档</p>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[132px_292px_minmax(0,1fr)]">
        <nav aria-label="设置分区" className="border-r bg-muted/30 p-2">
          {settingsSections.map(({ icon: Icon, id, label }) => (
            <Button
              aria-current={section === id ? 'page' : undefined}
              className="mb-1 w-full justify-start"
              key={id}
              onClick={() => setSection(id)}
              size="sm"
              variant={section === id ? 'secondary' : 'ghost'}
            >
              <Icon aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>

        <main className="min-h-0 overflow-y-auto border-r px-5 py-6" aria-busy={!ready}>
          {section === 'appearance' ? (
            <section aria-labelledby="appearance-title">
              <h2 className="text-base font-semibold" id="appearance-title">
                外观
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">选择应用和完成文档的明暗外观。</p>
              <Separator className="my-5" />
              <Field>
                <FieldLabel>颜色模式</FieldLabel>
                <ToggleGroup
                  aria-label="颜色模式"
                  className="w-full"
                  onValueChange={selectAppearance}
                  type="single"
                  value={preferences.appearance}
                  variant="outline"
                >
                  {appearanceOptions.map(({ icon: Icon, label, value }) => (
                    <ToggleGroupItem className="flex-1 px-2" key={value} value={value}>
                      <Icon aria-hidden="true" />
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </section>
          ) : null}

          {section === 'document' ? (
            <section aria-labelledby="document-title">
              <h2 className="text-base font-semibold" id="document-title">
                文档
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">设置全局文档宽度与正文排版。</p>

              <Separator className="my-5" />
              <Field>
                <FieldTitle>文档宽度</FieldTitle>
                <FieldDescription>正文、表格、代码、公式、图片和图表共用此宽度。</FieldDescription>
                <DocumentWidthControls
                  onChange={(documentWidth) => updatePreferences({ ...preferences, documentWidth })}
                  value={preferences.documentWidth}
                />
              </Field>

              <Separator className="my-6" />
              <Field>
                <FieldLabel>正文字体</FieldLabel>
                <ToggleGroup
                  aria-label="正文字体"
                  className="w-full"
                  onValueChange={selectBodyFamily}
                  type="single"
                  value={preferences.documentTypography.bodyFamily}
                  variant="outline"
                >
                  {(
                    [
                      ['serif', '衬线'],
                      ['sans-serif', '无衬线'],
                    ] as Array<[DocumentBodyFamily, string]>
                  ).map(([value, label]) => (
                    <ToggleGroupItem className="flex-1" key={value} value={value}>
                      <Type aria-hidden="true" />
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field className="mt-6">
                <div className="flex items-center justify-between">
                  <FieldLabel>正文字号</FieldLabel>
                  <output className="text-sm tabular-nums">
                    {preferences.documentTypography.bodySize}px
                  </output>
                </div>
                <Slider
                  aria-label="正文字号"
                  max={readerPreferenceLimits.bodySize.max}
                  min={readerPreferenceLimits.bodySize.min}
                  onValueChange={([bodySize]) => {
                    if (bodySize !== undefined) {
                      updatePreferences(updateDocumentTypography(preferences, { bodySize }));
                    }
                  }}
                  step={1}
                  value={[preferences.documentTypography.bodySize]}
                />
              </Field>

              <Field className="mt-6">
                <div className="flex items-center justify-between">
                  <FieldLabel>正文行高</FieldLabel>
                  <output className="text-sm tabular-nums">
                    {preferences.documentTypography.lineHeight.toFixed(2)}
                  </output>
                </div>
                <Slider
                  aria-label="正文行高"
                  max={readerPreferenceLimits.lineHeight.max}
                  min={readerPreferenceLimits.lineHeight.min}
                  onValueChange={([lineHeight]) => {
                    if (lineHeight !== undefined) {
                      updatePreferences(updateDocumentTypography(preferences, { lineHeight }));
                    }
                  }}
                  step={0.05}
                  value={[preferences.documentTypography.lineHeight]}
                />
              </Field>
            </section>
          ) : null}

          {section === 'diagram' || section === 'plantuml' ? (
            <section aria-labelledby="reserved-settings-title">
              <h2 className="text-base font-semibold" id="reserved-settings-title">
                {section === 'diagram' ? '图表' : 'PlantUML'}
              </h2>
              <Separator className="my-5" />
              <p className="text-sm text-muted-foreground">当前没有可配置项。</p>
            </section>
          ) : null}
        </main>

        <aside
          className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)] bg-muted/20"
          aria-label="实时预览"
        >
          <div className="flex items-center border-b px-4">
            <span className="text-xs font-medium text-muted-foreground">完成文档预览</span>
          </div>
          <div className="min-h-0 p-3">
            <iframe
              className="block h-full w-full border bg-card"
              onLoad={handlePreviewLoad}
              ref={previewFrame}
              sandbox="allow-same-origin"
              srcDoc={previewDocumentSource}
              title="完成文档预览"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
