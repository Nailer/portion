// Reproducible unit-economics model for docs/FINANCIAL-MODEL.md. Run: node scripts/financial-model.mjs
// Every input below is an ASSUMPTION unless its comment says it is read from the deployed contract.
// Nothing here is a forecast, a customer quote or evidence of demand. Amounts in whole USD.

const FEES = { saleBps: 100, depositBps: 50 }; // read from deployed Core v1: 1% primary sale, 0.5% revenue deposit
const bps = (amount, rate) => (amount * rate) / 10_000;

/** Protocol-fee income and the split of a deposit. Invariant: fee + allocation === deposit. */
export function depositSplit(deposit) {
  const fee = bps(deposit, FEES.depositBps);
  const allocation = deposit - fee;
  if (Math.abs(fee + allocation - deposit) > 1e-9) throw new Error('deposit split does not conserve value');
  return { fee, allocation };
}

export function saleSplit(raise) {
  const fee = bps(raise, FEES.saleBps);
  const toOperator = raise - fee;
  if (Math.abs(fee + toOperator - raise) > 1e-9) throw new Error('sale split does not conserve value');
  return { fee, toOperator };
}

// ── Assumptions (all hypotheses) ───────────────────────────────────────────────
const SERVICE = {
  onboardingHours: 10,        // review of operator, asset evidence, terms. ASSUMPTION
  supportHoursPerMonth: 2,    // per active operator. ASSUMPTION
  hourlyCost: 40,             // fully loaded cost of a reviewer/support person. ASSUMPTION
  hostingPerMonth: 20,        // storage, API, monitoring attributable to one operator. ASSUMPTION
};
const onboarding = SERVICE.onboardingHours * SERVICE.hourlyCost;
const monthlyServe = SERVICE.supportHoursPerMonth * SERVICE.hourlyCost + SERVICE.hostingPerMonth;

const fmt = n => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const out = [];
const line = (...cells) => out.push(`| ${cells.join(' | ')} |`);

out.push(`Cost to serve one operator (assumed): onboarding ${fmt(onboarding)} once; ${fmt(monthlyServe)} per month (${fmt(monthlyServe * 12)} per year).\n`);

// 1. What current protocol fees earn per operator relationship.
out.push('### A. Current per-transaction fees (1% sale, 0.5% deposit)\n');
line('Raise', 'Annual deposits', 'Year-1 fee income', 'Year-1 cost', 'Year-1 contribution', 'Year-2+ contribution');
line('---', '---', '---', '---', '---', '---');
for (const [raise, deposit] of [[20_000, 4_000], [50_000, 10_000], [250_000, 50_000], [1_000_000, 200_000]]) {
  const y1fee = saleSplit(raise).fee + depositSplit(deposit).fee;
  const y2fee = depositSplit(deposit).fee;
  const cost = onboarding + monthlyServe * 12;
  line(fmt(raise), fmt(deposit), fmt(y1fee), fmt(cost), fmt(y1fee - cost), fmt(y2fee - monthlyServe * 12));
}
const breakEvenDeposit = (monthlyServe * 12) / (FEES.depositBps / 10_000);
out.push(`\nAt 0.5% an operator must deposit about ${fmt(breakEvenDeposit)} a year just to pay for ongoing service, before any company overhead.\n`);

// 2. Subscription hypothesis: how many operators cover a small team.
out.push('### B. Subscription hypothesis (price is NOT validated)\n');
const teamCostPerYear = 250_000; // two people plus tooling. ASSUMPTION
line('Monthly price per operator', 'Contribution per operator per month', 'Operators to cover a ' + fmt(teamCostPerYear) + ' team');
line('---', '---', '---');
for (const price of [100, 300, 1000]) {
  const contribution = price - monthlyServe;
  line(fmt(price), fmt(contribution), contribution > 0 ? Math.ceil(teamCostPerYear / (contribution * 12)).toString() : 'never');
}

// 3. Sensitivity: onboarding hours dominate small offers.
out.push('\n### C. Sensitivity of year-1 contribution (raise $50,000, deposits $10,000)\n');
line('Onboarding hours', 'Year-1 contribution at current fees');
line('---', '---');
for (const h of [2, 10, 30]) {
  const fee = saleSplit(50_000).fee + depositSplit(10_000).fee;
  line(String(h), fmt(fee - (h * SERVICE.hourlyCost + monthlyServe * 12)));
}

// 4. Money that must never be counted as company revenue.
out.push('\n### D. Who holds what in the same example ($50,000 raise, $10,000 deposited in a year)\n');
const s = saleSplit(50_000), d = depositSplit(10_000);
line('Flow', 'Amount', 'Belongs to');
line('---', '---', '---');
line('Primary sale fee', fmt(s.fee), 'Company revenue');
line('Sale proceeds paid straight to operator', fmt(s.toOperator), 'Operator (not escrowed today)');
line('Deposit fee', fmt(d.fee), 'Company revenue');
line('Deposit allocated to staked holders', fmt(d.allocation), 'Participants (claimable)');
line('Operator bond (at least 5% of offered value)', fmt(0.05 * 50_000) + ' minimum', 'Held in contract; not company revenue');

console.log(out.join('\n'));
