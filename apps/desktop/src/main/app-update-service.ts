import { CancellationToken } from 'builder-util-runtime';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import type { AppUpdateDelivery, AppUpdatePhase, AppUpdateStatus } from '@fuxian/shared-types';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

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
  delivery: AppUpdateDelivery;
  openReleasePage(version: string): Promise<void>;
  supported: boolean;
}

const releaseText = (value: unknown, maximumLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replaceAll(/\p{Cc}+/gu, ' ').trim();
  return normalized ? normalized.slice(0, maximumLength) : undefined;
};

const releaseNotesBlockElements = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);
const ignoredReleaseNotesElements = new Set(['noscript', 'script', 'style', 'template']);
const maximumReleaseNotesSourceLength = 100_000;

const htmlToReleaseNotesText = (source: string): string => {
  const fragment = parseFragment(source.slice(0, maximumReleaseNotesSourceLength));
  const parts: string[] = [];
  let pendingLineBreaks = 0;
  const appendLineBreaks = (count: 1 | 2): void => {
    pendingLineBreaks = Math.max(pendingLineBreaks, count);
  };
  const appendText = (value: string): void => {
    if (!value || (pendingLineBreaks > 0 && !value.trim())) return;
    if (pendingLineBreaks > 0) parts.push('\n'.repeat(pendingLineBreaks));
    pendingLineBreaks = 0;
    parts.push(value);
  };
  const visit = (node: DefaultTreeAdapterTypes.ChildNode): void => {
    if (node.nodeName === '#text' && 'value' in node) {
      appendText(node.value);
      return;
    }
    if (!('tagName' in node) || ignoredReleaseNotesElements.has(node.tagName)) return;
    if (node.tagName === 'br') {
      appendLineBreaks(1);
      return;
    }

    const isListItem = node.tagName === 'li';
    const isBlock = isListItem || releaseNotesBlockElements.has(node.tagName);
    if (isBlock) appendLineBreaks(isListItem ? 1 : 2);
    if (isListItem) appendText('- ');
    for (const child of node.childNodes) visit(child);
    if (isBlock) appendLineBreaks(isListItem ? 1 : 2);
  };

  for (const node of fragment.childNodes) visit(node);
  return parts
    .join('')
    .replaceAll(/\p{Cc}/gu, (character) => (character === '\n' ? '\n' : ' '))
    .split('\n')
    .map((line) => line.replaceAll(/\s+/gu, ' ').trim())
    .join('\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();
};

const releaseNotesText = (releaseNotes: UpdateInfo['releaseNotes']): string | undefined => {
  const sources =
    typeof releaseNotes === 'string'
      ? [releaseNotes]
      : (releaseNotes ?? []).flatMap(({ note }) => (typeof note === 'string' ? [note] : []));
  const normalized = sources.map(htmlToReleaseNotesText).filter(Boolean).join('\n\n');
  return normalized ? normalized.slice(0, 12_000) : undefined;
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
      delivery: options.delivery,
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
    if (this.options.delivery !== 'automatic-install') {
      return Promise.resolve(this.getStatus());
    }
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
    if (this.options.delivery !== 'automatic-install') return this.getStatus();
    this.downloadToken?.cancel();
    if (this.status.phase === 'downloading') this.finishCancellation();
    return this.getStatus();
  }

  async installUpdate(): Promise<AppUpdateStatus> {
    if (this.options.delivery !== 'automatic-install') return this.getStatus();
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

  async openReleasePage(): Promise<AppUpdateStatus> {
    const version = this.status.availableVersion;
    if (this.options.delivery !== 'release-page' || this.status.phase !== 'available' || !version) {
      return this.getStatus();
    }
    try {
      await this.options.openReleasePage(version);
      this.update({ message: undefined });
    } catch (error) {
      console.error('[app-update] opening release page failed', error);
      this.update({ message: '无法打开 GitHub Release，请稍后重试。' });
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
