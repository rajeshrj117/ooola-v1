# Oolaa quotation, PO rejection, and workflow fixes

## Fixed

1. **Owner-review deadlock when Sales saves a draft**
   - Saving an existing `Requested` or `Revision Requested` quotation now preserves its review status instead of changing it to `Draft`.
   - The media owner can still find and review the request after Sales edits pricing.
   - Sending remains blocked until every owner whose asset appears in the quotation has approved availability.

2. **Approval scope invalidation**
   - If Sales changes the assets or requested dates on a quotation, previous owner approvals are cleared because they applied to the old asset/date scope.
   - Creating a revision starts it in `Requested` status with an empty `ownerApprovals` list, so it returns to the owner review queue.

3. **Purchase order rejection guard**
   - Only a PO in `Sent` status can be rejected.
   - Rejection is blocked for confirmed or later-stage bookings.
   - Rejection is blocked if an issued, partially paid, or paid invoice exists for the campaign; Finance must resolve the invoice first.
   - A valid rejection requires a reason, cancels only the still-pending linked booking, and notifies the customer and internal team.
   - State is checked again inside the transaction before mutation.

4. **Workflow type-safety / missing records**
   - The shared error helper now has an explicit `never` return type so TypeScript control-flow analysis can narrow after guard failures.
   - Booking transitions return a clear error for missing booking IDs rather than dereferencing an absent record.

5. **Stale source copies**
   - Removed unused root-level `App.tsx` and `types.ts` copies so the `src/` files are the single source of truth.
   - Removed `pages1.tsx` and `Onboarding1.tsx`, which were not imported by the application.

## Verification status

- Static source assertions and TypeScript/TSX syntax transpilation are run as part of packaging.
- A full Vite build and strict `tsc` check could not be completed in this environment because `npm ci` timed out before dependencies were installed. Do not treat this package as having a successful production build until those commands pass locally.

## Run locally

```bash
npm ci
npm run dev
```

For verification:

```bash
npx tsc --noEmit
npm run build
```

This is still a browser-local demo using localStorage. Real multi-user concurrency control and production authorization require server-side persistence and access control.
