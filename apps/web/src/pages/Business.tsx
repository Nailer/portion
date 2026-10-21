import { useState } from 'react';
import { Link } from 'react-router-dom';

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const INITIAL = { raise: 10000, income: 2000, operating: 1200, payout: 500, service: 0, setupCost: 250, monthlyCost: 25 };
type Field = keyof typeof INITIAL;

export function Business() {
  const [values, setValues] = useState(INITIAL);
  const [view, setView] = useState<'operator' | 'funder' | 'portion'>('operator');
  const v = values;
  const saleFee = v.raise * .01;
  const revenueFee = v.payout * .005;
  const operatorCash = v.income - v.operating - v.payout - v.service;
  const distributed = v.payout - revenueFee;
  const recurringMargin = revenueFee + v.service - v.monthlyCost;
  const firstYear = saleFee - v.setupCost + recurringMargin * 12;
  const recovery = distributed > 0 ? v.raise / distributed : null;
  const set = (field: Field, input: string) => setValues(current => ({ ...current, [field]: Math.min(1e9, Math.max(0, Number(input) || 0)) }));
  const field = (key: Field, label: string, hint: string) => <label className="business-field" key={key}><span>{label}</span><div><span>$</span><input type="number" min="0" max="1000000000" step="any" value={v[key]} onChange={e => set(key, e.target.value)} aria-label={label}/></div><small>{hint}</small></label>;
  return <div className="business-page">
    <Link className="crumb" to="/">← Explore Portion</Link>
    <section className="business-hero"><div className="eyebrow">THE BUSINESS BEHIND THE PORTION</div><h1>Working assets.<br/><span>Money that makes sense.</span></h1><p>Companies run the assets. Funders provide capital. Portion helps manage the records and payments. Everyone needs a reason to participate.</p><div className="business-label">PLANNING TOOL · ILLUSTRATIVE USD · NO REAL PAYMENTS</div></section>
    <div className="business-audiences">
      <article><span>01 / OPERATORS</span><h2>Grow your operation.</h2><p>Raise equipment funding, manage your funders, and record and distribute payments across your assets.</p><small>Designed for companies managing solar and other productive assets.</small></article>
      <article><span>02 / FUNDERS</span><h2>Share in the income.</h2><p>Review the agreement and payment history. Receive your allocation of the money deposited by the operator.</p><small>Income depends on the business. Capital can be lost.</small></article>
      <article><span>03 / PORTION</span><h2>Get paid for useful work.</h2><p>Earn funding and payout fees. Test paid management plans for companies operating multiple assets.</p><small>Subscriptions are proposed, not currently charged.</small></article>
    </div>
    <section className="business-lab" aria-labelledby="lab-title">
      <div className="market-heading"><div><div className="eyebrow">CHANGE THE NUMBERS. CHECK THE BUSINESS.</div><h2 id="lab-title">Does the deal work<br/><span>for everyone?</span></h2></div><p>A calculator for one offering, assuming all offered shares participate throughout. These inputs are assumptions, not evidence of demand or future income.</p></div>
      <div className="business-lab-grid">
        <div className="business-inputs">
          <h3>The operator’s business</h3>
          <div className="two">{field('raise','Funding raised','Before the current 1% funding fee.')}{field('income','Monthly customer income','What customers pay the operator.')}{field('operating','Monthly operating costs','Maintenance, staff, energy, insurance, etc.')}{field('payout','Monthly funder deposit','Taken from the operator’s cash, not created by Portion.')}</div>
          <h3>What Portion charges and spends</h3>
          <div className="two">{field('service','Proposed monthly management fee','Not implemented. Test whether operators will pay.')}{field('setupCost','Portion setup cost per offering','Assumed verification and onboarding cost.')}{field('monthlyCost','Portion monthly servicing cost','Assumed support, payment and infrastructure costs.')}</div>
          <button className="link-btn" onClick={() => setValues(INITIAL)}>Reset the example</button>
        </div>
        <div className="business-results">
          <div className="business-view" role="group" aria-label="View business outcomes">{(['operator','funder','portion'] as const).map(x => <button key={x} aria-pressed={view === x} onClick={() => setView(x)}>{x === 'funder' ? 'Funders' : x === 'portion' ? 'Portion' : 'Operator'}</button>)}</div>
          {view === 'operator' && <div className="business-result" key={view}><span className="eyebrow">AFTER COSTS, FUNDERS & MANAGEMENT FEE</span><h3 className={operatorCash < 0 ? 'negative' : ''}>{money(operatorCash)}<small>/ month retained</small></h3><p>{operatorCash > 0 ? 'This is what the operator retains before taxes, debt payments and other costs not entered here.' : 'This example leaves no positive operating cushion. The deal needs different terms or stronger business income.'}</p><dl><dt>Funding available after 1% fee</dt><dd>{money(v.raise - saleFee)}</dd><dt>Monthly operating surplus before payouts</dt><dd>{money(v.income - v.operating)}</dd><dt>Monthly deposit to funders</dt><dd>{money(v.payout)}</dd><dt>Proposed management fee</dt><dd>{money(v.service)}</dd></dl><p className="business-footnote">The operator also needs cash for a bond. Its size is not included in this example. If the equipment costs the full raise, the funding fee creates a shortfall.</p></div>}
          {view === 'funder' && <div className="business-result" key={view}><span className="eyebrow">SHARED BY PARTICIPATING FUNDERS</span><h3>{money(distributed)}<small>/ month distributed</small></h3><p>After the current 0.5% fee on the operator’s deposit. Your individual allocation depends on your share of staked shares.</p><dl><dt>Monthly deposit</dt><dd>{money(v.payout)}</dd><dt>Included payout fee</dt><dd>{money(revenueFee)}</dd><dt>Total distributions over 12 months</dt><dd>{money(distributed * 12)}</dd><dt>Time for distributions to equal funding</dt><dd>{recovery ? `${recovery.toFixed(1)} months` : 'No distributions'}</dd></dl><p className="business-footnote">This is cash-distribution arithmetic, not a forecast or annual return. It assumes identical payments continue. There is no automatic repayment of the initial investment, guaranteed exit, or separate principal redemption in the current contract.</p></div>}
          {view === 'portion' && <div className="business-result" key={view}><span className="eyebrow">AFTER THE COSTS ENTERED HERE</span><h3 className={recurringMargin < 0 ? 'negative' : ''}>{money(recurringMargin)}<small>/ month contribution</small></h3><p>{recurringMargin > 0 ? 'A positive contribution in this example. Company overhead, taxes and acquisition costs still need to be covered.' : 'Current transaction fees do not cover the assumed servicing cost. More volume, lower costs or a management plan would be needed.'}</p><dl><dt>One-time funding fee</dt><dd>{money(saleFee)}</dd><dt>Monthly payout-fee revenue</dt><dd>{money(revenueFee)}</dd><dt>Proposed monthly management fee</dt><dd>{money(v.service)}</dd><dt>First-year contribution, including setup</dt><dd className={firstYear < 0 ? 'negative' : ''}>{money(firstYear)}</dd></dl><p className="business-footnote">The contract currently charges 1% of sales and 0.5% of deposits. Management fees are a proposal only. Contribution excludes company overhead and customer acquisition; it is not company profit.</p></div>}
          <div className="business-verdict" role="status">{operatorCash <= 0 ? 'Operator economics need work.' : recurringMargin <= 0 ? 'The operator can retain cash, but Portion’s recurring economics still need work.' : 'The example leaves a positive monthly contribution for operator and Portion. Validate every assumption with a real partner.'}</div>
        </div>
      </div>
    </section>
    <section className="business-next"><div className="eyebrow">GLOBAL INFRASTRUCTURE. ONE REAL PILOT FIRST.</div><h2>Build around an operator,<br/>then repeat what works.</h2><p>Begin with one operator. Check customer collections, equipment costs, payment responsibilities and pricing. Support more companies and markets as the process becomes repeatable.</p><div className="business-checklist"><span>01 · Evidence of customer payments</span><span>02 · Clear funder rights and exit terms</span><span>03 · Practical funding and cash-out options</span><span>04 · Market-specific legal arrangements</span></div><Link className="btn primary" to="/create">Explore the operator flow <span>↗</span></Link></section>
  </div>;
}
