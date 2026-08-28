import { createServerClient } from "@supabase/ssr";
import { unstable_cache } from "next/cache";
import { env } from "~/env";
import type { IntroConfig } from "~/lib/intro";
import type { MusicConfig } from "~/lib/music";
import {
  type AvatarCrop,
  type AvatarEffect,
  type AvatarOutline,
  type Background,
  type BoxStyle,
  type LinkItem,
  type PageData,
  type PanelStyle,
  queryPage,
  type TextStyle,
} from "~/lib/pages";
import { createClient } from "~/lib/supabase/server";

/**
 * Load the page on the server (SSR) so the client receives it as initial data
 * and renders it immediately — no post-mount fetch or flash of default content.
 * Returns null on any failure; the client then falls back to its defaults.
 */
export async function getPageServer(): Promise<PageData | null> {
  try {
    const supabase = await createClient();
    return await queryPage(supabase);
  } catch (error) {
    console.error("getPageServer failed:", error);
    return null;
  }
}

/**
 * The editor's loader. Unlike {@link getPageServer} it does NOT flatten a failed
 * load into null, because the editor cannot afford the ambiguity: `queryPage`
 * returns null for "this user has no page yet" but throws when the read fails,
 * and the editor's response to those two is opposite. Seeding a blank draft from
 * a transient read failure would hand the user an empty editor over a page that
 * really exists, and the next save would upsert the blank over it.
 */
export async function getPageForEdit(): Promise<
  { ok: true; data: PageData | null } | { ok: false }
> {
  try {
    const supabase = await createClient();
    return { ok: true, data: await queryPage(supabase) };
  } catch (error) {
    console.error("getPageForEdit failed:", error);
    return { ok: false };
  }
}

export interface PublicPage {
  /** Canonical username (original casing) that owns the page. */
  username: string;
  data: PageData;
  /**
   * Whether the owner allows this page to be indexed by search engines. Defaults
   * to true (discoverable) when the flag is absent — e.g. before the
   * search-visibility migration is applied.
   */
  indexable: boolean;
}

// Shape one `get_public_page` result row into a PublicPage. Shared by the
// per-request resolver (below) and the cached featured-pages fetch.
// biome-ignore lint/suspicious/noExplicitAny: RPC row is dynamically shaped
function mapPublicPageRow(row: any): PublicPage {
  const styles = (row.styles ?? {}) as {
    name?: TextStyle;
    bio?: TextStyle;
    background?: Background;
    nameBox?: BoxStyle;
    bioBox?: BoxStyle;
    linkBox?: BoxStyle;
    linkStyle?: TextStyle;
    panel?: PanelStyle;
    panelOrientation?: "vertical" | "horizontal";
    avatarOutline?: AvatarOutline;
    avatarCrop?: AvatarCrop;
    avatarEffect?: AvatarEffect;
    music?: MusicConfig;
    intro?: IntroConfig;
  };
  return {
    username: row.username as string,
    indexable: (row.indexable as boolean | null) ?? true,
    data: {
      name: (row.name as string | null) ?? "",
      bio: (row.bio as string | null) ?? "",
      links: (row.links as LinkItem[] | null) ?? [],
      avatar: (row.avatar as string | null) ?? undefined,
      nameStyle: styles.name,
      bioStyle: styles.bio,
      background: styles.background,
      nameBox: styles.nameBox,
      bioBox: styles.bioBox,
      linkBox: styles.linkBox,
      linkStyle: styles.linkStyle,
      panel: styles.panel,
      panelOrientation: styles.panelOrientation,
      avatarOutline: styles.avatarOutline,
      avatarCrop: styles.avatarCrop,
      avatarEffect: styles.avatarEffect,
      music: styles.music,
      intro: styles.intro,
    },
  };
}

/**
 * Resolve a public page by username via the `get_public_page` SECURITY DEFINER
 * function (see the migration), so anonymous visitors can read exactly the
 * public page fields without direct table access. Returns null when the
 * username doesn't exist (→ 404).
 */
export async function getPublicPageServer(
  username: string,
): Promise<PublicPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_page", {
    page_username: username,
  });
  if (error) {
    // Most likely the `get_public_page` migration hasn't been applied yet
    // (PGRST202). Treat any resolution failure as "no page" so visitors get a
    // clean 404 instead of a 500 crash.
    console.error("get_public_page failed:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapPublicPageRow(row);
}

// A cookie-less Supabase client for reading PUBLIC data only. `get_public_page`
// is SECURITY DEFINER / anon-callable, so no auth cookie is needed — and because
// this client never touches request cookies, its reads are safe to cache.
function createPublicClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Fetch a fixed set of public pages (e.g. the landing-page showcase) by
 * username. These pages are identical for every visitor, so the result is
 * cached across requests (revalidated hourly) rather than re-fetched per load.
 * Any username that doesn't resolve is dropped.
 */
export const getFeaturedPagesServer = unstable_cache(
  async (usernames: string[]): Promise<PublicPage[]> => {
    const supabase = createPublicClient();
    const results = await Promise.all(
      usernames.map(async (username) => {
        const { data, error } = await supabase.rpc("get_public_page", {
          page_username: username,
        });
        if (error) {
          console.error(`get_public_page(${username}) failed:`, error);
          return null;
        }
        const row = Array.isArray(data) ? data[0] : data;
        return row ? mapPublicPageRow(row) : null;
      }),
    );
    return results.filter((p): p is PublicPage => p != null);
  },
  ["featured-pages"],
  // 60s, not an hour: a miss costs a handful of cheap get_public_page RPCs and
  // the cache caps refreshes at one per window per instance, so an owner editing
  // a featured page shows up on the landing wall promptly instead of whenever
  // the hour happens to roll over. (The `featured-pages` tag is declared for a
  // future revalidateTag call; nothing invalidates it today.)
  { revalidate: 60, tags: ["featured-pages"] },
);
