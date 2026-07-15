import {
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
  } catch {
    return null;
  }
}

export interface PublicPage {
  /** Canonical username (original casing) that owns the page. */
  username: string;
  data: PageData;
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
    avatarEffect?: AvatarEffect;
  };
  return {
    username: row.username as string,
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
      avatarEffect: styles.avatarEffect,
    },
  };
}
