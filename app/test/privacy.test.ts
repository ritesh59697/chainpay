// Proves the privacy checker catches leaks, using made-up events on a fake
// ledger, so its "ok" on the real network means something.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Templates } from "../src/contracts.js";
import type { Ledger, Transaction } from "../src/ledger.js";
import type { Nodes } from "../src/network.js";
import { checkPrivacy } from "../src/privacy.js";
import type { RunState, Scenario } from "../src/scenario.js";

const scenario: Scenario = {
  currency: "INR",
  statutoryMaxDays: 45,
  statutorySource: "test",
  rules: [],
  parties: [
    { key: "prime", hint: "P", label: "prime" },
    { key: "agency", hint: "A", label: "agency" },
    { key: "freelancer", hint: "F", label: "freelancer" },
  ],
  links: [
    { payer: "prime", payee: "agency", milestone: "UP", description: "", amount: "600000", termDays: 45 },
    { payer: "agency", payee: "freelancer", milestone: "DOWN", upstream: "UP", description: "", amount: "350000", termDays: 30 },
  ],
  funding: [],
};
const run: RunState = {
  runId: "t",
  startOffsets: { "node-prime": 0, "node-agency": 0, "node-freelancer": 0 },
  parties: {
    prime: { id: "P::1", label: "", node: "node-prime" },
    agency: { id: "A::1", label: "", node: "node-agency" },
    freelancer: { id: "F::1", label: "", node: "node-freelancer" },
  },
};

const created = (templateId: string, contractId: string, args: object, signatories: string[], observers: string[] = []) => ({
  CreatedEvent: { templateId: templateId.replace("#", "pkg"), contractId, createArgument: args, signatories, observers },
});

/** One fake node per party; `seen` lists what reached each party's node. */
function fakeLedger(seen: Record<string, unknown[]>): Nodes {
  const ledgerOf = (key: string) =>
    ({
      ledgerEnd: async () => 10,
      transactionsSeenBy: async () => [{ events: seen[key] ?? [] } as unknown as Transaction],
    }) as unknown as Ledger;
  return { of: ledgerOf, nodeOf: (key: string) => `node-${key}` } as unknown as Nodes;
}

const upstreamLink = created(Templates.Subcontract, "c-up", { payer: "P::1", payee: "A::1", terms: { amount: "600000.0000000000" } }, ["P::1", "A::1"]);
const ownLink = created(Templates.Subcontract, "c-down", { payer: "A::1", payee: "F::1", terms: { amount: "350000.0000000000" } }, ["A::1", "F::1"]);

test("a clean view passes", async () => {
  const reports = await checkPrivacy(fakeLedger({ freelancer: [ownLink], agency: [ownLink, upstreamLink] }), scenario, run);
  for (const r of reports) assert.deepEqual(r.problems, [], r.party);
  assert.equal(reports.find((r) => r.party === "freelancer")?.events, 1);
});

test("a divulged upstream contract is caught", async () => {
  const reports = await checkPrivacy(fakeLedger({ freelancer: [ownLink, upstreamLink] }), scenario, run);
  const problems = reports.find((r) => r.party === "freelancer")?.problems ?? [];
  assert.ok(problems.some((p) => p.includes("without being a party")), problems.join("; "));
  assert.ok(problems.some((p) => p.includes("600000")), problems.join("; "));
});

test("an upstream amount inside an own contract is caught", async () => {
  const leaky = created(Templates.Obligation, "c-o", { payer: "A::1", payee: "F::1", terms: { amount: "350000.0" }, note: "600000.0" }, ["A::1", "F::1"]);
  const reports = await checkPrivacy(fakeLedger({ freelancer: [leaky] }), scenario, run);
  const problems = reports.find((r) => r.party === "freelancer")?.problems ?? [];
  assert.ok(problems.some((p) => p.includes("600000")), problems.join("; "));
});

test("seeing someone else's cash move is caught, except cash handed to you", async () => {
  const othersCash = { ExercisedEvent: { templateId: Templates.Cash.replace("#", "pkg"), contractId: "cash-x", choice: "Split", choiceArgument: { splitAmount: "200000.0" } } };
  const handedOver = { ExercisedEvent: { templateId: Templates.Cash.replace("#", "pkg"), contractId: "cash-y", choice: "Transfer", choiceArgument: { newOwner: "F::1" } } };
  const reports = await checkPrivacy(fakeLedger({ freelancer: [ownLink, othersCash, handedOver] }), scenario, run);
  const problems = reports.find((r) => r.party === "freelancer")?.problems ?? [];
  assert.equal(problems.filter((p) => p.includes("Split")).length, 1, problems.join("; "));
  assert.equal(problems.filter((p) => p.includes("Transfer")).length, 0, problems.join("; "));
});
