# ChainPay

When the end client signs off a milestone, every firm down the subcontracting chain learns it at the same moment, its own payment clock starts, and nobody sees anyone else's contract or margin.

Built on Canton (Daml) for HackCanton Season 4. Work in progress.

## What's here

- `daml/chainpay`: the contracts. A subcontract link, the payment obligation created when its payer accepts the work, a receipt, and a demo payment token.
- `daml/chainpay-tests`: Daml Script tests for the full chain: back-to-back acceptance, privacy at every stage, late payment, and the rules the ledger enforces.
- `app`: TypeScript on the Canton JSON Ledger API v2 (types generated from its OpenAPI spec). It starts a local Canton network with **one participant node per firm**, sets up a chain, runs each firm's back-to-back automation, pays, and checks privacy by reading **everything that reached each firm's node**.
- `ui`: the demo screen. Four panes, one per firm, each reading only from that firm's own node.
- `data/demo-scenario.json`: the demo chain (parties, amounts, payment terms). The 45-day legal cap is data here, with its source, not code.
- `data/network.json`: the nodes, their ports, and which party each node hosts.

## Run the tests

Needs the Daml SDK (`dpm`) 3.7. On Apple Silicon, also needs Rosetta 2.

```bash
dpm build --all
cd daml/chainpay-tests && dpm test
```

Run the whole flow on a local Canton network (needs Java 17+):

```bash
cd app && npm install && cp .env.example .env
npm run network                   # in its own terminal: 5 participant nodes + 1 synchronizer
npm test                          # privacy checker self-tests
npm run e2e                       # set up, accept, cascade, pay, privacy check per node
```

Open the demo screen:

```bash
npm run api                       # in app/, in its own terminal
cd ../ui && npm install && npm run dev
```

To use a single `dpm sandbox` instead, set `LEDGER_TOPOLOGY=sandbox` in `app/.env`.

Note: the Daml 3.7 compiler fails on paths that contain spaces, so clone into a path without them.

## Honest limits

- Payments use a **demo token**, not money. Real settlement would go over bank rails, with ChainPay recording the obligation and proof of payment.
- ChainPay tracks payment dates. It isn't tax or legal advice.
- The demo token's issuer sees token movements, as a bank would. It never sees a subcontract.
- The local network runs every node on one machine, in memory. It shows what each node receives; it isn't a production deployment.
- The 45-day clock on screen counts real days from acceptance. The demo doesn't fast-forward time; late payment is covered by the Daml tests.
