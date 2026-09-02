import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const rootUrl = new URL('../', import.meta.url);
const configUrl = new URL('electron-builder.yml', rootUrl);
const windowsIconUrl = new URL('build/markdown-file.ico', rootUrl);
const macIconUrl = new URL('build/markdown-file.icns', rootUrl);

const readIcoDirectory = (buffer) => {
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  const images = [];

  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const encodedWidth = buffer.readUInt8(entryOffset);
    const encodedHeight = buffer.readUInt8(entryOffset + 1);
    images.push({
      width: encodedWidth === 0 ? 256 : encodedWidth,
      height: encodedHeight === 0 ? 256 : encodedHeight,
      size: buffer.readUInt32LE(entryOffset + 8),
      offset: buffer.readUInt32LE(entryOffset + 12),
    });
  }

  return { reserved, type, count, images };
};

const readIcnsDirectory = (buffer) => {
  const magic = buffer.toString('ascii', 0, 4);
  const declaredSize = buffer.readUInt32BE(4);
  const entries = [];
  let offset = 8;

  while (offset < buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32BE(offset + 4);
    entries.push({ offset, size, type });
    offset += size;
  }

  return { declaredSize, entries, magic, parsedSize: offset };
};

describe('Markdown file association icons', () => {
  it('keeps application and document icons separate in the packaging config', async () => {
    const config = parse(await readFile(configUrl, 'utf8'));

    expect(config.fileAssociations).toBeUndefined();
    expect(config.win.icon).toBe('build/icon.ico');
    expect(config.win.fileAssociations).toEqual([
      {
        ext: ['md', 'markdown'],
        name: 'Markdown 文档',
        description: 'Markdown 源文档',
        icon: 'markdown-file.ico',
        progId: 'Fuxian.Markdown',
      },
    ]);
    expect(config.mac.fileAssociations).toEqual([
      {
        ext: ['md', 'markdown'],
        name: 'Markdown 文档',
        role: 'Viewer',
        icon: 'markdown-file.icns',
      },
    ]);
  });

  it('contains every Windows Explorer icon size', async () => {
    const buffer = await readFile(windowsIconUrl);
    const directory = readIcoDirectory(buffer);

    expect(directory.reserved).toBe(0);
    expect(directory.type).toBe(1);
    expect(directory.count).toBe(8);
    expect(
      directory.images
        .map(({ width, height }) => [width, height])
        .sort(([left], [right]) => left - right),
    ).toEqual([
      [16, 16],
      [20, 20],
      [24, 24],
      [32, 32],
      [48, 48],
      [64, 64],
      [128, 128],
      [256, 256],
    ]);

    for (const image of directory.images) {
      expect(image.size).toBeGreaterThan(0);
      expect(image.offset).toBeGreaterThanOrEqual(6 + directory.count * 16);
      expect(image.offset + image.size).toBeLessThanOrEqual(buffer.length);
    }
  });

  it('contains the complete macOS standard and Retina icon set', async () => {
    const buffer = await readFile(macIconUrl);
    const directory = readIcnsDirectory(buffer);

    expect(directory.magic).toBe('icns');
    expect(directory.declaredSize).toBe(buffer.length);
    expect(directory.parsedSize).toBe(buffer.length);
    expect(directory.entries.map(({ type }) => type)).toEqual(
      expect.arrayContaining([
        'ic04',
        'ic05',
        'ic07',
        'ic08',
        'ic09',
        'ic10',
        'ic11',
        'ic12',
        'ic13',
        'ic14',
      ]),
    );

    for (const entry of directory.entries) {
      expect(entry.size).toBeGreaterThanOrEqual(8);
      expect(entry.offset + entry.size).toBeLessThanOrEqual(buffer.length);
    }
  });
});
