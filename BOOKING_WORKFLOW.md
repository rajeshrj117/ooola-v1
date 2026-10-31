# Oolaa Booking and Invoicing Workflow

## Media owner quotation review (added)

1. Customer submits a quotation request from Media Planning.
2. Oolaa routes the request to the media owner(s) who own the requested assets and sends them an in-app notification.
3. Each relevant media owner opens **Owner Portal → Quotation Requests**, reviews their asset(s), dates, indicative media price and customer notes, then approves availability or rejects the request with a reason.
4. For multi-owner campaigns, every relevant owner must approve availability before Sales can send the final quotation.
5. Sales reviews pricing and sends the quotation. The customer can then accept it.
6. Customer acceptance rechecks availability and creates booking records and supplier purchase orders.
7. The media owner opens **Owner Portal → Purchase Orders** and confirms or rejects the purchase order. Confirmation performs another availability check.
8. Once every booking associated with the campaign is confirmed (or has progressed beyond confirmation), Oolaa automatically creates one **Issued** customer invoice for that campaign, with a duplicate-invoice guard.
9. Customer invoices, simulated payments/receipts, artwork, installation proof, campaign completion and disputes continue through the existing modules.

## Media owner demo accounts

The profile menu now lists all seeded media owner accounts. The Chennai Central LED Screen used in quotation `OQ-2025-0013` belongs to **Farhan Ali / MetroVue Displays (Demo)**, not Ravi Kumar / Skyline Media Works. Switch to Farhan Ali in the profile menu to review that specific request. Demo email: `owner6@example.demo`.

Other demo accounts include Ravi Kumar (`owner@oolaa.demo`) and Lakshmi Narayan (`owner2@example.demo`). These are fictional demo identities; there are no real passwords or external accounts.

## Double-booking protection

- Media owner availability review checks current bookings and blocked dates for exclusive date-based assets.
- Customer quotation approval checks availability again before creating booking records.
- Supplier confirmation performs a further check against confirmed bookings and blocked dates.
- Conflicting requests may be submitted for review, but they cannot both be approved/confirmed for the same exclusive physical position and overlapping dates.

## Invoice behaviour

- A campaign invoice is created only after all booking lines in that campaign are confirmed or have advanced to a later active/completed stage.
- If any booking in the campaign is cancelled/rejected, automatic invoicing is held back to avoid charging for cancelled inventory.
- Generated invoices and payment records are demo records; payment processing does not move real money.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

## Important demo limitation

The project persists demo data in browser storage. This is not a shared transactional database and cannot guarantee race-free bookings across different browsers/devices. Before production use, move booking and payment operations to a server-side API with database transactions/locking, server-side authorization, and real accounting/payment integrations where required.
