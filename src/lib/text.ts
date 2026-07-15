/**
 * Flatten the rich-text HTML stored for a name/bio into a single plain-text
 * line, safe for page titles, meta descriptions, and OG images. Strips tags,
 * collapses whitespace, and decodes the handful of entities our editor emits.
 */
export function plainText(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
