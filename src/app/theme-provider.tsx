"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// next-themes injects a tiny inline <script> to apply the saved theme before
// hydration (preventing a light/dark flash). It does its real work in the
// server-rendered HTML; when React 19 re-renders that same script on the client
// it's a no-op, but react-dom logs a dev-only "script tag while rendering"
// warning for it — repeatedly, on every navigation. It never fires in a
// production build. Wrap console.error to drop just that one benign message so
// the dev overlay isn't buried; every other error still passes through.
if (typeof window !== "undefined") {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes(
        "Encountered a script tag while rendering React component",
      )
    ) {
      return;
    }
    original(...args);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
