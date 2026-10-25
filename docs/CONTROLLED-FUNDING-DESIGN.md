# Controlled funding — proposed model, not deployed

This is a reviewable product specification for POR-R06/B06/B07, not a new promise
about Core v1 or a decision to accept real money. The customer interviews and
qualified jurisdiction-specific review may change the model. No new contract,
custody provider, payment integration or Google Cloud service is authorized here.

## A concrete proposed flow

1. **Admission:** an operator provides asset identity, authority to operate it,
   the proposed use of proceeds, vendor details, costs and payment obligations.
   A named independent reviewer checks the evidence. Public material excludes
   personal identity documents and customer/bank secrets; confidential review
   needs a separate permitted process. No reviewer is appointed or partner claimed yet.
2. **Funding terms:** freeze a minimum target, maximum accepted amount, deadline,
   refund rights and named milestones before accepting contributions. Changes
   affecting existing funders require their defined consent or a withdrawal route.
   Meeting a target does not immediately transfer money to the operator.
3. **Separate balances:** distinguish undisbursed contributions, operator bond,
   deposited operating income, participant claims and protocol fees. A release
   must not borrow from claims or another asset's balance.
4. **Release proposal:** the operator supplies evidence for a specific milestone
   and a fixed, previously disclosed vendor/beneficiary and amount. A proposal
   includes the evidence hash and expiry; the same milestone cannot pay twice.
5. **Approval:** require both an independent asset reviewer and a participant
   representative. The operator cannot approve its own payment or replace those
   people unilaterally. Reviewers disclose vendor/operator conflicts. These are
   proposed roles; collusion remains a risk and their actual availability/cost
   must be validated. A proposed 72-hour challenge window is a design parameter,
   not a legal cooling-off period or an accepted production rule.
6. **Disbursement:** after approval/challenge rules, pay only the authorized
   beneficiary within the milestone cap. Debit and receipt creation are atomic;
   a failed transfer must not mark a milestone paid. Changing beneficiary or
   amount requires a new approval cycle. Vendor payments can reduce misuse of
   undisbursed money but do not guarantee delivery or business performance.
7. **Refund:** if the funding deadline passes below target, contributors claim
   their unreleased contribution under the disclosed fee policy. A failed or
   expired milestone returns only the remaining refundable pool pro rata.
   Already released/vendor-spent money is not automatically recoverable.
   Network fees already spent do not become magically refundable.
8. **Collections:** identify who receives customer income, verifies records,
   reconciles permitted operating costs and deposits the actual distributable
   amount. A bank feed alone cannot prove every sale was reported. Payment and
   custody responsibilities require an eligible, agreed arrangement before launch.
9. **Dispute/default:** define who can pause new undisbursed releases, what
   evidence is required, an appeal path, a resolution deadline and permitted
   remedies. A pause must not silently confiscate claims or trap unrelated funds.
   Bond recovery remains limited and physical remedies depend on enforceable rights.
10. **Participant payout:** allocate submitted net income to the agreed eligible
    stake/rights record, show the exact fee and let participants claim. Automatic
    bank/stablecoin payout is a separate integration and cannot be advertised now.

## Acceptance tests before implementation or funded migration

- Failed target, overfunding, deadline extension and contributor refund accounting.
- Fake/duplicate invoices, duplicate milestone release and beneficiary substitution.
- Operator self-approval, conflicted approvers, colluding reviewers and unavailable representatives.
- Partial delivery, expired milestone, participant challenge and conflicting evidence.
- Failed/reentrant transfers, concurrent approvals, repeated callbacks and replay across assets/chains.
- Separated balances, outstanding income claims, rounding and insolvency/default.
- Hidden/unreported collections and inaccurate external payment records.
- Reviewer/custody/dispute/hosting costs against actual willingness to pay.

The first pilot should validate whether controlled fundraising is the paid need
or whether operators mainly want reliable payment administration. Pricing remains
unvalidated; the current fixed protocol fee is not proof that it covers these costs.
