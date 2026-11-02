# Oolaa v3 Fix Report

## Applied in source

1. **Customer identity checks**: quotation creation, acceptance, rejection, and revision requests require the logged-in customer to own the related record.
2. **Media-owner authorization**: PO confirmation and rejection require the PO to belong to the signed-in owner; other permitted confirmations are restricted to Super Admin/Finance Manager.
3. **Sales quotation authorization**: quotation sending is restricted to Super Admin, Sales Manager, or Operations Manager, validates status/expiry/line items, checks all asset owners have approved, and rechecks availability.
4. **PO rejection integrity**: only Sent purchase orders can be rejected; confirmed/later-stage bookings and campaigns with issued/partially paid/paid invoices are protected from rejection-driven cancellation.
5. **Booking authorization and cancellation integrity**: booking transitions require appropriate roles and are rechecked inside the transaction; cancellation is blocked while an issued or paid invoice needs Finance reconciliation.
6. **Inventory capacity**: conflict checks now account for exclusive slots and shared capacity, with quantity fields supported for quotes/bookings. Availability is checked during owner review, customer acceptance, quotation send, and PO confirmation.
7. **Temporary holds**: accepted bookings awaiting supplier confirmation receive a two-day hold expiry. Expired holds are released on application startup and before confirmation actions, with PO state, notifications, and audit trail updated.
8. **Quotation revisions**: revision records link to their root quotation, increment revision number, preserve revision activity, and clear owner/internal approvals. Changes to asset/date scope reset owner approvals.
9. **Financial guards**: duplicate invoice creation is blocked and payments re-check the latest outstanding balance inside the transaction.
10. **Stale source cleanup**: removed obsolete root `App.tsx` and `types.ts`; the maintained source of truth is under `src/`.

## Verification status

- Parsed/transpiled all 27 TS/TSX source files using the globally available TypeScript transpiler: **0 syntax errors**.
- Executed focused capacity-logic tests: **4/4 passed** (free exclusive slot, overlapping exclusive booking blocked, shared capacity slot available, exhausted shared capacity blocked).
- Static regression assertions for identity, owner PO authorization, sales role checks, PO status checks, hold expiry, capacity logic, duplicate invoice prevention, and payment-balance recheck: **8/8 passed**.
- `npm ci` timed out in this environment; `npm run build` could not run because Vite was unavailable. Strict type-check is therefore **not verified**.
- Browser end-to-end tests were not executed here. Do not treat this report as a production security certification.

## Production limitations

The app uses localStorage and demo roles. These checks improve demo correctness but are not security boundaries. Multi-browser atomic capacity checks, real payment processing, verified refunds, and persistent file storage require server-side services.
