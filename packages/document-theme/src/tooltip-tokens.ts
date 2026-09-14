export const tooltipTokensCss = `
:root {
  --tooltip-background: rgb(36 40 44 / 94%);
  --tooltip-foreground: #f0f1f2;
  --tooltip-radius: 6px;
  --tooltip-padding: 6px 12px;
  --tooltip-font-size: 12px;
  --tooltip-line-height: 16px;
}

:root.dark,
:root[data-appearance="dark"] {
  --tooltip-background: rgb(231 233 235 / 94%);
  --tooltip-foreground: #1b1d20;
}

.tooltip-surface {
  box-sizing: border-box;
  border: 0;
  border-radius: var(--tooltip-radius);
  padding: var(--tooltip-padding);
  background: var(--tooltip-background);
  color: var(--tooltip-foreground);
  font-size: var(--tooltip-font-size);
  line-height: var(--tooltip-line-height);
  overflow-wrap: anywhere;
}
`;
