import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { useAsync } from '../components/ui';
import { useReveal } from '../lib/scroll';

const DOCS = 'https://github.com/Nailer/portion/blob/main/docs';

export function Business() {
  const { backend, status } = useApp();
  useReveal();
  const { data: rules, error } = useAsync(async () => backend?.deployed ? backend.rules() : null, [backend]);
  return <div className="pv">
    <section className="pv-section" style={{ paddingBottom: 24 }}>
      <span className="pv-eyebrow">Business model</span>
      <h1 className="pv-title" style={{ fontSize: 'clamp(34px,5vw,58px)' }}>How Portion could earn, and what is not yet proven.</h1>
      <p className="pv-lede">Portion is not earning anything today. This page states the hypothesis, the verified fees, and what would have to be true for it to become a business. No customer, pilot or price has been agreed.</p>
    </section>

    <section className="pv-section" style={{ paddingTop: 24 }} aria-labelledby="biz-direction">
      <h2 id="biz-direction" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>The direction</h2>
      <div className="pv-limits" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <article className="pv-limit is-enforced" data-reveal><h3><i/>First product: revenue-sharing administration</h3><ul>
          <li><b>Customer:</b> an operator of productive equipment who already shares income with a few funders.</li>
          <li><b>Job:</b> record the terms, deposit revenue, split it by shares, let each holder claim, and export receipts anyone can check.</li>
          <li><b>Proposed payer:</b> the operator, a recurring fee for a defined scope. Not validated.</li>
        </ul></article>
        <article className="pv-limit is-trust" data-reveal><h3><i/>Optional, test-only: funding</h3><ul>
          <li>Raising money through Portion is kept as a test-network module.</li>
          <li>Purchase money currently goes straight to the operator; no escrow exists.</li>
          <li>A controlled-release design exists and is tested locally; it is not deployed. Real money needs reviewers and legal review first.</li>
        </ul></article>
      </div>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="biz-fees">
      <h2 id="biz-fees" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>Fees the contract charges today</h2>
      {rules
        ? <dl className="ev-kv" data-reveal><div><dt>Primary sale</dt><dd>{rules.saleFeeBps / 100}% of a purchase, taken from what the buyer pays</dd></div><div><dt>Revenue deposit</dt><dd>{rules.revenueFeeBps / 100}% of each deposit; the rest is allocated to staked holders</dd></div></dl>
        : <p className="pv-state" role="status">{error ? 'Contract fees could not be read.' : status === 'connecting' ? 'Checking deployed contract fees…' : 'Verified contract fees are unavailable.'} No assumed percentages are shown here.</p>}
      <p className="pv-proof-foot">Read from the deployed contract, in test tokens that have no value. They are fixed in this version.</p>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="biz-math">
      <h2 id="biz-math" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>Why those fees are not enough</h2>
      <p className="pv-lede">Under the cost model’s assumptions (10 hours of onboarding review and about $100 a month to serve each operator), an operator must deposit roughly <b>$240,000 a year</b> at a 0.5% fee just to cover its own service cost, before any company overhead. A $50,000 raise with $10,000 of annual deposits earns about $550 in its first year against about $1,600 of cost.</p>
      <p className="pv-lede">These are labelled assumptions, not measurements. The point is the shape: a per-transaction fee does not pay for verification, support and disputes. A subscription from the operator might, if operators will pay. That is exactly what has to be learned.</p>
      <p className="pv-actions"><a className="btn ghost" href={`${DOCS}/FINANCIAL-MODEL.md`} target="_blank" rel="noreferrer">Read the full cost model</a><a className="btn ghost" href={`${DOCS}/INVESTMENT-ASSESSMENT.md`} target="_blank" rel="noreferrer">Read the investment assessment</a></p>
    </section>

    <section className="pv-section" style={{ paddingTop: 0 }} aria-labelledby="biz-proof">
      <h2 id="biz-proof" className="pv-title" style={{ fontSize: 'clamp(26px,3vw,36px)' }}>What has to be proven next</h2>
      <ol className="pv-flow" style={{ marginTop: 24 }}>
        <li data-reveal><div><h3>An operator wants this</h3><p>Talk to a real operator about how they report and pay funders today, what it costs them, and what they would pay to change it.</p></div><dl className="pv-who"><div className="gap"><dt>Status</dt><dd>No interview has taken place. A solar operator is reachable through the founder; that is not a partnership.</dd></div></dl></li>
        <li data-reveal><div><h3>Funders accept the record</h3><p>Participants understand where income comes from, that nothing is guaranteed, and the exit and default terms.</p></div><dl className="pv-who"><div className="gap"><dt>Status</dt><dd>Untested with any participant.</dd></div></dl></li>
        <li data-reveal><div><h3>A separate user signs in a browser</h3><p>The recorded run used a script signer and one account. A witnessed browser-wallet session with a different user would close that gap.</p></div><dl className="pv-who"><div className="gap"><dt>Status</dt><dd>Not done. Needs a funded tester account.</dd></div></dl></li>
        <li data-reveal><div><h3>Rights, custody and eligibility are reviewed</h3><p>Before any real money, a qualified legal review and a named verification and collections process.</p></div><dl className="pv-who"><div className="gap"><dt>Status</dt><dd>Not started. Not provided by this software.</dd></div></dl></li>
      </ol>
      <p className="pv-actions"><Link className="btn primary" to="/evidence">Inspect the evidence</Link><Link className="btn ghost" to="/guide">Read the guide</Link></p>
    </section>
  </div>;
}
