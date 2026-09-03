import { describe, expect, it } from 'vitest';
import { createTranslator, productName, translate } from './localization';

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
});
