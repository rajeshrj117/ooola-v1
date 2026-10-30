import type { DB, Role, User, BookingStatus, Quotation, Dispute, DisputeStatus, DisputeCategory } from '../types';
import { api, audit, notify, getDB, getSession } from './storage.service';
import { conflicts, prorate, uid, seqNo, addDays, today, BOOKING_FLOW, invoiceTotals, quoteTotals, sum } from '../utils';

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

const err = (m: string) => { throw new Error(m); };
const exclusive = (db: DB, assetId: string) => { const a = db.assets.find(x => x.id === assetId); const c = db.categories.find(x => x.id === a?.categoryId); return c?.bookingModel === 'Exclusive date-based'; };

export async function requestQuotation(p: { customerId: string; brandId: string; name: string; start: string; end: string; budget: number; assetIds: string[]; notes: string }) {
  const db = getDB();
  if (!db.customers.find(c => c.id === p.customerId)) err('Invalid customer');
  if (!p.assetIds.length) err('Select at least one asset');
  if (p.end < p.start) err('End date must be after start date');
  const disabled = p.assetIds.filter(id => { const a = db.assets.find(x => x.id === id); return !db.categories.find(c => c.id === a?.categoryId)?.enabled; });
  if (disabled.length) err('Some selected assets belong to disabled categories');
  const cid = uid('cmp'), qid = uid('quo');
  await api.tx(d => {
    d.campaigns.unshift({ id: cid, customerId: p.customerId, brandId: p.brandId, name: p.name, start: p.start, end: p.end, budget: p.budget, status: 'Quotation', assetIds: p.assetIds, notes: p.notes });
    const items = p.assetIds.map(id => { const a = d.assets.find(x => x.id === id)!; return { assetId: id, start: p.start, end: p.end, rate: prorate(a.rate, p.start, p.end), supplierCost: prorate(a.supplierRate, p.start, p.end) }; });
    d.quotations.unshift({ id: qid, number: seqNo('OQ', d.quotations), campaignId: cid, customerId: p.customerId, status: 'Requested', items, production: 0, installation: 0, service: 0, productionCost: 0, installationCost: 0, otherCost: 0, discount: 0, taxRate: d.settings.taxRate, expiry: addDays(today(), d.settings.quoteValidityDays), createdAt: today(), notes: p.notes });
    const cust = d.customers.find(c => c.id === p.customerId)!;
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'New quotation request', body: `${cust.company} requested ${items.length} site(s) for "${p.name}"`, link: '/admin/quotations', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || 'Public visitor', action: 'Quotation requested', entity: 'quotations', entityId: qid, summary: `Request for ${p.name}` });
  });
  return qid;
}

export async function sendQuotation(q: Quotation) {
  const db = getDB();
  if (db.settings.workflows.requireInternalQuoteApproval && !q.internalApproved) err('Internal approval required before sending (see Approval Workflows)');
  if (q.expiry < today()) err('Quotation expiry is in the past. Update the expiry date first.');
  if (!q.items.length) err('Add at least one line item');
  await api.update('quotations', q.id, { status: 'Sent' }, `Quotation ${q.number} sent to customer`);
  notify({ audience: 'customer', targetId: q.customerId, title: 'Quotation ready for review', body: `${q.number} awaits your approval`, link: '/customer/quotations' });
  api.commit();
}

export async function approveQuotation(qid: string) {
  const db = getDB(); const q = db.quotations.find(x => x.id === qid) || err('Quotation not found');
  if (q.status !== 'Sent') err(`Only "Sent" quotations can be approved (current: ${q.status})`);
  if (q.expiry < today()) { await api.update('quotations', qid, { status: 'Expired' }, `Quotation ${q.number} flagged expired`); err('This quotation has expired. Please request a revision/renewal.'); }
  for (const it of q.items) {
    if (!exclusive(db, it.assetId)) continue;
    const c = conflicts(db, it.assetId, it.start, it.end);
    if (!c.ok) { const a = db.assets.find(x => x.id === it.assetId)!; err(`Availability conflict on "${a.name}" (${c.bookings.map(b => b.number).concat(c.blocks.map(b => b.reason)).join(', ')})`); }
  }
  await api.tx(d => {
    d.quotations = d.quotations.map(x => x.id === qid ? { ...x, status: 'Approved' } : x.campaignId === q.campaignId && ['Sent', 'Draft', 'Requested', 'Revision Requested'].includes(x.status) ? { ...x, status: 'Rejected', notes: x.notes + ' (superseded)' } : x);
    q.items.forEach(it => {
      const a = d.assets.find(x => x.id === it.assetId)!; const bid = uid('bkg');
      d.bookings.unshift({ id: bid, number: seqNo('OB', d.bookings), quotationId: qid, campaignId: q.campaignId, customerId: q.customerId, assetId: it.assetId, ownerId: a.ownerId, start: it.start, end: it.end, amount: it.rate, supplierCost: it.supplierCost, status: 'Awaiting Supplier Confirmation', createdAt: today() });
      d.purchaseOrders.unshift({ id: uid('po'), number: seqNo('OPO', d.purchaseOrders), ownerId: a.ownerId, bookingId: bid, campaignId: q.campaignId, items: [{ desc: `Media display – ${a.name} (${it.start} to ${it.end})`, amount: it.supplierCost }], status: 'Sent', reason: '', createdAt: today() });
      d.notifications.unshift({ id: uid('ntf'), audience: 'owner', targetId: a.ownerId, title: 'New purchase order', body: `Please confirm availability for ${a.name}`, link: '/owner/orders', read: false, at: new Date().toISOString() });
    });
    d.campaigns = d.campaigns.map(c => c.id === q.campaignId ? { ...c, status: 'Booked' } : c);
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Quotation approved', body: `${q.number} approved by customer – awaiting supplier confirmation`, link: '/admin/bookings', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Quotation approved', entity: 'quotations', entityId: qid, summary: `${q.number} approved; ${q.items.length} booking(s) + PO(s) generated` });
  });
}
export async function customerQuoteAction(qid: string, status: 'Revision Requested' | 'Rejected', note: string) {
  const q = getDB().quotations.find(x => x.id === qid)!;
  await api.update('quotations', qid, { status, notes: (q.notes ? q.notes + '\n' : '') + `Customer: ${note}` }, `Quotation ${q.number}: ${status}`);
  notify({ audience: 'internal', title: `Quotation ${status.toLowerCase()}`, body: `${q.number}: ${note}`, link: '/admin/quotations' }); api.commit();
}

export async function confirmPO(poId: string) {
  const db = getDB(); const po = db.purchaseOrders.find(p => p.id === poId)!; const b = db.bookings.find(x => x.id === po.bookingId);
  if (b && exclusive(db, b.assetId)) { const c = conflicts(db, b.assetId, b.start, b.end, b.id, false); if (!c.ok) err('Cannot confirm: overlapping confirmed booking or blocked dates exist for this exclusive asset.'); }
  await api.tx(d => {
    d.purchaseOrders = d.purchaseOrders.map(p => p.id === poId ? { ...p, status: 'Confirmed' } : p);
    if (b) {
      d.bookings = d.bookings.map(x => x.id === b.id ? { ...x, status: 'Confirmed' } : x);
      if (!d.artworks.some(a => a.bookingId === b.id)) d.artworks.unshift({ id: uid('art'), campaignId: b.campaignId, bookingId: b.id, name: `Creative for ${d.assets.find(a => a.id === b.assetId)?.name}`, fileName: '', fileSize: 0, fileType: '', version: 0, status: 'Awaiting Upload', submittedAt: '', history: [] });
      d.notifications.unshift({ id: uid('ntf'), audience: 'customer', targetId: b.customerId, title: 'Booking confirmed', body: `${b.number} confirmed by media owner. Please upload artwork.`, link: '/customer/bookings', read: false, at: new Date().toISOString() });
      d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Supplier confirmation', body: `${po.number} confirmed`, link: '/admin/purchase-orders', read: false, at: new Date().toISOString() });
    }
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Booking confirmed', entity: 'bookings', entityId: b?.id || '-', summary: `${po.number} confirmed by supplier` });
  });
}
export async function rejectPO(poId: string, reason: string) {
  const po = getDB().purchaseOrders.find(p => p.id === poId)!;
  await api.tx(d => {
    d.purchaseOrders = d.purchaseOrders.map(p => p.id === poId ? { ...p, status: 'Rejected', reason } : p);
    d.bookings = d.bookings.map(x => x.id === po.bookingId ? { ...x, status: 'Cancelled' } : x);
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Supplier rejected PO', body: `${po.number}: ${reason}`, link: '/admin/purchase-orders', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'PO rejected', entity: 'purchaseOrders', entityId: poId, summary: reason });
  });
}

export function transitionCheck(db: DB, bid: string, next: BookingStatus): string | null {
  const b = db.bookings.find(x => x.id === bid)!;
  if (!BOOKING_FLOW[b.status].includes(next)) return `Invalid transition ${b.status} → ${next}`;
  if (next === 'Confirmed') { const po = db.purchaseOrders.find(p => p.bookingId === bid); if (po && po.status !== 'Confirmed' && po.status !== 'In Execution') return 'Supplier must confirm the purchase order first'; if (exclusive(db, b.assetId) && !conflicts(db, b.assetId, b.start, b.end, bid, false).ok) return 'Conflicting confirmed booking exists'; }
  if (next === 'Scheduled' && db.settings.workflows.requireArtworkApproval && !db.artworks.some(a => a.bookingId === bid && a.status === 'Approved')) return 'Approved artwork required before scheduling';
  if (next === 'Live' && !db.installations.some(i => i.bookingId === bid && i.status === 'Completed')) return 'Installation task must be completed first';
  if (next === 'Completed') { if (db.settings.workflows.requireProofApproval && !db.proofs.some(p => p.assetId === b.assetId && p.campaignId === b.campaignId && p.status === 'Approved')) return 'Approved proof of advertising required'; if (b.end > today()) return 'Booking period has not ended yet'; }
  return null;
}
export async function advanceBooking(bid: string, next: BookingStatus) {
  const db = getDB(); const e = transitionCheck(db, bid, next); if (e) err(e);
  const b = db.bookings.find(x => x.id === bid)!;
  await api.tx(d => {
    d.bookings = d.bookings.map(x => x.id === bid ? { ...x, status: next } : x);
    if (next === 'Scheduled' && !d.installations.some(i => i.bookingId === bid)) d.installations.unshift({ id: uid('ins'), campaignId: b.campaignId, bookingId: bid, assetId: b.assetId, scheduled: addDays(b.start, -1), assignee: 'Unassigned', supplierId: b.ownerId, instructions: 'Mount creative, verify lighting, capture proof photos.', status: 'Scheduled', completedAt: '', notes: '' });
    if (next === 'Installation in Progress') d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid && p.status === 'Confirmed' ? { ...p, status: 'In Execution' } : p);
    if (next === 'Live') { d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid ? { ...p, status: 'Fulfilled' } : p); d.campaigns = d.campaigns.map(c => c.id === b.campaignId ? { ...c, status: 'Live' } : c); }
    if (next === 'Cancelled') d.purchaseOrders = d.purchaseOrders.map(p => p.bookingId === bid && p.status !== 'Fulfilled' ? { ...p, status: 'Rejected', reason: 'Booking cancelled' } : p);
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
  const db = getDB(); if (!campaignCompletion(db, cid).ready) err('Completion requirements not satisfied');
  await api.tx(d => { d.campaigns = d.campaigns.map(c => c.id === cid ? { ...c, status: 'Completed' } : c); d.bookings = d.bookings.map(b => b.campaignId === cid && b.status === 'Live' ? { ...b, status: 'Completed' } : b); d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Campaign completed', entity: 'campaigns', entityId: cid, summary: 'Campaign marked complete' }); });
}

export async function recordReceipt(invoiceId: string, amount: number, date: string, method: string) {
  const db = getDB(); const inv = db.invoices.find(i => i.id === invoiceId) || err('Invoice not found');
  if (inv.status === 'Draft' || inv.status === 'Cancelled') err('Issue the invoice before recording payment');
  const t = invoiceTotals(inv, db); if (amount <= 0) err('Amount must be positive'); if (amount > t.balance + 0.001) err(`Amount exceeds balance due (${t.balance})`);
  await api.tx(d => {
    d.receipts.unshift({ id: uid('rcp'), number: seqNo('ORC', d.receipts), invoiceId, amount, date, method });
    const paid = sum(d.receipts.filter(r => r.invoiceId === invoiceId && !r.disabled).map(r => r.amount));
    d.invoices = d.invoices.map(i => i.id === invoiceId ? { ...i, status: paid + 0.001 >= t.total ? 'Paid' : 'Partially Paid' } : i);
    d.notifications.unshift({ id: uid('ntf'), audience: 'internal', title: 'Payment recorded', body: `₹${amount} against ${inv.number}`, link: '/admin/receipts', read: false, at: new Date().toISOString() });
    d.audit.unshift({ id: uid('aud'), at: new Date().toISOString(), user: getSession()?.name || '-', action: 'Payment recorded', entity: 'invoices', entityId: invoiceId, summary: `₹${amount} via ${method} (simulated)` });
  });
}
export async function invoiceFromCampaign(cid: string) {
  const db = getDB(); const q = db.quotations.find(x => x.campaignId === cid && x.status === 'Approved') || err('No approved quotation for this campaign');
  const c = db.campaigns.find(x => x.id === cid)!; const t = quoteTotals(q);
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
