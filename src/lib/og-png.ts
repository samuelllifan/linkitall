import { deflateSync } from "node:zlib";

/**
 * Minimal 8-bit PNG encoder for the share cards.
 *
 * Satori can rasterize an image but not a shader, a mask, or a CSS filter, so
 * the card reconstructs a couple of the page's backgrounds by evaluating them
 * per-pixel and handing Satori the result as a `data:image/png` URI. This is
 * the encoder those rasterizers share.
 *
 * Hand-rolled rather than pulled from a dependency: it needs exactly two pixel
 * formats, it runs on the unfurl path of every page, and `node:zlib` already
 * does the only hard part.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode raw pixels as a PNG.
 *
 * `pixels` is tightly packed RGB (3 bytes per pixel) or RGBA (4), top row
 * first, as chosen by `alpha`.
 *
 * Scanlines use filter 2 (Up) — every byte stored as its delta from the pixel
 * above. Both callers rasterize fields that vary far more down the frame than
 * across it, so those deltas sit near zero and deflate collapses the image to a
 * few kB.
 */
export function encodePng(
  pixels: Uint8Array,
  width: number,
  height: number,
  { alpha = false }: { alpha?: boolean } = {},
): Buffer {
  const bpp = alpha ? 4 : 3;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 2; // filter: Up
    const row = y * stride;
    const prev = row - stride;
    for (let i = 0; i < stride; i++) {
      const above = y === 0 ? 0 : pixels[prev + i];
      raw[o++] = (pixels[row + i] - above) & 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type: truecolour (+ alpha)
  // [10] compression, [11] filter, [12] interlace — all 0, already zeroed.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** `encodePng`, as a `data:` URI ready for a Satori `backgroundImage`. */
export function pngDataUri(
  pixels: Uint8Array,
  width: number,
  height: number,
  opts?: { alpha?: boolean },
): string {
  return `data:image/png;base64,${encodePng(pixels, width, height, opts).toString("base64")}`;
}

/** `#rgb` / `#rrggbb` → [r, g, b] 0–255. Tolerant: bad input reads black. */
export function hexToRgb255(hex: string): [number, number, number] {
  const h = (typeof hex === "string" ? hex : "").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Bounded memo for rasterized backgrounds.
 *
 * The profile card route is `force-dynamic`, so without this every unfurl,
 * crawler hit and Discord retry would re-run a whole per-pixel evaluation. The
 * cap guards against a pathological spread of colours filling the process heap;
 * it is not a real expectation, since a few hundred distinct palettes already
 * exceeds anything the page count can produce.
 */
export function memoByKey<T>(limit: number): (key: string, make: () => T) => T {
  const cache = new Map<string, T>();
  return (key, make) => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const made = make();
    if (cache.size >= limit) cache.clear();
    cache.set(key, made);
    return made;
  };
}
