import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

const mark = await loadImage(
  new URL('../design/logo/final/mark/fuxian-mark-512.png', import.meta.url),
);
const appIcon = await loadImage(
  new URL('../design/logo/final/app-icon/fuxian-app-icon-512.png', import.meta.url),
);
const resources = new URL('../apps/desktop/resources/', import.meta.url);

const renderMark = (size, monochrome = false) => {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const source = monochrome ? mark : appIcon;
  const inset = monochrome ? Math.max(1, Math.round(size / 18)) : 0;
  context.drawImage(source, inset, inset, size - inset * 2, size - inset * 2);
  if (monochrome) {
    const pixels = context.getImageData(0, 0, size, size);
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index] = 0;
      pixels.data[index + 1] = 0;
      pixels.data[index + 2] = 0;
    }
    context.putImageData(pixels, 0, 0);
  }
  return canvas.toBuffer('image/png');
};

await writeFile(new URL('trayTemplate.png', resources), renderMark(18, true));
await writeFile(new URL('trayTemplate@2x.png', resources), renderMark(36, true));

const sizes = [16, 20, 24, 32, 40, 48, 64];
const images = sizes.map((size) => renderMark(size));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await writeFile(new URL('tray.ico', resources), Buffer.concat([header, ...images]));
console.log('Generated macOS template and Windows multi-resolution tray icons.');
