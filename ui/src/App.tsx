import { ChevronRight, Network, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type Meta, api } from "./api";
import { Pane } from "./Pane";
import { PrivacyPanel } from "./PrivacyPanel";

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMeta(await api.meta());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setup = async () => {
    setSettingUp(true);
    try {
      await api.setup();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettingUp(false);
    }
  };

  if (!meta) {
    return (
      <main className="shell">
        <p className="muted">{error ? `Can't reach the ChainPay API: ${error}` : "Connecting to the ChainPay API…"}</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="wordmark">ChainPay</h1>
          <p className="tagline">
            One client sign-off pays the whole subcontract chain on time. Each firm sees only its own contracts.
          </p>
        </div>
        <div className="topbar-side">
          <span className="chip">
            <Network size={14} aria-hidden />
            {meta.topology === "network" ? `${meta.nodes.length} Canton nodes, one per firm` : "Single Canton sandbox"}
          </span>
          {meta.runId && (
            <button type="button" className="btn btn-ghost" onClick={setup} disabled={settingUp}>
              <RotateCcw size={14} aria-hidden />
              {settingUp ? "Setting up…" : "New chain"}
            </button>
          )}
        </div>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      {!meta.runId ? (
        <section className="empty">
          <h2>No chain on the network yet</h2>
          <p className="muted">
            Setting up gives each firm a party on its own node, signs the three subcontracts between them, and funds the end
            client with the demo payment token.
          </p>
          <button type="button" className="btn btn-primary" onClick={setup} disabled={settingUp}>
            {settingUp ? "Setting up the chain…" : "Set up the demo chain"}
          </button>
        </section>
      ) : (
        <>
          {meta.rules.length > 0 && (
            <section className="rules" aria-label="The rule this tracks">
              {meta.rules.map((r) => (
                <div className="rule" key={r.headline}>
                  <p className="rule-head">{r.headline}</p>
                  <p className="rule-text">{r.text}</p>
                  <p className="rule-source">{r.source}</p>
                </div>
              ))}
            </section>
          )}
          <section className="panes" aria-label="Each firm's own view">
            {meta.panes.map((p, i) => (
              <div className="pane-slot" key={`${meta.runId}-${p.key}`}>
                {i > 0 && (
                  <span className="connector" aria-hidden>
                    <ChevronRight size={16} />
                  </span>
                )}
                <Pane meta={meta} pane={p} isRoot={i === 0} onChanged={refresh} />
              </div>
            ))}
          </section>
          <PrivacyPanel key={meta.runId} meta={meta} />
          <footer className="footnote">
            The rules apply only to suppliers registered (Udyam) as micro or small enterprises; the demo firms are stated as
            registered. Amounts move as a demo token, not real money. ChainPay tracks dates; it isn't tax or legal advice.
          </footer>
        </>
      )}
    </main>
  );
}
