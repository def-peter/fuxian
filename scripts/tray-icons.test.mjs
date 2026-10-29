import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const resources = new URL('../apps/desktop/resources/', import.meta.url);

describe('desktop tray icon assets', () => {
  it.each([
    ['trayTemplate.png', 18],
    ['trayTemplate@2x.png', 36],
  ])('provides a transparent monochrome macOS template: %s', async (filename, size) => {
    const image = await loadImage(new URL(filename, resources));
    expect([image.width, image.height]).toEqual([size, size]);
    const canvas = createCanvas(size, size);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, size, size);
    let visible = 0;
    let transparent = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] === 0) {
        transparent += 1;
        continue;
      }
      visible += 1;
      expect(Array.from(data.slice(index, index + 3))).toEqual([0, 0, 0]);
    }
    expect(visible).toBeGreaterThan(size);
    expect(transparent).toBeGreaterThan(size);
  });

  it('provides Windows tray sizes from 100% through high-DPI scaling', async () => {
    const data = await readFile(new URL('tray.ico', resources));
    expect(data.readUInt16LE(0)).toBe(0);
    expect(data.readUInt16LE(2)).toBe(1);
    const count = data.readUInt16LE(4);
    const sizes = [];
    for (let index = 0; index < count; index += 1) {
      const entry = 6 + index * 16;
      const size = data.readUInt8(entry);
      sizes.push(size);
      expect(data.readUInt8(entry + 1)).toBe(size);
      const length = data.readUInt32LE(entry + 8);
      const offset = data.readUInt32LE(entry + 12);
      expect(offset).toBeGreaterThanOrEqual(6 + count * 16);
      expect(offset + length).toBeLessThanOrEqual(data.length);
      const image = await loadImage(data.subarray(offset, offset + length));
      expect([image.width, image.height]).toEqual([size, size]);
      const context = createCanvas(size, size).getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, size, size).data;
      let colored = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        if (
          pixels[pixel + 3] > 0 &&
          (pixels[pixel] !== pixels[pixel + 1] || pixels[pixel + 1] !== pixels[pixel + 2])
        ) {
          colored += 1;
        }
      }
      expect(colored).toBeGreaterThan(size);
    }
    expect(sizes).toEqual([16, 20, 24, 32, 40, 48, 64]);
  });
});
