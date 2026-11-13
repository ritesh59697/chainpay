// End-to-end run on a live Canton ledger: set up the chain, the client
// accepts, each firm's automation accepts back to back, everyone pays,
// then every party's full event stream is checked for leaks.
import { acceptMilestone, backToBackTick, payAll, setupChain } from "../src/chain.js";
import { config } from "../src/config.js";
import { type Obligation, type Receipt, Templates } from "../src/contracts.js";
import { Nodes } from "../src/network.js";
import { checkPrivacy, whereContractsLive } from "../src/privacy.js";
import { eventually } from "../src/settle.js";
import { loadScenario, partyId, saveRun } from "../src/scenario.js";

const scenario = loadScenario();
const nodes = new Nodes(scenario.parties.map((p) => p.key));
const runId = Date.now().toString(36);

console.log(`${config.topology === "network" ? `Network of ${nodes.all.length} nodes` : `Sandbox ${config.ledgerUrl}`}, run ${runId}`);
const run = await setupChain(nodes, scenario, runId);
saveRun(run);
console.log(`Set up ${scenario.parties.length} parties and ${scenario.links.length} signed links`);

// Every firm that has a downstream link runs its own automation.
const tiers = [...new Set(scenario.links.filter((l) => l.upstream).map((l) => l.payer))];
let stop = false;
const loops = tiers.map(async (key) => {
  const me = partyId(run, key);
  while (!stop) {
    for (const m of await backToBackTick(nodes.of(key), me)) console.log(`  ${key} accepted ${m} back to back`);
    await new Promise((r) => setTimeout(r, config.pollMs));
  }
});

const root = scenario.links.find((l) => !l.upstream);
if (!root) throw new Error("scenario has no root link");
const t0 = Date.now();
await acceptMilestone(nodes.of(root.payer), partyId(run, root.payer), root.milestone);
console.log(`${root.payer} accepted ${root.milestone}`);

// Wait until every link has an obligation, bounded by a few poll cycles per tier.
const deadline = t0 + config.pollMs * 10 * scenario.links.length;
const accepted = new Map<string, Obligation>();
while (accepted.size < scenario.links.length) {
  if (Date.now() > deadline) throw new Error(`cascade incomplete: ${accepted.size}/${scenario.links.length} accepted`);
  for (const link of scenario.links) {
    const me = partyId(run, link.payee);
    const o = (await nodes.of(link.payee).active<Obligation>(me, Templates.Obligation)).find((x) => x.payload.terms.milestone === link.milestone);
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
  for (const m of await payAll(nodes.of(link.payer), partyId(run, link.payer))) console.log(`${link.payer} paid ${m}`);
}
for (const link of scenario.links) {
  const payee = partyId(run, link.payee);
  const r = await eventually(`${link.payee}'s receipt for ${link.milestone}`, async () =>
    (await nodes.of(link.payee).active<Receipt>(payee, Templates.Receipt)).find((x) => x.payload.terms.milestone === link.milestone),
  );
  console.log(`  receipt ${link.milestone}: ${r.payload.onTime ? "on time" : "LATE"}`);
}

const reports = await checkPrivacy(nodes, scenario, run);
let leaks = 0;
console.log(config.topology === "network" ? "\nPrivacy check (everything that reached each firm's own node):" : "\nPrivacy check (every transaction each party was sent):");
for (const r of reports) {
  console.log(`  ${r.party.padEnd(10)} ${nodes.nodeOf(r.party).padEnd(12)} ${String(r.transactions).padStart(3)} txs ${String(r.events).padStart(3)} events  own amounts [${r.ownAmounts.join(", ")}]  ${r.problems.length ? "LEAK" : "ok"}`);
  for (const p of r.problems) console.log(`      - ${p}`);
  leaks += r.problems.length;
}
if (config.topology === "network") {
  console.log(`\nWhich nodes hold each subcontract (of ${nodes.all.length}):`);
  const where = await whereContractsLive(nodes, run);
  for (const link of scenario.links) {
    const held = where.get(link.milestone) ?? [];
    const expected = [nodes.nodeOf(link.payer), nodes.nodeOf(link.payee)];
    const extra = held.filter((n) => !expected.includes(n));
    console.log(`  ${link.milestone.padEnd(20)} ${held.join(", ")}${extra.length ? "  LEAK" : ""}`);
    leaks += extra.length;
  }
}
if (leaks) {
  console.error(`\n${leaks} privacy problem(s) found`);
  process.exit(1);
}
console.log("\nAll checks passed.");
