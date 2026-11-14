import { Check, CircleDashed, Clock, HardDrive, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LinkView, type Meta, type PaneView, api, daysBetween, money, shortDate } from "./api";

type PaneMeta = Meta["panes"][number];

export function Pane({ meta, pane, isRoot, onChanged }: { meta: Meta; pane: PaneMeta; isRoot: boolean; onChanged: () => void }) {
  const [view, setView] = useState<PaneView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await api.view(pane.key));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [pane.key]);

  useEffect(() => {
    void load();
    const t = setInterval(load, meta.pollMs);
    return () => clearInterval(t);
  }, [load, meta.pollMs]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setActing(label);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  };

  const incoming = view?.links.filter((l) => l.role === "payee") ?? [];
  const held = (currency: string) => (view?.cash ?? []).filter((c) => c.currency === currency).reduce((n, c) => n + Number(c.amount), 0);
  const outgoing = view?.links.filter((l) => l.role === "payer") ?? [];

  return (
    <article className="pane" aria-label={`${pane.hint}'s view`}>
      <header className="pane-head">
        <h2 className="pane-name">{pane.hint}</h2>
        <p className="pane-role">{pane.label}</p>
        <p className="pane-node">
          <HardDrive size={12} aria-hidden />
          reads only node <code>{pane.node}</code>
        </p>
      </header>

      {!view && !error && <p className="muted small">Loading from {pane.node}…</p>}

      {incoming.length > 0 && (
        <Section title="Gets paid by">
          {incoming.map((l) => (
            <LinkCard key={l.milestone} link={l} />
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Pays">
          {outgoing.map((l) => (
            <LinkCard key={l.milestone} link={l}>
              {isRoot && l.status === "signed" && (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={acting !== null}
                  onClick={() => act("accept", () => api.accept(pane.key, l.milestone).then(onChanged))}
                >
                  {acting === "accept" ? "Accepting…" : `Accept ${l.counterparty}'s work`}
                </button>
              )}
              {!isRoot && l.status === "signed" && (
                <p className="hint">
                  <CircleDashed size={12} aria-hidden />
                  Waits for {l.upstreamMilestone} to be accepted upstream
                </p>
              )}
              {l.status === "accepted" && held(l.currency) < Number(l.amount) && (
                <p className="hint">
                  <CircleDashed size={12} aria-hidden />
                  Waiting to be paid upstream before paying {l.counterparty}
                </p>
              )}
              {l.status === "accepted" && held(l.currency) >= Number(l.amount) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  disabled={acting !== null}
                  onClick={() => act("pay", () => api.pay(pane.key))}
                >
                  {acting === "pay" ? "Paying…" : `Pay ${money(l.amount, l.currency)}`}
                </button>
              )}
            </LinkCard>
          ))}
          {pane.automation !== null && <AutomationSwitch pane={pane} onChanged={onChanged} />}
        </Section>
      )}

      {view && (
        <Section title="Holds">
          {view.cash.length === 0 ? (
            <p className="muted small">No payment token yet</p>
          ) : (
            view.cash.map((c, i) => (
              <p className="holding" key={i}>
                <Wallet size={14} aria-hidden />
                <span className="amount-sm">{money(c.amount, c.currency)}</span>
              </p>
            ))
          )}
        </Section>
      )}

      {error && (
        <p className="banner banner-error small" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pane-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}

const steps = ["signed", "accepted", "paid"] as const;
const stepLabel = { signed: "Signed", accepted: "Accepted", paid: "Paid" };

function LinkCard({ link, children }: { link: LinkView; children?: React.ReactNode }) {
  // Flash the card when its status changes, so the cascade is visible.
  const prev = useRef(link.status);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== link.status) {
      prev.current = link.status;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [link.status]);

  const reached = steps.indexOf(link.status as (typeof steps)[number]);
  return (
    <div className={`link-card status-${link.status}${flash ? " flash" : ""}`}>
      <div className="link-top">
        <span className="counterparty">{link.counterparty}</span>
        <code className="milestone">{link.milestone}</code>
      </div>
      <p className="amount">{money(link.amount, link.currency)}</p>
      <p className="muted small">
        {link.description}, {link.termDays}-day terms
      </p>
      <ol className="steps" aria-label="Status">
        {steps.map((s, i) => (
          <li key={s} className={i <= reached ? "done" : ""} aria-current={i === reached ? "step" : undefined}>
            {i <= reached ? <Check size={12} aria-hidden /> : <span className="dot" aria-hidden />}
            {stepLabel[s]}
          </li>
        ))}
      </ol>
      <Clock45 link={link} />
      {children}
    </div>
  );
}

function Clock45({ link }: { link: LinkView }) {
  if (!link.acceptedAt || !link.dueAt) return null;
  if (link.status === "paid" && link.paidAt) {
    return (
      <p className={`clock ${link.onTime ? "clock-ok" : "clock-late"}`}>
        <Clock size={12} aria-hidden />
        Paid {shortDate(link.paidAt)}, {link.onTime ? "on time" : "late"}
      </p>
    );
  }
  const day = daysBetween(link.acceptedAt, new Date());
  const pct = Math.min(100, Math.max(0, (day / link.termDays) * 100));
  return (
    <div className="clock">
      <p className="clock-line">
        <Clock size={12} aria-hidden />
        {link.role === "payer" ? "Pay by" : "Due"} {shortDate(link.dueAt)}, day {day} of {link.termDays}
      </p>
      <div className="clock-bar" role="progressbar" aria-valuemin={0} aria-valuemax={link.termDays} aria-valuenow={day}>
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

function AutomationSwitch({ pane, onChanged }: { pane: PaneMeta; onChanged: () => void }) {
  const [on, setOn] = useState(Boolean(pane.automation));
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try {
      setOn((await api.automation(pane.key, !on)).on);
      onChanged();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="switch-row">
      <button type="button" role="switch" aria-checked={on} className="switch" onClick={toggle} disabled={saving} id={`auto-${pane.key}`}>
        <span className="switch-thumb" />
      </button>
      <label htmlFor={`auto-${pane.key}`} className="small">
        Accept my supplier's work as soon as my client accepts mine
      </label>
    </div>
  );
}
