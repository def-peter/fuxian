# Paper Preview Prototype

Throwaway prototype for Issue #29. It compares three screen representations with `?variant=paged`, `columns`, and `markers`, then verifies whether Paged.js page DOM can be printed one-to-one by Electron.

Run the automated hidden-window check:

```bash
pnpm prototype:paper
FUXIAN_PROTOTYPE_ROWS=1200 pnpm prototype:paper
```

## Verdict

Paged.js is viable behind a dedicated trusted renderer runtime. A representative fixture preserved selectable SVG text, heading anchors, terminal content, and exact screen/PDF page counts. The 1200-row pressure run produced 111 screen pages and 111 PDF pages; pagination completed in 1.96 seconds on the test machine.

A single 32-row table caused non-terminating pagination. Splitting long Markdown tables into bounded row groups before pagination, while cloning the header into each group, removed the loop: the fixture produced 5 screen pages and 5 PDF pages. Production code must retain a hard timeout and previous successful revision, reject obsolete pagination results, and handle an individually oversized row with an explicit content-preserving fallback.

The `columns` variant retains one DOM but creates anonymous horizontal fragments that cannot represent the required vertical page stack. The `markers` variant only draws gaps and does not participate in fragmentation. Neither is suitable for production.
