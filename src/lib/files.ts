/**
 * Turning a user-picked file into the data URL the page model stores.
 *
 * Every editor surface that accepts an upload goes through here — avatars, link
 * logos, media backgrounds, album art, audio — so the size and format rules for
 * a given kind of asset live in one place instead of being re-derived per
 * editor. Browser-only (FileReader + canvas); call from client components.
 */

/**
 * Longest-edge cap, in px, per kind of image asset. Logos are persisted inline
 * in the page's `links` JSON and never render larger than a button glyph, so
 * they stay tiny. An avatar is stored as the source image and framed
 * non-destructively by the page's `avatarCrop`, so it needs enough pixels left
 * to survive being zoomed into. Album art renders at ~80px on the card but also
 * backs the full-width clip picker.
 */
export const MAX_IMAGE_SIZE = {
  logo: 128,
  avatar: 800,
  albumArt: 512,
} as const;

/** Read a file as a raw data URL, byte-for-byte (audio, video, large media). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Read an image and return a data URL downscaled so its longest edge is at most
 * `maxSize`. Keeps stored pages small: a phone camera photo is several MB of
 * base64 before this, and these values are persisted (inline, or uploaded from
 * the inline copy).
 *
 * `encoding` is a required argument rather than a house default because the
 * right answer differs per asset: PNG preserves the transparency that logos and
 * avatars are usually cut out with (a JPEG would fill it with black), while JPEG
 * is several times smaller for photographic album art, which is always opaque.
 */
export function readImageDownscaled(
  file: File,
  maxSize: number,
  encoding: "image/png" | "image/jpeg",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode the image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        // No 2D context (a blocked or exhausted canvas): fall back to the
        // original rather than failing the upload outright.
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(
          encoding === "image/jpeg"
            ? canvas.toDataURL("image/jpeg", 0.9)
            : canvas.toDataURL("image/png"),
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
