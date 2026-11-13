import { randomUUID } from "node:crypto";
import type { components } from "./generated/ledger-api.js";

type S = components["schemas"];
export type Command = S["Command"];
export type CreatedEvent = S["CreatedEvent"];
export type ExercisedEvent = S["ExercisedEvent"];
export type Event = S["Event"];
export type Transaction = S["JsTransaction"];

export class LedgerError extends Error {}

const wildcard = { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } };

function templateFilter(templateId: string) {
  return { identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } } } };
}

/** A small client for the Canton JSON Ledger API v2. */
export class Ledger {
  constructor(
    readonly baseUrl: string,
    readonly userId: string,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown, binary = false): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: body === undefined ? {} : { "Content-Type": binary ? "application/octet-stream" : "application/json" },
      body: body === undefined ? undefined : binary ? (body as Uint8Array) : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new LedgerError(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  uploadDar(bytes: Uint8Array): Promise<unknown> {
    return this.call("POST", "/v2/dars?vetAllPackages=true", bytes, true);
  }

  async listParties(): Promise<string[]> {
    const parties: string[] = [];
    let pageToken = "";
    do {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
      const res = await this.call<S["ListKnownPartiesResponse"]>("GET", `/v2/parties${query}`);
      parties.push(...(res.partyDetails ?? []).map((p) => p.party));
      pageToken = res.nextPageToken ?? "";
    } while (pageToken);
    return parties;
  }

  async allocateParty(hint: string): Promise<string> {
    const res = await this.call<S["AllocatePartyResponse"]>("POST", "/v2/parties", { partyIdHint: hint });
    if (!res.partyDetails?.party) throw new LedgerError(`no party returned for ${hint}`);
    return res.partyDetails.party;
  }

  async ledgerEnd(): Promise<number> {
    const res = await this.call<S["GetLedgerEndResponse"]>("GET", "/v2/state/ledger-end");
    return res.offset ?? 0;
  }

  /** Submits commands as one party and waits for the transaction. */
  async submit(actAs: string, commands: Command[]): Promise<Transaction> {
    const res = await this.call<S["JsSubmitAndWaitForTransactionResponse"]>(
      "POST",
      "/v2/commands/submit-and-wait-for-transaction",
      {
        commands: { commandId: randomUUID(), userId: this.userId, actAs: [actAs], commands },
        transactionFormat: {
          transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
          eventFormat: { filtersByParty: { [actAs]: { cumulative: [wildcard] } }, verbose: true },
        },
      },
    );
    return res.transaction;
  }

  /** Active contracts of one template that `party` is a stakeholder of. */
  async active<T>(party: string, templateId: string): Promise<{ contractId: string; payload: T }[]> {
    const offset = await this.ledgerEnd();
    const res = await this.call<S["JsGetActiveContractsResponse"][]>("POST", "/v2/state/active-contracts", {
      activeAtOffset: offset,
      eventFormat: { filtersByParty: { [party]: { cumulative: [templateFilter(templateId)] } }, verbose: true },
    });
    return res.flatMap((r) => {
      const entry = r.contractEntry;
      if (!entry || !("JsActiveContract" in entry)) return [];
      const created = entry.JsActiveContract.createdEvent;
      return [{ contractId: created.contractId, payload: created.createArgument as T }];
    });
  }

  /**
   * Every transaction `party` was sent between two offsets, in full
   * (ledger-effects shape), including events it only witnessed.
   */
  async transactionsSeenBy(party: string, beginExclusive: number, endInclusive: number): Promise<Transaction[]> {
    const res = await this.call<S["JsGetUpdatesResponse"][]>("POST", "/v2/updates", {
      beginExclusive,
      endInclusive,
      updateFormat: {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
          eventFormat: { filtersByParty: { [party]: { cumulative: [wildcard] } }, verbose: true },
        },
      },
    });
    return res.flatMap((r) => (r.update && "Transaction" in r.update ? [r.update.Transaction.value] : []));
  }
}
