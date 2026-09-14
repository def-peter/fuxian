import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { documentResourceScheme, DocumentResourceTrustStore } from './document-resource-protocol';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-resource-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('DocumentResourceTrustStore', () => {
  it('loads and watches only explicitly referenced parent images, including encoded filenames and later revisions', async () => {
    const directory = await createTemporaryDirectory();
    const docs = join(directory, 'docs');
    await mkdir(docs);
    const sourcePath = join(docs, 'reader.md');
    await writeFile(sourcePath, '# Reader');
    const imagePath = join(directory, '图 片%20.png');
    await writeFile(imagePath, 'image bytes');
    const store = new DocumentResourceTrustStore();
    const scope = await store.grantSourceDocument(sourcePath, '![Parent](../图%20片%2520.png)');
    const url = new URL('_relative', scope);
    url.searchParams.set('path', '../图 片%20.png');
    await expect(store.resolve(url.href)).resolves.toMatchObject({
      status: 'allowed',
      path: await realpath(imagePath),
    });
    await expect(store.resolveWatchPath(url.href, await realpath(sourcePath))).resolves.toBe(
      await realpath(imagePath),
    );
    url.searchParams.set('path', '../unreferenced.png');
    await expect(store.resolve(url.href)).resolves.toMatchObject({
      status: 'rejected',
      httpStatus: 403,
    });
    await expect(
      store.resolveWatchPath(url.href, await realpath(sourcePath)),
    ).resolves.toBeUndefined();
    await store.grantSourceDocument(sourcePath, '<img src="../future.png">');
    url.searchParams.set('path', '../future.png');
    await expect(store.resolveWatchPath(url.href, await realpath(sourcePath))).resolves.toBe(
      join(await realpath(directory), 'future.png'),
    );
    await writeFile(join(directory, 'future.png'), 'new image');
    await expect(store.resolve(url.href)).resolves.toMatchObject({ status: 'allowed' });
  });
  it('keeps resource scopes stable across revisions and independent documents', async () => {
    const directory = await createTemporaryDirectory();
    const firstPath = join(directory, 'first.md');
    const secondPath = join(directory, 'second.md');
    const imagePath = join(directory, 'cover.png');
    await writeFile(firstPath, '# First');
    await writeFile(secondPath, '# Second');
    await writeFile(imagePath, 'image bytes');
    const trustStore = new DocumentResourceTrustStore();

    const firstScope = await trustStore.grantSourceDocument(firstPath);
    expect(await trustStore.grantSourceDocument(firstPath)).toBe(firstScope);
    await trustStore.grantSourceDocument(secondPath);

    const resourceUrl = new URL('cover.png', firstScope).toString();
    await expect(trustStore.resolve(resourceUrl)).resolves.toMatchObject({ status: 'allowed' });
    await expect(trustStore.resolveWatchPath(resourceUrl, await realpath(firstPath))).resolves.toBe(
      await realpath(imagePath),
    );
    await expect(
      trustStore.resolveWatchPath(resourceUrl, await realpath(secondPath)),
    ).resolves.toBeUndefined();
    await expect(
      trustStore.resolveWatchPath(
        new URL('future.png', firstScope).toString(),
        await realpath(firstPath),
      ),
    ).resolves.toBe(join(await realpath(directory), 'future.png'));
  });

  it('resolves a nested image inside the granted source-document directory', async () => {
    const directory = await createTemporaryDirectory();
    const sourcePath = join(directory, 'reader.md');
    const imagePath = join(directory, 'assets', 'cover.png');
    await mkdir(join(directory, 'assets'));
    await writeFile(sourcePath, '# Reader');
    await writeFile(imagePath, 'image bytes');

    const trustStore = new DocumentResourceTrustStore();
    const resourceBaseUrl = await trustStore.grantSourceDocument(sourcePath);

    await expect(
      trustStore.resolve(new URL('assets/cover.png', resourceBaseUrl).toString()),
    ).resolves.toEqual({
      status: 'allowed',
      path: await realpath(imagePath),
      mediaType: 'image/png',
    });
  });

  it('rejects unknown scopes, missing resources, traversal, and symlink escapes', async () => {
    const directory = await createTemporaryDirectory();
    const documentDirectory = join(directory, 'document');
    const sourcePath = join(documentDirectory, 'reader.md');
    const outsideImagePath = join(directory, 'outside.png');
    await mkdir(documentDirectory);
    await writeFile(sourcePath, '# Reader');
    await writeFile(outsideImagePath, 'outside image');
    await symlink(outsideImagePath, join(documentDirectory, 'linked.png'));

    const trustStore = new DocumentResourceTrustStore();
    const resourceBaseUrl = await trustStore.grantSourceDocument(sourcePath);

    await expect(
      trustStore.resolve(`${documentResourceScheme}://unknown/missing.png`),
    ).resolves.toMatchObject({ status: 'rejected', httpStatus: 403 });
    await expect(
      trustStore.resolve(new URL('missing.png', resourceBaseUrl).toString()),
    ).resolves.toMatchObject({ status: 'rejected', httpStatus: 404 });
    await expect(trustStore.resolve(`${resourceBaseUrl}%2e%2e/outside.png`)).resolves.toMatchObject(
      { status: 'rejected', httpStatus: 400 },
    );
    await expect(
      trustStore.resolve(new URL('linked.png', resourceBaseUrl).toString()),
    ).resolves.toMatchObject({ status: 'rejected', httpStatus: 403 });
  });
});
