import { describe, expect, it } from 'vitest';
import { parseReleaseNotes } from './release-notes';

describe('release note display blocks', () => {
  it('separates the published bilingual format without summary or changelog duplication', () => {
    expect(
      parseReleaseNotes(`<h2>What is new</h2><ul><li>Resume downloads</li></ul>
      <details><summary>中文更新日志</summary><h2>本次更新</h2><ul><li>支持断点续传</li></ul></details>
      <p><strong>Full Changelog</strong>: <a href="https://github.com/compare">Compare</a></p>`),
    ).toEqual({
      'en-US': [
        { kind: 'heading', text: 'What is new' },
        { kind: 'list', ordered: false, items: ['Resume downloads'] },
      ],
      'zh-CN': [
        { kind: 'heading', text: '本次更新' },
        { kind: 'list', ordered: false, items: ['支持断点续传'] },
      ],
    });
  });

  it('preserves safe text, ordered lists and entities, never active markup', () => {
    expect(
      parseReleaseNotes(
        '<p>Hello &amp; <strong>world</strong><br>again</p><ol><li>First</li></ol><script>bad()</script><img src="https://example.com">',
      ),
    ).toEqual({
      'en-US': [
        { kind: 'paragraph', text: 'Hello & world again' },
        { kind: 'list', ordered: true, items: ['First'] },
      ],
    });
  });

  it('keeps single-language notes available for UI fallback', () => {
    expect(parseReleaseNotes('Only English')).toEqual({
      'en-US': [{ kind: 'paragraph', text: 'Only English' }],
    });
    expect(
      parseReleaseNotes('<details><summary>中文更新日志</summary><p>仅中文</p></details>'),
    ).toEqual({ 'zh-CN': [{ kind: 'paragraph', text: '仅中文' }] });
    expect(parseReleaseNotes(undefined)).toBeUndefined();
    expect(parseReleaseNotes('<script>bad()</script>')).toBeUndefined();
  });

  it('bounds long content separately for each language', () => {
    const notes = parseReleaseNotes(
      `<p>${'a'.repeat(20_000)}</p><details><summary>中文更新日志</summary><p>中文仍然可用</p></details>`,
    );
    expect(notes?.['en-US']).toEqual([{ kind: 'paragraph', text: 'a'.repeat(12_000) }]);
    expect(notes?.['zh-CN']).toEqual([{ kind: 'paragraph', text: '中文仍然可用' }]);
  });
});
