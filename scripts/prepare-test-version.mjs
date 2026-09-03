import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionFiles = ['package.json', 'apps/desktop/package.json'];

export const resolveTestVersion = (currentVersion, runNumber) => {
  const match = stableSemver.exec(currentVersion);
  if (!match) throw new Error(`Base version ${currentVersion} must be a stable SemVer version.`);
  if (!/^[1-9]\d*$/u.test(String(runNumber))) {
    throw new Error(`Run number ${runNumber} must be a positive integer.`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}-test.${runNumber}`;
};

const readVersion = async (path) => {
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  if (typeof packageJson.version !== 'string') throw new Error(`${path} has no version.`);
  return packageJson.version;
};

const writeVersion = async (path, version) => {
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  packageJson.version = version;
  await writeFile(path, `${JSON.stringify(packageJson, null, 2)}\n`);
};

export const prepareTestVersion = async (runNumber, files = versionFiles) => {
  const versions = await Promise.all(files.map(readVersion));
  if (versions[0] !== versions[1]) {
    throw new Error(`Version files disagree: ${versions.join(' and ')}.`);
  }
  const version = resolveTestVersion(versions[0], runNumber);
  await Promise.all(files.map((path) => writeVersion(path, version)));
  return version;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  prepareTestVersion(process.argv[2]).then(
    (version) => console.log(`Prepared isolated test version ${version}.`),
    (error) => {
      console.error(
        `Preparing test version failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    },
  );
}
