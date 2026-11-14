# Validation and metrics

## What was validated, and how

**No user interviews were run.** This was the builder's decision for this hackathon. Everything below is either public evidence or something we tested ourselves.

### The problem is real (public evidence)

| Claim | Evidence |
|---|---|
| Late payment to small firms is large | About ₹8.1 lakh crore locked in delayed payments to MSMEs (Economic Survey estimate, reported January 2026) |
| Small firms act on it when they can | 2,56,892 delayed-payment cases worth ₹55,244 crore filed on MSME Samadhaan by December 2025; about ₹21,000–22,000 crore still pending |
| The law puts the cost on the buyer | MSMED Act s.15 (45-day cap) and s.16 (compound interest at 3× the RBI bank rate); Income-tax Act 2025 s.37(2)(g) (no deduction for sums overdue and unpaid at 31 March), confirmed as the successor of 43B(h) in a Rajya Sabha reply of 21 July 2026 |
| The rule covers IT services | The 45-day rule applies to services as well as goods; compliance guides list IT services explicitly |
| Government pressure is rising | The MSMED (Amendment) Bill passed Parliament in August 2026 to speed up recovery |

### Gaps we can't close without users

- How long acceptance actually takes to reach the bottom of real IT chains.
- How many freelancers in these chains are Udyam-registered. The rule covers only registered micro and small suppliers.
- Whether primes would pay to prove compliance, or prefer to keep chains informal.

The pilot plan is designed to answer these first.

### The product works (tested)

| What | How it's checked | Result |
|---|---|---|
| Acceptance cascades through every tier | `npm run e2e` on a 5-node local Canton network | 3 tiers accept in about 1.4 seconds |
| No firm receives a contract it isn't party to | Privacy check reads everything that reached each node | Each subcontract is stored on exactly its two firms' nodes |
| The privacy check catches real leaks | 4 self-tests with planted leaks | All caught |
| Contract rules hold | 4 Daml Script tests, including 8 guard cases (term over the legal cap, wrong signer, wrong amount, wrong currency…) | All pass |
| Late payment is recorded as late | Daml test that passes 31 days | Receipt marked late |

## Success criteria for a pilot

| Metric | Target | Why it matters |
|---|---|---|
| Time from client acceptance to the last tier knowing | Under 1 day (from days or weeks today) | The core claim |
| Share of obligations paid within their term | Above the prime's current rate, measured before the pilot | The outcome the law asks for |
| Dues over 45 days at the half-year Form I filing | Lower than the previous filing | What the CFO reports |
| Downstream firms who join when invited | Most of them | Tests "downstream joins free" |
| Privacy incidents | Zero | Tests whether firms trust it with real contracts |
