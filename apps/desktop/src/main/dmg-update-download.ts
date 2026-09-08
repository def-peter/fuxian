import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CancellationError, type CancellationToken, type ProgressInfo } from 'builder-util-runtime';
import type { UpdateInfo } from 'electron-updater';

interface DmgAsset {
  name: string;
  url: string;
  size: number;
  sha512: string;
}

const checkCancellation = (token: CancellationToken): void => {
  if (token.cancelled) throw new CancellationError();
};

export class DmgUpdateDownload {
  private ready: { path: string; asset: DmgAsset } | undefined;

  constructor(
    private readonly directory: string,
    private readonly architecture: string,
    private readonly request: typeof fetch,
    private readonly openPath: (path: string) => Promise<string>,
  ) {}

  private selectAsset(info: UpdateInfo): DmgAsset {
    if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Invalid stable version');
    if (!['arm64', 'x64'].includes(this.architecture)) throw new Error('Unsupported architecture');
    const name = `fuxian-${info.version}-mac-${this.architecture}.dmg`;
    const url = `https://github.com/def-peter/fuxian/releases/download/v${info.version}/${name}`;
    const file = info.files.find((entry) => entry.url === name || entry.url === url);
    if (
      !file ||
      !Number.isSafeInteger(file.size) ||
      !file.size ||
      file.size <= 0 ||
      !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)
    ) {
      throw new Error('Missing or invalid DMG update metadata');
    }
    return { name, url, size: file.size, sha512: file.sha512 };
  }

  private async verify(path: string, asset: DmgAsset): Promise<boolean> {
    try {
      if ((await stat(path)).size !== asset.size) return false;
      const hash = createHash('sha512');
      for await (const chunk of createReadStream(path)) hash.update(chunk);
      return hash.digest('base64') === asset.sha512;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async download(
    info: UpdateInfo,
    token: CancellationToken,
    onProgress: (value: ProgressInfo) => void,
  ): Promise<void> {
    this.ready = undefined;
    const asset = this.selectAsset(info);
    // A changed build cannot reuse bytes from a previous artifact of the same version.
    const key = createHash('sha256')
      .update(`${asset.url}:${asset.size}:${asset.sha512}`)
      .digest('hex');
    await mkdir(this.directory, { recursive: true });
    for (const name of await readdir(this.directory)) {
      if (/^[a-f0-9]{64}$/.test(name) && name !== key) {
        await rm(join(this.directory, name), { recursive: true, force: true });
      }
    }
    const directory = join(this.directory, key);
    await mkdir(directory, { recursive: true });
    const complete = join(directory, asset.name);
    if (await this.verify(complete, asset)) {
      checkCancellation(token);
      this.ready = { path: complete, asset };
      return;
    }
    const partial = join(directory, 'download.part');
    let offset = await stat(partial)
      .then((value) => value.size)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return 0;
      });
    if (offset > asset.size) {
      await rm(partial, { force: true });
      offset = 0;
    }
    if (offset < asset.size) {
      const controller = new AbortController();
      const cancel = (): void => controller.abort();
      token.on('cancel', cancel);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const resetTimeout = (): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => controller.abort(new Error('Download stalled')), 30_000);
      };
      let response: Response | undefined;
      try {
        checkCancellation(token);
        resetTimeout();
        response = await this.request(asset.url, {
          headers: {
            ...(offset ? { Range: `bytes=${offset}-` } : {}),
            'Accept-Encoding': 'identity',
          },
          signal: controller.signal,
        });
        if (offset && response.status === 416) {
          await response.body?.cancel();
          offset = 0;
          resetTimeout();
          response = await this.request(asset.url, {
            headers: { 'Accept-Encoding': 'identity' },
            signal: controller.signal,
          });
        }
        if (response.status === 200) offset = 0;
        else if (
          response.status !== 206 ||
          response.headers.get('content-range') !==
            `bytes ${offset}-${asset.size - 1}/${asset.size}`
        ) {
          throw new Error(`Invalid download response: ${response.status}`);
        }
        const length = response.headers.get('content-length');
        if (length !== null && Number(length) !== asset.size - offset)
          throw new Error('Incorrect download length');
        const encoding = response.headers.get('content-encoding');
        if (encoding && encoding !== 'identity') throw new Error('Unexpected download encoding');
        if (!response.body) throw new Error('Empty download response');
        const file = await open(partial, offset ? 'a' : 'w');
        const started = performance.now();
        const initialOffset = offset;
        let lastReport = 0;
        try {
          for await (const chunk of response.body) {
            checkCancellation(token);
            resetTimeout();
            if (offset + chunk.length > asset.size)
              throw new Error('Download exceeds expected size');
            let written = 0;
            while (written < chunk.length) {
              const result = await file.write(chunk, written, chunk.length - written);
              if (!result.bytesWritten) throw new Error('Unable to write download');
              written += result.bytesWritten;
            }
            offset += chunk.length;
            const elapsed = performance.now() - started;
            if (elapsed - lastReport >= 250 || offset === asset.size) {
              lastReport = elapsed;
              onProgress({
                total: asset.size,
                transferred: offset,
                percent: (offset / asset.size) * 100,
                delta: chunk.length,
                bytesPerSecond: (offset - initialOffset) / Math.max(elapsed / 1000, 0.001),
              });
            }
          }
        } finally {
          await file.close();
        }
        if (offset !== asset.size) throw new Error('Incomplete download');
      } finally {
        clearTimeout(timeout);
        token.removeListener('cancel', cancel);
        controller.abort();
        if (response?.body && !response.body.locked)
          await response.body.cancel().catch(() => undefined);
      }
    }
    checkCancellation(token);
    if (!(await this.verify(partial, asset))) {
      await rm(partial, { force: true });
      throw new Error('DMG SHA-512 verification failed');
    }
    checkCancellation(token);
    await rename(partial, complete);
    this.ready = { path: complete, asset };
  }

  async open(): Promise<void> {
    if (!this.ready || !(await this.verify(this.ready.path, this.ready.asset))) {
      throw new Error('Downloaded DMG is missing or has changed');
    }
    const error = await this.openPath(this.ready.path);
    if (error) throw new Error(error);
  }
}
