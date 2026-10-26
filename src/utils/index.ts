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
  const media = sum(q.items.map(i => i.rate));
  const supplierMedia = sum(q.items.map(i => i.supplierCost));
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
  const paid = sum(db.receipts.filter(r => r.invoiceId === inv.id).map(r => r.amount));
  const refunded = sum(db.refunds.filter(r => r.invoiceId === inv.id && r.status === 'Approved').map(r => r.amount));
  const balance = inv.status === 'Cancelled' || inv.status === 'Draft' ? 0 : r2(total - paid + refunded);
  const overdue = balance > 0 && inv.due < today() && inv.status !== 'Draft';
  return { subtotal, net, tax, total, paid, refunded, balance, overdue };
}
export function poTotals(po: PurchaseOrder, db: DB) {
  const total = sum(po.items.map(i => i.amount));
  const paid = sum(db.supplierPayments.filter(p => p.poId === po.id).map(p => p.amount));
  const due = po.status === 'Rejected' || po.status === 'Draft' ? 0 : r2(total - paid);
  return { total, paid, due };
}

const ACTIVE: BookingStatus[] = ['Awaiting Supplier Confirmation', 'Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'];
const HARD: BookingStatus[] = ['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'];
export function conflicts(db: DB, assetId: string, start: string, end: string, ignoreBookingId?: string, includeHolds = true) {
  const set = includeHolds ? ACTIVE : HARD;
  const b = db.bookings.filter(x => x.assetId === assetId && x.id !== ignoreBookingId && set.includes(x.status) && overlaps(start, end, x.start, x.end));
  const asset = db.assets.find(a => a.id === assetId);
  const blocks = (asset?.blocks || []).filter(k => overlaps(start, end, k.from, k.to));
  return { bookings: b, blocks, ok: b.length === 0 && blocks.length === 0 };
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
  const c = conflicts(db, asset.id, start, end);
  if (c.blocks.length) return false;
  const cap = Math.max(1, asset.capacity || 1);
  return c.bookings.length < cap;
}
