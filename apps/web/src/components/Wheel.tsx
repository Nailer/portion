import { useRef, type PointerEvent } from 'react';

export interface WheelProps {
  total: number;
  /** other currently staked shares */
  others: number;
  /** the connected account's current earning stake */
  owned: number;
  /** shares you are about to buy */
  selecting: number;
  /** shares still for sale (including `selecting`) */
  available: number;
  size?: number;
  onSelect?: (n: number) => void;
  label?: string;
}

const TAU = Math.PI * 2;

function wedge(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-6) return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/** The portion wheel: the whole thing as a disc, your slice pulled out of it. Drag to choose how much to buy. */
export function Wheel({ total, others, owned, selecting, available, size = 280, onSelect, label }: WheelProps) {
  const ref = useRef<SVGSVGElement>(null);
  const R = size / 2 - 14;
  const c = size / 2;
  const operatorKept = Math.max(0, total - others - owned - available);
  const parts = [
    { key: 'op', v: operatorKept, cls: 'w-operator' },
    { key: 'others', v: others, cls: 'w-others' },
    { key: 'owned', v: owned, cls: 'w-owned' },
    { key: 'avail', v: Math.max(0, available - selecting), cls: 'w-available' },
    { key: 'sel', v: selecting, cls: 'w-selecting' },
  ];
  let acc = 0;
  const slices = parts.map((p) => {
    const a0 = (acc / total) * TAU;
    acc += p.v;
    const a1 = (acc / total) * TAU;
    return { ...p, a0, a1 };
  });

  const pick = (e: PointerEvent) => {
    if (!onSelect || available <= 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    let ang = Math.atan2(dx, -dy);
    if (ang < 0) ang += TAU;
    const n = Math.max(1, Math.min(available, Math.round((ang / TAU) * available)));
    onSelect(n);
  };

  return (
    <div className="wheel" style={{ width: size, height: size }}>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={onSelect ? 'slider' : 'img'}
        aria-label={label ?? 'Ownership of this listing'}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, available)}
        aria-valuenow={selecting}
        tabIndex={onSelect ? 0 : -1}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons === 1) pick(e); }}
        onKeyDown={(e) => {
          if (!onSelect) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onSelect(Math.min(available, selecting + Math.max(1, Math.round(available / 20))));
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onSelect(Math.max(1, selecting - Math.max(1, Math.round(available / 20))));
        }}
        style={{ touchAction: 'none', cursor: onSelect ? 'grab' : 'default' }}
      >
        {slices.filter((s) => s.v > 0).map((s) => {
          const mid = (s.a0 + s.a1) / 2;
          const lift = s.key === 'sel' ? 10 : s.key === 'owned' ? 5 : 0;
          return <path key={s.key} className={s.cls} d={wedge(c + Math.sin(mid) * lift, c - Math.cos(mid) * lift, R, s.a0, s.a1)} />;
        })}
        <circle cx={c} cy={c} r={R * 0.16} className="w-hub" />
      </svg>
    </div>
  );
}

export function WheelLegend({ items }: { items: { cls: string; label: string; value: string }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`swatch ${i.cls}`} />
          <span>{i.label}</span>
          <b>{i.value}</b>
        </li>
      ))}
    </ul>
  );
}
