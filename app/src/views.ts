import { type Cash, type Obligation, type Receipt, type Subcontract, Templates, normDecimal } from "./contracts.js";
import type { Ledger } from "./ledger.js";
import type { RunState } from "./scenario.js";

export type LinkStatus = "proposed" | "signed" | "accepted" | "paid";

export interface LinkView {
  contractId: string;
  milestone: string;
  description: string;
  amount: string;
  currency: string;
  termDays: number;
  role: "payer" | "payee";
  counterparty: string;
  upstreamMilestone: string | null;
  status: LinkStatus;
  acceptedAt?: string;
  dueAt?: string;
  paidAt?: string;
  onTime?: boolean;
}

export interface PaneView {
  key: string;
  label: string;
  partyId: string;
  node: string;
  links: LinkView[];
  cash: { amount: string; currency: string }[];
}

const rank: Record<LinkStatus, number> = { proposed: 0, signed: 1, accepted: 2, paid: 3 };

/**
 * One party's view, read only from that party's own node and only through
 * contracts it is a stakeholder of. Display names come from the run file.
 */
export async function paneView(ledger: Ledger, run: RunState, key: string, displayName: (partyId: string) => string): Promise<PaneView> {
  const me = run.parties[key];
  if (!me) throw new Error(`run has no party ${key}`);

  const [proposals, links, obligations, receipts, cash] = await Promise.all([
    ledger.active<Subcontract>(me.id, Templates.Proposal),
    ledger.active<Subcontract>(me.id, Templates.Subcontract),
    ledger.active<Obligation>(me.id, Templates.Obligation),
    ledger.active<Receipt>(me.id, Templates.Receipt),
    ledger.active<Cash>(me.id, Templates.Cash),
  ]);

  const byMilestone = new Map<string, LinkView>();
  const add = (contractId: string, p: Subcontract, status: LinkStatus, extra: Partial<LinkView> = {}) => {
    const role = p.payer === me.id ? "payer" : "payee";
    const view: LinkView = {
      contractId,
      milestone: p.terms.milestone,
      description: p.terms.description,
      amount: normDecimal(p.terms.amount),
      currency: p.terms.currency,
      termDays: Number(p.terms.termDays),
      role,
      counterparty: displayName(role === "payer" ? p.payee : p.payer),
      upstreamMilestone: p.upstreamMilestone,
      status,
      ...extra,
    };
    const prev = byMilestone.get(view.milestone);
    if (!prev || rank[status] > rank[prev.status]) byMilestone.set(view.milestone, view);
  };
  for (const c of proposals) add(c.contractId, c.payload, "proposed");
  for (const c of links) add(c.contractId, c.payload, "signed");
  for (const c of obligations) add(c.contractId, c.payload, "accepted", { acceptedAt: c.payload.acceptedAt, dueAt: c.payload.dueAt });
  for (const c of receipts) {
    const r = c.payload;
    add(c.contractId, r, "paid", { acceptedAt: r.acceptedAt, dueAt: r.dueAt, paidAt: r.paidAt, onTime: r.onTime });
  }

  return {
    key,
    label: me.label,
    partyId: me.id,
    node: me.node,
    links: [...byMilestone.values()].sort((a, b) => (a.role === b.role ? 0 : a.role === "payee" ? -1 : 1)),
    cash: cash.filter((c) => c.payload.owner === me.id).map((c) => ({ amount: normDecimal(c.payload.amount), currency: c.payload.currency })),
  };
}
