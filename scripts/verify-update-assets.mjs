import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parse } from 'yaml';

const assetDirectory = resolve(process.argv[2] ?? 'release-assets');
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const version = rootPackage.version;
const requiredAssets = [
  `fuxian-${version}-windows-x64-setup.exe`,
  `fuxian-${version}-windows-x64-setup.exe.blockmap`,
  `fuxian-${version}-mac-x64.dmg`,
  `fuxian-${version}-mac-x64.zip`,
  `fuxian-${version}-mac-x64.zip.blockmap`,
  `fuxian-${version}-mac-arm64.dmg`,
  `fuxian-${version}-mac-arm64.zip`,
  `fuxian-${version}-mac-arm64.zip.blockmap`,
  'latest.yml',
  'latest-mac.yml',
];

const names = new Set(await readdir(assetDirectory));
const errors = requiredAssets
  .filter((name) => !names.has(name))
  .map((name) => `missing release asset ${name}`);

const sha512 = async (path) =>
  createHash('sha512')
    .update(await readFile(path))
    .digest('base64');

for (const metadataName of ['latest.yml', 'latest-mac.yml']) {
  if (!names.has(metadataName)) continue;
  const metadata = parse(await readFile(join(assetDirectory, metadataName), 'utf8'));
  if (metadata?.version !== version) {
    errors.push(`${metadataName} has version ${String(metadata?.version)}, expected ${version}`);
  }
  if (!Array.isArray(metadata?.files) || metadata.files.length === 0) {
    errors.push(`${metadataName} does not contain update files`);
    continue;
  }

  for (const file of metadata.files) {
    if (!file || typeof file.url !== 'string' || typeof file.sha512 !== 'string') {
      errors.push(`${metadataName} contains an invalid file entry`);
      continue;
    }
    const fileName = basename(decodeURIComponent(file.url));
    const filePath = join(assetDirectory, fileName);
    if (!names.has(fileName)) {
      errors.push(`${metadataName} references missing asset ${fileName}`);
      continue;
    }
    const fileStat = await stat(filePath);
    if (typeof file.size === 'number' && file.size !== fileStat.size) {
      errors.push(`${metadataName} has the wrong size for ${fileName}`);
    }
    if ((await sha512(filePath)) !== file.sha512) {
      errors.push(`${metadataName} has the wrong SHA-512 for ${fileName}`);
    }
  }
}

const macMetadata = names.has('latest-mac.yml')
  ? parse(await readFile(join(assetDirectory, 'latest-mac.yml'), 'utf8'))
  : undefined;
const macUrls = new Set(
  Array.isArray(macMetadata?.files)
    ? macMetadata.files.map((file) => basename(decodeURIComponent(String(file.url))))
    : [],
);
for (const architecture of ['x64', 'arm64']) {
  const expectedZip = `fuxian-${version}-mac-${architecture}.zip`;
  if (!macUrls.has(expectedZip)) {
    errors.push(`latest-mac.yml does not reference ${expectedZip}`);
  }
}

if (errors.length > 0) throw new Error(errors.join('\n'));
console.log(`Verified ${requiredAssets.length} updater assets for ${version}.`);
