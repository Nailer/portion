import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, parseUnits, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Wheel, WheelLegend } from '../components/Wheel';
import { Health } from '../components/Health';
import { Crumb, Empty, Spinner, useAsync } from '../components/ui';
import { ago, cadenceLabel, economics, pot, span, usd } from '../lib/format';
import type { ActivityRow } from '../lib/backend';
import { api as serviceApi } from '../lib/backend';
import { receiptCsv, downloadCsv } from '../lib/receipt-export';
import { LiveBackend } from '../lib/live';
import { shareAllocation } from '../lib/share-allocation';
import { VerifiedPhoto } from '../components/VerifiedPhoto';
import { EscrowPanel } from '../components/EscrowPanel';

const safeAmount = (value: string) => { try { const n = parseUnits(value,6); return n > 0n ? n : 0n; } catch { return 0n; } };

function RevenueChart({ rows }: { rows: { ts: number; amount: bigint; kind: 'revenue' | 'slash' }[] }) {
  if (!rows.length) return <p className="note">No revenue receipts have been indexed. The contract total is shown above.</p>;
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
    case 'RevenueDeposited': return d.net === undefined || d.fee === undefined ? 'Deposit receipt amounts are unavailable' : `${usd(BigInt(d.net)+BigInt(d.fee),6)} deposited: ${usd(d.fee,6)} fee, ${usd(d.net,6)} allocated${d.qualifying === false ? ' (did not reset the cadence clock)' : ''}`;
    case 'Claimed': return `${usd(d.amount)} claimed by a holder`;
    case 'Slashed': return `Bond slashed: ${usd(d.toHolders)} went to holders`;
    case 'BondToppedUp': return `Operator added ${usd(d.amount ?? d.newBond)} to the bond`;
    case 'SaleClosed': return 'Sale closed';
    case 'WoundDown': return 'Operator wound the listing down';
    case 'Staked': return `${d.amount ?? ''} shares staked`.trim();
    case 'Unstaked': return `${d.amount} shares unstaked`;
    case 'Reviewed': return 'The named reviewer attested and opened the sale';
    case 'FundingSettled': return d.activated ? `Raise settled: target met with ${usd(d.raised)} held in escrow` : 'Raise settled: target missed, full refunds opened';
    case 'TrancheProposed': return `Operator requested tranche ${Number(d.tranche) + 1}`;
    case 'TrancheApproved': return `Reviewer approved tranche ${Number(d.tranche) + 1}; challenge window open`;
    case 'TrancheChallenged': return `A holder challenged tranche ${Number(d.tranche) + 1}`;
    case 'TrancheReleased': return `Tranche ${Number(d.tranche) + 1} released: ${usd(d.amount)}, of which ${usd(BigInt(d.amount) - BigInt(d.fee))} to the operator and ${usd(d.fee)} fee`;
    case 'TrancheLapsed': return `Tranche ${Number(d.tranche) + 1} failed (${d.lapses} of 2 allowed)`;
    case 'RefundOpened': return `Refunds opened: ${usd(d.refundPool)} returnable to buyers`;
    case 'Refunded': return `${usd(d.amount)} refunded to a buyer`;
    case 'Reserved': return `${usd(d.amount)} held in reserve for holders (nothing staked)`;
    case 'WindDownNoticed': return 'Operator gave notice of wind-down';
    case 'BondWithdrawn': return `Operator withdrew ${usd(d.amount)} of bond`;
    case 'OperatorProposed': return 'A new operator was proposed';
    case 'OperatorChanged': return 'The operator changed';
    default: return a.kind;
  }
}

function ClosedOffer({ l, soldOut, onMine }: { l: ListingView; soldOut: boolean; onMine: () => void }) {
  const wound = l.health === 'WoundDown', defaulted = l.health === 'Defaulted';
  const phase = l.escrow?.phase;
  if (phase === 'Pending' || phase === 'Refunding' || phase === 'Funding') return <div className="closed-offer" role="status">
    <h3>{phase === 'Pending' ? 'Not open yet: waiting for independent review' : phase === 'Refunding' ? 'This raise is refunding' : l.vault.forSale === 0 ? 'Sold out: ready to settle' : 'The funding deadline has passed'}</h3>
    <p>{phase === 'Pending' ? 'The named reviewer must attest before anyone can buy.' : phase === 'Refunding' ? 'Buyers can take back their share of the money the operator never received.' : l.vault.forSale === 0 ? 'Every offered share was bought, so the target is met. Anyone can now settle the raise to activate the listing.' : 'Anyone can now settle the raise: it either activates or opens full refunds.'}</p>
    <ul><li><button type="button" className="link-btn" onClick={onMine}>Check your own shares, claims and refunds</button></li></ul>
  </div>;
  const offered = l.escrow ? l.vault.sold : l.totalShares;
  const title = wound ? 'This listing has been wound down' : defaulted ? 'New funding is blocked: the operator is in default' : soldOut ? `Sold out: all ${offered.toLocaleString()} offered shares were bought` : l.escrow ? 'Funded: the raise met its target' : 'The primary sale is closed';
  const why = wound ? 'The operator closed it. Allocations already earned stay claimable by their holders.' : defaulted ? 'Two payment periods passed without a qualifying deposit. Holders can still claim, and anyone may submit a bond recovery.' : soldOut ? 'This offer cannot take another purchase. Nothing is broken; the purchase button only exists while shares remain.' : l.escrow ? 'The deadline passed with the funding target met. Unsold shares went back to the operator.' : 'The operator closed the sale before every share was bought.';
  return <div className="closed-offer" role="status">
    <h3>{title}</h3><p>{why}</p>
    <ul>
      <li><a href="#activity">See exactly what was bought, deposited and claimed</a></li>
      <li><button type="button" className="link-btn" onClick={onMine}>Check your own shares and claims</button></li>
      {!l.escrow && <li><Link to="/evidence">See how a fresh purchase could be tested</Link></li>}
    </ul>
    <small>No market exists for these shares yet. Trading needs someone to fund a pool, and Portion does not promise liquidity.</small>
  </div>;
}

export function ListingPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { backend, tick } = useApp();
  const { passport, balances } = usePassport();
  const { act, openPassport } = useRunner();
  const [searchParams] = useSearchParams();
  const [shares, setShares] = useState(() => {
    const requested = Number(searchParams.get('shares') ?? 10);
    return Number.isSafeInteger(requested) && requested > 0 ? requested : 10;
  });
  const [tab, setTab] = useState<'buy' | 'trade' | 'mine'>('buy');
  const [dexIn, setDexIn] = useState('');
  const [sellN, setSellN] = useState('1');
  const [seedShares, setSeedShares] = useState('');
  const [seedPusd, setSeedPusd] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [topUpAmt, setTopUpAmt] = useState('');

  const { data: l, error, loading } = useAsync(() => backend!.listing(id), [backend, id, tick]);
  const { data: rules } = useAsync(() => backend!.rules(), [backend]);
  const { data: terms } = useAsync(async () => (l ? backend!.docJson(l.docHash) : null), [l?.docHash]);
  const { data: docMeta } = useAsync(async () => (l ? backend!.docMeta(l.docHash) : null), [l?.docHash]);
  const { data: proof } = useAsync(async () => (l ? backend!.proof(id) : null), [l?.id, tick]);
  const { data: revenue } = useAsync(() => backend!.revenue(id), [id, tick]);
  const sandbox = backend!.mode === 'sandbox';
  const { data: coverage } = useAsync(async () => sandbox ? null : serviceApi<{ contractTotal: string; publishedTotal: string; missingAllocation: string | null; totalsMatch: boolean; inconsistent: boolean; finalizedBlock: number }>(`/api/listings/${id}/history`), [id, tick]);
  const { data: activity } = useAsync(() => backend!.activity({ listing: id, limit: 12 }), [id, tick]);
  const { data: pool } = useAsync(async () => (l ? backend!.pool(l) : null), [l?.id, tick]);
  const { data: spare } = useAsync(async () => (l && passport ? backend!.shareBalance(l.assetId, passport.address) : 0n), [l?.id, passport?.address, tick]);
  const dexInUnits = safeAmount(dexIn);
  const { data: buyQuote } = useAsync(async () => (l && pool && dexInUnits > 0n ? backend!.quote(l, 'buy', dexInUnits) : null), [l?.id, pool?.shares, pool?.pusd, dexIn]);
  const { data: sellQuote } = useAsync(async () => (l && pool && Number(sellN) > 0 ? backend!.quote(l, 'sell', BigInt(Math.floor(Number(sellN)))) : null), [l?.id, pool?.shares, pool?.pusd, sellN]);
  const { data: positions, error: positionsError, loading: positionsLoading } = useAsync(async () => (passport ? backend!.positions(passport.address) : []), [passport?.address, tick]);


  const me = positions?.find((p) => p.id === id);
  const isOperator = !!(passport && l && passport.h160.toLowerCase() === l.operator.toLowerCase());
  useEffect(() => { if (l) setShares((s) => Math.max(1, Math.min(s, Math.max(1, l.vault.forSale)))); }, [l?.vault.forSale]);
  useEffect(() => { if (l && !depositAmt) setDepositAmt((Number(l.minPerPeriod) / 1e6).toString()); }, [l?.id]);

  const e = useMemo(() => (l ? economics(l) : null), [l]);
  if (loading && !l) return <div className="empty"><Spinner /></div>;
  if (error || !l || !e) return <Empty title="We could not find that listing" action={<Link className="btn primary" to="/">Back to the market</Link>}>{error?.message}</Empty>;

  if (!rules) return <Empty title="Verified contract fees unavailable">Try again once contract rules can be read.</Empty>;
  if (passport && (positionsLoading || positionsError || !positions)) return <Empty title="Your positions are unavailable">Wait for a verified account reading before buying or claiming.</Empty>;
  const staked = me?.staked ?? 0;
  const cost = BigInt(shares) * l.vault.salePrice;
  const fee = (cost * BigInt(rules.saleFeeBps)) / 10_000n;
  const canBuy = l.saleOpen && l.vault.forSale > 0 && l.health !== 'Defaulted' && l.health !== 'WoundDown';
  const allocation = shareAllocation(l,staked);
  const nowSec = backend!.now();
  const toSlash = l.lastDepositAt + 2 * l.cadence - nowSec;

  return (
    <div>
      <Crumb to="/">← Overview</Crumb>
      <div className="listing-grid" style={{ marginTop: 16 }}>
        <div>
          <VerifiedPhoto className="cover" hash={l.coverHash} alt={`${l.name}, operator-supplied image`} eager/>
          <div className="listing-head">
            <h1>{l.name}</h1>
            <p className="lede">{l.summary}</p>
          </div>

          <div className="facts">
            <div className="fact"><small>Price per share</small><b>{usd(l.vault.salePrice)}</b></div>
            <div className="fact"><small>Total share price reference</small><b>{usd(l.vault.salePrice*BigInt(l.totalShares),6)}</b></div>
            <div className="fact"><small>Operator’s stated minimum deposit</small><b>{usd(l.minPerPeriod,6)} {cadenceLabel(l.cadence)}</b></div>
            <div className="fact"><small>Fee on deposited revenue</small><b>{(rules.revenueFeeBps) / 100}%</b></div>
            <div className="fact"><small>Cumulative allocation (deposits and bond recovery)</small><b>{usd(l.vault.totalRevenue,6)}</b></div>
            <div className="fact"><small>Operator bond</small><b>{usd(l.vault.bond)}</b></div>
          </div>

          {l.escrow && <EscrowPanel l={{ ...l, escrow: l.escrow }} me={passport?.h160.toLowerCase() ?? null} now={nowSec} act={act} refundable={me?.refundable ?? 0n} stake={staked} sample={sandbox} />}

          <section className="block">
            <h2>Is the operator depositing?</h2>
            <div style={{ maxWidth: 520 }}><Health l={l} /></div>
            <p className="note" style={{ marginTop: 12 }}>
              The operator has committed to deposit at least {usd(l.minPerPeriod,6)} {cadenceLabel(l.cadence)}; this is a commitment recorded in the listing, not a guaranteed income. After {span(2 * l.cadence)} without a qualifying payment, anyone can slash the
              {' '}{usd(l.vault.bond,6)} bond. The caller receives {(rules.slashTipBps / 100)}% of the bond; the remainder goes to current stakers, {l.escrow ? 'or is held in reserve for holders if nobody is staked' : 'or the treasury if nobody is staked'}. Slashing requires a transaction; no automatic keeper is promised.{l.strikes !== null && l.strikes > 0 && <> This operator has been slashed {l.strikes} time{l.strikes > 1 ? 's' : ''}.</>}
            </p>
            {l.health === 'Defaulted' && l.vault.bond > 0n && (
              <div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => act({ kind: 'slash', id })}>Review bond recovery</button></div>
            )}
            {l.health === 'Late' && <p className="note" style={{ marginTop: 10 }}>Slashable in {span(toSlash)} if no payment arrives.</p>}
          </section>

          {sandbox ? <section className="block">
            <h2>Sandbox listing checks</h2>
            <div className="proof">
              <div className="proof-row"><span className="tick">✓</span><div><b>Terms and photo match their hashes</b><span>The document and image shown here are checked against the hash the contract holds, as on the live app. In the sandbox they are stored in this browser, not on Portaldot.</span></div></div>
              <div className="proof-row wait"><span className="tick">~</span><div><b>Deed and share supply are simulated</b><span>On Portaldot a deed NFT is locked and fractionalized into {l.totalShares.toLocaleString()} native shares. The sandbox mints a stand-in token at the same address instead.</span></div><span>asset {l.assetId}</span></div>
              <div className={`proof-row${l.vault.bond > 0n ? '' : ' bad'}`}><span className="tick">{l.vault.bond > 0n ? '✓' : '!'}</span><div><b>{l.vault.bond > 0n ? 'Operator bond held' : 'No operator bond remains'}</b><span>{usd(l.vault.bond)} of sandbox pUSD is held by the Core v2 contract.</span></div></div>
            </div>
          </section> : <section className="block">
            <h2>Onchain listing checks</h2>
            <div className="proof">
              <div className={`proof-row ${docMeta ? '' : 'wait'}`}>
                <span className="tick">{docMeta ? '✓' : '…'}</span>
                <div><b>Terms document storage record</b><span>{docMeta ? `Block ${docMeta.block.toLocaleString()}, ${docMeta.size.toLocaleString()} bytes, hash checked. Recorded retention remaining: ${docMeta.blocksLeft.toLocaleString()} blocks. Keeper renewal is not guaranteed.` : 'Waiting for the document gateway to index it.'}</span></div>
                <a href={backend!.docUrl(l.docHash)} target="_blank" rel="noreferrer">raw</a>
              </div>
              <div className={`proof-row ${proof ? (proof.deedLocked ? '' : 'bad') : 'wait'}`}>
                <span className="tick">{proof ? (proof.deedLocked ? '✓' : '!') : '…'}</span>
                <div><b>The deed NFT is locked in place</b><span>{proof ? (proof.deedLocked ? 'The deed still exists and its transfers are switched off by the fractionalization pallet. It is only released if one account collects 100% of the shares.' : 'The deed is not locked: it is missing or can still be transferred.') : 'Reading the native pallets…'}</span></div>
                <span>#{l.nftItem}</span>
              </div>
              <div className={`proof-row ${proof ? (proof.supplyMatches && proof.rolesControlled ? '' : 'bad') : 'wait'}`}>
                <span className="tick">{proof ? (proof.supplyMatches && proof.rolesControlled ? '✓' : '!') : '…'}</span>
                <div><b>Share supply and asset permissions</b><span>{proof ? proof.supplyMatches && proof.rolesControlled ? `${l.totalShares.toLocaleString()} shares match the listing; asset permissions are held by the fractionalization pallet.` : 'Supply or asset permissions did not pass verification. Review the findings below.' : 'Reading the share asset…'}</span></div>
                <span>asset {l.assetId}</span>
              </div>
              <div className={`proof-row${l.vault.bond > 0n ? '' : ' bad'}`}>
                <span className="tick">{l.vault.bond > 0n ? '✓' : '!'}</span>
                <div><b>{l.vault.bond > 0n ? 'Operator bond held' : 'No operator bond remains'}</b><span>{usd(l.vault.bond)} of pUSD is held by the contract and cannot be touched by the operator while the listing is active.</span></div>
              </div>
            </div>
            {proof?.notes?.length ? <p className="note" style={{ marginTop: 10 }}>{proof.notes.join(' ')}</p> : null}
          </section>}

          {terms && (
            <section className="block">
              <h2>Terms</h2>
              <p className="terms">{terms.terms}</p>
              <p className="note" style={{ marginTop: 10 }}>{CATEGORIES[l.category]} · listed {ago(l.createdAt, nowSec)}.</p>
            </section>
          )}

          <section className="block">
            <h2>Revenue paid in</h2>
            {revenue ? <RevenueChart rows={revenue} /> : <p className="notice">Revenue history unavailable. No payment totals are inferred.</p>}
            {sandbox ? <p className="notice">In the sandbox this chart reads every deposit and slash event from the simulated chain, so the history is complete.</p> : <p className="notice">Published receipts are partial history. {coverage ? coverage.inconsistent ? 'Receipt totals differ from the contract; do not rely on the chart until reconciled.' : <>Receipts account for {usd(coverage.publishedTotal)} of {usd(coverage.contractTotal)} in cumulative contract allocations at finalized block {coverage.finalizedBlock.toLocaleString()}. {coverage.totalsMatch ? 'Matching totals do not prove complete history.' : `${usd(coverage.missingAllocation)} has no published allocation receipt yet.`}</> : 'Receipt coverage could not be reconciled. Missing records do not mean zero income.'}</p>}
          </section>

          <section className="block" id="activity">
            <h2>Activity</h2>
            {!activity && <p className="notice">Activity history unavailable.</p>}
            <ul className="activity">
              {(activity ?? []).map((a) => <li key={a.id}><span>{describe(a)}</span><time>{ago(a.ts, nowSec)}</time></li>)}
              {activity && !activity.length && <li><span>No activity indexed yet.</span></li>}
            </ul>
            <button className="btn ghost sm" disabled={!activity?.length} onClick={() => downloadCsv(`portion-asset-${id}-partial-receipts.csv`,receiptCsv(activity ?? [],backend!.chainLabel,backend instanceof LiveBackend ? backend.deployment?.pusdAssetId : undefined))}>Export displayed receipts (CSV)</button><p className="note">Exact event units, timestamps and partial-history labels are included. This exports the displayed receipt selection, not full business accounts.</p>
          </section>

          {isOperator && (
            <section className="block">
              <h2>You run this listing</h2><p className="notice" style={{marginBottom:20}}>Manage all your assets and payments in the <Link to="/operator">operator workspace →</Link></p>
              <div className="two">
                <div className="field">
                  <label htmlFor="dep">Pay revenue in (pUSD)</label>
                  <div className="input-affix"><input id="dep" type="number" min="0" step="any" value={depositAmt} onChange={(ev) => setDepositAmt(ev.target.value)} /><span>pUSD</span></div>
                  <p className="hint">At least {usd(l.minPerPeriod,6)} resets the clock. Holders can claim immediately.</p>
                  <button className="btn primary sm" style={{ marginTop: 10 }} disabled={safeAmount(depositAmt) === 0n} onClick={() => act({ kind: 'deposit', id, amount: safeAmount(depositAmt) })}>Pay in revenue</button>
                </div>
                <div className="field">
                  <label htmlFor="bond">Top up the bond (pUSD)</label>
                  <div className="input-affix"><input id="bond" type="number" min="0" step="any" value={topUpAmt} onChange={(ev) => setTopUpAmt(ev.target.value)} /><span>pUSD</span></div>
                  <p className="hint">Re-arms accountability after a slash.</p>
                  <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={safeAmount(topUpAmt) === 0n || l.health === 'WoundDown'} onClick={() => act({ kind: 'topUp', id, amount: safeAmount(topUpAmt) })}>Top up</button>
                </div>
              </div>
              <p className="notice" style={{ margin: '16px 0' }}>Closing is blocked while any earning shares remain staked. An overdue bond must be settled first. Unstaking returns shares, not the money paid to buy them.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {l.saleOpen && !l.escrow && <button className="btn ghost sm" onClick={() => act({ kind: 'operator', fn: 'closeSale', id })}>Close the sale</button>}
                {l.escrow?.activated && !l.escrow.windDownAfter && l.health !== 'WoundDown' && <button className="btn ghost sm" onClick={() => act({ kind: 'escrow', fn: 'noticeWindDown', id })}>Give two periods’ notice of wind-down</button>}
                {l.escrow && l.escrow.windDownAfter > 0 && l.health !== 'WoundDown' && <p className="note">Wind-down possible {nowSec < l.escrow.windDownAfter ? `in ${span(l.escrow.windDownAfter - nowSec)}` : 'now'}, if no shares are staked and no money is held for holders.</p>}
                {l.health !== 'WoundDown' && (!l.escrow || l.escrow.windDownAfter > 0) && <button className="btn ghost sm" disabled={l.vault.totalStaked > 0n || (l.health === 'Defaulted' && l.vault.bond > 0n) || (!!l.escrow && (nowSec < l.escrow.windDownAfter || l.escrow.reserve > 0n))} onClick={() => act({ kind: 'operator', fn: 'windDown', id })}>Wind the listing down</button>}
                {l.health === 'WoundDown' && l.vault.bond > 0n && <><p className="note">Bond withdrawal opens {span(2*l.cadence)} after winding down. {nowSec < l.closedAt + 2*l.cadence ? `${span(l.closedAt + 2*l.cadence-nowSec)} remains.` : 'The waiting period has elapsed.'}</p><button className="btn ghost sm" disabled={nowSec < l.closedAt + 2*l.cadence} onClick={() => act({ kind: 'operator', fn: 'withdrawBond', id })}>Review bond withdrawal</button></>}
              </div>
            </section>
          )}
        </div>

        <aside className="panel" aria-label="Buy shares">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'buy'} onClick={() => setTab('buy')}>Buy</button>
            <button role="tab" aria-selected={tab === 'trade'} onClick={() => setTab('trade')}>Trade</button>
            <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>Yours{staked ? ` (${staked})` : ''}</button>
          </div>

          {allocation ? <><div className="wheel-wrap">
            <Wheel total={l.totalShares} others={allocation.otherStake} owned={staked} selecting={tab === 'buy' && canBuy ? shares : 0} available={allocation.available} onSelect={tab === 'buy' && canBuy ? setShares : undefined} size={240} label="Current earning stake and sale inventory" />
          </div>
          <WheelLegend items={[
            { cls: 'w-selecting', label: 'You are buying', value: tab === 'buy' && canBuy ? shares.toLocaleString() : '0' },
            { cls: 'w-owned', label: 'Your earning stake', value: passport ? staked.toLocaleString() : 'Connect to read' },
            { cls: 'w-others', label: passport ? 'Other earning stake' : 'All earning stake', value: allocation.otherStake.toLocaleString() },
            { cls: 'w-available', label: !canBuy && allocation.available ? 'Offer inventory (funding blocked)' : 'Offer inventory', value: (allocation.available - (tab === 'buy' && canBuy ? shares : 0)).toLocaleString() },
            { cls: 'w-operator', label: 'Outside earning pool and offer', value: allocation.outside.toLocaleString() },
          ]} /></> : <p className="notice">Share counts could not be reconciled. No ownership chart is inferred.</p>}

          {tab === 'buy' && (canBuy ? (
            <>
              <div className="stepper">
                <button aria-label="Fewer shares" onClick={() => setShares((s) => Math.max(1, s - 1))}>−</button>
                <input type="number" aria-label="Number of shares" min={1} max={l.vault.forSale} value={shares} onChange={(ev) => setShares(Math.max(1, Math.min(l.vault.forSale, Math.floor(Number(ev.target.value)) || 1)))} />
                <button aria-label="More shares" onClick={() => setShares((s) => Math.min(l.vault.forSale, s + 1))}>+</button>
              </div>
              <div className="sum-line"><span>If all shares are staked</span><b>{usd(l.minPerPeriod * BigInt(10000 - (rules.revenueFeeBps)) / 10000n * BigInt(shares) / BigInt(l.totalShares))} {cadenceLabel(l.cadence)}</b></div>
              <div className="sum-line"><span>{l.escrow ? `Portion fee (${rules.saleFeeBps / 100}%), taken only from released tranches` : `Included Portion fee (${(rules.saleFeeBps) / 100}%)`}</span><b>{usd(fee)}</b></div>
              <div className="total"><span>You pay</span><b>{usd(cost)}</b></div><p className="hint" style={{fontSize:11,color:'var(--ink-3)',lineHeight:1.8}}>The payment illustration assumes the stated deposit and every share staked. Actual allocations use the shares staked when money arrives. Income and principal repayment are not guaranteed.</p>
              {l.escrow
                ? <p className="notice">Your payment is held by the contract. It reaches the operator only in tranches the named reviewer approves, after a challenge window. If fewer than {l.escrow.minSold.toLocaleString()} shares sell by the deadline, you can take it all back. Released money cannot be recovered, and the bond is limited recovery, not insurance.</p>
                : <p className="notice">The sale payment goes directly to the operator after the fee. Portion does not currently hold it for approved spending. The bond provides limited recovery, not insurance of your purchase.</p>}
              {passport ? (
                <>
                  <button className="btn primary" onClick={() => act({ kind: 'buy', id, shares })}>Buy {shares} share{shares === 1 ? '' : 's'}</button>
                  {balances && <p className="hint" style={{ color: 'var(--ink-3)', fontSize: 13 }}>You have {usd(balances.pusd)}{sandbox ? ' of sandbox money' : <> and {pot(balances.pot, 1)}</>}.</p>}
                </>
              ) : <button className="btn primary" onClick={openPassport}>Connect wallet to buy</button>}
            </>
          ) : <ClosedOffer l={l} soldOut={l.vault.sold === l.totalShares || (l.saleOpen || !!l.escrow) && l.vault.forSale === 0} onMine={() => setTab('mine')} />)}

          {tab === 'trade' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {pool ? (
                <>
                  <div className="sum-line"><span>Market price</span><b>{usd(pool.price)} per share</b></div>
                  <div className="sum-line"><span>Pool depth</span><b>{pool.shares.toString()} shares · {usd(pool.pusd,6)}</b></div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="dexin">Spend</label>
                    <div className="input-affix"><input id="dexin" type="number" min="0" step="any" value={dexIn} onChange={(ev) => setDexIn(ev.target.value)} /><span>pUSD</span></div>
                    <p className="hint">{buyQuote ? `Buys about ${buyQuote.toString()} share${buyQuote === 1n ? '' : 's'} and stakes them so they earn.` : 'Enter an amount.'}</p>
                  </div>
                  <button className="btn primary" disabled={!buyQuote || buyQuote < 1n} onClick={() => (passport ? act({ kind: 'dexBuy', id, pusdIn: dexInUnits }) : openPassport())}>Buy on the market and start earning</button>
                  {spare !== undefined && spare > 0n && (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="selln">Sell shares you hold outside the vault ({spare.toString()})</label>
                      <input id="selln" type="number" min="1" max={Number(spare)} value={sellN} onChange={(ev) => setSellN(ev.target.value)} />
                      <p className="hint">{sellQuote ? `You would receive about ${usd(sellQuote)}.` : ''}</p>
                      <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => act({ kind: 'dexSell', id, sharesIn: Math.floor(Number(sellN)) })}>Sell</button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="notice">No one has opened a market for this listing yet, so shares can only be bought from the operator.</p>
                  {isOperator && (
                    <>
                      <div className="two">
                        <div className="field" style={{ marginBottom: 0 }}><label htmlFor="ss">Shares</label><input id="ss" type="number" min="1" value={seedShares} onChange={(ev) => setSeedShares(ev.target.value)} /></div>
                        <div className="field" style={{ marginBottom: 0 }}><label htmlFor="sp">pUSD</label><input id="sp" type="number" min="0" step="any" value={seedPusd || String(Number(seedShares) * e.price)} onChange={(ev) => setSeedPusd(ev.target.value)} /></div>
                      </div>
                      <p className="hint" style={{ color: 'var(--ink-3)', fontSize: 13 }}>Opening price: {usd(BigInt(Math.round((Number(seedPusd || Number(seedShares) * e.price) / Math.max(1, Number(seedShares))) * 1e6)))} per share. You need this many unstaked shares in your Passport.</p>
                      <button className="btn primary" onClick={() => act({ kind: 'dexSeed', id, shares: Math.floor(Number(seedShares)), pusd: safeAmount(String(seedPusd || Number(seedShares) * e.price)) })}>Open the market</button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'mine' && (
            passport ? (
              <div className="mine">
                <div className="line"><span>Shares earning</span><b>{staked.toLocaleString()}</b></div>
                <div className="line"><span>Shares in your wallet (not earning)</span><b>{spare === undefined ? 'Unavailable' : spare.toString()}</b></div>
                <div className="line"><span>Deposited income ready to claim</span><b>{usd(me?.pending ?? 0n,6)}</b></div>
                <button className="btn primary" disabled={!me || me.pending === 0n} onClick={() => act({ kind: 'claim', ids: [id] })}>Claim {usd(me?.pending ?? 0n,6)}</button>
                {staked > 0 && <button className="btn ghost sm" onClick={() => act({ kind: 'unstake', id, amount: staked })}>Take my shares out of the vault</button>}
                {spare !== undefined && spare > 0n && spare <= BigInt(Number.MAX_SAFE_INTEGER) && <button className="btn ghost sm" disabled={l.health === 'Defaulted' || l.health === 'WoundDown'} onClick={() => act({kind:'stake',id,amount:Number(spare)})}>Stake wallet shares for future deposits</button>}
                <p className="note">Unstaking returns share tokens, not your purchase payment. Existing claimable allocations remain yours after unstaking; new stake does not receive earlier deposits.</p>
              </div>
            ) : <button className="btn primary" onClick={openPassport}>Connect an account</button>
          )}
        </aside>
      </div>
    </div>
  );
}
