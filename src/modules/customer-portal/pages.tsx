import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Megaphone, FileText, BookmarkCheck, Wrench, Image as ImgIcon, Wallet, Receipt, Plus, Trash2, Heart, Check, X, RotateCcw, GitCompare, Eye, Clock } from 'lucide-react';
import { useDB, useSession, api } from '../../services/storage.service';
import { requestQuotation, approveQuotation, customerQuoteAction } from '../../services/workflows';
import { Button, Card, Badge, Stat, PageHeader, Table, Modal, Field, Input, Select, toast, toastErr, Empty, Notice, promptDialog, confirmDialog, Tabs, inputCls, ExportBtn } from '../../components/ui';
import { AssetCard, QuotationDoc, PrintBtn, assetName, campName, MapView } from '../../components/shared';
import { shortlist, useShortlist } from '../../components/layout';
import { ArtworkUpload, ArtworkHistory, CampaignReport } from '../operations/common';
import { InvoiceDoc } from '../finance/docs';
import { DisableBtn, DisabledTag, toggleDisabled } from '../../components/disable';
import { inr, fmtDate, quoteTotals, invoiceTotals, sum, prorate, addDays, today, conflicts, exportCSV, isAvailableForRange } from '../../utils';
import { FormFields, validate, type FieldDef } from '../../components/CrudPage';
import type { Artwork, Quotation } from '../../types';

const useMe = () => { const u = useSession()!; const db = useDB(); return { u, db, cid: u.customerId!, me: db.customers.find(c => c.id === u.customerId)! }; };

export function CustomerDashboard() {
  const { db, cid, me } = useMe();
  const camps = db.campaigns.filter(c => c.customerId === cid); const qs = db.quotations.filter(q => q.customerId === cid); const bk = db.bookings.filter(b => b.customerId === cid);
  const inv = db.invoices.filter(i => i.customerId === cid && i.status !== 'Draft');
  const ins = db.installations.filter(i => camps.some(c => c.id === i.campaignId) && i.status !== 'Completed');
  const arts = db.artworks.filter(a => camps.some(c => c.id === a.campaignId) && ['Awaiting Upload', 'Revisions Requested', 'Submitted', 'Under Review'].includes(a.status));
  const spend = sum(inv.map(i => invoiceTotals(i, db).total)); const due = sum(inv.map(i => invoiceTotals(i, db).balance));
  const deadlines = [...qs.filter(q => q.status === 'Sent').map(q => ({ d: q.expiry, t: `Quotation ${q.number} expires`, to: `/customer/quotations/${q.id}` })), ...inv.filter(i => invoiceTotals(i, db).balance > 0).map(i => ({ d: i.due, t: `Invoice ${i.number} due`, to: `/customer/invoices/${i.id}` })), ...ins.map(i => ({ d: i.scheduled, t: `Installation at ${assetName(db, i.assetId)}`, to: '/customer/bookings' }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  return <div><PageHeader title={`Welcome, ${me.company}`} subtitle="Your advertising workspace" actions={<Link to="/customer/plan"><Button><Plus size={16} />Plan new campaign</Button></Link>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat icon={Megaphone} label="Active campaigns" value={camps.filter(c => ['Live', 'Booked'].includes(c.status)).length} />
      <Stat icon={FileText} label="Pending quotations" value={qs.filter(q => ['Sent', 'Requested', 'Draft', 'Revision Requested'].includes(q.status)).length} tone="blue" />
      <Stat icon={BookmarkCheck} label="Confirmed bookings" value={bk.filter(b => !['Awaiting Supplier Confirmation', 'Cancelled'].includes(b.status)).length} tone="green" />
      <Stat icon={Wrench} label="Upcoming installations" value={ins.length} tone="violet" />
      <Stat icon={ImgIcon} label="Artwork needing action" value={arts.length} tone="red" />
      <Stat icon={Wallet} label="Campaign expenditure" value={inr(spend)} tone="slate" hint="Invoiced, incl. GST" />
      <Stat icon={Receipt} label="Outstanding invoices" value={inr(due)} tone="red" />
      <Stat icon={Clock} label="Quotes awaiting you" value={qs.filter(q => q.status === 'Sent').length} tone="orange" />
    </div>
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Card className="p-4"><h3 className="font-semibold mb-3">Upcoming deadlines</h3>{deadlines.length ? deadlines.map((d, i) => <Link key={i} to={d.to} className="flex justify-between py-2 border-b last:border-0 text-sm hover:text-orange-600"><span>{d.t}</span><span className={d.d < today() ? 'text-rose-600' : 'text-slate-500'}>{fmtDate(d.d)}</span></Link>) : <Empty title="No deadlines" />}</Card>
      <Card className="p-4"><h3 className="font-semibold mb-3">Recent campaign activity</h3>{db.audit.filter(a => a.summary && (camps.some(c => a.entityId === c.id) || qs.some(q => q.id === a.entityId) || bk.some(b => b.id === a.entityId))).slice(0, 6).map(a => <div key={a.id} className="text-sm py-2 border-b last:border-0"><b>{a.action}</b> · {a.summary}<div className="text-[11px] text-slate-400">{new Date(a.at).toLocaleString('en-IN')}</div></div>)}{camps.slice(0, 4).map(c => <Link key={c.id} to={`/customer/campaigns/${c.id}`} className="flex justify-between py-2 border-b last:border-0 text-sm"><span>{c.name}</span><Badge>{c.status}</Badge></Link>)}</Card>
    </div></div>;
}

export function MediaPlanning() {
  const { db, cid } = useMe(); const sl = useShortlist(); const nav = useNavigate();
  const init = (() => { try { return JSON.parse(sessionStorage.getItem('oolaa_plan_dates') || 'null'); } catch { return null; } })() || [addDays(today(), 21), addDays(today(), 50)];
  const brands = db.brands.filter(b => b.customerId === cid && !b.disabled);
  const [step, setStep] = useState(1); const [v, setV] = useState({ name: '', brandId: brands[0]?.id || '', start: init[0], end: init[1], budget: '500000', notes: '' }); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [view, setView] = useState<'grid' | 'map'>('grid'); const [onlyAvail, setOnlyAvail] = useState(true);
  const all = db.assets.filter(a => !a.disabled && a.verification === 'Approved' && db.categories.find(c => c.id === a.categoryId)?.enabled);
  const rangeOk = v.end >= v.start; const pub = onlyAvail && rangeOk ? all.filter(a => isAvailableForRange(db, a, v.start, v.end)) : all;
  const sel = all.filter(a => sl.includes(a.id));
  const est = sum(sel.map(a => prorate(a.rate, v.start, v.end)));
  const submit = async () => {
    if (!v.name.trim()) return toast('Campaign name is required', 'error'); if (!v.brandId) return toast('Assign a brand', 'error'); if (v.end < v.start) return toast('End date must be after start date', 'error');
    setBusy(true); try { await requestQuotation({ customerId: cid, brandId: v.brandId, name: v.name, start: v.start, end: v.end, budget: +v.budget || 0, assetIds: sel.map(a => a.id), notes: v.notes }); shortlist.clear(); sessionStorage.removeItem('oolaa_plan_dates'); toast('Quotation request submitted'); nav('/customer/quotations'); } catch (e) { toastErr(e); } setBusy(false);
  };
  return <div><PageHeader title="Media planning" subtitle="Select locations, set dates and budget, then request a quotation" />
    <div className="flex gap-2 mb-5">{['Select locations', 'Campaign details', 'Review & submit'].map((s, i) => <button key={s} onClick={() => (i + 1 < step || sel.length) && setStep(i + 1)} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium ${step === i + 1 ? 'bg-orange-500 text-white' : step > i + 1 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}. {s}</button>)}</div>
    {step === 1 && <><div className="flex flex-wrap items-end gap-2 mb-3"><label className="text-[11px] text-slate-500">Campaign start<input className={inputCls} type="date" value={v.start} onChange={e => setV({ ...v, start: e.target.value, end: v.end < e.target.value ? e.target.value : v.end })} /></label><label className="text-[11px] text-slate-500">Campaign end<input className={inputCls} type="date" min={v.start} value={v.end} onChange={e => setV({ ...v, end: e.target.value })} /></label><label className="text-xs text-slate-600 flex items-center gap-1 pb-2"><input type="checkbox" className="accent-orange-500" checked={onlyAvail} onChange={e => setOnlyAvail(e.target.checked)} />Only sites available for these dates ({pub.length}/{all.length})</label></div><div className="flex gap-2 mb-3"><input className={inputCls} placeholder="Search locations…" value={q} onChange={e => setQ(e.target.value)} /><Select className="w-32" options={[{ value: 'grid', label: 'Grid' }, { value: 'map', label: 'Map' }]} value={view} onChange={(e: any) => setView(e.target.value)} /></div>
      <div className="sticky top-16 z-20 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 mb-3 flex justify-between items-center text-sm"><span><Heart size={14} className="inline text-rose-500" /> {sel.length} location(s) selected</span><Button size="sm" disabled={!sel.length} onClick={() => setStep(2)}>Continue</Button></div>
      {view === 'map' ? <MapView assets={pub} onSelect={a => { shortlist.toggle(a.id); toast(sl.includes(a.id) ? 'Removed' : 'Added ' + a.name, 'info'); }} /> :
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{pub.filter(a => !q || (a.name + a.location + a.city).toLowerCase().includes(q.toLowerCase())).map(a => <AssetCard key={a.id} a={a} to={`/customer/asset/${a.id}?from=${v.start}&to=${v.end}`} />)}</div>}</>}
    {step === 2 && <Card className="p-5 max-w-2xl"><div className="grid sm:grid-cols-2 gap-3">
      <Field label="Campaign name *" className="sm:col-span-2"><Input value={v.name} onChange={(e: any) => setV({ ...v, name: e.target.value })} placeholder="e.g. Diwali Store Launch" /></Field>
      <Field label="Brand *"><Select options={brands.map(b => ({ value: b.id, label: b.name }))} placeholder="Select brand" value={v.brandId} onChange={(e: any) => setV({ ...v, brandId: e.target.value })} /></Field>
      <Field label="Budget (₹)"><Input type="number" value={v.budget} onChange={(e: any) => setV({ ...v, budget: e.target.value })} /></Field>
      <Field label="Start date"><Input type="date" value={v.start} onChange={(e: any) => setV({ ...v, start: e.target.value })} /></Field>
      <Field label="End date"><Input type="date" value={v.end} min={v.start} onChange={(e: any) => setV({ ...v, end: e.target.value })} /></Field>
      <Field label="Notes for the planning team" className="sm:col-span-2"><textarea className={inputCls} rows={3} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} /></Field></div>
      <div className="flex justify-between mt-4"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button onClick={() => v.name && v.brandId ? setStep(3) : toast('Name and brand are required', 'error')}>Review plan</Button></div></Card>}
    {step === 3 && <div className="grid lg:grid-cols-[1fr_320px] gap-4"><Card><div className="p-4 border-b font-semibold">Proposed media plan · {v.name}</div>
      {sel.map(a => { const c = conflicts(db, a.id, v.start, v.end); return <div key={a.id} className="flex gap-3 p-4 border-b items-center"><img src={a.images[0]} className="w-20 aspect-video object-cover rounded" /><div className="flex-1 min-w-0"><div className="font-medium text-sm">{a.name}</div><div className="text-xs text-slate-500">{a.location}, {a.city} · {a.width}×{a.height} ft</div>{!c.ok && <div className="text-xs text-rose-600">⚠ Dates overlap existing holds — team will propose alternatives</div>}</div><b className="text-sm">{inr(prorate(a.rate, v.start, v.end))}</b><button onClick={() => shortlist.toggle(a.id)}><Trash2 size={14} className="text-rose-500" /></button></div>; })}
      {!sel.length && <Empty title="No locations selected" />}</Card>
      <Card className="p-5 self-start space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Brand</span><span>{brands.find(b => b.id === v.brandId)?.name}</span></div><div className="flex justify-between"><span className="text-slate-500">Dates</span><span>{fmtDate(v.start)} – {fmtDate(v.end)}</span></div><div className="flex justify-between"><span className="text-slate-500">Sites</span><span>{sel.length}</span></div><div className="flex justify-between"><span className="text-slate-500">Budget</span><span>{inr(+v.budget)}</span></div>
        <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Est. media</span><span>{inr(est)}</span></div>{est > +v.budget && <div className="text-xs text-amber-600">Estimate exceeds budget</div>}<p className="text-[11px] text-slate-400">Indicative, excl. production, installation and GST. Final pricing in quotation.</p>
        <Button className="w-full" loading={busy} disabled={!sel.length} onClick={submit}>Submit quotation request</Button><Button variant="ghost" className="w-full" onClick={() => setStep(2)}>Back</Button></Card></div>}
  </div>;
}

export function CustomerCampaigns() {
  const { db, cid } = useMe(); const nav = useNavigate(); const rows = db.campaigns.filter(c => c.customerId === cid);
  return <div><PageHeader title="Campaigns" actions={<><ExportBtn onClick={() => exportCSV('my-campaigns', rows.map(c => ({ name: c.name, start: c.start, end: c.end, status: c.status, budget: c.budget })))} /><Link to="/customer/plan"><Button><Plus size={16} />New campaign</Button></Link></>} />
    <Card><Table rows={rows} onRow={c => nav(`/customer/campaigns/${c.id}`)} cols={[{ key: 'name', label: 'Campaign', render: c => <b>{c.name}</b> }, { key: 'b', label: 'Brand', render: c => db.brands.find(b => b.id === c.brandId)?.name }, { key: 'd', label: 'Dates', render: c => `${fmtDate(c.start)} – ${fmtDate(c.end)}` }, { key: 's', label: 'Sites', render: c => c.assetIds.length }, { key: 'budget', label: 'Budget', render: c => inr(c.budget) }, { key: 'status', label: 'Status', render: c => <Badge>{c.status}</Badge> }]} /></Card></div>;
}
export function CustomerCampaignDetail() { const { id } = useParams(); return <div><Link to="/customer/campaigns" className="text-sm text-slate-500">← Campaigns</Link><div className="mt-3"><CampaignReport campaignId={id!} /></div></div>; }

export function CustomerQuotations() {
  const { db, cid } = useMe(); const nav = useNavigate(); const [cmp, setCmp] = useState<string[]>([]); const [open, setOpen] = useState(false);
  const rows = db.quotations.filter(q => q.customerId === cid && q.status !== 'Draft');
  return <div><PageHeader title="Quotations" subtitle="Review, compare and approve quotations" actions={cmp.length >= 2 && <Button variant="outline" onClick={() => setOpen(true)}><GitCompare size={16} />Compare ({cmp.length})</Button>} />
    <Card><Table rows={rows} onRow={q => nav(`/customer/quotations/${q.id}`)} empty={<Empty title="No quotations yet" action={<Link to="/customer/plan"><Button>Request a quotation</Button></Link>} />} cols={[
      { key: 'c', label: '', render: q => <input type="checkbox" className="accent-orange-500" checked={cmp.includes(q.id)} onClick={e => e.stopPropagation()} onChange={() => setCmp(cmp.includes(q.id) ? cmp.filter(x => x !== q.id) : [...cmp, q.id])} /> },
      { key: 'number', label: 'Number', render: q => <b>{q.number}</b> }, { key: 'cmp', label: 'Campaign', render: q => campName(db, q.campaignId) }, { key: 'i', label: 'Sites', render: q => q.items.length },
      { key: 't', label: 'Total', render: q => q.status === 'Requested' ? <span className="text-slate-400">Pricing pending</span> : inr(quoteTotals(q).total) }, { key: 'e', label: 'Expiry', render: q => <span className={q.expiry < today() ? 'text-rose-600' : ''}>{fmtDate(q.expiry)}</span> },
      { key: 's', label: 'Status', render: q => <Badge>{q.status === 'Sent' && q.expiry < today() ? 'Expired' : q.status}</Badge> }]} /></Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Compare quotations" wide><div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th />{cmp.map(id => <th key={id} className="p-2 text-left">{db.quotations.find(q => q.id === id)?.number}</th>)}</tr></thead><tbody>
      {([['Campaign', (q: Quotation) => campName(db, q.campaignId)], ['Sites', (q: Quotation) => q.items.map(i => assetName(db, i.assetId)).join(', ')], ['Media', (q: Quotation) => inr(quoteTotals(q).media)], ['Production', (q: Quotation) => inr(q.production)], ['Installation', (q: Quotation) => inr(q.installation)], ['Discount', (q: Quotation) => inr(q.discount)], ['GST', (q: Quotation) => inr(quoteTotals(q).tax)], ['Total', (q: Quotation) => <b>{inr(quoteTotals(q).total)}</b>], ['Status', (q: Quotation) => <Badge>{q.status}</Badge>]] as const).map(([l, f]) => <tr key={l} className="border-t"><td className="p-2 text-xs text-slate-500">{l}</td>{cmp.map(id => <td key={id} className="p-2 text-xs">{f(db.quotations.find(q => q.id === id)!)}</td>)}</tr>)}</tbody></table></div></Modal></div>;
}
export function CustomerQuotationDetail() {
  const { id } = useParams(); const { db } = useMe(); const q = db.quotations.find(x => x.id === id); const [busy, setBusy] = useState(false);
  if (!q) return <Empty title="Quotation not found" />;
  const expired = q.expiry < today();
  const approve = async () => { if (!(await confirmDialog('Approve quotation?', 'Approval triggers availability checks and supplier confirmation. Bookings are confirmed only after media owners confirm.', false))) return; setBusy(true); try { await approveQuotation(q.id); toast('Quotation approved — awaiting supplier confirmation'); } catch (e) { toastErr(e); } setBusy(false); };
  const act = async (s: 'Revision Requested' | 'Rejected') => { const n = await promptDialog(s === 'Rejected' ? 'Reason for rejection' : 'What should be revised?'); if (n) { await customerQuoteAction(q.id, s, n); toast(`Quotation ${s.toLowerCase()}`); } };
  return <div><Link to="/customer/quotations" className="text-sm text-slate-500 print:hidden">← Quotations</Link>
    <div className="flex flex-wrap gap-2 my-3 print:hidden">{q.status === 'Sent' && <><Button variant="success" loading={busy} onClick={approve} disabled={expired}><Check size={16} />Approve</Button><Button variant="outline" onClick={() => act('Revision Requested')}><RotateCcw size={16} />Request revision</Button><Button variant="danger" onClick={() => act('Rejected')}><X size={16} />Reject</Button></>}{expired && q.status === 'Sent' && <><Badge>Expired</Badge><Button variant="outline" onClick={() => act('Revision Requested')}>Request renewal</Button></>}<PrintBtn /></div>
    {q.status === 'Requested' && <Notice tone="blue"><div className="space-y-1"><b>{q.items.every(it => (q.ownerApprovals || []).includes(db.assets.find(a => a.id === it.assetId)?.ownerId || '')) ? 'Availability reviewed — final quotation is being prepared' : 'Waiting for media owner availability review'}</b><p>The amount shown is indicative until the final quotation is sent. Media owner(s) must review the requested dates first; then the Oolaa sales team can send the final quotation for your approval.</p><p>Once the quotation status changes to <b>Sent</b>, this page will show the <b>Approve</b> button.</p></div></Notice>}
    {q.status === 'Sent' && <Notice tone="green">This quotation has been sent for your review. Check the pricing and campaign dates, then use <b>Approve</b> above to request booking confirmation. The asset is checked again for availability before bookings are created.</Notice>}
    {q.status === 'Approved' && <Notice tone="green">You approved this quotation. Check <b>Bookings</b> for supplier confirmation and <b>Invoices</b> for the invoice after the required confirmation steps.</Notice>}
    {q.status === 'Revision Requested' && <Notice tone="amber">You requested a revision. The planning team must update and resend the quotation before you can approve it.</Notice>}
    <Card className="p-6 mt-3"><QuotationDoc q={q} /></Card></div>;
}

export function CustomerBookings() {
  const { db, cid } = useMe(); const rows = db.bookings.filter(b => b.customerId === cid); const [view, setView] = useState<string | null>(null);
  const b = rows.find(x => x.id === view);
  return <div><PageHeader title="Bookings" subtitle="Status, artwork, installation and proof for each site" actions={<ExportBtn onClick={() => exportCSV('my-bookings', rows.map(b => ({ number: b.number, asset: assetName(db, b.assetId), start: b.start, end: b.end, amount: b.amount, status: b.status })))} />} />
    <Card><Table rows={rows} onRow={r => setView(r.id)} empty={<Empty title="No bookings yet" body="Bookings appear after you approve a quotation." />} cols={[{ key: 'number', label: 'Booking', render: r => <b>{r.number}</b> }, { key: 'a', label: 'Site', render: r => assetName(db, r.assetId) }, { key: 'c', label: 'Campaign', render: r => campName(db, r.campaignId) }, { key: 'd', label: 'Dates', render: r => `${fmtDate(r.start)} – ${fmtDate(r.end)}` }, { key: 'amt', label: 'Amount', render: r => inr(r.amount) }, { key: 's', label: 'Status', render: r => <Badge>{r.status}</Badge> }, { key: 'v', label: '', render: () => <Eye size={16} className="text-slate-400" /> }]} /></Card>
    <Modal open={!!b} onClose={() => setView(null)} title={b?.number} wide>{b && (() => { const art = db.artworks.filter(a => a.bookingId === b.id); const ins = db.installations.find(i => i.bookingId === b.id); const pr = db.proofs.filter(p => p.campaignId === b.campaignId && p.assetId === b.assetId && p.status === 'Approved'); return <div className="space-y-4 text-sm">
      <div className="grid sm:grid-cols-3 gap-3"><div><div className="text-xs text-slate-400">Site</div>{assetName(db, b.assetId)}</div><div><div className="text-xs text-slate-400">Dates</div>{fmtDate(b.start)} – {fmtDate(b.end)}</div><div><div className="text-xs text-slate-400">Status</div><Badge>{b.status}</Badge></div></div>
      <div><h4 className="font-medium mb-2">Artwork</h4>{art.map(a => <div key={a.id} className="flex items-center justify-between p-2 border rounded-lg mb-1"><span>{a.name} · v{a.version}</span><span className="flex gap-2 items-center"><Badge>{a.status}</Badge>{['Awaiting Upload', 'Revisions Requested', 'Rejected', 'Submitted'].includes(a.status) && <ArtworkUpload art={a} />}</span></div>)}{!art.length && <div className="text-slate-400 text-xs">Artwork slot is created when the media owner confirms the booking.</div>}</div>
      <div><h4 className="font-medium mb-1">Installation schedule</h4>{ins ? <div>{fmtDate(ins.scheduled)} · <Badge>{ins.status}</Badge></div> : <span className="text-xs text-slate-400">Not scheduled yet</span>}</div>
      <div><h4 className="font-medium mb-2">Installation photographs</h4>{pr.length ? <div className="grid grid-cols-3 gap-2">{pr.map(p => <img key={p.id} src={p.image} className="rounded aspect-video object-cover" />)}</div> : <span className="text-xs text-slate-400">No approved proof yet</span>}</div>
      <div className="flex gap-2"><Link to={`/customer/campaigns/${b.campaignId}`}><Button size="sm" variant="outline">Campaign report</Button></Link><Link to="/customer/invoices"><Button size="sm" variant="outline">Invoices</Button></Link></div></div>; })()}</Modal></div>;
}

export function CustomerArtwork() {
  const { db, cid } = useMe(); const camps = db.campaigns.filter(c => c.customerId === cid); const rows = db.artworks.filter(a => camps.some(c => c.id === a.campaignId)); const [h, setH] = useState<Artwork | null>(null);
  return <div><PageHeader title="Artwork" subtitle="Upload creatives and track approvals" />
    <Notice>Files are stored only in this browser (IndexedDB) and never sent to a server. Large files may exceed browser storage limits; clearing site data removes them.</Notice>
    <Card className="mt-4"><Table rows={rows} cols={[{ key: 'p', label: '', render: a => a.preview ? <img src={a.preview} className="w-14 h-10 rounded object-cover" /> : <div className="w-14 h-10 rounded bg-slate-100" /> }, { key: 'name', label: 'Artwork', render: a => <div><b>{a.name}</b><div className="text-xs text-slate-400">{a.fileName || 'No file'} · v{a.version}</div></div> }, { key: 'c', label: 'Campaign', render: a => campName(db, a.campaignId) }, { key: 'd', label: 'Submitted', render: a => fmtDate(a.submittedAt) }, { key: 's', label: 'Status', render: a => <Badge>{a.status}</Badge> }, { key: 'x', label: '', render: a => <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>{a.status !== 'Approved' && <ArtworkUpload art={a} label={a.version ? 'New version' : 'Upload'} />}<Button size="sm" variant="ghost" onClick={() => setH(a)}>History</Button></div> }]} /></Card>
    <ArtworkHistory art={h} open={!!h} onClose={() => setH(null)} /></div>;
}

export function CustomerReports() {
  const { db, cid } = useMe(); const camps = db.campaigns.filter(c => c.customerId === cid && ['Booked', 'Live', 'Completed'].includes(c.status)); const [sel, setSel] = useState(camps[0]?.id || '');
  return <div><PageHeader title="Campaign reports" actions={<Select className="w-64" options={camps.map(c => ({ value: c.id, label: c.name }))} value={sel} onChange={(e: any) => setSel(e.target.value)} />} />{sel ? <CampaignReport campaignId={sel} /> : <Empty title="No booked campaigns yet" />}</div>;
}

export function CustomerInvoices() {
  const { db, cid } = useMe(); const nav = useNavigate(); const rows = db.invoices.filter(i => i.customerId === cid && i.status !== 'Draft');
  return <div><PageHeader title="Invoices" actions={<ExportBtn onClick={() => exportCSV('my-invoices', rows.map(i => { const t = invoiceTotals(i, db); return { number: i.number, issue: i.issue, due: i.due, total: t.total, paid: t.paid, balance: t.balance, status: i.status }; }))} />} />
    <Notice tone="blue">Payments in this demo are simulated by the Oolaa finance team. No real money is collected.</Notice>
    <Card className="mt-4"><Table rows={rows} onRow={i => nav(`/customer/invoices/${i.id}`)} cols={[{ key: 'number', label: 'Invoice', render: i => <b>{i.number}</b> }, { key: 'c', label: 'Campaign', render: i => campName(db, i.campaignId) }, { key: 'issue', label: 'Issued', render: i => fmtDate(i.issue) }, { key: 'due', label: 'Due', render: i => fmtDate(i.due) }, { key: 't', label: 'Total', render: i => inr(invoiceTotals(i, db).total) }, { key: 'b', label: 'Balance', render: i => inr(invoiceTotals(i, db).balance) }, { key: 's', label: 'Status', render: i => <Badge>{invoiceTotals(i, db).overdue ? 'Overdue' : i.status}</Badge> }]} /></Card></div>;
}
export function CustomerInvoiceDetail() { const { id } = useParams(); const { db } = useMe(); const i = db.invoices.find(x => x.id === id); return <div><Link to="/customer/invoices" className="text-sm text-slate-500 print:hidden">← Invoices</Link><div className="my-3 print:hidden"><PrintBtn /></div>{i ? <Card className="p-6"><InvoiceDoc inv={i} /></Card> : <Empty />}</div>; }

const companyFields: FieldDef[] = [{ name: 'company', label: 'Company', required: true }, { name: 'contact', label: 'Primary contact', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'city', label: 'City', required: true }, { name: 'industry', label: 'Industry' }, { name: 'gstin', label: 'GSTIN (demo)' }];
export function CustomerAccount() {
  const { db, cid, me } = useMe(); const [tab, setTab] = useState('Profile'); const [edit, setEdit] = useState(false); const [v, setV] = useState<any>(me); const [e, setE] = useState<any>({});
  const [brand, setBrand] = useState<any>(null); const [ct, setCt] = useState<any>(null);
  const brands = db.brands.filter(b => b.customerId === cid);
  const saveProfile = async () => { const er = validate(companyFields, v); setE(er); if (Object.keys(er).length) return; await api.update('customers', cid, v, 'Company profile updated'); setEdit(false); toast('Profile saved'); };
  const saveBrand = async () => { if (!brand.name?.trim()) return toast('Brand name required', 'error'); if (brand.id) await api.update('brands', brand.id, brand, 'Brand updated'); else await api.create('brands', { ...brand, customerId: cid }, 'brd', 'Brand added'); setBrand(null); toast('Brand saved'); };
  const toggleBrand = (b: any) => toggleDisabled('brands', b, `Brand ${b.name}`);
  const saveContact = async () => { if (!ct.name || !/^\S+@\S+\.\S+$/.test(ct.email || '')) return toast('Name and valid email required', 'error'); const contacts = [...me.contacts]; if (ct.idx !== undefined) contacts[ct.idx] = { name: ct.name, email: ct.email, role: ct.role }; else contacts.push({ name: ct.name, email: ct.email, role: ct.role || '' }); await api.update('customers', cid, { contacts }, 'Contacts updated'); setCt(null); toast('Contact saved'); };
  return <div><PageHeader title="Account" subtitle={me.company} /><Tabs tabs={['Profile', 'Brands', 'Contacts', 'Campaign history']} value={tab} onChange={setTab} />
    {tab === 'Profile' && <Card className="p-5 max-w-3xl">{edit ? <><FormFields fields={companyFields} value={v} set={(k, x) => setV({ ...v, [k]: x })} errors={e} /><div className="flex gap-2 mt-4"><Button onClick={saveProfile}>Save</Button><Button variant="outline" onClick={() => { setEdit(false); setV(me); }}>Cancel</Button></div></> : <><div className="grid sm:grid-cols-2 gap-4 text-sm">{companyFields.map(f => <div key={f.name}><div className="text-xs text-slate-400">{f.label}</div>{(me as any)[f.name] || '—'}</div>)}</div><Button className="mt-4" variant="outline" onClick={() => { setV(me); setEdit(true); }}>Edit company details</Button></>}</Card>}
    {tab === 'Brands' && <Card><div className="p-3 border-b flex justify-end"><Button size="sm" onClick={() => setBrand({ name: '', category: '' })}><Plus size={14} />Add brand</Button></div><Table rows={brands} cols={[{ key: 'name', label: 'Brand', render: b => <span className={b.disabled ? 'opacity-60' : ''}>{b.name} {b.disabled && <DisabledTag />}</span> }, { key: 'category', label: 'Category' }, { key: 'n', label: 'Campaigns', render: b => db.campaigns.filter(c => c.brandId === b.id).length }, { key: 'x', label: '', render: b => <div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" onClick={() => setBrand(b)}>Edit</Button><DisableBtn disabled={b.disabled} onClick={() => toggleBrand(b)} /></div> }]} /></Card>}
    {tab === 'Contacts' && <Card><div className="p-3 border-b flex justify-end"><Button size="sm" onClick={() => setCt({})}><Plus size={14} />Add contact</Button></div>{me.contacts.map((c, i) => <div key={i} className="flex justify-between items-center p-4 border-b text-sm"><div className={c.disabled ? 'opacity-60' : ''}><b>{c.name}</b> {c.disabled && <DisabledTag />}<div className="text-xs text-slate-500">{c.email} · {c.role}</div></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setCt({ ...c, idx: i })}>Edit</Button><DisableBtn disabled={c.disabled} onClick={async () => { if (!c.disabled && !(await confirmDialog(`Disable contact ${c.name}?`, 'You can enable it again any time.', false))) return; await api.update('customers', cid, { contacts: me.contacts.map((x, k) => k === i ? { ...x, disabled: !x.disabled } : x) }, `Contact ${c.disabled ? 'enabled' : 'disabled'}`); toast(c.disabled ? 'Contact enabled' : 'Contact disabled'); }} /></div></div>)}{!me.contacts.length && <Empty title="No contacts" />}</Card>}
    {tab === 'Campaign history' && <Card><Table rows={db.campaigns.filter(c => c.customerId === cid)} cols={[{ key: 'name', label: 'Campaign' }, { key: 'd', label: 'Dates', render: c => `${fmtDate(c.start)} – ${fmtDate(c.end)}` }, { key: 's', label: 'Status', render: c => <Badge>{c.status}</Badge> }]} /></Card>}
    <Modal open={!!brand} onClose={() => setBrand(null)} title={brand?.id ? 'Edit brand' : 'Add brand'} footer={<Button onClick={saveBrand}>Save</Button>}>{brand && <div className="space-y-3"><Field label="Brand name *"><Input value={brand.name} onChange={(e: any) => setBrand({ ...brand, name: e.target.value })} /></Field><Field label="Category"><Input value={brand.category} onChange={(e: any) => setBrand({ ...brand, category: e.target.value })} /></Field></div>}</Modal>
    <Modal open={!!ct} onClose={() => setCt(null)} title="Contact" footer={<Button onClick={saveContact}>Save</Button>}>{ct && <div className="space-y-3"><Field label="Name *"><Input value={ct.name || ''} onChange={(e: any) => setCt({ ...ct, name: e.target.value })} /></Field><Field label="Email *"><Input value={ct.email || ''} onChange={(e: any) => setCt({ ...ct, email: e.target.value })} /></Field><Field label="Role"><Input value={ct.role || ''} onChange={(e: any) => setCt({ ...ct, role: e.target.value })} /></Field></div>}</Modal>
  </div>;
}
