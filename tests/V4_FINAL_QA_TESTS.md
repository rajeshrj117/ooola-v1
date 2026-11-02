# V4 Final QA Test Plan

Run from the project root after `npm ci`:

```bash
npx tsc --noEmit
npm run build
npm run dev
```

## Inventory capacity

1. Create/choose a shared asset with capacity 5.
2. Add overlapping bookings with quantities 2 and 2; availability should remain for one more unit.
3. Request quantity 2 over the same dates; the request must fail capacity validation.
4. Use two overlapping quote lines on the same asset; the combined requested quantity must not exceed capacity.
5. For an exclusive asset, any overlapping active booking/hold must block a new booking.
6. Blocked dates must fail regardless of available capacity.
7. Repeat checks during quotation send, customer acceptance, PO confirmation, and transition to Confirmed.

## Quantity and financials

1. Create a quotation line with unit media price 10,000, supplier cost 7,000, quantity 3.
2. Confirm media total is 30,000 and supplier media total is 21,000 before production/installation/discount/tax.
3. Confirm profit, margin and GST derive from extended totals.
4. Send/accept the quotation and confirm the booking amount is 30,000 and supplier cost is 21,000.
5. Confirm the supplier PO amount is 21,000.
6. Confirm automatic and manual invoices use 30,000 media total before other charges, discount and tax.
7. Change the quantity after owner approval; owner approvals must reset and the quotation must require review again.

## Campaign completion authorization

1. Sign in as Customer and attempt completion; it must be rejected.
2. Sign in as Media Owner and attempt completion; it must be rejected.
3. Sign in as Sales Manager, Finance Manager, Campaign Coordinator, or Installation Staff; it must be rejected.
4. Sign in as Operations Manager or Super Admin with all completion requirements met; completion should succeed.
5. Remove an approved proof or otherwise invalidate a requirement before completion; transaction revalidation must block completion.

## Multi-browser and release gate

The current localStorage implementation cannot pass a true cross-browser atomic reservation test. Test two browsers attempting to reserve the last unit only after a server-backed transactional database is integrated. This is a production release blocker, not a test that can be satisfied by localStorage.

## V4.1 authorization and active-hold regression cases

- [ ] A confirmed-booking transition is blocked when another overlapping temporary hold consumes the remaining shared capacity.
- [ ] A confirmed-booking transition succeeds when capacity remains available after counting all overlapping active holds and bookings.
- [ ] Media Owner A cannot confirm a PO belonging to Media Owner B, including if the PO owner changes between initial check and transaction.
- [ ] Media Owner A cannot reject a PO belonging to Media Owner B, including if the PO owner changes between initial check and transaction.
- [ ] An inactive/missing session cannot confirm or reject a PO inside the transaction.
- [ ] Customer, Sales-only, and other unauthorized roles cannot confirm or reject a PO inside the transaction.
- [ ] Super Admin and Finance Manager retain the explicitly allowed PO action access.
