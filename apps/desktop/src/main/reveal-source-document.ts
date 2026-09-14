import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

type RevealOutcome = 'revealed' | 'invalid' | 'missing' | 'unreadable' | 'failed';

// Share the existing document-session allowlist, without granting new paths or
// reading/reopening a document just to reveal it in the operating system.
export async function revealSourceDocument(
  path: unknown,
  knownPaths: ReadonlySet<string>,
  reveal: (path: string) => void,
): Promise<RevealOutcome> {
  if (typeof path !== 'string' || path.includes('\0') || !isAbsolute(path) || !knownPaths.has(path))
    return 'invalid';

  try {
    const canonicalPath = await realpath(path);
    // A formerly opened file must not redirect the shell to an unrelated target
    // if it has since been replaced with a symlink.
    if (canonicalPath !== path && !knownPaths.has(canonicalPath)) return 'invalid';
    if (!(await stat(canonicalPath)).isFile()) return 'invalid';
    await access(canonicalPath, constants.R_OK);
    reveal(canonicalPath);
    return 'revealed';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing';
    if (code === 'EACCES' || code === 'EPERM') return 'unreadable';
    return 'failed';
  }
}
