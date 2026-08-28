"use client";

/**
 * The "has the visitor entered yet?" gate.
 *
 * When a page has the click-to-enter splash turned on, nothing behind the
 * splash should make noise until the visitor actually clicks through. The
 * overlay publishes that state here and `MusicPlayer` reads it, so autoplay
 * waits for the real entrance instead of racing it.
 *
 * The default is `true` (no gate) so a page without a splash — and any player
 * rendered outside an overlay, e.g. in the editor — behaves exactly as before.
 */

import { createContext, type ReactNode, useContext } from "react";

const EnteredContext = createContext(true);

export function EntryGate({
  entered,
  children,
}: {
  entered: boolean;
  children: ReactNode;
}) {
  return (
    <EnteredContext.Provider value={entered}>
      {children}
    </EnteredContext.Provider>
  );
}

/** `false` only while a click-to-enter splash is still covering the page. */
export function useEntered() {
  return useContext(EnteredContext);
}
