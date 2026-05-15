import zlib from 'node:zlib';

/**
 * Pure tray-icon rasteriser. Renders the same five-bar mark that
 * `splash.ts` and the README use, at any size, into a real PNG buffer
 * — no external deps, no committed binary, no platform-specific build
 * step. Lives in its own module so it can be unit-tested without
 * dragging in Electron.
 *
 * Why we build a PNG instead of using `nativeImage.createFromBitmap`:
 * `createFromBitmap` accepts raw RGBA but its pixel order is
 * subtly platform-specific on some Electron builds. A real PNG passed
 * to `createFromBuffer` is unambiguous everywhere and the encoder is
 * ~80 lines.
 *
 * Color choice:
 *   - On Windows / Linux the icon shows up in the system tray as-is,
 *     so we render the warm-amber accent (#C96F4A) at full opacity to
 *     match the dashboard's branding.
 *   - On macOS the caller should set `nativeImage.setTemplateImage(true)`;
 *     macOS ignores RGB and recolours per theme using only the alpha
 *     channel. Same PNG works because every bar is fully opaque.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i] as number;
    c = (CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/**
 * Encode an 8-bit RGBA pixel buffer into a PNG.
 *
 * `pixels` must be `width * height * 4` bytes, row-major, top-to-bottom.
 * The output is a complete `.png` file ready to hand to
 * `nativeImage.createFromBuffer()`.
 */
export function encodePngRgba(width: number, height: number, pixels: Buffer): Buffer {
  if (pixels.length !== width * height * 4) {
    throw new Error(
      `encodePngRgba: pixel buffer length mismatch (got ${pixels.length}, expected ${width * height * 4})`,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const rowBytes = width * 4;
  const scanlines = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const dst = y * (rowBytes + 1);
    scanlines[dst] = 0;
    pixels.copy(scanlines, dst + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idatData = zlib.deflateSync(scanlines, { level: 9 });

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface TrayBarsOptions {
  size?: number;
  color?: { r: number; g: number; b: number };
}

const DEFAULT_COLOR = { r: 0xc9, g: 0x6f, b: 0x4a };

interface BarSpec {
  /** Bar X start as a fraction of width [0..1]. */
  x: number;
  /** Bar Y start as a fraction of height [0..1] (top-anchored). */
  yStart: number;
}

const BAR_SPECS: BarSpec[] = [
  { x: 0.09, yStart: 0.6 },
  { x: 0.28, yStart: 0.4 },
  { x: 0.47, yStart: 0.18 },
  { x: 0.66, yStart: 0.34 },
  { x: 0.85, yStart: 0.5 },
];

/**
 * Generate the five-bar mark as a PNG buffer at the requested size.
 * Default is 32×32, which Electron's `Tray` auto-scales down to 16×16
 * for the Windows notification area and to 22×22 for most Linux trays.
 */
export function generateTrayPng(opts: TrayBarsOptions = {}): Buffer {
  const size = opts.size ?? 32;
  const color = opts.color ?? DEFAULT_COLOR;
  const pixels = Buffer.alloc(size * size * 4);

  const barWidth = Math.max(2, Math.round(size * 0.1));
  // Bars sit on a baseline 90% of the way down so they have a tiny
  // visual gutter at the bottom edge.
  const baseline = Math.round(size * 0.9);

  for (const spec of BAR_SPECS) {
    const xStart = Math.round(spec.x * size);
    const yStart = Math.round(spec.yStart * size);
    for (let y = yStart; y < baseline && y < size; y++) {
      for (let x = xStart; x < xStart + barWidth && x < size; x++) {
        const i = (y * size + x) * 4;
        pixels[i] = color.r;
        pixels[i + 1] = color.g;
        pixels[i + 2] = color.b;
        pixels[i + 3] = 0xff;
      }
    }
  }

  return encodePngRgba(size, size, pixels);
}
