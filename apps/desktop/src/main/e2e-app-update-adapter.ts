import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { CancellationError, type CancellationToken, type ProgressInfo } from 'builder-util-runtime';
import type { UpdateInfo } from 'electron-updater';
import type { AppUpdateAdapter } from './app-update-service';

type E2EUpdateScenario = 'available' | 'error' | 'up-to-date';

const updateInfo = (): UpdateInfo => ({
  files: [],
  path: 'fuxian-0.2.0-mac-arm64.zip',
  releaseDate: '2026-08-28T00:00:00.000Z',
  releaseName: '浮现 0.2.0',
  releaseNotes: '新增安全可靠的软件更新，并完善发布流程。',
  sha512: 'e2e-sha512',
  version: '0.2.0',
});

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const isE2EUpdateScenario = (value: unknown): value is E2EUpdateScenario =>
  value === 'available' || value === 'error' || value === 'up-to-date';

export class E2EAppUpdateAdapter extends EventEmitter implements AppUpdateAdapter {
  allowDowngrade = true;
  allowPrerelease = true;
  autoDownload = true;
  autoInstallOnAppQuit = true;
  disableWebInstaller = false;

  constructor(
    private readonly scenario: E2EUpdateScenario,
    private readonly installMarkerPath: string | undefined,
  ) {
    super();
  }

  async checkForUpdates(): Promise<void> {
    this.emit('checking-for-update');
    await wait(20);
    if (this.scenario === 'error') {
      const error = new Error('E2E update check failed.');
      this.emit('error', error);
      throw error;
    }
    this.emit(
      this.scenario === 'available' ? 'update-available' : 'update-not-available',
      updateInfo(),
    );
  }

  async downloadUpdate(cancellationToken?: CancellationToken): Promise<void> {
    for (const percent of [15, 55, 100]) {
      await wait(40);
      if (cancellationToken?.cancelled) {
        this.emit('update-cancelled', updateInfo());
        throw new CancellationError();
      }
      this.emit('download-progress', {
        bytesPerSecond: 1_048_576,
        delta: 40,
        percent,
        total: 10_485_760,
        transferred: Math.round((10_485_760 * percent) / 100),
      } satisfies ProgressInfo);
    }
    this.emit('update-downloaded', {
      ...updateInfo(),
      downloadedFile: '/tmp/fuxian-e2e-update.zip',
    });
  }

  quitAndInstall(): void {
    if (this.installMarkerPath) {
      void writeFile(this.installMarkerPath, JSON.stringify({ installedVersion: '0.2.0' }), 'utf8');
    }
  }
}
