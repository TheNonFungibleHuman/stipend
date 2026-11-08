'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  children: React.ReactNode;
  delay?: number;
  as?: 'section' | 'div';
  className?: string;
}

/**
 * Sections arrive as you scroll. Motion here is a reading cue, not decoration:
 * it marks where one argument ends and the next starts. Disabled entirely under
 * prefers-reduced-motion by the stylesheet.
 */
export function Reveal({ children, delay = 0, as = 'section', className }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Content is visible in the server-rendered HTML and only gets hidden once
    // this component has actually mounted. A page that renders blank until JS
    // finishes is a page that fails in a screenshot, a slow browser, or a
    // broken bundle — and the reveal is a reading cue, not a requirement.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    setArmed(true);

    const fallback = setTimeout(() => setShown(true), 1500);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    observer.observe(node);
    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  const Tag = as as 'section' | 'div';
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={`reveal${armed && !shown ? ' is-armed' : ''}${shown ? ' is-in' : ''}${
        className ? ` ${className}` : ''
      }`}
      style={delay && shown ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
