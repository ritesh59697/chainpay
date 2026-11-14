// Starts a local Canton network: one synchronizer and one participant node
// per firm, as listed in data/network.json. Runs until stopped (Ctrl+C).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "../src/config.js";
import { cantonConfig, cantonJar, loadNetwork } from "../src/network.js";

const network = loadNetwork();
const dir = resolve(repoRoot, ".local/network");
mkdirSync(dir, { recursive: true });
const conf = resolve(dir, "canton.conf");
writeFileSync(conf, cantonConfig(network));

console.log(`Starting ${network.nodes.length} participant nodes: ${network.nodes.map((n) => n.name).join(", ")}`);
const canton = spawn(
  "java",
  ["-jar", cantonJar(), "daemon", "--no-tty", "-c", conf, "--bootstrap", resolve(repoRoot, "network/bootstrap.canton"), "--log-file-name", resolve(dir, "canton.log")],
  { cwd: dir, stdio: "inherit", env: { ...process.env, SLUICE_SYNCHRONIZER: network.synchronizer } },
);
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => canton.kill(sig));
canton.on("exit", (code) => process.exit(code ?? 0));
