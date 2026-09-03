import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  buildWindowsAssociationQueryScript,
  parseWindowsAssociationQuery,
} from './markdown-default-app';

const executeFile = promisify(execFile);
const verifyInstalledQuery =
  process.platform === 'win32' && process.env.FUXIAN_VERIFY_INSTALLED_DEFAULT_APP_QUERY === '1';

describe.runIf(verifyInstalledQuery)('installed Windows default-app query', () => {
  it('resolves both effective Shell associations through AssocQueryStringW', async () => {
    const { stdout } = await executeFile('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      buildWindowsAssociationQueryScript(),
    ]);

    expect(parseWindowsAssociationQuery(stdout)).toEqual({ md: true, markdown: true });
  });
});
