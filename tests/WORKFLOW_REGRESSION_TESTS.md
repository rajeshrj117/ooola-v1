# Oolaa v3 regression test checklist

Run these manually in the browser after `npm ci && npm run dev`. Use separate demo roles from the profile switcher.

| Test | Action | Expected result |
|---|---|---|
| Customer ownership | Customer A attempts to request a quotation using Customer B's customerId/brand | Service rejects request |
| Brand ownership | Customer selects a brand owned by another customer | Service rejects request |
| Owner ownership | Owner A attempts to confirm or reject Owner B's PO | Service rejects action |
| PO state | Try rejecting a Confirmed/Rejected/Fulfilled PO | Service rejects; booking remains unchanged |
| Sales role | Customer or Media Owner attempts to send a quotation | Service rejects action |
| Owner review | Sales saves a Requested quote without changing scope | Status remains Requested; it remains visible in owner queue |
| Scope change | Sales changes asset or dates after an owner approved | Approvals reset; owners must review again |
| Multiple owners | Quote contains assets owned by two owners | Both owners must approve before Sales can send |
| Customer accept | Customer A attempts to accept Customer B's quotation | Service rejects action |
| Quote state | Customer tries to accept/reject a Draft or Requested quotation | Service rejects action |
| Double booking | Two customers accept overlapping exclusive inventory | Second acceptance fails with availability conflict |
| Shared capacity | Book overlapping reservations up to capacity | Requests are allowed until capacity would be exceeded; next one is blocked |
| Hold expiry | Set a pending booking `holdExpiresAt` to yesterday, reload | Booking is cancelled, Sent PO rejected, notification/audit created |
| Invoice duplication | Generate invoice twice for one campaign | Second generation blocked if a non-cancelled invoice exists |
| Payment balance | Record a payment above outstanding balance | Service rejects action |
| Cancellation | Cancel booking while campaign invoice is issued/part-paid/paid | Service blocks cancellation until Finance reconciles invoice |

These checks are not a substitute for automated browser tests or server-side integration tests. localStorage remains per-browser and client-side authorization can be bypassed; use a backend and transactional database before production.
