import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveExistingSourceDocument, saveSourceDocumentCopy } from './source-document-save';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('source document saving', () => {
  it('atomically saves only when the expected source still matches disk', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-save-')));
    temporaryDirectories.push(directory);
    const path = join(directory, 'guide.md');
    await writeFile(path, '# Saved', 'utf8');

    await expect(saveExistingSourceDocument(path, '# Saved', '# Local')).resolves.toEqual({
      path,
      status: 'saved',
    });
    await expect(readFile(path, 'utf8')).resolves.toBe('# Local');
  });

  it('preserves both versions when disk changed before save', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-save-')));
    temporaryDirectories.push(directory);
    const path = join(directory, 'guide.md');
    await writeFile(path, '# External', 'utf8');

    await expect(saveExistingSourceDocument(path, '# Saved', '# Local')).resolves.toEqual({
      currentSource: '# External',
      status: 'conflict',
    });
    await expect(readFile(path, 'utf8')).resolves.toBe('# External');
  });

  it('writes an explicitly selected Markdown copy and rejects other extensions', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-save-')));
    temporaryDirectories.push(directory);
    const markdownPath = join(directory, 'copy.markdown');

    await expect(saveSourceDocumentCopy(markdownPath, '# Copy')).resolves.toEqual({
      path: markdownPath,
      status: 'saved',
    });
    await expect(readFile(markdownPath, 'utf8')).resolves.toBe('# Copy');
    await expect(
      saveSourceDocumentCopy(join(directory, 'copy.txt'), '# Copy'),
    ).resolves.toMatchObject({ status: 'failed' });
  });

  it('reports permission failures without truncating the original source', async () => {
    if (process.platform === 'win32') return;
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-save-')));
    temporaryDirectories.push(directory);
    const path = join(directory, 'guide.md');
    await writeFile(path, '# Saved', 'utf8');
    await chmod(directory, 0o500);
    try {
      await expect(saveExistingSourceDocument(path, '# Saved', '# Local')).resolves.toMatchObject({
        status: 'failed',
      });
      await expect(readFile(path, 'utf8')).resolves.toBe('# Saved');
    } finally {
      await chmod(directory, 0o700);
    }
  });
});
