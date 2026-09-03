import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { resolveTestVersion } from './prepare-test-version.mjs';

const workflow = 'test-windows-installer.yml';
const usage = `Usage: pnpm release:test [--yes] [--wait] [--dry-run]

Build an isolated Windows test installer from the synchronized main branch.
The workflow uploads an Actions artifact without creating a tag or GitHub Release.

Options:
  --yes      Skip the confirmation prompt
  --wait     Wait for GitHub Actions and print the artifact name
  --dry-run  Run preflight checks without dispatching the workflow
  --help     Show this help`;

export const parseArguments = (arguments_) => {
  const options = { dryRun: false, help: false, wait: false, yes: false };
  for (const argument of arguments_) {
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--wait') options.wait = true;
    else if (argument === '--yes' || argument === '-y') options.yes = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
};

const command = (executable, arguments_, { capture = true } = {}) => {
  const result = spawnSync(executable, arguments_, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${executable} ${arguments_.join(' ')} failed${detail ? `:\n${detail}` : '.'}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
};

const confirmBuild = async (shortSha) => {
  if (!process.stdin.isTTY) {
    throw new Error('Confirmation requires a terminal. Pass --yes to continue non-interactively.');
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Build a Windows test installer from ${shortSha}? [y/N] `);
  prompt.close();
  return /^y(es)?$/iu.test(answer.trim());
};

const findWorkflowRun = async (headSha, dispatchedAfter) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const runs = JSON.parse(
      command('gh', [
        'run',
        'list',
        '--workflow',
        workflow,
        '--event',
        'workflow_dispatch',
        '--commit',
        headSha,
        '--limit',
        '5',
        '--json',
        'createdAt,databaseId,number,status,url',
      ]) || '[]',
    );
    const matchingRun = runs.find((run) => Date.parse(run.createdAt) >= dispatchedAfter);
    if (matchingRun) return matchingRun;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return undefined;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  command('git', ['rev-parse', '--is-inside-work-tree']);
  command('gh', ['auth', 'status']);
  const branch = command('git', ['branch', '--show-current']);
  if (branch !== 'main') {
    throw new Error(`Test builds must run from main, not ${branch || 'detached HEAD'}.`);
  }

  const trackedChanges = command('git', ['status', '--porcelain', '--untracked-files=no']);
  if (trackedChanges) {
    throw new Error(`Commit or restore tracked changes first:\n${trackedChanges}`);
  }
  const untracked = command('git', ['ls-files', '--others', '--exclude-standard']);
  if (untracked) console.warn(`Warning: untracked files will not be included:\n${untracked}`);

  console.log('Checking origin/main...');
  command('git', ['fetch', 'origin', 'main'], { capture: false });
  const headSha = command('git', ['rev-parse', 'HEAD']);
  const remoteSha = command('git', ['rev-parse', 'origin/main']);
  if (headSha !== remoteSha) {
    throw new Error('main must exactly match origin/main before building a test installer.');
  }

  const baseVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
  const shortSha = command('git', ['rev-parse', '--short=8', 'HEAD']);
  console.log(`Ready to build Windows test installer from ${shortSha}.`);
  if (options.dryRun) {
    console.log('Dry run complete; no workflow was dispatched.');
    return;
  }
  if (!options.yes && !(await confirmBuild(shortSha))) {
    console.log('Test build cancelled.');
    return;
  }

  const dispatchedAfter = Date.now() - 2_000;
  command('gh', ['workflow', 'run', workflow, '--ref', 'main']);
  const run = await findWorkflowRun(headSha, dispatchedAfter);
  if (!run) throw new Error('The dispatched GitHub Actions run could not be located.');

  const artifactName = `fuxian-windows-x64-test-${run.number}`;
  const testVersion = resolveTestVersion(baseVersion, run.number);
  console.log(`Windows test build ${testVersion} was dispatched: ${run.url}`);
  console.log(`Artifact after completion: ${artifactName}`);
  if (!options.wait) return;

  command('gh', ['run', 'watch', String(run.databaseId), '--exit-status'], { capture: false });
  const repository = command('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]);
  const artifacts = command('gh', [
    'api',
    `repos/${repository}/actions/runs/${run.databaseId}/artifacts`,
    '--jq',
    '.artifacts[].name',
  ])
    .split('\n')
    .filter(Boolean);
  if (!artifacts.includes(artifactName)) {
    throw new Error(`GitHub Actions completed without the expected artifact ${artifactName}.`);
  }
  console.log(`Test installer ready: ${run.url}#artifacts`);
  console.log(`Download artifact: ${artifactName}`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(`Test build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
