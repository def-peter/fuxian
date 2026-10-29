import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const resources = new URL('../apps/desktop/resources/', import.meta.url);

const imagePixels = async (path) => {
  const image = await loadImage(path);
  const context = createCanvas(image.width, image.height).getContext('2d');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height);
};

const alphaArea = ({ data }) => {
  let area = 0;
  for (let index = 3; index < data.length; index += 4) area += data[index] / 255;
  return area;
};

describe('desktop tray icon assets', () => {
  it.each([
    ['trayTemplate.png', 18],
    ['trayTemplate@2x.png', 36],
  ])('provides a transparent monochrome macOS template: %s', async (filename, size) => {
    const pixels = await imagePixels(new URL(filename, resources));
    expect([pixels.width, pixels.height]).toEqual([size, size]);
    let visible = 0;
    let transparent = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index + 3] === 0) {
        transparent += 1;
        continue;
      }
      visible += 1;
      expect(Array.from(pixels.data.slice(index, index + 3))).toEqual([0, 0, 0]);
    }
    expect(visible).toBeGreaterThan(size);
    expect(transparent).toBeGreaterThan(size);
    // Leave a transparent perimeter rather than clipping the enlarged mark.
    for (let coordinate = 0; coordinate < size; coordinate += 1) {
      for (const [x, y] of [
        [coordinate, 0],
        [coordinate, size - 1],
        [0, coordinate],
        [size - 1, coordinate],
      ]) {
        expect(pixels.data[(y * size + x) * 4 + 3]).toBe(0);
      }
    }
  });

  it.each([
    [
      'trayTemplate.png',
      18,
      12,
      [
        [1, 3],
        [4, 5],
        [7, 8],
      ],
      [6],
      180,
    ],
    [
      'trayTemplate@2x.png',
      36,
      24,
      [
        [3, 6],
        [9, 11],
        [14, 16],
      ],
      [8, 12],
      250,
    ],
  ])(
    'keeps all three character bars visible and separated: %s',
    async (filename, size, x, bands, gaps, minimum) => {
      const { data } = await imagePixels(new URL(filename, resources));
      const alphaAt = (y) => data[(y * size + x) * 4 + 3];
      // Probe the interior of 「見」, not its vertical edge or the surrounding pages.
      // These bounds describe the artwork; they do not repeat the resampling algorithm.
      const peaks = bands.map(([first, last]) =>
        Math.max(
          ...Array.from({ length: last - first + 1 }, (_, offset) => alphaAt(first + offset)),
        ),
      );
      for (const peak of peaks) expect(peak).toBeGreaterThanOrEqual(minimum);
      expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThanOrEqual(80);
      for (const y of gaps) expect(alphaAt(y)).toBeLessThanOrEqual(30);
    },
  );

  it.each([18, 36])('preserves source alpha coverage without thickening at %ipx', async (size) => {
    const source = await imagePixels(
      new URL('../design/logo/final/mark/fuxian-mark-source.png', import.meta.url),
    );
    const filename = size === 18 ? 'trayTemplate.png' : 'trayTemplate@2x.png';
    const result = await imagePixels(new URL(filename, resources));
    // The original visible artwork is 722 source pixels wide, fitted into 16 logical pixels.
    const scale = ((size / 18) * 16) / 722;
    expect(Math.abs(alphaArea(result) - alphaArea(source) * scale ** 2)).toBeLessThan(0.25);
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
