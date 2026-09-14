import { describe, expect, it } from 'vitest';
import { classifyDocumentLink } from './document-links';

describe('author document links', () => {
  it.each([
    ['query建表.hql', 'query建表.hql', ''],
    ['目录/子目录/query%20%E5%BB%BA%E8%A1%A8.sql', '目录/子目录/query 建表.sql', ''],
    ['../other/报告.markdown?view=1#%E7%BB%93%E8%AE%BA', '../other/报告.markdown', '结论'],
    ['./100%25%20%23%3F.sql?download=true#L10', './100% #?.sql', 'L10'],
    ['%252e%252e.sql', '%2e%2e.sql', ''],
    ['..\\scripts\\query.sql', '../scripts/query.sql', ''],
  ])('decodes once, separating URL suffixes before decoding: %s', (href, path, fragment) => {
    expect(classifyDocumentLink(href)).toEqual({ kind: 'local', path, fragment });
  });

  it('keeps fragments in the document and HTTP(S) in the browser', () => {
    expect(classifyDocumentLink('#%E7%BB%93%E8%AE%BA')).toEqual({ kind: 'fragment', id: '结论' });
    expect(classifyDocumentLink('#')).toEqual({ kind: 'fragment', id: '' });
    expect(classifyDocumentLink('https://example.com/a?q=1#heading')).toEqual({
      kind: 'external',
      url: 'https://example.com/a?q=1#heading',
    });
  });

  it.each([
    'mailto:someone@example.com',
    'mailto:reader@example.com?subject=Hello%20world',
    'mailto:?subject=Feedback',
  ])('allows mail composition links: %s', (url) => {
    expect(classifyDocumentLink(url)).toEqual({ kind: 'external', url });
  });

  it.each([
    null,
    42,
    {},
    '',
    ' ',
    'a'.repeat(16_385),
    '%broken.sql',
    'file.sql#%ZZ',
    'file%00.sql',
    'file\n.sql',
    'file%3Astream.sql',
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///tmp/test.sql',
    'mailto://someone@example.com',
    'mailto:someone@example.com%0AInjected',
    '//server/file.sql',
    '\\\\server\\file.sql',
    '/tmp/file.sql',
    '%2Ftmp/file.sql',
    '%5C%5Cserver/file.sql',
    'C:\\file.sql',
    'https://user:pass@example.com',
    'https://',
  ])('rejects malformed, absolute and unsafe addresses: %s', (href) => {
    expect(classifyDocumentLink(href)).toEqual({ kind: 'invalid' });
  });
});
