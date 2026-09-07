import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionFiles = ['package.json', 'apps/desktop/package.json'];
const maximumReleaseNotesLength = 20_000;

const usage = `Usage: pnpm release [patch|minor|major|<version>] [--yes] [--wait] [--retry] [--dry-run] [release notes]

Examples:
  pnpm release              Publish the next patch version
  pnpm release minor        Publish the next minor version
  pnpm release 1.0.0        Publish an explicit stable version
  pnpm release --wait       Wait for GitHub Actions to finish
  pnpm release --notes-en "Add automatic update checks" --notes-zh "新增自动更新检测"
  pnpm release --notes-file /tmp/fuxian-release.md
  pnpm release --retry      Retry the current unpublished version

Options:
  --yes      Skip the confirmation prompt
  --wait     Wait for the workflow and print the Release URL
  --retry    Retry the current version without creating another version commit
  --notes    Prepend complete Markdown to the generated Release notes
  --notes-en Prepend English Markdown as the primary Release notes
  --notes-zh Put Chinese Markdown in a collapsible section after English notes
  --notes-file
             Read a Markdown description from a local file; the file is not committed
  --dry-run  Run preflight checks without changing or publishing anything
  --help     Show this help`;

export const parseArguments = (arguments_) => {
  const options = {
    bump: 'patch',
    dryRun: false,
    help: false,
    notes: undefined,
    notesEn: undefined,
    notesFile: undefined,
    notesZh: undefined,
    retry: false,
    wait: false,
    yes: false,
  };
  const positional = [];

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--retry') options.retry = true;
    else if (argument === '--wait') options.wait = true;
    else if (argument === '--yes' || argument === '-y') options.yes = true;
    else if (
      argument === '--notes' ||
      argument === '--notes-en' ||
      argument === '--notes-file' ||
      argument === '--notes-zh'
    ) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === '--notes') options.notes = value;
      else if (argument === '--notes-en') options.notesEn = value;
      else if (argument === '--notes-file') options.notesFile = value;
      else options.notesZh = value;
      index += 1;
    } else if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }

  if (positional.length > 1) throw new Error('Provide at most one version or bump type.');
  if (options.retry && positional.length > 0) {
    throw new Error('--retry cannot be combined with a version or bump type.');
  }
  const completeNotesSources = [options.notes, options.notesFile].filter(
    (value) => value !== undefined,
  );
  const hasLocalizedNotes = options.notesZh !== undefined || options.notesEn !== undefined;
  if (completeNotesSources.length > 1 || (completeNotesSources.length > 0 && hasLocalizedNotes)) {
    throw new Error('--notes/--notes-file cannot be combined with other release-note options.');
  }
  if (positional[0]) options.bump = positional[0];
  return options;
};

export const normalizeReleaseNotes = (value) => {
  const notes = value.replaceAll(/\r\n?/gu, '\n').trim();
  if (!notes) return undefined;
  if (notes.length > maximumReleaseNotesLength) {
    throw new Error(`Release notes cannot exceed ${maximumReleaseNotesLength} characters.`);
  }
  const hasUnsupportedControlCharacter = [...notes].some((character) => {
    const code = character.codePointAt(0);
    return code === 127 || (code !== undefined && code < 32 && code !== 9 && code !== 10);
  });
  if (hasUnsupportedControlCharacter) {
    throw new Error('Release notes contain unsupported control characters.');
  }
  return notes;
};

export const formatLocalizedReleaseNotes = (chinese, english) => {
  const chineseNotes = normalizeReleaseNotes(chinese ?? '');
  const englishNotes = normalizeReleaseNotes(english ?? '');
  if (!englishNotes) return chineseNotes;
  if (!chineseNotes) return englishNotes;
  return `${englishNotes}\n\n<details>\n<summary>中文更新日志</summary>\n\n${chineseNotes}\n\n</details>`;
};

export const createWorkflowDispatchArguments = (releaseNotes) => {
  const arguments_ = ['workflow', 'run', 'release-installers.yml', '--ref', 'main'];
  if (releaseNotes) arguments_.push('--raw-field', `release_notes=${releaseNotes}`);
  return arguments_;
};

const parseVersion = (version) => {
  const match = stableSemver.exec(version);
  if (!match) throw new Error(`Version ${version} is not a stable SemVer version.`);
  return match.slice(1).map(Number);
};

const compareVersions = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

export const resolveNextVersion = (currentVersion, bump) => {
  const current = parseVersion(currentVersion);
  let next;

  if (bump === 'major') next = [current[0] + 1, 0, 0];
  else if (bump === 'minor') next = [current[0], current[1] + 1, 0];
  else if (bump === 'patch') next = [current[0], current[1], current[2] + 1];
  else next = parseVersion(bump);

  if (compareVersions(next, current) <= 0) {
    throw new Error(`Next version ${next.join('.')} must be newer than ${currentVersion}.`);
  }
  return next.join('.');
};

const command = (executable, arguments_, { capture = true, optional = false } = {}) => {
  const result = spawnSync(executable, arguments_, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !optional) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${executable} ${arguments_.join(' ')} failed${detail ? `:\n${detail}` : '.'}`);
  }
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
};

const readVersion = async (path) => {
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  if (typeof packageJson.version !== 'string') throw new Error(`${path} has no version.`);
  return packageJson.version;
};

const updateVersion = async (path, version) => {
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  packageJson.version = version;
  await writeFile(path, `${JSON.stringify(packageJson, null, 2)}\n`);
};

const collectReleaseInput = async (currentVersion, nextVersion, releaseNotes) => {
  if (!process.stdin.isTTY) {
    throw new Error('Confirmation requires a terminal. Pass --yes to continue non-interactively.');
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const englishNotes = releaseNotes
    ? undefined
    : await prompt.question('English release notes (optional Markdown; press Enter to skip): ');
  const chineseNotes = releaseNotes
    ? undefined
    : await prompt.question('中文更新日志（可选 Markdown，按 Enter 跳过）：');
  const notes = releaseNotes ?? formatLocalizedReleaseNotes(chineseNotes, englishNotes);
  const answer = await prompt.question(`Publish ${currentVersion} -> ${nextVersion}? [y/N] `);
  prompt.close();
  return { confirmed: /^y(es)?$/i.test(answer.trim()), releaseNotes: notes };
};

const findWorkflowRun = async (headSha, dispatchedAfter) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = command('gh', [
      'run',
      'list',
      '--workflow',
      'release-installers.yml',
      '--event',
      'workflow_dispatch',
      '--commit',
      headSha,
      '--limit',
      '5',
      '--json',
      'createdAt,databaseId,status,url',
    ]);
    const runs = JSON.parse(result.output || '[]');
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

  const branch = command('git', ['branch', '--show-current']).output;
  if (branch !== 'main')
    throw new Error(`Releases must run from main, not ${branch || 'detached HEAD'}.`);

  const trackedChanges = command('git', ['status', '--porcelain', '--untracked-files=no']).output;
  if (trackedChanges)
    throw new Error(`Commit or restore tracked changes first:\n${trackedChanges}`);

  const untracked = command('git', ['ls-files', '--others', '--exclude-standard']).output;
  if (untracked) console.warn(`Warning: untracked files will not be included:\n${untracked}`);

  console.log('Checking origin/main...');
  command('git', ['fetch', 'origin', 'main', '--tags'], { capture: false });
  const headSha = command('git', ['rev-parse', 'HEAD']).output;
  const remoteSha = command('git', ['rev-parse', 'origin/main']).output;
  if (headSha !== remoteSha)
    throw new Error('main must exactly match origin/main before releasing.');

  const versions = await Promise.all(versionFiles.map(readVersion));
  if (versions[0] !== versions[1]) {
    throw new Error(`Version files disagree: ${versions.join(' and ')}.`);
  }
  const currentVersion = versions[0];
  const targetVersion = options.retry
    ? currentVersion
    : resolveNextVersion(currentVersion, options.bump);
  const tag = `v${targetVersion}`;
  let releaseNotes = options.notesFile
    ? normalizeReleaseNotes(await readFile(options.notesFile, 'utf8'))
    : options.notes !== undefined
      ? normalizeReleaseNotes(options.notes)
      : formatLocalizedReleaseNotes(options.notesZh, options.notesEn);

  const existingTag = command(
    'git',
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`],
    {
      optional: true,
    },
  );
  const existingRelease = command('gh', ['release', 'view', tag], { optional: true });
  if (existingTag.ok || existingRelease.ok) throw new Error(`${tag} already exists.`);

  console.log(
    options.retry
      ? `Ready to retry unpublished version ${currentVersion}.`
      : `Ready to publish ${currentVersion} -> ${targetVersion}.`,
  );
  if (options.dryRun) {
    console.log('Dry run complete; no files were changed.');
    return;
  }
  if (!options.yes) {
    const input = await collectReleaseInput(currentVersion, targetVersion, releaseNotes);
    if (!input.confirmed) {
      console.log('Release cancelled.');
      return;
    }
    releaseNotes = input.releaseNotes;
  }

  if (options.retry) {
    command('pnpm', ['verify:release-version'], { capture: false });
  } else {
    for (const path of versionFiles) await updateVersion(path, targetVersion);
    command('pnpm', ['verify:release-version'], { capture: false });
    command('pnpm', ['exec', 'prettier', '--check', ...versionFiles], { capture: false });

    command('git', ['add', '--', ...versionFiles]);
    command('git', ['commit', '-m', `chore(release): prepare ${tag}`], { capture: false });
    command('git', ['push', 'origin', 'main'], { capture: false });
  }

  const releaseSha = command('git', ['rev-parse', 'HEAD']).output;
  const dispatchArguments = createWorkflowDispatchArguments(releaseNotes);
  const dispatchedAfter = Date.now() - 2_000;
  const dispatch = command('gh', dispatchArguments);
  const run = await findWorkflowRun(releaseSha, dispatchedAfter);
  const runUrl = run?.url ?? dispatch.output;

  console.log(`Release ${tag} was dispatched${runUrl ? `: ${runUrl}` : '.'}`);
  if (!options.wait || !run) {
    console.log(
      `The public Release will appear at https://github.com/def-peter/fuxian/releases/tag/${tag}`,
    );
    return;
  }

  command('gh', ['run', 'watch', String(run.databaseId), '--exit-status'], { capture: false });
  const releaseUrl = command('gh', [
    'release',
    'view',
    tag,
    '--json',
    'url',
    '--jq',
    '.url',
  ]).output;
  console.log(`Published ${tag}: ${releaseUrl}`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(`Release failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
