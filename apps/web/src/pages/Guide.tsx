import { Link } from 'react-router-dom';
import { useRunner } from '../state/runner';
import { useApp } from '../state/app';
import { Readiness } from '../components/Readiness';
import { useReveal } from '../lib/scroll';

type Step = { h: string; p: string; cost: string; next: string; to?: string; cta?: string };

const OPERATOR: Step[] = [
  { h: 'Draft your offer', p: 'Describe the asset, upload a real photo, set the shares, price, the deposit schedule you expect to keep, and a bond.', cost: 'Free. No wallet needed.', next: 'The draft is saved only in this browser, only if you choose to save it.', to: '/create', cta: 'Create an offer' },
  { h: 'Connect a Portaldot wallet', p: 'Approve account access in the extension. Portion never asks for a recovery phrase and never creates a wallet for you.', cost: 'Free. Your wallet needs tPOT for network fees and storage deposits, and test pUSD for the bond.', next: 'Balances are read from the chain. Missing or unavailable is never shown as zero.' },
  { h: 'Review, then publish', p: 'You approve two document stores (terms and image) and one atomic batch that creates the deed, shares, approvals and the listing.', cost: 'Up to three wallet approvals. Fee estimates are shown before you sign. They are estimates, not enforced caps; storage deposits are separate.', next: 'The listing appears after its finalized receipt is verified. If a later step fails, earlier finalized steps are kept and resumed, not repeated.' },
  { h: 'Record revenue deposits', p: 'When you decide to share revenue, deposit it. The 0.5% fee is shown first; the rest is split among shares staked at that moment.', cost: 'The deposit amount, the fee, and a network fee. A deposit needs at least one staked share.', next: 'Holders can claim immediately. A deposit at or above your stated minimum resets the late clock.', to: '/operator', cta: 'Manage offers' },
  { h: 'Keep to your schedule', p: 'After one missed period the listing is late; after two it is in default, new purchases stop and anyone can submit a bond recovery.', cost: 'The bond is held by the contract.', next: 'The bond is limited recovery, not insurance, and nothing runs automatically.' },
];
const PARTICIPANT: Step[] = [
  { h: 'Read the record', p: 'Open an asset to see its hashed terms, native backing checks, bond, deposit history and activity.', cost: 'Free. No wallet needed.', next: 'You will see exactly where the money would go and what is not guaranteed.', to: '/assets', cta: 'Explore assets' },
  { h: 'Connect and check readiness', p: 'Connect a Portaldot wallet. Check your tPOT and pUSD balances below before you try anything.', cost: 'Free to connect.', next: 'Test credits come from a limited, explicit request. Nothing is assigned automatically.', to: '/faucet', cta: 'Get test tokens' },
  { h: 'Buy shares, if an offer is open', p: 'Choose how many shares, review the total and the fee, and approve in your wallet.', cost: 'Price × shares, including a 1% fee, plus a network fee.', next: 'Your payment goes directly to the operator. Shares start earning when staked.' },
  { h: 'Stake and claim', p: 'Stake shares so they receive future deposits, and claim what has been allocated to you.', cost: 'A network fee per action.', next: 'Claims are pulled, not pushed. Unstaking returns shares, not your purchase price.', to: '/portfolio', cta: 'Open my portfolio' },
];
const REVIEWER: Step[] = [
  { h: 'Check the deployment', p: 'Compare the contract address, block and transaction hash with the chain.', cost: 'Free. No wallet needed.', next: 'You learn that the contract exists and matches the recorded bytecode.', to: '/evidence', cta: 'Open the evidence' },
  { h: 'Read the recorded lifecycle', p: 'Look up each finalized transaction and the asset record.', cost: 'Free.', next: 'It shows the contract works as written. It was one account in both roles.' },
  { h: 'Read what is not proven', p: 'Money protections, customer evidence, legal review and the funding gaps are listed plainly.', cost: 'Free.', next: 'Use the investment assessment and cost model to challenge the direction.', to: '/business', cta: 'Read the business model' },
];

function Path({ id, eyebrow, title, steps }: { id: string; eyebrow: string; title: string; steps: Step[] }) {
  return <section id={id} className="pv-section" style={{ paddingTop: 0 }} aria-labelledby={`${id}-t`}>
    <span className="pv-eyebrow" data-reveal>{eyebrow}</span>
    <h2 id={`${id}-t`} className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }} data-reveal>{title}</h2>
    <ol className="pv-flow" style={{ marginTop: 24 }}>
      {steps.map(s => <li key={s.h} data-reveal>
        <div><h3>{s.h}</h3><p>{s.p}</p>{s.to && <p><Link className="btn ghost sm" to={s.to}>{s.cta}</Link></p>}</div>
        <dl className="pv-who"><div><dt>What it costs</dt><dd>{s.cost}</dd></div><div><dt>What happens next</dt><dd>{s.next}</dd></div></dl>
      </li>)}
    </ol>
  </section>;
}

export function Guide() {
  const { openPassport } = useRunner();
  const { backend } = useApp();
  useReveal();
  return <div className="pv">
    <section className="pv-section" style={{ paddingBottom: 24 }}>
      <span className="pv-eyebrow">How it works</span>
      <h1 className="pv-title" style={{ fontSize: 'clamp(34px,5vw,58px)' }}>Pick your role. Every step shows its cost.</h1>
      <p className="pv-lede">Portion runs on the Portaldot test network with test tokens. Each step below says what it costs and what happens next, so nothing is a surprise at the wallet prompt.</p>
      <p className="pv-actions"><a className="btn primary" href="#operator">I run an asset</a><a className="btn ghost" href="#participant">I take part</a><a className="btn ghost" href="#reviewer">I am reviewing</a><button className="btn ghost" onClick={() => openPassport()}>Connect wallet</button></p>
    </section>

    <Readiness/>
    {!backend?.deployed && <p className="notice">Contract availability has not been verified in this session. Check the network console before proceeding.</p>}

    <div style={{ height: 40 }}/>
    <Path id="operator" eyebrow="For operators" title="Prepare, publish and record deposits." steps={OPERATOR}/>
    <Path id="participant" eyebrow="For participants" title="Read first, then take part." steps={PARTICIPANT}/>
    <Path id="reviewer" eyebrow="For reviewers" title="Check it without a wallet." steps={REVIEWER}/>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="fail-t">
      <span className="pv-eyebrow" data-reveal>If something goes wrong</span>
      <h2 id="fail-t" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }} data-reveal>Your money and your receipts are not lost.</h2>
      <div className="pv-limits" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <article className="pv-limit is-enforced" data-reveal><h3><i/>What Portion does for you</h3><ul>
          <li>Keeps every finalized step, so a later failure never repeats an earlier payment.</li>
          <li>Treats an unknown outcome as unknown, never as failed, and blocks a blind retry.</li>
          <li>Cancels a review if you switch account or network before approving.</li>
          <li>Keeps receipts on this device and lets you check a hash or block yourself.</li>
        </ul></article>
        <article className="pv-limit is-trust" data-reveal><h3><i/>What to do</h3><ul>
          <li>If a signature request times out, open the <Link to="/receipts">receipt centre</Link> before trying again.</li>
          <li>If the network is slow, wait. The testnet endpoint can take many seconds to answer.</li>
          <li>Never share a recovery phrase. Portion will never ask for one.</li>
          <li>Need tokens? Use the <Link to="/faucet">faucet</Link>; native tPOT comes from the organisers, not from Portion.</li>
        </ul></article>
      </div>
    </section>
  </div>;
}
