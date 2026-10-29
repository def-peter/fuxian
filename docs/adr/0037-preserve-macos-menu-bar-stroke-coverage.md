---
status: accepted
---

# ADR 0037: Preserve macOS menu-bar stroke coverage

Cropping transparent margins makes the existing macOS menu-bar mark larger, but directly reducing its 1024px source can miss thin horizontal bars. Use area-averaged source alpha, a 16-point-wide mark inside the existing 18-point canvas, and a shared upward 0.25-point alignment for the 18/36px representations. Output RGB is black; do not thicken, outline, redraw, or change the relative geometry of the pages and 「見」.

Tests check horizontal-bar visibility, intervening gaps, and conservation of alpha area independently of the generator. Pixel equality against another copy of the same resampler is not evidence of readability. Visual review uses the actual 1x/2x representations with normal image interpolation, not a pixelated enlargement of the 1x image; this revision was visually approved.

At this decision, Windows resources and runtime PNG selection, the macOS Dock, and file-association icons remain unchanged. Enlarging the internal mark does not establish a fix for a smaller overall Windows icon; that issue requires native runtime and DPI evidence. The later Windows-only transparent-padding adjustment is recorded in ADR 0038 and does not change this macOS decision.
