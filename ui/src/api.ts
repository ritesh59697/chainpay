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

export interface Meta {
  topology: "network" | "sandbox";
  pollMs: number;
  statutoryMaxDays: number;
  statutorySource: string;
  currency: string;
  nodes: string[];
  parties: { key: string; hint: string; node: string }[];
  panes: { key: string; label: string; hint: string; node: string; automation: boolean | null }[];
  root: string | null;
  runId: string | null;
  busy: boolean;
}

export interface PrivacyResult {
  scope: "node" | "party";
  reports: { party: string; label: string; node: string; transactions: number; events: number; problems: string[] }[];
  links: { milestone: string; expected: string[]; heldBy: string[] | null }[];
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${method} ${path} failed (${res.status})`);
  return data;
}

export const api = {
  meta: () => call<Meta>("GET", "/meta"),
  setup: () => call<{ runId: string }>("POST", "/setup"),
  view: (key: string) => call<PaneView>("GET", `/view/${key}`),
  accept: (key: string, milestone: string) => call("POST", `/accept/${key}`, { milestone }),
  pay: (key: string) => call<{ paid: string[] }>("POST", `/pay/${key}`),
  automation: (key: string, on: boolean) => call<{ on: boolean }>("POST", `/automation/${key}`, { on }),
  privacy: () => call<PrivacyResult>("GET", "/privacy"),
};

export function money(amount: string, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const daysBetween = (fromIso: string, to: Date) => Math.floor((to.getTime() - new Date(fromIso).getTime()) / DAY_MS);
