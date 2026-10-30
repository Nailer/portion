import { Link } from 'react-router-dom';
import type { ListingView } from '@portion/sdk';
import { CATEGORIES } from '@portion/sdk/constants';
import { useApp } from '../state/app';
import { Health } from '../components/Health';
import { NetworkState } from '../components/NetworkState';
import { HeroStory } from '../components/HeroStory';
import { Icon } from '../components/Icon';
import { Spinner, useAsync } from '../components/ui';
import { cadenceLabel, economics, usd } from '../lib/format';
import { RECORDED } from '../lib/evidence';
import { useReveal } from '../lib/scroll';
import { isDevelopmentTest, offerStatus } from '../lib/offer-status';
import { VerifiedPhoto } from '../components/VerifiedPhoto';

export function ListingRow({ l }: { l: ListingView }) {
  const e = economics(l);
  const offer = offerStatus(l);
  return <Link to={`/listing/${l.id}`} className="asset-card">
    <div className={`asset-card-art category-${l.category}`}><VerifiedPhoto hash={l.coverHash} alt={`${l.name}, operator-supplied image`} className="asset-verified-photo"/><span className="asset-category">{CATEGORIES[l.category] ?? 'Other'}</span>{isDevelopmentTest(l.id) && <span className="asset-test">Development test</span>}</div>
    <div className="asset-card-body"><div className="asset-card-top"><span>ASSET {l.id}</span><Health l={l} compact/></div><h3>{l.name}</h3><p className="asset-summary">{l.summary}</p>
      <div className="asset-figures"><div><small>Per share</small><b>{usd(l.vault.salePrice)}</b></div><div><small>Operator’s deposit schedule</small><b>{cadenceLabel(l.cadence)}</b></div></div>
      <div className="funding-label"><span>{l.saleOpen ? `${Math.round(e.soldPct * 100)}% of current offer funded` : `${l.vault.sold.toLocaleString()} shares purchased`}</span><b data-offer={offer.key}>{offer.label}</b></div>{l.saleOpen && <div className="funded"><i style={{width:`${Math.min(100,e.soldPct * 100)}%`}}/></div>}
      <div className="asset-card-bottom"><span>Operator bond <b>{usd(l.vault.bond,6)}</b></span><strong>{offer.canBuy ? 'View and buy' : 'View asset'} <Icon name="arrow" size={15}/></strong></div>
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
  const { backend, status, sandbox, tick } = useApp();
  useReveal();
  const { data, loading, error } = useAsync(() => backend?.deployed ? backend.listings() : Promise.resolve([] as ListingView[]), [backend, tick]);
  const { data: rules } = useAsync(async () => backend?.deployed ? backend.rules() : null, [backend]);
  const listings = data ?? [];
  const totalPaid = listings.reduce((sum, l) => sum + l.vault.totalRevenue, 0n);
  const open = listings.filter(l => offerStatus(l).canBuy).length;
  const preview = [...listings].sort((a, b) => Number(offerStatus(b).canBuy) - Number(offerStatus(a).canBuy)).slice(0, 3);
  return <div className="pv">
    <section className="pv-hero" aria-labelledby="home-title">
      <div>
        <span className="pv-eyebrow">For equipment operators and their backers</span>
        <h1 id="home-title">Fund equipment that earns, and <em>share its revenue on a record anyone can check.</em></h1>
        <p className="pv-lede">An operator of solar panels, vehicles or machinery offers shares. Participants buy them, and each revenue deposit is split by shares and claimed from a public contract. {sandbox ? 'In this sandbox every step runs on the Core v2 contract code inside your browser, with pretend money. Nothing here reaches Portaldot.' : 'Browse without a wallet.'}</p>
        <div className="pv-actions">
          <Link className="btn primary" to="/assets">Explore assets <Icon name="arrow" size={18}/></Link>
          <Link className="btn ghost" to="/create">Create an offer</Link>
        </div>
        <div className="pv-hero-note" role="note"><Icon name="shield" size={20}/><span><b>Test tokens only, on the Portaldot test network.</b> No real money moves and no return is promised. Portion records deposits an operator chooses to make; it does not collect income or verify that equipment exists.</span></div>
      </div>
      <div data-reveal><HeroStory/></div>
    </section>

    <section id="market" className="pv-section home-assets" aria-labelledby="record-title">
      <div className="pv-record-head">
        <div><span className="pv-eyebrow">{sandbox ? 'Sandbox · fictional assets' : 'Published on the testnet'}</span><h2 id="record-title" className="pv-title">{sandbox ? 'Simulated in your browser.' : 'What you can look at now.'}</h2></div>
        <span className="pv-pill test" aria-live="polite">{status === 'connecting' ? 'CHECKING TESTNET' : status === 'offline' ? 'TESTNET UNAVAILABLE' : !backend?.deployed ? 'CONTRACT UNAVAILABLE' : `${listings.length} asset${listings.length === 1 ? '' : 's'} · ${open} open for purchase`}</span>
      </div>
      <NetworkState what="published assets"/>
      {status === 'ready' && loading && !data?.length && <div className="pv-state"><Spinner label="Loading assets"/></div>}
      {error && <div className="pv-state" role="alert"><h3>We couldn’t load the assets.</h3><p>{error.message}</p></div>}
      {!!preview.length && <div className="pv-assets">{preview.map(l => <ListingRow key={l.id} l={l}/>)}</div>}
      {status === 'ready' && !!listings.length && open === 0 && !sandbox && <p className="assets-note"><b>No offer is open for purchase right now.</b> The only published asset is a disclosed development test, and all its shares were bought during the recorded run. You can read its full record, or <Link to="/create">create an offer</Link>.</p>}
      {status === 'ready' && backend?.deployed && !loading && !error && !listings.length && <div className="pv-state"><Icon name="layers" size={32}/><h3>No assets are published yet.</h3><p>Published assets appear here after on-chain creation.</p><Link className="btn primary" to="/create">Create an offer</Link></div>}
      {!!listings.length && <p className="pv-proof-foot">{sandbox ? <>Sandbox: fictional assets, pretend money, the real Core v2 contract code running in this browser. Nothing here is on Portaldot. <Link to="/sandbox">Demo guide</Link></> : <>Read from the testnet. Cumulative test revenue allocated across listings: {usd(totalPaid)}. Test tokens have no monetary value. <Link to="/assets">See all assets →</Link></>}</p>}
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="goals-title">
      <h2 id="goals-title" className="pv-title" data-reveal>What you can do here.</h2>
      <div className="pv-roles">
        <Link className="pv-role" to="/assets" data-reveal><span className="pv-eyebrow">Take part</span><h3>Find an asset and see what you’d be buying.</h3><p>Price, remaining shares, the operator’s deposit record, where your money goes, and the risks.</p><small>Browsing needs no wallet.</small><strong>Explore assets <Icon name="arrow" size={16}/></strong></Link>
        <Link className="pv-role" to="/create" data-reveal style={{ ['--d' as string]: '80ms' }}><span className="pv-eyebrow">Run an asset</span><h3>Publish an offer and pay revenue to holders.</h3><p>Describe the asset, set shares, price and a bond, and manage deposits afterwards.</p><small>Draft without a wallet. Publishing needs tPOT and test pUSD.</small><strong>Create an offer <Icon name="arrow" size={16}/></strong></Link>
        <Link className="pv-role" to="/portfolio" data-reveal style={{ ['--d' as string]: '160ms' }}><span className="pv-eyebrow">Check your holdings</span><h3>See your shares and what you can claim.</h3><p>Shares in your wallet, shares earning, deposited income ready to claim, and recent activity.</p><small>Reading is free; nothing is signed until you approve a claim.</small><strong>Open my portfolio <Icon name="arrow" size={16}/></strong></Link>
      </div>
    </section>

    <section id="how" className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="how-title">
      <span className="pv-eyebrow" data-reveal>Where the money goes</span>
      <h2 id="how-title" className="pv-title" data-reveal>Five steps, and who controls the money at each one.</h2>
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
      <span className="pv-eyebrow" data-reveal>Risks and limits</span>
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

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="proof-title" data-reveal>
      <span className="pv-eyebrow">Reviewing Portion?</span>
      <h2 id="proof-title" className="pv-title">What works today, and how to check it.</h2>
      {sandbox && <p className="notice" role="note">These four facts describe the live Core v1 deployment on Portaldot, not the sandbox. The sandbox runs Core v2, which holds purchase money in escrow and releases it in reviewer-approved tranches. Core v2 is not deployed or audited.</p>}
      <div className="pv-proof">
        <div><small>Contract</small><b>Live on testnet</b><span>Core deployed at block {RECORDED.core.block.toLocaleString()}; address checked against the chain before any action is enabled.</span></div>
        <div><small>Recorded lifecycle</small><b>Offer to claim</b><span>Create, buy, deposit, claim and unstake finalized. One development account played both roles.</span></div>
        <div><small>Fees, read from the contract</small><b>{rules ? `${rules.saleFeeBps / 100}% sale · ${rules.revenueFeeBps / 100}% deposit` : status === 'offline' ? 'Unavailable' : 'Reading…'}</b><span>{rules ? 'Shown before any transaction is approved.' : 'Not displayed until read from the chain.'}</span></div>
        <div><small>Held for spending control</small><b>None</b><span>Purchase money goes directly to the operator. Controlled release is designed, not deployed.</span></div>
      </div>
      <p className="pv-proof-foot">Evidence, not endorsement: these are test transactions. <Link to="/evidence">Open the evidence record</Link>, <a href="https://github.com/Nailer/portion/blob/main/docs/FUNDING-PROTECTION.md" target="_blank" rel="noreferrer">read what the money protections cover</a>{!sandbox && <>, or <Link to="/sandbox">try the Core v2 contract in a clearly labelled simulation</Link></>}.</p>
    </section>
  </div>;
}
