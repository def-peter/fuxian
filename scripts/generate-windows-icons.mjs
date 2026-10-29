import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);

const render = (source, size) => {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(source, 0, 0, size, size);
  return canvas.toBuffer('image/png');
};

const encodeIco = (frames) => {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  for (const [index, { size, png }] of frames.entries()) {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
};

export const generateWindowsIcons = async () => {
  const source = await loadImage(
    new URL('design/logo/final/app-icon/fuxian-app-icon-1024.png', root),
  );
  const context = createCanvas(source.width, source.height).getContext('2d');
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  const bounds = { left: source.width, top: source.height, right: -1, bottom: -1 };
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      // Even a 1/255-alpha edge belongs to the artwork, not discardable padding.
      if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
      bounds.left = Math.min(bounds.left, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x);
      bounds.bottom = Math.max(bounds.bottom, y);
    }
  }
  if (bounds.right < bounds.left) throw new Error('The application icon is empty.');
  if (source.width !== source.height) throw new Error('The application icon must be square.');

  // Crop only all-transparent strips, keeping one source pixel around the full alpha bounds.
  // The white carrier and its foreground are copied together, without any internal edits.
  const size = Math.min(
    source.width,
    Math.max(bounds.right - bounds.left + 1, bounds.bottom - bounds.top + 1) + 2,
  );
  const left = Math.max(
    0,
    Math.min(source.width - size, Math.floor((bounds.left + bounds.right + 1 - size) / 2)),
  );
  const top = Math.max(
    0,
    Math.min(source.height - size, Math.floor((bounds.top + bounds.bottom + 1 - size) / 2)),
  );
  const cropped = createCanvas(size, size);
  cropped.getContext('2d').drawImage(source, -left, -top);
  await writeFile(
    new URL('apps/desktop/resources/icon-windows.png', root),
    cropped.toBuffer('image/png'),
  );

  const applicationFrames = [];
  for (const frameSize of [16, 32, 48, 64, 128, 256]) {
    applicationFrames.push({
      size: frameSize,
      png:
        frameSize === 16
          ? await readFile(new URL('design/logo/final/app-icon/fuxian-app-icon-16.png', root))
          : render(cropped, frameSize),
    });
  }
  await writeFile(new URL('build/icon.ico', root), encodeIco(applicationFrames));

  const originalTraySource = await loadImage(
    new URL('design/logo/final/app-icon/fuxian-app-icon-512.png', root),
  );
  const trayFrames = [16, 20, 24, 32, 40, 48, 64].map((frameSize) => ({
    size: frameSize,
    // These smaller frames have no complete transparent perimeter to reclaim safely.
    png: render(frameSize < 32 ? originalTraySource : cropped, frameSize),
  }));
  await writeFile(new URL('apps/desktop/resources/tray.ico', root), encodeIco(trayFrames));
  console.log(
    `Generated Windows icons from a ${size}px transparent-only crop at (${left}, ${top}); macOS assets untouched.`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateWindowsIcons();
}
