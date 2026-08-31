import { _electron as electron, expect, test, type Locator } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const longHeading = '这是一个用于验证内容目录右侧留白和省略号行为的很长很长的标题';

test('content outline balances gutters without reserving empty disclosure slots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-outline-layout-'));
  const sourcePath = join(directory, 'outline-layout.md');
  await writeFile(
    sourcePath,
    [
      '# 无子标题',
      '',
      '正文。',
      '',
      `# ${longHeading}`,
      '',
      '## 可展开章节',
      '',
      '#### 深层标题',
    ].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const inspectOutline = async (outline: Locator): Promise<void> => {
      const topLevel = outline.getByRole('button', { name: '无子标题' });
      const longItem = outline.getByRole('button', { name: longHeading });
      const geometry = await topLevel.evaluate((element) => {
        const aside = element.closest('aside')!.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return { left: box.left - aside.left, right: aside.right - box.right };
      });
      expect.soft(Math.abs(geometry.left - geometry.right)).toBeLessThanOrEqual(6);
      const overflow = await longItem.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        textOverflow: getComputedStyle(element).textOverflow,
      }));
      expect.soft(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
      expect.soft(overflow.textOverflow).toBe('ellipsis');
      await expect(
        outline.getByRole('button', {
          name: /(?:展开|折叠)“可展开章节”下的深层标题/,
        }),
      ).toBeVisible();
    };

    const inlineOutline = window.getByRole('complementary', { name: '内容目录' });
    await expect(inlineOutline).toHaveCSS('width', '216px');
    await inspectOutline(inlineOutline);

    await window.setViewportSize({ height: 768, width: 1_024 });
    await window.getByRole('button', { name: '打开内容目录' }).click();
    const drawer = window.getByRole('dialog');
    await expect(drawer).toHaveCSS('width', '288px');
    await inspectOutline(drawer.getByRole('complementary', { name: '内容目录' }));
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
