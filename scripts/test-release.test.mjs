import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { prepareTestVersion, resolveTestVersion } from './prepare-test-version.mjs';
import { parseArguments } from './test-release.mjs';

describe('Windows test release', () => {
  it('creates a unique prerelease version above the current patch', () => {
    expect(resolveTestVersion('0.1.8', 42)).toBe('0.1.9-test.42');
    expect(() => resolveTestVersion('0.1.8-beta.1', 42)).toThrow('stable SemVer');
    expect(() => resolveTestVersion('0.1.8', 0)).toThrow('positive integer');
  });

  it('parses non-publishing workflow controls', () => {
    expect(parseArguments(['--yes', '--wait', '--dry-run'])).toEqual({
      dryRun: true,
      help: false,
      wait: true,
      yes: true,
    });
    expect(() => parseArguments(['beta'])).toThrow('Unknown option');
  });

  it('changes both package manifests only inside the build workspace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-test-version-'));
    const desktopDirectory = join(directory, 'apps', 'desktop');
    const files = [join(directory, 'package.json'), join(desktopDirectory, 'package.json')];
    await mkdir(desktopDirectory, { recursive: true });
    await Promise.all(
      files.map((path) => writeFile(path, `${JSON.stringify({ version: '0.1.8' })}\n`)),
    );

    try {
      await expect(prepareTestVersion(42, files)).resolves.toBe('0.1.9-test.42');
      await expect(
        Promise.all(files.map(async (path) => JSON.parse(await readFile(path, 'utf8')).version)),
      ).resolves.toEqual(['0.1.9-test.42', '0.1.9-test.42']);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('uploads only a Windows installer artifact without release or updater metadata', async () => {
    const source = await readFile('.github/workflows/test-windows-installer.yml', 'utf8');
    const workflow = parse(source);
    const jobs = Object.values(workflow.jobs);
    const steps = jobs.flatMap((job) => job.steps);
    const commands = steps.flatMap((step) => (typeof step.run === 'string' ? [step.run] : []));
    const upload = steps.find((step) => step.uses === 'actions/upload-artifact@v7');

    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow['run-name']).toContain('${{ github.run_number }}');
    expect(Object.keys(workflow.jobs)).toEqual(['package-windows']);
    expect(upload.with.path).toContain('windows-x64-setup.exe');
    expect(upload.with.path).not.toMatch(/latest|blockmap/iu);
    expect(commands.join('\n')).not.toMatch(/gh release|git tag/iu);
  });
});
