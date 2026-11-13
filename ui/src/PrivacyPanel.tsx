import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { type Meta, type PrivacyResult, api } from "./api";

export function PrivacyPanel({ meta }: { meta: Meta }) {
  const [result, setResult] = useState<PrivacyResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      setResult(await api.privacy());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const leaks = result ? result.reports.reduce((n, r) => n + r.problems.length, 0) + result.links.filter((l) => l.heldBy?.some((n) => !l.expected.includes(n))).length : 0;
  const hintOf = (node: string) => meta.parties.filter((p) => p.node === node).map((p) => p.hint).join(", ") || node;

  return (
    <section className="privacy" aria-labelledby="privacy-title">
      <div className="privacy-head">
        <div>
          <h2 id="privacy-title" className="privacy-title">Privacy check</h2>
          <p className="muted small">
            {meta.topology === "network"
              ? "Reads every transaction that reached each firm's node, for any party, and looks for contracts or amounts that firm isn't part of."
              : "Reads every transaction each party was sent and looks for contracts or amounts it isn't part of."}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={run} disabled={running}>
          {running ? "Reading every node…" : result ? "Run again" : "Run privacy check"}
        </button>
      </div>

      {error && <p className="banner banner-error small" role="alert">{error}</p>}

      {result && (
        <>
          <p className={`verdict ${leaks ? "verdict-bad" : "verdict-ok"}`}>
            {leaks ? <ShieldAlert size={16} aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
            {leaks ? `${leaks} problem(s) found` : "No firm received anything it isn't party to"}
          </p>
          <div className="table-wrap">
            <table className="matrix">
              <caption className="sr-only">Which node holds each subcontract</caption>
              <thead>
                <tr>
                  <th scope="col">Subcontract</th>
                  {meta.nodes.map((n) => (
                    <th scope="col" key={n}>
                      {hintOf(n)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.links.map((l) => (
                  <tr key={l.milestone}>
                    <th scope="row">
                      <code>{l.milestone}</code>
                    </th>
                    {l.heldBy === null && <td colSpan={meta.nodes.length}>One shared node: see the per-party check below</td>}
                    {l.heldBy !== null && meta.nodes.map((n) => {
                      const held = l.heldBy?.includes(n) ?? false;
                      const leak = held && !l.expected.includes(n);
                      return (
                        <td key={n} className={leak ? "cell-leak" : held ? "cell-held" : "cell-none"}>
                          {held ? (leak ? "leaked" : "holds") : "never received"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Transactions read</th>
                  {meta.nodes.map((n) => {
                    const r = result.reports.find((x) => x.node === n);
                    return <td key={n}>{r ? `${r.transactions} tx, ${r.problems.length ? `${r.problems.length} problem(s)` : "clean"}` : "n/a"}</td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          {result.reports.flatMap((r) => r.problems.map((p) => `${r.party}: ${p}`)).map((p) => (
            <p key={p} className="small problem">{p}</p>
          ))}
        </>
      )}
    </section>
  );
}
