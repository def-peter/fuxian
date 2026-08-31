import { describe, expect, it } from 'vitest';

import { parseArguments, resolveNextVersion } from './release.mjs';

describe('release script', () => {
  it('defaults to a patch release', () => {
    expect(parseArguments([])).toMatchObject({ bump: 'patch', wait: false, yes: false });
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
      wait: true,
      yes: true,
    });
    expect(() => parseArguments(['patch', 'minor'])).toThrow('at most one');
    expect(() => parseArguments(['--force'])).toThrow('Unknown option');
  });
});
