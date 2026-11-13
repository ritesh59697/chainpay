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

export const config = {
  ledgerUrl: required("LEDGER_URL"),
  userId: required("LEDGER_USER_ID"),
  pollMs: positiveInt("AUTOMATION_POLL_MS"),
  scenarioFile: resolve(repoRoot, required("SCENARIO_FILE")),
  runFile: resolve(repoRoot, required("RUN_FILE")),
  daml: damlPackage(),
};
