import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CancellationToken } from 'builder-util-runtime';
import type { UpdateInfo } from 'electron-updater';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DmgUpdateDownload } from './dmg-update-download';

const bytes = Buffer.from('representative installer bytes');
const info = (content = bytes): UpdateInfo => ({
  version: '0.2.0',
  releaseDate: '',
  path: '',
  sha512: '',
  files: [
    {
      url: 'fuxian-0.2.0-mac-arm64.dmg',
      size: content.length,
      sha512: createHash('sha512').update(content).digest('base64'),
    },
  ],
});
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-dmg-test-'));
  directories.push(directory);
  const request = vi.fn<typeof fetch>();
  const openPath = vi.fn<(path: string) => Promise<string>>(async () => '');
  const make = () => new DmgUpdateDownload(directory, 'arm64', request, openPath);
  return { directory, request, openPath, make };
}

describe('DMG update download', () => {
  it('verifies a download, restores completed cache and rechecks before opening', async () => {
    const { request, openPath, make } = await setup();
    request.mockResolvedValueOnce(new Response(bytes));
    await make().download(info(), new CancellationToken(), vi.fn());
    const restarted = make();
    await restarted.download(info(), new CancellationToken(), vi.fn());
    expect(request).toHaveBeenCalledOnce();
    await restarted.open();
    const path = openPath.mock.calls[0]![0];
    expect(await readFile(path)).toEqual(bytes);
    await writeFile(path, Buffer.alloc(bytes.length));
    await expect(restarted.open()).rejects.toThrow('changed');
    expect(openPath).toHaveBeenCalledOnce();
  });

  it('resumes after a process restart using the stable release URL', async () => {
    const { request, make } = await setup();
    request.mockResolvedValueOnce(new Response(bytes.subarray(0, 10)));
    await expect(make().download(info(), new CancellationToken(), vi.fn())).rejects.toThrow(
      'Incomplete',
    );
    request.mockResolvedValueOnce(
      new Response(bytes.subarray(10), {
        status: 206,
        headers: { 'Content-Range': `bytes 10-${bytes.length - 1}/${bytes.length}` },
      }),
    );
    await make().download(info(), new CancellationToken(), vi.fn());
    expect(request.mock.calls[1]?.[0]).toBe(
      'https://github.com/def-peter/fuxian/releases/download/v0.2.0/fuxian-0.2.0-mac-arm64.dmg',
    );
    expect(request.mock.calls[1]?.[1]?.headers).toMatchObject({ Range: 'bytes=10-' });
  });

  it('restarts safely when the server ignores Range', async () => {
    const { request, make } = await setup();
    request.mockResolvedValueOnce(new Response(bytes.subarray(0, 10)));
    await expect(make().download(info(), new CancellationToken(), vi.fn())).rejects.toThrow();
    request.mockResolvedValueOnce(new Response(bytes));
    const downloader = make();
    await downloader.download(info(), new CancellationToken(), vi.fn());
    await downloader.open();
  });

  it('retries without Range if the server refuses a resume request', async () => {
    const { request, make } = await setup();
    request.mockResolvedValueOnce(new Response(bytes.subarray(0, 10)));
    await expect(make().download(info(), new CancellationToken(), vi.fn())).rejects.toThrow();
    request.mockResolvedValueOnce(new Response(null, { status: 416 }));
    request.mockResolvedValueOnce(new Response(bytes));
    await make().download(info(), new CancellationToken(), vi.fn());
    expect(request.mock.calls[2]?.[1]?.headers).not.toHaveProperty('Range');
  });

  it('rejects wrong ranges and hash mismatches and retries corrupt data from zero', async () => {
    const { request, make } = await setup();
    request.mockResolvedValueOnce(
      new Response(bytes, { status: 206, headers: { 'Content-Range': 'bytes 1-3/4' } }),
    );
    const downloader = make();
    await expect(downloader.download(info(), new CancellationToken(), vi.fn())).rejects.toThrow(
      'Invalid',
    );
    request.mockResolvedValueOnce(new Response(Buffer.alloc(bytes.length)));
    await expect(downloader.download(info(), new CancellationToken(), vi.fn())).rejects.toThrow(
      'SHA-512',
    );
    await expect(downloader.open()).rejects.toThrow();
    request.mockResolvedValueOnce(new Response(bytes));
    await downloader.download(info(), new CancellationToken(), vi.fn());
    expect(request.mock.calls[2]?.[1]?.headers).not.toHaveProperty('Range');
  });

  it('does not mix cached partial bytes with a changed build', async () => {
    const { request, make } = await setup();
    request.mockResolvedValueOnce(new Response(bytes.subarray(0, 10)));
    await expect(make().download(info(), new CancellationToken(), vi.fn())).rejects.toThrow();
    const changed = Buffer.from('a different build of the installer');
    request.mockResolvedValueOnce(new Response(changed));
    await make().download(info(changed), new CancellationToken(), vi.fn());
    expect(request.mock.calls[1]?.[1]?.headers).not.toHaveProperty('Range');
  });

  it('aborts an in-flight request and never opens an incomplete download', async () => {
    const { request, make } = await setup();
    const token = new CancellationToken();
    request.mockImplementationOnce(async (_url, options) => {
      token.cancel();
      expect(options?.signal?.aborted).toBe(true);
      throw new Error('aborted');
    });
    const downloader = make();
    await expect(downloader.download(info(), token, vi.fn())).rejects.toThrow('aborted');
    await expect(downloader.open()).rejects.toThrow();
  });

  it('rejects metadata for the wrong architecture before downloading', async () => {
    const { request, make } = await setup();
    const invalid = info();
    invalid.files[0]!.url = 'fuxian-0.2.0-mac-x64.dmg';
    await expect(make().download(invalid, new CancellationToken(), vi.fn())).rejects.toThrow(
      'metadata',
    );
    expect(request).not.toHaveBeenCalled();
  });
});
