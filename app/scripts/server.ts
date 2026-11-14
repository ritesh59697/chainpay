// The demo API. Every pane reads from and acts through its own firm's node;
// the server never merges one firm's data into another firm's view.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { acceptMilestone, backToBackTick, payAll, setupChain } from "../src/chain.js";
import { config } from "../src/config.js";
import { Nodes } from "../src/network.js";
import { checkPrivacy, whereContractsLive } from "../src/privacy.js";
import { type RunState, loadRun, loadScenario, partyId, saveRun } from "../src/scenario.js";
import { auditTrail, paneView } from "../src/views.js";

const port = Number(process.env.API_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error("Missing API_PORT in app/.env");

const scenario = loadScenario();
const nodes = new Nodes(scenario.parties.map((p) => p.key));
const panes = scenario.parties.filter((p) => scenario.links.some((l) => l.payer === p.key || l.payee === p.key));
const tiers = [...new Set(scenario.links.filter((l) => l.upstream).map((l) => l.payer))];
const automation = new Map(tiers.map((k) => [k, true]));
const log: { at: string; party: string; text: string }[] = [];
let run: RunState | null = null;
let busy = false;

function note(party: string, text: string) {
  log.push({ at: new Date().toISOString(), party, text });
  if (log.length > 200) log.shift();
  console.log(`[${party}] ${text}`);
}

/** Reuses the last run if its parties still exist (the local network forgets everything on restart). */
async function restoreRun() {
  try {
    const saved = loadRun();
    const first = scenario.parties[0];
    if (!first) return;
    const known = await nodes.of(first.key).listParties();
    if (known.includes(partyId(saved, first.key))) run = saved;
  } catch {
    run = null;
  }
}

// Each firm's back-to-back automation, acting only as that firm on its own node.
async function automationLoop() {
  for (;;) {
    if (run && !busy) {
      for (const key of tiers) {
        if (!automation.get(key)) continue;
        try {
          for (const m of await backToBackTick(nodes.of(key), partyId(run, key))) note(key, `accepted ${m} back to back`);
        } catch (err) {
          note(key, `automation error: ${String(err).slice(0, 200)}`);
        }
      }
    }
    await new Promise((r) => setTimeout(r, config.pollMs));
  }
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  for await (const chunk of req) text += chunk;
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

/** Display names are off-ledger labels from the scenario file. */
function displayName(r: RunState) {
  return (id: string) => scenario.parties.find((p) => r.parties[p.key]?.id === id)?.hint ?? id;
}

function requireRun(): RunState {
  if (!run) throw Object.assign(new Error("No demo chain yet. Set one up first."), { status: 409 });
  return run;
}

function paneKey(key: string | undefined): string {
  if (!key || !panes.some((p) => p.key === key)) throw Object.assign(new Error(`unknown pane ${key}`), { status: 404 });
  return key;
}

const routes: Record<string, (req: IncomingMessage, params: string[]) => Promise<unknown>> = {
  "GET /api/meta": async () => ({
    topology: config.topology,
    pollMs: config.pollMs,
    statutoryMaxDays: scenario.statutoryMaxDays,
    statutorySource: scenario.statutorySource,
    rules: scenario.rules,
    currency: scenario.currency,
    nodes: nodes.all.map((n) => n.node),
    parties: scenario.parties.map((p) => ({ key: p.key, hint: p.hint, node: nodes.nodeOf(p.key) })),
    panes: panes.map((p) => ({ key: p.key, label: p.label, hint: p.hint, node: nodes.nodeOf(p.key), automation: automation.has(p.key) ? automation.get(p.key) : null })),
    root: scenario.links.find((l) => !l.upstream)?.milestone ?? null,
    runId: run?.runId ?? null,
    busy,
  }),
  "POST /api/setup": async () => {
    if (busy) throw Object.assign(new Error("Setup already running"), { status: 409 });
    busy = true;
    try {
      log.length = 0;
      const next = await setupChain(nodes, scenario, Date.now().toString(36));
      saveRun(next);
      run = next;
      note("network", `new chain ${next.runId}: ${scenario.links.length} links signed, ${scenario.funding.length} payer funded`);
      return { runId: next.runId };
    } finally {
      busy = false;
    }
  },
  "GET /api/view/:key": async (_req, [key]) => {
    const r = requireRun();
    return paneView(nodes.of(paneKey(key)), r, paneKey(key), displayName(r));
  },
  "GET /api/audit/:key": async (_req, [key]) => {
    const r = requireRun();
    return auditTrail(nodes.of(paneKey(key)), r, paneKey(key), displayName(r));
  },
  "POST /api/accept/:key": async (req, [key]) => {
    const k = paneKey(key);
    const { milestone } = await body(req);
    if (typeof milestone !== "string") throw Object.assign(new Error("milestone required"), { status: 400 });
    await acceptMilestone(nodes.of(k), partyId(requireRun(), k), milestone);
    note(k, `accepted ${milestone}`);
    return { ok: true };
  },
  "POST /api/pay/:key": async (_req, [key]) => {
    const k = paneKey(key);
    const paid = await payAll(nodes.of(k), partyId(requireRun(), k));
    for (const m of paid) note(k, `paid ${m}`);
    return { paid };
  },
  "POST /api/automation/:key": async (req, [key]) => {
    const k = paneKey(key);
    if (!automation.has(k)) throw Object.assign(new Error(`${k} has no downstream link`), { status: 400 });
    const { on } = await body(req);
    automation.set(k, Boolean(on));
    note(k, `back-to-back automation ${on ? "on" : "off"}`);
    return { on: automation.get(k) };
  },
  "GET /api/privacy": async () => {
    const r = requireRun();
    const reports = await checkPrivacy(nodes, scenario, r);
    const where = config.topology === "network" ? Object.fromEntries(await whereContractsLive(nodes, r)) : null;
    return {
      scope: config.topology === "network" ? "node" : "party",
      reports: reports.map((x) => ({ ...x, node: nodes.nodeOf(x.party) })),
      links: scenario.links.map((l) => ({ milestone: l.milestone, expected: [nodes.nodeOf(l.payer), nodes.nodeOf(l.payee)], heldBy: where?.[l.milestone] ?? null })),
    };
  },
  "GET /api/log": async () => log,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://local");
  const parts = url.pathname.split("/").filter(Boolean);
  const match = Object.entries(routes).find(([route]) => {
    const [method, path] = route.split(" ");
    const segs = (path ?? "").split("/").filter(Boolean);
    return method === req.method && segs.length === parts.length && segs.every((s, i) => s.startsWith(":") || s === parts[i]);
  });
  if (!match) return send(res, 404, { error: "not found" });
  const [route, handler] = match;
  const params = (route.split(" ")[1] ?? "").split("/").filter(Boolean).flatMap((s, i) => (s.startsWith(":") ? [parts[i] ?? ""] : []));
  try {
    send(res, 200, await handler(req, params));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    send(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
});

await restoreRun();
server.listen(port, () => console.log(`ChainPay API on port ${port} (${config.topology}), run ${run?.runId ?? "none yet"}`));
void automationLoop();
