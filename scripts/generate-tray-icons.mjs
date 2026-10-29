import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateWindowsIcons } from './generate-windows-icons.mjs';

const mark = await loadImage(
  new URL('../design/logo/final/mark/fuxian-mark-source.png', import.meta.url),
);
const resources = new URL('../apps/desktop/resources/', import.meta.url);
const exports = new URL('../design/logo/final/small-icon/monochrome/', import.meta.url);

const sourceContext = createCanvas(mark.width, mark.height).getContext('2d');
sourceContext.drawImage(mark, 0, 0);
const sourcePixels = sourceContext.getImageData(0, 0, mark.width, mark.height).data;
const bounds = { left: mark.width, top: mark.height, right: -1, bottom: -1 };
for (let y = 0; y < mark.height; y += 1) {
  for (let x = 0; x < mark.width; x += 1) {
    if (sourcePixels[(y * mark.width + x) * 4 + 3] === 0) continue;
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x);
    bounds.bottom = Math.max(bounds.bottom, y);
  }
}
if (bounds.right < bounds.left) throw new Error('The source logo is empty.');

const renderTemplate = (size) => {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  const sourceWidth = bounds.right - bounds.left + 1;
  const sourceHeight = bounds.bottom - bounds.top + 1;
  const representationScale = size / 18;
  const scale = (16 * representationScale) / Math.max(sourceWidth, sourceHeight);
  const dx = (size - sourceWidth * scale) / 2;
  // One shared logical offset balances thin horizontal bars at 1x and 2x, without redrawing them.
  const dy = (size - sourceHeight * scale) / 2 - 0.25 * representationScale;

  // Integrate source alpha over each destination pixel. Point/interpolated sampling can
  // miss narrow strokes when reducing a 1024px source directly to a menu-bar image.
  for (let y = 0; y < size; y += 1) {
    const top = Math.max(bounds.top, bounds.top + (y - dy) / scale);
    const bottom = Math.min(bounds.bottom + 1, bounds.top + (y + 1 - dy) / scale);
    for (let x = 0; x < size; x += 1) {
      const left = Math.max(bounds.left, bounds.left + (x - dx) / scale);
      const right = Math.min(bounds.right + 1, bounds.left + (x + 1 - dx) / scale);
      if (right <= left || bottom <= top) continue;
      let coverage = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy += 1) {
        const overlapY = Math.min(bottom, sy + 1) - Math.max(top, sy);
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx += 1) {
          const overlapX = Math.min(right, sx + 1) - Math.max(left, sx);
          coverage += sourcePixels[(sy * mark.width + sx) * 4 + 3] * overlapX * overlapY;
        }
      }
      pixels.data[(y * size + x) * 4 + 3] = Math.round(coverage * scale ** 2);
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toBuffer('image/png');
};

await mkdir(exports, { recursive: true });
for (const [size, filename] of [
  [18, 'trayTemplate.png'],
  [36, 'trayTemplate@2x.png'],
]) {
  const image = renderTemplate(size);
  await writeFile(new URL(filename, resources), image);
  await writeFile(new URL(`fuxian-small-icon-${size}.png`, exports), image);
}

await generateWindowsIcons();
console.log('Generated macOS templates and Windows icon resources.');
