"use client";

import { useRouter } from "next/navigation";
import { TimeRangePicker } from "~/components/time-range-picker";
import { adminHref, type RangeCurrent } from "~/lib/time-range";

/**
 * Admin's time-range control: the shared <TimeRangePicker> wired to the URL, so
 * the chosen window is shareable and survives a refresh. The page reads the URL
 * params server-side and re-runs the RPC.
 */
export function AdminRangePicker({ current }: { current: RangeCurrent }) {
  const router = useRouter();
  return (
    <TimeRangePicker
      current={current}
      onSelect={(next) => router.push(adminHref(next))}
    />
  );
}
