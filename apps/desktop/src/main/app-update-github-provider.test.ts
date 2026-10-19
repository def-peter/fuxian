import { expect, it, vi } from 'vitest';
import { NsisUpdater } from 'electron-updater';
import { GitHubProvider } from 'electron-updater/out/providers/GitHubProvider';
import { ElectronHttpExecutor } from 'electron-updater/out/electronHttpExecutor';
import { AppUpdateService } from './app-update-service';

// Exercise the installed updater's real GitHub discovery and channel-file selection.
// All HTTP is intercepted; this test never contacts the production release feed.
for (const platform of ['win32', 'darwin'] as const) {
  for (const channel of ['stable', 'beta'] as const) {
    it(`resolves ${channel} metadata with the real GitHub provider on ${platform}`, async () => {
      const updater = new NsisUpdater(undefined, {
        version: '0.1.0',
        name: 'Fuxian',
        isPackaged: true,
        appUpdateConfigPath: '/unused',
        userDataPath: '/unused',
        baseCachePath: '/unused',
        whenReady: async () => undefined,
        relaunch: () => undefined,
        quit: () => undefined,
        onQuit: () => undefined,
      });
      const service = new AppUpdateService({
        adapter: updater,
        currentVersion: '0.1.0',
        channel,
        delivery: 'automatic-install',
        supported: true,
        beforeInstall: async () => undefined,
        broadcast: () => undefined,
        openReleasePage: async () => undefined,
      });
      service.initialize();
      const executor = new ElectronHttpExecutor(() => undefined);
      const requested: string[] = [];
      const request = vi.spyOn(executor, 'request').mockImplementation(async (options) => {
        const path = options.path!;
        requested.push(path);
        if (path.endsWith('.atom'))
          return `<feed>${['0.3.0-test.1', '0.2.0-beta.1', '0.1.1']
            .map(
              (version) =>
                `<entry><title>Fuxian ${version}</title><link href="https://github.com/def-peter/fuxian/releases/tag/v${version}"/><content>Notes</content></entry>`,
            )
            .join('')}</feed>`;
        if (path.endsWith('/latest')) return JSON.stringify({ tag_name: 'v0.1.1' });
        const version = channel === 'stable' ? '0.1.1' : '0.2.0-beta.1';
        const metadata = `${channel === 'stable' ? 'latest' : 'beta'}${platform === 'darwin' ? '-mac' : ''}.yml`;
        if (path.endsWith(`/v${version}/${metadata}`))
          return `version: ${version}\nfiles:\n  - url: fuxian-${version}.zip\n    sha512: fixture\nreleaseDate: 2026-10-19T00:00:00.000Z\n`;
        throw new Error(`Unexpected fixture request: ${path}`);
      });
      const provider = new GitHubProvider(
        { provider: 'github', owner: 'def-peter', repo: 'fuxian' },
        updater,
        {
          executor,
          platform,
          isUseMultipleRangeRequest: false,
        },
      );
      const result = await provider.getLatestVersion();
      expect(result.version).toBe(channel === 'stable' ? '0.1.1' : '0.2.0-beta.1');
      expect(requested.some((path) => path.includes('v0.3.0-test.1/'))).toBe(false);
      expect(requested.some((path) => path.endsWith('/latest'))).toBe(channel === 'stable');
      request.mockRestore();
    });
  }
  it(`falls back to stable metadata when the newest release is stable on Beta (${platform})`, async () => {
    const updater = new NsisUpdater(undefined, {
      version: '0.2.0-beta.1',
      name: 'Fuxian',
      isPackaged: true,
      appUpdateConfigPath: '/unused',
      userDataPath: '/unused',
      baseCachePath: '/unused',
      whenReady: async () => undefined,
      relaunch: () => undefined,
      quit: () => undefined,
      onQuit: () => undefined,
    });
    updater.channel = 'beta';
    updater.allowPrerelease = true;
    updater.allowDowngrade = false;
    const executor = new ElectronHttpExecutor(() => undefined);
    const requested: string[] = [];
    vi.spyOn(executor, 'request').mockImplementation(async (options) => {
      requested.push(options.path!);
      if (options.path!.endsWith('.atom'))
        return '<feed><entry><title>Fuxian 0.2.0</title><link href="https://github.com/def-peter/fuxian/releases/tag/v0.2.0"/><content>Stable</content></entry></feed>';
      if (options.path!.endsWith('/latest.yml') || options.path!.endsWith('/latest-mac.yml'))
        return 'version: 0.2.0\nfiles:\n  - url: fuxian-0.2.0.zip\n    sha512: fixture\nreleaseDate: 2026-10-19T00:00:00.000Z\n';
      throw new Error('Beta metadata is absent in a stable release');
    });
    const provider = new GitHubProvider(
      { provider: 'github', owner: 'def-peter', repo: 'fuxian' },
      updater,
      {
        executor,
        platform,
        isUseMultipleRangeRequest: false,
      },
    );
    expect((await provider.getLatestVersion()).version).toBe('0.2.0');
    expect(requested.at(-1)).toContain(`/latest${platform === 'darwin' ? '-mac' : ''}.yml`);
  });
}
