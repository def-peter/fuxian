import { access, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revealSourceDocument } from './reveal-source-document';

vi.mock('node:fs/promises', () => ({ access: vi.fn(), realpath: vi.fn(), stat: vi.fn() }));

const path = resolve('fixtures/中文 空格 # &.markdown');
const known = new Set([path]);
const reveal = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(realpath).mockResolvedValue(path);
  vi.mocked(stat).mockResolvedValue({ isFile: () => true } as Awaited<ReturnType<typeof stat>>);
  vi.mocked(access).mockResolvedValue(undefined);
});

describe('reveal source document', () => {
  it('reveals the exact authorized path without mutating the allowlist', async () => {
    expect(await revealSourceDocument(path, known, reveal)).toBe('revealed');
    expect(reveal).toHaveBeenCalledWith(path);
    expect([...known]).toEqual([path]);
  });

  it.each([
    null,
    42,
    {},
    '',
    '../file.md',
    'https://example.com/file.md',
    resolve('unknown.md'),
    `${path}\0`,
  ])('rejects invalid or unknown input %s before touching the filesystem', async (input) => {
    expect(await revealSourceDocument(input, known, reveal)).toBe('invalid');
    expect(realpath).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
  });

  it('rejects a document replaced with a directory or an unrelated symlink', async () => {
    vi.mocked(stat).mockResolvedValue({ isFile: () => false } as Awaited<ReturnType<typeof stat>>);
    expect(await revealSourceDocument(path, known, reveal)).toBe('invalid');
    vi.mocked(realpath).mockResolvedValue(resolve('private/other.md'));
    expect(await revealSourceDocument(path, known, reveal)).toBe('invalid');
    expect(reveal).not.toHaveBeenCalled();
  });

  it.each(['ENOENT', 'ENOTDIR'])('handles missing paths (%s)', async (code) => {
    vi.mocked(realpath).mockRejectedValue(Object.assign(new Error(), { code }));
    expect(await revealSourceDocument(path, known, reveal)).toBe('missing');
    expect(reveal).not.toHaveBeenCalled();
  });

  it.each(['EACCES', 'EPERM'])('handles denied access (%s)', async (code) => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error(), { code }));
    expect(await revealSourceDocument(path, known, reveal)).toBe('unreadable');
    expect(reveal).not.toHaveBeenCalled();
  });

  it('contains shell failures', async () => {
    reveal.mockImplementation(() => {
      throw new Error('shell unavailable');
    });
    expect(await revealSourceDocument(path, known, reveal)).toBe('failed');
  });
});
