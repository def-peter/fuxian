import { EventEmitter } from 'node:events';
import { CancellationError, type CancellationToken, type ProgressInfo } from 'builder-util-runtime';
import type { UpdateInfo } from 'electron-updater';
import { describe, expect, it, vi } from 'vitest';
import { AppUpdateService, type AppUpdateAdapter } from './app-update-service';

class FakeUpdateAdapter extends EventEmitter implements AppUpdateAdapter {
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
  releaseName: `浮现 ${version}`,
  releaseNotes:
    '<h2>主要更新</h2><ul><li>新增安全可靠的软件更新 &amp; 发布流程。</li><li><strong>修复</strong>设置页显示。</li></ul><script>不可信脚本</script>',
  sha512: 'sha512',
  version,
});

const createService = (
  supported = true,
  delivery: 'automatic-install' | 'release-page' = 'automatic-install',
) => {
  const adapter = new FakeUpdateAdapter();
  const broadcast = vi.fn();
  const beforeInstall = vi.fn(async () => undefined);
  const openReleasePage = vi.fn(async () => undefined);
  const service = new AppUpdateService({
    adapter,
    beforeInstall,
    broadcast,
    currentVersion: '0.1.0',
    delivery,
    openReleasePage,
    supported,
  });
  service.initialize();
  return { adapter, beforeInstall, broadcast, openReleasePage, service };
};

describe('AppUpdateService', () => {
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
      releaseNotes: '主要更新\n\n- 新增安全可靠的软件更新 & 发布流程。\n- 修复设置页显示。',
    });
    expect(adapter.checkForUpdates).toHaveBeenCalledTimes(1);
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

    expect(service.getStatus().releaseNotes).toBe('当前版本说明\n\n上一版本说明');
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
      message: '已取消下载，可以稍后重新检查。',
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
