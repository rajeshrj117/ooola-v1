import { useState } from 'react';
import { AlertTriangle, MessageSquare, Plus, RotateCcw, Send } from 'lucide-react';
import { useDB, useSession } from '../../services/storage.service';
import { addDisputeMessage, disputeOverdue, raiseDispute, reopenDispute, updateDispute, can } from '../../services/workflows';
import { Badge, Button, Card, Empty, ExportBtn, Field, Input, Modal, Notice, PageHeader, Select, Table, Tabs, inputCls, toast, toastErr, promptDialog } from '../../components/ui';
import { assetName, campName, custName, ownerName } from '../../components/shared';
import { exportCSV, fmtDate, inr } from '../../utils';
import type { Dispute, DisputeCategory, DisputeStatus } from '../../types';

const CATEGORIES: DisputeCategory[] = ['Installation quality', 'Proof of advertising', 'Payment / invoice', 'Refund', 'Availability / double booking', 'Artwork / creative', 'Supplier no-show', 'Other'];
const STATUSES: DisputeStatus[] = ['Open', 'Under Review', 'Awaiting Information', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High'] as const;
const prioCls = (p: string) => p === 'High' ? 'bg-rose-50 text-rose-700 ring-rose-200' : p === 'Medium' ? 'bg-amber-50 text-amber-700 ring-amber-200' : '';
const statusCls = (s: string) => s === 'Open' ? 'bg-rose-50 text-rose-700 ring-rose-200' : s === 'Closed' ? '' : '';

type Mode = 'customer' | 'owner' | 'admin';

export function DisputesPage({ mode }: { mode: Mode }) {
  const db = useDB(); const u = useSession(); const [tab, setTab] = useState('Active'); const [openId, setOpenId] = useState<string | null>(null); const [raise, setRaise] = useState(false);
  const mine = db.disputes.filter(d => mode === 'admin' ? true : mode === 'customer' ? d.customerId === u?.customerId && d.raisedBy !== 'Media Owner' : d.ownerId === u?.ownerId && d.raisedBy !== 'Customer');
  const rows = mine.filter(d => tab === 'All' ? true : tab === 'Active' ? !['Resolved', 'Closed'].includes(d.status) : tab === 'Overdue' ? disputeOverdue(d) : d.status === tab);
  const cur = db.disputes.find(d => d.id === openId) || null;
  const who = (d: Dispute) => d.raisedBy === 'Customer' ? custName(db, d.customerId || '') : d.raisedBy === 'Media Owner' ? ownerName(db, d.ownerId || '') : 'Oolaa staff';
  const canRaise = mode !== 'admin' || can(u, 'disputes');
  return <div>
    <PageHeader title="Disputes" subtitle={mode === 'admin' ? 'Customer and media-owner complaints, SLA tracking and resolution' : 'Raise an issue with a booking, invoice or purchase order and track its resolution'}
      actions={<><ExportBtn onClick={() => exportCSV('disputes', mine.map(d => ({ number: d.number, raised_by: d.raisedBy, party: who(d), category: d.category, subject: d.subject, priority: d.priority, status: d.status, assignee: d.assignee, created: d.createdAt.slice(0, 10), sla_due: d.slaDue, resolution: d.resolution })))} />{canRaise && <Button onClick={() => setRaise(true)}><Plus size={16} />Raise dispute</Button>}</>} />
    {mode === 'admin' && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">{[['Open', mine.filter(d => d.status === 'Open').length], ['Under review', mine.filter(d => d.status === 'Under Review').length], ['Overdue (SLA)', mine.filter(disputeOverdue).length], ['Resolved', mine.filter(d => ['Resolved', 'Closed'].includes(d.status)).length]].map(([l, v]) => <Card key={l as string} className="p-4"><div className="text-xs text-slate-400">{l}</div><div className="text-2xl font-bold">{v}</div></Card>)}</div>}
    <Tabs tabs={['Active', 'Overdue', ...STATUSES, 'All']} value={tab} onChange={setTab} />
    <Card><Table rows={rows} onRow={d => setOpenId(d.id)} empty={<Empty title="No disputes here" body={mode === 'admin' ? 'Nothing matches this filter.' : 'If something goes wrong with a booking, invoice or order, raise a dispute and our team will respond.'} />}
      cols={[{ key: 'number', label: 'Dispute', render: d => <div><b>{d.number}</b><div className="text-xs text-slate-400">{fmtDate(d.createdAt.slice(0, 10))}</div></div>, csv: d => d.number },
        { key: 'subject', label: 'Subject', render: d => <div className="max-w-xs"><div className="font-medium truncate">{d.subject}</div><div className="text-xs text-slate-400">{d.category}</div></div> },
        ...(mode === 'admin' ? [{ key: 'by', label: 'Raised by', render: (d: Dispute) => <div><div className="text-sm">{who(d)}</div><div className="text-xs text-slate-400">{d.raisedBy}</div></div> }] : []),
        { key: 'priority', label: 'Priority', render: d => <Badge className={prioCls(d.priority)}>{d.priority}</Badge> },
        { key: 'status', label: 'Status', render: d => <span className="flex items-center gap-1"><Badge className={statusCls(d.status)}>{d.status}</Badge>{disputeOverdue(d) && <Badge>Overdue</Badge>}</span> },
        ...(mode === 'admin' ? [{ key: 'assignee', label: 'Assignee' }] : [{ key: 'u', label: 'Updated', render: (d: Dispute) => fmtDate(d.updatedAt.slice(0, 10)) }]),
        { key: 'm', label: '', render: d => <span className="text-xs text-slate-400 flex items-center gap-1"><MessageSquare size={14} />{d.thread.filter(m => !m.internal || mode === 'admin').length}</span> }]} /></Card>
    {raise && <RaiseModal mode={mode} onClose={() => setRaise(false)} onDone={id => { setRaise(false); setOpenId(id); }} />}
    {cur && <DetailModal key={cur.id} d={cur} mode={mode} onClose={() => setOpenId(null)} />}
  </div>;
}

function RaiseModal({ mode, onClose, onDone }: { mode: Mode; onClose: () => void; onDone: (id: string) => void }) {
  const db = useDB(); const u = useSession();
  const [v, setV] = useState<any>({ category: 'Other', priority: 'Medium', subject: '', description: '', bookingId: '', invoiceId: '', poId: '', customerId: '', ownerId: '' }); const [busy, setBusy] = useState(false);
  const bookings = db.bookings.filter(b => mode === 'customer' ? b.customerId === u?.customerId : mode === 'owner' ? b.ownerId === u?.ownerId : true);
  const invoices = db.invoices.filter(i => mode === 'customer' ? i.customerId === u?.customerId : mode === 'admin' ? true : false).filter(i => i.status !== 'Draft');
  const pos = db.purchaseOrders.filter(p => mode === 'owner' ? p.ownerId === u?.ownerId : mode === 'admin');
  const set = (k: string, x: any) => setV((p: any) => ({ ...p, [k]: x }));
  const submit = async () => { setBusy(true); try { const id = await raiseDispute(v); toast('Dispute raised — our team will respond within the SLA'); onDone(id); } catch (e) { toastErr(e); } setBusy(false); };
  return <Modal open onClose={onClose} title="Raise a dispute" wide footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Submit dispute</Button></>}>
    <div className="grid sm:grid-cols-2 gap-3">
      {mode === 'admin' && <><Field label="Customer (optional)"><Select options={db.customers.map(c => ({ value: c.id, label: c.company }))} placeholder="—" value={v.customerId} onChange={(e: any) => set('customerId', e.target.value)} /></Field><Field label="Media owner (optional)"><Select options={db.owners.map(o => ({ value: o.id, label: o.company }))} placeholder="—" value={v.ownerId} onChange={(e: any) => set('ownerId', e.target.value)} /></Field></>}
      <Field label="Category *"><Select options={CATEGORIES} value={v.category} onChange={(e: any) => set('category', e.target.value)} /></Field>
      <Field label="Priority"><Select options={[...PRIORITIES]} value={v.priority} onChange={(e: any) => set('priority', e.target.value)} /></Field>
      <Field label="Related booking" className={mode === 'owner' ? '' : ''}><Select options={bookings.map(b => ({ value: b.id, label: `${b.number} · ${assetName(db, b.assetId)}` }))} placeholder="None" value={v.bookingId} onChange={(e: any) => set('bookingId', e.target.value)} /></Field>
      {mode !== 'owner' && <Field label="Related invoice"><Select options={invoices.map(i => ({ value: i.id, label: `${i.number} · ${campName(db, i.campaignId)}` }))} placeholder="None" value={v.invoiceId} onChange={(e: any) => set('invoiceId', e.target.value)} /></Field>}
      {mode !== 'customer' && <Field label="Related purchase order"><Select options={pos.map(p => ({ value: p.id, label: `${p.number} · ${inr(p.items.reduce((s, i) => s + i.amount, 0))}` }))} placeholder="None" value={v.poId} onChange={(e: any) => set('poId', e.target.value)} /></Field>}
      <Field label="Subject *" className="sm:col-span-2"><Input value={v.subject} onChange={(e: any) => set('subject', e.target.value)} placeholder="Short summary of the issue" /></Field>
      <Field label="Describe the issue *" className="sm:col-span-2"><textarea rows={4} className={inputCls} value={v.description} onChange={e => set('description', e.target.value)} placeholder="What happened, when, and what outcome you expect" /></Field>
    </div>
    <p className="text-[11px] text-slate-400 mt-3">High priority: response target 2 days · Medium: 5 days · Low: 10 days (demo SLA).</p>
  </Modal>;
}

function DetailModal({ d, mode, onClose }: { d: Dispute; mode: Mode; onClose: () => void }) {
  const db = useDB(); const u = useSession(); const [msg, setMsg] = useState(''); const [internal, setInternal] = useState(false); const [res, setRes] = useState(d.resolution); const [busy, setBusy] = useState(false);
  const staff = mode === 'admin' && can(u, 'disputes'); const closed = ['Resolved', 'Closed'].includes(d.status);
  const thread = d.thread.filter(m => staff || !m.internal);
  const run = async (fn: () => Promise<any>, ok?: string) => { setBusy(true); try { await fn(); ok && toast(ok); } catch (e) { toastErr(e); } setBusy(false); };
  const send = () => run(async () => { await addDisputeMessage(d.id, msg, internal); setMsg(''); setInternal(false); });
  const b = db.bookings.find(x => x.id === d.bookingId); const inv = db.invoices.find(x => x.id === d.invoiceId); const po = db.purchaseOrders.find(x => x.id === d.poId);
  const staffUsers = ['Unassigned', ...db.users.filter(x => can(x, 'disputes')).map(x => x.name)];
  return <Modal open onClose={onClose} wide title={<span>{d.number} <Badge>{d.status}</Badge></span>}>
    <div className="space-y-4 text-sm">
      <div><div className="text-lg font-semibold">{d.subject}</div><div className="text-xs text-slate-400">{d.category} · raised by {d.raisedBy === 'Customer' ? custName(db, d.customerId || '') : d.raisedBy === 'Media Owner' ? ownerName(db, d.ownerId || '') : 'Oolaa staff'} · {fmtDate(d.createdAt.slice(0, 10))}</div></div>
      <div className="grid sm:grid-cols-4 gap-3 text-xs"><div><div className="text-slate-400">Priority</div><Badge className={prioCls(d.priority)}>{d.priority}</Badge></div><div><div className="text-slate-400">Response due</div>{fmtDate(d.slaDue)} {disputeOverdue(d) && <Badge>Overdue</Badge>}</div><div><div className="text-slate-400">Assignee</div>{d.assignee}</div><div><div className="text-slate-400">Linked</div>{[b && `Booking ${b.number}`, inv && `Invoice ${inv.number}`, po && `PO ${po.number}`].filter(Boolean).join(' · ') || '—'}</div></div>
      {d.resolution && <Notice tone="blue"><div><b>Resolution:</b> {d.resolution}</div></Notice>}
      <div className="border rounded-xl max-h-72 overflow-y-auto divide-y">{thread.map((m, i) => <div key={i} className={`p-3 ${m.internal ? 'bg-amber-50' : m.role === 'Staff' ? 'bg-slate-50' : ''}`}><div className="flex justify-between text-xs text-slate-400"><span><b className="text-slate-700">{m.by}</b> · {m.role}{m.internal && ' · internal note (hidden from customer/owner)'}</span><span>{new Date(m.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div><div className="mt-1 whitespace-pre-wrap">{m.text}</div></div>)}</div>
      {!closed || staff ? <div className="space-y-2"><textarea rows={3} className={inputCls} placeholder={closed ? 'Dispute is closed — reopen to continue' : 'Write a reply…'} value={msg} disabled={closed && !staff} onChange={e => setMsg(e.target.value)} />
        <div className="flex items-center justify-between gap-2"><label className="text-xs flex items-center gap-1 text-slate-500">{staff && <><input type="checkbox" className="accent-orange-500" checked={internal} onChange={e => setInternal(e.target.checked)} />Internal note (not visible to the other party)</>}</label><Button size="sm" loading={busy} disabled={!msg.trim()} onClick={send}><Send size={14} />{internal ? 'Add note' : 'Send reply'}</Button></div></div> : null}
      {closed && !staff && <Button variant="outline" size="sm" loading={busy} onClick={async () => { const r = await promptDialog('Reopen dispute', 'Why are you reopening this?'); if (r) run(() => reopenDispute(d.id, r), 'Dispute reopened'); }}><RotateCcw size={14} />Reopen dispute</Button>}
      {staff && <div className="border-t pt-4 space-y-3"><div className="font-medium flex items-center gap-1"><AlertTriangle size={14} className="text-orange-500" />Manage dispute</div>
        <div className="grid sm:grid-cols-3 gap-3"><Field label="Status"><Select options={STATUSES} value={d.status} onChange={(e: any) => run(() => updateDispute(d.id, { status: e.target.value }), 'Status updated')} /></Field><Field label="Priority"><Select options={[...PRIORITIES]} value={d.priority} onChange={(e: any) => run(() => updateDispute(d.id, { priority: e.target.value }), 'Priority updated')} /></Field><Field label="Assignee"><Select options={staffUsers} value={d.assignee} onChange={(e: any) => run(() => updateDispute(d.id, { assignee: e.target.value }), 'Assignee updated')} /></Field></div>
        <Field label="Resolution note (required to resolve / close)"><textarea rows={2} className={inputCls} value={res} onChange={e => setRes(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={busy} onClick={() => run(() => updateDispute(d.id, { resolution: res }), 'Resolution saved')}>Save note</Button><Button size="sm" variant="success" loading={busy} disabled={closed} onClick={() => run(() => updateDispute(d.id, { status: 'Resolved', resolution: res }), 'Dispute resolved')}>Mark resolved</Button><Button size="sm" variant="outline" loading={busy} disabled={d.status === 'Closed'} onClick={() => run(() => updateDispute(d.id, { status: 'Closed', resolution: res }), 'Dispute closed')}>Close</Button>{closed && <Button size="sm" variant="outline" onClick={async () => { const r = await promptDialog('Reopen dispute', 'Reason'); if (r) run(() => reopenDispute(d.id, r), 'Dispute reopened'); }}><RotateCcw size={14} />Reopen</Button>}</div></div>}
    </div>
  </Modal>;
}
