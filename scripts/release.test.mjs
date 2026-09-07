import { describe, expect, it } from 'vitest';

import {
  createWorkflowDispatchArguments,
  formatLocalizedReleaseNotes,
  normalizeReleaseNotes,
  parseArguments,
  resolveNextVersion,
} from './release.mjs';

describe('release script', () => {
  it('defaults to a patch release', () => {
    expect(parseArguments([])).toMatchObject({
      bump: 'patch',
      retry: false,
      wait: false,
      yes: false,
    });
    expect(resolveNextVersion('0.1.2', 'patch')).toBe('0.1.3');
  });

  it('supports minor, major, and explicit stable versions', () => {
    expect(resolveNextVersion('0.1.2', 'minor')).toBe('0.2.0');
    expect(resolveNextVersion('0.1.2', 'major')).toBe('1.0.0');
    expect(resolveNextVersion('0.1.2', '0.4.0')).toBe('0.4.0');
  });

  it('rejects invalid and non-increasing versions', () => {
    expect(() => resolveNextVersion('0.1.2', '0.1.2')).toThrow('must be newer');
    expect(() => resolveNextVersion('0.1.2', '1.0.0-beta.1')).toThrow('not a stable SemVer');
  });

  it('parses release controls', () => {
    expect(parseArguments(['minor', '--yes', '--wait', '--dry-run'])).toEqual({
      bump: 'minor',
      dryRun: true,
      help: false,
      notes: undefined,
      notesEn: undefined,
      notesFile: undefined,
      notesZh: undefined,
      retry: false,
      wait: true,
      yes: true,
    });
    expect(parseArguments(['--retry', '--yes'])).toMatchObject({ retry: true, yes: true });
    expect(() => parseArguments(['--retry', 'patch'])).toThrow('cannot be combined');
    expect(() => parseArguments(['patch', 'minor'])).toThrow('at most one');
    expect(() => parseArguments(['--force'])).toThrow('Unknown option');
  });

  it('accepts inline or file-based release notes', () => {
    expect(parseArguments(['--notes', 'A concise summary'])).toMatchObject({
      notes: 'A concise summary',
      notesFile: undefined,
    });
    expect(parseArguments(['--notes-file', '/tmp/release.md'])).toMatchObject({
      notes: undefined,
      notesFile: '/tmp/release.md',
    });
    expect(
      parseArguments(['--notes-zh', '新增更新检测', '--notes-en', 'Add update checks']),
    ).toMatchObject({
      notesEn: 'Add update checks',
      notesZh: '新增更新检测',
    });
    expect(() => parseArguments(['--notes'])).toThrow('requires a value');
    expect(() => parseArguments(['--notes', 'summary', '--notes-file', 'release.md'])).toThrow(
      'cannot be combined',
    );
    expect(() => parseArguments(['--notes', 'summary', '--notes-zh', '摘要'])).toThrow(
      'cannot be combined',
    );
  });

  it('keeps English visible and folds Chinese release notes', () => {
    expect(formatLocalizedReleaseNotes('## 更新内容\n\n- 修复更新', '## Updates\n\n- Fix updates'))
      .toBe(`## Updates

- Fix updates

<details>
<summary>中文更新日志</summary>

## 更新内容

- 修复更新

</details>`);
    expect(formatLocalizedReleaseNotes('', 'English only')).toBe('English only');
    expect(formatLocalizedReleaseNotes('仅中文', '')).toBe('仅中文');
  });

  it('normalizes and validates release notes', () => {
    expect(normalizeReleaseNotes('  ## Highlights\r\n\r\n- Fixed updates  ')).toBe(
      '## Highlights\n\n- Fixed updates',
    );
    expect(normalizeReleaseNotes('   ')).toBeUndefined();
    expect(() => normalizeReleaseNotes(`ok\u0000not-ok`)).toThrow('control characters');
    expect(() => normalizeReleaseNotes('x'.repeat(20_001))).toThrow('cannot exceed');
  });

  it('passes multiline notes to the release workflow as one raw field', () => {
    expect(createWorkflowDispatchArguments('## Updates\n\n- Fixed export')).toEqual([
      'workflow',
      'run',
      'release-installers.yml',
      '--ref',
      'main',
      '--raw-field',
      'release_notes=## Updates\n\n- Fixed export',
    ]);
    expect(createWorkflowDispatchArguments(undefined)).toEqual([
      'workflow',
      'run',
      'release-installers.yml',
      '--ref',
      'main',
    ]);
  });
});
