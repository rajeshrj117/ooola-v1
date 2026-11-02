import type { Quotation, Invoice, DB, Booking, Asset, BookingStatus, PurchaseOrder } from '../types';

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const seqNo = (prefix: string, list: { number: string }[]) => {
  const max = list.reduce((m, x) => Math.max(m, parseInt((x.number || '').replace(/\D/g, '').slice(-4)) || 0), 0);
  return `${prefix}-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`;
};
// decimal-safe: operate in paise
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (a: number[]) => a.reduce((s, x) => s + Math.round((Number(x) || 0) * 100), 0) / 100;
export const inr = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string | Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86400000) + 1);
export const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2;
export const pct = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;

/** Prorated media price for period, based on 30-day monthly rate */
export const prorate = (monthly: number, start: string, end: string) => r2(monthly * daysBetween(start, end) / 30);

export function quoteTotals(q: Quotation) {
  // QuoteItem.rate and supplierCost are unit prices for the requested date range.
  // All financial totals must account for the requested quantity.
  const media = sum(q.items.map(i => i.rate * Math.max(1, Number(i.quantity) || 1)));
  const supplierMedia = sum(q.items.map(i => i.supplierCost * Math.max(1, Number(i.quantity) || 1)));
  const subtotal = sum([media, q.production, q.installation, q.service]);
  const discounted = r2(subtotal - (q.discount || 0));
  const tax = r2(discounted * (q.taxRate || 0) / 100);
  const total = r2(discounted + tax);
  const revenue = discounted;
  const costs = sum([supplierMedia, q.productionCost, q.installationCost, q.otherCost]);
  const profit = r2(revenue - costs);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { media, supplierMedia, subtotal, discounted, tax, total, revenue, costs, profit, margin };
}
export function invoiceTotals(inv: Invoice, db: DB) {
  const subtotal = sum(inv.items.map(i => i.amount));
  const net = r2(subtotal - (inv.discount || 0));
  const tax = r2(net * (inv.taxRate || 0) / 100);
  const total = r2(net + tax);
  const paid = sum(db.receipts.filter(r => r.invoiceId === inv.id && !r.disabled).map(r => r.amount));
  const refunded = sum(db.refunds.filter(r => r.invoiceId === inv.id && r.status === 'Approved').map(r => r.amount));
  const credited = sum((db.creditNotes || []).filter(c => c.invoiceId === inv.id && c.status === 'Issued').map(c => c.amount));
  const balance = inv.status === 'Cancelled' || inv.status === 'Draft' ? 0 : r2(Math.max(0, total - paid - credited + refunded));
  const overdue = balance > 0 && inv.due < today() && inv.status !== 'Draft';
  return { subtotal, net, tax, total, paid, refunded, credited, balance, overdue };
}
export function poTotals(po: PurchaseOrder, db: DB) {
  const total = sum(po.items.map(i => i.amount));
  const paid = sum(db.supplierPayments.filter(p => p.poId === po.id).map(p => p.amount));
  const due = po.status === 'Rejected' || po.status === 'Draft' ? 0 : r2(total - paid);
  return { total, paid, due };
}

const ACTIVE: BookingStatus[] = ['Awaiting Supplier Confirmation', 'Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'];
const HARD: BookingStatus[] = ['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'];
export interface CapacityRequest { assetId: string; start: string; end: string; quantity?: number; }

/** Common capacity validator. Capacity is evaluated per calendar day so non-overlapping
 * bookings do not consume capacity simultaneously. Existing missing quantities count as 1. */
export function validateCapacity(db: DB, requests: CapacityRequest[], ignoreBookingId?: string, includeHolds = true) {
  const results = requests.map(request => {
    const asset = db.assets.find(a => a.id === request.assetId);
    const category = db.categories.find(c => c.id === asset?.categoryId);
    const capacity = category?.bookingModel === 'Exclusive date-based' ? 1 : Math.max(1, Number(asset?.capacity) || 1);
    const countedStatuses = includeHolds ? ACTIVE : HARD;
    const bookings = db.bookings.filter(b => b.assetId === request.assetId && b.id !== ignoreBookingId && countedStatuses.includes(b.status) && overlaps(request.start, request.end, b.start, b.end));
    const blocks = (asset?.blocks || []).filter(k => overlaps(request.start, request.end, k.from, k.to));
    const requestedQuantity = Math.max(1, Number(request.quantity) || 1);
    let peakUsedCapacity = 0;
    let capacityExceeded = false;
    const assetRequests = requests.filter(x => x.assetId === request.assetId);
    // Inclusive date ranges; evaluate existing + requested units on each same day.
    for (let day = request.start; day <= request.end; ) {
      const used = bookings.filter(b => b.start <= day && day <= b.end).reduce((n, b) => n + Math.max(1, Number(b.quantity) || 1), 0);
      const requested = assetRequests.filter(x => x.start <= day && day <= x.end).reduce((n, x) => n + Math.max(1, Number(x.quantity) || 1), 0);
      peakUsedCapacity = Math.max(peakUsedCapacity, used);
      if (used + requested > capacity) capacityExceeded = true;
      const dt = new Date(`${day}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() + 1); day = dt.toISOString().slice(0, 10);
    }
    return { request, bookings, blocks, capacity, usedCapacity: peakUsedCapacity, requestedQuantity, capacityExceeded, ok: !!asset && request.start <= request.end && !capacityExceeded && blocks.length === 0 };
  });
  return { ok: results.every(r => r.ok), results };
}

export function conflicts(db: DB, assetId: string, start: string, end: string, ignoreBookingId?: string, includeHolds = true, requestedQuantity = 1) {
  const check = validateCapacity(db, [{ assetId, start, end, quantity: requestedQuantity }], ignoreBookingId, includeHolds);
  const r = check.results[0];
  return { bookings: r?.bookings || [], blocks: r?.blocks || [], capacity: r?.capacity || 1, usedCapacity: r?.usedCapacity || 0, capacityExceeded: r?.capacityExceeded || false, ok: !!r?.ok };
}
export function dayStatus(db: DB, asset: Asset, date: string): { status: 'Available' | 'Held' | 'Booked' | 'Blocked'; ref?: string } {
  const b = db.bookings.find(x => x.assetId === asset.id && ACTIVE.includes(x.status) && date >= x.start && date <= x.end);
  if (b) return { status: HARD.includes(b.status) ? 'Booked' : 'Held', ref: b.number };
  const k = asset.blocks.find(x => date >= x.from && date <= x.to);
  if (k) return { status: k.status, ref: k.reason };
  return { status: 'Available' };
}

export const BOOKING_FLOW: Record<BookingStatus, BookingStatus[]> = {
  'Enquiry': ['Quotation in Progress', 'Cancelled'],
  'Quotation in Progress': ['Quotation Sent', 'Cancelled'],
  'Quotation Sent': ['Awaiting Customer Approval', 'Cancelled'],
  'Awaiting Customer Approval': ['Awaiting Supplier Confirmation', 'Cancelled'],
  'Awaiting Supplier Confirmation': ['Confirmed', 'Cancelled'],
  'Confirmed': ['Artwork Pending', 'Cancelled'],
  'Artwork Pending': ['Scheduled', 'Cancelled'],
  'Scheduled': ['Installation in Progress', 'Cancelled'],
  'Installation in Progress': ['Live'],
  'Live': ['Completed'],
  'Completed': [], 'Cancelled': [],
};

export function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}
export function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const exportCSV = (name: string, rows: Record<string, any>[]) => download(`${name}-${today()}.csv`, toCSV(rows));
export const bookingIsActive = (b: Booking) => ACTIVE.includes(b.status);

/** Date-range availability used by search. Exclusive-date assets must have no overlapping hold/booking/block;
 *  shared-capacity assets (capacity > 1) stay available until overlapping bookings reach capacity. Blocked dates always exclude. */
export function isAvailableForRange(db: DB, asset: Asset, start: string, end: string) {
  return validateCapacity(db, [{ assetId: asset.id, start, end, quantity: 1 }]).ok;
}
