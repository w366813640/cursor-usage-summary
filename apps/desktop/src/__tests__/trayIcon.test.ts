import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePngRgba, generateTrayPng } from '../trayIcon';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  const out: Array<{ type: string; data: Buffer }> = [];
  let i = 8;
  while (i < png.length) {
    const length = png.readUInt32BE(i);
    const type = png.subarray(i + 4, i + 8).toString('ascii');
    const data = png.subarray(i + 8, i + 8 + length);
    out.push({ type, data });
    i += 8 + length + 4;
    if (type === 'IEND') break;
  }
  return out;
}

describe('encodePngRgba', () => {
  it('emits the PNG magic + IHDR + IDAT + IEND chunks in order', () => {
    const pixels = Buffer.alloc(4 * 4 * 4);
    const png = encodePngRgba(4, 4, pixels);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    const chunks = readChunks(png);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('records the correct width / height / colour-type in IHDR', () => {
    const png = encodePngRgba(16, 32, Buffer.alloc(16 * 32 * 4));
    const ihdr = readChunks(png).find((c) => c.type === 'IHDR');
    expect(ihdr).toBeTruthy();
    expect(ihdr!.data.readUInt32BE(0)).toBe(16);
    expect(ihdr!.data.readUInt32BE(4)).toBe(32);
    expect(ihdr!.data.readUInt8(8)).toBe(8); // bit depth
    expect(ihdr!.data.readUInt8(9)).toBe(6); // color type RGBA
  });

  it('round-trips the pixel buffer through deflate without loss', () => {
    const W = 4;
    const H = 4;
    const pixels = Buffer.alloc(W * H * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 17) & 0xff;
    const png = encodePngRgba(W, H, pixels);
    const idat = readChunks(png).find((c) => c.type === 'IDAT')!;
    const decompressed = zlib.inflateSync(idat.data);

    // Each scanline is prefixed with one filter byte (0 = None).
    const rowBytes = W * 4;
    expect(decompressed.length).toBe((rowBytes + 1) * H);
    for (let y = 0; y < H; y++) {
      const filterByte = decompressed[y * (rowBytes + 1)];
      expect(filterByte).toBe(0);
      const row = decompressed.subarray(y * (rowBytes + 1) + 1, y * (rowBytes + 1) + 1 + rowBytes);
      const expected = pixels.subarray(y * rowBytes, (y + 1) * rowBytes);
      expect(row.equals(expected)).toBe(true);
    }
  });

  it('throws when the pixel buffer is the wrong size', () => {
    expect(() => encodePngRgba(2, 2, Buffer.alloc(15))).toThrow(/length mismatch/);
  });
});

describe('generateTrayPng', () => {
  it('produces a valid 32x32 PNG by default', () => {
    const png = generateTrayPng();
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    const ihdr = readChunks(png).find((c) => c.type === 'IHDR')!;
    expect(ihdr.data.readUInt32BE(0)).toBe(32);
    expect(ihdr.data.readUInt32BE(4)).toBe(32);
  });

  it('respects a custom size', () => {
    const png = generateTrayPng({ size: 48 });
    const ihdr = readChunks(png).find((c) => c.type === 'IHDR')!;
    expect(ihdr.data.readUInt32BE(0)).toBe(48);
    expect(ihdr.data.readUInt32BE(4)).toBe(48);
  });

  it('respects a custom colour', () => {
    const png = generateTrayPng({ size: 8, color: { r: 0x10, g: 0x20, b: 0x30 } });
    const idat = readChunks(png).find((c) => c.type === 'IDAT')!;
    const decompressed = zlib.inflateSync(idat.data);
    // Every opaque pixel should carry the requested RGB; scan the
    // unfiltered scanlines looking for any opaque sample.
    const rowBytes = 8 * 4;
    let found = false;
    for (let y = 0; y < 8; y++) {
      const row = decompressed.subarray(y * (rowBytes + 1) + 1, y * (rowBytes + 1) + 1 + rowBytes);
      for (let x = 0; x < 8; x++) {
        const alpha = row[x * 4 + 3];
        if (alpha === 0xff) {
          expect(row[x * 4]).toBe(0x10);
          expect(row[x * 4 + 1]).toBe(0x20);
          expect(row[x * 4 + 2]).toBe(0x30);
          found = true;
        } else {
          expect(alpha).toBe(0);
        }
      }
    }
    expect(found).toBe(true);
  });
});
