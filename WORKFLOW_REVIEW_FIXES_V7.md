# Oolaa Booking Workflow V7 — review follow-up fixes

## Changes

- Expired-hold cleanup runs on startup, every 60 seconds while the app is open, and when the tab returns to the foreground. It also runs before customer quotation requests, owner availability review, and quotation send, so stale holds are cleared before inventory checks.
- Installation Start now advances a Scheduled booking through the guarded `advanceBooking` workflow to `Installation in Progress`.
- Installation completion advances the booking to Live through `advanceBooking`, rather than directly updating booking, PO, and campaign records. The installation edit form uses the same guarded status path. If the guarded Live transition fails, the installation completion status is rolled back.
- Proof approval uses `advanceBooking` for eligible booking completion and only attempts campaign completion through `completeCampaign` after the campaign's full completion checks pass. It no longer marks a campaign Completed directly.
- A recurring reconciliation checks for bookings whose proof was approved before the campaign end date, then advances them when the end date is reached and required installation/proof checks pass. Campaign completion still requires its invoice, installation, proof, and date conditions.
- Customer quantity requests validate positive whole-number quantities against available capacity before creating the quotation.
- Admin-created quotation lines now explicitly start with quantity `1` rather than leaving quantity undefined.
- Removed the unused `exclusive` declaration that caused the TypeScript warning.

## Verification

- TypeScript/TSX syntax transpilation passed for all changed source files.
- A full TypeScript check and production build could not be run in this environment because `npm ci` timed out and the installed dependency tree was incomplete. Run `npm ci`, `npm run build`, and the browser regression checklist in your environment before deploying.

## Browser regression checklist

1. Keep the app open across a hold expiry date; confirm the expired hold is released within a minute after the date changes, without reloading.
2. Send a quotation while an old hold exists; confirm the stale hold is released before capacity validation.
3. Review a quotation request as an owner after a hold expires; confirm stale inventory no longer blocks review.
4. Click Start on an installation linked to a Scheduled booking; confirm both installation and booking become In Progress.
5. Click Complete; confirm installation becomes Completed and booking becomes Live through the workflow transition.
6. Edit an installation status to In Progress or Completed; confirm it uses the same guarded workflow as the quick actions.
7. Approve proof before the booking end date; confirm the booking remains Live until the end date, then is reconciled to Completed when an authorized operations session is active.
8. Confirm the campaign is not marked Completed unless the invoice, installation, approved proof, booking status, and campaign end-date checks pass.
9. Request quantity above available shared capacity; confirm the request is rejected with a clear message. Request a valid quantity and confirm it is stored on the quotation line.
10. Create a quotation from the admin media planner and confirm each newly added line starts at quantity 1.
