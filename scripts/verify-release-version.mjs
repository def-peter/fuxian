import { parseReleaseVersion } from './release-version.mjs';
import { readFile } from 'node:fs/promises';

const readPackageVersion = async (path) => {
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  if (typeof packageJson.version !== 'string') {
    throw new Error(`${path} does not contain a string version.`);
  }
  return packageJson.version;
};

const rootVersion = await readPackageVersion('package.json');
const desktopVersion = await readPackageVersion('apps/desktop/package.json');
parseReleaseVersion(rootVersion);
if (desktopVersion !== rootVersion) {
  throw new Error(
    `Version mismatch: package.json is ${rootVersion}, apps/desktop/package.json is ${desktopVersion}.`,
  );
}

console.log(`Verified release version ${rootVersion}.`);
