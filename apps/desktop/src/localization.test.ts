import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTranslator, productName, translate } from './localization';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

const listSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return listSourceFiles(path);
        return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.test\.(?:ts|tsx)$/u.test(entry.name)
          ? [path]
          : [];
      }),
    )
  ).flat();
};

describe('application localization', () => {
  it('uses Chinese source messages and complete English translations', () => {
    expect(translate('zh-CN', '设置')).toBe('设置');
    expect(translate('en-US', '设置')).toBe('Settings');
    expect(productName('zh-CN')).toBe('浮现');
    expect(productName('en-US')).toBe('Fuxian');
  });

  it('uses explicit Chinese copy for semantic message keys', () => {
    expect(translate('zh-CN', 'PlantUML 源码发送说明')).toContain(
      'PlantUML 源码会发送到上方配置的服务。',
    );
    expect(translate('zh-CN', '文档宽度设置说明')).not.toBe('文档宽度设置说明');
  });

  it('interpolates values without translating user-provided content', () => {
    const t = createTranslator('en-US');
    expect(t('保存对“{name}”的修改？', { name: '需求说明.md' })).toBe(
      'Save changes to “需求说明.md”?',
    );
  });

  it('does not bypass the catalog in high-risk accessibility text', async () => {
    const files = await listSourceFiles(join(sourceDirectory, 'renderer/src'));
    const forbiddenPatterns = [
      /aria-label\s*=\s*["'][^"']+["']/u,
      /\.ariaLabel\s*=\s*["'][^"']+["']/u,
      /<iframe\b[^>]*\btitle\s*=\s*["'][^"']+["']/u,
      /className=["']sr-only["'][^>]*>\s*[A-Za-z\p{Script=Han}]/u,
    ];
    const offenders: string[] = [];
    for (const path of files) {
      const source = await readFile(path, 'utf8');
      if (forbiddenPatterns.some((pattern) => pattern.test(source))) {
        offenders.push(path.slice(sourceDirectory.length + 1));
      }
    }

    expect(offenders).toEqual([]);
  });
});
