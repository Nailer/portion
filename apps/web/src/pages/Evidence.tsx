import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { CopyButton, useAsync } from '../components/ui';
import { explorerBlock } from '../lib/format';
import { RECORDED, shortHash } from '../lib/evidence';
import { useReveal } from '../lib/scroll';

const REPO = 'https://github.com/Nailer/portion/blob/main';

const CRITERIA = [
  { name: 'Technical feasibility', weight: '30%', shows: 'Deployed Core contract; a finalized create → buy → deposit → claim → unstake run; versioned SDK; verified receipts; CI that runs contract, SDK, web and server tests.', gap: 'Browser signing by a separate user has not been witnessed. The recorded run used a script signer and a single account.', next: 'One witnessed wallet session with a funded tester account, recorded with receipts.' },
  { name: 'Innovation', weight: '30%', shows: 'Native deed NFT, fractionalized shares and ERC-20 precompiles composed with Solidity accounting in one atomic batch. Native TransactionStorage holds the terms.', gap: 'Composition is distinctive; it is not by itself a better product. Purchase money is not escrowed.', next: 'Controlled-release candidate is specified and tested locally; not deployed.' },
  { name: 'Ecosystem contribution', weight: '20%', shows: 'Open-source SDK and receipt tooling; a worked example of native assets used from Solidity; recurring on-chain activity only if operators actually deposit.', gap: 'No outside user or operator yet. Activity so far is one development account.', next: 'An interview-backed pilot with a real operator, using test tokens first.' },
  { name: 'Business potential', weight: '20%', shows: 'A narrowed first customer (an operator paying for revenue-sharing administration) and a cost model that shows the current per-transaction fee does not cover servicing.', gap: 'No customer interview, willingness to pay, legal review or revenue. All pricing is hypothesis.', next: 'Operator discovery and a written pilot scope before building billing.' },
] as const;

export function Evidence() {
  const { backend, status } = useApp();
  useReveal();
  const { data: rules, error } = useAsync(async () => backend?.deployed ? backend.rules() : null, [backend]);
  const chain = status === 'ready' ? (backend?.deployed ? 'Contract found on the connected testnet' : 'Contract not verified for this connection') : status === 'connecting' ? 'Checking the testnet…' : 'Testnet unavailable';
  return <div className="pv">
    <section className="pv-section" style={{ paddingBottom: 24 }}>
      <span className="pv-eyebrow">For reviewers and judges</span>
      <h1 className="pv-title" style={{ fontSize: 'clamp(34px,5vw,58px)' }}>Evidence you can check without a wallet.</h1>
      <p className="pv-lede">Everything below is either read live from the testnet, or a recorded transaction you can look up. Each item says what it proves and what it does not. Nothing here is customer demand, revenue or an independent audit.</p>
      <p className="pv-hero-note" style={{ marginTop: 22 }} role="note"><span><b>One account, both roles.</b> The recorded lifecycle was run by a single development account acting as operator and buyer. It shows the contract works as written; it is not evidence of separate users, outside investment or real equipment.</span></p>
    </section>

    <section className="pv-section" style={{ paddingTop: 24 }} aria-labelledby="ev-chain">
      <h2 id="ev-chain" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>Deployment</h2>
      <dl className="ev-kv" data-reveal>
        <div><dt>Network</dt><dd>{RECORDED.network} · EVM chain ID {RECORDED.chainId}</dd></div>
        <div><dt>Core contract</dt><dd className="mono">{RECORDED.core.address} <CopyButton text={RECORDED.core.address}/></dd></div>
        <div><dt>Deployed</dt><dd>Block {RECORDED.core.block.toLocaleString()} · <a href={explorerBlock(RECORDED.core.block)} target="_blank" rel="noreferrer">view block</a> · <span className="mono">{shortHash(RECORDED.core.deployTx)}</span> <CopyButton text={RECORDED.core.deployTx} label="Copy tx"/></dd></div>
        <div><dt>Payment test asset</dt><dd>Native asset {RECORDED.paymentAssetId} (test pUSD, no monetary value)</dd></div>
        <div><dt>Deed collection</dt><dd>Native NFT collection {RECORDED.deedCollection}</dd></div>
        <div><dt>Live check now</dt><dd>{chain}{rules ? ` · fees read from contract: ${rules.saleFeeBps / 100}% on sales, ${rules.revenueFeeBps / 100}% on deposits` : error ? ' · fees could not be read' : ''}</dd></div>
      </dl>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="ev-run">
      <h2 id="ev-run" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>The recorded lifecycle</h2>
      <p className="pv-lede">Asset <Link to={`/listing/${RECORDED.listing.assetId}`}>{RECORDED.listing.assetId}</Link>, “{RECORDED.listing.name}”, was disclosed as a protocol test representing no equipment, ownership or revenue.</p>
      <div className="ev-table-wrap" data-reveal><table className="ev-table"><thead><tr><th scope="col">Step</th><th scope="col">Block</th><th scope="col">Transaction hash</th></tr></thead><tbody>
        {RECORDED.steps.map(s => <tr key={s.hash}><th scope="row">{s.label}</th><td><a href={explorerBlock(s.block)} target="_blank" rel="noreferrer">{s.block.toLocaleString()}</a></td><td className="mono">{shortHash(s.hash, 12, 8)} <CopyButton text={s.hash}/></td></tr>)}
      </tbody></table></div>
      <div className="pv-limits" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <article className="pv-limit is-enforced" data-reveal><h3><i/>What it shows</h3><ul>
          <li>All {RECORDED.listing.shares} shares bought; the sale fee went to the treasury and the rest to the operator.</li>
          <li>A deposit of {RECORDED.outcome.deposited} test pUSD: fee {RECORDED.outcome.fee}, allocated {RECORDED.outcome.allocated}.</li>
          <li>The holder claimed {RECORDED.outcome.claimed} and unstaked all shares back to the wallet.</li>
          <li>The terms document hash matches what is stored on-chain.</li>
        </ul></article>
        <article className="pv-limit is-missing" data-reveal><h3><i/>What it does not show</h3><ul>
          {RECORDED.limits.map(l => <li key={l}>{l}</li>)}
          <li>That any equipment exists, or that purchase money was spent as described.</li>
        </ul></article>
      </div>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="ev-criteria">
      <h2 id="ev-criteria" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>Judging criteria and the evidence for each</h2>
      <p className="pv-lede">Weights are from the <a href="https://dorahacks.io/hackathon/2362/detail" target="_blank" rel="noreferrer">official Portaldot Hacker House page</a>. The gap column is Portion’s own assessment.</p>
      <div className="ev-table-wrap" data-reveal><table className="ev-table ev-criteria"><thead><tr><th scope="col">Criterion</th><th scope="col">Evidence today</th><th scope="col">Biggest gap</th><th scope="col">Smallest credible next step</th></tr></thead><tbody>
        {CRITERIA.map(c => <tr key={c.name}><th scope="row">{c.name}<small>{c.weight}</small></th><td>{c.shows}</td><td>{c.gap}</td><td>{c.next}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="ev-test">
      <h2 id="ev-test" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>How a purchase could be tested</h2>
      <p className="pv-lede">The recorded offer is sold out, so it cannot show a fresh purchase, and Portion will not create assets just to look active. Two honest options:</p>
      <ol className="pv-flow" style={{ marginTop: 24 }}>
        <li data-reveal><div><h3>Read-only, today</h3><p>Open the <Link to={`/listing/${RECORDED.listing.assetId}`}>recorded asset</Link>. The purchase panel explains why it is closed and shows the fee, bond and native-backing checks. No tokens or wallet are needed.</p></div><dl className="pv-who"><div><dt>Cost</dt><dd>None</dd></div></dl></li>
        <li data-reveal><div><h3>A new offer and a separate buyer</h3><p>Publish one small, clearly labelled test offer from one funded wallet, then buy from a second funded wallet in the browser. This is the evidence that would close the “one account, both roles” gap.</p></div><dl className="pv-who"><div><dt>Cost</dt><dd>The first run reduced native balance by 47.56 tPOT; the optimised hash storage saves about 2.52 tPOT.</dd></div><div className="gap"><dt>Status</dt><dd>Not authorised or funded. Spare balance above the 40 tPOT reserve was 4.83 tPOT when last measured (24 Oct). Needs an organiser allocation first.</dd></div></dl></li>
      </ol>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="ev-docs">
      <h2 id="ev-docs" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>Read the reasoning</h2>
      <ul className="ev-links" data-reveal>
        <li><a href={`${REPO}/docs/INVESTMENT-ASSESSMENT.md`} target="_blank" rel="noreferrer">Investment assessment</a><span>Whether to support the direction, and what evidence would change the answer.</span></li>
        <li><a href={`${REPO}/docs/HACKATHON-EVIDENCE-MAP.md`} target="_blank" rel="noreferrer">Hackathon requirements and evidence map</a><span>Official rules, dates and each criterion mapped to evidence.</span></li>
        <li><a href={`${REPO}/docs/MARKET-AND-COMPETITORS.md`} target="_blank" rel="noreferrer">Market and competitors</a><span>Who else does this, how they work, and where they are stronger.</span></li>
        <li><a href={`${REPO}/docs/FINANCIAL-MODEL.md`} target="_blank" rel="noreferrer">Revenue and cost model</a><span>Unit economics with every assumption labelled.</span></li>
        <li><a href={`${REPO}/docs/FUNDING-PROTECTION.md`} target="_blank" rel="noreferrer">Funding and protection</a><span>Where purchase money goes and what the bond covers.</span></li>
        <li><a href={`${REPO}/docs/CONTROLLED-FUNDING-DESIGN.md`} target="_blank" rel="noreferrer">Controlled funding design</a><span>The proposed escrow and milestone model; not deployed.</span></li>
      </ul>
    </section>
  </div>;
}
