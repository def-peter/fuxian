import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);

// Ask the Windows Shell, rather than reading HKCR defaults that UserChoice can override.
export const fileAssociationQueryScript = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FuxianFileAssociation {
  private const uint ASSOCF_INIT_IGNOREUNKNOWN = 0x400;
  private const uint ASSOCSTR_PROGID = 20;
  [DllImport("Shlwapi.dll", CharSet = CharSet.Unicode, EntryPoint = "AssocQueryStringW")]
  private static extern int Query(uint flags, uint kind, string association, string extra, StringBuilder output, ref uint length);
  public static bool Exists(string path) {
    uint length = 0;
    // ASSOCSTR_PROGID also covers packaged/UWP apps without an executable command.
    int result = Query(ASSOCF_INIT_IGNOREUNKNOWN, ASSOCSTR_PROGID, System.IO.Path.GetExtension(path), null, null, ref length);
    if (result == unchecked((int)0x80070483)) return false;
    if (result < 0) Marshal.ThrowExceptionForHR(result);
    return length > 1;
  }
}
'@
[Console]::Out.Write([FuxianFileAssociation]::Exists($env:FUXIAN_LINK_ASSOCIATION_PATH).ToString().ToLowerInvariant())
`;

export async function hasDefaultFileApplication(
  path: string,
  macHelperPath: string,
): Promise<boolean> {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return true;
  const { stdout } =
    process.platform === 'darwin'
      ? await executeFile(macHelperPath, ['--query-file', path], { timeout: 10_000 })
      : await executeFile(
          'powershell.exe',
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', fileAssociationQueryScript],
          {
            env: { ...process.env, FUXIAN_LINK_ASSOCIATION_PATH: path },
            timeout: 15_000,
            windowsHide: true,
          },
        );
  const result = stdout.trim();
  if (result !== 'true' && result !== 'false') throw new Error('File association query failed.');
  return result === 'true';
}
