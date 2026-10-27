import { useState } from 'react';
import { Icon } from './Icon';

/** Conceptual explainer only. It draws no balances, listings or transactions. */
const HOLDERS = [
  { l: 'A', cy: 85, w: 58, fill: '#2250d6', sx: 262 },
  { l: 'B', cy: 160, w: 40, fill: '#4f7be8', sx: 311 },
  { l: 'C', cy: 235, w: 28, fill: '#1b87a8', sx: 345 },
  { l: 'D', cy: 310, w: 20, fill: '#8fb0f0', sx: 369 },
];
const BAR_Y = 240;

const STEPS = [
  ['An operator offers shares in an asset.', 'Participants who take part hold portions of it.'],
  ['The asset earns money outside Portion.', 'Portion does not collect or see that income.'],
  ['The operator chooses to deposit some of it.', 'Only a deposit that is actually made is recorded.'],
  ['The deposit is split by shares staked at that moment.', 'A small fee is taken and shown on the record.'],
  ['Each holder decides when to claim.', 'Nothing is paid out until the holder acts.'],
] as const;

export function HeroStory() {
  const [paused, setPaused] = useState(false);
  return (
    <figure className={`hs${paused ? ' is-paused' : ''}`} aria-labelledby="hs-caption" style={{ margin: 0 }}>
      <div className="hs-top">
        <span className="pv-pill test">Illustration · not a live record</span>
        <button type="button" className="hs-pause" aria-pressed={paused} onClick={() => setPaused(p => !p)}>
          {paused ? 'Play animation' : 'Pause animation'}
        </button>
      </div>
      <div className="hs-stage">
        <svg viewBox="0 0 600 380" role="img" aria-label="Diagram: an asset earns money outside Portion, an operator deposits some of it onto a ledger, the deposit is split by share and each holder claims their part.">
          <g className="hs-anim a-asset">
            <path d="M22 205 56 135H138L104 205Z" fill="#2250d6" />
            <path d="M39 170H121M63 150 49 188M89 150 75 188M113 150 99 188" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2" />
            <path d="M63 205v22M95 205v22M45 227H113" stroke="#0c1f44" strokeWidth="4" strokeLinecap="round" />
            <text className="t" x="75" y="262" textAnchor="middle" fontSize="18">Asset</text>
            <text className="t2" x="75" y="283" textAnchor="middle" fontSize="13">run by an operator</text>
          </g>

          <g className="hs-anim a-path">
            <path d="M136 170H212" stroke="#2250d6" strokeWidth="3" strokeDasharray="6 6" fill="none" />
            <text className="t2" x="174" y="150" textAnchor="middle" fontSize="12.5">earned</text>
            <text className="t2" x="174" y="196" textAnchor="middle" fontSize="12.5">off-platform</text>
          </g>
          <g className="hs-coin hs-anim a-coin" style={{ ['--dx' as string]: '78px' }}>
            <circle cx="136" cy="170" r="10" fill="#f5b83d" stroke="#b87a00" strokeWidth="2" />
          </g>

          <rect x="214" y="60" width="182" height="260" rx="18" fill="#fff" stroke="#b4c5e2" strokeWidth="2" />
          <text className="t" x="234" y="92" fontSize="18">Ledger</text>
          <path d="M232 106H378" stroke="#d9e3f3" strokeWidth="2" />
          <g className="hs-anim a-row">
            <rect x="232" y="122" width="146" height="44" rx="10" fill="#e2f4ee" />
            <circle cx="253" cy="144" r="10" fill="#0e7a5c" />
            <path d="m248 144 4 4 7-8" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text className="t" x="271" y="149" fontSize="13.5" style={{ fill: '#0e7a5c' }}>Deposit recorded</text>
            <text className="t2" x="234" y="192" fontSize="12.5">fee shown on the record</text>
          </g>
          <text className="t2" x="234" y="228" fontSize="12.5">split by shares staked</text>
          <g className="hs-anim a-bar hs-bar">
            {HOLDERS.map((h, i) => <rect key={h.l} x={233 + HOLDERS.slice(0, i).reduce((s, x) => s + x.w, 0)} y={BAR_Y} width={h.w} height="20" fill={h.fill} stroke="#fff" strokeWidth="1.5" />)}
          </g>

          {HOLDERS.map((h, i) => (
            <g key={h.l}>
              <path d={`M396 190C416 190 414 ${h.cy} 432 ${h.cy}`} stroke="#b4c5e2" strokeWidth="2" fill="none" />
              <g className={`hs-anim a-claim${i ? ` c${i + 1}` : ''}`}>
                <rect x="432" y={h.cy - 14} width="84" height="28" rx="14" fill="#e5edfd" stroke="#2250d6" strokeWidth="1.5" />
                <text className="t" x="474" y={h.cy + 5} textAnchor="middle" fontSize="13" style={{ fill: '#1a42b5' }}>Claimed</text>
              </g>
              <g className="hs-anim a-holder">
                <circle cx="548" cy={h.cy} r="23" fill="#edf2fb" stroke="#b4c5e2" strokeWidth="2" />
                <text className="t" x="548" y={h.cy + 6} textAnchor="middle" fontSize="17">{h.l}</text>
              </g>
              <g className="hs-share hs-anim a-share" style={{ ['--dx' as string]: `${424 - h.sx}px`, ['--dy' as string]: `${h.cy - (BAR_Y + 10)}px` }}>
                <rect x={h.sx - 6} y={BAR_Y + 4} width="12" height="12" rx="3" fill={h.fill} stroke="#fff" strokeWidth="1.5" />
              </g>
            </g>
          ))}
        </svg>
      </div>
      <figcaption id="hs-caption" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        A step-by-step explanation of how a recorded deposit becomes claimable allocations.
      </figcaption>
      <ol className="hs-steps">
        {STEPS.map(([head, sub]) => <li key={head}><span><b>{head}</b><small>{sub}</small></span></li>)}
      </ol>
      <div className="hs-top" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
        <Icon name="shield" size={18} />
        <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Shapes and holders are symbolic. Amounts, holders and returns are never implied.</span>
      </div>
    </figure>
  );
}
