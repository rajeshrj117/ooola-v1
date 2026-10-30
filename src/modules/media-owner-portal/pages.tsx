import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Building2, ShieldQuestion, CheckCircle2, CalendarClock, BookmarkCheck, Inbox, Wrench, ShoppingCart, IndianRupee, Plus, Pencil, CalendarDays, Send, Upload, X, Check } from 'lucide-react';
import { useDB, useSession, api, saveFile, fileToThumb } from '../../services/storage.service';
import { confirmPO, rejectPO } from '../../services/workflows';
import { Button, Card, Badge, Stat, PageHeader, Table, Modal, Select, inputCls, toast, toastErr, Empty, Notice, promptDialog } from '../../components/ui';
import { AvailabilityCalendar, MapView, assetName, catName, custName } from '../../components/shared';
import { FormFields, validate, type FieldDef } from '../../components/CrudPage';
import { ProofUpload } from '../operations/common';
import { DisableBtn, DisabledTag, toggleDisabled } from '../../components/disable';
import { inr, fmtDate, sum, poTotals, exportCSV } from '../../utils';
import { MAX_PHOTOS, type Asset } from '../../types';
const ACTIVE_BOOKING = ['Awaiting Supplier Confirmation', 'Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'];

const useOwner = () => { const u = useSession()!; const db = useDB(); return { u, db, oid: u.ownerId!, me: db.owners.find(o => o.id === u.ownerId)! }; };

export function OwnerDashboard() {
  const { db, oid, me } = useOwner(); const as = db.assets.filter(a => a.ownerId === oid); const bk = db.bookings.filter(b => b.ownerId === oid); const pos = db.purchaseOrders.filter(p => p.ownerId === oid);
  const ins = db.installations.filter(i => i.supplierId === oid && i.status !== 'Completed'); const nav = useNavigate();
  const active = pos.filter(p => ['Confirmed', 'In Execution'].includes(p.status));
  const months = (() => { const m: Record<string, number> = {}; pos.filter(p => !['Rejected', 'Draft'].includes(p.status)).forEach(p => { const k = p.createdAt.slice(0, 7); m[k] = (m[k] || 0) + poTotals(p, db).total; }); return Object.keys(m).sort().slice(-6).map(k => ({ month: new Date(k + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: m[k] })); })();
  const byAsset = (() => { const m: Record<string, number> = {}; pos.filter(p => !['Rejected', 'Draft'].includes(p.status)).forEach(p => { const b = db.bookings.find(x => x.id === p.bookingId); if (b) m[b.assetId] = (m[b.assetId] || 0) + poTotals(p, db).total; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, value]) => ({ name: (db.assets.find(a => a.id === id)?.name || id).slice(0, 22), value })); })();
  const avail = ['Available', 'Held', 'Booked', 'Blocked'].map(k => ({ name: k, value: as.filter(a => a.availability === k).length })).filter(x => x.value);
  const PIE = ['#10b981', '#f59e0b', '#f97316', '#94a3b8'];
  const earn = sum(pos.filter(p => !['Rejected', 'Draft'].includes(p.status)).map(p => poTotals(p, db).total)); const paid = sum(pos.map(p => poTotals(p, db).paid));
  return <div><PageHeader title={me.company} subtitle="Media owner workspace" />
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      <Stat icon={Building2} label="Total listed assets" value={as.length} /><Stat icon={ShieldQuestion} label="Pending verification" value={as.filter(a => ['Submitted', 'Under Review', 'Needs More Information'].includes(a.verification)).length} tone="violet" />
      <Stat icon={CheckCircle2} label="Available assets" value={as.filter(a => a.availability === 'Available').length} tone="green" /><Stat icon={CalendarClock} label="Reserved (held)" value={bk.filter(b => b.status === 'Awaiting Supplier Confirmation').length} tone="orange" />
      <Stat icon={BookmarkCheck} label="Confirmed bookings" value={bk.filter(b => ['Confirmed', 'Artwork Pending', 'Scheduled', 'Installation in Progress', 'Live'].includes(b.status)).length} tone="blue" />
      <Stat icon={Inbox} label="Pending enquiries / POs" value={pos.filter(p => p.status === 'Sent').length} tone="red" /><Stat icon={Wrench} label="Installation pending" value={ins.length} tone="slate" /><Stat icon={ShoppingCart} label="Active orders" value={active.length} tone="blue" />
      <Stat icon={ShoppingCart} label="Purchase orders" value={pos.length} /><Stat icon={IndianRupee} label="Estimated earnings" value={inr(earn)} tone="green" hint={`${inr(paid)} received (simulated)`} />
    </div>
    <Card className="mt-4 p-4"><h3 className="font-semibold mb-2">Orders awaiting your confirmation</h3>{pos.filter(p => p.status === 'Sent').map(p => <div key={p.id} className="flex justify-between items-center py-2 border-b text-sm"><span>{p.number} · {p.items[0]?.desc}</span><b>{inr(poTotals(p, db).total)}</b></div>)}{!pos.some(p => p.status === 'Sent') && <Empty title="No pending orders" />}</Card>
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Card className="p-4"><div className="flex justify-between items-center mb-2"><h3 className="font-semibold">Installation pending</h3><Link to="/owner/proofs" className="text-xs text-orange-600">Upload proof</Link></div>{ins.map(i => <div key={i.id} className="flex justify-between items-center py-2 border-b text-sm gap-2"><div className="min-w-0"><div className="truncate font-medium">{assetName(db, i.assetId)}</div><div className="text-xs text-slate-400">Scheduled {fmtDate(i.scheduled)}</div></div><Badge>{i.status}</Badge></div>)}{!ins.length && <Empty title="No installations pending" />}</Card>
      <Card className="p-4"><div className="flex justify-between items-center mb-2"><h3 className="font-semibold">Active orders</h3><Link to="/owner/orders" className="text-xs text-orange-600">View all</Link></div>{active.map(p => { const b = db.bookings.find(x => x.id === p.bookingId); return <div key={p.id} className="flex justify-between items-center py-2 border-b text-sm gap-2"><div className="min-w-0"><div className="truncate font-medium">{p.number} · {p.items[0]?.desc}</div><div className="text-xs text-slate-400">{b ? `${fmtDate(b.start)} – ${fmtDate(b.end)}` : '—'}</div></div><div className="text-right"><b>{inr(poTotals(p, db).total)}</b><div><Badge>{p.status}</Badge></div></div></div>; })}{!active.length && <Empty title="No active orders" />}</Card></div>
    <h3 className="font-semibold mt-6 mb-2">Analytics</h3>
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-2"><div className="text-sm font-medium mb-2">Order value by month</div>{months.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={months}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} tickFormatter={(v: number) => v >= 100000 ? `${v / 100000}L` : `${v / 1000}k`} /><Tooltip formatter={(v: any) => inr(Number(v))} /><Bar dataKey="value" name="Order value" fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty title="No order data yet" />}</Card>
      <Card className="p-4"><div className="text-sm font-medium mb-2">Assets by availability</div>{avail.length ? <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={avail} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>{avail.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <Empty title="No assets" />}</Card>
      <Card className="p-4 lg:col-span-3"><div className="text-sm font-medium mb-2">Top assets by order value</div>{byAsset.length ? <ResponsiveContainer width="100%" height={Math.max(160, byAsset.length * 44)}><BarChart data={byAsset} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" fontSize={12} tickFormatter={(v: number) => v >= 100000 ? `${v / 100000}L` : `${v / 1000}k`} /><YAxis type="category" dataKey="name" fontSize={12} width={150} /><Tooltip formatter={(v: any) => inr(Number(v))} /><Bar dataKey="value" name="Order value" fill="#0ea5e9" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <Empty title="No order data yet" />}</Card></div>
    <h3 className="font-semibold mt-6 mb-2">Asset map</h3>
    {as.length ? <MapView assets={as} onSelect={a => nav(`/owner/calendar?asset=${a.id}`)} /> : <Card><Empty title="No assets to show on the map" /></Card>}</div>;
}

const assetFields = (cats: { value: string; label: string }[]): FieldDef[] => [
  { name: 'name', label: 'Asset name', required: true, full: true }, { name: 'refNo', label: 'Reference number', full: true, placeholder: 'e.g. your own site / hoarding ID', help: 'Your internal reference for this asset (optional)' }, { name: 'categoryId', label: 'Category', type: 'select', options: cats, required: true }, { name: 'format', label: 'Advertising format', required: true },
  { name: 'city', label: 'City', type: 'select', options: ['Chennai', 'Bengaluru', 'Hyderabad', 'Coimbatore'], required: true }, { name: 'location', label: 'Area / locality', required: true }, { name: 'address', label: 'Address or location description', full: true, required: true },
  { name: 'lat', label: 'Latitude', type: 'number' }, { name: 'lng', label: 'Longitude', type: 'number' }, { name: 'width', label: 'Width (ft)', type: 'number', required: true, min: 1 }, { name: 'height', label: 'Height (ft)', type: 'number', required: true, min: 1 },
  { name: 'panels', label: 'Number of panels', type: 'number', min: 1 }, { name: 'lighting', label: 'Lighting', type: 'select', options: ['Front-lit', 'Back-lit', 'Non-lit', 'Digital LED'], required: true },
  { name: 'supplierRate', label: 'Your rate / month (₹, confidential)', type: 'number', required: true, min: 1 }, { name: 'mrp', label: 'MRP / card rate per month (₹)', type: 'number', required: true, min: 1, help: 'Published list price before any discount' }, { name: 'agencyRate', label: 'Agency pricing per month (₹)', type: 'number', required: true, min: 1, help: 'Discounted rate offered to ad agencies (must not exceed MRP)' }, { name: 'minDays', label: 'Minimum booking (days)', type: 'number', min: 1, required: true }, { name: 'capacity', label: 'Max display capacity (slots)', type: 'number', min: 1 },
  { name: 'traffic', label: 'Traffic / visibility description', type: 'textarea' },
];
export function AssetEditor({ asset, ownerId, open, onClose, internal }: { asset: Partial<Asset> | null; ownerId?: string; open: boolean; onClose: () => void; internal?: boolean }) {
  const db = useDB(); const [v, setV] = useState<any>({}); const [e, setE] = useState<any>({}); const ref = useRef<HTMLInputElement>(null); const [key, setKey] = useState<any>(null);
  if (asset !== key) { setKey(asset); setV(asset ? { panels: 1, capacity: 1, minDays: 30, lighting: 'Front-lit', images: [], ...asset } : {}); setE({}); }
  const fields = [...(internal ? [{ name: 'ownerId', label: 'Media owner', type: 'select', options: db.owners.map(o => ({ value: o.id, label: o.company })), required: true } as FieldDef, { name: 'rate', label: 'Customer indicative rate / month (₹)', type: 'number', required: true, min: 1 } as FieldDef] : []), ...assetFields(db.categories.map(c => ({ value: c.id, label: c.name + (c.enabled ? '' : ' (disabled)') })))];
  const save = async () => {
    const er = validate(fields, v); if (!er.agencyRate && Number(v.agencyRate) > Number(v.mrp)) er.agencyRate = 'Agency price cannot exceed MRP'; if (!v.images?.length) er.images = 'Add at least one photograph'; else if (v.images.length > MAX_PHOTOS) er.images = `Maximum ${MAX_PHOTOS} photographs per site — remove ${v.images.length - MAX_PHOTOS}`; setE(er); if (Object.keys(er).length) return toast('Please fix the highlighted fields', 'error');
    const n: any = { ...v }; ['lat', 'lng', 'width', 'height', 'panels', 'supplierRate', 'mrp', 'agencyRate', 'minDays', 'capacity', 'rate'].forEach(k => n[k] = Number(n[k] || 0));
    if (!internal && !asset?.id) n.rate = Math.round(n.supplierRate * 1.35 / 1000) * 1000; // platform indicative price (customer-facing) set by Oolaa
    if (asset?.id) { await api.update('assets', asset.id, n, `Asset ${n.name} updated`); toast('Asset updated'); }
    else { const all = db.assets; await api.create('assets', { ...n, ownerId: n.ownerId || ownerId, code: `OOL-${n.city.slice(0, 3).toUpperCase()}-${String(all.length + 1).padStart(3, '0')}`, verification: 'Draft', availability: 'Available', blocks: [], rate: n.rate || n.supplierRate }, 'ast', `Asset ${n.name} created`); toast('Asset created as Draft'); }
    onClose();
  };
  const onFiles = async (files: FileList | null) => {
    if (!files) return; const imgs = [...(v.images || [])]; const room = MAX_PHOTOS - imgs.length; const picked = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (picked.length > room) toast(room > 0 ? `Only ${room} more photo(s) allowed — maximum is ${MAX_PHOTOS} per site. Extra files were skipped.` : `Maximum ${MAX_PHOTOS} photographs per site. Remove one to add another.`, 'error');
    for (const f of picked.slice(0, Math.max(0, room))) { await saveFile(f); imgs.push(await fileToThumb(f, 900)); }
    setV((p: any) => ({ ...p, images: imgs })); if (ref.current) ref.current.value = '';
  };
  return <Modal open={open} onClose={onClose} title={asset?.id ? 'Edit asset' : 'Add advertising asset'} wide footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save asset</Button></>}>
    <FormFields fields={fields} value={v} set={(k, x) => setV((p: any) => ({ ...p, [k]: x }))} errors={e} />
    <div className="mt-4"><div className="text-xs font-medium text-slate-600 mb-1">Photographs * <span className={(v.images || []).length >= MAX_PHOTOS ? 'text-orange-600' : 'text-slate-400'}>({(v.images || []).length}/{MAX_PHOTOS}, max {MAX_PHOTOS})</span></div><div className="flex flex-wrap gap-2">{(v.images || []).map((s: string, i: number) => <div key={i} className="relative"><img src={s} className="w-28 aspect-video object-cover rounded-lg" /><button onClick={() => setV({ ...v, images: v.images.filter((_: any, k: number) => k !== i) })} className="absolute -top-1 -right-1 bg-white rounded-full shadow p-0.5"><X size={12} /></button></div>)}
      {(v.images || []).length < MAX_PHOTOS && <button onClick={() => ref.current?.click()} className="w-28 aspect-video rounded-lg border-2 border-dashed grid place-items-center text-slate-400 hover:border-orange-400"><Upload size={18} /></button>}</div>{e.images && <div className="text-xs text-rose-600 mt-1">{e.images}</div>}<input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={x => onFiles(x.target.files)} /></div>
    {!internal && <p className="text-[11px] text-slate-400 mt-3">Your rate is confidential and never shown to advertisers. Oolaa sets the customer-facing indicative price.</p>}
  </Modal>;
}

export function OwnerInventory() {
  const { db, oid } = useOwner(); const rows = db.assets.filter(a => a.ownerId === oid); const [ed, setEd] = useState<any>(null);
  const F0 = { q: '', cat: '', city: '', ver: '', av: '', bk: '', st: '' }; const [f, setF] = useState(F0); const setFv = (k: string, x: string) => setF(p => ({ ...p, [k]: x }));
  const isBooked = (a: Asset) => db.bookings.some(b => b.assetId === a.id && ACTIVE_BOOKING.includes(b.status));
  const shown = rows.filter(a => (!f.q || `${a.name} ${a.code} ${a.location} ${a.city} ${(a as any).refNo || ''}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.cat || a.categoryId === f.cat) && (!f.city || a.city === f.city) && (!f.ver || a.verification === f.ver) && (!f.av || a.availability === f.av) && (!f.bk || (f.bk === 'Booked') === isBooked(a)) && (!f.st || (f.st === 'Disabled') === !!a.disabled));
  const filtered = Object.values(f).some(Boolean);
  const submit = async (a: Asset) => { await api.update('assets', a.id, { verification: 'Submitted' }, `${a.code} submitted for verification`); await api.create('notifications', { audience: 'internal', title: 'Asset submitted for verification', body: a.name, link: '/admin/verification', read: false, at: new Date().toISOString() }, 'ntf', 'notification'); toast('Submitted for verification'); };
  const toggle = (a: Asset) => toggleDisabled('assets', a, a.name);
  return <div><PageHeader title="My inventory" subtitle="List, update and submit assets for verification" actions={<><Button variant="outline" size="sm" onClick={() => exportCSV('my-inventory', shown.map(a => ({ code: a.code, name: a.name, city: a.city, rate: a.supplierRate, verification: a.verification })))}>CSV</Button><Button onClick={() => setEd({})}><Plus size={16} />Add asset</Button></>} />
    <Notice>Verification is a simulated review process and does not establish legal ownership.</Notice>
    {rows.length > 0 && <Card className="mt-4 p-3"><div className="flex flex-wrap gap-2 items-center">
      <input value={f.q} onChange={e => setFv('q', e.target.value)} placeholder="Search name, code, location…" className={inputCls + ' !w-64'} />
      <Select className="w-44" placeholder="All categories" options={db.categories.filter(c => rows.some(a => a.categoryId === c.id)).map(c => ({ value: c.id, label: c.name }))} value={f.cat} onChange={(e: any) => setFv('cat', e.target.value)} />
      <Select className="w-36" placeholder="All cities" options={[...new Set(rows.map(a => a.city))]} value={f.city} onChange={(e: any) => setFv('city', e.target.value)} />
      <Select className="w-44" placeholder="All verification" options={[...new Set(rows.map(a => a.verification))]} value={f.ver} onChange={(e: any) => setFv('ver', e.target.value)} />
      <Select className="w-40" placeholder="All availability" options={['Available', 'Held', 'Booked', 'Blocked']} value={f.av} onChange={(e: any) => setFv('av', e.target.value)} />
      <Select className="w-36" placeholder="Booked: any" options={['Booked', 'Not booked']} value={f.bk} onChange={(e: any) => setFv('bk', e.target.value)} />
      <Select className="w-36" placeholder="Status: any" options={['Enabled', 'Disabled']} value={f.st} onChange={(e: any) => setFv('st', e.target.value)} />
      {filtered && <Button size="sm" variant="ghost" onClick={() => setF(F0)}>Clear</Button>}
      <span className="text-xs text-slate-400 ml-auto">{shown.length} of {rows.length} assets</span></div></Card>}
    <Card className="mt-4"><Table rows={shown} empty={rows.length ? <Empty title="No assets match these filters" action={<Button variant="outline" onClick={() => setF(F0)}>Clear filters</Button>} /> : <Empty title="No assets listed" action={<Button onClick={() => setEd({})}>Add your first asset</Button>} />} cols={[
      { key: 'i', label: '', render: a => <img src={a.images[0]} className="w-16 h-10 object-cover rounded" /> }, { key: 'name', label: 'Asset', render: a => <div className={a.disabled ? 'opacity-60' : ''}><b>{a.name}</b> {a.disabled && <DisabledTag />}<div className="text-xs text-slate-400">{a.code} · {catName(db, a.categoryId)}</div></div> },
      { key: 'l', label: 'Location', render: a => `${a.location}, ${a.city}` }, { key: 'd', label: 'Size', render: a => `${a.width}×${a.height} ft` }, { key: 'r', label: 'Your rate', render: a => inr(a.supplierRate) },
      { key: 'v', label: 'Verification', render: a => <div><Badge>{a.verification}</Badge>{a.verificationNote && <div className="text-[11px] text-slate-500 max-w-[160px]">{a.verificationNote}</div>}</div> }, { key: 'av', label: 'Availability', render: a => <Badge>{a.availability}</Badge> },
      { key: 'bk', label: 'Booked', render: a => { const bs = db.bookings.filter(b => b.assetId === a.id && ACTIVE_BOOKING.includes(b.status)).sort((x, y) => x.start.localeCompare(y.start)); return bs.length ? <div className="space-y-1.5">{bs.map(b => <div key={b.id} className="text-xs whitespace-nowrap"><b>{custName(db, b.customerId)}</b> <Badge>{b.status}</Badge><div className="mt-0.5 text-slate-600">{fmtDate(b.start)} – {fmtDate(b.end)}</div></div>)}</div> : <span className="text-xs text-slate-400">Not booked</span>; } },
      { key: 'x', label: '', className: 'sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]', render: a => <div className="flex gap-1 justify-end">{['Draft', 'Rejected', 'Needs More Information'].includes(a.verification) && <Button size="sm" variant="outline" onClick={() => submit(a)}><Send size={14} />Submit</Button>}<Button size="sm" variant="ghost" onClick={() => setEd(a)}><Pencil size={14} /></Button><Link to={`/owner/calendar?asset=${a.id}`} title="View availability calendar"><Button size="sm" variant="ghost"><CalendarDays size={14} className="text-orange-600" /></Button></Link><DisableBtn disabled={a.disabled} onClick={() => toggle(a)} /></div> }]} /></Card>
    <AssetEditor asset={ed} ownerId={oid} open={!!ed} onClose={() => setEd(null)} /></div>;
}

export function CalendarPage({ assets, editable = true, title = 'Availability calendar' }: { assets: Asset[]; editable?: boolean; title?: string }) {
  const [sp] = useSearchParams(); const pre = sp.get('asset'); const [sel, setSel] = useState(assets.some(x => x.id === pre) ? pre! : assets[0]?.id || ''); const db = useDB(); const a = db.assets.find(x => x.id === sel);
  return <div><PageHeader title={title} subtitle="Select date ranges to block or hold; booked dates come from confirmed bookings" actions={<Select className="w-72" options={assets.map(a => ({ value: a.id, label: `${a.code} · ${a.name}` }))} value={sel} onChange={(e: any) => setSel(e.target.value)} />} />
    {a ? <div className="grid lg:grid-cols-[1fr_300px] gap-4"><Card className="p-5"><AvailabilityCalendar asset={a} editable={editable} /></Card><Card className="p-4 self-start text-sm space-y-2"><img src={a.images[0]} className="rounded-lg aspect-video object-cover" /><b>{a.name}</b><div className="text-xs text-slate-500">{a.location}, {a.city}</div><div>Booking model: <b>{db.categories.find(c => c.id === a.categoryId)?.bookingModel}</b></div>{(() => { const bs = db.bookings.filter(b => b.assetId === a.id && b.status !== 'Cancelled').sort((x, y) => x.start.localeCompare(y.start)); return <div><div className="text-xs font-medium text-slate-600 mb-1">Bookings &amp; clients</div>{bs.length ? bs.map(b => <div key={b.id} className="text-xs border-t py-1.5"><b>{custName(db, b.customerId)}</b><div className="text-slate-600">{fmtDate(b.start)} – {fmtDate(b.end)}</div><Badge>{b.status}</Badge></div>) : <div className="text-xs text-slate-400">No bookings yet</div>}</div>; })()}<Notice>Overlapping confirmed bookings are prevented for exclusive assets. Blocks cannot be placed over active bookings.</Notice>
      <Select options={['Available', 'Held', 'Booked', 'Blocked']} value={a.availability} onChange={async (e: any) => { await api.update('assets', a.id, { availability: e.target.value }, `${a.code} availability → ${e.target.value}`); toast('Availability status updated'); }} /></Card></div> : <Empty title="No assets" />}</div>;
}
export function OwnerCalendar() { const { db, oid } = useOwner(); return <CalendarPage assets={db.assets.filter(a => a.ownerId === oid)} />; }

export function OwnerOrders() {
  const { db, oid } = useOwner(); const rows = db.purchaseOrders.filter(p => p.ownerId === oid); const [v, setV] = useState<string | null>(null); const po = rows.find(p => p.id === v);
  const confirm = async (id: string) => { try { await confirmPO(id); toast('Order confirmed — booking confirmed'); } catch (e) { toastErr(e); } };
  const reject = async (id: string) => { const r = await promptDialog('Reject order', 'Reason'); if (r) { await rejectPO(id, r); toast('Order rejected'); } };
  const exec = async (id: string, status: string) => { await api.update('purchaseOrders', id, { status }, `PO execution status → ${status}`); toast('Execution status updated'); };
  return <div><PageHeader title="Purchase orders" subtitle="Your order amounts only — customer pricing is not shown" />
    <Card><Table rows={rows} onRow={p => setV(p.id)} cols={[{ key: 'number', label: 'PO', render: p => <b>{p.number}</b> }, { key: 'd', label: 'Description', render: p => p.items[0]?.desc }, { key: 't', label: 'Amount', render: p => inr(poTotals(p, db).total) }, { key: 'pd', label: 'Paid', render: p => inr(poTotals(p, db).paid) }, { key: 's', label: 'Status', render: p => <Badge>{p.status}</Badge> },
      { key: 'x', label: '', render: p => <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>{p.status === 'Sent' && <><Button size="sm" variant="success" onClick={() => confirm(p.id)}><Check size={14} />Confirm</Button><Button size="sm" variant="outline" onClick={() => reject(p.id)}>Reject</Button></>}{p.status === 'Confirmed' && <Button size="sm" variant="outline" onClick={() => exec(p.id, 'In Execution')}>Start execution</Button>}</div> }]} /></Card>
    <Modal open={!!po} onClose={() => setV(null)} title={po?.number}>{po && (() => { const b = db.bookings.find(x => x.id === po.bookingId); const ins = db.installations.find(i => i.bookingId === po.bookingId); return <div className="space-y-3 text-sm">
      {po.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.desc}</span><b>{inr(i.amount)}</b></div>)}
      <div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-400">Booking</span><br />{b?.number} · <Badge>{b?.status || '—'}</Badge></div><div><span className="text-slate-400">Period</span><br />{fmtDate(b?.start)} – {fmtDate(b?.end)}</div></div>
      {po.reason && <Notice>Reason: {po.reason}</Notice>}
      {ins && <div><div className="font-medium mb-1">Installation · {fmtDate(ins.scheduled)} <Badge>{ins.status}</Badge></div><ProofUpload installationId={ins.id} assetId={ins.assetId} campaignId={ins.campaignId} /></div>}
      <div className="text-xs"><b>Payments</b>{db.supplierPayments.filter(s => s.poId === po.id).map(s => <div key={s.id}>{fmtDate(s.date)} · {inr(s.amount)} · {s.reference}</div>)}</div></div>; })()}</Modal></div>;
}

export function OwnerProofs() {
  const { db, oid } = useOwner(); const ins = db.installations.filter(i => i.supplierId === oid);
  return <div><PageHeader title="Installation proof" subtitle="Upload photographs for each installation" /><Notice>Uploaded images are reviewed by the Oolaa team; the demo does not independently authenticate images.</Notice>
    <div className="space-y-3 mt-4">{ins.map(i => { const pr = db.proofs.filter(p => p.installationId === i.id); return <Card key={i.id} className="p-4"><div className="flex justify-between flex-wrap gap-2"><div><b>{assetName(db, i.assetId)}</b><div className="text-xs text-slate-500">Scheduled {fmtDate(i.scheduled)} · {i.instructions}</div></div><Badge>{i.status}</Badge></div>
      <div className="flex gap-2 flex-wrap my-3">{pr.map(p => <div key={p.id} className="w-32">{p.image ? <img src={p.image} className="rounded aspect-video object-cover" /> : <div className="rounded aspect-video bg-slate-100 grid place-items-center text-[10px] text-slate-400">Pending</div>}<Badge className="mt-1">{p.status}</Badge>{p.reason && <div className="text-[10px] text-rose-600">{p.reason}</div>}</div>)}</div>
      <ProofUpload installationId={i.id} assetId={i.assetId} campaignId={i.campaignId} /></Card>; })}{!ins.length && <Empty title="No installations assigned" />}</div></div>;
}

const ownerProfileFields: FieldDef[] = [{ name: 'name', label: 'Owner name', required: true }, { name: 'company', label: 'Company name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'address', label: 'Address', required: true, full: true }, { name: 'city', label: 'City', required: true }, { name: 'businessType', label: 'Business type', type: 'select', options: ['Private Limited', 'Proprietorship', 'Partnership', 'LLP'] }];
export function OwnerProfile() {
  const { me, oid } = useOwner(); const [v, setV] = useState<any>(me); const [e, setE] = useState<any>({});
  const save = async () => { const er = validate(ownerProfileFields, v); setE(er); if (Object.keys(er).length) return; await api.update('owners', oid, v, 'Owner profile updated'); toast('Profile saved'); };
  return <div><PageHeader title="Registration & profile" /><div className="grid lg:grid-cols-[1fr_300px] gap-4"><Card className="p-5"><FormFields fields={ownerProfileFields} value={v} set={(k, x) => setV({ ...v, [k]: x })} errors={e} /><Button className="mt-4" onClick={save}>Save</Button></Card>
    <Card className="p-5 self-start space-y-3 text-sm"><div><div className="text-xs text-slate-400">Business verification</div><Badge>{me.verification}</Badge></div><div><div className="text-xs text-slate-400">Agreement</div><Badge>{me.agreement}</Badge></div>{me.agreement === 'Sent' && <Button size="sm" onClick={async () => { await api.update('owners', oid, { agreement: 'Signed (simulated)' }, 'Agreement accepted (simulated)'); toast('Agreement accepted (simulated)'); }}>Accept agreement (simulated)</Button>}<Notice>Verification is simulated. Do not upload real identity documents in this demo.</Notice></Card></div></div>;
}
