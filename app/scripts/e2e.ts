// End-to-end run on a live Canton ledger: set up the chain, the client
// accepts, each firm's automation accepts back to back, everyone pays,
// then every party's full event stream is checked for leaks.
import { acceptMilestone, backToBackTick, payAll, setupChain } from "../src/chain.js";
import { config } from "../src/config.js";
import { type Obligation, type Receipt, Templates } from "../src/contracts.js";
import { Ledger } from "../src/ledger.js";
import { checkPrivacy } from "../src/privacy.js";
import { loadScenario, partyId, saveRun } from "../src/scenario.js";

const ledger = new Ledger(config.ledgerUrl, config.userId);
const scenario = loadScenario();
const runId = Date.now().toString(36);

console.log(`Ledger ${config.ledgerUrl}, run ${runId}`);
const run = await setupChain(ledger, scenario, runId);
saveRun(run);
console.log(`Set up ${scenario.parties.length} parties and ${scenario.links.length} signed links`);

// Every firm that has a downstream link runs its own automation.
const tiers = [...new Set(scenario.links.filter((l) => l.upstream).map((l) => l.payer))];
let stop = false;
const loops = tiers.map(async (key) => {
  const me = partyId(run, key);
  while (!stop) {
    for (const m of await backToBackTick(ledger, me)) console.log(`  ${key} accepted ${m} back to back`);
    await new Promise((r) => setTimeout(r, config.pollMs));
  }
});

const root = scenario.links.find((l) => !l.upstream);
if (!root) throw new Error("scenario has no root link");
const t0 = Date.now();
await acceptMilestone(ledger, partyId(run, root.payer), root.milestone);
console.log(`${root.payer} accepted ${root.milestone}`);

// Wait until every link has an obligation, bounded by a few poll cycles per tier.
const deadline = t0 + config.pollMs * 10 * scenario.links.length;
const accepted = new Map<string, Obligation>();
while (accepted.size < scenario.links.length) {
  if (Date.now() > deadline) throw new Error(`cascade incomplete: ${accepted.size}/${scenario.links.length} accepted`);
  for (const link of scenario.links) {
    const me = partyId(run, link.payee);
    const o = (await ledger.active<Obligation>(me, Templates.Obligation)).find((x) => x.payload.terms.milestone === link.milestone);
    if (o) accepted.set(link.milestone, o.payload);
  }
}
console.log(`Cascade done in ${Date.now() - t0} ms`);
for (const link of scenario.links) {
  const o = accepted.get(link.milestone)!;
  console.log(`  ${link.payee.padEnd(10)} accepted ${o.acceptedAt}  due ${o.dueAt}`);
}
stop = true;
await Promise.all(loops);

for (const link of scenario.links) {
  for (const m of await payAll(ledger, partyId(run, link.payer))) console.log(`${link.payer} paid ${m}`);
}
for (const link of scenario.links) {
  const r = (await ledger.active<Receipt>(partyId(run, link.payee), Templates.Receipt)).find((x) => x.payload.terms.milestone === link.milestone);
  if (!r) throw new Error(`no receipt for ${link.milestone}`);
  console.log(`  receipt ${link.milestone}: ${r.payload.onTime ? "on time" : "LATE"}`);
}

const reports = await checkPrivacy(ledger, scenario, run);
let leaks = 0;
console.log("\nPrivacy check (every transaction each party was sent):");
for (const r of reports) {
  console.log(`  ${r.party.padEnd(10)} ${String(r.transactions).padStart(3)} txs ${String(r.events).padStart(3)} events  own amounts [${r.ownAmounts.join(", ")}]  ${r.problems.length ? "LEAK" : "ok"}`);
  for (const p of r.problems) console.log(`      - ${p}`);
  leaks += r.problems.length;
}
if (leaks) {
  console.error(`\n${leaks} privacy problem(s) found`);
  process.exit(1);
}
console.log("\nAll checks passed.");
