"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usernameError, usernameUnavailableReason } from "~/lib/profiles";

/**
 * Whether a typed username is free. `idle` also covers "we couldn't tell" —
 * an unanswerable check must never read as a refusal.
 */
export type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason: string };

/** How long typing settles before we ask the server. */
const DEBOUNCE_MS = 400;

/**
 * The app's one username availability check.
 *
 * There were three copies of this — sign-up, the promo card, and settings —
 * with the same race guard, the same debounce and the same fail-open branch
 * written out three times. They are one question asked in three places, so they
 * are one hook now; the only thing a call site still decides is `enabled`, i.e.
 * whether there is anything worth asking about yet.
 *
 * `seqRef` is the load-bearing part, not the abort and not the clearTimeout:
 * every pending resolution captures its own sequence number and discards itself
 * once a newer check has started, which makes "a slow old answer overwrites a
 * fresh one" structurally impossible whatever the network does. A plain "does
 * the response still match the current text" comparison is NOT equivalent —
 * type "sam", then "same", then delete back to "sam", and the first slow answer
 * matches the current text again and is wrongly accepted.
 */
export function useUsernameAvailability(name: string, enabled = true) {
  const [avail, setAvail] = useState<Availability>({ state: "idle" });
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const trimmed = name.trim();

  useEffect(() => {
    // Retire any previous check FIRST, before any early return. Otherwise a
    // request already on the wire stays "current" and its answer lands on top
    // of whatever an early return just decided — type "aboutme", wait for the
    // request to go out, delete "me", and the reserved-word verdict for "about"
    // gets overwritten by a green "Available" from the in-flight "aboutme".
    const seq = ++seqRef.current;
    abortRef.current?.abort();
    abortRef.current = null;

    if (!enabled || !trimmed) {
      setAvail({ state: "idle" });
      return;
    }

    // Malformed and reserved names are knowable here and instantly, so say so
    // rather than spinning through a round-trip to be told the same thing.
    const local = usernameError(trimmed);
    if (local) {
      setAvail({ state: "unavailable", reason: local });
      return;
    }

    // Enter "checking" synchronously, BEFORE the debounce, so a stale green
    // verdict from the previous name can never sit beneath a name since edited.
    setAvail({ state: "checking" });

    const timer = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      usernameUnavailableReason(trimmed, ctrl.signal)
        .then((reason) => {
          if (seq !== seqRef.current) return;
          setAvail(
            reason ? { state: "unavailable", reason } : { state: "available" },
          );
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          // Fail OPEN. If the check can't run (offline, or the migration isn't
          // deployed) the flow must still be completable — `set_username` and
          // the sign-up trigger are the real authority and reject a taken name
          // with a clear message. Failing closed turns a blip into a hard gate.
          setAvail({ state: "idle" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, enabled]);

  /**
   * Ask once more, right now, skipping the debounce — for a submit that lands
   * while a check is still in flight. Returns the unavailability reason, or
   * null for "free, or we couldn't tell". Writes the verdict back under the
   * same sequence discipline, so it can't clobber a newer answer either.
   */
  const verify = useCallback(async (): Promise<string | null> => {
    const seq = ++seqRef.current;
    try {
      const reason = await usernameUnavailableReason(trimmed);
      if (seq === seqRef.current) {
        setAvail(
          reason ? { state: "unavailable", reason } : { state: "available" },
        );
      }
      return reason;
    } catch {
      // Unknown — let the server decide. But clear the spinner on the way out:
      // bumping `seq` above retired the in-flight debounced answer, so if this
      // lookup fails and nothing is written here, no answer is ever allowed to
      // replace the `checking` state and the dot pulses forever.
      if (seq === seqRef.current) setAvail({ state: "idle" });
      return null;
    }
  }, [trimmed]);

  return { avail, verify };
}
