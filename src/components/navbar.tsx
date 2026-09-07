"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
import { CloseIcon } from "~/components/ui/close-icon";
import { createClient } from "~/lib/supabase/client";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { useDismissOnOutside, usePopover } from "~/lib/use-popover";
import { useSlidingMarker } from "~/lib/use-sliding-marker";
import { cn } from "~/lib/utils";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// Row glyphs for the account menu. A menu of bare words is read left-to-right
// every time; a menu with glyphs is recognised by shape after the second visit,
// which is what a chrome menu is for. Same 24-box, same 2px stroke as the icons
// above, so they sit on one optical weight.
function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

// Stagger step for rows inside an opening menu. Small on purpose: four rows at
// 25ms puts the last one 75ms behind the first, so the whole menu is settled
// inside ~300ms. See `.animate-nav-row` in globals.css for why that ceiling.
const ROW_STEP_MS = 25;
const rowDelay = (i: number): CSSProperties => ({
  animationDelay: `${i * ROW_STEP_MS}ms`,
});

// One row style for the account menu, shared by its three items so they cannot
// drift apart. `group/row` — a NAMED group, because the trigger button is
// already a plain `group` and an unnamed nested one would make every row's icon
// light up whenever the button was hovered.
const MENU_ROW =
  "animate-nav-row group/row flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const MENU_ICON =
  "size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-foreground";

// The pull tab, in both of its directions: hanging under the bar to push it
// away, and hanging off the top of the screen to pull it back. One shape on
// purpose — the thing you press to park the bar and the thing you press to get
// it back should be recognisably the same object, so finding it the second time
// takes no thought. Hence the shared `rounded-b-xl` too: it always reads as a
// handle hanging DOWN off the edge above it, whichever edge that is.
const NAV_TAB =
  "flex h-6 items-center justify-center rounded-b-xl border-border/70 border-r border-b border-l bg-card/85 px-5 text-muted-foreground backdrop-blur-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// How far down the viewport still counts as "the top of the screen" for the
// purpose of summoning the tab.
//
// 92px is the hard floor and this is deliberately just clear of it: the tab's
// lowest position is hanging off the bar at 68px, so its bottom edge is at 92,
// and a zone that stopped any higher would switch off — and go
// pointer-events-none — under the pointer while it was travelling down to
// click the thing. Tightening this further means shortening the tab or moving
// it up, not just lowering the number.
const TOP_ZONE_PX = 100;

// The account avatar mirrors the user's own page: their uploaded picture when
// set, otherwise the first letter of their page name (matching profile-view's
// fallback). Only ever rendered for a signed-in account — a guest gets the
// Sign in / Sign up pair instead, so there is no signed-out variant.
//
// No rim. It used to wear a brand-gradient one, which meant every account
// picture on the site was framed in colours that were not the user's — a person
// with a red photo got an amber-to-violet sweep around it whether it suited them
// or not. The picture is the user's own; the chrome stays out of it.
function Avatar({ src, name }: { src?: string | null; name?: string | null }) {
  const initial = (name?.trim().charAt(0) ?? "").toUpperCase();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted transition-transform duration-300 group-hover:scale-[1.06] group-active:scale-95 group-active:duration-75">
      {src ? (
        // biome-ignore lint/performance/noImgElement: tiny avatar, often a data URL
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-semibold text-muted-foreground text-sm">
          {initial || "•"}
        </span>
      )}
    </span>
  );
}

export function Navbar({
  userEmail,
  username,
  isAdmin = false,
  avatarUrl = null,
  displayName = null,
}: {
  userEmail: string | null;
  username: string | null;
  isAdmin?: boolean;
  avatarUrl?: string | null;
  displayName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const menu = usePopover();
  // Mobile nav drawer (the inline page links collapse into this below `sm`).
  const drawer = usePopover();
  // The island only casts a shadow once there is page under it to cast onto.
  const [scrolled, setScrolled] = useState(false);
  const prevEmailRef = useRef(userEmail);

  if (prevEmailRef.current !== userEmail) {
    prevEmailRef.current = userEmail;
    if (signingOut) setSigningOut(false);
  }
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);

  // Lift the island off the page as soon as it starts to scroll. Read once on
  // mount too: a reload restores the previous scroll offset, so the bar would
  // otherwise paint flat halfway down a page and only lift on the next wheel
  // tick. Passive, and it only ever writes a boolean, so React bails out of
  // re-rendering for every scroll event after the first.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useDismissOnOutside(menu.shown, menuRef, menu.hide);
  useDismissOnOutside(drawer.shown, mobileNavRef, drawer.hide);

  // Close the mobile nav drawer whenever the route changes (a link was
  // followed). It animates out rather than vanishing with the old page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on navigation
  useEffect(() => {
    drawer.hide();
  }, [pathname, drawer.hide]);

  const guard = useUnsavedGuard();

  // Signed in, the nav is the app's own switcher: three lenses on one object,
  // ordered noun-first. My Page is the thing; Studio edits it; Dashboard
  // measures it. That reads as a sentence, and it puts the destination a
  // creator thinks of by name in the slot nearest the wordmark.
  //
  // There is deliberately no "Home". The wordmark to its left already goes to
  // `/` — that is what a wordmark is for — so a Home link is a second link to
  // the same place, and for someone who is already signed in that place is a
  // marketing pitch they have accepted. The editor earns the freed slot: it
  // used to be reachable only from a floating button on the profile page, which
  // is what made previewing your own page impossible.
  //
  // "My Page" only points at a real /<username> once they've picked one;
  // /my-page stands in until then and routes to settings.
  //
  // Signed out, those destinations are all just the login wall, so a guest gets
  // Home alone and the two actions on the right carry the bar. The landing page
  // is one continuous pitch that a visitor scrolls, not a set of destinations to
  // jump between, so there is nothing else for a nav link to point at. (A guest
  // used to get a "My Page" link that only ever bounced them to /login.)
  const links = userEmail
    ? [
        { href: username ? `/${username}` : "/my-page", label: "My Page" },
        { href: "/edit", label: "Studio" },
        { href: "/dashboard", label: "Dashboard" },
      ]
    : [{ href: "/", label: "Home" }];

  // Which link the marker is parked on. Optimistic: a nav click sets it before
  // the route resolves, so the marker starts sliding on the press instead of
  // after the server has answered. Several of these routes are force-dynamic,
  // and waiting for `pathname` to change put the whole animation AFTER the page
  // had already swapped — which read as the bar lagging behind the content.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const target = pendingHref ?? pathname;

  // Drop the optimistic guess once the route lands — or after two seconds if it
  // never does. A navigation can be cancelled by the user hitting back, or fail
  // outright; without the timer the marker would sit on a page they aren't on.
  useEffect(() => {
    if (!pendingHref) return;
    if (pendingHref === pathname) {
      setPendingHref(null);
      return;
    }
    const id = setTimeout(() => setPendingHref(null), 2000);
    return () => clearTimeout(id);
  }, [pendingHref, pathname]);

  // The sliding marker's geometry, measured off the live DOM by the shared hook
  // — the links are text, so their widths depend on the font that actually
  // loaded and on the username, and there is no static value to hardcode.
  // `target` is the trigger (it is the optimistic route); the marker finds the
  // active link itself, by `[data-nav-target]`.
  const {
    ref: linkRowRef,
    marker,
    placed: markerPlaced,
  } = useSlidingMarker<HTMLDivElement>(target, "[data-nav-target]");

  // Previewing your own page. The bar is the only stacked chrome left on a
  // profile route (visitors get none — see globals.css), and the whole point of
  // visiting your own /<username> is to see what you actually shipped. So on
  // that one route the bar can be pulled out of the way and tugged back.
  //
  // Matched against the signed-in user's own username rather than a route
  // pattern: it is the only test that distinguishes YOUR page from someone
  // else's without teaching the navbar the shape of every route in the app.
  const isOwnPage =
    !!username && pathname.toLowerCase() === `/${username.toLowerCase()}`;
  const [collapsed, setCollapsed] = useState(false);
  // Collapsing is only meaningful on your own page, so the state is READ
  // through that check rather than reset by it: leave the page and the bar is
  // back, come back to it and it is still out of the way, which is what
  // "previewing" means. Nothing is persisted — a reload always returns the bar,
  // so this can never become "my navbar disappeared and I don't know why".
  const barHidden = isOwnPage && collapsed;

  // Parking the bar takes its panels with it: an account menu or drawer left
  // open would slide off screen still open and be sitting there waiting when
  // the bar came back. hide() is a no-op when they are already closed.
  useEffect(() => {
    if (!barHidden) return;
    menu.hide();
    drawer.hide();
  }, [barHidden, menu.hide, drawer.hide]);

  // Announce it on <html> so the page's own fixed overlays can move up with the
  // bar (--chrome-top in globals.css). Same channel the intro splash uses.
  useEffect(() => {
    const root = document.documentElement;
    if (barHidden) root.dataset.navHidden = "";
    else delete root.dataset.navHidden;
    return () => {
      delete root.dataset.navHidden;
    };
  }, [barHidden]);

  // Is the pointer up in the top strip of the viewport? That, rather than
  // hovering the bar itself, is what summons the tab — the bar is not there to
  // be hovered once it is parked, and a hot zone covers both states with one
  // rule.
  //
  // Tracked in JS rather than as an invisible hover target, because a
  // transparent strip across the top of the page with pointer events on it
  // would swallow clicks on whatever the creator put up there. This listener
  // reads one number and bails without a re-render unless the answer changed,
  // so the cost is a comparison per mousemove.
  const [nearTop, setNearTop] = useState(false);
  useEffect(() => {
    if (!isOwnPage) return;
    const onMove = (e: MouseEvent) => {
      const next = e.clientY <= TOP_ZONE_PX;
      setNearTop((prev) => (prev === next ? prev : next));
    };
    const onLeave = () => setNearTop(false);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [isOwnPage]);

  // A shortcut for the same toggle, because previewing is something you do
  // repeatedly while editing and the tab is a small target. Ignored while a
  // field has focus, so it can never eat a "." someone is typing.
  useEffect(() => {
    if (!isOwnPage) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "." || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      ) {
        return;
      }
      e.preventDefault();
      setCollapsed((c) => !c);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOwnPage]);

  // Keyboard handling for the account menu. It declares `role="menu"`, and a
  // menu that can only be operated with Tab is a menu in name only.
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const accountBtnRef = useRef<HTMLButtonElement | null>(null);
  // Only a menu opened FROM the keyboard takes focus. Stealing it on a mouse
  // click would drop a focus ring on a row nobody is aiming at, and leave the
  // page scrolled to wherever focus went when the menu closes.
  const focusFirstRef = useRef(false);

  useEffect(() => {
    if (!menu.open || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    menuPanelRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus();
  }, [menu.open]);

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      // The document-level handler does the closing; this is the other half of
      // it — focus goes back to the button the panel came from, instead of
      // being dropped on <body> when the panel unmounts under it.
      accountBtnRef.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(
      menuPanelRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    // -1 (focus still on the trigger) falls through to the first item going
    // down and the last going up, which is what both directions should do on
    // the first press.
    const next =
      e.key === "ArrowDown" ? (i >= last ? 0 : i + 1) : i <= 0 ? last : i - 1;
    items[next]?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    focusFirstRef.current = true;
    drawer.hide();
    menu.show();
  }

  // Every in-bar navigation goes through here: it honours the unsaved-changes
  // guard first, and only a click that will actually navigate arms the marker.
  function navClick(e: React.MouseEvent, href: string) {
    if (guard.dirty) {
      e.preventDefault();
      guard.onBlocked?.();
      return false;
    }
    setPendingHref(href);
    return true;
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      menu.hide();
      router.push("/");
      router.refresh();
    } catch {
      // Recover the button if sign-out fails (e.g. offline) instead of leaving
      // it stuck on "Signing out…" until a manual reload.
      setSigningOut(false);
    }
  }

  return (
    // The island is `fixed`, not `sticky`: it holds its place on screen and is
    // no longer part of any page's layout. A spacer in the root layout stands in
    // for the room it used to occupy (see --nav-space in globals.css).
    //
    // The full-width positioner is `pointer-events-none` so the gap beside and
    // below the pill isn't an invisible click-eater across the top of every
    // page; the pill and the drawer opt back in.
    <>
      <div
        // The hook globals.css hangs the "not your page, no bar" rule on.
        data-site-nav
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[45] px-[var(--nav-inset)] pt-[var(--nav-inset)] sm:px-4 lg:px-6",
          // `translate`, not `transform`, in the transition list: Tailwind v4
          // compiles -translate-y-* to the standalone `translate` property, and
          // naming `transform` here would transition nothing at all.
          // One curve and one duration for both directions — leaving and
          // arriving are the same move in reverse, and a bar that shot away on
          // an exit curve and came back on a different one read as two
          // unrelated animations. The tab is pinned to these same two numbers.
          //
          // --dur-reveal, the section-scale tier, because that is what this is:
          // a whole surface leaving the screen, not a control answering a
          // click. And `ease-in-out` rather than the house --ease-settle, which
          // is the only place in the app that asks for it — settle is shaped to
          // land things hard, so over a longer travel it front-loads the move
          // and then crawls the last few pixels. A bar that slides away and
          // slides back wants an even curve: gentle at both ends, cruising
          // through the middle, identical played forwards or backwards.
          "transition-[translate] duration-[var(--dur-reveal)] ease-[var(--ease-glide)]",
          // -translate-y-full is exactly the right distance: this element is
          // the inset plus the pill, i.e. everything there is to get off
          // screen — and the same distance the tab travels the other way.
          //
          // It does NOT fade on the way. It used to, and the bar dissolving
          // while the handle stayed solid broke the one illusion this whole
          // thing rests on: that the tab is the bar's own edge, being pulled
          // away with it. Two things travelling together have to look equally
          // real for the whole trip.
          barHidden && "pointer-events-none -translate-y-full",
        )}
        // Out of the tab order and off the a11y tree while it is parked, or a
        // keyboard user tabs into a bar nobody can see.
        {...(barHidden ? { inert: true } : {})}
      >
        <nav
          ref={mobileNavRef}
          // See footer.tsx: two unnamed <nav>s on a page are indistinguishable in a
          // landmark list. "Main" as a bare noun — AT appends "navigation" itself.
          aria-label="Main"
          // max-w matches the landing hero's own container, so the bar's ends line
          // up with the page content instead of nearly-but-not-quite.
          className="pointer-events-auto mx-auto w-full max-w-[100rem]"
        >
          <div
            className={cn(
              // `bg-card`, not `bg-background`: the pill has to read as a raised
              // surface even on the pages that are a flat --background all the way
              // up (the editor, settings), where a translucent background-coloured
              // bar would be invisible but for its hairline. Card sits one step up
              // the elevation ramp, which is exactly what this is.
              "flex h-[var(--nav-h)] items-center gap-1 rounded-full border border-border/70 bg-card/85 pr-2 pl-3 backdrop-blur-xl sm:gap-2 sm:pl-4",
              // Longhand list rather than `transition-shadow`, which would set
              // transition-property to box-shadow ALONE and silently drop the base
              // layer's background/border colour transitions (see globals.css).
              "transition-[box-shadow,background-color,border-color] duration-300",
              // Not while parked: the fade used to hide this, and without it
              // the pill's drop shadow — 12px down, 32px of blur — is the one
              // part of the bar that does NOT leave with it, and sits smeared
              // across the top edge of the page. The bar's own box is fully
              // off screen by then, so the shadow is all that would remain.
              scrolled && !barHidden && "nav-island border-border bg-card/95",
            )}
          >
            <Link
              href="/"
              onClick={(e) => navClick(e, "/")}
              className="flex shrink-0 items-center gap-2 rounded-full font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* The logo is deliberately static: no hover or press scale on
                  either the mark or the wordmark. It is the one piece of chrome
                  present on every screen, and the bar it sits in already moves
                  plenty (it floats, hides on scroll and swaps to the island
                  treatment). Leaving the logo still is what gives the rest of
                  that motion something fixed to read against. Its affordance is
                  the pointer and the focus ring, which is all a wordmark needs.
                  No `group` on the Link above for the same reason -- nothing in
                  here reacts to it any more. */}
              <StackedMark variant="brand" className="size-5" />
              <span>
                stacked<span className="brand-text">.</span>
              </span>
            </Link>

            {/* Inline page links — collapsed into the mobile drawer below `sm`.
              `relative`, because the marker below is positioned against this row
              and measures itself with offsetLeft, which is relative to the
              nearest positioned ancestor. */}
            <div
              ref={linkRowRef}
              className="relative ml-1 hidden items-center gap-0.5 sm:flex lg:ml-3"
            >
              {/* One marker for the whole row rather than a chip per link: the
                active state is a single object that MOVES between pages, which
                is a thing the eye can follow, where three independent chips
                fading in and out is a thing it can only notice afterwards. */}
              <span
                aria-hidden
                style={{
                  transform: `translateX(${marker.x}px)`,
                  width: marker.w,
                }}
                className={cn(
                  "pointer-events-none absolute top-0 bottom-0 left-0 rounded-full bg-foreground/[0.07]",
                  markerPlaced &&
                    (marker.snap ? "nav-marker-fade" : "nav-marker"),
                  marker.on ? "opacity-100" : "opacity-0",
                )}
              >
                {/* The brand-gradient underline rides along inside the marker.
                  `inset-x-3` matches the chips' own px-3, so it spans exactly
                  the label. `background-size` is overridden to the element's box:
                  `.brand-bg` paints at 200%, so a 16px dash only ever showed the
                  gradient's first stop and read as a flat tick in the wrong
                  colour — lilac today, amber back when the brand was a rainbow.
                  The override is what makes the dash the whole sweep. */}
                <span className="brand-bg absolute inset-x-3 bottom-[3px] h-[2px] rounded-full [background-size:100%_100%]" />
              </span>

              {links.map((link) => {
                const active = target === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    // The marker finds its target by this attribute, so the
                    // measurement follows the optimistic state automatically.
                    data-nav-target={active ? "" : undefined}
                    onClick={(e) => navClick(e, link.href)}
                    className={cn(
                      // `scale` in the transition list, not `transform`: Tailwind
                      // v4 compiles `scale-*` and `rotate-*` to the STANDALONE
                      // `scale:` / `rotate:` properties, so an arbitrary list
                      // naming `transform` transitions nothing and the press
                      // snaps. (The bare `transition-transform` utility is fine —
                      // it expands to transform, translate, scale, rotate. Only
                      // hand-written `transition-[…]` lists have this trap.)
                      "relative rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-[color,background-color,scale] duration-150 active:scale-[0.97] active:duration-75 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      active
                        ? // No hover fill on the active link: the marker is
                          // already sitting under it, and stacking a second
                          // translucent layer on top just makes it flicker.
                          "text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              {/* Hamburger — reveals the page links on mobile only. The two icons
                are stacked and cross-faded through a quarter-turn instead of
                swapped, so the control morphs rather than blinking; a hard swap
                on a 44px target under the user's own thumb is the most visible
                jump-cut in the whole bar. */}
              <button
                type="button"
                // Only one panel hangs off the bar at a time. Below `sm` the
                // drawer and the account menu occupy the same strip of screen,
                // and opening the second on top of the first left two floating
                // cards overlapping with no way to tell which owned the space.
                onClick={() => {
                  menu.hide();
                  drawer.toggle();
                }}
                aria-haspopup="menu"
                aria-expanded={drawer.shown}
                aria-controls="mobile-nav"
                aria-label={drawer.shown ? "Close menu" : "Open menu"}
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:hidden focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="relative block size-5">
                  <MenuIcon
                    className={cn(
                      "absolute inset-0 size-5 transition-[rotate,scale,opacity] duration-200",
                      drawer.shown
                        ? "rotate-90 scale-75 opacity-0"
                        : "rotate-0 scale-100 opacity-100",
                    )}
                  />
                  <CloseIcon
                    className={cn(
                      "absolute inset-0 size-5 transition-[rotate,scale,opacity] duration-200",
                      drawer.shown
                        ? "rotate-0 scale-100 opacity-100"
                        : "-rotate-90 scale-75 opacity-0",
                    )}
                  />
                </span>
              </button>

              {userEmail ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    ref={accountBtnRef}
                    onClick={() => {
                      drawer.hide();
                      menu.toggle();
                    }}
                    onKeyDown={onTriggerKeyDown}
                    aria-haspopup="menu"
                    aria-expanded={menu.shown}
                    aria-label="Account menu"
                    className={cn(
                      "group flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors sm:pr-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      menu.shown
                        ? "bg-foreground/[0.08]"
                        : "hover:bg-foreground/[0.06]",
                    )}
                  >
                    <Avatar src={avatarUrl} name={displayName ?? username} />
                    <span className="hidden max-w-[12rem] truncate font-mono text-muted-foreground text-sm sm:inline">
                      {username ? `@${username}` : userEmail}
                    </span>
                    <ChevronDownIcon
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        menu.shown && "rotate-180",
                      )}
                    />
                  </button>

                  {menu.open ? (
                    <div
                      role="menu"
                      aria-label="Account"
                      ref={menuPanelRef}
                      onKeyDown={onMenuKeyDown}
                      className={cn(
                        // `-right-2` cancels the pill's own pr-2 so the panel's
                        // right edge lines up with the BAR's edge, not with the
                        // avatar's — two floating cards stacked on one plumb line,
                        // the same relationship the mobile drawer has to the pill.
                        //
                        // `mt-4`, not mt-2: the trigger sits 8px above the pill's
                        // bottom, so a gap measured from the BUTTON put the panel's
                        // top edge flush against the bar with 0px between them, and
                        // the two cards read as one dented object. 16px from the
                        // button is 8px from the bar — the drawer's gap exactly.
                        "absolute -right-2 mt-4 w-72 origin-top-right rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground nav-island",
                        // `origin-top-right` is what makes the scale read as the
                        // panel growing out of the avatar it hangs from.
                        menu.shown ? "animate-menu-in" : "animate-menu-out",
                      )}
                    >
                      {/* Identity header. The avatar is repeated from the trigger
                        on purpose: at the moment the panel opens it is the only
                        thing tying this card to the button it came from, and it
                        is what makes a menu of generic verbs read as YOUR
                        account rather than the site's. */}
                      <div
                        className="animate-nav-row flex items-center gap-3 px-2 py-2"
                        style={rowDelay(0)}
                      >
                        <Avatar
                          src={avatarUrl}
                          name={displayName ?? username}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-mono font-medium text-sm">
                            {username ? `@${username}` : "No username yet"}
                          </p>
                          <p className="truncate text-muted-foreground text-xs">
                            {userEmail}
                          </p>
                        </div>
                      </div>

                      <div className="my-1.5 h-px bg-border" />

                      {isAdmin ? (
                        <Link
                          href="/admin"
                          role="menuitem"
                          style={rowDelay(1)}
                          onClick={() => menu.hide()}
                          className={MENU_ROW}
                        >
                          <ShieldIcon className={MENU_ICON} />
                          Admin
                        </Link>
                      ) : null}

                      <Link
                        href="/settings"
                        role="menuitem"
                        style={rowDelay(isAdmin ? 2 : 1)}
                        onClick={(e) => {
                          if (guard.dirty) {
                            e.preventDefault();
                            guard.onBlocked?.();
                            return;
                          }
                          menu.hide();
                        }}
                        className={MENU_ROW}
                      >
                        <GearIcon className={MENU_ICON} />
                        Settings
                      </Link>

                      {/* Sign out gets its own rule. It is the one row here that
                        undoes something, and it should never be the thing your
                        finger lands on while aiming for Settings. */}
                      <div className="my-1.5 h-px bg-border" />

                      <button
                        type="button"
                        role="menuitem"
                        style={rowDelay(isAdmin ? 3 : 2)}
                        onClick={() => {
                          if (guard.dirty) {
                            guard.onBlocked?.();
                            return;
                          }
                          signOut();
                        }}
                        disabled={signingOut}
                        className={cn(
                          MENU_ROW,
                          "text-danger hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        <SignOutIcon className="size-4 shrink-0 text-danger/70 transition-colors group-hover/row:text-danger" />
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  {/* Two distinct actions, as in the reference: a quiet Sign in
                    and the one primary CTA. Sign in drops into the drawer below
                    `sm`, where both of them plus the wordmark don't fit on a
                    360px screen without shrinking the CTA into a tap-hostile
                    pill.

                    "Sign in", not "Log in": the screen it opens is headed "Sign
                    in", the account menu's matching action is "Sign out", and
                    the CTA beside it is "Sign up". One verb for the whole family
                    means a visitor never has to wonder whether logging in and
                    signing in are two different things. */}
                  <Link
                    href="/login"
                    className="hidden h-9 items-center rounded-full px-4 font-medium text-muted-foreground text-sm transition-[color,background-color,scale] duration-150 active:scale-[0.97] active:duration-75 hover:bg-foreground/[0.06] hover:text-foreground sm:flex focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    // Same gesture as the landing page's primary button (see
                    // home-hero.tsx): 300ms ease-out, scale up on hover, press in
                    // on 75ms — a visitor's first press of a stacked button should
                    // feel the same wherever they meet it.
                    className="flex h-9 items-center rounded-full bg-primary px-4 font-semibold text-primary-foreground text-sm transition-transform duration-300 ease-out hover:scale-[1.03] active:scale-95 active:duration-75 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile drawer — its own floating card under the pill, shown only below
            `sm`. It matches the island rather than spanning the screen, so the
            bar still reads as one object when it's open, and it grows from
            `origin-top` so it unfolds out of the bar it belongs to. */}
          {drawer.open ? (
            <div
              id="mobile-nav"
              className={cn(
                "nav-island mt-2 origin-top rounded-2xl border border-border bg-card/90 p-1.5 backdrop-blur-xl sm:hidden",
                drawer.shown ? "animate-menu-in" : "animate-menu-out",
              )}
            >
              {links.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={rowDelay(i)}
                  onClick={(e) => {
                    if (navClick(e, link.href)) drawer.hide();
                  }}
                  className={cn(
                    "animate-nav-row block rounded-xl px-3.5 py-3 text-base transition-[color,background-color,scale] duration-150 active:scale-[0.99] active:duration-75 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    target === link.href
                      ? "bg-foreground/[0.07] font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {userEmail ? null : (
                <>
                  <div className="my-1.5 h-px bg-border" />
                  <Link
                    href="/login"
                    style={rowDelay(links.length)}
                    onClick={() => drawer.hide()}
                    className="animate-nav-row block rounded-xl px-3.5 py-3 text-base text-muted-foreground transition-[color,background-color,scale] duration-150 active:scale-[0.99] active:duration-75 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </nav>
      </div>

      {/* ONE tab, not two. It used to be a pair — a handle under the bar that
          disappeared and a handle at the top edge that faded in — and the swap
          was visible as a blink however it was timed, because two objects were
          pretending to be one.

          So it is a single element that never unmounts while you are on your
          own page, and hiding the bar just moves it: same distance, same
          duration, same curve as the bar itself, so the two travel locked
          together and the tab arrives at the top edge exactly as the bar
          finishes leaving through it. The chevron turns over on the way, which
          is what makes it read as the SAME handle now pointing the other way
          rather than as a different control that appeared.

          The travel is `translate` on a `fixed` element rather than two
          `top` values, because only a transform interpolates on the compositor:
          `top` would animate too, but on the layout thread and against the
          bar's transform, i.e. never quite in step with it. */}
      {isOwnPage ? (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={
            barHidden ? "Show the stacked bar" : "Hide the stacked bar"
          }
          title={barHidden ? "Show the bar (.)" : "Hide the bar (.)"}
          style={{
            // Parked: flush to the top edge. Otherwise: hanging off the bar's
            // bottom edge, which is the inset plus the pill — the exact
            // distance the bar travels, so both cover it in the same 500ms.
            translate: barHidden
              ? "-50% 0"
              : "-50% calc(var(--nav-inset) + var(--nav-h))",
          }}
          className={cn(
            NAV_TAB,
            "fixed top-0 left-1/2 z-[45]",
            // Travel is pinned to the bar's timing above (--dur-reveal,
            // ease-in-out); the fade runs on the fast clock instead. If the
            // travel numbers ever drift apart, the handle stops being the thing
            // the bar turned into and starts being a thing that chases it.
            "nav-tab-motion",
            "focus-visible:opacity-100",
            // FULL strength, and the same in both states. It was dimmed before
            // — quieter when parked, quieter again while hanging off the bar —
            // and that was the last thing making it read as a separate object:
            // it travels beside a bar at opacity 1, wearing the same card
            // background and the same hairline border, so at 50% it was
            // visibly made of thinner stuff than the thing it is supposed to
            // be an edge of. Two things moving together have to be the same
            // material.
            //
            // It also means the tab's appearance NEVER changes while it is in
            // flight: `nearTop` cannot flip during a click (the pointer is by
            // definition in the zone), so the only opacity change is the
            // reveal, which happens at a different moment entirely.
            nearTop
              ? "pointer-events-auto opacity-100"
              : // Invisible AND inert — an unseen button parked at the top
                // centre of someone's page would otherwise quietly eat clicks
                // aimed at whatever is under it.
                //
                // Except where there is no pointer to put in the hot zone.
                // Without this the control would not exist at all on a phone,
                // and parking the bar there would be a one-way door: the tab is
                // the only way back.
                "pointer-events-none opacity-0 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
          )}
        >
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-glide)]",
              !barHidden && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </>
  );
}
