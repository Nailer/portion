import { Link } from 'react-router-dom';
import type { ListingView } from '@portion/sdk';
import { CATEGORIES } from '@portion/sdk/constants';
import { useApp } from '../state/app';
import { Health } from '../components/Health';
import { HeroStory } from '../components/HeroStory';
import { Icon } from '../components/Icon';
import { Spinner, useAsync } from '../components/ui';
import { cadenceLabel, economics, usd } from '../lib/format';
import { RECORDED } from '../lib/evidence';
import { useReveal } from '../lib/scroll';
import { VerifiedPhoto } from '../components/VerifiedPhoto';

export function ListingRow({ l }: { l: ListingView }) {
  const e = economics(l);
  return <Link to={`/listing/${l.id}`} className="asset-card">
    <div className={`asset-card-art category-${l.category}`}><VerifiedPhoto hash={l.coverHash} alt={`${l.name}, operator-supplied image`} className="asset-verified-photo"/><span className="asset-category">{CATEGORIES[l.category] ?? 'Other'}</span><span className="asset-open"><Icon name="external" size={17}/></span></div>
    <div className="asset-card-body"><div className="asset-card-top"><span>ASSET {l.id}</span><Health l={l} compact/></div><h3>{l.name}</h3><p className="asset-summary">{l.summary}</p>
      <div className="asset-figures"><div><small>Per share</small><b>{usd(l.vault.salePrice)}</b></div><div><small>Expected deposit schedule</small><b>{cadenceLabel(l.cadence)}</b></div></div>
      <div className="funding-label"><span>{l.saleOpen ? `${Math.round(e.soldPct * 100)}% of current offer funded` : `${l.vault.sold.toLocaleString()} shares purchased`}</span><b>{!l.saleOpen ? l.vault.sold === l.totalShares ? 'Sold out' : 'Sale closed' : l.vault.forSale === 0 ? 'Sold out' : l.health === 'Defaulted' || l.health === 'WoundDown' ? 'Funding unavailable' : `${l.vault.forSale.toLocaleString()} available`}</b></div>{l.saleOpen && <div className="funded"><i style={{width:`${Math.min(100,e.soldPct * 100)}%`}}/></div>}
      <div className="asset-card-bottom"><span>Operator bond <b>{usd(l.vault.bond,6)}</b></span><strong>View record <Icon name="arrow" size={15}/></strong></div>
    </div>
  </Link>;
}

const FLOW = [
  { h: 'The operator describes the asset and its terms', p: 'Name, photo, share count, price, the deposit schedule the operator expects to keep, and a bond. The terms document is hashed and stored so it cannot be quietly changed.',
    who: 'Operator', money: 'No money moves. The operator posts a bond of at least 5% of the offered shares’ value.', gap: 'A hash proves the document is unchanged, not that the equipment exists or is owned.' },
  { h: 'Participants take shares', p: 'A participant reviews the record, then approves a purchase in their own wallet. Purchased shares start earning when staked.',
    who: 'Participant', money: 'The payment goes straight to the operator, less a 1% fee to Portion. Portion does not hold it.', gap: 'Nothing restricts how the operator spends it. This is not escrow.' },
  { h: 'The asset earns money outside Portion', p: 'Customers pay the operator by whatever means they already use. Portion neither collects nor observes this income.',
    who: 'Operator', money: 'Held by the operator, off-platform.', gap: 'Revenue is self-reported. Nothing forces an operator to deposit what the asset earned.' },
  { h: 'The operator deposits, and the contract splits it', p: 'Each deposit is divided among the shares staked at that moment, after a 0.5% fee that is shown on the record.',
    who: 'Operator', money: 'Deposited funds are held by the contract until holders claim them.', gap: 'Only money actually deposited is allocated. Missing deposits are visible as missed periods, not recovered.' },
  { h: 'Holders claim, and defaults are visible', p: 'Holders claim when they choose. After two missed periods anyone can submit a slash that shares the operator’s bond with current stakers.',
    who: 'Participant', money: 'Claims pay from the contract. A slash pays out the bond, which is small compared with the offer.', gap: 'The bond is limited recovery, not insurance. There is no automatic keeper, and unstaking returns shares, not purchase money.' },
] as const;

export function Home() {
  const { backend, status, reconnect, sandbox, tick } = useApp();
  useReveal();
  const { data, loading, error } = useAsync(() => backend?.deployed ? backend.listings() : Promise.resolve([] as ListingView[]), [backend, tick]);
  const { data: rules } = useAsync(async () => backend?.deployed ? backend.rules() : null, [backend]);
  const listings = data ?? [];
  const totalPaid = listings.reduce((sum, l) => sum + l.vault.totalRevenue, 0n);
  const open = listings.filter(l => l.saleOpen && l.vault.forSale > 0).length;
  return <div className="pv">
    <section className="pv-hero" aria-labelledby="home-title">
      <div>
        <span className="pv-eyebrow">Revenue sharing for productive assets</span>
        <h1 id="home-title">Share what an asset earns, with <em>a record everyone can check.</em></h1>
        <p className="pv-lede">Portion lets an operator of solar installations, vehicle fleets or machinery deposit revenue, split it among participants by their shares, and let each person claim their part. {sandbox ? 'In this sandbox every step runs on the Core v2 contract code inside your browser, with pretend money. Nothing here reaches Portaldot.' : 'Every step is a visible transaction on the Portaldot test network.'}</p>
        <div className="pv-actions">
          <a className="btn primary" href="#how">Walk through a payout <Icon name="arrow" size={18}/></a>
          {sandbox ? <Link className="btn ghost" to="/sandbox">Open the demo guide</Link> : <Link className="btn ghost" to="/evidence">Inspect the evidence</Link>}
        </div>
        <div className="pv-hero-note" role="note"><Icon name="shield" size={20}/><span><b>Test tokens only.</b> No real money moves and no return is promised. Portion records deposits an operator chooses to make; it does not collect income or verify that equipment exists.</span></div>
      </div>
      <div data-reveal><HeroStory/></div>
    </section>

    <section aria-labelledby="proof-title" data-reveal>
      <h2 id="proof-title" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>What is working today</h2>
      {sandbox && <p className="notice" role="note">These four facts describe the live Core v1 deployment on Portaldot, not the sandbox. The sandbox runs Core v2, which holds purchase money in escrow and releases it in reviewer-approved tranches. Core v2 is not deployed or audited.</p>}
      <div className="pv-proof">
        <div><small>Contract</small><b>Live on testnet</b><span>Core deployed at block {RECORDED.core.block.toLocaleString()}; address checked against the chain before any action is enabled.</span></div>
        <div><small>Recorded lifecycle</small><b>Offer to claim</b><span>Create, buy, deposit, claim and unstake finalized. One development account played both roles.</span></div>
        <div><small>Fees, read from the contract</small><b>{rules ? `${rules.saleFeeBps / 100}% sale · ${rules.revenueFeeBps / 100}% deposit` : status === 'offline' ? 'Unavailable' : 'Reading…'}</b><span>{rules ? 'Shown before any transaction is approved.' : 'Not displayed until read from the chain.'}</span></div>
        <div><small>Held for spending control</small><b>None</b><span>Purchase money goes directly to the operator. Controlled release is designed, not deployed.</span></div>
      </div>
      <p className="pv-proof-foot">Evidence, not endorsement: these are test transactions. <Link to="/evidence">Open the full evidence record</Link> or read <a href="https://github.com/Nailer/portion/blob/main/docs/FUNDING-PROTECTION.md" target="_blank" rel="noreferrer">what the money protections do and do not cover</a>.</p>
    </section>

    <section id="how" className="pv-section" aria-labelledby="how-title">
      <span className="pv-eyebrow" data-reveal>How a payout works</span>
      <h2 id="how-title" className="pv-title" data-reveal>Five steps, and who controls the money at each one.</h2>
      <p className="pv-lede" data-reveal>A shared record is only as honest as its weakest step. Each step below says who acts, where the money sits, and what Portion cannot guarantee.</p>
      <ol className="pv-flow">
        {FLOW.map(s => <li key={s.h} data-reveal>
          <div><h3>{s.h}</h3><p>{s.p}</p></div>
          <dl className="pv-who">
            <div><dt>Who acts</dt><dd>{s.who}</dd></div>
            <div><dt>The money</dt><dd>{s.money}</dd></div>
            <div className="gap"><dt>Not guaranteed</dt><dd>{s.gap}</dd></div>
          </dl>
        </li>)}
      </ol>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="limits-title">
      <span className="pv-eyebrow" data-reveal>Safeguards, plainly</span>
      <h2 id="limits-title" className="pv-title" data-reveal>What the software enforces, and what it cannot.</h2>
      <div className="pv-limits">
        <article className="pv-limit is-enforced" data-reveal><h3><i/>Enforced by the contract</h3><ul>
          <li>Offered shares and the operator bond are held by the contract.</li>
          <li>Deposits are split by the shares staked at that moment, with the fee shown.</li>
          <li>Only a holder can claim their allocation.</li>
          <li>New purchases stop once an operator is in default.</li>
        </ul></article>
        <article className="pv-limit is-trust" data-reveal><h3><i/>Depends on people and records</h3><ul>
          <li>That the equipment exists and the operator may use it.</li>
          <li>That the operator deposits what the asset really earned.</li>
          <li>That the operator spends purchase money as described.</li>
          <li>Someone submitting a slash when payments stop.</li>
        </ul></article>
        <article className="pv-limit is-missing" data-reveal><h3><i/>Not provided yet</h3><ul>
          <li>Escrowed purchase money or milestone-based release.</li>
          <li>Independent verification of assets or revenue.</li>
          <li>Principal protection, guaranteed resale or a live secondary market.</li>
          <li>Automatic payouts, keepers or a legal opinion.</li>
        </ul></article>
      </div>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="roles-title">
      <span className="pv-eyebrow" data-reveal>Choose your role</span>
      <h2 id="roles-title" className="pv-title" data-reveal>Where to go next.</h2>
      <div className="pv-roles">
        <Link className="pv-role" to="/operator" data-reveal><span className="pv-eyebrow">I run an asset</span><h3>Prepare an offer and manage deposits.</h3><p>Draft terms, photo and bond without a wallet, then publish and record deposits from one workspace.</p><small>Publishing needs a funded Portaldot wallet.</small><strong>Open the workspace <Icon name="arrow" size={16}/></strong></Link>
        <Link className="pv-role" to="/portfolio" data-reveal style={{ ['--d' as string]: '80ms' }}><span className="pv-eyebrow">I take part</span><h3>See your shares and what you can claim.</h3><p>Read your stake and claimable amount from the contract. Review the cost and risks before approving anything.</p><small>Reading needs a connected wallet; browsing does not.</small><strong>Open your portfolio <Icon name="arrow" size={16}/></strong></Link>
        <Link className="pv-role" to="/evidence" data-reveal style={{ ['--d' as string]: '160ms' }}><span className="pv-eyebrow">I am reviewing Portion</span><h3>Check the contract and the receipts.</h3><p>Addresses, transaction hashes, what each proves and what remains unproven, with the hackathon criteria mapped to evidence.</p><small>No wallet or tokens needed.</small><strong>Open the evidence <Icon name="arrow" size={16}/></strong></Link>
      </div>
    </section>

    <section id="market" className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="record-title">
      <div className="pv-record-head" data-reveal>
        <div><span className="pv-eyebrow">{sandbox ? 'The sandbox record' : 'The live record'}</span><h2 id="record-title" className="pv-title">{sandbox ? 'Simulated in your browser.' : 'Published on the testnet.'}</h2></div>
        <span className="pv-pill test" aria-live="polite">{status === 'connecting' ? 'CHECKING TESTNET' : status === 'offline' ? 'TESTNET UNAVAILABLE' : !backend?.deployed ? 'CONTRACT UNAVAILABLE' : `${listings.length} asset${listings.length === 1 ? '' : 's'} · ${open} open for purchase`}</span>
      </div>
      {status === 'connecting' && <div className="pv-state" role="status"><Spinner/><h3>Connecting to Portaldot</h3><p>Waiting for a real network response. The public test endpoint often takes 10 seconds or more, and nothing is shown until it answers.</p><Link className="btn ghost" to="/network">Network status</Link></div>}
      {status === 'offline' && <div className="pv-state"><h3>The testnet is currently unavailable.</h3><p>Live data cannot be read, and no substitute records are shown. The evidence page still lists the recorded transactions.</p><div className="pv-actions" style={{ marginTop: 0 }}><button className="btn primary" onClick={reconnect}>Retry connection</button><Link className="btn ghost" to="/evidence">Open recorded evidence</Link></div></div>}
      {status === 'ready' && loading && !data?.length && <div className="pv-state"><Spinner label="Loading assets"/></div>}
      {error && <div className="pv-state" role="alert"><h3>We couldn’t load the record.</h3><p>{error.message}</p><Link className="btn ghost" to="/network">Network status</Link></div>}
      {!!listings.length && <div className="pv-assets">{listings.map(l => <ListingRow key={l.id} l={l}/>)}</div>}
      {status === 'ready' && !!listings.length && open === 0 && !sandbox && <div className="pv-state" style={{ borderStyle: 'solid' }}><h3>No offer is open for purchase right now.</h3><p>The only published asset is a disclosed protocol test whose 100 shares were all bought during the recorded run. It still shows the whole lifecycle: terms, native backing checks, a deposit, a claim and the fee. A fresh purchase needs a new offer, which costs real test tokens to publish.</p><div className="pv-actions" style={{ marginTop: 0 }}><Link className="btn primary" to={`/listing/${listings[0].id}`}>Read the full record</Link><Link className="btn ghost" to="/evidence">How to test a purchase</Link></div></div>}
      {status === 'ready' && !loading && !error && !listings.length && <div className="pv-state"><Icon name="layers" size={32}/><h3>{backend?.deployed ? 'No listings are published.' : 'Asset funding is not live for this connection.'}</h3><p>{backend?.deployed ? 'Published listings appear here after on-chain creation.' : 'A configured contract could not be verified. Inspect the network status before proceeding.'}</p>{backend?.deployed ? <Link className="btn primary" to="/create">Prepare an offer</Link> : <Link className="btn primary" to="/network">Network status</Link>}</div>}
      {!!listings.length && sandbox && <p className="pv-proof-foot">Sandbox: fictional assets, pretend money, the real Core v2 contract code running in this browser. Nothing here is on Portaldot. <Link to="/sandbox">Demo guide</Link></p>}
      {!!listings.length && !sandbox && <p className="pv-proof-foot">Read from the testnet. Cumulative test revenue allocated across listings: {usd(totalPaid)}. Test tokens have no monetary value.</p>}
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} data-reveal aria-labelledby="close-title">
      <div className="pv-close">
        <div><h2 id="close-title">See it work before you trust it.</h2><p>Everything here runs against a public test network. Read the record, then try your own preparation. Nothing you do carries financial risk.</p></div>
        <div className="stack">{sandbox ? <Link className="btn primary" to="/sandbox">Open the demo guide <Icon name="arrow" size={18}/></Link> : <Link className="btn primary" to="/evidence">Inspect the evidence <Icon name="arrow" size={18}/></Link>}<Link className="btn ghost" to="/create">Prepare an offer</Link></div>
      </div>
    </section>
  </div>;
}
