import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronLeft, ChevronRight, ShieldCheck, Ruler, Lightbulb, Printer } from 'lucide-react';
import type { Asset, DB, Quotation } from '../types';
import { useDB, api } from '../services/storage.service';
import { dayStatus, inr, uid, fmtDate, quoteTotals, addDays } from '../utils';
import { shortlist, useShortlist } from './layout';
import { Badge, Button, Card, cn, toast, confirmDialog, Select, Input } from './ui';
import { GMAPS_KEY, GoogleMapView } from './GoogleMap';

export const catName = (db: DB, id: string) => db.categories.find(c => c.id === id)?.name || '—';
export const ownerName = (db: DB, id: string) => db.owners.find(c => c.id === id)?.company || '—';
export const custName = (db: DB, id: string) => db.customers.find(c => c.id === id)?.company || '—';
export const campName = (db: DB, id: string) => db.campaigns.find(c => c.id === id)?.name || '—';
export const assetName = (db: DB, id: string) => db.assets.find(c => c.id === id)?.name || '—';

export function AssetCard({ a, to }: { a: Asset; to?: string }) {
  const db = useDB(); const sl = useShortlist(); const on = sl.includes(a.id);
  return <Card className="overflow-hidden group hover:shadow-lg transition">
    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100"><img src={a.images[0]} alt={a.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
      <button onClick={() => { shortlist.toggle(a.id); toast(on ? 'Removed from shortlist' : 'Added to shortlist', 'info'); }} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 grid place-items-center shadow"><Heart size={16} className={on ? 'fill-rose-500 text-rose-500' : ''} /></button>
      <div className="absolute top-3 left-3 flex gap-1"><Badge className="bg-white/90">{a.availability}</Badge></div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-3 text-white text-xs flex items-center gap-1"><MapPin size={12} />{a.location}, {a.city}</div></div>
    <Link to={to || `/asset/${a.id}`} className="block p-4">
      <div className="text-xs text-orange-600 font-medium">{catName(db, a.categoryId)}</div>
      <div className="font-semibold text-slate-900 leading-snug mt-0.5 line-clamp-1">{a.name}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-2"><span className="flex items-center gap-1"><Ruler size={12} />{a.width}×{a.height} ft</span><span>{a.format}</span><span className="flex items-center gap-1"><Lightbulb size={12} />{a.lighting}</span></div>
      <div className="flex items-end justify-between mt-3"><div><div className="text-[11px] text-slate-400">Indicative / month</div><div className="font-bold text-lg">{inr(a.rate)}</div></div>
        <span className="text-[11px] flex items-center gap-1 text-slate-500"><ShieldCheck size={12} className={a.verification === 'Approved' ? 'text-emerald-500' : 'text-slate-300'} />{a.verification === 'Approved' ? 'Listing reviewed (demo)' : a.verification}</span></div>
    </Link></Card>;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export function AvailabilityCalendar({ asset, editable, onRange }: { asset: Asset; editable?: boolean; onRange?: (s: string, e: string) => void }) {
  const db = useDB(); const [m, setM] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState<string[]>([]); const [reason, setReason] = useState(''); const [kind, setKind] = useState<'Blocked' | 'Held'>('Blocked');
  const days = useMemo(() => { const y = m.getFullYear(), mo = m.getMonth(); const first = new Date(y, mo, 1).getDay(); const n = new Date(y, mo + 1, 0).getDate(); return [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, mo, i + 1)).toISOString().slice(0, 10))]; }, [m]);
  const [s, e] = sel.length === 2 ? [sel[0] < sel[1] ? sel[0] : sel[1], sel[0] < sel[1] ? sel[1] : sel[0]] : [sel[0], sel[0]];
  const click = (d: string) => { const n = sel.length === 1 ? [sel[0], d] : [d]; setSel(n); if (n.length === 2 && onRange) onRange(n[0] < n[1] ? n[0] : n[1], n[0] < n[1] ? n[1] : n[0]); };
  const color: any = { Available: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100', Held: 'bg-amber-100 text-amber-800', Booked: 'bg-rose-100 text-rose-800', Blocked: 'bg-slate-300 text-slate-700' };
  const block = async () => {
    if (!s || !e) return;
    const clash = db.bookings.filter(b => b.assetId === asset.id && !['Cancelled', 'Completed'].includes(b.status) && b.start <= e && s <= b.end && !['Enquiry'].includes(b.status));
    if (clash.length) return toast(`Conflict with booking ${clash.map(c => c.number).join(', ')}`, 'error');
    await api.update('assets', asset.id, { blocks: [...asset.blocks, { id: uid('blk'), from: s, to: e, status: kind, reason: reason || kind }] }, `Dates ${s}–${e} ${kind.toLowerCase()} on ${asset.code}`); toast(`Dates ${kind.toLowerCase()}`); setSel([]); setReason('');
  };
  const release = async (id: string) => { if (await confirmDialog('Release these dates?', undefined, false)) { await api.update('assets', asset.id, { blocks: asset.blocks.filter(b => b.id !== id) }, `Block released on ${asset.code}`); toast('Dates released'); } };
  const related = db.bookings.filter(b => b.assetId === asset.id && b.status !== 'Cancelled');
  return <div>
    <div className="flex items-center justify-between mb-2"><button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><b className="text-sm">{m.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b><button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400 mb-1">{DOW.map((d, i) => <div key={i}>{d}</div>)}</div>
    <div className="grid grid-cols-7 gap-1">{days.map((d, i) => { if (!d) return <div key={i} />; const st = dayStatus(db, asset, d); const inSel = s && d >= s && d <= (e || s); return <button key={d} title={`${d}: ${st.status}${st.ref ? ' · ' + st.ref : ''}`} onClick={() => click(d)} className={cn('aspect-square rounded-md text-xs font-medium', color[st.status], inSel && 'ring-2 ring-orange-500')}>{+d.slice(8)}</button>; })}</div>
    <div className="flex flex-wrap gap-3 text-[11px] mt-2">{Object.keys(color).map(k => <span key={k} className="flex items-center gap-1"><span className={cn('w-3 h-3 rounded', color[k].split(' ')[0])} />{k}</span>)}</div>
    {sel.length > 0 && <div className="text-xs mt-2 text-slate-600">Selected: <b>{fmtDate(s)}</b> → <b>{fmtDate(e)}</b></div>}
    {editable && <div className="mt-3 p-3 rounded-xl bg-slate-50 space-y-2"><div className="text-xs font-medium">Block / hold selected range</div><div className="flex gap-2"><Select className="w-28" options={['Blocked', 'Held']} value={kind} onChange={(x: any) => setKind(x.target.value)} /><Input placeholder="Reason" value={reason} onChange={(x: any) => setReason(x.target.value)} /><Button size="sm" disabled={!s} onClick={block}>Apply</Button></div>
      {asset.blocks.map(b => <div key={b.id} className="flex justify-between text-xs bg-white rounded-lg px-2 py-1.5 border"><span><Badge>{b.status}</Badge> {fmtDate(b.from)} – {fmtDate(b.to)} · {b.reason}</span><button className="text-orange-600" onClick={() => release(b.id)}>Release</button></div>)}</div>}
    {editable && related.length > 0 && <div className="mt-3"><div className="text-xs font-medium mb-1">Related bookings</div>{related.map(b => <div key={b.id} className="text-xs flex justify-between py-1 border-b"><span>{b.number} · {fmtDate(b.start)}–{fmtDate(b.end)}</span><Badge>{b.status}</Badge></div>)}</div>}
  </div>;
}

type MapProps = { assets: Asset[]; onSelect?: (a: Asset) => void; selected?: string };
/** Google Maps when VITE_GOOGLE_MAPS_API_KEY is set (and valid); otherwise the schematic fallback below. */
export function MapView(props: MapProps) {
  const [failed, setFailed] = useState(!GMAPS_KEY);
  return failed ? <SchematicMapView {...props} noKey={!GMAPS_KEY} /> : <GoogleMapView {...props} onFail={() => setFailed(true)} />;
}

function SchematicMapView({ assets, onSelect, selected, noKey }: MapProps & { noKey?: boolean }) {
  const cities = [...new Set(assets.map(a => a.city))]; const [city, setCity] = useState(cities.includes('Chennai') ? 'Chennai' : cities[0]);
  const list = assets.filter(a => a.city === city);
  const lat = list.map(a => a.lat), lng = list.map(a => a.lng); const pad = 0.02;
  const [la0, la1, ln0, ln1] = [Math.min(...lat) - pad, Math.max(...lat) + pad, Math.min(...lng) - pad, Math.max(...lng) + pad];
  const [hover, setHover] = useState<string | null>(null);
  return <div className="grid lg:grid-cols-[1fr_320px] gap-4">
    <Card className="overflow-hidden"><div className="flex gap-1 p-2 border-b overflow-x-auto">{cities.map(c => <button key={c} onClick={() => setCity(c)} className={cn('px-3 py-1 rounded-full text-xs whitespace-nowrap', c === city ? 'bg-slate-900 text-white' : 'bg-slate-100')}>{c} ({assets.filter(a => a.city === c).length})</button>)}</div>
      <div className="relative aspect-[4/3] bg-[#eef2e6]">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100"><defs><pattern id="g" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#dfe5d3" strokeWidth=".3" /></pattern></defs><rect width="100" height="100" fill="url(#g)" />
          <path d="M0 30 Q40 35 100 20" stroke="#fff" strokeWidth="2.2" fill="none" /><path d="M20 0 Q30 50 25 100" stroke="#fff" strokeWidth="2" fill="none" /><path d="M0 75 Q50 60 100 80" stroke="#fde68a" strokeWidth="1.6" fill="none" /><path d="M60 0 Q65 50 80 100" stroke="#fde68a" strokeWidth="1.6" fill="none" />{city === 'Chennai' && <rect x="92" y="0" width="8" height="100" fill="#bfdbfe" />}</svg>
        {list.map(a => { const x = list.length === 1 ? 50 : ((a.lng - ln0) / (ln1 - ln0)) * 84 + 6; const y = list.length === 1 ? 50 : (1 - (a.lat - la0) / (la1 - la0)) * 84 + 6; const act = selected === a.id || hover === a.id; return <button key={a.id} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(a)} style={{ left: `${x}%`, top: `${y}%` }} className="absolute -translate-x-1/2 -translate-y-full group z-10">
          <MapPin size={act ? 34 : 28} className={cn('drop-shadow transition-all', a.availability === 'Available' ? 'fill-orange-500 text-white' : 'fill-slate-500 text-white')} />
          {act && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-lg p-2 w-48 text-left text-xs"><b className="block truncate">{a.name}</b><span className="text-slate-500">{a.location} · {inr(a.rate)}/mo</span></div>}</button>; })}
        <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-[10px] text-slate-500">Schematic fallback map · {noKey ? 'add VITE_GOOGLE_MAPS_API_KEY to enable Google Maps' : 'Google Maps failed to load (check API key, billing and referrer restrictions)'}</div>
      </div></Card>
    <Card className="max-h-[520px] overflow-y-auto divide-y">{list.map(a => <button key={a.id} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(a)} className={cn('w-full flex gap-3 p-3 text-left hover:bg-orange-50', selected === a.id && 'bg-orange-50')}><img src={a.images[0]} className="w-16 h-12 rounded object-cover" /><div className="min-w-0"><div className="text-sm font-medium truncate">{a.name}</div><div className="text-xs text-slate-500">{a.location} · {inr(a.rate)}/mo</div></div></button>)}</Card>
  </div>;
}

export function QuotationDoc({ q, showCosts }: { q: Quotation; showCosts?: boolean }) {
  const db = useDB(); const t = quoteTotals(q); const c = db.customers.find(x => x.id === q.customerId); const cmp = db.campaigns.find(x => x.id === q.campaignId);
  return <div className="text-sm print-area">
    <div className="flex justify-between items-start mb-4"><div><div className="font-extrabold text-xl">oolaa<span className="text-orange-500">.in</span></div><div className="text-xs text-slate-500">Demo quotation · not a valid commercial offer</div></div><div className="text-right"><div className="font-bold">{q.number}</div><Badge>{q.expiry < new Date().toISOString().slice(0, 10) && q.status === 'Sent' ? 'Expired' : q.status}</Badge><div className="text-xs text-slate-500 mt-1">Valid until {fmtDate(q.expiry)}</div></div></div>
    <div className="grid grid-cols-2 gap-4 mb-4 text-xs"><div><div className="text-slate-400">Customer</div><b>{c?.company}</b><div>{c?.contact} · {c?.email}</div></div><div><div className="text-slate-400">Campaign</div><b>{cmp?.name}</b><div>{fmtDate(cmp?.start)} – {fmtDate(cmp?.end)}</div></div></div>
    <div className="overflow-x-auto"><table className="w-full text-xs border"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Asset</th><th className="p-2 text-left">Period</th><th className="p-2 text-right">Media price</th>{showCosts && <th className="p-2 text-right text-rose-600">Supplier cost</th>}</tr></thead>
      <tbody>{q.items.map((i, k) => { const a = db.assets.find(x => x.id === i.assetId); return <tr key={k} className="border-t"><td className="p-2">{a?.name}<div className="text-slate-400">{a?.code} · {a?.width}×{a?.height} ft</div></td><td className="p-2">{fmtDate(i.start)} – {fmtDate(i.end)}</td><td className="p-2 text-right">{inr(i.rate)}</td>{showCosts && <td className="p-2 text-right text-rose-600">{inr(i.supplierCost)}</td>}</tr>; })}</tbody></table></div>
    <div className="ml-auto max-w-xs mt-3 space-y-1 text-xs">{[['Media', t.media], ['Production', q.production], ['Installation', q.installation], ['Service charges', q.service], ['Discount', -q.discount], [`GST ${q.taxRate}% (configurable)`, t.tax]].map(([l, v]) => <div key={l as string} className="flex justify-between"><span className="text-slate-500">{l}</span><span>{inr(v as number)}</span></div>)}<div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{inr(t.total)}</span></div></div>
    {showCosts && <div className="mt-3 p-3 rounded-xl bg-rose-50 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2"><div>Revenue<b className="block">{inr(t.revenue)}</b></div><div>Direct costs<b className="block">{inr(t.costs)}</b></div><div>Gross profit<b className="block">{inr(t.profit)}</b></div><div>Margin<b className="block">{t.margin.toFixed(1)}%</b></div><div className="col-span-full text-rose-700">Confidential · internal only · illustrative demo values</div></div>}
    {q.notes && <div className="mt-3 text-xs whitespace-pre-wrap bg-slate-50 rounded p-2">{q.notes}</div>}
  </div>;
}
export const PrintBtn = () => <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={14} />Print</Button>;
export const nextMonth = () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() + 1, 1), new Date(d.getFullYear(), d.getMonth() + 2, 0)].map(x => addDays(x, 1).slice(0, 10)); };
