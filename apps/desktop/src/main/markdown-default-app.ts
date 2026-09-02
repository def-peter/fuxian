import type {
  MarkdownDefaultAppState,
  MarkdownDefaultAppStatus,
  OpenMarkdownDefaultAppSettingsResult,
} from '@fuxian/shared-types';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const markdownExtensions = ['md', 'markdown'] as const;

type SupportedPlatform = 'darwin' | 'win32';

export interface MarkdownDefaultAppDependencies {
  executablePath: string;
  isPackaged: boolean;
  openExternal(url: string): Promise<void>;
  platform: NodeJS.Platform;
  revealFile(path: string): void;
  showMacGuidance(): Promise<void>;
  temporaryDirectory: string;
  testState?: MarkdownDefaultAppState | undefined;
}

export interface MarkdownDefaultAppService {
  getStatus(): Promise<MarkdownDefaultAppStatus>;
  openSettings(): Promise<OpenMarkdownDefaultAppSettingsResult>;
}

const platformName = (platform: NodeJS.Platform): MarkdownDefaultAppStatus['platform'] =>
  platform === 'darwin' ? 'macos' : platform === 'win32' ? 'windows' : 'unsupported';

export const classifyMarkdownAssociations = (
  md: boolean,
  markdown: boolean,
): Exclude<MarkdownDefaultAppState, 'unavailable'> =>
  md && markdown ? 'default' : md || markdown ? 'partial' : 'not-default';

const testStatus = (
  state: MarkdownDefaultAppState,
  platform: MarkdownDefaultAppStatus['platform'],
): MarkdownDefaultAppStatus => ({
  markdown: state === 'unavailable' ? null : state === 'default',
  md: state === 'unavailable' ? null : state === 'default' || state === 'partial',
  platform,
  state,
  ...(state === 'unavailable' ? { message: '测试适配器模拟当前环境无法检测。' } : {}),
});

const queryWindowsAssociation = async (
  extension: (typeof markdownExtensions)[number],
  executablePath: string,
) => {
  const registryPath = `HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.${extension}\\UserChoice`;
  const script = [
    `$choice = Get-ItemProperty -LiteralPath '${registryPath}' -Name ProgId -ErrorAction SilentlyContinue`,
    '$progId = $choice.ProgId',
    `if ([string]::IsNullOrWhiteSpace($progId)) { $progId = (Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\\.${extension}' -ErrorAction SilentlyContinue).'(default)' }`,
    "$command = if ([string]::IsNullOrWhiteSpace($progId)) { '' } else { (Get-ItemProperty -LiteralPath ('Registry::HKEY_CLASSES_ROOT\\' + $progId + '\\shell\\open\\command') -ErrorAction SilentlyContinue).'(default)' }",
    `[Console]::Out.Write(([PSCustomObject]@{ command = $command; progId = $progId } | ConvertTo-Json -Compress))`,
  ].join('; ');
  const { stdout } = await executeFile('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
  ]);
  const association = JSON.parse(stdout) as { command?: unknown; progId?: unknown };
  if (typeof association.command !== 'string' || typeof association.progId !== 'string') {
    return false;
  }
  const command = association.command.toLocaleLowerCase();
  return (
    association.progId === 'Markdown 文档' && command.includes(executablePath.toLocaleLowerCase())
  );
};

const appleScriptArguments = (path: string): string[] => [
  '-e',
  'on run argv',
  '-e',
  'set targetFile to POSIX file (item 1 of argv)',
  '-e',
  'set fileInfo to info for targetFile',
  '-e',
  'return POSIX path of (default application of fileInfo)',
  '-e',
  'end run',
  path,
];

const queryMacAssociations = async (
  executablePath: string,
  temporaryDirectory: string,
): Promise<{ markdown: boolean; md: boolean }> => {
  const directory = await mkdtemp(join(temporaryDirectory, 'fuxian-default-app-'));
  const appBundlePath = dirname(dirname(dirname(executablePath)));
  try {
    const files = Object.fromEntries(
      await Promise.all(
        markdownExtensions.map(async (extension) => {
          const path = join(directory, `probe.${extension}`);
          await writeFile(path, '');
          return [extension, path] as const;
        }),
      ),
    ) as Record<(typeof markdownExtensions)[number], string>;
    const expected = await realpath(appBundlePath);
    const results = await Promise.all(
      markdownExtensions.map(async (extension) => {
        const { stdout } = await executeFile('/usr/bin/osascript', [
          '-l',
          'AppleScript',
          ...appleScriptArguments(files[extension]),
        ]);
        const handlerPath = stdout.trim().replace(/\/$/u, '');
        return (await realpath(handlerPath)) === expected;
      }),
    );
    return { md: results[0]!, markdown: results[1]! };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

const unavailableStatus = (
  platform: NodeJS.Platform,
  message: string,
): MarkdownDefaultAppStatus => ({
  markdown: null,
  md: null,
  message,
  platform: platformName(platform),
  state: 'unavailable',
});

export const createMarkdownDefaultAppService = (
  dependencies: MarkdownDefaultAppDependencies,
): MarkdownDefaultAppService => {
  const supportedPlatform =
    dependencies.platform === 'darwin' || dependencies.platform === 'win32'
      ? (dependencies.platform as SupportedPlatform)
      : undefined;

  return {
    getStatus: async () => {
      if (dependencies.testState) {
        return testStatus(dependencies.testState, platformName(dependencies.platform));
      }
      if (!dependencies.isPackaged) {
        return unavailableStatus(
          dependencies.platform,
          '开发模式不会检测或修改系统文件关联。请安装正式版本后查看。',
        );
      }
      if (!supportedPlatform) {
        return unavailableStatus(dependencies.platform, '当前系统暂不支持检测 Markdown 默认应用。');
      }

      try {
        const associations =
          supportedPlatform === 'win32'
            ? {
                md: await queryWindowsAssociation('md', dependencies.executablePath),
                markdown: await queryWindowsAssociation('markdown', dependencies.executablePath),
              }
            : await queryMacAssociations(
                dependencies.executablePath,
                dependencies.temporaryDirectory,
              );
        return {
          ...associations,
          platform: platformName(supportedPlatform),
          state: classifyMarkdownAssociations(associations.md, associations.markdown),
        };
      } catch {
        return unavailableStatus(
          dependencies.platform,
          '系统没有返回可靠的 Markdown 文件关联状态。',
        );
      }
    },
    openSettings: async () => {
      if (dependencies.testState) {
        return {
          message: '测试适配器已模拟打开系统默认应用设置。',
          status: 'opened',
        };
      }
      if (!dependencies.isPackaged && !dependencies.testState) {
        return {
          message: '开发模式不会打开或修改系统文件关联。',
          status: 'unavailable',
        };
      }
      try {
        if (dependencies.platform === 'win32') {
          await dependencies.openExternal('ms-settings:defaultapps?registeredAppUser=Fuxian');
          return {
            message: '已打开 Windows 默认应用设置，请确认 .md 与 .markdown 均选择浮现。',
            status: 'opened',
          };
        }
        if (dependencies.platform === 'darwin') {
          const guidePath = join(dependencies.temporaryDirectory, '浮现默认应用设置.md');
          await writeFile(guidePath, '# 浮现 Markdown 默认应用设置\n');
          dependencies.revealFile(guidePath);
          await dependencies.showMacGuidance();
          return {
            message: '已在访达中显示示例文档，完成“全部更改”后返回浮现即可刷新状态。',
            status: 'opened',
          };
        }
      } catch {
        return { message: '暂时无法打开系统默认应用设置。', status: 'unavailable' };
      }
      return { message: '当前系统暂不支持此设置入口。', status: 'unavailable' };
    },
  };
};
