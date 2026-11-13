import { readFileSync } from "node:fs";
import { config } from "./config.js";
import {
  type Cash,
  type Obligation,
  type Receipt,
  type Subcontract,
  type UpstreamAcceptance,
  Templates,
  create,
  exercise,
  sameAmount,
} from "./contracts.js";
import type { Ledger } from "./ledger.js";
import { type RunState, type Scenario, partyId } from "./scenario.js";

/** Uploads the contracts, allocates the run's parties and signs every link. */
export async function setupChain(ledger: Ledger, scenario: Scenario, runId: string): Promise<RunState> {
  await ledger.uploadDar(readFileSync(config.daml.darPath));
  const startOffset = await ledger.ledgerEnd();

  const run: RunState = { runId, startOffset, parties: {} };
  for (const p of scenario.parties) {
    run.parties[p.key] = { id: await ledger.allocateParty(`${p.hint}-${runId}`), label: p.label };
  }

  for (const link of scenario.links) {
    const payer = partyId(run, link.payer);
    const payee = partyId(run, link.payee);
    const proposal: Subcontract = {
      payer,
      payee,
      terms: {
        milestone: link.milestone,
        description: link.description,
        amount: link.amount,
        currency: scenario.currency,
        termDays: String(link.termDays),
        statutoryMaxDays: String(scenario.statutoryMaxDays),
      },
      upstreamMilestone: link.upstream ?? null,
    };
    const tx = await ledger.submit(payer, [create(Templates.Proposal, proposal)]);
    const proposalId = createdIds(tx.events, Templates.Proposal)[0];
    if (!proposalId) throw new Error(`proposal for ${link.milestone} was not created`);
    await ledger.submit(payee, [exercise(Templates.Proposal, proposalId, "Sign", {})]);
  }

  for (const f of scenario.funding) {
    const issuer = partyId(run, f.issuer);
    const cash: Cash = { issuer, owner: partyId(run, f.to), amount: f.amount, currency: scenario.currency };
    await ledger.submit(issuer, [create(Templates.Cash, cash)]);
  }
  return run;
}

function createdIds(events: { CreatedEvent?: { templateId: string; contractId: string } }[] | unknown[], templateId: string) {
  const entity = templateId.split(":").slice(1).join(":");
  return (events as { CreatedEvent?: { templateId: string; contractId: string } }[])
    .flatMap((e) => (e.CreatedEvent && e.CreatedEvent.templateId.endsWith(entity) ? [e.CreatedEvent.contractId] : []));
}

/** The end client accepts the work on one of its links. */
export async function acceptMilestone(ledger: Ledger, payer: string, milestone: string): Promise<void> {
  const links = await ledger.active<Subcontract>(payer, Templates.Subcontract);
  const link = links.find((l) => l.payload.payer === payer && l.payload.terms.milestone === milestone);
  if (!link) throw new Error(`${payer} has no open link for milestone ${milestone}`);
  await ledger.submit(payer, [
    exercise(Templates.Subcontract, link.contractId, "AcceptMilestone", { trigger: null }),
  ]);
}

/**
 * One pass of a firm's back-to-back automation, acting only as `party`:
 * when its own client has accepted its work, accept its supplier's work on
 * the matching link. The upstream milestone and time are passed as values;
 * the upstream contract is never fetched, so it is never shown downstream.
 */
export async function backToBackTick(ledger: Ledger, party: string): Promise<string[]> {
  const accepted = new Map<string, UpstreamAcceptance>();
  for (const { payload } of await ledger.active<Obligation>(party, Templates.Obligation)) {
    if (payload.payee === party) accepted.set(payload.terms.milestone, { milestone: payload.terms.milestone, acceptedAt: payload.acceptedAt });
  }
  for (const { payload } of await ledger.active<Receipt>(party, Templates.Receipt)) {
    if (payload.payee === party) accepted.set(payload.terms.milestone, { milestone: payload.terms.milestone, acceptedAt: payload.acceptedAt });
  }
  if (accepted.size === 0) return [];

  const done: string[] = [];
  for (const link of await ledger.active<Subcontract>(party, Templates.Subcontract)) {
    const upstream = link.payload.upstreamMilestone;
    const trigger = upstream ? accepted.get(upstream) : undefined;
    if (link.payload.payer !== party || !trigger) continue;
    await ledger.submit(party, [exercise(Templates.Subcontract, link.contractId, "AcceptMilestone", { trigger })]);
    done.push(link.payload.terms.milestone);
  }
  return done;
}

/** Pays every open obligation `payer` has, splitting off exact amounts first. */
export async function payAll(ledger: Ledger, payer: string): Promise<string[]> {
  const paid: string[] = [];
  const owed = (await ledger.active<Obligation>(payer, Templates.Obligation)).filter((o) => o.payload.payer === payer);
  for (const o of owed) {
    const holdings = (await ledger.active<Cash>(payer, Templates.Cash)).filter(
      (c) => c.payload.owner === payer && c.payload.currency === o.payload.terms.currency,
    );
    const amount = o.payload.terms.amount;
    let cashId = holdings.find((c) => sameAmount(c.payload.amount, amount))?.contractId;
    if (!cashId) {
      const big = holdings.find((c) => Number(c.payload.amount) > Number(amount));
      if (!big) throw new Error(`${payer} has no holding large enough to pay ${o.payload.terms.milestone}`);
      const tx = await ledger.submit(payer, [exercise(Templates.Cash, big.contractId, "Split", { splitAmount: amount })]);
      const created = await ledger.active<Cash>(payer, Templates.Cash);
      const fromSplit = new Set(createdIds(tx.events, Templates.Cash));
      cashId = created.find((c) => fromSplit.has(c.contractId) && sameAmount(c.payload.amount, amount))?.contractId;
      if (!cashId) throw new Error(`split for ${o.payload.terms.milestone} did not produce the exact amount`);
    }
    await ledger.submit(payer, [exercise(Templates.Obligation, o.contractId, "Pay", { cashCid: cashId })]);
    paid.push(o.payload.terms.milestone);
  }
  return paid;
}
