import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { config, repoRoot } from "./config.js";
import { Ledger } from "./ledger.js";

export interface NetworkNode {
  name: string;
  hosts: string[];
  ledgerPort: number;
  adminPort: number;
  httpPort: number;
}

export interface Network {
  synchronizer: string;
  sequencer: { publicPort: number; adminPort: number };
  mediator: { adminPort: number };
  nodes: NetworkNode[];
}

export function loadNetwork(path = config.networkFile): Network {
  const network = JSON.parse(readFileSync(path, "utf8")) as Network;
  const hosted = network.nodes.flatMap((n) => n.hosts);
  const dup = hosted.find((k, i) => hosted.indexOf(k) !== i);
  if (dup) throw new Error(`party ${dup} is hosted on more than one node in ${path}`);
  return network;
}

/** Canton config (HOCON) for one sequencer, one mediator and one participant per node, all in memory. */
export function cantonConfig(network: Network): string {
  const memory = `storage { type = "memory" }`;
  const participants = network.nodes
    .map(
      (n) => `    ${n.name} {
      ${memory}
      admin-api { port = ${n.adminPort} }
      ledger-api { port = ${n.ledgerPort}, user-management-service { enabled = true } }
      http-ledger-api { port = ${n.httpPort} }
    }`,
    )
    .join("\n");
  return `canton {
  sequencers {
    sequencer1 {
      ${memory}
      public-api { port = ${network.sequencer.publicPort} }
      admin-api { port = ${network.sequencer.adminPort} }
      sequencer { type = "reference", config { ${memory} } }
    }
  }
  mediators {
    mediator1 {
      ${memory}
      admin-api { port = ${network.mediator.adminPort} }
    }
  }
  participants {
${participants}
  }
}
`;
}

/** The Canton jar dpm installed for this project's SDK version, unless CANTON_JAR points elsewhere. */
export function cantonJar(): string {
  if (process.env.CANTON_JAR) return process.env.CANTON_JAR;
  const yaml = readFileSync(resolve(repoRoot, "multi-package.yaml"), "utf8");
  const version = yaml.match(/^sdk-version:\s*(\S+)/m)?.[1];
  if (!version) throw new Error("multi-package.yaml has no sdk-version");
  const dpmHome = process.env.DPM_HOME ?? resolve(homedir(), ".dpm");
  const jar = resolve(dpmHome, "cache/components/canton-open-source", version, "lib", `canton-open-source-${version}.jar`);
  if (!existsSync(jar)) throw new Error(`No Canton jar at ${jar}. Run "dpm install ${version}" or set CANTON_JAR.`);
  return jar;
}

/**
 * Which ledger each party talks to. In "network" mode every firm has its own
 * participant node; in "sandbox" mode all parties share one node.
 */
export class Nodes {
  private readonly byParty = new Map<string, { node: string; ledger: Ledger }>();
  readonly all: { node: string; ledger: Ledger }[] = [];

  constructor(partyKeys: string[]) {
    if (config.topology === "sandbox") {
      const entry = { node: "sandbox", ledger: new Ledger(config.ledgerUrl, config.userId) };
      this.all.push(entry);
      for (const key of partyKeys) this.byParty.set(key, entry);
      return;
    }
    const network = loadNetwork();
    for (const n of network.nodes) {
      const entry = { node: n.name, ledger: new Ledger(`http://${config.networkHost}:${n.httpPort}`, config.userId) };
      this.all.push(entry);
      for (const key of n.hosts) this.byParty.set(key, entry);
    }
    const missing = partyKeys.filter((k) => !this.byParty.has(k));
    if (missing.length) throw new Error(`no node hosts ${missing.join(", ")} in ${config.networkFile}`);
  }

  of(partyKey: string): Ledger {
    return this.entry(partyKey).ledger;
  }

  nodeOf(partyKey: string): string {
    return this.entry(partyKey).node;
  }

  private entry(partyKey: string) {
    const e = this.byParty.get(partyKey);
    if (!e) throw new Error(`no node for party ${partyKey}`);
    return e;
  }
}
