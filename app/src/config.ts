import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const appRoot = resolve(here, "..");
export const repoRoot = resolve(appRoot, "..");

const envFile = resolve(appRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy app/.env.example to app/.env and fill it in.`);
  return value;
}

function positiveInt(name: string): number {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

/** Reads `name` and `version` from the contracts package's daml.yaml. */
function damlPackage(): { name: string; version: string; darPath: string } {
  const dir = resolve(repoRoot, "daml/chainpay");
  const yaml = readFileSync(resolve(dir, "daml.yaml"), "utf8");
  const field = (key: string) => {
    const match = yaml.match(new RegExp(`^${key}:\\s*(\\S+)`, "m"));
    if (!match?.[1]) throw new Error(`daml.yaml has no ${key}`);
    return match[1];
  };
  const name = field("name");
  const version = field("version");
  return { name, version, darPath: resolve(dir, ".daml/dist", `${name}-${version}.dar`) };
}

function topology(): "network" | "sandbox" {
  const value = required("LEDGER_TOPOLOGY");
  if (value !== "network" && value !== "sandbox") throw new Error('LEDGER_TOPOLOGY must be "network" or "sandbox"');
  return value;
}

const mode = topology();

export const config = {
  topology: mode,
  // Sandbox mode: the one node every party shares.
  ledgerUrl: mode === "sandbox" ? required("LEDGER_URL") : "",
  // Network mode: one node per firm, listed in the network file.
  networkFile: mode === "network" ? resolve(repoRoot, required("NETWORK_FILE")) : "",
  networkHost: mode === "network" ? required("NETWORK_HOST") : "",
  userId: required("LEDGER_USER_ID"),
  pollMs: positiveInt("AUTOMATION_POLL_MS"),
  // How long to wait for one node to see what another node just committed.
  settleMs: positiveInt("SETTLE_TIMEOUT_MS"),
  scenarioFile: resolve(repoRoot, required("SCENARIO_FILE")),
  runFile: resolve(repoRoot, required("RUN_FILE")),
  daml: damlPackage(),
};
