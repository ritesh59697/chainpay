import { Download, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type AuditEntry, api, dateTime, money, shortDate } from "./api";

/** What each entry says, from this firm's point of view. */
function describe(e: AuditEntry): string {
  const amount = money(e.amount, e.currency);
  const mine = e.role === "payer";
  switch (e.kind) {
    case "proposed":
      return mine ? `Proposed ${e.milestone} to ${e.counterparty}, ${amount}` : `${e.counterparty} proposed ${e.milestone}, ${amount}`;
    case "signed":
      return `${e.milestone} signed with ${e.counterparty}`;
    case "accepted": {
      const how = e.triggeredBy ? `, back to back after ${e.triggeredBy}` : "";
      const due = e.dueAt ? shortDate(e.dueAt) : "";
      return mine ? `Accepted ${e.counterparty}'s work${how}. Pay by ${due}` : `${e.counterparty} accepted my work${how}. Due ${due}`;
    }
    case "paid":
      return `${mine ? `Paid ${e.counterparty}` : `Received from ${e.counterparty}`} ${amount}, ${e.onTime ? "on time" : "late"}`;
  }
}

function csv(rows: AuditEntry[]): string {
  const cols = ["effectiveAt", "kind", "milestone", "role", "counterparty", "amount", "currency", "dueAt", "onTime", "triggeredBy", "updateId", "offset"] as const;
  const cell = (v: unknown) => {
    const s = v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

export function History({ paneKey, name, node, version }: { paneKey: string; name: string; node: string; version: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState(false);

  // Reload when this pane's contracts change (version is the pane's status fingerprint).
  useEffect(() => {
    let live = true;
    api
      .audit(paneKey)
      .then((e) => live && setEntries(e))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [paneKey, version]);

  const download = () => {
    const blob = new Blob([csv(entries)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sluice-${name.toLowerCase()}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="history" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <HistoryIcon size={14} aria-hidden />
        History <span className="muted">({entries.length})</span>
      </summary>
      <ol className="history-list">
        {[...entries].reverse().map((e) => (
          <li key={`${e.updateId}-${e.kind}-${e.milestone}`}>
            <p>{describe(e)}</p>
            <p className="history-meta">
              {dateTime(e.effectiveAt)} · tx <code title={e.updateId}>{e.updateId.slice(0, 12)}</code>
            </p>
          </li>
        ))}
      </ol>
      <p className="history-foot">
        Read from node <code>{node}</code>, only contracts {name} signed.
      </p>
      <button type="button" className="btn btn-ghost btn-small" onClick={download} disabled={entries.length === 0}>
        <Download size={14} aria-hidden />
        Download CSV for my accountant
      </button>
    </details>
  );
}
