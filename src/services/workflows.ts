import type { DB, Role, User, BookingStatus, Quotation, Dispute, DisputeStatus, DisputeCategory } from '../types';
import { api, audit, notify, getDB, getSession } from './storage.service';
import { conflicts, validateCapacity, prorate, uid, seqNo, addDays, today, BOOKING_FLOW, invoiceTotals, quoteTotals, sum } from '../utils';

// ---------- permissions (demo only — not production security)
export type Perm = 'disputes' | 'internal' | 'viewCosts' | 'verify' | 'refundApprove' | 'finance' | 'sales' | 'ops' | 'admin' | 'editInventory';
const MATRIX: Record<Role, Perm[]> = {
  'Super Admin': ['disputes', 'internal', 'viewCosts', 'verify', 'refundApprove', 'finance', 'sales', 'ops', 'admin', 'editInventory'],
  'Operations Manager': ['disputes', 'internal', 'viewCosts', 'verify', 'ops', 'editInventory', 'sales'],
  'Sales Manager': ['disputes', 'internal', 'sales'],
  'Campaign Coordinator': ['internal', 'ops'],
  'Finance Manager': ['disputes', 'internal', 'viewCosts', 'finance', 'refundApprove'],
  'Installation Staff': ['internal', 'ops'],
  'Media Owner': [], 'Customer': [],
};
export const can = (u: User | null, p: Perm) => !!u && MATRIX[u.role].includes(p);
export const homeFor = (u: User) => u.role === 'Customer' ? '/customer' : u.role === 'Media Owner' ? '/owner' : '/admin';

function err(m: string): never { throw new Error(m); }
function requireSession(...roles: Role[]): User {
  const u = getSession();
  if (!u || !u.active) err('Please sign in with an active account.');
  if (roles.length && !roles.includes(u.role)) err(`This action is not permitted for role ${u.role}.`);
  return u;
}
function requireCustomerRecord(customerId: string) {
  const u = requireSession('Customer');
  if (!u.customerId || u.customerId !== customerId) err('This customer record does not belong to your account.');
  return u;
}
function requireOwnerRecord(ownerId: string) {
  const u = requireSession('Media Owner');
  if (!u.ownerId || u.ownerId !== ownerId) err('This record does not belong to your media-owner account.');
  return u;
}

/** Release expired demo inventory holds. Runs on app startup and before confirmation actions. */
export async function expireInventoryHolds() {
  const db = getDB();
  const expired = db.bookings.filter(b => b.status === 'Awaiting Supplier Confirmation' && !!b.holdExpiresAt && b.holdExpiresAt <= today());
  if (!expired.length) return 0;
  const ids = new Set(expired.map(b => b.id));
  await api.tx(d => {
    d.bookings = d.bookings.map(b => ids.has(b.id) ? { ...b, status: 'Cancelled', holdExpiresAt: undefined } : b);
    d.purchaseOrders = d.purchaseOrders.map(po => ids.has(po.bookingId) && po.status === 'Sent' ? { ...po, status: 'Rejected', reason: 'Temporary inventory hold expired' } : po);
    const affectedCampaigns = new Set(expired.map(b => b.campaignId));
    for (const campaignId of affectedCampaigns) {
      const active = d.bookings.some(b => b.campaignId === campaignId && !ids.has(b.id) && b.status !== 'Cancelled');
      if (!active) {
        d.campaigns = d.campaigns.map(c => c.id === campaignId ? { ...c, status: 'Quotation' } : c);
        d.quotations = d.quotations.map(q => q.campaignId === campaignId && q.status === 'Approved' ? { ...q, status: 'Requested', ownerApprovals: [], customerApprovedAt: undefined, customerApprovedBy: undefined, notes: (q.notes ? q.notes + '\n' : '') + 'Booking hold expired; quotation reopened for customer action.' } : q);
      }
    }
    for (const b of expired) {
      d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: b.customerId, title: 'Temporary booking hold expired', body: `${b.number} was released because supplier confirmation was not received before the hold expired. Request a new quotation to continue.`, link: '/customer/bookings', read: false, at: new Date().toISOString() });
      d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Inventory hold released', body: `${b.number} expired; inventory is available again subject to current bookings.`, link: '/admin/bookings', read: false, at: new Date().toISOString() });
    }
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: 'System', action: 'Expired inventory holds released', entity: 'bookings', entityId: expired.map(b => b.id).join(','), summary: `${expired.length} expired hold(s) released` });
  });
  return expired.length;
}

export async function requestQuotation(p: { customerId: string; brandId: string; name: string; start: string; end: string; budget: number; assetIds: string[]; quantities?: Record<string, number>; notes: string }) {
  await expireInventoryHolds();
  const db = getDB();
  const session = requireSession('Customer');
  if (!session.customerId || session.customerId !== p.customerId) err('You can only request a quotation for your own customer account.');
  if (!db.customers.find(c => c.id === p.customerId)) err('Invalid customer');
  if (!p.assetIds.length) err('Select at least one asset');
  if (!p.start || !p.end || p.end < p.start) err('Choose a valid campaign date range.');
  if (!db.brands.some(b => b.id === p.brandId && b.customerId === p.customerId)) err('Choose a brand that belongs to your customer account.');
  if (new Set(p.assetIds).size !== p.assetIds.length) err('Remove duplicate advertising assets from the request.');
  if (p.assetIds.some(id => !db.assets.some(a => a.id === id))) err('One or more selected advertising assets no longer exist.');
  const disabled = p.assetIds.filter(id => { const a = db.assets.find(x => x.id === id); return !a || a.disabled || a.verification !== 'Approved' || !db.categories.find(c => c.id === a?.categoryId)?.enabled; });
  if (disabled.length) err('Some selected assets belong to disabled categories');
  const requestedItems = p.assetIds.map(id => { const a = db.assets.find(x => x.id === id)!; const raw = Number(p.quantities?.[id] ?? 1); if (!Number.isFinite(raw) || raw < 1 || !Number.isInteger(raw)) err(`Quantity for ${a.name} must be a whole number of at least 1.`); return { assetId: id, start: p.start, end: p.end, quantity: raw }; });
  const capacity = validateCapacity(db, requestedItems);
  if (!capacity.ok) err('The requested quantity exceeds current availability for one or more assets. Reduce the quantity or choose different dates/assets.');
  const cid = uid('cmp'), qid = uid('quo');
  await api.tx(d => {
    d.campaigns.unshift({ id: cid, customerId: p.customerId, brandId: p.brandId, name: p.name, start: p.start, end: p.end, budget: p.budget, status: 'Quotation', assetIds: p.assetIds, notes: p.notes });
    const items = p.assetIds.map(id => { const a = d.assets.find(x => x.id === id)!; return { assetId: id, start: p.start, end: p.end, rate: prorate(a.rate, p.start, p.end), supplierCost: prorate(a.supplierRate, p.start, p.end), quantity: Math.floor(Number(p.quantities?.[id] ?? 1)) }; });
    d.quotations.unshift({ id: qid, number: seqNo('OQ', d.quotations), campaignId: cid, customerId: p.customerId, status: 'Requested', items, production: 0, installation: 0, service: 0, productionCost: 0, installationCost: 0, otherCost: 0, discount: 0, taxRate: d.settings.taxRate, expiry: addDays(today(), d.settings.quoteValidityDays), createdAt: today(), notes: p.notes });
    const cust = d.customers.find(c => c.id === p.customerId)!;
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'New quotation request', body: `${cust.company} requested ${items.length} site(s) for "${p.name}"`, link: '/admin/quotations', read: false, at: new Date().toISOString() });
    [...new Set(items.map(it => d.assets.find(a => a.id === it.assetId)?.ownerId).filter((id): id is string => !!id))].forEach(ownerId => d.notifications.unshift({ id: uid('ntf'), audience: 'owner', targetId: ownerId, title: 'New quotation request to review', body: `${cust.company} requested availability for "${p.name}". Review dates and approve or reject the request.`, link: '/owner/quotation-requests', read: false, at: new Date().toISOString() }));
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || 'Public visitor', action: 'Quotation requested', entity: 'quotations', entityId: qid, summary: `Request for ${p.name}` });
  });
  return qid;
}

export async function reviewQuotationRequest(qid: string, action: 'approve' | 'reject', reason = '') {
  // Clear expired holds before availability is reviewed so stale holds never block inventory.
  await expireInventoryHolds();
  const db = getDB();
  const user = getSession();
  if (!user || !user.active || user.role !== 'Media Owner' || !user.ownerId) err('Only an active, signed-in media owner can review this request.');
  const ownerId = user.ownerId;
  const ownerName = user.name;
  const q = db.quotations.find(x => x.id === qid) || err('Quotation request not found.');
  if (!['Requested', 'Revision Requested'].includes(q.status)) err(`This request is no longer awaiting owner review (current: ${q.status}).`);
  const ownedItems = q.items.filter(it => db.assets.some(a => a.id === it.assetId && a.ownerId === ownerId));
  if (!ownedItems.length) err('This quotation does not contain any of your advertising assets.');
  if (action === 'approve') {
    for (const item of ownedItems) {
      const asset = db.assets.find(a => a.id === item.assetId)!;
      if (item.end < item.start) err(`Invalid campaign dates for ${asset.name}.`);
      if (asset.disabled || asset.verification !== 'Approved') err(`Asset ${asset.name} is disabled or not approved for booking.`);
      const conflict = conflicts(db, item.assetId, item.start, item.end, undefined, true, item.quantity || 1);
      if (!conflict.ok) err(`Cannot approve availability for "${asset.name}": ${conflict.bookings.map(b => b.number).concat(conflict.blocks.map(b => b.reason)).join(', ') || `capacity ${conflict.usedCapacity}/${conflict.capacity}` } conflict with these dates.`);
    }
    const approvals = [...new Set([...(q.ownerApprovals || []), ownerId])];
    await api.update('quotations', qid, { ownerApprovals: approvals, ownerApprovalHistory: [...(q.ownerApprovalHistory || []), { ownerId, at: new Date().toISOString(), action: 'Approved' as const }] }, `Media owner ${ownerName} approved availability for ${q.number}`);
    notify({ audience: 'internal', title: 'Media owner approved availability', body: `${ownerName} approved availability for ${q.number}. Sales can send the quotation after all involved owners approve.`, link: '/admin/quotations' });
    notify({ audience: 'customer', targetId: q.customerId, title: 'Availability reviewed', body: `The media owner has reviewed availability for ${q.number}. The final quotation is being prepared.`, link: '/customer/quotations' });
  } else {
    const note = reason.trim() || 'Media owner declined the request.';
    // Owner responses are tracked per owner. A single owner's rejection must not
    // reject unrelated owners' lines or the customer's entire multi-owner quote.
    await api.update('quotations', qid, { ownerApprovals: (q.ownerApprovals || []).filter(id => id !== ownerId), notes: (q.notes ? q.notes + '\n' : '') + `Media owner (${ownerName}) declined their asset line(s): ${note}`, ownerApprovalHistory: [...(q.ownerApprovalHistory || []), { ownerId, at: new Date().toISOString(), action: 'Rejected' as const, reason: note }] }, `Media owner declined their lines on ${q.number}`);
    notify({ audience: 'customer', targetId: q.customerId, title: 'Availability needs revision', body: `${ownerName} declined availability for their asset line(s) on ${q.number}. Sales can revise the affected lines; other owners' responses remain intact.`, link: '/customer/quotations' });
    notify({ audience: 'internal', title: 'Owner declined asset line(s)', body: `${q.number} · ${ownerName}: ${note}`, link: '/admin/quotations' });
  }
  api.commit();
}

export async function sendQuotation(q: Quotation) {
  requireSession('Super Admin', 'Sales Manager', 'Operations Manager');
  // Expire stale holds before checking quote inventory/capacity.
  await expireInventoryHolds();
  const db = getDB();
  const current = db.quotations.find(x => x.id === q.id) || err('Quotation not found.');
  if (!['Requested', 'Draft', 'Revision Requested'].includes(current.status)) err(`Only requested or draft quotations can be sent (current: ${current.status}).`);
  if (!current.items.length) err('Add at least one line item.');
  if (current.expiry < today()) err('Quotation expiry is in the past. Update the expiry date first.');
  const requiredOwners = [...new Set(current.items.map(item => db.assets.find(a => a.id === item.assetId)?.ownerId).filter((id): id is string => !!id))];
  if (requiredOwners.length !== new Set(current.items.map(i => i.assetId)).size && current.items.some(i => !db.assets.some(a => a.id === i.assetId))) err('One or more quotation assets no longer exist.');
  const approvedOwners = new Set(current.ownerApprovals || []);
  const waitingOwners = requiredOwners.filter(id => !approvedOwners.has(id));
  if (waitingOwners.length) err('The media owner(s) must review and approve availability before this quotation can be sent to the customer.');
  if (db.settings.workflows.requireInternalQuoteApproval && !current.internalApproved) err('Internal approval required before sending (see Approval Workflows).');
  // Revalidate every line and the combined requested quantities immediately before sending.
  // This applies to both exclusive and shared-capacity assets, including overlapping lines
  // within the same quotation.
  for (const item of current.items) {
    if (!db.assets.some(a => a.id === item.assetId)) err(`Asset ${item.assetId} no longer exists.`);
    if (!item.start || !item.end || item.end < item.start) err('A quotation line has an invalid date range.');
    if (!Number.isFinite(Number(item.quantity ?? 1)) || Number(item.quantity ?? 1) < 1) err('Each quotation quantity must be at least 1.');
  }
  const capacityCheck = validateCapacity(db, current.items.map(item => ({ assetId: item.assetId, start: item.start, end: item.end, quantity: item.quantity || 1 })));
  if (!capacityCheck.ok) err('Inventory availability or shared capacity changed after owner review. Ask the affected media owner(s) to review availability again.');
  await api.update('quotations', current.id, { status: 'Sent' }, `Quotation ${current.number} sent to customer`);
  notify({ audience: 'customer', targetId: current.customerId, title: 'Quotation ready for review', body: `${current.number} awaits your approval`, link: '/customer/quotations' });
  api.commit();
}

export async function approveQuotation(qid: string, options: { recordedOffline?: boolean } = {}) {
  await expireInventoryHolds();
  const db = getDB(); const q = db.quotations.find(x => x.id === qid) || err('Quotation not found');
  if (options.recordedOffline) requireSession('Super Admin', 'Sales Manager');
  else requireCustomerRecord(q.customerId);
  if (q.status !== 'Sent') err(`Only "Sent" quotations can be approved (current: ${q.status})`);
  if (q.expiry < today()) { await api.update('quotations', qid, { status: 'Expired' }, `Quotation ${q.number} flagged expired`); err('This quotation has expired. Please request a revision/renewal.'); }
  // Validate every line before creating any booking. This catches both existing
  // reservations and duplicate/overlapping lines inside the same quotation.
  for (let i = 0; i < q.items.length; i++) {
    const it = q.items[i];
    if (it.end < it.start) err('A quotation line has an invalid date range.');
    if (!db.assets.some(a => a.id === it.assetId)) err(`Asset ${it.assetId} no longer exists.`);
    const c = conflicts(db, it.assetId, it.start, it.end, undefined, true, it.quantity || 1);
    if (!c.ok) {
      const a = db.assets.find(x => x.id === it.assetId)!;
      err(`Availability conflict on "${a.name}" (${c.bookings.map(b => b.number).concat(c.blocks.map(b => b.reason)).join(', ')}). Request alternative dates.`);
    }
    const duplicate = q.items.slice(0, i).some(prev =>
      prev.assetId === it.assetId && prev.start <= it.end && it.start <= prev.end
    );
    if (duplicate) {
      const a = db.assets.find(x => x.id === it.assetId)!;
      err(`This quotation contains overlapping date ranges for "${a.name}". Remove the duplicate line or change its dates.`);
    }
  }
  await api.tx(d => {
    const liveQuote = d.quotations.find(x => x.id === qid);
    if (!liveQuote || liveQuote.status !== 'Sent') err('This quotation is no longer awaiting customer approval.');
    for (const it of liveQuote.items) {
      const c = conflicts(d, it.assetId, it.start, it.end, undefined, true, it.quantity || 1);
      if (!c.ok) err(`Inventory availability/capacity changed before confirmation for asset ${it.assetId}.`);
    }
    d.quotations = d.quotations.map(x => x.id === qid ? { ...x, status: 'Approved', customerApprovedAt: new Date().toISOString(), customerApprovedBy: getSession()?.name || (options.recordedOffline ? 'Recorded offline by Sales' : 'Customer') } : x.campaignId === q.campaignId && ['Sent', 'Draft', 'Requested', 'Revision Requested'].includes(x.status) ? { ...x, status: 'Rejected', notes: x.notes + ' (superseded)' } : x);
    q.items.forEach(it => {
      const a = d.assets.find(x => x.id === it.assetId)!; const bid = uid('bkg');
      const qty = Math.max(1, Number(it.quantity) || 1);
      d.bookings.unshift({ id: bid, number: seqNo('OB', d.bookings), quotationId: qid, campaignId: q.campaignId, customerId: q.customerId, assetId: it.assetId, ownerId: a.ownerId, start: it.start, end: it.end, amount: it.rate * qty, supplierCost: it.supplierCost * qty, quantity: qty, holdExpiresAt: addDays(today(), 2), status: 'Awaiting Supplier Confirmation', createdAt: today() });
      d.purchaseOrders.unshift({ id: uid('po'), number: seqNo('OPO', d.purchaseOrders), ownerId: a.ownerId, bookingId: bid, campaignId: q.campaignId, items: [{ desc: `Media display – ${a.name} (${it.start} to ${it.end}) × ${Math.max(1, Number(it.quantity) || 1)}`, amount: it.supplierCost * Math.max(1, Number(it.quantity) || 1) }], status: 'Sent', reason: '', createdAt: today() });
      d.notifications.unshift({ id: uid('ntf'), audience: 'owner', targetId: a.ownerId, title: 'New purchase order', body: `Please confirm availability for ${a.name}`, link: '/owner/orders', read: false, at: new Date().toISOString() });
    });
    d.campaigns = d.campaigns.map(c => c.id === q.campaignId ? { ...c, status: 'Booked' } : c);
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Quotation approved', body: `${q.number} approved by customer – awaiting supplier confirmation`, link: '/admin/bookings', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Quotation approved', entity: 'quotations', entityId: qid, summary: `${q.number} approved; ${q.items.length} booking(s) + PO(s) generated` });
  });
}
export async function customerQuoteAction(qid: string, status: 'Revision Requested' | 'Rejected', note: string) {
  const q = getDB().quotations.find(x => x.id === qid) || err('Quotation not found.');
  requireCustomerRecord(q.customerId);
  if (q.status !== 'Sent') err(`Only sent quotations can be rejected or revised (current: ${q.status}).`);
  if (!note.trim()) err('Please provide a reason or revision request.');
  await api.update('quotations', qid, { status, notes: (q.notes ? q.notes + '\n' : '') + `Customer: ${note.trim()}`, ownerApprovals: status === 'Revision Requested' ? [] : q.ownerApprovals }, `Quotation ${q.number}: ${status}`);
  notify({ audience: 'internal', title: `Quotation ${status.toLowerCase()}`, body: `${q.number}: ${note.trim()}`, link: '/admin/quotations' }); api.commit();
}

export async function confirmPO(poId: string) {
  await expireInventoryHolds();
  const db = getDB();
  const po = db.purchaseOrders.find(p => p.id === poId) || err('Purchase order not found');
  const actor = getSession();
  if (actor?.role === 'Media Owner') requireOwnerRecord(po.ownerId);
  else requireSession('Super Admin', 'Finance Manager');
  if (po.status !== 'Sent') err(`Only sent purchase orders can be confirmed (current: ${po.status}).`);
  const b = db.bookings.find(x => x.id === po.bookingId);
  if (!b) err('The booking linked to this purchase order could not be found.');
  if (b.status === 'Cancelled') err('A cancelled booking cannot be confirmed.');
  // Re-check all active inventory claims, including other temporary holds,
  // before confirming this booking. The current booking is excluded by ID.
  {
    const c = conflicts(db, b.assetId, b.start, b.end, b.id, true, b.quantity || 1);
    if (!c.ok) err('Cannot confirm: overlapping booking capacity or blocked dates exist for this asset.');
  }
  await api.tx(d => {
    // Revalidate the acting user's active session, role and owner scope inside
    // the transaction; never rely solely on the pre-transaction authorization.
    const liveActor = getSession();
    const livePO = d.purchaseOrders.find(p => p.id === poId);
    const liveBooking = d.bookings.find(x => x.id === (livePO?.bookingId || po.bookingId));
    if (!liveActor || !liveActor.active) err('Please sign in with an active account.');
    if (liveActor.role === 'Media Owner') {
      if (!liveActor.ownerId || !livePO || liveActor.ownerId !== livePO.ownerId) err('This purchase order does not belong to your media-owner account.');
    } else if (!['Super Admin', 'Finance Manager'].includes(liveActor.role)) {
      err(`This action is not permitted for role ${liveActor.role}.`);
    }
    if (!livePO || livePO.status !== 'Sent') err('This purchase order is no longer awaiting confirmation.');
    if (!liveBooking || liveBooking.status === 'Cancelled') err('The linked booking is no longer eligible for confirmation.');
    const liveAvailability = conflicts(d, liveBooking.assetId, liveBooking.start, liveBooking.end, liveBooking.id, true, liveBooking.quantity || 1);
    if (!liveAvailability.ok) err('Inventory capacity changed before confirmation.');
    d.purchaseOrders = d.purchaseOrders.map(p => p.id === poId ? { ...p, status: 'Confirmed' } : p);
    d.bookings = d.bookings.map(x => x.id === b.id ? { ...x, status: 'Confirmed', holdExpiresAt: undefined } : x);
    if (!d.artworks.some(a => a.bookingId === b.id)) d.artworks.unshift({ id: uid('art'), campaignId: b.campaignId, bookingId: b.id, name: `Creative for ${d.assets.find(a => a.id === b.assetId)?.name}`, fileName: '', fileSize: 0, fileType: '', version: 0, status: 'Awaiting Upload', submittedAt: '', history: [] });
    d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: b.customerId, title: 'Booking confirmed', body: `${b.number} confirmed by media owner. Please upload artwork.`, link: '/customer/bookings', read: false, at: new Date().toISOString() });
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Supplier confirmation', body: `${po.number} confirmed`, link: '/admin/purchase-orders', read: false, at: new Date().toISOString() });

    // Once every position in a campaign is supplier-confirmed, create one
    // customer invoice for the campaign. The duplicate guard makes this safe
    // when a campaign contains multiple purchase orders.
    const campaignBookings = d.bookings.filter(x => x.campaignId === b.campaignId);
    const allConfirmed = campaignBookings.length > 0 && campaignBookings.every(x =>
      ['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live', 'Completed'].includes(x.status)
    );
    const invoiceExists = d.invoices.some(i => i.campaignId === b.campaignId && i.status !== 'Cancelled');
    if (allConfirmed && !invoiceExists) {
      const q = d.quotations.find(x => x.id === b.quotationId && x.status === 'Approved')
        || d.quotations.find(x => x.campaignId === b.campaignId && x.status === 'Approved');
      const campaign = d.campaigns.find(x => x.id === b.campaignId);
      if (q && campaign) {
        const items = [
          { desc: `Media – ${q.items.length} line(s), ${campaign.name}`, amount: sum(q.items.map(i => i.rate * Math.max(1, Number(i.quantity) || 1))) },
          { desc: 'Production', amount: q.production },
          { desc: 'Installation', amount: q.installation },
          { desc: 'Service charges', amount: q.service },
        ].filter(i => i.amount > 0);
        const invId = uid('inv');
        const invoiceNumber = seqNo('OI', d.invoices);
        d.invoices.unshift({
          id: invId, number: invoiceNumber, customerId: campaign.customerId, campaignId: campaign.id,
          issue: today(), due: addDays(today(), d.settings.invoiceDueDays), items,
          taxRate: q.taxRate, discount: q.discount, status: 'Issued'
        });
        d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: campaign.customerId, title: 'Invoice issued', body: `${invoiceNumber} is ready for payment for ${campaign.name}.`, link: '/customer/invoices', read: false, at: new Date().toISOString() });
        d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Invoice generated', body: `${invoiceNumber} created after all campaign bookings were confirmed.`, link: '/admin/invoices', read: false, at: new Date().toISOString() });
        d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Invoice generated', entity: 'invoices', entityId: invId, summary: `${invoiceNumber} generated for campaign ${campaign.name}` });
      }
    }
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Booking confirmed', entity: 'bookings', entityId: b.id, summary: `${po.number} confirmed by supplier` });
  });
}
export async function rejectPO(poId: string, reason: string) {
  const db = getDB();
  const po = db.purchaseOrders.find(p => p.id === poId);
  if (!po) err('Purchase order not found.');
  const actor = getSession();
  if (actor?.role === 'Media Owner') requireOwnerRecord(po.ownerId);
  else requireSession('Super Admin', 'Finance Manager');
  // Rejection is only valid while a PO is awaiting supplier response. Never roll back
  // a confirmed/in-execution/fulfilled booking through the rejection action.
  if (po.status !== 'Sent') err(`Only a sent purchase order can be rejected (current: ${po.status}).`);
  const booking = db.bookings.find(b => b.id === po.bookingId);
  if (!booking) err('The purchase order has no linked booking.');
  if (['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live', 'Completed'].includes(booking.status)) {
    err(`Booking ${booking.number} is already ${booking.status} and cannot be cancelled by rejecting a purchase order.`);
  }
  const issuedInvoice = db.invoices.find(inv => inv.campaignId === booking.campaignId && ['Issued', 'Partially Paid', 'Paid'].includes(inv.status));
  if (issuedInvoice) err(`Invoice ${issuedInvoice.number} has already been issued. Cancel/credit the invoice through Finance before changing this booking.`);
  const cleanReason = reason.trim();
  if (!cleanReason) err('Please provide a rejection reason.');
  await api.tx(d => {
    // Revalidate the acting user's active session, role and owner scope inside
    // the transaction; this closes the pre-check-only authorization gap.
    const liveActor = getSession();
    const currentPO = d.purchaseOrders.find(p => p.id === poId);
    const currentBooking = d.bookings.find(b => b.id === (currentPO?.bookingId || po.bookingId));
    if (!liveActor || !liveActor.active) err('Please sign in with an active account.');
    if (liveActor.role === 'Media Owner') {
      if (!liveActor.ownerId || !currentPO || liveActor.ownerId !== currentPO.ownerId) err('This purchase order does not belong to your media-owner account.');
    } else if (!['Super Admin', 'Finance Manager'].includes(liveActor.role)) {
      err(`This action is not permitted for role ${liveActor.role}.`);
    }
    if (!currentPO || currentPO.status !== 'Sent') err('This purchase order is no longer awaiting supplier response.');
    if (!currentBooking || ['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live', 'Completed'].includes(currentBooking.status)) err('This booking can no longer be cancelled from purchase-order rejection.');
    if (d.invoices.some(inv => inv.campaignId === currentBooking.campaignId && ['Issued', 'Partially Paid', 'Paid'].includes(inv.status))) err('An invoice has already been issued for this campaign. Resolve it through Finance first.');
    d.purchaseOrders = d.purchaseOrders.map(p => p.id === poId ? { ...p, status: 'Rejected', reason: cleanReason } : p);
    d.bookings = d.bookings.map(x => x.id === currentBooking.id ? { ...x, status: 'Cancelled', holdExpiresAt: undefined } : x);
    const otherActive = d.bookings.some(x => x.campaignId === currentBooking.campaignId && x.id !== currentBooking.id && x.status !== 'Cancelled');
    if (!otherActive) {
      d.campaigns = d.campaigns.map(c => c.id === currentBooking.campaignId ? { ...c, status: 'Quotation' } : c);
      d.quotations = d.quotations.map(q => q.campaignId === currentBooking.campaignId && q.status === 'Approved' ? { ...q, status: 'Requested', ownerApprovals: [], customerApprovedAt: undefined, customerApprovedBy: undefined, notes: (q.notes ? q.notes + '\n' : '') + `Supplier rejected booking ${currentBooking.number}; quotation reopened for customer action.` } : q);
    }
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Supplier rejected PO', body: `${po.number}: ${cleanReason}`, link: '/admin/purchase-orders', read: false, at: new Date().toISOString() });
    d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: currentBooking.customerId, title: 'Booking request declined', body: `${currentBooking.number} was declined by the media owner. Reason: ${cleanReason}`, link: '/customer/bookings', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'PO rejected', entity: 'purchaseOrders', entityId: poId, summary: cleanReason });
  });
}

export function transitionCheck(db: DB, bid: string, next: BookingStatus): string | null {
  const b = db.bookings.find(x => x.id === bid);
  if (!b) return 'Booking not found';
  if (!BOOKING_FLOW[b.status].includes(next)) return `Invalid transition ${b.status} → ${next}`;
  if (next === 'Confirmed') { const po = db.purchaseOrders.find(p => p.bookingId === bid); if (po && po.status !== 'Confirmed' && po.status !== 'In Execution') return 'Supplier must confirm the purchase order first'; if (!conflicts(db, b.assetId, b.start, b.end, bid, true, b.quantity || 1).ok) return 'Conflicting active booking/hold or shared-capacity inventory exists'; }
  if (next === 'Scheduled' && db.settings.workflows.requireArtworkApproval && !db.artworks.some(a => a.bookingId === bid && a.status === 'Approved')) return 'Approved artwork required before scheduling';
  if (next === 'Live' && !db.installations.some(i => i.bookingId === bid && i.status === 'Completed')) return 'Installation task must be completed first';
  if (next === 'Completed') { if (db.settings.workflows.requireProofApproval && !db.proofs.some(p => p.assetId === b.assetId && p.campaignId === b.campaignId && p.status === 'Approved')) return 'Approved proof of advertising required'; if (b.end > today()) return 'Booking period has not ended yet'; }
  return null;
}
export async function advanceBooking(bid: string, next: BookingStatus) {
  const db = getDB();
  if (next === 'Cancelled') requireSession('Super Admin', 'Operations Manager', 'Sales Manager');
  else requireSession('Super Admin', 'Operations Manager', 'Campaign Coordinator', 'Installation Staff');
  const e = transitionCheck(db, bid, next); if (e) err(e);
  const b = db.bookings.find(x => x.id === bid);
  if (!b) err('Booking not found');
  if (next === 'Cancelled') {
    const invoice = db.invoices.find(i => i.campaignId === b.campaignId && ['Issued', 'Partially Paid', 'Paid'].includes(i.status));
    if (invoice) err(`Invoice ${invoice.number} must be cancelled or credited through Finance before cancelling this booking.`);
  }
  await api.tx(d => {
    const current = d.bookings.find(x => x.id === bid);
    if (!current || current.status !== b.status) err('Booking status changed. Refresh and try again.');
    const check = transitionCheck(d, bid, next); if (check) err(check);
    if (next === 'Cancelled' && d.invoices.some(i => i.campaignId === b.campaignId && ['Issued', 'Partially Paid', 'Paid'].includes(i.status))) err('Resolve the campaign invoice through Finance before cancellation.');
    d.bookings = d.bookings.map(x => x.id === bid ? { ...x, status: next } : x);
    if (next === 'Scheduled' && !d.installations.some(i => i.bookingId === bid)) d.installations.unshift({ id: uid('ins'), campaignId: b.campaignId, bookingId: bid, assetId: b.assetId, scheduled: addDays(b.start, -1), assignee: 'Unassigned', supplierId: b.ownerId, instructions: 'Mount creative, verify lighting, capture proof photos.', status: 'Scheduled', completedAt: '', notes: '' });
    if (next === 'Installation in Progress') d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid && p.status === 'Confirmed' ? { ...p, status: 'In Execution' } : p);
    if (next === 'Live') { d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid ? { ...p, status: 'Fulfilled' } : p); d.campaigns = d.campaigns.map(c => c.id === b.campaignId ? { ...c, status: 'Live' } : c); }
    if (next === 'Cancelled') {
      d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid && p.status !== 'Fulfilled' ? { ...p, status: 'Rejected', reason: 'Booking cancelled' } : p);
      const otherActive = d.bookings.some(x => x.campaignId === b.campaignId && x.id !== bid && x.status !== 'Cancelled');
      if (!otherActive) {
        d.campaigns = d.campaigns.map(c => c.id === b.campaignId ? { ...c, status: 'Quotation' } : c);
        d.quotations = d.quotations.map(q => q.campaignId === b.campaignId && q.status === 'Approved' ? { ...q, status: 'Requested', ownerApprovals: [], customerApprovedAt: undefined, customerApprovedBy: undefined, notes: (q.notes ? q.notes + '\n' : '') + 'Booking cancelled; quotation reopened for customer action.' } : q);
      }
    }
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: `Booking ${next}`, entity: 'bookings', entityId: bid, summary: `${b.number}: ${b.status} → ${next}` });
    d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: b.customerId, title: `Booking ${next}`, body: `${b.number} is now ${next}`, link: '/customer/bookings', read: false, at: new Date().toISOString() });
  });
}

export function campaignCompletion(db: DB, cid: string) {
  const bk = db.bookings.filter(b => b.campaignId === cid && b.status !== 'Cancelled');
  const checks = [
    { label: 'Has at least one booking', ok: bk.length > 0 },
    { label: 'All bookings Live or Completed', ok: bk.length > 0 && bk.every(b => ['Live', 'Completed'].includes(b.status)) },
    { label: 'Installations completed', ok: bk.every(b => db.installations.some(i => i.bookingId === b.id && i.status === 'Completed')) },
    { label: 'Approved proof for every asset', ok: bk.every(b => db.proofs.some(p => p.campaignId === cid && p.assetId === b.assetId && p.status === 'Approved')) },
    { label: 'Customer invoice issued', ok: db.invoices.some(i => i.campaignId === cid && i.status !== 'Draft' && i.status !== 'Cancelled') },
    { label: 'Campaign end date reached', ok: (db.campaigns.find(c => c.id === cid)?.end || '9') <= today() },
  ];
  return { checks, ready: checks.every(c => c.ok) };
}
export async function completeCampaign(cid: string) {
  const actor = requireSession('Super Admin', 'Operations Manager');
  const db = getDB();
  const campaign = db.campaigns.find(c => c.id === cid) || err('Campaign not found.');
  if (campaign.status === 'Completed') err('This campaign is already completed.');
  if (!campaignCompletion(db, cid).ready) err('Completion requirements not satisfied');
  await api.tx(d => {
    // Re-check authorization, state and completion conditions against the transaction draft.
    const liveActor = getSession();
    if (!liveActor || !liveActor.active || !['Super Admin', 'Operations Manager'].includes(liveActor.role)) err('Only an active Operations Manager or Super Admin can complete a campaign.');
    const liveCampaign = d.campaigns.find(c => c.id === cid);
    if (!liveCampaign || liveCampaign.status === 'Completed') err('Campaign is missing or already completed.');
    if (!campaignCompletion(d, cid).ready) err('Completion requirements changed. Refresh and resolve the outstanding requirements.');
    d.campaigns = d.campaigns.map(c => c.id === cid ? { ...c, status: 'Completed' } : c);
    d.bookings = d.bookings.map(b => b.campaignId === cid && b.status === 'Live' ? { ...b, status: 'Completed' } : b);
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: `${actor.name} (${actor.role})`, action: 'Campaign completed', entity: 'campaigns', entityId: cid, summary: 'Campaign marked complete after requirements revalidated' });
  });
}

/** Reconcile bookings whose approved proof was accepted before their end date. Safe to run repeatedly. */
export async function reconcileEligibleBookings() {
  const actor = getSession();
  if (!actor || !actor.active || !['Super Admin', 'Operations Manager', 'Campaign Coordinator', 'Installation Staff'].includes(actor.role)) return 0;
  let advanced = 0;
  const snapshot = getDB();
  const eligible = snapshot.bookings.filter(b => b.status === 'Live' && b.end <= today() &&
    snapshot.installations.some(i => i.bookingId === b.id && i.status === 'Completed') &&
    (!snapshot.settings.workflows.requireProofApproval || snapshot.proofs.some(p => p.campaignId === b.campaignId && p.assetId === b.assetId && p.status === 'Approved')));
  for (const booking of eligible) {
    try { await advanceBooking(booking.id, 'Completed'); advanced += 1; } catch (error) { console.warn(`Could not reconcile booking ${booking.id}`, error); }
  }
  if (['Super Admin', 'Operations Manager'].includes(actor.role)) {
    const campaigns = [...new Set(getDB().bookings.filter(b => b.status === 'Completed').map(b => b.campaignId))];
    for (const campaignId of campaigns) {
      const campaign = getDB().campaigns.find(c => c.id === campaignId);
      if (campaign && campaign.status !== 'Completed' && campaignCompletion(getDB(), campaignId).ready) {
        try { await completeCampaign(campaignId); } catch (error) { console.warn(`Campaign ${campaignId} remains open until completion checks pass`, error); }
      }
    }
  }
  return advanced;
}

export async function recordReceipt(invoiceId: string, amount: number, date: string, method: string) {
  requireSession('Super Admin', 'Finance Manager');
  const db = getDB(); const inv = db.invoices.find(i => i.id === invoiceId) || err('Invoice not found');
  if (inv.status === 'Draft' || inv.status === 'Cancelled') err('Issue the invoice before recording payment');
  const t = invoiceTotals(inv, db); if (amount <= 0) err('Amount must be positive'); if (amount > t.balance + 0.001) err(`Amount exceeds balance due (${t.balance})`);
  await api.tx(d => {
    const currentInvoice = d.invoices.find(i => i.id === invoiceId);
    if (!currentInvoice || ['Draft', 'Cancelled'].includes(currentInvoice.status)) err('Invoice is no longer eligible for payment.');
    const currentTotals = invoiceTotals(currentInvoice, d);
    if (amount > currentTotals.balance + 0.001) err(`Amount exceeds current outstanding balance (${currentTotals.balance}).`);
    d.receipts.unshift({ id: uid('rcp'), number: seqNo('ORC', d.receipts), invoiceId, amount, date, method });
    const paid = sum(d.receipts.filter(r => r.invoiceId === invoiceId && !r.disabled).map(r => r.amount));
    d.invoices = d.invoices.map(i => i.id === invoiceId ? { ...i, status: paid + 0.001 >= t.total ? 'Paid' : 'Partially Paid' } : i);
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Payment recorded', body: `₹${amount} against ${inv.number}`, link: '/admin/receipts', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Payment recorded', entity: 'invoices', entityId: invoiceId, summary: `₹${amount} via ${method} (simulated)` });
  });
}
export async function invoiceFromCampaign(cid: string) {
  requireSession('Super Admin', 'Finance Manager');
  const db = getDB(); const q = db.quotations.find(x => x.campaignId === cid && x.status === 'Approved') || err('No approved quotation for this campaign');
  const c = db.campaigns.find(x => x.id === cid) || err('Campaign not found');
  if (db.invoices.some(i => i.campaignId === cid && i.status !== 'Cancelled')) err('An invoice already exists for this campaign. Edit the existing invoice instead of generating a duplicate.');
  const t = quoteTotals(q);
  const items = [{ desc: `Media – ${q.items.length} site(s), ${c.name}`, amount: t.media }, { desc: 'Production', amount: q.production }, { desc: 'Installation', amount: q.installation }, { desc: 'Service charges', amount: q.service }].filter(i => i.amount > 0);
  return api.create('invoices', { number: seqNo('OI', db.invoices), customerId: c.customerId, campaignId: cid, issue: today(), due: addDays(today(), db.settings.invoiceDueDays), items, taxRate: q.taxRate, discount: q.discount, status: 'Draft' }, 'inv', `Draft invoice for ${c.name}`);
}
// ---------- disputes
const nowIso = () => new Date().toISOString();
const roleOf = (u: User | null): 'Customer' | 'Media Owner' | 'Staff' => u?.role === 'Customer' ? 'Customer' : u?.role === 'Media Owner' ? 'Media Owner' : 'Staff';
const SLA_DAYS = { High: 2, Medium: 5, Low: 10 } as const;
export const disputeOverdue = (d: Dispute) => !['Resolved', 'Closed'].includes(d.status) && d.slaDue < today();

export async function raiseDispute(p: { category: DisputeCategory; subject: string; description: string; priority: Dispute['priority']; bookingId?: string; invoiceId?: string; poId?: string; customerId?: string; ownerId?: string }) {
  const db = getDB(); const u = getSession(); const role = roleOf(u);
  if (!u) err('Please sign in to raise a dispute');
  if (!p.subject.trim()) err('Subject is required'); if (p.description.trim().length < 10) err('Please describe the issue (at least 10 characters)');
  const b = p.bookingId ? db.bookings.find(x => x.id === p.bookingId) || err('Booking not found') : undefined;
  let customerId = p.customerId, ownerId = p.ownerId;
  if (role === 'Customer') { customerId = u!.customerId; if (b && b.customerId !== customerId) err('That booking does not belong to your account'); if (p.invoiceId && db.invoices.find(i => i.id === p.invoiceId)?.customerId !== customerId) err('That invoice does not belong to your account'); }
  if (role === 'Media Owner') { ownerId = u!.ownerId; if (b && b.ownerId !== ownerId) err('That booking is not on your sites'); if (p.poId && db.purchaseOrders.find(x => x.id === p.poId)?.ownerId !== ownerId) err('That purchase order is not yours'); }
  if (b) { customerId = customerId || b.customerId; ownerId = ownerId || b.ownerId; }
  if (!customerId && !ownerId) err('Select a customer or media owner');
  const id = uid('dsp'); const at = nowIso(); const number = seqNo('ODS', db.disputes);
  await api.tx(d => {
    d.disputes.unshift({ id, number, raisedBy: role, customerId, ownerId, bookingId: p.bookingId || undefined, invoiceId: p.invoiceId || undefined, poId: p.poId || undefined, campaignId: b?.campaignId, category: p.category, subject: p.subject.trim(), description: p.description.trim(), priority: p.priority, status: 'Open', assignee: 'Unassigned', resolution: '', createdAt: at, updatedAt: at, slaDue: addDays(today(), SLA_DAYS[p.priority]), thread: [{ at, by: u!.name, role, text: p.description.trim() }] });
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: `New dispute (${p.priority})`, body: `${number}: ${p.subject.trim()}`, link: '/admin/disputes', read: false, at });
    d.audit.unshift({ id: uid('aud'), at, user: `${u!.name} (${u!.role})`, action: 'Dispute raised', entity: 'disputes', entityId: id, summary: `${number} · ${p.category}` });
  });
  return id;
}

export async function addDisputeMessage(id: string, text: string, internal = false) {
  const u = getSession(); const role = roleOf(u); const d0 = getDB().disputes.find(x => x.id === id) || err('Dispute not found');
  if (!text.trim()) err('Message cannot be empty'); if (internal && role !== 'Staff') err('Only staff can add internal notes');
  if (['Resolved', 'Closed'].includes(d0.status) && role !== 'Staff') err('This dispute is closed. Reopen it to add messages.');
  const at = nowIso();
  await api.tx(d => {
    const x = d.disputes.find(r => r.id === id)!; x.thread.push({ at, by: u!.name, role, text: text.trim(), internal }); x.updatedAt = at;
    if (role !== 'Staff' && x.status === 'Awaiting Information') x.status = 'Under Review';
    if (!internal) {
      if (role === 'Staff') { const aud = x.raisedBy === 'Media Owner' ? 'owner' : 'customer'; const target = aud === 'owner' ? x.ownerId : x.customerId; d.notifications.unshift({ id: uid('ntf'), audience: aud, targetId: target, title: 'New reply on your dispute', body: `${x.number}: ${text.trim().slice(0, 80)}`, link: aud === 'owner' ? '/owner/disputes' : '/customer/disputes', read: false, at }); }
      else d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Dispute reply', body: `${x.number}: ${u!.name} replied`, link: '/admin/disputes', read: false, at });
    }
  });
}

export async function updateDispute(id: string, patch: { status?: DisputeStatus; priority?: Dispute['priority']; assignee?: string; resolution?: string }) {
  const u = getSession(); if (roleOf(u) !== 'Staff' || !can(u, 'disputes')) err('You do not have permission to manage disputes');
  const x0 = getDB().disputes.find(r => r.id === id) || err('Dispute not found');
  const next = patch.status ?? x0.status; const res = (patch.resolution ?? x0.resolution).trim();
  if (['Resolved', 'Closed'].includes(next) && !res) err('Enter a resolution note before resolving or closing');
  const at = nowIso();
  await api.tx(d => {
    const x = d.disputes.find(r => r.id === id)!; Object.assign(x, { ...patch, resolution: res, updatedAt: at });
    if (patch.priority && patch.priority !== x0.priority) x.slaDue = addDays(x.createdAt.slice(0, 10), SLA_DAYS[patch.priority]);
    if (patch.status && patch.status !== x0.status) {
      x.thread.push({ at, by: u!.name, role: 'Staff', text: `Status changed: ${x0.status} → ${patch.status}${['Resolved', 'Closed'].includes(patch.status) ? `. Resolution: ${res}` : ''}` });
      const aud = x.raisedBy === 'Media Owner' ? 'owner' : 'customer'; const target = aud === 'owner' ? x.ownerId : x.customerId;
      if (x.raisedBy !== 'Staff') d.notifications.unshift({ id: uid('ntf'), audience: aud, targetId: target, title: `Dispute ${patch.status.toLowerCase()}`, body: `${x.number} is now ${patch.status}`, link: aud === 'owner' ? '/owner/disputes' : '/customer/disputes', read: false, at });
    }
    d.audit.unshift({ id: uid('aud'), at, user: `${u!.name} (${u!.role})`, action: 'Dispute updated', entity: 'disputes', entityId: id, summary: `${x.number}: ${Object.keys(patch).join(', ')}` });
  });
}

export async function reopenDispute(id: string, reason: string) {
  const u = getSession(); const role = roleOf(u); const x0 = getDB().disputes.find(r => r.id === id) || err('Dispute not found');
  if (!['Resolved', 'Closed'].includes(x0.status)) err('Only resolved or closed disputes can be reopened'); if (!reason.trim()) err('Please give a reason for reopening');
  const at = nowIso();
  await api.tx(d => {
    const x = d.disputes.find(r => r.id === id)!; x.status = 'Open'; x.updatedAt = at; x.slaDue = addDays(today(), SLA_DAYS[x.priority]); x.thread.push({ at, by: u!.name, role, text: `Reopened: ${reason.trim()}` });
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Dispute reopened', body: `${x.number}: ${reason.trim().slice(0, 80)}`, link: '/admin/disputes', read: false, at });
    d.audit.unshift({ id: uid('aud'), at, user: `${u!.name} (${u!.role})`, action: 'Dispute reopened', entity: 'disputes', entityId: id, summary: x.number });
  });
}
export { audit, notify };
