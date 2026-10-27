import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Reveal [data-reveal] blocks as they enter the viewport. Content stays visible without script or observer support. */
export function useReveal() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    if (reduced() || typeof IntersectionObserver === 'undefined') { root.classList.remove('reveal-ready'); return; }
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!targets.length) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        // Anything already scrolled past (anchor jumps, back navigation) is shown at once.
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) { (entry.target as HTMLElement).classList.add('is-in'); observer.unobserve(entry.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    root.classList.add('reveal-ready');
    targets.forEach(el => observer.observe(el));
    // Safety net: never leave content hidden if the observer is throttled.
    const timer = window.setTimeout(() => targets.forEach(el => el.classList.add('is-in')), 2500);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [pathname]);
}

/** Router navigation: start new pages at the top, honour #anchors, and move focus for keyboard and screen-reader users. */
export function useRouteScroll(mainId: string) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const main = document.getElementById(mainId);
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) { requestAnimationFrame(() => target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })); return; }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    main?.focus({ preventScroll: true });
  }, [pathname, hash, mainId]);
}
