import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

export interface ScenarioParty {
  key: string;
  hint: string;
  label: string;
}

export interface ScenarioLink {
  payer: string;
  payee: string;
  milestone: string;
  upstream?: string;
  description: string;
  amount: string;
  termDays: number;
}

export interface Scenario {
  currency: string;
  statutoryMaxDays: number;
  statutorySource: string;
  parties: ScenarioParty[];
  links: ScenarioLink[];
  funding: { issuer: string; to: string; amount: string }[];
}

export function loadScenario(path = config.scenarioFile): Scenario {
  const scenario = JSON.parse(readFileSync(path, "utf8")) as Scenario;
  const keys = new Set(scenario.parties.map((p) => p.key));
  for (const link of scenario.links) {
    for (const key of [link.payer, link.payee]) {
      if (!keys.has(key)) throw new Error(`scenario link ${link.milestone} names unknown party ${key}`);
    }
    if (link.termDays > scenario.statutoryMaxDays) {
      throw new Error(`scenario link ${link.milestone} has a term above the statutory cap`);
    }
  }
  return scenario;
}

/** The parties and starting offset of one demo run, written by setup. */
export interface RunState {
  runId: string;
  /** Ledger end of each node before the run, so checks only read this run. */
  startOffsets: Record<string, number>;
  parties: Record<string, { id: string; label: string; node: string }>;
}

export function saveRun(run: RunState, path = config.runFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(run, null, 2));
}

export function loadRun(path = config.runFile): RunState {
  if (!existsSync(path)) throw new Error(`No run found at ${path}. Run "npm run e2e" first.`);
  return JSON.parse(readFileSync(path, "utf8")) as RunState;
}

export function partyId(run: RunState, key: string): string {
  const party = run.parties[key];
  if (!party) throw new Error(`run has no party ${key}`);
  return party.id;
}
