import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import type { UpdateInfo } from 'electron-updater';
import type { AppReleaseNoteBlock, AppReleaseNotes, UiLocale } from '@fuxian/shared-types';

type Node = DefaultTreeAdapterTypes.ChildNode;
const ignored = new Set(['script', 'style', 'template', 'noscript', 'summary', 'svg']);
const normalize = (text: string): string => text.replaceAll(/[\s\p{Cc}]+/gu, ' ').trim();
const textContent = (node: Node, depth = 0): string => {
  if (depth > 64) return '';
  if ('value' in node && node.nodeName === '#text') return node.value;
  if (!('tagName' in node) || ignored.has(node.tagName)) return '';
  if (node.tagName === 'br') return ' ';
  return node.childNodes.map((child) => textContent(child, depth + 1)).join('');
};

// Keep remote markup out of the application shell; only inert display blocks cross IPC.
export const parseReleaseNotes = (
  notes: UpdateInfo['releaseNotes'],
): AppReleaseNotes | undefined => {
  const sources = typeof notes === 'string' ? [notes] : (notes ?? []).map(({ note }) => note);
  const result: AppReleaseNotes = {};
  const remaining: Record<UiLocale, number> = { 'en-US': 12_000, 'zh-CN': 12_000 };
  let sourceBudget = 100_000;
  const append = (locale: UiLocale, block: AppReleaseNoteBlock): void => {
    const limit = (text: string): string => {
      const value = normalize(text).slice(0, remaining[locale]);
      remaining[locale] -= value.length;
      return value;
    };
    if (block.kind === 'list') {
      const items = block.items.map(limit).filter(Boolean);
      if (items.length) (result[locale] ??= []).push({ ...block, items });
    } else {
      const text = limit(block.text);
      if (text && !/^Full Changelog\s*:/iu.test(text)) {
        (result[locale] ??= []).push({ ...block, text });
      }
    }
  };
  const visit = (nodes: Node[], locale: UiLocale, depth = 0): void => {
    if (depth > 64 || remaining[locale] <= 0) return;
    let inline = '';
    const flush = (): void => {
      append(locale, { kind: 'paragraph', text: inline });
      inline = '';
    };
    for (const node of nodes) {
      if (!('tagName' in node)) {
        inline += textContent(node);
        continue;
      }
      if (ignored.has(node.tagName)) continue;
      if (node.tagName === 'details') {
        flush();
        const summary = node.childNodes.find(
          (child) => 'tagName' in child && child.tagName === 'summary',
        );
        const label =
          summary && 'childNodes' in summary
            ? normalize(summary.childNodes.map((child) => textContent(child)).join(''))
            : '';
        const language = /中文|简体|Chinese/iu.test(label)
          ? 'zh-CN'
          : /English/iu.test(label)
            ? 'en-US'
            : locale;
        visit(node.childNodes, language, depth + 1);
      } else if (/^h[1-6]$/u.test(node.tagName)) {
        flush();
        append(locale, { kind: 'heading', text: textContent(node) });
      } else if (node.tagName === 'ul' || node.tagName === 'ol') {
        flush();
        append(locale, {
          kind: 'list',
          ordered: node.tagName === 'ol',
          items: node.childNodes
            .filter((child) => 'tagName' in child && child.tagName === 'li')
            .map((child) => textContent(child)),
        });
      } else if (['p', 'pre', 'blockquote'].includes(node.tagName)) {
        flush();
        append(locale, { kind: 'paragraph', text: textContent(node) });
      } else if (['div', 'section', 'article', 'main'].includes(node.tagName)) {
        flush();
        visit(node.childNodes, locale, depth + 1);
      } else {
        inline += textContent(node);
      }
    }
    flush();
  };
  for (const source of sources) {
    if (typeof source !== 'string' || sourceBudget <= 0) continue;
    const bounded = source.slice(0, sourceBudget);
    sourceBudget -= bounded.length;
    visit(parseFragment(bounded).childNodes, 'en-US');
  }
  return Object.keys(result).length ? result : undefined;
};
