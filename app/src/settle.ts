import { config } from "./config.js";

/**
 * Retries `attempt` until it returns a value, for reads and submissions that
 * depend on another node having caught up. Gives up after SETTLE_TIMEOUT_MS.
 */
export async function eventually<T>(what: string, attempt: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + config.settleMs;
  let last: unknown;
  for (;;) {
    try {
      const value = await attempt();
      if (value !== undefined) return value;
    } catch (err) {
      last = err;
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}${last ? `: ${String(last)}` : ""}`);
    await new Promise((r) => setTimeout(r, config.pollMs));
  }
}
