import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({ children, onClose, labelledBy, className = '', closeDisabled = false, focusKey = '' }: {
  children: ReactNode; onClose(): void; labelledBy: string; className?: string; closeDisabled?: boolean; focusKey?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closing = useRef({ onClose, closeDisabled });
  closing.current = { onClose, closeDisabled };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closing.current.closeDisabled) { event.preventDefault(); closing.current.onClose(); }
      if (event.key !== 'Tab' || !panel.current) return;
      const elements = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')).filter(element => element.getClientRects().length);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); panel.current.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, []);
  useEffect(() => { panel.current?.focus(); }, [focusKey]);
  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}>
    <div ref={panel} tabIndex={-1} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
  </div>;
}
