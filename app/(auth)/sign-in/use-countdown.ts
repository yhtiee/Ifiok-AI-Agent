"use client";

import { useEffect, useState } from "react";

/** Seconds a student waits before asking for another emailed code. */
export const RESEND_SECONDS = 60;

/** Seconds left until `seconds` after `from`. Remount (new `key`) on every resend. */
export function useCountdown(from: number, seconds: number) {
  const [left, setLeft] = useState(() => Math.max(0, seconds - Math.floor((Date.now() - from) / 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - from) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [from, seconds]);
  return left;
}
