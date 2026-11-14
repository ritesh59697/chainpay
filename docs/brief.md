# Sluice: one-page brief

**One client sign-off pays the whole subcontract chain on time, and no firm sees anyone else's contract.**

## Problem

Indian IT work is delivered through chains. A foreign client pays an Indian IT services firm, which subcontracts to small agencies, which subcontract to freelancers. When the client accepts a milestone, that news travels down the chain by email, if at all. Each tier waits on the one above, so the smallest firms at the bottom wait longest.

The law says they shouldn't have to:

- Agreed payment terms to a registered micro or small supplier can't exceed **45 days from accepting its work** (MSMED Act 2006, s.15).
- Paying later adds compound interest at **three times the RBI bank rate**, with monthly rests (s.16).
- A sum still overdue and unpaid on **31 March** isn't tax-deductible that year (Income-tax Act 2025, s.37(2)(g), formerly 43B(h)).
- Companies must report dues to micro and small suppliers that are more than 45 days old, every half year (MSME Form I).

The scale of late payment is large:

- About **₹8.1 lakh crore** is locked in delayed payments to MSMEs (Economic Survey estimate, reported January 2026).
- Small firms filed **2,56,892 cases** worth **₹55,244 crore** on the government's MSME Samadhaan portal by December 2025. About ₹21,000–22,000 crore was still pending.

## Why it isn't solved

A shared portal for the chain would fix the information gap, but no firm will join one. The IT firm's contract with the client shows what the client pays. Its contract with the agency shows what the agency gets. Put both where the agency can see them and the IT firm's margin is public. So every tier keeps its own records, and the client's acceptance never reaches the bottom of the chain on time.

## What Sluice does

- Each link in the chain is its own contract between two firms, on Canton.
- When the client accepts the work, each firm's automation accepts its own supplier's work at once. That starts each tier's own 45-day clock, with its own due date.
- Each payer pays and gets a receipt marked on time or late. Each firm has a history it can hand to its accountant.
- No firm ever receives a contract it isn't party to. The demo proves this by reading everything that reached each firm's node.

## Who it's for (ICP)

- **Buyer:** mid-size Indian IT services firms that act as the prime contractor and subcontract milestone work to registered small agencies and freelancers. The buyer is the CFO or head of accounts payable, who carries the s.37(2)(g) and Form I exposure.
- **Also served:** small agencies in the middle of chains. They are on both sides of the rule: owed by the prime, owing the freelancer.
- **Users:** delivery and vendor managers who accept work today by email.

## Who pays

The prime contractor pays a flat fee per active subcontract per month. Downstream tiers join free, because each firm the prime invites makes the prime's records complete. The price level is a hypothesis to set during the pilot.

## Why Canton

- **Privacy is part of the protocol.** Each firm runs or uses its own participant node, which receives only the contracts that firm is party to. Nobody trusts an operator to keep margins hidden.
- **One shared truth without a shared database.** Every tier sees the same acceptance at the same moment, with ledger timestamps that hold up later.
- **Multi-party workflows are native.** Both firms sign each link; acceptance, obligation and payment are enforced by the contract, not by email.

## Why now

The 45-day deduction rule took effect for FY 2023-24 and carries into the new Income-tax Act from tax year 2026-27. Parliament passed the MSMED (Amendment) Bill in August 2026 to speed up recovery of delayed payments. Primes are under more pressure than ever to prove they paid on time.

## Honest status

Working MVP on a local Canton network (one node per firm), with tests and a privacy check. Payments use a demo token. No user interviews have been run. Sluice tracks dates; it isn't tax or legal advice.

## Sources

- Rajya Sabha reply on s.43B(h) and s.37(2)(g), 21 July 2026: <https://a2ztaxcorp.net/wp-content/uploads/2026/07/RS-SECTION-43BH-OF-THE-INCOME-TAX-ACT-21.07.2026.pdf>
- ₹8.1 lakh crore estimate: <https://www.businesstoday.in/industry/story/rs-81-lakh-crore-stuck-in-dues-msme-growth-hinges-on-dispute-reform-warns-white-paper-518307-2026-02-27>
- MSME Samadhaan cases (Crisil, via PSU Watch): <https://psuwatch.com/newsupdates/msme-bill-could-be-an-ibc-moment-for-small-enterprises-facing-payment-delays-report>
- MSMED (Amendment) Bill 2026 passed: <https://www.newkerala.com/news/a/parliament-passes-msme-amendment-bill-reforms-aim-address-928.htm>
- 45-day rule explained: <https://busy.in/accounting/section-43bh-msme-payment-rule-and-45-day-limit-explained/>
