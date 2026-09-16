import type { AppUpdateStatus } from '@fuxian/shared-types';
import { ExternalLink, RefreshCw, Download, PackageOpen } from 'lucide-react';
import { FuxianAppIcon } from '@/fuxian-mark';
import { useLocalization } from '@/localization-context';
import { useAppUpdateStatus } from '@/use-app-update-status';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Spinner } from './ui/spinner';
import { Progress } from './ui/progress';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { SettingsSection } from './settings-section';
import { DiagnosticControls } from './diagnostic-controls';
import { UpdateReleaseNotes } from './update-release-notes';

const repositoryUrl = 'https://github.com/def-peter/fuxian';
const formatBytes = (bytes: number | undefined): string =>
  `${(Math.max(0, bytes ?? 0) / 1_048_576).toFixed(1)} MB`;

function SoftwareUpdateControls({ status }: { status: AppUpdateStatus }): React.JSX.Element {
  const { t } = useLocalization();
  const check = (): void => {
    void window.fuxian.checkForAppUpdates();
  };
  const download = (): void => {
    void window.fuxian.downloadAppUpdate();
  };
  const openRelease = (): void => {
    void window.fuxian.openAppUpdateRelease();
  };
  const install = (): void => {
    void window.fuxian.installAppUpdate();
  };
  const messages = {
    idle: t('检查是否有新版本可用。'),
    checking: t('正在检查更新...'),
    'up-to-date': t('当前已是最新版本'),
    available: t('新版本 {version} 可用', { version: status.availableVersion ?? '' }),
    downloading: t('正在下载 {version}', { version: status.availableVersion ?? '' }),
    downloaded: t('更新已准备好'),
    installing: t('正在重启并安装更新...'),
    error: t('软件更新失败'),
    unsupported: t('当前环境不检查更新'),
  };
  const showRelease =
    status.phase !== 'unsupported' &&
    !(status.delivery === 'release-page' && status.phase === 'available');
  const showNotes =
    status.releaseNotes &&
    ['available', 'downloading', 'downloaded', 'error'].includes(status.phase);
  return (
    <SettingsSection
      id="software-update-title"
      title={t('软件更新')}
      description={
        <div aria-live="polite" className="flex items-center gap-2">
          {status.phase === 'checking' || status.phase === 'installing' ? <Spinner /> : null}
          {messages[status.phase]}
        </div>
      }
      actions={
        <>
          {status.phase === 'idle' || status.phase === 'up-to-date' ? (
            <Button onClick={check} size="sm" variant="outline">
              <RefreshCw data-icon="inline-start" />
              {status.phase === 'idle' ? t('检查更新') : t('重新检查')}
            </Button>
          ) : null}
          {status.phase === 'available' ? (
            <Button onClick={status.delivery === 'release-page' ? openRelease : download} size="sm">
              {status.delivery === 'release-page' ? (
                <ExternalLink data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {status.delivery === 'release-page' ? t('前往 GitHub Release') : t('下载更新')}
            </Button>
          ) : null}
          {status.phase === 'downloading' ? (
            <Button
              onClick={() => void window.fuxian.cancelAppUpdateDownload()}
              size="sm"
              variant="outline"
            >
              {t('取消下载')}
            </Button>
          ) : null}
          {status.phase === 'downloaded' ? (
            <>
              <Button onClick={install} size="sm">
                {status.delivery === 'manual-install' ? (
                  <PackageOpen data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                {status.delivery === 'manual-install' ? t('打开安装包') : t('重启并更新')}
              </Button>
              <Button onClick={() => window.close()} size="sm" variant="ghost">
                {t('稍后')}
              </Button>
            </>
          ) : null}
          {status.phase === 'error' ? (
            <Button
              onClick={status.availableVersion ? download : check}
              size="sm"
              variant="outline"
            >
              <RefreshCw data-icon="inline-start" />
              {t('重试')}
            </Button>
          ) : null}
          {showRelease ? (
            <Button onClick={openRelease} size="sm" variant="ghost">
              <ExternalLink data-icon="inline-start" />
              {t('在 GitHub 下载')}
            </Button>
          ) : null}
        </>
      }
    >
      {status.phase === 'downloading' ? (
        <div className="flex flex-col gap-2">
          <Progress aria-label={t('更新下载进度')} value={status.percent ?? 0} />
          <div className="flex flex-wrap justify-between gap-2 text-xs tabular-nums text-fg-secondary">
            <span>
              {formatBytes(status.transferred)} / {formatBytes(status.total)} ·{' '}
              {formatBytes(status.bytesPerSecond)}/s
            </span>
            <output>{Math.round(status.percent ?? 0)}%</output>
          </div>
        </div>
      ) : null}
      {status.phase === 'downloaded' ? (
        <p className="text-sm leading-6 text-fg-secondary">
          {t(
            status.delivery === 'manual-install'
              ? '打开安装包后，将 Fuxian 拖到 Applications 文件夹；若旧版“浮现”仍在，可将其删除。'
              : '重启浮现即可安装 {version}。',
            { version: status.availableVersion ?? '' },
          )}
        </p>
      ) : null}
      {status.phase === 'unsupported' ? (
        <p className="text-sm leading-6 text-fg-secondary">
          {t('正式安装的 Windows 和 macOS 版本支持软件更新。')}
        </p>
      ) : null}
      {status.phase === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>{t('暂时无法完成更新。')}</AlertTitle>
          <AlertDescription>{status.message ?? t('请稍后重试。')}</AlertDescription>
        </Alert>
      ) : status.message && ['available', 'downloaded'].includes(status.phase) ? (
        <p className="text-sm leading-6 text-fg-secondary">{status.message}</p>
      ) : null}
      {showNotes && status.releaseNotes ? (
        <UpdateReleaseNotes notes={status.releaseNotes} onOpen={openRelease} />
      ) : null}
    </SettingsSection>
  );
}

export function AboutSettings(): React.JSX.Element {
  const { locale, t } = useLocalization();
  const status = useAppUpdateStatus();
  return (
    <section aria-labelledby="about-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h2 id="about-title" className="text-base font-semibold">
        {t('关于与更新')}
      </h2>
      <div aria-label={t('关于浮现')} className="flex flex-col items-center gap-3 pb-2 text-center">
        <div className="flex items-center gap-3">
          <FuxianAppIcon className="size-14" decorative={false} />
          <div className="text-left">
            <p className="text-xl font-semibold">{t('浮现')}</p>
            <p className="mt-1 text-xs text-fg-secondary">
              {t('版本 {version}', { version: status.currentVersion || '--' })}
            </p>
          </div>
        </div>
        <p className="text-sm leading-6 text-fg-secondary">
          {t('让内容精彩浮现，让 Markdown 值得阅读。')}
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {[
            {
              label: t('官网'),
              href: `https://def-peter.github.io/fuxian/${locale === 'zh-CN' ? 'zh' : 'en'}/`,
            },
            { label: 'GitHub', href: repositoryUrl },
            { label: t('反馈问题'), href: `${repositoryUrl}/issues` },
          ].map(({ label, href }) => (
            <Button asChild key={href} size="sm" variant="ghost">
              <a href={href} target="_blank" rel="noreferrer">
                {label}
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          ))}
        </div>
      </div>
      <Separator />
      <SoftwareUpdateControls status={status} />
      <Separator />
      <DiagnosticControls />
    </section>
  );
}
