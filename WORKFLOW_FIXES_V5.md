# Oolaa booking workflow fixes (V5)

## Changes included

- Expired holds now expire on the configured expiry date (`<= today`) rather than lingering until the following day.
- When an expired hold or a supplier-rejected PO leaves a campaign with no active bookings, the campaign returns to `Quotation` and the approved quotation reopens as `Requested`, with approval metadata cleared and an audit note. Customers are notified so they can take action again.
- A supplier's rejection is recorded as that owner's response rather than rejecting the entire multi-owner quotation. Other owners' responses remain available; the declined owner can review again, and Sales can revise the affected line(s).
- Customer quotation requests now support a quantity per selected asset. The quantity is included in the requested quote item and the displayed estimated media amount.
- Completing an installation advances an in-progress booking to `Live` and the campaign to `Live`; the associated PO is marked fulfilled.
- Approving proof for an ended, live booking advances it to `Completed`. If all other non-cancelled campaign bookings are already completed, the campaign is marked completed.
- Booking cancellation and PO rejection reopen the campaign/quotation when no active bookings remain, while preserving the existing guard that issued/part-paid/paid invoices must first be resolved in Finance.

## Regression checklist

1. Set a booking hold expiry to today; run hold expiry; confirm booking becomes Cancelled, PO is rejected, campaign returns to Quotation and quote becomes Requested when no other active booking exists.
2. Set hold expiry to tomorrow; run hold expiry; confirm the booking remains held.
3. Use a quotation with two owners; have one owner reject; confirm quote is not globally Rejected and the other owner's approval history remains intact.
4. Request quotation from the customer portal with quantity 3; confirm quote item quantity is 3 and estimated media total is 3× the unit price.
5. Mark installation Completed for an Installation in Progress booking; confirm booking/campaign become Live and PO becomes Fulfilled.
6. Approve proof for an ended Live booking; confirm booking becomes Completed; confirm campaign becomes Completed when all other non-cancelled bookings are completed.
7. Attempt cancellation with an Issued, Partially Paid or Paid invoice; confirm cancellation is blocked until Finance resolves the invoice. Confirm cancellation can proceed after invoice status is Cancelled.
8. Verify campaigns with other active bookings are not reset when a single booking is cancelled or its hold expires.

## Validation note

A production build could not be run in this environment because dependency installation did not complete and the local `vite` executable is unavailable. Please run `npm ci` and `npm run build` locally before deployment. This is a client-side demo app; authorization and transaction guarantees must be enforced server-side before production use.
