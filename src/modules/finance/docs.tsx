import type { Invoice, Receipt } from '../../types';
import { useDB } from '../../services/storage.service';
import { invoiceTotals, inr, fmtDate } from '../../utils';
import { Badge } from '../../components/ui';

export function InvoiceDoc({ inv }: { inv: Invoice }) {
  const db = useDB(); const t = invoiceTotals(inv, db); const c = db.customers.find(x => x.id === inv.customerId); const cmp = db.campaigns.find(x => x.id === inv.campaignId);
  return <div className="text-sm print-area">
    <div className="flex justify-between items-start"><div><div className="font-extrabold text-xl">oolaa<span className="text-orange-500">.in</span></div><div className="text-xs text-slate-500">{db.settings.companyName}<br />Demo invoice — not a tax invoice</div></div><div className="text-right"><div className="text-lg font-bold">INVOICE</div><div>{inv.number}</div><Badge>{t.overdue ? 'Overdue' : inv.status}</Badge></div></div>
    <div className="grid grid-cols-3 gap-4 my-5 text-xs"><div><div className="text-slate-400">Bill to</div><b>{c?.company}</b><div>{c?.city} · GSTIN {c?.gstin}</div></div><div><div className="text-slate-400">Campaign</div>{cmp?.name || '—'}</div><div><div className="text-slate-400">Dates</div>Issued {fmtDate(inv.issue)}<br />Due {fmtDate(inv.due)}</div></div>
    <table className="w-full text-xs border"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{inv.items.map((i, k) => <tr key={k} className="border-t"><td className="p-2">{i.desc}</td><td className="p-2 text-right">{inr(i.amount)}</td></tr>)}</tbody></table>
    <div className="ml-auto max-w-xs mt-3 space-y-1 text-xs">{[['Subtotal', t.subtotal], ['Discount', -inv.discount], [`GST ${inv.taxRate}% (configurable)`, t.tax]].map(([l, v]) => <div key={l as string} className="flex justify-between"><span className="text-slate-500">{l}</span>{inr(v as number)}</div>)}<div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span>{inr(t.total)}</div><div className="flex justify-between text-emerald-700"><span>Paid</span>{inr(t.paid)}</div>{t.refunded > 0 && <div className="flex justify-between text-sky-700"><span>Refunded</span>{inr(t.refunded)}</div>}<div className="flex justify-between font-semibold"><span>Balance due</span>{inr(t.balance)}</div></div>
    <p className="text-[10px] text-slate-400 mt-6">{db.settings.gstNote} This demo is not a substitute for a compliant accounting system.</p>
  </div>;
}
export function ReceiptDoc({ r }: { r: Receipt }) {
  const db = useDB(); const inv = db.invoices.find(i => i.id === r.invoiceId); const c = db.customers.find(x => x.id === inv?.customerId);
  return <div className="text-sm print-area"><div className="font-extrabold text-xl">oolaa<span className="text-orange-500">.in</span></div><h2 className="text-lg font-bold mt-3">Payment Receipt {r.number}</h2><div className="grid grid-cols-2 gap-3 mt-3 text-xs"><div><div className="text-slate-400">Received from</div>{c?.company}</div><div><div className="text-slate-400">Against invoice</div>{inv?.number}</div><div><div className="text-slate-400">Date</div>{fmtDate(r.date)}</div><div><div className="text-slate-400">Method</div>{r.method} (simulated)</div></div><div className="text-2xl font-bold mt-4">{inr(r.amount)}</div><p className="text-[10px] text-slate-400 mt-4">Simulated payment — no real money was collected.</p></div>;
}
