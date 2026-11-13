# ChainPay

When the end client signs off a milestone, every firm down the subcontracting chain learns it at the same moment, its own payment clock starts, and nobody sees anyone else's contract or margin.

Built on Canton (Daml) for HackCanton Season 4. Work in progress.

## What's here

- `daml/chainpay`: the contracts. A subcontract link, the payment obligation created when its payer accepts the work, a receipt, and a demo payment token.
- `daml/chainpay-tests`: Daml Script tests for the full chain: back-to-back acceptance, privacy at every stage, late payment, and the rules the ledger enforces.

## Run the tests

Needs the Daml SDK (`dpm`) 3.7. On Apple Silicon, also needs Rosetta 2.

```bash
dpm build --all
cd daml/chainpay-tests && dpm test
```

Note: the Daml 3.7 compiler fails on paths that contain spaces, so clone into a path without them.

## Honest limits

- Payments use a **demo token**, not money. Real settlement would go over bank rails, with ChainPay recording the obligation and proof of payment.
- ChainPay tracks payment dates. It isn't tax or legal advice.
