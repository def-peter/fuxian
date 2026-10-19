import { EventEmitter } from 'node:events';
import { CancellationError, type CancellationToken, type ProgressInfo } from 'builder-util-runtime';
import type { UpdateInfo } from 'electron-updater';
import { describe, expect, it, vi } from 'vitest';
import { AppUpdateService, type AppUpdateAdapter } from './app-update-service';

class FakeUpdateAdapter extends EventEmitter implements AppUpdateAdapter {
  channel = 'latest';
  allowDowngrade = true;
  allowPrerelease = true;
  autoDownload = true;
  autoInstallOnAppQuit = true;
  disableWebInstaller = false;
  checkForUpdates = vi.fn<() => Promise<unknown>>(async () => undefined);
  downloadUpdate = vi.fn<(token?: CancellationToken) => Promise<unknown>>(async () => undefined);
  quitAndInstall = vi.fn();
}

const updateInfo = (version = '0.2.0'): UpdateInfo => ({
  files: [],
  path: `fuxian-${version}.zip`,
  releaseDate: '2026-08-28T00:00:00.000Z',
  releaseName: `Fuxian ${version}`,
  releaseNotes:
    '<h2>主要更新</h2><ul><li>新增安全可靠的软件更新 &amp; 发布流程。</li><li><strong>修复</strong>设置页显示。</li></ul><script>不可信脚本</script>',
  sha512: 'sha512',
  version,
});

const createService = (
  supported = true,
  delivery: 'automatic-install' | 'release-page' = 'automatic-install',
  lastNotifiedVersion?: string,
  overrides: Partial<ConstructorParameters<typeof AppUpdateService>[0]> = {},
) => {
  const adapter = new FakeUpdateAdapter();
  const broadcast = vi.fn();
  const beforeInstall = vi.fn<() => Promise<void>>(async () => undefined);
  const openReleasePage = vi.fn(async () => undefined);
  const persistNotifiedVersion = vi.fn(async () => undefined);
  const service = new AppUpdateService({
    adapter,
    beforeInstall,
    broadcast,
    currentVersion: '0.1.0',
    delivery,
    lastNotifiedVersion,
    openReleasePage,
    persistNotifiedVersion,
    supported,
    ...overrides,
  });
  service.initialize();
  return {
    adapter,
    beforeInstall,
    broadcast,
    openReleasePage,
    persistNotifiedVersion,
    service,
  };
};

describe('AppUpdateService', () => {
  it('offers GitHub during downloads without changing download state', async () => {
    const { adapter, service, openReleasePage } = createService();
    await service.openReleasePage();
    expect(openReleasePage).toHaveBeenLastCalledWith(undefined);
    adapter.emit('update-available', updateInfo());
    adapter.emit('download-progress', {
      total: 100,
      transferred: 20,
      percent: 20,
      bytesPerSecond: 10,
    });
    await expect(service.openReleasePage()).resolves.toMatchObject({
      phase: 'downloading',
      percent: 20,
    });
    expect(openReleasePage).toHaveBeenLastCalledWith('0.2.0');
  });

  it('downloads and opens a manual installer without quitting or flushing edits', async () => {
    const adapter = new FakeUpdateAdapter();
    const manualDownload = {
      download: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
    };
    const beforeInstall = vi.fn<() => Promise<void>>(async () => undefined);
    const service = new AppUpdateService({
      adapter,
      manualDownload,
      beforeInstall,
      broadcast: vi.fn(),
      currentVersion: '0.1.0',
      delivery: 'manual-install',
      supported: true,
      openReleasePage: vi.fn(async () => undefined),
    });
    service.initialize();
    adapter.emit('update-available', updateInfo());
    manualDownload.download.mockRejectedValueOnce(new Error('network interrupted'));
    await expect(service.downloadUpdate()).resolves.toMatchObject({ phase: 'error' });
    await expect(service.downloadUpdate()).resolves.toMatchObject({ phase: 'downloaded' });
    await service.installUpdate();
    expect(manualDownload.download).toHaveBeenCalledTimes(2);
    expect(manualDownload.open).toHaveBeenCalledOnce();
    expect(adapter.downloadUpdate).not.toHaveBeenCalled();
    expect(adapter.quitAndInstall).not.toHaveBeenCalled();
    expect(beforeInstall).not.toHaveBeenCalled();
  });
  it('uses explicit stable, user-controlled update behavior', async () => {
    const { adapter, service } = createService(false);

    expect(adapter).toMatchObject({
      allowDowngrade: false,
      allowPrerelease: false,
      autoDownload: false,
      autoInstallOnAppQuit: false,
      disableWebInstaller: true,
    });
    expect((await service.checkForUpdates()).phase).toBe('unsupported');
    expect(adapter.checkForUpdates).not.toHaveBeenCalled();
  });

  it('coalesces checks and publishes plain release information', async () => {
    const { adapter, service } = createService();
    let resolveCheck: (() => void) | undefined;
    adapter.checkForUpdates.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveCheck = resolve)),
    );

    const first = service.checkForUpdates();
    const second = service.checkForUpdates();
    adapter.emit('update-available', updateInfo());
    resolveCheck?.();

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({
      availableVersion: '0.2.0',
      phase: 'available',
      releaseNotes: {
        'en-US': [
          { kind: 'heading', text: '主要更新' },
          {
            kind: 'list',
            ordered: false,
            items: ['新增安全可靠的软件更新 & 发布流程。', '修复设置页显示。'],
          },
        ],
      },
      reminderVersion: '0.2.0',
    });
    expect(adapter.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('reminds once for each available version and persists the acknowledgement', async () => {
    const { adapter, persistNotifiedVersion, service } = createService();
    adapter.emit('update-available', updateInfo('0.2.0'));

    await expect(service.acknowledgeReminder('0.2.0')).resolves.toMatchObject({
      reminderVersion: undefined,
    });
    expect(persistNotifiedVersion).toHaveBeenCalledWith('0.2.0');

    adapter.emit('update-available', updateInfo('0.2.0'));
    expect(service.getStatus()).toMatchObject({ reminderVersion: undefined });
    adapter.emit('update-available', updateInfo('0.3.0'));
    expect(service.getStatus()).toMatchObject({ reminderVersion: '0.3.0' });
  });

  it('does not remind again for a version acknowledged in an earlier session', () => {
    const { adapter, service } = createService(true, 'automatic-install', '0.2.0');

    adapter.emit('update-available', updateInfo('0.2.0'));

    expect(service.getStatus()).toMatchObject({ reminderVersion: undefined });
    expect(service.getStatus()).toMatchObject({ availableVersion: '0.2.0', phase: 'available' });
  });

  it('combines versioned HTML release notes as inert plain text', () => {
    const { adapter, service } = createService();
    adapter.emit('update-available', {
      ...updateInfo(),
      releaseNotes: [
        { note: '<p>当前版本说明</p>', version: '0.2.0' },
        { note: '<p>上一版本说明</p>', version: '0.1.0' },
      ],
    });

    expect(service.getStatus().releaseNotes).toEqual({
      'en-US': [
        { kind: 'paragraph', text: '当前版本说明' },
        { kind: 'paragraph', text: '上一版本说明' },
      ],
    });
  });

  it('reports download progress, supports cancellation, and can retry', async () => {
    const { adapter, broadcast, service } = createService();
    adapter.emit('update-available', updateInfo());
    adapter.downloadUpdate.mockImplementationOnce(async (token) => {
      adapter.emit('download-progress', {
        bytesPerSecond: 2_048,
        delta: 40,
        percent: 40,
        total: 100,
        transferred: 40,
      } satisfies ProgressInfo);
      token?.cancel();
      throw new CancellationError();
    });

    await service.downloadUpdate();

    expect(service.getStatus()).toMatchObject({
      message: '已取消下载，可以重试。',
      phase: 'available',
    });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 40, phase: 'downloading' }),
    );
  });

  it('flushes application state before installing a downloaded update', async () => {
    const { adapter, beforeInstall, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/update.zip' });

    await expect(service.installUpdate()).resolves.toMatchObject({ phase: 'installing' });

    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(adapter.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('coalesces concurrent install requests while the application settles dirty state', async () => {
    const { adapter, beforeInstall, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/update.zip' });
    let resolvePreparation: (() => void) | undefined;
    beforeInstall.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (resolvePreparation = () => resolve(undefined))),
    );

    const first = service.installUpdate();
    const second = service.installUpdate();
    resolvePreparation?.();

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ phase: 'installing' });
    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(adapter.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('keeps the downloaded version available when install preparation fails', async () => {
    const { adapter, beforeInstall, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/update.zip' });
    beforeInstall.mockRejectedValueOnce(new Error('PDF export is active'));

    await expect(service.installUpdate()).resolves.toMatchObject({
      availableVersion: '0.2.0',
      message: '暂时无法重启安装，请稍后重试。',
      phase: 'downloaded',
    });
    expect(adapter.quitAndInstall).not.toHaveBeenCalled();
  });

  it('does not replace a downloaded update with a later check', async () => {
    const { adapter, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/update.zip' });

    await expect(service.checkForUpdates()).resolves.toMatchObject({ phase: 'downloaded' });

    expect(adapter.checkForUpdates).not.toHaveBeenCalled();
  });

  it('opens the matching release page instead of downloading on macOS-style delivery', async () => {
    const { adapter, openReleasePage, service } = createService(true, 'release-page');
    adapter.emit('update-available', updateInfo());

    await expect(service.downloadUpdate()).resolves.toMatchObject({ phase: 'available' });
    await expect(service.openReleasePage()).resolves.toMatchObject({ phase: 'available' });

    expect(adapter.downloadUpdate).not.toHaveBeenCalled();
    expect(openReleasePage).toHaveBeenCalledWith('0.2.0');
  });

  it('keeps the manual update action available when the release page cannot open', async () => {
    const { adapter, openReleasePage, service } = createService(true, 'release-page');
    adapter.emit('update-available', updateInfo());
    openReleasePage.mockRejectedValueOnce(new Error('browser unavailable'));

    await expect(service.openReleasePage()).resolves.toMatchObject({
      message: '无法打开 GitHub Release，请稍后重试。',
      phase: 'available',
    });
  });

  it('returns to the downloaded state when the installer cannot start', async () => {
    const { adapter, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/update.zip' });
    adapter.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('installer failed to start');
    });

    await expect(service.installUpdate()).resolves.toMatchObject({
      message: '暂时无法重启安装，请稍后重试。',
      phase: 'downloaded',
    });
  });
});

describe('update channels', () => {
  it('defaults stable even on a Beta build and only offers a confirmed stable rollback', async () => {
    const { adapter, service } = createService(true, 'automatic-install', undefined, {
      currentVersion: '0.3.0-beta.2',
    });
    expect(adapter).toMatchObject({
      channel: 'latest',
      allowPrerelease: false,
      allowDowngrade: true,
    });
    adapter.emit('update-available', updateInfo('0.2.0'));
    expect(service.getStatus()).toMatchObject({
      channel: 'stable',
      downgrade: true,
      reminderVersion: undefined,
    });
    await service.downloadUpdate();
    await service.downloadUpdate('0.1.0');
    expect(adapter.downloadUpdate).not.toHaveBeenCalled();
    await service.downloadUpdate('0.2.0');
    expect(adapter.downloadUpdate).toHaveBeenCalledOnce();
  });

  it.each(['0.2.0-beta.1', '0.2.0-alpha.1', '0.2.0-test.1', '../0.2.0'])(
    'rejects %s from stable even if the adapter reports it',
    (version) => {
      const { adapter, service } = createService();
      adapter.emit('update-available', updateInfo(version));
      expect(service.getStatus()).toMatchObject({
        phase: 'up-to-date',
        availableVersion: undefined,
      });
    },
  );

  it('includes subsequent stable releases on Beta and refuses older Beta candidates', () => {
    const { adapter, service } = createService(true, 'automatic-install', undefined, {
      currentVersion: '0.2.0-beta.2',
      channel: 'beta',
    });
    expect(adapter).toMatchObject({
      channel: 'beta',
      allowPrerelease: true,
      allowDowngrade: false,
    });
    for (const version of ['0.2.0-beta.3', '0.2.0', '0.3.0-beta.1']) {
      adapter.emit('update-available', updateInfo(version));
      expect(service.getStatus()).toMatchObject({
        availableVersion: version,
        phase: 'available',
        downgrade: false,
      });
    }
    for (const version of ['0.2.0-beta.1', '0.1.0', '0.3.0-test.1']) {
      adapter.emit('update-available', updateInfo(version));
      expect(service.getStatus()).toMatchObject({
        phase: 'up-to-date',
        availableVersion: undefined,
      });
    }
  });

  it('drains an old check and ignores its result and failure before switching feeds', async () => {
    const persistChannel = vi.fn<(channel: 'stable' | 'beta') => Promise<void>>(
      async () => undefined,
    );
    const { adapter, service } = createService(true, 'automatic-install', undefined, {
      persistChannel,
    });
    let rejectCheck!: (error: Error) => void;
    adapter.checkForUpdates.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCheck = reject;
        }),
    );
    const check = service.checkForUpdates();
    const switchChannel = service.setChannel('beta');
    expect(service.getStatus().changingChannel).toBe(true);
    expect(adapter.channel).toBe('latest');
    adapter.emit('update-available', updateInfo('0.2.0'));
    adapter.emit('error', new Error('old check failed'));
    rejectCheck(new Error('old check failed'));
    await check;
    adapter.checkForUpdates.mockImplementationOnce(async () => {
      adapter.emit('update-available', updateInfo('0.3.0-beta.1'));
    });
    await switchChannel;
    expect(persistChannel).toHaveBeenCalledWith('beta');
    expect(service.getStatus()).toMatchObject({
      channel: 'beta',
      changingChannel: false,
      availableVersion: '0.3.0-beta.1',
    });
    expect(adapter.allowDowngrade).toBe(false);
  });

  it('cancels an old download and blocks stale progress, completion, and install', async () => {
    const { adapter, service } = createService();
    adapter.emit('update-available', updateInfo());
    let rejectDownload!: (error: Error) => void;
    let token: CancellationToken | undefined;
    adapter.downloadUpdate.mockImplementationOnce((value) => {
      token = value;
      return new Promise((_, reject) => {
        rejectDownload = reject;
      });
    });
    const download = service.downloadUpdate();
    await vi.waitFor(() => expect(adapter.downloadUpdate).toHaveBeenCalledOnce());
    const switchChannel = service.setChannel('beta');
    expect(token?.cancelled).toBe(true);
    adapter.emit('download-progress', { percent: 99 });
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/stale.exe' });
    adapter.emit('update-cancelled', updateInfo());
    await service.installUpdate();
    expect(adapter.quitAndInstall).not.toHaveBeenCalled();
    expect(service.getStatus().changingChannel).toBe(true);
    expect(service.getStatus().availableVersion).toBeUndefined();
    expect(service.getStatus().percent).toBeUndefined();
    rejectDownload(new CancellationError());
    await download;
    await switchChannel;
    expect(service.getStatus().channel).toBe('beta');
    expect(service.getStatus().availableVersion).toBeUndefined();
    await service.installUpdate();
    expect(adapter.quitAndInstall).not.toHaveBeenCalled();
  });

  it('invalidates a downloaded candidate when changing channel', async () => {
    const { adapter, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/stale.exe' });
    await service.setChannel('beta');
    await service.installUpdate();
    expect(adapter.quitAndInstall).not.toHaveBeenCalled();
    expect(service.getStatus().availableVersion).toBeUndefined();
  });

  it('does not change the channel during install preparation', async () => {
    const { adapter, beforeInstall, service } = createService();
    adapter.emit('update-downloaded', { ...updateInfo(), downloadedFile: '/tmp/ready.exe' });
    let finish!: () => void;
    beforeInstall.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const install = service.installUpdate();
    await service.setChannel('beta');
    expect(service.getStatus().channel).toBe('stable');
    finish();
    await install;
    expect(adapter.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('keeps stable on a failed preference save and handles rapid channel changes in order', async () => {
    const persistChannel = vi.fn<(channel: 'stable' | 'beta') => Promise<void>>(
      async () => undefined,
    );
    persistChannel.mockRejectedValueOnce(new Error('disk full'));
    const { adapter, service } = createService(true, 'automatic-install', undefined, {
      persistChannel,
    });
    await service.setChannel('beta');
    expect(service.getStatus()).toMatchObject({
      channel: 'stable',
      phase: 'error',
      message: '无法保存更新通道，请重试。',
    });
    expect(adapter.checkForUpdates).not.toHaveBeenCalled();
    const beta = service.setChannel('beta');
    const stable = service.setChannel('stable');
    await Promise.all([beta, stable]);
    expect(service.getStatus()).toMatchObject({ channel: 'stable', changingChannel: false });
    expect(adapter).toMatchObject({
      channel: 'latest',
      allowPrerelease: false,
      allowDowngrade: false,
    });
    expect(persistChannel.mock.calls.map(([channel]) => channel)).toEqual([
      'beta',
      'beta',
      'stable',
    ]);
  });
});
