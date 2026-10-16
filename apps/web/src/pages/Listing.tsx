import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, parseUnits, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Wheel, WheelLegend } from '../components/Wheel';
import { Health } from '../components/Health';
import { Crumb, Empty, Spinner, useAsync } from '../components/ui';
import { ago, cadenceLabel, economics, pot, span, usd } from '../lib/format';
import type { ActivityRow } from '../lib/backend';

function RevenueChart({ rows }: { rows: { ts: number; amount: bigint; kind: 'revenue' | 'slash' }[] }) {
  if (!rows.length) return <p className="note">No revenue has been paid in yet.</p>;
  const last = rows.slice(-14);
  const max = Math.max(...last.map((r) => Number(r.amount)));
  const w = 640, h = 150, pad = 22, bw = Math.min(36, (w - pad * 2) / last.length - 6);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Revenue paid in over time">
      <line className="axis" x1={pad} x2={w - pad} y1={h - 24} y2={h - 24} />
      {last.map((r, i) => {
        const bh = Math.max(3, (Number(r.amount) / max) * (h - 56));
        const x = pad + i * ((w - pad * 2) / last.length) + 3;
        return (
          <g key={i}>
            <rect className={`bar ${r.kind}`} x={x} y={h - 24 - bh} width={bw} height={bh} rx="2"><title>{usd(r.amount)} {r.kind === 'slash' ? 'from a slashed bond' : 'revenue'}</title></rect>
            <text x={x + bw / 2} y={h - 8} textAnchor="middle">{new Date(r.ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
          </g>
        );
      })}
    </svg>
  );
}

function describe(a: ActivityRow): string {
  const d = a.data;
  switch (a.kind) {
    case 'Listed': return 'Listed on Portion';
    case 'Bought': return `Someone bought ${d.shares} share${Number(d.shares) === 1 ? '' : 's'} for ${usd(d.cost)}`;
    case 'RevenueDeposited': return `${usd(d.net)} of revenue paid in${d.qualifying === false ? ' (did not reset the cadence clock)' : ''}`;
    case 'Claimed': return `${usd(d.amount)} claimed by a holder`;
    case 'Slashed': return `Bond slashed: ${usd(d.toHolders)} went to holders`;
    case 'BondToppedUp': return `Operator topped up the bond to ${usd(d.newBond)}`;
    case 'SaleClosed': return 'Sale closed';
    case 'WoundDown': return 'Operator wound the listing down';
    case 'Staked': return `${d.amount ?? ''} shares staked`.trim();
    case 'Unstaked': return `${d.amount} shares unstaked`;
    default: return a.kind;
  }
}

export function ListingPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { backend, tick } = useApp();
  const { passport, balances } = usePassport();
  const { act, openPassport } = useRunner();

  const { data: l, error, loading } = useAsync(() => backend!.listing(id), [backend, id, tick]);
  const { data: rules } = useAsync(() => backend!.rules(), [backend]);
  const { data: terms } = useAsync(async () => (l ? backend!.docJson(l.docHash) : null), [l?.docHash]);
  const { data: docMeta } = useAsync(async () => (l ? backend!.docMeta(l.docHash) : null), [l?.docHash]);
  const { data: proof } = useAsync(async () => (l ? backend!.proof(id) : null), [l?.id, tick]);
  const { data: revenue } = useAsync(() => backend!.revenue(id), [id, tick]);
  const { data: activity } = useAsync(() => backend!.activity({ listing: id, limit: 12 }), [id, tick]);
  const { data: positions } = useAsync(async () => (passport ? backend!.positions(passport.address) : []), [passport?.address, tick]);

  const [shares, setShares] = useState(10);
  const [tab, setTab] = useState<'buy' | 'mine'>('buy');
  const [depositAmt, setDepositAmt] = useState('');
  const [topUpAmt, setTopUpAmt] = useState('');

  const me = positions?.find((p) => p.id === id);
  const isOperator = !!(passport && l && passport.h160.toLowerCase() === l.operator.toLowerCase());
  useEffect(() => { if (l) setShares((s) => Math.max(1, Math.min(s, Math.max(1, l.vault.forSale)))); }, [l?.vault.forSale]);
  useEffect(() => { if (l && !depositAmt) setDepositAmt((Number(l.minPerPeriod) / 1e6).toString()); }, [l?.id]);

  const e = useMemo(() => (l ? economics(l) : null), [l]);
  if (loading && !l) return <div className="empty"><Spinner /></div>;
  if (error || !l || !e) return <Empty title="We could not find that listing" action={<Link className="btn primary" to="/">Back to the market</Link>}>{error?.message}</Empty>;

  const staked = me?.staked ?? 0;
  const cost = BigInt(shares) * l.vault.salePrice;
  const fee = (cost * BigInt(rules?.saleFeeBps ?? 100)) / 10_000n;
  const canBuy = l.saleOpen && l.vault.forSale > 0;
  const nowSec = backend!.now();
  const toSlash = l.lastDepositAt + 2 * l.cadence - nowSec;

  return (
    <div>
      <Crumb to="/">← The market</Crumb>
      <div className="listing-grid" style={{ marginTop: 16 }}>
        <div>
          <img className="cover" src={backend!.docUrl(l.coverHash)} alt={`${l.name}`} />
          <div className="listing-head">
            <h1>{l.name}</h1>
            <p className="lede">{l.summary}</p>
          </div>

          <div className="facts">
            <div className="fact"><small>Price per share</small><b>{usd(l.vault.salePrice)}</b></div>
            <div className="fact"><small>Whole thing valued at</small><b>{usd(BigInt(Math.round(e.raise * 1e6)), 0)}</b></div>
            <div className="fact"><small>Promised minimum</small><b>{usd(l.minPerPeriod, 0)} {cadenceLabel(l.cadence)}</b></div>
            <div className="fact"><small>Yield at that minimum</small><b>{(e.apyAtFloor * 100).toFixed(0)}% a year</b></div>
            <div className="fact"><small>Paid so far</small><b>{usd(l.vault.totalRevenue)}</b></div>
            <div className="fact"><small>Operator bond</small><b>{usd(l.vault.bond)}</b></div>
          </div>

          <section className="block">
            <h2>Does the operator pay?</h2>
            <div style={{ maxWidth: 520 }}><Health l={l} /></div>
            <p className="note" style={{ marginTop: 12 }}>
              The operator must pay in at least {usd(l.minPerPeriod, 0)} {cadenceLabel(l.cadence)}. After {span(2 * l.cadence)} without a qualifying payment, anyone can slash the
              {' '}{usd(l.vault.bond)} bond and it is split between holders.{l.strikes > 0 && <> This operator has been slashed {l.strikes} time{l.strikes > 1 ? 's' : ''}.</>}
            </p>
            {l.health === 'Defaulted' && l.vault.bond > 0n && (
              <div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => act({ kind: 'slash', id })}>Slash the bond and pay holders</button></div>
            )}
            {l.health === 'Late' && <p className="note" style={{ marginTop: 10 }}>Slashable in {span(toSlash)} if no payment arrives.</p>}
          </section>

          <section className="block">
            <h2>Proof it exists</h2>
            <div className="proof">
              <div className={`proof-row ${docMeta ? '' : 'wait'}`}>
                <span className="tick">{docMeta ? '✓' : '…'}</span>
                <div><b>Terms and photo are stored on the chain</b><span>{docMeta ? `Block ${docMeta.block.toLocaleString()}, ${docMeta.size.toLocaleString()} bytes, hash checked. The chain keeps it for about ${docMeta.daysLeft.toFixed(1)} more days and a keeper renews it.` : 'Waiting for the document gateway to index it.'}</span></div>
                <a href={backend!.docUrl(l.docHash)} target="_blank" rel="noreferrer">raw</a>
              </div>
              <div className={`proof-row ${proof ? (proof.deedLocked ? '' : 'bad') : 'wait'}`}>
                <span className="tick">{proof ? (proof.deedLocked ? '✓' : '!') : '…'}</span>
                <div><b>The deed NFT is locked</b><span>{proof ? (proof.deedLocked ? 'The fractionalization pallet holds the deed. It can only come back if one account collects 100% of the shares.' : 'The deed is not held by the fractionalization pallet.') : 'Reading the native pallets…'}</span></div>
                <span>#{l.nftItem}</span>
              </div>
              <div className={`proof-row ${proof ? (proof.supplyMatches && proof.adminIsPallet ? '' : 'bad') : 'wait'}`}>
                <span className="tick">{proof ? (proof.supplyMatches && proof.adminIsPallet ? '✓' : '!') : '…'}</span>
                <div><b>The number of shares cannot change</b><span>{proof ? `${l.totalShares.toLocaleString()} shares exist and only the protocol can administer the asset, so no one can print more.` : 'Reading the share asset…'}</span></div>
                <span>asset {l.assetId}</span>
              </div>
              <div className="proof-row">
                <span className="tick">✓</span>
                <div><b>A bond backs the promise</b><span>{usd(l.vault.bond)} of pUSD is held by the contract and cannot be touched by the operator while the listing is active.</span></div>
              </div>
            </div>
            {proof?.notes?.length ? <p className="note" style={{ marginTop: 10 }}>{proof.notes.join(' ')}</p> : null}
          </section>

          {terms && (
            <section className="block">
              <h2>Terms</h2>
              <p className="terms">{terms.terms}</p>
              <p className="note" style={{ marginTop: 10 }}>{CATEGORIES[l.category]} · listed {ago(l.createdAt, nowSec)}.</p>
            </section>
          )}

          <section className="block">
            <h2>Revenue paid in</h2>
            <RevenueChart rows={revenue ?? []} />
          </section>

          <section className="block">
            <h2>Activity</h2>
            <ul className="activity">
              {(activity ?? []).map((a) => <li key={a.id}><span>{describe(a)}</span><time>{ago(a.ts, nowSec)}</time></li>)}
              {activity && !activity.length && <li><span>No activity indexed yet.</span></li>}
            </ul>
          </section>

          {isOperator && (
            <section className="block">
              <h2>You run this listing</h2>
              <div className="two">
                <div className="field">
                  <label htmlFor="dep">Pay revenue in (pUSD)</label>
                  <div className="input-affix"><input id="dep" type="number" min="0" step="any" value={depositAmt} onChange={(ev) => setDepositAmt(ev.target.value)} /><span>pUSD</span></div>
                  <p className="hint">At least {usd(l.minPerPeriod, 0)} resets the clock. Holders can claim immediately.</p>
                  <button className="btn primary sm" style={{ marginTop: 10 }} disabled={!depositAmt || Number(depositAmt) <= 0} onClick={() => act({ kind: 'deposit', id, amount: parseUnits(depositAmt, 6) })}>Pay in revenue</button>
                </div>
                <div className="field">
                  <label htmlFor="bond">Top up the bond (pUSD)</label>
                  <div className="input-affix"><input id="bond" type="number" min="0" step="any" value={topUpAmt} onChange={(ev) => setTopUpAmt(ev.target.value)} /><span>pUSD</span></div>
                  <p className="hint">Re-arms accountability after a slash.</p>
                  <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={!topUpAmt || Number(topUpAmt) <= 0} onClick={() => act({ kind: 'topUp', id, amount: parseUnits(topUpAmt, 6) })}>Top up</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {l.saleOpen && <button className="btn ghost sm" onClick={() => act({ kind: 'operator', fn: 'closeSale', id })}>Close the sale</button>}
                {l.health !== 'WoundDown' && <button className="btn ghost sm" onClick={() => act({ kind: 'operator', fn: 'windDown', id })}>Wind the listing down</button>}
                {l.health === 'WoundDown' && l.vault.bond > 0n && <button className="btn ghost sm" onClick={() => act({ kind: 'operator', fn: 'withdrawBond', id })}>Withdraw the bond</button>}
              </div>
            </section>
          )}
        </div>

        <aside className="panel" aria-label="Buy shares">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'buy'} onClick={() => setTab('buy')}>Buy</button>
            <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>Your shares{staked ? ` (${staked})` : ''}</button>
          </div>

          <div className="wheel-wrap">
            <Wheel total={l.totalShares} others={Math.max(0, l.vault.sold - staked)} owned={staked} selecting={tab === 'buy' && canBuy ? shares : 0} available={canBuy ? l.vault.forSale : 0} onSelect={tab === 'buy' && canBuy ? setShares : undefined} size={240} />
          </div>
          <WheelLegend items={[
            { cls: 'w-selecting', label: 'You are buying', value: tab === 'buy' && canBuy ? shares.toLocaleString() : '0' },
            { cls: 'w-owned', label: 'You own', value: staked.toLocaleString() },
            { cls: 'w-others', label: 'Held by others', value: Math.max(0, l.vault.sold - staked).toLocaleString() },
            { cls: 'w-available', label: 'Still for sale', value: (canBuy ? l.vault.forSale - (tab === 'buy' ? shares : 0) : 0).toLocaleString() },
            { cls: 'w-operator', label: 'Operator keeps', value: Math.max(0, l.totalShares - l.vault.sold - l.vault.forSale).toLocaleString() },
          ]} />

          {tab === 'buy' && (canBuy ? (
            <>
              <div className="stepper">
                <button aria-label="Fewer shares" onClick={() => setShares((s) => Math.max(1, s - 1))}>−</button>
                <input type="number" aria-label="Number of shares" min={1} max={l.vault.forSale} value={shares} onChange={(ev) => setShares(Math.max(1, Math.min(l.vault.forSale, Number(ev.target.value) || 1)))} />
                <button aria-label="More shares" onClick={() => setShares((s) => Math.min(l.vault.forSale, s + 1))}>+</button>
              </div>
              <div className="sum-line"><span>Earns at least</span><b>{usd(BigInt(Math.round(shares * e.perShareFloor * 1e6)))} {cadenceLabel(l.cadence)}</b></div>
              <div className="sum-line"><span>Portion fee ({(rules?.saleFeeBps ?? 100) / 100}%)</span><b>{usd(fee)}</b></div>
              <div className="total"><span>You pay</span><b>{usd(cost)}</b></div>
              {passport ? (
                <>
                  <button className="btn primary" onClick={() => act({ kind: 'buy', id, shares })}>Buy {shares} share{shares === 1 ? '' : 's'}</button>
                  {balances && <p className="hint" style={{ color: 'var(--ink-3)', fontSize: 13 }}>You have {usd(balances.pusd)} and {pot(balances.pot, 1)}.</p>}
                </>
              ) : <button className="btn primary" onClick={openPassport}>Open a Passport to buy</button>}
            </>
          ) : <p className="notice">{l.health === 'WoundDown' ? 'This listing has been wound down.' : 'The primary sale is closed. Shares may still trade on the native DEX.'}</p>)}

          {tab === 'mine' && (
            passport ? (
              <div className="mine">
                <div className="line"><span>Shares earning</span><b>{staked.toLocaleString()}</b></div>
                <div className="line"><span>Revenue waiting for you</span><b>{usd(me?.pending ?? 0n)}</b></div>
                <button className="btn primary" disabled={!me || me.pending === 0n} onClick={() => act({ kind: 'claim', ids: [id] })}>Claim {usd(me?.pending ?? 0n)}</button>
                {staked > 0 && <button className="btn ghost sm" onClick={() => act({ kind: 'unstake', id, amount: staked })}>Take my shares out of the vault</button>}
              </div>
            ) : <button className="btn primary" onClick={openPassport}>Open a Passport</button>
          )}
        </aside>
      </div>
    </div>
  );
}
