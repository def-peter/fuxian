import { CancellationToken } from 'builder-util-runtime';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import type { AppUpdatePhase, AppUpdateStatus } from '@fuxian/shared-types';

export interface AppUpdateAdapter {
  allowDowngrade: boolean;
  allowPrerelease: boolean;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  disableWebInstaller: boolean;
  on(event: 'checking-for-update', listener: () => void): unknown;
  on(event: 'download-progress', listener: (progress: ProgressInfo) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(
    event: 'update-available' | 'update-not-available',
    listener: (info: UpdateInfo) => void,
  ): unknown;
  on(event: 'update-cancelled', listener: (info: UpdateInfo) => void): unknown;
  on(event: 'update-downloaded', listener: (info: UpdateDownloadedEvent) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(cancellationToken?: CancellationToken): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

interface AppUpdateServiceOptions {
  adapter: AppUpdateAdapter;
  beforeInstall(): Promise<void>;
  broadcast(status: AppUpdateStatus): void;
  currentVersion: string;
  supported: boolean;
}

const releaseText = (value: unknown, maximumLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replaceAll(/\p{Cc}+/gu, ' ').trim();
  return normalized ? normalized.slice(0, maximumLength) : undefined;
};

const releaseNotesText = (releaseNotes: UpdateInfo['releaseNotes']): string | undefined => {
  const source =
    typeof releaseNotes === 'string'
      ? releaseNotes
      : releaseNotes
          ?.map(({ note }) => note)
          .filter((note): note is string => typeof note === 'string')
          .join('\n\n');
  return releaseText(source, 12_000);
};

const updateFailureMessage = (operation: 'check' | 'download' | 'install'): string => {
  if (operation === 'download') return '无法下载更新，请检查网络后重试。';
  if (operation === 'install') return '暂时无法重启安装，请稍后重试。';
  return '无法检查更新，请检查网络后重试。';
};

export class AppUpdateService {
  private checkPromise: Promise<AppUpdateStatus> | undefined;
  private downloadPromise: Promise<AppUpdateStatus> | undefined;
  private downloadToken: CancellationToken | undefined;
  private initialized = false;
  private status: AppUpdateStatus;

  constructor(private readonly options: AppUpdateServiceOptions) {
    this.status = {
      currentVersion: options.currentVersion,
      message: options.supported ? undefined : '当前环境不支持软件更新。',
      phase: options.supported ? 'idle' : 'unsupported',
    };
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    const { adapter } = this.options;
    adapter.autoDownload = false;
    adapter.autoInstallOnAppQuit = false;
    adapter.allowPrerelease = false;
    adapter.allowDowngrade = false;
    adapter.disableWebInstaller = true;

    adapter.on('checking-for-update', () => {
      this.update({ message: undefined, phase: 'checking' });
    });
    adapter.on('update-available', (info) => this.updateFromInfo('available', info));
    adapter.on('update-not-available', (info) => {
      this.update({
        availableVersion: undefined,
        checkedAt: new Date().toISOString(),
        message: undefined,
        phase: 'up-to-date',
        releaseDate: undefined,
        releaseName: undefined,
        releaseNotes: undefined,
      });
      void info;
    });
    adapter.on('download-progress', (progress) => {
      this.update({
        bytesPerSecond: Math.max(0, progress.bytesPerSecond),
        message: undefined,
        percent: Math.min(100, Math.max(0, progress.percent)),
        phase: 'downloading',
        total: Math.max(0, progress.total),
        transferred: Math.max(0, progress.transferred),
      });
    });
    adapter.on('update-cancelled', () => this.finishCancellation());
    adapter.on('update-downloaded', (info) => {
      this.downloadToken = undefined;
      this.updateFromInfo('downloaded', info);
    });
    adapter.on('error', (error) => {
      if (this.downloadToken?.cancelled) {
        this.finishCancellation();
        return;
      }
      console.error('[app-update] updater failure', error);
      this.fail(this.status.phase === 'downloading' ? 'download' : 'check');
    });
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status };
  }

  checkForUpdates(): Promise<AppUpdateStatus> {
    if (
      !this.options.supported ||
      this.status.phase === 'downloaded' ||
      this.status.phase === 'downloading' ||
      this.status.phase === 'installing'
    ) {
      return Promise.resolve(this.getStatus());
    }
    if (this.checkPromise) return this.checkPromise;
    this.initialize();
    this.update({ message: undefined, phase: 'checking' });
    const operation = this.options.adapter
      .checkForUpdates()
      .catch((error: unknown) => {
        console.error('[app-update] check failed', error);
        this.fail('check');
      })
      .then(() => this.getStatus())
      .finally(() => {
        if (this.checkPromise === operation) this.checkPromise = undefined;
      });
    this.checkPromise = operation;
    return operation;
  }

  downloadUpdate(): Promise<AppUpdateStatus> {
    if (this.downloadPromise) return this.downloadPromise;
    if (this.status.phase !== 'available') {
      return Promise.resolve(this.getStatus());
    }
    const token = new CancellationToken();
    this.downloadToken = token;
    this.update({
      bytesPerSecond: 0,
      message: undefined,
      percent: 0,
      phase: 'downloading',
      total: 0,
      transferred: 0,
    });
    const operation = this.options.adapter
      .downloadUpdate(token)
      .catch((error: unknown) => {
        if (token.cancelled) {
          this.finishCancellation();
          return;
        }
        console.error('[app-update] download failed', error);
        this.fail('download');
      })
      .then(() => this.getStatus())
      .finally(() => {
        if (this.downloadPromise === operation) this.downloadPromise = undefined;
        if (this.downloadToken === token) this.downloadToken = undefined;
      });
    this.downloadPromise = operation;
    return operation;
  }

  cancelDownload(): AppUpdateStatus {
    this.downloadToken?.cancel();
    if (this.status.phase === 'downloading') this.finishCancellation();
    return this.getStatus();
  }

  async installUpdate(): Promise<AppUpdateStatus> {
    if (this.status.phase !== 'downloaded') return this.getStatus();
    try {
      await this.options.beforeInstall();
    } catch (error) {
      console.error('[app-update] install preparation failed', error);
      this.update({ message: updateFailureMessage('install'), phase: 'downloaded' });
      return this.getStatus();
    }
    this.update({ message: undefined, phase: 'installing' });
    try {
      this.options.adapter.quitAndInstall(false, true);
    } catch (error) {
      console.error('[app-update] install failed', error);
      this.update({ message: updateFailureMessage('install'), phase: 'downloaded' });
    }
    return this.getStatus();
  }

  private fail(operation: 'check' | 'download' | 'install'): AppUpdateStatus {
    this.update({ message: updateFailureMessage(operation), phase: 'error' });
    return this.getStatus();
  }

  private finishCancellation(): void {
    this.downloadToken = undefined;
    this.update({
      bytesPerSecond: undefined,
      message: '已取消下载，可以稍后重新检查。',
      percent: undefined,
      phase: 'available',
      total: undefined,
      transferred: undefined,
    });
  }

  private updateFromInfo(
    phase: Extract<AppUpdatePhase, 'available' | 'downloaded'>,
    info: UpdateInfo,
  ): void {
    this.update({
      availableVersion: releaseText(info.version, 64),
      checkedAt: new Date().toISOString(),
      message: undefined,
      percent: phase === 'downloaded' ? 100 : undefined,
      phase,
      releaseDate: releaseText(info.releaseDate, 64),
      releaseName: releaseText(info.releaseName, 200),
      releaseNotes: releaseNotesText(info.releaseNotes),
    });
  }

  private update(patch: Partial<AppUpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    this.options.broadcast(this.getStatus());
  }
}
