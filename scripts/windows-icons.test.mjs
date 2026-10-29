import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const sourcePath = new URL('design/logo/final/app-icon/fuxian-app-icon-1024.png', root);

const pixelsOf = async (input) => {
  const image = await loadImage(input);
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.getContext('2d').getImageData(0, 0, image.width, image.height);
};

const icoFrames = async (path) => {
  const buffer = await readFile(new URL(path, root));
  expect(buffer.readUInt16LE(0)).toBe(0);
  expect(buffer.readUInt16LE(2)).toBe(1);
  const count = buffer.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const size = buffer[entry] || 256;
    const length = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    expect(buffer[entry + 1] || 256).toBe(size);
    expect(offset).toBeGreaterThanOrEqual(6 + count * 16);
    expect(offset + length).toBeLessThanOrEqual(buffer.length);
    return { size, png: buffer.subarray(offset, offset + length) };
  });
};

const alphaArea = ({ data }) => {
  let area = 0;
  for (let index = 3; index < data.length; index += 4) area += data[index] / 255;
  return area;
};

const originalAtSize = async (size, path = sourcePath) => {
  const source = await loadImage(path);
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(source, 0, 0, size, size);
  return canvas.toBuffer('image/png');
};

describe('Windows-only outer icon padding', () => {
  it('removes only transparent source pixels, preserving the white carrier and foreground together', async () => {
    const source = await pixelsOf(sourcePath);
    const result = await pixelsOf(new URL('apps/desktop/resources/icon-windows.png', root));
    expect([result.width, result.height]).toEqual([983, 983]);

    // The complete artwork is copied at 1:1 from (21, 20), not redrawn or independently scaled.
    let discardedAlpha = 0;
    let changedAlpha = 0;
    let changedOpaqueColor = 0;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const original = (y * source.width + x) * 4;
        if (x < 21 || x >= 1004 || y < 20 || y >= 1003) {
          discardedAlpha += source.data[original + 3];
          continue;
        }
        const cropped = ((y - 20) * result.width + x - 21) * 4;
        if (result.data[cropped + 3] !== source.data[original + 3]) changedAlpha += 1;
        if (
          source.data[original + 3] === 255 &&
          [0, 1, 2].some(
            (channel) => result.data[cropped + channel] !== source.data[original + channel],
          )
        )
          changedOpaqueColor += 1;
      }
    }
    expect(discardedAlpha).toBe(0);
    expect(changedAlpha).toBe(0);
    expect(changedOpaqueColor).toBe(0);
    expect(alphaArea(result)).toBeCloseTo(alphaArea(source), 8);
  });

  it('keeps the existing 16px application artwork and enlarges only the complete larger icon', async () => {
    const frames = await icoFrames('build/icon.ico');
    expect(frames.map(({ size }) => size)).toEqual([16, 32, 48, 64, 128, 256]);
    expect(
      frames[0].png.equals(
        await readFile(new URL('design/logo/final/app-icon/fuxian-app-icon-16.png', root)),
      ),
    ).toBe(true);
    for (const { size, png } of frames.slice(1)) {
      const actual = await pixelsOf(png);
      expect([actual.width, actual.height]).toEqual([size, size]);
      const uniformlyScaled = await pixelsOf(
        await originalAtSize(size, new URL('apps/desktop/resources/icon-windows.png', root)),
      );
      expect(Buffer.from(actual.data).equals(Buffer.from(uniformlyScaled.data))).toBe(true);
      const gain = alphaArea(actual) / alphaArea(await pixelsOf(await originalAtSize(size)));
      expect(gain).toBeGreaterThan(1.03);
      expect(gain).toBeLessThan(1.2);
    }
  });

  it('leaves tray frames without a full transparent perimeter unchanged', async () => {
    const frames = await icoFrames('apps/desktop/resources/tray.ico');
    expect(frames.map(({ size }) => size)).toEqual([16, 20, 24, 32, 40, 48, 64]);
    const oldSource = new URL('design/logo/final/app-icon/fuxian-app-icon-512.png', root);
    for (const { size, png } of frames) {
      const original = await originalAtSize(size, oldSource);
      if (size < 32) {
        expect(png.equals(original)).toBe(true);
      } else {
        const uniformlyScaled = await pixelsOf(
          await originalAtSize(size, new URL('apps/desktop/resources/icon-windows.png', root)),
        );
        expect(
          Buffer.from((await pixelsOf(png)).data).equals(Buffer.from(uniformlyScaled.data)),
        ).toBe(true);
        const gain = alphaArea(await pixelsOf(png)) / alphaArea(await pixelsOf(original));
        expect(gain).toBeGreaterThan(1.03);
        expect(gain).toBeLessThan(1.2);
      }
    }
  });

  it('does not alter any approved macOS application or menu-bar resource', async () => {
    const hashes = {
      'build/icon.icns': '67d592c33ba231a8ca891f71aad44303c349ebf5900e447c9dd980ef0788c348',
      'build/icon.png': '44b48bf7a4ad95777ea7f52d5d1479f38547d7a8540383641be8ae17404d5bf4',
      'apps/desktop/resources/icon.png':
        '44b48bf7a4ad95777ea7f52d5d1479f38547d7a8540383641be8ae17404d5bf4',
      'apps/desktop/resources/trayTemplate.png':
        'e07c70140a750732030a2d244142634e443d4176a9e0fa5164ed6b7ad26324c2',
      'apps/desktop/resources/trayTemplate@2x.png':
        '47eef888a451cfc06af7ddda22589df548b218c5a00ac3efc32d9ebab0cdcfba',
    };
    for (const [path, expected] of Object.entries(hashes)) {
      expect(
        createHash('sha256')
          .update(await readFile(new URL(path, root)))
          .digest('hex'),
      ).toBe(expected);
    }
  });
});
