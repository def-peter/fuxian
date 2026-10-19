import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import semver from 'semver';
import { isAppUpdateChannel, type AppUpdateChannel } from '@fuxian/shared-types';

// Persist independently of reader preferences, sessions, drafts, and update reminders.
export class AppUpdateChannelPersistence {
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<AppUpdateChannel> {
    try {
      const state: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        state &&
        typeof state === 'object' &&
        'version' in state &&
        state.version === 1 &&
        'channel' in state &&
        isAppUpdateChannel(state.channel)
      )
        return state.channel;
    } catch {
      // An absent or unreadable preference always uses the stable feed.
    }
    return 'stable';
  }

  save(channel: AppUpdateChannel): Promise<void> {
    const save = async (): Promise<void> => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(
        temporaryPath,
        `${JSON.stringify({ version: 1, channel }, null, 2)}\n`,
        'utf8',
      );
      await rename(temporaryPath, this.path);
    };
    this.pendingSave = this.pendingSave.then(save, save);
    return this.pendingSave;
  }
}

export const isPublicUpdateVersion = (version: string): boolean =>
  Boolean(
    semver.valid(version) &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.[1-9]\d*)?$/.test(version),
  );

export const canReturnToStable = (currentVersion: string, channel: AppUpdateChannel): boolean =>
  channel === 'stable' &&
  Boolean(semver.valid(currentVersion) && semver.prerelease(currentVersion));

export const classifyUpdate = (
  currentVersion: string,
  candidate: string,
  channel: AppUpdateChannel,
): 'upgrade' | 'downgrade' | undefined => {
  if (!semver.valid(currentVersion) || !isPublicUpdateVersion(candidate)) return undefined;
  const prerelease = semver.prerelease(candidate);
  if (prerelease && (channel !== 'beta' || prerelease[0] !== 'beta')) return undefined;
  if (semver.gt(candidate, currentVersion)) return 'upgrade';
  if (
    canReturnToStable(currentVersion, channel) &&
    !prerelease &&
    semver.lt(candidate, currentVersion)
  ) {
    return 'downgrade';
  }
  return undefined;
};
