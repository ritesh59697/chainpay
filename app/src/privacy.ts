import { Templates, normDecimal } from "./contracts.js";
import { config } from "./config.js";
import type { Event } from "./ledger.js";
import type { Nodes } from "./network.js";
import { type RunState, type Scenario, partyId } from "./scenario.js";

export interface PrivacyReport {
  party: string;
  label: string;
  /** "node": everything the party's own node stored; "party": the party's view on a shared node. */
  scope: "node" | "party";
  transactions: number;
  events: number;
  ownAmounts: string[];
  problems: string[];
}

const entityOf = (templateId: string) => templateId.split(":").slice(1).join(":");
const CASH = entityOf(Templates.Cash);

/** Every Decimal-looking string anywhere inside a payload. */
function decimalsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value)) out.push(normDecimal(value));
  else if (Array.isArray(value)) value.forEach((v) => decimalsIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => decimalsIn(v, out));
  return out;
}

/**
 * Reads every transaction each party was sent, in full, and checks that:
 * (on a network with a node per firm, it reads everything that reached the
 * firm's node, for any party, which is the stronger check)
 *  1. every subcontract, obligation or receipt it was shown is one it is a party to;
 *  2. the only other contracts it saw are the exact payment it made or received;
 *  3. no amount appears anywhere except amounts from its own links and its own
 *     cash (the demo token issuer is a party to all token holdings, like a bank,
 *     but never to a subcontract).
 */
export async function checkPrivacy(nodes: Nodes, scenario: Scenario, run: RunState): Promise<PrivacyReport[]> {
  const reports: PrivacyReport[] = [];
  const scope = config.topology === "network" ? "node" : "party";

  for (const p of scenario.parties) {
    const me = partyId(run, p.key);
    const ledger = nodes.of(p.key);
    const node = nodes.nodeOf(p.key);
    const start = run.startOffsets[node];
    if (start === undefined) throw new Error(`run has no start offset for node ${node}`);
    const end = await ledger.ledgerEnd();
    const ownLinks = scenario.links.filter((l) => l.payer === p.key || l.payee === p.key);
    const allowed = new Set(ownLinks.map((l) => normDecimal(l.amount)));
    const txs = await ledger.transactionsSeenBy(scope === "node" ? null : me, start, end);
    const events: Event[] = txs.flatMap((t) => t.events ?? []);
    const problems: string[] = [];
    const stakeholderOf = new Set<string>();

    for (const e of events) {
      if ("CreatedEvent" in e) {
        const c = e.CreatedEvent;
        const stakeholders = [...(c.signatories ?? []), ...(c.observers ?? [])];
        const isCash = entityOf(c.templateId) === CASH;
        if (stakeholders.includes(me)) {
          stakeholderOf.add(c.contractId);
          // Cash it holds or issues is its own business.
          if (isCash) decimalsIn(c.createArgument).forEach((d) => allowed.add(d));
        } else {
          const amounts = decimalsIn(c.createArgument);
          const ownPayment = isCash && amounts.every((d) => allowed.has(d));
          if (!ownPayment) problems.push(`was shown ${entityOf(c.templateId)} ${c.contractId.slice(0, 12)} without being a party to it`);
        }
      }
    }

    for (const e of events) {
      if ("ExercisedEvent" in e) {
        const x = e.ExercisedEvent;
        if (stakeholderOf.has(x.contractId)) continue;
        const handedToMe =
          entityOf(x.templateId) === CASH && x.choice === "Transfer" && (x.choiceArgument as { newOwner?: string }).newOwner === me;
        if (!handedToMe) problems.push(`saw ${x.choice} on ${entityOf(x.templateId)} ${x.contractId.slice(0, 12)} it is not a party to`);
      }
    }

    for (const e of events) {
      const payload = "CreatedEvent" in e ? e.CreatedEvent.createArgument : "ExercisedEvent" in e ? [e.ExercisedEvent.choiceArgument, e.ExercisedEvent.exerciseResult] : null;
      for (const d of decimalsIn(payload)) if (!allowed.has(d)) problems.push(`saw amount ${d}, which is not from its own links or holdings`);
    }

    reports.push({
      party: p.key,
      label: p.label,
      scope,
      transactions: txs.length,
      events: events.length,
      ownAmounts: [...new Set(ownLinks.map((l) => normDecimal(l.amount)))],
      problems: [...new Set(problems)],
    });
  }
  return reports;
}

/** For each milestone, the nodes that ever stored a contract about it during the run. */
export async function whereContractsLive(nodes: Nodes, run: RunState): Promise<Map<string, string[]>> {
  const where = new Map<string, Set<string>>();
  for (const { node, ledger } of nodes.all) {
    const start = run.startOffsets[node];
    if (start === undefined) throw new Error(`run has no start offset for node ${node}`);
    const txs = await ledger.transactionsSeenBy(null, start, await ledger.ledgerEnd());
    for (const e of txs.flatMap((t) => t.events ?? [])) {
      if (!("CreatedEvent" in e)) continue;
      const milestone = (e.CreatedEvent.createArgument as { terms?: { milestone?: string } }).terms?.milestone;
      if (milestone) where.set(milestone, (where.get(milestone) ?? new Set()).add(node));
    }
  }
  return new Map([...where].map(([m, s]) => [m, [...s]]));
}
