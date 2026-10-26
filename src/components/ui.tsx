import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { X, Inbox, Loader2, CheckCircle2, AlertTriangle, Info, Download } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

export const cn = (...a: any[]) => twMerge(clsx(a));

// ---------- Toasts
type T = { id: number; msg: string; kind: 'success' | 'error' | 'info' };
let toasts: T[] = []; const tl = new Set<() => void>();
export const toast = (msg: string, kind: T['kind'] = 'success') => { const id = Math.random(); toasts = [...toasts, { id, msg, kind }]; tl.forEach(l => l()); setTimeout(() => { toasts = toasts.filter(t => t.id !== id); tl.forEach(l => l()); }, 3800); };
export const toastErr = (e: any) => toast(e?.message || String(e), 'error');
export function Toaster() {
  const list = useSyncExternalStore(cb => { tl.add(cb); return () => tl.delete(cb); }, () => toasts);
  return <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm print:hidden">{list.map(t => (
    <div key={t.id} className={cn('flex items-start gap-2 rounded-xl px-4 py-3 shadow-lg text-sm text-white animate-[fadeIn_.2s]', t.kind === 'success' ? 'bg-emerald-600' : t.kind === 'error' ? 'bg-rose-600' : 'bg-slate-800')}>
      {t.kind === 'success' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}<span>{t.msg}</span></div>))}</div>;
}

export function Button({ variant = 'primary', size = 'md', className, loading, children, ...p }: any) {
  const v: any = { primary: 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm', dark: 'bg-slate-900 hover:bg-slate-800 text-white', outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white', ghost: 'hover:bg-slate-100 text-slate-700', danger: 'bg-rose-600 hover:bg-rose-700 text-white', success: 'bg-emerald-600 hover:bg-emerald-700 text-white' };
  const s: any = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return <button {...p} disabled={p.disabled || loading} className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', v[variant], s[size], className)}>{loading && <Loader2 size={14} className="animate-spin" />}{children}</button>;
}
export const Card = ({ className, children, ...p }: any) => <div {...p} className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm', className)}>{children}</div>;

const tone = (s: string) => {
  const g = ['Approved', 'Paid', 'Completed', 'Confirmed', 'Live', 'Available', 'Fulfilled', 'Verified (simulated)', 'Signed (simulated)', 'Active', 'Enabled', 'Yes'];
  const r = ['Rejected', 'Cancelled', 'Overdue', 'Expired', 'Blocked', 'Delayed', 'Issue Reported', 'Disabled', 'No'];
  const a = ['Submitted', 'Under Review', 'Sent', 'Awaiting Customer Approval', 'Awaiting Supplier Confirmation', 'Partially Paid', 'Held', 'Pending', 'Requested', 'Revision Requested', 'Revisions Requested', 'Needs More Information', 'Issued', 'In Execution', 'In Progress', 'Installation in Progress', 'Quotation Sent'];
  return g.includes(s) ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : r.includes(s) ? 'bg-rose-50 text-rose-700 ring-rose-200' : a.includes(s) ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-700 ring-slate-200';
};
export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', tone(String(children)), className)}>{children}</span>;

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); if (open) addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
    <div onMouseDown={e => e.stopPropagation()} className={cn('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}>
      <div className="flex items-center justify-between px-5 py-4 border-b"><h3 className="font-semibold text-slate-900">{title}</h3><button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button></div>
      <div className="p-5 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 py-3 border-t flex justify-end gap-2 bg-slate-50 rounded-b-2xl">{footer}</div>}
    </div></div>;
}

// Confirm & prompt dialogs (promise-based)
type Dlg = { title: string; body?: string; input?: string; danger?: boolean; resolve: (v: any) => void } | null;
let dlg: Dlg = null; const dl = new Set<() => void>();
const setDlg = (d: Dlg) => { dlg = d; dl.forEach(l => l()); };
export const confirmDialog = (title: string, body?: string, danger = true) => new Promise<boolean>(resolve => setDlg({ title, body, danger, resolve }));
export const promptDialog = (title: string, label = 'Reason') => new Promise<string | null>(resolve => setDlg({ title, input: label, resolve }));
export function DialogHost() {
  const d = useSyncExternalStore(cb => { dl.add(cb); return () => dl.delete(cb); }, () => dlg);
  const [v, setV] = useState('');
  if (!d) return null;
  const close = (val: any) => { d.resolve(val); setDlg(null); setV(''); };
  return <Modal open onClose={() => close(d.input ? null : false)} title={d.title} footer={<><Button variant="outline" onClick={() => close(d.input ? null : false)}>Cancel</Button><Button variant={d.danger ? 'danger' : 'primary'} disabled={!!d.input && !v.trim()} onClick={() => close(d.input ? v.trim() : true)}>Confirm</Button></>}>
    {d.body && <p className="text-sm text-slate-600">{d.body}</p>}
    {d.input && <Field label={d.input}><textarea autoFocus className={inputCls} rows={3} value={v} onChange={e => setV(e.target.value)} /></Field>}
  </Modal>;
}

export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400';
export const Field = ({ label, error, children, className }: any) => <label className={cn('block', className)}><span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>{children}{error && <span className="text-xs text-rose-600 mt-1 block">{error}</span>}</label>;
export const Input = (p: any) => <input {...p} className={cn(inputCls, p.className)} />;
export const Select = ({ options, placeholder, ...p }: any) => <select {...p} className={cn(inputCls, p.className)}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>;

export function Stat({ label, value, icon: Icon, hint, tone = 'orange' }: any) {
  const t: any = { orange: 'bg-orange-50 text-orange-600', blue: 'bg-sky-50 text-sky-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-rose-50 text-rose-600', violet: 'bg-violet-50 text-violet-600', slate: 'bg-slate-100 text-slate-600' };
  return <Card className="p-4 flex items-start gap-3"><div className={cn('p-2.5 rounded-xl', t[tone])}>{Icon && <Icon size={20} />}</div><div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold text-slate-900 truncate">{value}</div>{hint && <div className="text-[11px] text-slate-400">{hint}</div>}</div></Card>;
}
export const Empty = ({ title = 'Nothing here yet', body, action }: any) => <div className="text-center py-14 px-4"><div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3"><Inbox /></div><div className="font-medium text-slate-700">{title}</div>{body && <p className="text-sm text-slate-500 mt-1">{body}</p>}{action && <div className="mt-4">{action}</div>}</div>;
export const Skeleton = ({ rows = 5 }) => <div className="p-4 space-y-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />)}</div>;
export function useFakeLoad(ms = 350) { const [l, s] = useState(true); useEffect(() => { const t = setTimeout(() => s(false), ms); return () => clearTimeout(t); }, []); return l; }

export function PageHeader({ title, subtitle, actions }: any) {
  return <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5"><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}</div><div className="flex flex-wrap gap-2 print:hidden">{actions}</div></div>;
}
export const ExportBtn = ({ onClick }: any) => <Button variant="outline" size="sm" onClick={onClick}><Download size={14} />CSV</Button>;

export interface Col<R> { key: string; label: string; render?: (r: R) => ReactNode; csv?: (r: R) => any; className?: string; }
export function Table<R extends { id: string }>({ rows, cols, onRow, empty, loading }: { rows: R[]; cols: Col<R>[]; onRow?: (r: R) => void; empty?: ReactNode; loading?: boolean }) {
  if (loading) return <Skeleton />;
  if (!rows.length) return <>{empty || <Empty />}</>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b">{cols.map(c => <th key={c.key} className={cn('px-4 py-3 font-medium whitespace-nowrap', c.className)}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} onClick={() => onRow?.(r)} className={cn('border-b last:border-0 hover:bg-orange-50/40', onRow && 'cursor-pointer')}>{cols.map(c => <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>{c.render ? c.render(r) : (r as any)[c.key]}</td>)}</tr>)}</tbody></table></div>;
}
export const Notice = ({ children, tone = 'amber' }: any) => <div className={cn('rounded-xl px-4 py-3 text-xs flex gap-2 items-start', tone === 'amber' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-50 text-sky-800 border border-sky-200')}><Info size={14} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
export const Tabs = ({ tabs, value, onChange }: any) => <div className="flex gap-1 overflow-x-auto border-b mb-4">{tabs.map((t: string) => <button key={t} onClick={() => onChange(t)} className={cn('px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px', value === t ? 'border-orange-500 text-orange-600 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t}</button>)}</div>;
