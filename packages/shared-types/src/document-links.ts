export type DocumentLink =
  | { kind: 'fragment'; id: string }
  | { kind: 'external'; url: string }
  | { kind: 'local'; path: string; fragment: string }
  | { kind: 'invalid' };

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );

/** Classify the author's href, never an anchor's browser-resolved .href. */
export function classifyDocumentLink(href: unknown): DocumentLink {
  if (typeof href !== 'string' || href.length > 16_384 || hasControlCharacters(href))
    return { kind: 'invalid' };
  const value = href.trim();
  if (!value) return { kind: 'invalid' };
  try {
    if (hasControlCharacters(decodeURIComponent(value))) return { kind: 'invalid' };
    if (value.startsWith('#')) return { kind: 'fragment', id: decodeURIComponent(value.slice(1)) };
    if (/^https?:\/\//iu.test(value)) {
      const url = new URL(value);
      if (!url.hostname || url.username || url.password) return { kind: 'invalid' };
      return { kind: 'external', url: url.href };
    }
    if (/^[a-z][\w+.-]*:/iu.test(value) || value.startsWith('/') || value.startsWith('\\'))
      return { kind: 'invalid' };
    const hash = value.indexOf('#');
    const fragment = hash < 0 ? '' : decodeURIComponent(value.slice(hash + 1));
    const path = decodeURIComponent(value.split(/[?#]/u, 1)[0] ?? '').replaceAll('\\', '/');
    if (!path || path.startsWith('/') || path.includes(':')) return { kind: 'invalid' };
    return { kind: 'local', path, fragment };
  } catch {
    return { kind: 'invalid' };
  }
}
