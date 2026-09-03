import { renderMarkdown } from '@fuxian/markdown-renderer';
import {
  defaultPlantUmlServerUrl,
  isCodeHighlightTheme,
  isSettingsSectionId,
  readerPreferenceLimits,
  type AppearancePreference,
  type CodeHighlightTheme,
  type DocumentBodyFamily,
  type MarkdownDefaultAppStatus,
  type ReaderPreferences,
  type SettingsSectionId,
  type UiLanguagePreference,
  type UiLocale,
} from '@fuxian/shared-types';
import {
  CircleArrowUp,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Download,
  ExternalLink,
  FileText,
  Info,
  Monitor,
  Moon,
  Network,
  RefreshCw,
  RotateCcw,
  Settings2,
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
import { useLocalization } from '@/localization-context';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';
import { useAppUpdateStatus } from '@/use-app-update-status';

type PlantUmlValidationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { message: string; status: 'error' }
  | { status: 'saved' };

const previewSources: Record<UiLocale, string> = {
  'zh-CN': `# 完成文档示例

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
`,
  'en-US': `# Finished document sample

Fuxian brings Markdown back to a clear, quiet reading experience. **Document typography** updates as you change settings.

> A good reading experience should never let the tool overwhelm the content.

## Content hierarchy

- Headings retain a clear hierarchy
- Tables, code, and body text share one width

| Item | Current state |
| --- | --- |
| Document theme | Live preview |
| Reading width | Applied globally |

\`\`\`typescript
type FinishedDocument = {
  title: string
  pages: number
}

async function render(source: string) {
  const pages = await paginate(source)
  return { title: "Fuxian", pages }
}
\`\`\`
`,
};

const settingsSections: Array<{
  icon: typeof Sun;
  id: SettingsSectionId;
  label: 'PlantUML' | '关于与更新' | '外观' | '文档' | '通用';
}> = [
  { icon: Settings2, id: 'general', label: '通用' },
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
  label: '浅色' | '深色' | '跟随系统';
  value: AppearancePreference;
}> = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '跟随系统', value: 'system' },
];

const languageOptions: Array<{
  label: 'English' | '中文' | '跟随系统';
  value: UiLanguagePreference;
}> = [
  { label: '跟随系统', value: 'system' },
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const codeThemeOptions: Array<{
  background: string;
  label: 'GitHub 浅色' | 'GitHub 深色' | '浮现浅色' | '浮现深色';
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
  const { locale, t } = useLocalization();
  const appUpdateStatus = useAppUpdateStatus();
  const [section, setSection] = useState<SettingsSectionId>(initialSettingsSection);
  const [plantUmlServerDraft, setPlantUmlServerDraft] = useState<string>();
  const [plantUmlValidation, setPlantUmlValidation] = useState<PlantUmlValidationState>({
    status: 'idle',
  });
  const [defaultAppStatus, setDefaultAppStatus] = useState<MarkdownDefaultAppStatus>();
  const [defaultAppLoading, setDefaultAppLoading] = useState(false);
  const [defaultAppActionMessage, setDefaultAppActionMessage] = useState<string>();
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const documentTheme = useMemo(
    () => toDocumentThemePreferences(preferences, resolvedAppearance),
    [preferences, resolvedAppearance],
  );
  const previewDocumentSource = useMemo(
    () => createFinishedDocumentSource(renderMarkdown({ source: previewSources[locale] }).html),
    [locale],
  );
  const plantUmlServerValue = plantUmlServerDraft ?? preferences.plantUml.serverUrl;

  useEffect(() => {
    const frameDocument = previewFrame.current?.contentDocument;
    if (frameDocument) {
      applyDocumentTheme(frameDocument, documentTheme);
    }
  }, [documentTheme]);

  useEffect(() => window.fuxian.onSettingsSectionRequested(setSection), []);

  useEffect(() => {
    if (section !== 'general') return;
    let active = true;
    const refresh = (): void => {
      setDefaultAppLoading(true);
      void window.fuxian
        .getMarkdownDefaultAppStatus()
        .then((status) => {
          if (active) setDefaultAppStatus(status);
        })
        .finally(() => {
          if (active) setDefaultAppLoading(false);
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [section]);

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

  const selectLanguage = (language: string): void => {
    if (language === 'system' || language === 'zh-CN' || language === 'en-US') {
      updatePreferences({ ...preferences, language });
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
      setPlantUmlValidation({ message: t('暂时无法验证 PlantUML Server。'), status: 'error' });
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

  const refreshMarkdownDefaultAppStatus = (): void => {
    setDefaultAppLoading(true);
    void window.fuxian
      .getMarkdownDefaultAppStatus()
      .then(setDefaultAppStatus)
      .finally(() => setDefaultAppLoading(false));
  };

  const openMarkdownDefaultAppSettings = (): void => {
    setDefaultAppActionMessage(undefined);
    void window.fuxian.openMarkdownDefaultAppSettings().then((result) => {
      setDefaultAppActionMessage(result.message);
      if (result.status === 'opened') refreshMarkdownDefaultAppStatus();
    });
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
          <h1 className="text-sm font-semibold">{t('设置')}</h1>
          <p className="text-xs text-fg-secondary">{t('更改会自动保存并应用到所有文档')}</p>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[132px_292px_minmax(0,1fr)]">
        <nav
          aria-label={t('设置分区')}
          className="border-r border-line-subtle bg-surface-sidebar p-2"
        >
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
              {label === 'PlantUML' ? label : t(label)}
            </Button>
          ))}
        </nav>

        <main
          className="min-h-0 overflow-y-auto border-r border-line-subtle bg-surface-panel px-5 py-6"
          aria-busy={!ready}
          data-settings-surface="form"
        >
          {section === 'general' ? (
            <section aria-labelledby="general-title">
              <h2 className="text-base font-semibold" id="general-title">
                {t('通用')}
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">{t('管理浮现与操作系统的集成。')}</p>
              <Separator className="my-5" />

              <Field>
                <FieldTitle>{t('用户界面语言')}</FieldTitle>
                <FieldDescription>{t('界面语言会立即应用到浮现的所有窗口。')}</FieldDescription>
                <SegmentedControl
                  aria-label={t('用户界面语言')}
                  className="w-full"
                  onValueChange={selectLanguage}
                  type="single"
                  value={preferences.language}
                >
                  {languageOptions.map(({ label, value }) => (
                    <SegmentedControlItem className="flex-1" key={value} value={value}>
                      {t(label)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </Field>

              <Separator className="my-5" />

              <Field>
                <FieldTitle>{t('Markdown 默认应用')}</FieldTitle>
                <FieldDescription>{t('Markdown 默认应用说明')}</FieldDescription>
                <div aria-live="polite" className="mt-3 flex flex-col gap-3">
                  {defaultAppLoading && !defaultAppStatus ? (
                    <div
                      className="flex items-center gap-2 text-sm text-fg-secondary"
                      role="status"
                    >
                      <Spinner />
                      {t('正在检查系统设置...')}
                    </div>
                  ) : null}
                  {defaultAppStatus ? (
                    <Alert>
                      {defaultAppStatus.state === 'default' ? (
                        <CircleCheck aria-hidden="true" />
                      ) : defaultAppStatus.state === 'partial' ? (
                        <CircleMinus aria-hidden="true" />
                      ) : (
                        <CircleAlert aria-hidden="true" />
                      )}
                      <AlertTitle>
                        {defaultAppStatus.state === 'default'
                          ? t('已是默认应用')
                          : defaultAppStatus.state === 'partial'
                            ? t('部分关联')
                            : defaultAppStatus.state === 'not-default'
                              ? t('不是默认应用')
                              : t('无法检测')}
                      </AlertTitle>
                      <AlertDescription>
                        {defaultAppStatus.state === 'default'
                          ? t('.md 与 .markdown 均由浮现默认打开。')
                          : defaultAppStatus.state === 'partial'
                            ? t('.md：{md}；.markdown：{markdown}。', {
                                md: defaultAppStatus.md ? t('浮现') : t('其他应用'),
                                markdown: defaultAppStatus.markdown ? t('浮现') : t('其他应用'),
                              })
                            : defaultAppStatus.state === 'not-default'
                              ? t('.md 与 .markdown 当前均由其他应用默认打开。')
                              : (defaultAppStatus.message ?? t('当前环境无法读取文件关联。'))}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {defaultAppStatus &&
                    defaultAppStatus.state !== 'default' &&
                    defaultAppStatus.state !== 'unavailable' ? (
                      <Button onClick={openMarkdownDefaultAppSettings} size="sm">
                        <ExternalLink data-icon="inline-start" />
                        {t('设为 Markdown 默认应用')}
                      </Button>
                    ) : null}
                    <Button
                      disabled={defaultAppLoading}
                      onClick={refreshMarkdownDefaultAppStatus}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCw data-icon="inline-start" />
                      {t('刷新状态')}
                    </Button>
                  </div>
                  {defaultAppActionMessage ? (
                    <p className="text-xs leading-5 text-fg-secondary">{defaultAppActionMessage}</p>
                  ) : null}
                </div>
              </Field>
            </section>
          ) : null}

          {section === 'about' ? (
            <section aria-labelledby="about-title">
              <h2 className="text-base font-semibold" id="about-title">
                {t('关于与更新')}
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">
                {appUpdateStatus.delivery === 'release-page'
                  ? t('查看当前版本，有新版本时前往 GitHub Release 下载。')
                  : t('查看当前版本，并在你准备好时下载和安装更新。')}
              </p>
              <Separator className="my-5" />

              <div className="flex items-center gap-3">
                <FuxianAppIcon className="size-12" decorative={false} />
                <div className="min-w-0">
                  <p className="font-semibold">{t('浮现')}</p>
                  <p className="text-sm text-fg-secondary">
                    {t('版本 {version}', { version: appUpdateStatus.currentVersion || '--' })}
                  </p>
                </div>
              </div>

              <Separator className="my-5" />
              <div aria-live="polite" className="flex flex-col gap-4">
                {appUpdateStatus.phase === 'idle' ? (
                  <Button onClick={checkForUpdates} size="sm">
                    <RefreshCw data-icon="inline-start" />
                    {t('检查更新')}
                  </Button>
                ) : null}

                {appUpdateStatus.phase === 'checking' ? (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary" role="status">
                    <Spinner />
                    {t('正在检查更新...')}
                  </div>
                ) : null}

                {appUpdateStatus.phase === 'up-to-date' ? (
                  <Alert>
                    <CircleCheck aria-hidden="true" />
                    <AlertTitle>{t('当前已是最新版本')}</AlertTitle>
                    <AlertDescription>
                      <Button onClick={checkForUpdates} size="sm" variant="outline">
                        <RefreshCw data-icon="inline-start" />
                        {t('重新检查')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {appUpdateStatus.phase === 'available' ? (
                  <>
                    <Alert>
                      <CircleArrowUp aria-hidden="true" />
                      <AlertTitle>
                        {t('新版本 {version} 可用', {
                          version: appUpdateStatus.availableVersion ?? '',
                        })}
                      </AlertTitle>
                      <AlertDescription>
                        <p>
                          {t('当前版本 {version}', { version: appUpdateStatus.currentVersion })}
                        </p>
                      </AlertDescription>
                    </Alert>
                    {appUpdateStatus.releaseNotes ? (
                      <div>
                        <h3 className="text-sm font-medium">{t('更新内容')}</h3>
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
                        {t('前往 GitHub Release')}
                      </Button>
                    ) : (
                      <Button onClick={downloadUpdate} size="sm">
                        <Download data-icon="inline-start" />
                        {t('下载更新')}
                      </Button>
                    )}
                  </>
                ) : null}

                {appUpdateStatus.phase === 'downloading' ? (
                  <>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        {t('正在下载 {version}', {
                          version: appUpdateStatus.availableVersion ?? '',
                        })}
                      </span>
                      <output className="tabular-nums">
                        {Math.round(appUpdateStatus.percent ?? 0)}%
                      </output>
                    </div>
                    <Progress aria-label={t('更新下载进度')} value={appUpdateStatus.percent ?? 0} />
                    <p className="text-xs tabular-nums text-fg-secondary">
                      {formatBytes(appUpdateStatus.transferred)} /{' '}
                      {formatBytes(appUpdateStatus.total)}
                    </p>
                    <Button onClick={cancelUpdateDownload} size="sm" variant="outline">
                      {t('取消下载')}
                    </Button>
                  </>
                ) : null}

                {appUpdateStatus.phase === 'downloaded' ? (
                  <>
                    <Alert>
                      <CircleCheck aria-hidden="true" />
                      <AlertTitle>{t('更新已准备好')}</AlertTitle>
                      <AlertDescription>
                        <p>
                          {t('重启浮现即可安装 {version}。', {
                            version: appUpdateStatus.availableVersion ?? '',
                          })}
                        </p>
                        {appUpdateStatus.message ? <p>{appUpdateStatus.message}</p> : null}
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center gap-2">
                      <Button onClick={installUpdate} size="sm">
                        <RefreshCw data-icon="inline-start" />
                        {t('重启并更新')}
                      </Button>
                      <Button onClick={() => window.close()} size="sm" variant="outline">
                        {t('稍后')}
                      </Button>
                    </div>
                  </>
                ) : null}

                {appUpdateStatus.phase === 'installing' ? (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary" role="status">
                    <Spinner />
                    {t('正在重启并安装更新...')}
                  </div>
                ) : null}

                {appUpdateStatus.phase === 'error' ? (
                  <Alert variant="destructive">
                    <Info aria-hidden="true" />
                    <AlertTitle>{t('软件更新失败')}</AlertTitle>
                    <AlertDescription>
                      <p>{appUpdateStatus.message ?? t('暂时无法完成更新。')}</p>
                      <Button onClick={checkForUpdates} size="sm" variant="outline">
                        <RefreshCw data-icon="inline-start" />
                        {t('重试')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {appUpdateStatus.phase === 'unsupported' ? (
                  <Alert>
                    <Info aria-hidden="true" />
                    <AlertTitle>{t('当前环境不检查更新')}</AlertTitle>
                    <AlertDescription>
                      {t('正式安装的 Windows 和 macOS 版本支持软件更新。')}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </section>
          ) : null}

          {section === 'appearance' ? (
            <section aria-labelledby="appearance-title">
              <h2 className="text-base font-semibold" id="appearance-title">
                {t('外观')}
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">
                {t('选择应用和完成文档的明暗外观。')}
              </p>
              <Separator className="my-5" />
              <Field>
                <FieldLabel>{t('颜色模式')}</FieldLabel>
                <SegmentedControl
                  aria-label={t('颜色模式')}
                  className="w-full"
                  onValueChange={selectAppearance}
                  type="single"
                  value={preferences.appearance}
                >
                  {appearanceOptions.map(({ icon: Icon, label, value }) => (
                    <SegmentedControlItem className="flex-1" key={value} value={value}>
                      <Icon aria-hidden="true" />
                      {t(label)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </Field>
            </section>
          ) : null}

          {section === 'document' ? (
            <section aria-labelledby="document-title">
              <h2 className="text-base font-semibold" id="document-title">
                {t('文档')}
              </h2>
              <p className="mt-1 text-sm text-fg-secondary">{t('设置全局文档宽度与正文排版。')}</p>

              <Separator className="my-5" />
              <Field>
                <FieldTitle>{t('文档宽度')}</FieldTitle>
                <FieldDescription>{t('文档宽度设置说明')}</FieldDescription>
                <DocumentWidthControls
                  onChange={(documentWidth) => updatePreferences({ ...preferences, documentWidth })}
                  value={preferences.documentWidth}
                />
              </Field>

              <Separator className="my-6" />
              <Field>
                <FieldLabel>{t('正文字体')}</FieldLabel>
                <SegmentedControl
                  aria-label={t('正文字体')}
                  className="w-full"
                  onValueChange={selectBodyFamily}
                  type="single"
                  value={preferences.documentTypography.bodyFamily}
                >
                  {(
                    [
                      ['serif', t('衬线')],
                      ['sans-serif', t('无衬线')],
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
                  <FieldLabel>{t('正文字号')}</FieldLabel>
                  <output className="text-sm tabular-nums">
                    {preferences.documentTypography.bodySize}px
                  </output>
                </div>
                <Slider
                  aria-label={t('正文字号')}
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
                  <FieldLabel>{t('正文行高')}</FieldLabel>
                  <output className="text-sm tabular-nums">
                    {preferences.documentTypography.lineHeight.toFixed(2)}
                  </output>
                </div>
                <Slider
                  aria-label={t('正文行高')}
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
                <FieldTitle>{t('代码高亮主题')}</FieldTitle>
                <FieldDescription>{t('代码高亮主题说明')}</FieldDescription>
                <ToggleGroup
                  aria-label={t('代码高亮主题')}
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
                      <span className="truncate text-left">{t(label)}</span>
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
                {t('配置用于生成 PlantUML SVG 的公共、本地或私有服务。')}
              </p>
              <Separator className="my-5" />

              <form onSubmit={(event) => void validateAndSavePlantUmlServer(event)}>
                <FieldGroup>
                  <Field data-invalid={plantUmlValidation.status === 'error'}>
                    <FieldLabel htmlFor="plantuml-server-url">{t('Server 地址')}</FieldLabel>
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
                    <FieldDescription>{t('PlantUML Server 设置说明')}</FieldDescription>
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
                        ? t('正在验证')
                        : plantUmlValidation.status === 'saved'
                          ? t('已验证并保存')
                          : t('验证并保存')}
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
                      {t('恢复默认')}
                    </Button>
                  </Field>
                  {plantUmlValidation.status === 'saved' ? (
                    <div
                      aria-live="polite"
                      className="flex items-center gap-1.5 text-sm text-status-success"
                      role="status"
                    >
                      <CircleCheck aria-hidden="true" className="size-4" />
                      <span>{t('连接验证成功，地址已保存。')}</span>
                    </div>
                  ) : null}
                </FieldGroup>
              </form>

              <Alert className="mt-6">
                <Info />
                <AlertTitle>{t('源码发送范围')}</AlertTitle>
                <AlertDescription>{t('PlantUML 源码发送说明')}</AlertDescription>
              </Alert>
            </section>
          ) : null}
        </main>

        {section === 'about' ? (
          <aside
            aria-label={t('关于浮现')}
            className="flex min-h-0 flex-col items-center justify-center border-l border-line-subtle bg-surface-stage px-8 text-center"
            data-settings-surface="preview"
          >
            <FuxianAppIcon className="size-24" decorative={false} />
            <h2 className="mt-5 text-lg font-semibold">{t('浮现')}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-fg-secondary">
              {t('让内容精彩浮现，让 Markdown 值得阅读。')}
            </p>
          </aside>
        ) : (
          <aside
            className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)] bg-surface-stage"
            aria-label={t('实时预览')}
            data-settings-surface="preview"
          >
            <div className="flex items-center border-b border-line-subtle px-4">
              <span className="text-xs font-medium text-fg-secondary">{t('完成文档预览')}</span>
            </div>
            <div className="min-h-0 p-3">
              <iframe
                className="block h-full w-full border border-line-subtle bg-surface-document"
                onLoad={handlePreviewLoad}
                ref={previewFrame}
                sandbox="allow-same-origin"
                srcDoc={previewDocumentSource}
                title={t('完成文档预览')}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
