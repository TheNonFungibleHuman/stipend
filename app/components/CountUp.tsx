'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  to: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  format?: (value: number) => string;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Counts to its value once, when it scrolls into view. */
export function CountUp({ to, suffix = '', prefix = '', durationMs = 1100, format }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setValue(to);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started.current) continue;
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs);
            setValue(to * easeOut(progress));
            if (progress < 1) requestAnimationFrame(tick);
            else setValue(to);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [to, durationMs]);

  const text = format ? format(value) : Math.round(value).toLocaleString('en-US');
  return (
    <span ref={ref}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
