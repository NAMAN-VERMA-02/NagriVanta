import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll reveal for a container: its direct children with [data-reveal] fade up once, staggered.
 * Content is visible by default; the hidden state is only applied when JS can reveal it.
 */
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced() || !('IntersectionObserver' in window)) return undefined;
    const items = [...root.querySelectorAll('[data-reveal]')];
    items.forEach((el, i) => { el.classList.add('reveal-ready'); el.style.transitionDelay = `${Math.min(i % 6, 5) * 70}ms`; });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Counts up to `value` once it changes; instant when reduced motion is preferred. */
export function useCountUp(value, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value == null || Number.isNaN(Number(value))) return undefined;
    if (reduced()) { setN(value); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - (1 - p) ** 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}
