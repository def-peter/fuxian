import { renderMarkdown } from '@fuxian/markdown-renderer';
import {
  defaultPlantUmlServerUrl,
  isCodeHighlightTheme,
  isSettingsSectionId,
  readerPreferenceLimits,
  type AppearancePreference,
  type CodeHighlightTheme,
  type DocumentBodyFamily,
  type ReaderPreferences,
  type SettingsSectionId,
} from '@fuxian/shared-types';
import {
  CircleArrowUp,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  Info,
  Monitor,
  Moon,
  Network,
  RefreshCw,
  RotateCcw,
  Sun,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { DocumentWidthControls } from '@/document-width-controls';
import { applyDocumentTheme, createFinishedDocumentSource } from '@/finished-document';
import { FuxianAppIcon } from '@/fuxian-mark';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';
import { useAppUpdateStatus } from '@/use-app-update-status';

type PlantUmlValidationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { message: string; status: 'error' }
  | { status: 'saved' };

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

\`\`\`typescript
type FinishedDocument = {
  title: string
  pages: number
}

async function render(source: string) {
  const pages = await paginate(source)
  return { title: "浮现", pages }
}
\`\`\`
`;

const previewHtml = renderMarkdown({ source: previewSource }).html;
const previewDocumentSource = createFinishedDocumentSource(previewHtml);

const settingsSections: Array<{
  icon: typeof Sun;
  id: SettingsSectionId;
  label: string;
}> = [
  { icon: Sun, id: 'appearance', label: '外观' },
  { icon: FileText, id: 'document', label: '文档' },
  { icon: Network, id: 'plantuml', label: 'PlantUML' },
  { icon: Info, id: 'about', label: '关于与更新' },
];

const initialSettingsSection = (): SettingsSectionId => {
  const requested = new URLSearchParams(globalThis.location.search).get('section');
  return isSettingsSectionId(requested) ? requested : 'appearance';
};

const formatBytes = (bytes: number | undefined): string => {
  if (!bytes || bytes < 0) return '0 MB';
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

const appearanceOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: AppearancePreference;
}> = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '跟随系统', value: 'system' },
];

const codeThemeOptions: Array<{
  background: string;
  label: string;
  tokens: [string, string, string];
  value: CodeHighlightTheme;
}> = [
  {
    background: '#f7faf8',
    label: '浮现浅色',
    tokens: ['#9a3f36', '#236348', '#315e82'],
    value: 'fuxian-light',
  },
  {
    background: '#181e1c',
    label: '浮现深色',
    tokens: ['#e58f82', '#8bc9a9', '#8eb9dc'],
    value: 'fuxian-dark',
  },
  {
    background: '#ffffff',
    label: 'GitHub 浅色',
    tokens: ['#cf222e', '#0a3069', '#8250df'],
    value: 'github-light',
  },
  {
    background: '#0d1117',
    label: 'GitHub 深色',
    tokens: ['#ff7b72', '#a5d6ff', '#d2a8ff'],
    value: 'github-dark',
  },
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
  const appUpdateStatus = useAppUpdateStatus();
  const [section, setSection] = useState<SettingsSectionId>(initialSettingsSection);
  const [plantUmlServerDraft, setPlantUmlServerDraft] = useState<string>();
  const [plantUmlValidation, setPlantUmlValidation] = useState<PlantUmlValidationState>({
    status: 'idle',
  });
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const documentTheme = useMemo(
    () => toDocumentThemePreferences(preferences, resolvedAppearance),
    [preferences, resolvedAppearance],
  );
  const plantUmlServerValue = plantUmlServerDraft ?? preferences.plantUml.serverUrl;

  useEffect(() => {
    const frameDocument = previewFrame.current?.contentDocument;
    if (frameDocument) {
      applyDocumentTheme(frameDocument, documentTheme);
    }
  }, [documentTheme]);

  useEffect(() => window.fuxian.onSettingsSectionRequested(setSection), []);

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

  const selectCodeTheme = (theme: string): void => {
    if (isCodeHighlightTheme(theme)) {
      updatePreferences({ ...preferences, codeHighlight: { theme } });
      previewFrame.current?.contentDocument
        ?.querySelector('.code-block')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const validateAndSavePlantUmlServer = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setPlantUmlValidation({ status: 'checking' });
    try {
      const result = await window.fuxian.validatePlantUmlServer(plantUmlServerValue);
      if (result.status === 'invalid') {
        setPlantUmlValidation({ message: result.message, status: 'error' });
        return;
      }
      updatePreferences({
        ...preferences,
        plantUml: { serverUrl: result.serverUrl },
      });
      setPlantUmlServerDraft(undefined);
      setPlantUmlValidation({ status: 'saved' });
    } catch {
      setPlantUmlValidation({ message: '暂时无法验证 PlantUML Server。', status: 'error' });
    }
  };

  const checkForUpdates = (): void => {
    void window.fuxian.checkForAppUpdates();
  };

  const downloadUpdate = (): void => {
    void window.fuxian.downloadAppUpdate();
  };

  const cancelUpdateDownload = (): void => {
    void window.fuxian.cancelAppUpdateDownload();
  };

  const installUpdate = (): void => {
    void window.fuxian.installAppUpdate();
  };

  const openUpdateRelease = (): void => {
    void window.fuxian.openAppUpdateRelease();
  };

  return (
    <div
      className="grid h-full grid-rows-[52px_minmax(0,1fr)] bg-surface-shell"
      data-settings-window
    >
      <header
        className="flex items-center border-b border-line-subtle bg-surface-toolbar px-5"
        data-settings-surface="header"
      >
        <div>
          <h1 className="text-sm font-semibold">设置</h1>
          <p className="text-xs text-fg-secondary">更改会自动保存并应用到所有文档</p>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[132px_292px_minmax(0,1fr)]">
        <nav aria-label="设置分区" className="border-r border-line-subtle bg-surface-sidebar p-2">
          {settingsSections.map(({ icon: Icon, id, label }) => (
            <Button
              aria-current={section === id ? 'page' : undefined}
              className="mb-1 w-full justify-start aria-[current=page]:[&_svg]:text-focus"
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

        <main
          className="min-h-0 overflow-y-auto border-r border-line-subtle bg-surface-panel px-5 py-6"
          aria-busy={!ready}
          data-settings-surface="form"
        >
          {section === 'about' ? (
            <section aria-labelledby="about-title">
              <h2 className="text-base font-semibold" id="about-title">
                关于与更新
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">
                {appUpdateStatus.delivery === 'release-page'
                  ? '查看当前版本，有新版本时前往 GitHub Release 下载。'
                  : '查看当前版本，并在你准备好时下载和安装更新。'}
              </p>
              <Separator className="my-5" />

              <div className="flex items-center gap-3">
                <FuxianAppIcon className="size-12" decorative={false} />
                <div className="min-w-0">
                  <p className="font-semibold">浮现</p>
                  <p className="text-sm text-fg-secondary">
                    版本 {appUpdateStatus.currentVersion || '--'}
                  </p>
                </div>
              </div>

              <Separator className="my-5" />
              <div aria-live="polite" className="flex flex-col gap-4">
                {appUpdateStatus.phase === 'idle' ? (
                  <Button onClick={checkForUpdates} size="sm">
                    <RefreshCw data-icon="inline-start" />
                    检查更新
                  </Button>
                ) : null}

                {appUpdateStatus.phase === 'checking' ? (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary" role="status">
                    <Spinner />
                    正在检查更新...
                  </div>
                ) : null}

                {appUpdateStatus.phase === 'up-to-date' ? (
                  <Alert>
                    <CircleCheck aria-hidden="true" />
                    <AlertTitle>当前已是最新版本</AlertTitle>
                    <AlertDescription>
                      <Button onClick={checkForUpdates} size="sm" variant="outline">
                        <RefreshCw data-icon="inline-start" />
                        重新检查
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {appUpdateStatus.phase === 'available' ? (
                  <>
                    <Alert>
                      <CircleArrowUp aria-hidden="true" />
                      <AlertTitle>新版本 {appUpdateStatus.availableVersion} 可用</AlertTitle>
                      <AlertDescription>
                        <p>当前版本 {appUpdateStatus.currentVersion}</p>
                      </AlertDescription>
                    </Alert>
                    {appUpdateStatus.releaseNotes ? (
                      <div>
                        <h3 className="text-sm font-medium">更新内容</h3>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-fg-secondary">
                          {appUpdateStatus.releaseNotes}
                        </p>
                      </div>
                    ) : null}
                    {appUpdateStatus.message ? (
                      <p className="text-sm text-fg-secondary">{appUpdateStatus.message}</p>
                    ) : null}
                    {appUpdateStatus.delivery === 'release-page' ? (
                      <Button onClick={openUpdateRelease} size="sm">
                        <ExternalLink data-icon="inline-start" />
                        前往 GitHub Release
                      </Button>
                    ) : (
                      <Button onClick={downloadUpdate} size="sm">
                        <Download data-icon="inline-start" />
                        下载更新
                      </Button>
                    )}
                  </>
                ) : null}

                {appUpdateStatus.phase === 'downloading' ? (
                  <>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>正在下载 {appUpdateStatus.availableVersion}</span>
                      <output className="tabular-nums">
                        {Math.round(appUpdateStatus.percent ?? 0)}%
                      </output>
                    </div>
                    <Progress aria-label="更新下载进度" value={appUpdateStatus.percent ?? 0} />
                    <p className="text-xs tabular-nums text-fg-secondary">
                      {formatBytes(appUpdateStatus.transferred)} /{' '}
                      {formatBytes(appUpdateStatus.total)}
                    </p>
                    <Button onClick={cancelUpdateDownload} size="sm" variant="outline">
                      取消下载
                    </Button>
                  </>
                ) : null}

                {appUpdateStatus.phase === 'downloaded' ? (
                  <>
                    <Alert>
                      <CircleCheck aria-hidden="true" />
                      <AlertTitle>更新已准备好</AlertTitle>
                      <AlertDescription>
                        <p>重启浮现即可安装 {appUpdateStatus.availableVersion}。</p>
                        {appUpdateStatus.message ? <p>{appUpdateStatus.message}</p> : null}
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center gap-2">
                      <Button onClick={installUpdate} size="sm">
                        <RefreshCw data-icon="inline-start" />
                        重启并更新
                      </Button>
                      <Button onClick={() => window.close()} size="sm" variant="outline">
                        稍后
                      </Button>
                    </div>
                  </>
                ) : null}

                {appUpdateStatus.phase === 'installing' ? (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary" role="status">
                    <Spinner />
                    正在重启并安装更新...
                  </div>
                ) : null}

                {appUpdateStatus.phase === 'error' ? (
                  <Alert variant="destructive">
                    <Info aria-hidden="true" />
                    <AlertTitle>软件更新失败</AlertTitle>
                    <AlertDescription>
                      <p>{appUpdateStatus.message ?? '暂时无法完成更新。'}</p>
                      <Button onClick={checkForUpdates} size="sm" variant="outline">
                        <RefreshCw data-icon="inline-start" />
                        重试
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {appUpdateStatus.phase === 'unsupported' ? (
                  <Alert>
                    <Info aria-hidden="true" />
                    <AlertTitle>当前环境不检查更新</AlertTitle>
                    <AlertDescription>
                      正式安装的 Windows 和 macOS 版本支持软件更新。
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </section>
          ) : null}

          {section === 'appearance' ? (
            <section aria-labelledby="appearance-title">
              <h2 className="text-base font-semibold" id="appearance-title">
                外观
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">选择应用和完成文档的明暗外观。</p>
              <Separator className="my-5" />
              <Field>
                <FieldLabel>颜色模式</FieldLabel>
                <SegmentedControl
                  aria-label="颜色模式"
                  className="w-full"
                  onValueChange={selectAppearance}
                  type="single"
                  value={preferences.appearance}
                >
                  {appearanceOptions.map(({ icon: Icon, label, value }) => (
                    <SegmentedControlItem className="flex-1" key={value} value={value}>
                      <Icon aria-hidden="true" />
                      {label}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </Field>
            </section>
          ) : null}

          {section === 'document' ? (
            <section aria-labelledby="document-title">
              <h2 className="text-base font-semibold" id="document-title">
                文档
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">设置全局文档宽度与正文排版。</p>

              <Separator className="my-5" />
              <Field>
                <FieldTitle>文档宽度</FieldTitle>
                <FieldDescription>
                  调整整个白色文档区域；正文、表格、代码、公式、图片和图表共用纸内宽度。
                </FieldDescription>
                <DocumentWidthControls
                  onChange={(documentWidth) => updatePreferences({ ...preferences, documentWidth })}
                  value={preferences.documentWidth}
                />
              </Field>

              <Separator className="my-6" />
              <Field>
                <FieldLabel>正文字体</FieldLabel>
                <SegmentedControl
                  aria-label="正文字体"
                  className="w-full"
                  onValueChange={selectBodyFamily}
                  type="single"
                  value={preferences.documentTypography.bodyFamily}
                >
                  {(
                    [
                      ['serif', '衬线'],
                      ['sans-serif', '无衬线'],
                    ] as Array<[DocumentBodyFamily, string]>
                  ).map(([value, label]) => (
                    <SegmentedControlItem className="flex-1" key={value} value={value}>
                      <Type aria-hidden="true" />
                      {label}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
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

              <Separator className="my-6" />
              <Field>
                <FieldTitle>代码高亮主题</FieldTitle>
                <FieldDescription>
                  独立于应用明暗模式。切换后可在右侧代表性代码中即时预览。
                </FieldDescription>
                <ToggleGroup
                  aria-label="代码高亮主题"
                  className="grid w-full grid-cols-2 gap-2"
                  onValueChange={selectCodeTheme}
                  spacing={2}
                  type="single"
                  value={preferences.codeHighlight.theme}
                  variant="outline"
                >
                  {codeThemeOptions.map(({ background, label, tokens, value }) => (
                    <ToggleGroupItem
                      className="h-auto min-h-14 flex-col items-stretch gap-1.5 px-2.5 py-2"
                      key={value}
                      value={value}
                    >
                      <span className="truncate text-left">{label}</span>
                      <span
                        aria-hidden="true"
                        className="flex h-3 overflow-hidden rounded-sm border"
                        style={{ backgroundColor: background }}
                      >
                        {tokens.map((color) => (
                          <span className="flex-1" key={color} style={{ backgroundColor: color }} />
                        ))}
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </section>
          ) : null}

          {section === 'plantuml' ? (
            <section aria-labelledby="plantuml-title">
              <h2 className="text-base font-semibold" id="plantuml-title">
                PlantUML
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">
                配置用于生成 PlantUML SVG 的公共、本地或私有服务。
              </p>
              <Separator className="my-5" />

              <form onSubmit={(event) => void validateAndSavePlantUmlServer(event)}>
                <FieldGroup>
                  <Field data-invalid={plantUmlValidation.status === 'error'}>
                    <FieldLabel htmlFor="plantuml-server-url">Server 地址</FieldLabel>
                    <Input
                      aria-invalid={plantUmlValidation.status === 'error'}
                      autoCapitalize="none"
                      autoComplete="off"
                      disabled={plantUmlValidation.status === 'checking'}
                      id="plantuml-server-url"
                      onChange={(event) => {
                        setPlantUmlServerDraft(event.target.value);
                        setPlantUmlValidation({ status: 'idle' });
                      }}
                      placeholder="http://127.0.0.1:8080/plantuml"
                      spellCheck={false}
                      type="url"
                      value={plantUmlServerValue}
                    />
                    <FieldDescription>
                      默认使用公共服务。地址验证通过后才会保存，并立即重绘已打开文档中的 PlantUML
                      图表。
                    </FieldDescription>
                    {plantUmlValidation.status === 'error' ? (
                      <FieldError>{plantUmlValidation.message}</FieldError>
                    ) : null}
                  </Field>

                  <Field orientation="horizontal">
                    <Button
                      aria-live="polite"
                      disabled={plantUmlValidation.status === 'checking'}
                      size="sm"
                      type="submit"
                    >
                      {plantUmlValidation.status === 'checking' ? (
                        <Spinner data-icon="inline-start" />
                      ) : plantUmlValidation.status === 'saved' ? (
                        <CircleCheck aria-hidden="true" data-icon="inline-start" />
                      ) : null}
                      {plantUmlValidation.status === 'checking'
                        ? '正在验证'
                        : plantUmlValidation.status === 'saved'
                          ? '已验证并保存'
                          : '验证并保存'}
                    </Button>
                    <Button
                      disabled={plantUmlValidation.status === 'checking'}
                      onClick={() => {
                        setPlantUmlServerDraft(defaultPlantUmlServerUrl);
                        setPlantUmlValidation({ status: 'idle' });
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RotateCcw data-icon="inline-start" />
                      恢复默认
                    </Button>
                  </Field>
                  {plantUmlValidation.status === 'saved' ? (
                    <div
                      aria-live="polite"
                      className="flex items-center gap-1.5 text-sm text-status-success"
                      role="status"
                    >
                      <CircleCheck aria-hidden="true" className="size-4" />
                      <span>连接验证成功，地址已保存。</span>
                    </div>
                  ) : null}
                </FieldGroup>
              </form>

              <Alert className="mt-6">
                <Info />
                <AlertTitle>源码发送范围</AlertTitle>
                <AlertDescription>
                  PlantUML 源码会发送到上方配置的服务。不要在图表中放入不应离开设备的敏感内容。
                </AlertDescription>
              </Alert>
            </section>
          ) : null}
        </main>

        {section === 'about' ? (
          <aside
            aria-label="关于浮现"
            className="flex min-h-0 flex-col items-center justify-center border-l border-line-subtle bg-surface-stage px-8 text-center"
            data-settings-surface="preview"
          >
            <FuxianAppIcon className="size-24" decorative={false} />
            <h2 className="mt-5 text-lg font-semibold">浮现</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-fg-secondary">
              专注于 Markdown 成品文档阅读与 PDF 交付。
            </p>
          </aside>
        ) : (
          <aside
            className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)] bg-surface-stage"
            aria-label="实时预览"
            data-settings-surface="preview"
          >
            <div className="flex items-center border-b border-line-subtle px-4">
              <span className="text-xs font-medium text-fg-secondary">完成文档预览</span>
            </div>
            <div className="min-h-0 p-3">
              <iframe
                className="block h-full w-full border border-line-subtle bg-surface-document"
                onLoad={handlePreviewLoad}
                ref={previewFrame}
                sandbox="allow-same-origin"
                srcDoc={previewDocumentSource}
                title="完成文档预览"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
