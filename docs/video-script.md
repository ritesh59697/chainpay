# Demo video script (3:00)

Recorded from the real app on the 5-node local network. Every caption doubles as the voiceover line, so the video works with or without a voice.

Before recording: `npm run network`, `npm run api`, `npm run dev` in `ui/`, click **New chain**, browser at 1440×900, light mode.

| Time | Screen | Caption / voiceover |
|---|---|---|
| 0:00–0:08 | Title card: "Sluice" and the one-line pitch | One client sign-off pays the whole subcontract chain on time, and no firm sees anyone else's contract. |
| 0:08–0:30 | The three rule cards at the top of the screen | In India, payment terms to a registered micro or small supplier can't pass 45 days from accepting its work. Pay late and compound interest runs. Still unpaid on 31 March, and the buyer loses that year's tax deduction. |
| 0:30–0:50 | Slow pan across the four panes | IT work is delivered in chains. A US retailer pays an Indian IT firm, which pays a small agency, which pays Priya, a freelance developer. Each pane is one firm, reading only from its own Canton node. |
| 0:50–1:05 | Zoom on Priya's pane, then AcmeIT's | Priya sees her ₹3.5 lakh contract. She never sees the ₹10 lakh or ₹6 lakh contracts above her, because they never reach her node. |
| 1:05–1:30 | Click **Accept AcmeIT's work** in RetailCo's pane; the cards flash green left to right | The retailer accepts the work. In about a second, AcmeIT accepts the agency's work, and the agency accepts Priya's, each on its own node. |
| 1:30–1:45 | Zoom on the "Pay by" lines | Every tier now has its own 45-day clock and its own due date. Nobody waited for an email. |
| 1:45–2:10 | Click Pay in RetailCo, then AcmeIT, then PixelStudio; receipts turn to "Paid, on time" | Each firm pays once it has been paid. The demo uses a test token. In production, banks move the money and Canton holds the proof. |
| 2:10–2:35 | Scroll to **Privacy check**, click it; table fills in | The privacy check reads everything that reached each of the five nodes. Each subcontract sits on exactly its two firms' nodes, and was never received anywhere else. |
| 2:35–2:48 | Open Priya's **History**; hover the CSV button | Every firm gets its own timestamped history, with ledger transaction ids, ready for its accountant. |
| 2:48–3:00 | End card: repo link, "Built on Canton", honesty line | Sluice. Built on Canton for HackCanton Season 4. Test token, not tax advice, no invented users. |

## Notes

- Keep the cursor still between clicks; the cascade is the moment, give it two clear seconds.
- Don't fast-forward time. The late case is in the Daml tests; mention it only if asked.
