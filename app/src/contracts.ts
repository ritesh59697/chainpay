import { config } from "./config.js";
import type { Command } from "./ledger.js";

const tid = (module: string, entity: string) => `#${config.daml.name}:${module}:${entity}`;

export const Templates = {
  Proposal: tid("ChainPay.Subcontract", "SubcontractProposal"),
  Subcontract: tid("ChainPay.Subcontract", "Subcontract"),
  Obligation: tid("ChainPay.Subcontract", "PaymentObligation"),
  Receipt: tid("ChainPay.Subcontract", "PaidReceipt"),
  Cash: tid("ChainPay.Cash", "DemoCash"),
};

/** Daml Decimal and Int values travel as strings in the JSON API. */
export interface Terms {
  milestone: string;
  description: string;
  amount: string;
  currency: string;
  termDays: string;
  statutoryMaxDays: string;
}

export interface UpstreamAcceptance {
  milestone: string;
  acceptedAt: string;
}

export interface Subcontract {
  payer: string;
  payee: string;
  terms: Terms;
  upstreamMilestone: string | null;
}

export interface Obligation extends Subcontract {
  trigger: UpstreamAcceptance | null;
  acceptedAt: string;
  dueAt: string;
}

export interface Receipt extends Obligation {
  paidAt: string;
  onTime: boolean;
  received: string;
}

export interface Cash {
  issuer: string;
  owner: string;
  amount: string;
  currency: string;
}

export const create = (templateId: string, createArguments: object): Command => ({
  CreateCommand: { templateId, createArguments },
});

export const exercise = (templateId: string, contractId: string, choice: string, choiceArgument: object): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});

/** Canonical form of a Daml Decimal string, so "350000" equals "350000.0000000000". */
export function normDecimal(value: string): string {
  const [whole = "0", frac = ""] = value.trim().split(".");
  const w = whole.replace(/^(-?)0+(?=\d)/, "$1");
  const f = frac.replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}

export const sameAmount = (a: string, b: string) => normDecimal(a) === normDecimal(b);
