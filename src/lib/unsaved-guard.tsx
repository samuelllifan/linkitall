"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type GuardContext = {
  dirty: boolean;
  setDirty: (v: boolean) => void;
  onBlocked: () => void;
  setOnBlocked: (cb: (() => void) | null) => void;
};

const Ctx = createContext<GuardContext>({
  dirty: false,
  setDirty: () => {},
  onBlocked: () => {},
  setOnBlocked: () => {},
});

export function UnsavedGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  const cbRef = useRef<(() => void) | null>(null);

  const onBlocked = useCallback(() => {
    cbRef.current?.();
  }, []);

  const setOnBlocked = useCallback((cb: (() => void) | null) => {
    cbRef.current = cb;
  }, []);

  const value = useMemo(
    () => ({ dirty, setDirty, onBlocked, setOnBlocked }),
    [dirty, onBlocked, setOnBlocked],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnsavedGuard() {
  return useContext(Ctx);
}
