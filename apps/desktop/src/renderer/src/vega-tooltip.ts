const tooltipSelector = '[data-vega-tooltip]';

const tooltipCss = `
.vega-data-tooltip {
  position: fixed; inset: auto; margin: 0; z-index: 100;
  box-sizing: border-box; width: max-content; max-width: min(360px, calc(100vw - 16px));
  max-height: calc(100vh - 16px); overflow: hidden;
  padding: 8px 10px; border: 0; border-radius: 4px;
  background: var(--tooltip-background);
  color: var(--tooltip-foreground);
  font: 12px/1.5 system-ui, sans-serif; overflow-wrap: anywhere;
  pointer-events: none;
}
.vega-data-tooltip table {
  display: table; width: auto; margin: 0; overflow: visible;
  border-collapse: collapse; font: inherit; color: inherit;
}
.vega-data-tooltip th { padding: 2px 12px 2px 0; text-align: start; font-weight: 400; opacity: .75; }
.vega-data-tooltip td { padding: 2px 0; text-align: start; }
.vega-data-tooltip th, .vega-data-tooltip td {
  min-width: 0; color: inherit; vertical-align: top; border: 0; background: none;
}
@media print { .vega-data-tooltip { display: none !important; } }
`;

/** Attach once per reading surface. Values are already formatted by Vega. */
export const bindVegaTooltips = (scope: Document | HTMLElement): (() => void) => {
  const document = scope.nodeType === 9 ? (scope as Document) : scope.ownerDocument!;
  const window = document.defaultView!;
  const style = document.createElement('style');
  style.textContent = tooltipCss;
  document.head.append(style);
  const tooltip = document.createElement('div');
  tooltip.className = 'vega-data-tooltip';
  tooltip.role = 'tooltip';
  tooltip.id = `vega-tooltip-${globalThis.crypto.randomUUID()}`;
  tooltip.setAttribute('popover', 'manual');
  const host =
    scope.nodeType === 9
      ? document.body
      : ((scope as HTMLElement).closest('[role="dialog"]') ?? scope);
  host.appendChild(tooltip);
  let active: Element | undefined;
  let visible = false;
  let previousDescription: string | null = null;

  const hide = (): void => {
    if (active) {
      if (previousDescription === null) active.removeAttribute('aria-describedby');
      else active.setAttribute('aria-describedby', previousDescription);
    }
    active = undefined;
    if (visible) tooltip.hidePopover();
    visible = false;
  };
  const show = (target: EventTarget | null, x: number, y: number): void => {
    const element =
      target && 'nodeType' in target ? (target as Element).closest?.(tooltipSelector) : null;
    if (!element || !scope.contains(element)) {
      hide();
      return;
    }
    if (active !== element) {
      hide();
      let value: unknown;
      try {
        value = JSON.parse(element.getAttribute('data-vega-tooltip')!);
      } catch {
        return;
      }
      if (value == null) return;
      tooltip.replaceChildren();
      const text = (value: unknown): string =>
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (typeof value === 'object' && !Array.isArray(value)) {
        const table = document.createElement('table');
        for (const [key, field] of Object.entries(value)) {
          const row = table.insertRow();
          const label = document.createElement('th');
          label.scope = 'row';
          label.textContent = key;
          row.append(label);
          row.insertCell().textContent = text(field);
        }
        tooltip.append(table);
      } else tooltip.textContent = text(value);
      active = element;
      previousDescription = element.getAttribute('aria-describedby');
      element.setAttribute(
        'aria-describedby',
        [previousDescription, tooltip.id].filter(Boolean).join(' '),
      );
      tooltip.showPopover();
      visible = true;
    }
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - bounds.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, y + bounds.height + 20 > window.innerHeight ? y - bounds.height - 12 : y + 12)}px`;
  };
  const pointer = (event: Event): void => {
    const mouse = event as PointerEvent;
    if (mouse.buttons) {
      hide();
      return;
    }
    show(mouse.target, mouse.clientX, mouse.clientY);
  };
  const focus = (event: Event): void => {
    const target = event.target as Element;
    const bounds = target.getBoundingClientRect();
    show(target, bounds.left + bounds.width / 2, bounds.bottom);
  };
  const keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') hide();
  };
  const leave = (event: Event): void => {
    const next = (event as PointerEvent).relatedTarget;
    if (!next || !('nodeType' in next) || !scope.contains(next as Node)) hide();
  };
  const observer = new window.MutationObserver(() => {
    if (active && !active.isConnected) hide();
  });
  observer.observe(scope, { childList: true, subtree: true });
  scope.addEventListener('pointermove', pointer);
  scope.addEventListener('pointerleave', hide);
  scope.addEventListener('pointerout', leave);
  scope.addEventListener('pointerdown', hide);
  scope.addEventListener('focusin', focus);
  scope.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  window.addEventListener('keydown', keydown);
  return () => {
    hide();
    observer.disconnect();
    scope.removeEventListener('pointermove', pointer);
    scope.removeEventListener('pointerleave', hide);
    scope.removeEventListener('pointerout', leave);
    scope.removeEventListener('pointerdown', hide);
    scope.removeEventListener('focusin', focus);
    scope.removeEventListener('focusout', hide);
    window.removeEventListener('scroll', hide, true);
    window.removeEventListener('blur', hide);
    window.removeEventListener('resize', hide);
    window.removeEventListener('keydown', keydown);
    tooltip.remove();
    style.remove();
  };
};
