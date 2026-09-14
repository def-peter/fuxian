import { classifyDocumentLink } from '@fuxian/shared-types';
import type { Translator } from '../../localization';

interface LinkTooltipOptions {
  describeLocalLink(href: string): Promise<string | null>;
  translate: Translator;
}

/** One delegated tooltip per iframe; no React updates or link pre-scanning. */
export function bindDocumentLinkTooltips(
  document: Document,
  options: LinkTooltipOptions,
): {
  hide(): void;
  destroy(): void;
} {
  const window = document.defaultView!;
  const style = document.createElement('style');
  style.textContent = `
    .document-link-tooltip {
      position: fixed; inset: auto; margin: 0;
      width: max-content; max-width: min(384px, calc(100vw - 16px));
      max-height: calc(100vh - 16px); overflow: hidden;
      font-family: system-ui, sans-serif; font-weight: 400;
      white-space: normal; text-align: start; pointer-events: none;
    }
    @media print { .document-link-tooltip { display: none !important; } }
  `;
  document.head.append(style);
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip-surface document-link-tooltip';
  tooltip.role = 'tooltip';
  tooltip.id = `document-link-tooltip-${crypto.randomUUID()}`;
  tooltip.setAttribute('popover', 'manual');
  document.body.append(tooltip);
  let active: Element | undefined;
  let timer: number | undefined;
  let generation = 0;
  let visible = false;
  let x = 0;
  let y = 0;
  let previousDescription: string | null = null;
  const titles = new Map<Element, string>();

  const restoreTitle = (anchor: Element): void => {
    const title = titles.get(anchor);
    if (title !== undefined) anchor.setAttribute('title', title);
    titles.delete(anchor);
  };
  const hide = (): void => {
    generation += 1;
    if (timer !== undefined) globalThis.window.clearTimeout(timer);
    timer = undefined;
    if (visible && active) {
      if (previousDescription === null) active.removeAttribute('aria-describedby');
      else active.setAttribute('aria-describedby', previousDescription);
    }
    if (visible) tooltip.hidePopover();
    visible = false;
    active = undefined;
  };
  const reset = (): void => {
    hide();
    for (const anchor of titles.keys()) restoreTitle(anchor);
  };
  const findAnchor = (target: EventTarget | null): Element | null =>
    target && 'nodeType' in target ? ((target as Element).closest?.('a[href]') ?? null) : null;

  const describe = async (anchor: Element): Promise<string | null> => {
    if (anchor.hasAttribute('data-invalid-document-link'))
      return options.translate('链接地址无效或使用了不支持的协议。');
    const href = anchor.getAttribute('href') ?? '';
    const link = classifyDocumentLink(href);
    if (link.kind === 'invalid') return options.translate('链接地址无效或使用了不支持的协议。');
    if (link.kind === 'external') {
      const labelLink = classifyDocumentLink(anchor.textContent?.trim());
      return labelLink.kind === 'external' && labelLink.url === link.url ? null : link.url;
    }
    if (link.kind === 'fragment') {
      const target = link.id
        ? document.getElementById(link.id)?.textContent?.trim() || link.id
        : options.translate('文档开头');
      return options.translate('跳转到：{target}', { target });
    }
    return options.describeLocalLink(href);
  };

  const start = (anchor: Element, clientX: number, clientY: number, delay: number): void => {
    if (active === anchor) return;
    hide();
    active = anchor;
    x = clientX;
    y = clientY;
    if (anchor.hasAttribute('title')) {
      titles.set(anchor, anchor.getAttribute('title')!);
      anchor.removeAttribute('title');
    }
    const request = generation;
    // Continuous srcdoc is script-disabled. Run timers in the calling app realm,
    // as other finished-document controls do, without relaxing iframe sandboxing.
    timer = globalThis.window.setTimeout(() => {
      timer = undefined;
      void describe(anchor)
        .then((text) => {
          if (request !== generation || !anchor.isConnected || !text) return;
          tooltip.textContent = text;
          previousDescription = anchor.getAttribute('aria-describedby');
          anchor.setAttribute(
            'aria-describedby',
            [previousDescription, tooltip.id].filter(Boolean).join(' '),
          );
          tooltip.showPopover();
          visible = true;
          const bounds = tooltip.getBoundingClientRect();
          tooltip.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - bounds.width - 8))}px`;
          tooltip.style.top = `${Math.max(8, y + bounds.height + 20 > window.innerHeight ? y - bounds.height - 12 : y + 12)}px`;
        })
        .catch(() => {
          if (request === generation) hide();
        });
    }, delay);
  };
  const enter = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.buttons) return;
    const anchor = findAnchor(event.target);
    if (anchor) start(anchor, event.clientX, event.clientY, 300);
  };
  const move = (event: PointerEvent): void => {
    if (!visible && active === findAnchor(event.target)) {
      x = event.clientX;
      y = event.clientY;
    }
  };
  const leave = (event: PointerEvent | FocusEvent): void => {
    const anchor = findAnchor(event.target);
    if (anchor && anchor !== findAnchor(event.relatedTarget)) {
      if (active === anchor) hide();
      restoreTitle(anchor);
    }
  };
  const focus = (event: FocusEvent): void => {
    const anchor = findAnchor(event.target);
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect();
    start(anchor, bounds.left, bounds.bottom, 0);
  };
  const keydown = (event: KeyboardEvent): void => {
    if (['Escape', 'Enter', ' '].includes(event.key)) hide();
  };
  const observer = new window.MutationObserver(() => {
    if (active && !active.isConnected) reset();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerover', enter);
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerout', leave);
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', leave);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('click', hide, true);
  document.addEventListener('auxclick', hide, true);
  document.addEventListener('dragstart', hide, true);
  document.addEventListener('keydown', keydown, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('wheel', hide, { passive: true });
  window.addEventListener('resize', hide);
  window.addEventListener('blur', reset);
  // Hovering an iframe does not move keyboard focus into it. Escape and shell
  // clicks must also dismiss a hint while focus still belongs to the host.
  const hostWindow = window.parent === window ? undefined : window.parent;
  hostWindow?.addEventListener('keydown', keydown, true);
  hostWindow?.addEventListener('pointerdown', reset, true);
  hostWindow?.addEventListener('blur', reset);
  return {
    hide: reset,
    destroy: () => {
      reset();
      observer.disconnect();
      document.removeEventListener('pointerover', enter);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('click', hide, true);
      document.removeEventListener('auxclick', hide, true);
      document.removeEventListener('dragstart', hide, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('wheel', hide);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', reset);
      hostWindow?.removeEventListener('keydown', keydown, true);
      hostWindow?.removeEventListener('pointerdown', reset, true);
      hostWindow?.removeEventListener('blur', reset);
      tooltip.remove();
      style.remove();
    },
  };
}
