import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ArrowRight, Building2, Bus, Truck, MonitorPlay, CheckCircle2, Route, FileCheck2, Camera, BarChart3, Heart, ShieldCheck, Ruler, Lightbulb, Clock, GitCompare, Trash2 } from 'lucide-react';
import { useDB, useSession, api, setSession } from '../../services/storage.service';
import { homeFor } from '../../services/workflows';
import { AssetCard, AvailabilityCalendar, MapView, catName, ownerName } from '../../components/shared';
import { shortlist, useShortlist } from '../../components/layout';
import { Button, Card, Badge, Select, inputCls, Modal, Field, Input, toast, Empty, Notice } from '../../components/ui';
import { inr, prorate, today, addDays, conflicts, isAvailableForRange } from '../../utils';
import { IMAGES } from '../../data/seed-data';
import { FormFields, validate, type FieldDef } from '../../components/CrudPage';

const publicAssets = (db: any) => db.assets.filter((a: any) => !a.disabled && a.verification === 'Approved' && db.categories.find((c: any) => c.id === a.categoryId)?.enabled);

export function Home() {
  const db = useDB(); const nav = useNavigate(); const [q, setQ] = useState(''); const [city, setCity] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const pub = publicAssets(db); const cities = ['Chennai', 'Bengaluru', 'Hyderabad', 'Coimbatore'];
  const icons = [Building2, Bus, Truck, MonitorPlay];
  return <div>
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <img src={IMAGES[1]} className="absolute inset-0 w-full h-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
      <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32">
        <Badge className="bg-orange-500/20 text-orange-300 ring-orange-400/30">Outdoor advertising marketplace · Demo</Badge>
        <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.05]">Your Brand. <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">Everywhere It Matters.</span></h1>
        <p className="mt-5 text-lg text-slate-300 max-w-xl">Discover outdoor advertising opportunities, plan campaigns across multiple locations, and manage execution in one place.</p>
        <div className="mt-8 bg-white rounded-2xl p-2 flex flex-col sm:flex-row sm:flex-wrap gap-2 max-w-3xl shadow-2xl">
          <div className="flex-1 flex items-center gap-2 px-3"><Search size={18} className="text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search Anna Salai, OMR, T. Nagar…" className="w-full py-2.5 text-slate-900 focus:outline-none" /></div>
          <select value={city} onChange={e => setCity(e.target.value)} className="px-3 py-2.5 text-slate-700 rounded-lg bg-slate-100 text-sm"><option value="">All cities</option>{cities.map(c => <option key={c}>{c}</option>)}</select>
          <input type="date" aria-label="Start date" min={today()} value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(''); }} className="px-3 py-2.5 text-slate-700 rounded-lg bg-slate-100 text-sm" />
          <input type="date" aria-label="End date" min={from || today()} value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2.5 text-slate-700 rounded-lg bg-slate-100 text-sm" />
          <Button size="lg" onClick={() => nav(`/explore?q=${encodeURIComponent(q)}&city=${city}${from && to ? `&from=${from}&to=${to}` : ''}`)}>Search</Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><Link to="/explore"><Button size="lg">Explore Advertising Spaces <ArrowRight size={18} /></Button></Link><Link to="/list-your-space"><Button size="lg" variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10">List Your Advertising Space</Button></Link></div>
        <div className="mt-10 flex gap-8 text-sm text-slate-400"><div><b className="text-2xl text-white block">{pub.length}</b>sample sites</div><div><b className="text-2xl text-white block">{db.owners.length}</b>demo media owners</div><div><b className="text-2xl text-white block">{new Set(pub.map((a: any) => a.city)).size}</b>cities</div></div>
      </div></section>

    <section className="max-w-7xl mx-auto px-4 py-16"><div className="flex justify-between items-end mb-6"><div><h2 className="text-3xl font-bold">Featured advertising locations</h2><p className="text-slate-500">Sample inventory for demonstration — not genuinely available for purchase.</p></div><Link to="/explore" className="text-orange-600 text-sm font-medium hidden sm:block">View all →</Link></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{pub.slice(0, 8).map((a: any) => <AssetCard key={a.id} a={a} />)}</div></section>

    <section className="bg-slate-50 py-16"><div className="max-w-7xl mx-auto px-4"><h2 className="text-3xl font-bold mb-6">Advertising categories</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{db.categories.map((c, i) => { const Ic = icons[i] || Building2; return <Link key={c.id} to={c.enabled ? `/explore?cat=${c.id}` : '#'} className={`p-5 rounded-2xl border bg-white ${c.enabled ? 'hover:shadow-md hover:border-orange-300' : 'opacity-50 pointer-events-none'}`}><Ic className="text-orange-500" /><div className="font-semibold mt-3">{c.name}</div><div className="text-xs text-slate-500 mt-1">{c.enabled ? `${pub.filter((a: any) => a.categoryId === c.id).length} sample sites` : 'Coming soon'}</div></Link>; })}</div></div></section>

    <section className="max-w-7xl mx-auto px-4 py-16"><h2 className="text-3xl font-bold text-center">How it works</h2><p className="text-center text-slate-500 mt-2">From discovery to proof-of-advertising, in one workflow.</p>
      <div className="grid md:grid-cols-5 gap-4 mt-10">{[[Search, 'Discover', 'Search & filter sites by city, format and budget'], [Route, 'Plan', 'Shortlist sites, choose dates and build a media plan'], [FileCheck2, 'Approve', 'Review quotations and approve with one click'], [Camera, 'Execute', 'Upload artwork; track installation & proof photos'], [BarChart3, 'Report', 'Campaign reports, invoices and spend in one place']].map(([Ic, t, d]: any, i) => <div key={t} className="text-center p-5"><div className="mx-auto w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 grid place-items-center"><Ic /></div><div className="text-xs text-orange-500 mt-3">Step {i + 1}</div><div className="font-semibold">{t}</div><p className="text-sm text-slate-500 mt-1">{d}</p></div>)}</div></section>

    <section className="bg-slate-950 text-white py-16"><div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-8">
      {[['For advertisers', ['Transparent indicative pricing across cities', 'Multi-location campaign planning', 'Quotation comparison & approval', 'Artwork, installation & proof tracking', 'Consolidated invoices and reports'], '/explore', 'Start planning'], ['For media owners', ['List hoardings, shelters, screens & fleets', 'Manage availability with a live calendar', 'Receive purchase orders digitally', 'Upload installation proof', 'Track earnings & payments'], '/list-your-space', 'List your space']].map(([t, items, to, cta]: any) => <div key={t} className="rounded-3xl bg-white/5 border border-white/10 p-8"><h3 className="text-2xl font-bold">{t}</h3><ul className="mt-5 space-y-2">{items.map((x: string) => <li key={x} className="flex gap-2 text-slate-300"><CheckCircle2 size={18} className="text-orange-400 shrink-0" />{x}</li>)}</ul><Link to={to}><Button className="mt-6">{cta} <ArrowRight size={16} /></Button></Link></div>)}</div></section>

    <section className="max-w-7xl mx-auto px-4 py-16"><h2 className="text-3xl font-bold mb-6">Featured cities</h2><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{cities.map((c, i) => <Link key={c} to={`/explore?city=${c}`} className="relative rounded-2xl overflow-hidden aspect-[4/3] group"><img src={IMAGES[(i + 4) % 8]} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" /><div className="absolute inset-0 bg-gradient-to-t from-black/80" /><div className="absolute bottom-4 left-4 text-white"><div className="text-xl font-bold">{c}</div><div className="text-sm text-slate-300">{pub.filter((a: any) => a.city === c).length} sample sites</div></div></Link>)}</div></section>

    <section className="max-w-7xl mx-auto px-4 pb-20"><div className="rounded-3xl bg-gradient-to-r from-orange-500 to-rose-500 p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6"><div><h3 className="text-3xl font-bold">Ready to plan your next campaign?</h3><p className="text-white/80 mt-1">Try the full workflow with demo accounts — no signup required.</p></div><div className="flex gap-3"><Link to="/plan"><Button variant="dark" size="lg">Plan a campaign</Button></Link><Link to="/login"><Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">Demo login</Button></Link></div></div></section>
  </div>;
}

export function Explore({ base = '/asset' }: { base?: string }) {
  const db = useDB(); const [sp, setSp] = useSearchParams(); const sl = useShortlist();
  const [f, setF] = useState({ q: sp.get('q') || '', city: sp.get('city') || '', cat: sp.get('cat') || '', format: '', avail: '', min: '', max: '', size: '', sort: '', from: sp.get('from') || '', to: sp.get('to') || '' });
  const [compare, setCompare] = useState(false);
  const pub = publicAssets(db);
  const dateOn = !!f.from && !!f.to && f.to >= f.from; const badRange = !!f.from && !!f.to && f.to < f.from;
  const list = useMemo(() => {
    let r = pub.filter((a: any) => (!dateOn || isAvailableForRange(db, a, f.from, f.to)) && (!f.q || (a.name + a.location + a.city + a.address).toLowerCase().includes(f.q.toLowerCase())) && (!f.city || a.city === f.city) && (!f.cat || a.categoryId === f.cat) && (!f.format || a.format === f.format) && (!f.avail || a.availability === f.avail) && (!f.min || a.rate >= +f.min) && (!f.max || a.rate <= +f.max) && (!f.size || (f.size === 'S' ? a.width * a.height < 300 : f.size === 'M' ? a.width * a.height < 800 && a.width * a.height >= 300 : a.width * a.height >= 800)));
    if (f.sort) r = [...r].sort((a: any, b: any) => f.sort === 'price-asc' ? a.rate - b.rate : f.sort === 'price-desc' ? b.rate - a.rate : (a.city + a.location).localeCompare(b.city + b.location));
    return r;
  }, [db, f]);
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); if (['q', 'city', 'cat', 'from', 'to'].includes(k)) { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); } };
  const cats = db.categories.filter(c => c.enabled);
  return <div className="max-w-7xl mx-auto px-4 py-8">
    <div className="flex flex-col md:flex-row justify-between gap-3 mb-5"><div><h1 className="text-3xl font-bold">Advertising spaces</h1><p className="text-slate-500 text-sm">{dateOn ? `${list.length} site(s) available ${f.from} → ${f.to}` : `${list.length} sample sites`} · indicative pricing · fictional demo inventory</p></div>
      <div className="flex gap-2">{sl.length >= 2 && <Button variant="outline" onClick={() => setCompare(true)}><GitCompare size={16} />Compare ({sl.length})</Button>}<Link to="/shortlist"><Button variant="dark"><Heart size={16} />Shortlist ({sl.length})</Button></Link></div></div>
    <Card className="p-3 mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
      <input className={inputCls + ' col-span-2'} placeholder="Search location…" value={f.q} onChange={e => set('q', e.target.value)} />
      <Select options={[...new Set(pub.map((a: any) => a.city))] as string[]} placeholder="All cities" value={f.city} onChange={(e: any) => set('city', e.target.value)} />
      <Select options={cats.map(c => ({ value: c.id, label: c.name }))} placeholder="All categories" value={f.cat} onChange={(e: any) => set('cat', e.target.value)} />
      <Select options={[...new Set(pub.map((a: any) => a.format))] as string[]} placeholder="All formats" value={f.format} onChange={(e: any) => set('format', e.target.value)} />
      <Select options={[{ value: 'S', label: 'Small (<300 sqft)' }, { value: 'M', label: 'Medium' }, { value: 'L', label: 'Large (≥800 sqft)' }]} placeholder="Any size" value={f.size} onChange={(e: any) => set('size', e.target.value)} />
      <Select options={['Available', 'Held', 'Booked', 'Blocked']} placeholder="Any availability" value={f.avail} onChange={(e: any) => set('avail', e.target.value)} />
      <Select options={[{ value: 'price-asc', label: 'Price ↑' }, { value: 'price-desc', label: 'Price ↓' }, { value: 'loc', label: 'Location A–Z' }]} placeholder="Sort" value={f.sort} onChange={(e: any) => set('sort', e.target.value)} />
      <label className="text-[11px] text-slate-500 col-span-1">From<input className={inputCls} type="date" min={today()} value={f.from} onChange={e => set('from', e.target.value)} /></label>
      <label className="text-[11px] text-slate-500 col-span-1">To<input className={inputCls} type="date" min={f.from || today()} value={f.to} onChange={e => set('to', e.target.value)} /></label>
      <input className={inputCls} type="number" placeholder="Min ₹" value={f.min} onChange={e => set('min', e.target.value)} />
      <input className={inputCls} type="number" placeholder="Max ₹" value={f.max} onChange={e => set('max', e.target.value)} />
      <Button variant="ghost" onClick={() => { setF({ q: '', city: '', cat: '', format: '', avail: '', min: '', max: '', size: '', sort: '', from: '', to: '' }); setSp({}); }}>Clear filters</Button>
    </Card>
    {badRange && <Notice>End date must be on or after the start date.</Notice>}
    {list.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{list.map((a: any) => <AssetCard key={a.id} a={a} to={`${base}/${a.id}${dateOn ? `?from=${f.from}&to=${f.to}` : ''}`} />)}</div> : <Empty title="No sites match your filters" body={dateOn ? "No sites are free for those dates. Try different dates or fewer filters." : "Try widening your search."} />}
    <CompareModal open={compare} onClose={() => setCompare(false)} />
  </div>;
}

export function CompareModal({ open, onClose }: any) {
  const db = useDB(); const sl = useShortlist(); const items = db.assets.filter(a => sl.includes(a.id));
  const rows: [string, (a: any) => any][] = [['Category', a => catName(db, a.categoryId)], ['City', a => a.city], ['Location', a => a.location], ['Size', a => `${a.width}×${a.height} ft`], ['Format', a => a.format], ['Lighting', a => a.lighting], ['Visibility', a => a.traffic], ['Indicative / month', a => inr(a.rate)], ['Min. booking', a => `${a.minDays} days`], ['Availability', a => <Badge>{a.availability}</Badge>]];
  return <Modal open={open} onClose={onClose} title="Compare shortlisted sites" wide><div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th />{items.map(a => <th key={a.id} className="p-2 text-left min-w-[180px]"><img src={a.images[0]} className="rounded-lg aspect-video object-cover mb-1" />{a.name}</th>)}</tr></thead><tbody>{rows.map(([l, fn]) => <tr key={l} className="border-t"><td className="p-2 text-slate-500 text-xs whitespace-nowrap">{l}</td>{items.map(a => <td key={a.id} className="p-2 text-xs">{fn(a)}</td>)}</tr>)}</tbody></table></div></Modal>;
}

export function AssetDetail({ portal }: { portal?: boolean }) {
  const { id } = useParams(); const db = useDB(); const nav = useNavigate(); const sl = useShortlist(); const u = useSession();
  const a = db.assets.find(x => x.id === id); const [img, setImg] = useState(0); const [qs] = useSearchParams();
  const [range, setRange] = useState<[string, string]>(qs.get('from') && qs.get('to') && qs.get('to')! >= qs.get('from')! ? [qs.get('from')!, qs.get('to')!] : [addDays(today(), 14), addDays(today(), 43)]);
  if (!a) return <Empty title="Asset not found" action={<Link to="/explore"><Button>Back to directory</Button></Link>} />;
  const owner = db.owners.find(o => o.id === a.ownerId); const cat = db.categories.find(c => c.id === a.categoryId);
  const c = conflicts(db, a.id, range[0], range[1]); const price = prorate(a.rate, range[0], range[1]);
  const request = () => { if (!sl.includes(a.id)) shortlist.toggle(a.id); sessionStorage.setItem('oolaa_plan_dates', JSON.stringify(range)); nav(u?.role === 'Customer' ? '/customer/plan' : '/plan'); };
  return <div className={portal ? '' : 'max-w-7xl mx-auto px-4 py-8'}>
    <Link to={portal ? '/customer/plan' : '/explore'} className="text-sm text-slate-500 hover:text-orange-600">← Back</Link>
    <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-3">
      <div>
        <div className="rounded-2xl overflow-hidden aspect-[16/9] bg-slate-100"><img src={a.images[img]} className="w-full h-full object-cover" /></div>
        <div className="flex gap-2 mt-2">{a.images.map((s, i) => <button key={i} onClick={() => setImg(i)} className={`w-24 aspect-video rounded-lg overflow-hidden ring-2 ${i === img ? 'ring-orange-500' : 'ring-transparent'}`}><img src={s} className="w-full h-full object-cover" /></button>)}</div>
        <div className="mt-6"><div className="text-sm text-orange-600 font-medium">{cat?.name} · {a.code}</div><h1 className="text-3xl font-bold mt-1">{a.name}</h1><p className="text-slate-500 flex items-center gap-1 mt-1"><MapPin size={16} />{a.address}<a className="ml-2 text-orange-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`}>Open in Google Maps ↗</a></p></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">{[[Ruler, 'Dimensions', `${a.width} × ${a.height} ft`], [MonitorPlay, 'Format', a.format], [Lightbulb, 'Lighting', a.lighting], [Clock, 'Min. booking', `${a.minDays} days`]].map(([Ic, l, v]: any) => <Card key={l} className="p-3"><Ic size={16} className="text-orange-500" /><div className="text-[11px] text-slate-400 mt-1">{l}</div><div className="text-sm font-medium">{v}</div></Card>)}</div>
        <Card className="p-5 mt-4"><h3 className="font-semibold">Visibility</h3><p className="text-sm text-slate-600 mt-1">{a.traffic}</p><p className="text-[11px] text-slate-400 mt-2">Traffic figures are illustrative demo metrics, not audited audience data.</p></Card>
        <Card className="p-5 mt-4"><h3 className="font-semibold">Media owner</h3><div className="flex items-center justify-between mt-2"><div><div className="font-medium">{owner?.company}</div><div className="text-xs text-slate-500">{owner?.city} · {owner?.businessType}</div></div><Badge>{owner?.verification || '—'}</Badge></div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-3"><ShieldCheck size={14} />Listing status: {a.verification}. Verification is simulated and does not establish legal ownership.</div></Card>
      </div>
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <Card className="p-5"><div className="text-xs text-slate-400">Indicative rate</div><div className="text-3xl font-bold">{inr(a.rate)}<span className="text-sm font-normal text-slate-400"> / month</span></div>
          <div className="grid grid-cols-2 gap-2 mt-4"><Field label="Start"><Input type="date" value={range[0]} onChange={(e: any) => setRange([e.target.value, range[1]])} /></Field><Field label="End"><Input type="date" value={range[1]} min={range[0]} onChange={(e: any) => setRange([range[0], e.target.value])} /></Field></div>
          <div className="mt-3 p-3 rounded-xl bg-slate-50 text-sm flex justify-between"><span>Estimated media cost</span><b>{inr(price)}</b></div>
          {!c.ok ? <Notice>Selected dates overlap existing holds/bookings or blocked dates. Choose different dates.</Notice> : <div className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 size={14} />Dates appear available (subject to supplier confirmation)</div>}
          <div className="flex gap-2 mt-4"><Button className="flex-1" disabled={!c.ok || range[1] < range[0]} onClick={request}>Request quotation</Button><Button variant="outline" onClick={() => { shortlist.toggle(a.id); toast(sl.includes(a.id) ? 'Removed' : 'Added to shortlist', 'info'); }}><Heart size={16} className={sl.includes(a.id) ? 'fill-rose-500 text-rose-500' : ''} /></Button></div></Card>
        <Card className="p-5"><h3 className="font-semibold mb-3">Availability calendar</h3><AvailabilityCalendar asset={a} onRange={(s, e) => setRange([s, e])} /><p className="text-[11px] text-slate-400 mt-2">Click two dates to select a campaign range.</p></Card>
      </div></div></div>;
}

export function MapPage() {
  const db = useDB(); const nav = useNavigate(); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const dateOn = !!from && !!to && to >= from; const all = publicAssets(db); const shown = dateOn ? all.filter((a: any) => isAvailableForRange(db, a, from, to)) : all;
  return <div className="max-w-7xl mx-auto px-4 py-8"><h1 className="text-3xl font-bold mb-1">Advertising map</h1>
    <p className="text-sm text-slate-500 mb-4">{shown.length} site(s){dateOn ? ` available ${from} → ${to}` : ''}. Pick dates to show only sites free for your campaign.</p>
    <div className="flex flex-wrap items-end gap-2 mb-4"><label className="text-[11px] text-slate-500">From<input className={inputCls} type="date" min={today()} value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(''); }} /></label><label className="text-[11px] text-slate-500">To<input className={inputCls} type="date" min={from || today()} value={to} onChange={e => setTo(e.target.value)} /></label>{(from || to) && <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>}</div>
    <MapView assets={shown} onSelect={a => nav(`/asset/${a.id}${dateOn ? `?from=${from}&to=${to}` : ''}`)} /></div>;
}

export function ShortlistPage() {
  const db = useDB(); const sl = useShortlist(); const u = useSession(); const nav = useNavigate(); const [cmp, setCmp] = useState(false);
  const items = db.assets.filter(a => sl.includes(a.id));
  return <div className="max-w-5xl mx-auto px-4 py-8"><div className="flex justify-between items-center mb-5"><h1 className="text-3xl font-bold">Your shortlist</h1><div className="flex gap-2">{items.length > 1 && <Button variant="outline" onClick={() => setCmp(true)}><GitCompare size={16} />Compare</Button>}{items.length > 0 && <Button onClick={() => nav(u?.role === 'Customer' ? '/customer/plan' : '/plan')}>Plan campaign & request quote</Button>}</div></div>
    {items.length ? <Card className="divide-y">{items.map(a => <div key={a.id} className="flex gap-4 p-4 items-center"><img src={a.images[0]} className="w-28 aspect-video rounded-lg object-cover" /><div className="flex-1 min-w-0"><Link to={`/asset/${a.id}`} className="font-medium hover:text-orange-600">{a.name}</Link><div className="text-xs text-slate-500">{a.location}, {a.city} · {a.width}×{a.height} ft · {ownerName(db, a.ownerId)}</div></div><b>{inr(a.rate)}</b><button onClick={() => shortlist.toggle(a.id)}><Trash2 size={16} className="text-rose-500" /></button></div>)}</Card> : <Empty title="Your shortlist is empty" body="Tap the heart on any site to add it." action={<Link to="/explore"><Button>Explore spaces</Button></Link>} />}
    <CompareModal open={cmp} onClose={() => setCmp(false)} /></div>;
}

export function PublicPlan() {
  const u = useSession(); const db = useDB(); const nav = useNavigate();
  if (u?.role === 'Customer') return <Navigate to="/customer/plan" replace />;
  return <div className="max-w-xl mx-auto px-4 py-16 text-center"><Route className="mx-auto text-orange-500" size={40} /><h1 className="text-3xl font-bold mt-4">Plan a multi-location campaign</h1><p className="text-slate-500 mt-2">Media planning and quotation requests happen in the Customer Portal. Sign in with the demo advertiser account to continue — your shortlist carries over.</p>
    <Button size="lg" className="mt-6" onClick={() => { const c = db.users.find(x => x.email === 'customer@oolaa.demo')!; setSession(c); nav('/customer/plan'); }}>Continue as demo advertiser</Button></div>;
}

const ownerFields: FieldDef[] = [{ name: 'name', label: 'Owner name', required: true }, { name: 'company', label: 'Company name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'phone', required: true }, { name: 'pan', label: 'PAN', required: true, upper: true, placeholder: 'ABCDE1234F', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, patternMsg: 'Invalid PAN (format ABCDE1234F)' }, { name: 'gst', label: 'GSTIN (optional)', upper: true, placeholder: '33ABCDE1234F1Z5', pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, patternMsg: 'Invalid GSTIN (15 characters)' }, { name: 'address', label: 'Address', full: true, required: true }, { name: 'city', label: 'City', type: 'select', options: ['Chennai', 'Bengaluru', 'Hyderabad', 'Coimbatore', 'Other'], required: true }, { name: 'businessType', label: 'Business type', type: 'select', options: ['Private Limited', 'Proprietorship', 'Partnership', 'LLP'], required: true }];
const GoogleIcon = () => <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.300-.1-2.600-.4-3.900z"/></svg>;
const FacebookIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.900 11.900v-8.400H7.100V12h3V9.400c0-3 1.800-4.700 4.500-4.700 1.300 0 2.700.2 2.700.2v3h-1.500c-1.500 0-2 .9-2 1.900V12h3.400l-.5 3.500h-2.900v8.400A12 12 0 0 0 24 12z"/></svg>;
/** Demo-only forgot-password flow: email -> (simulated) reset link -> new password. No real email is sent and no password is stored. */
function ForgotPassword({ onClose, initialEmail = '' }: { onClose: () => void; initialEmail?: string }) {
  const [step, setStep] = useState<'email' | 'sent' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const sendLink = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter a valid email address');
    setErr(''); setBusy(true); await new Promise(r => setTimeout(r, 600)); setBusy(false); setStep('sent');
  };
  const savePw = async () => {
    if (pw.length < 8) return setErr('Password must be at least 8 characters');
    if (pw !== pw2) return setErr('Passwords do not match');
    setErr(''); setBusy(true); await new Promise(r => setTimeout(r, 600)); setBusy(false); setStep('done'); toast('Password updated (demo)');
  };
  return <Modal open onClose={onClose} title="Forgot password?">
    {step === 'email' && <div className="space-y-3">
      <p className="text-sm text-slate-500">Enter the email you registered with and we will send you a link to reset your password.</p>
      <Field label="Email address" error={err}><Input type="email" autoFocus value={email} onChange={(e: any) => setEmail(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && sendLink()} placeholder="you@company.com" /></Field>
      <Button className="w-full" loading={busy} onClick={sendLink}>Send reset link</Button>
      <Notice>Simulated in this demo. No real email is sent.</Notice></div>}
    {step === 'sent' && <div className="text-center py-4"><CheckCircle2 className="mx-auto text-emerald-500" size={44} />
      <h4 className="font-bold mt-3">Check your inbox</h4>
      <p className="text-sm text-slate-500 mt-1">If an account exists for <b>{email.trim()}</b>, a reset link has been sent. It stays valid for 30 minutes.</p>
      <Button className="w-full mt-5" onClick={() => setStep('reset')}>Open reset link (demo)</Button>
      <button className="text-sm text-orange-600 hover:underline mt-3" onClick={() => setStep('email')}>Use a different email</button></div>}
    {step === 'reset' && <div className="space-y-3">
      <p className="text-sm text-slate-500">Choose a new password for <b>{email.trim()}</b>.</p>
      <Field label="New password"><Input type="password" autoFocus value={pw} onChange={(e: any) => setPw(e.target.value)} /></Field>
      <Field label="Confirm new password" error={err}><Input type="password" value={pw2} onChange={(e: any) => setPw2(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && savePw()} /></Field>
      <Button className="w-full" loading={busy} onClick={savePw}>Update password</Button></div>}
    {step === 'done' && <div className="text-center py-4"><CheckCircle2 className="mx-auto text-emerald-500" size={44} />
      <h4 className="font-bold mt-3">Password updated</h4><p className="text-sm text-slate-500 mt-1">You can now sign in with your new password.</p>
      <Button className="w-full mt-5" onClick={onClose}>Back to sign in</Button></div>}
  </Modal>;
}

export function ListYourSpace() {
  const [v, setV] = useState<any>({}); const [e, setE] = useState<any>({}); const [done, setDone] = useState(false);
  const [auth, setAuth] = useState<null | 'Google' | 'Facebook' | 'Email'>(null); const [em, setEm] = useState(''); const [emErr, setEmErr] = useState(''); const [forgot, setForgot] = useState(false);
  // Demo-only simulated social sign-in. Replace with real Firebase/OAuth later.
  const signIn = (provider: 'Google' | 'Facebook') => { setAuth(provider); setV((x: any) => ({ ...x, email: provider === 'Google' ? 'demo.owner@gmail.com' : 'demo.owner@facebook.com', authProvider: provider })); toast(`Signed in with ${provider} (demo)`); };
  const emailContinue = () => { if (!/^\S+@\S+\.\S+$/.test(em.trim())) return setEmErr('Enter a valid email address'); setEmErr(''); setAuth('Email'); setV((x: any) => ({ ...x, email: em.trim(), authProvider: 'Email' })); };
  const submit = async () => { const er = validate(ownerFields, v); setE(er); if (Object.keys(er).length) return; await api.create('owners', { ...v, phone: `${v.phoneCode || '+91'} ${v.phone}`, phoneCode: undefined, verification: 'Pending', agreement: 'Not Sent' }, 'own', `Media owner registration: ${v.company}`); await api.create('notifications', { audience: 'internal', title: 'New media owner registration', body: v.company, link: '/admin/owners', read: false, at: new Date().toISOString() }, 'ntf', 'Notification'); setDone(true); toast('Registration submitted'); };
  return <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10">
    <div><Badge>For media owners</Badge><h1 className="text-4xl font-bold mt-3">List your advertising space on Oolaa</h1><p className="text-slate-500 mt-3">Reach brands planning campaigns across Chennai and beyond. Manage inventory, availability, purchase orders and installation proof from one portal.</p>
      <ul className="mt-6 space-y-3">{['Free to list (demo)', 'Confidential supplier rates — never shown to advertisers', 'Digital purchase orders & payment tracking', 'Simulated verification workflow'].map(x => <li key={x} className="flex gap-2"><CheckCircle2 className="text-orange-500" size={20} />{x}</li>)}</ul>
      <img src={IMAGES[5]} className="rounded-2xl mt-8 aspect-video object-cover" /></div>
    <Card className="p-6">{!auth && !done ? <div className="py-6"><h2 className="font-semibold text-lg">Get started</h2><p className="text-sm text-slate-500 mt-1">Continue with your account to register as a media owner.</p>
      <div className="mt-5 space-y-3"><button onClick={() => signIn('Google')} className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 font-medium hover:bg-slate-50"><GoogleIcon />Continue with Google</button>
      <button onClick={() => signIn('Facebook')} className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 font-medium hover:bg-slate-50"><FacebookIcon />Continue with Facebook</button></div>
      <div className="flex items-center gap-3 my-5 text-xs text-slate-400"><div className="flex-1 border-t" />OR<div className="flex-1 border-t" /></div>
      <input type="email" value={em} onChange={e => setEm(e.target.value)} onKeyDown={e => e.key === 'Enter' && emailContinue()} placeholder="Email address" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
      {emErr && <div className="text-sm text-rose-600 mt-1">{emErr}</div>}
      <div className="text-right mt-2"><button type="button" className="text-sm text-orange-600 hover:underline" onClick={() => setForgot(true)}>Forgot password?</button></div>
      <Button className="w-full mt-3" onClick={emailContinue}>Continue with email</Button>
      <div className="mt-5"><Notice>Sign-in is simulated in this demo. No real Google, Facebook or email account is used.</Notice></div></div> : done ? <div className="text-center py-10"><CheckCircle2 className="mx-auto text-emerald-500" size={48} /><h2 className="text-xl font-bold mt-3">Registration received</h2><p className="text-sm text-slate-500 mt-1">Our team will review your details (simulated). Meanwhile, explore the owner portal with the demo account.</p><Link to="/login"><Button className="mt-5">Open demo owner portal</Button></Link></div> : <>
      <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-lg">Media owner registration</h2><span className="text-xs text-slate-500">Signed in with {auth} · <button className="text-orange-600 hover:underline" onClick={() => { setAuth(null); setV({}); }}>Change</button></span></div><FormFields fields={ownerFields} value={v} set={(k, x) => setV({ ...v, [k]: x })} errors={e} />
      <div className="mt-4"><Notice>Identity/business verification is simulated in this demo. Do not upload or enter real identity documents.</Notice></div>
      <Button className="w-full mt-4" onClick={submit}>Submit registration</Button></>}</Card>
    {forgot && <ForgotPassword initialEmail={em} onClose={() => setForgot(false)} />}</div>;
}

export function Login() {
  const db = useDB(); const nav = useNavigate(); const [email, setEmail] = useState(''); const [pw, setPw] = useState('demo'); const [err, setErr] = useState(''); const [forgot, setForgot] = useState(false);
  const go = (em: string) => { const u = db.users.find(x => x.email.toLowerCase() === em.toLowerCase() && x.active); if (!u) return setErr('Unknown or inactive demo account'); setSession(u); toast(`Signed in as ${u.role}`); nav(homeFor(u)); };
  const quick = [['admin@oolaa.demo', 'Super Admin', 'Full command centre'], ['operations@oolaa.demo', 'Operations', 'Inventory, verification, ops'], ['sales@oolaa.demo', 'Sales', 'Customers & quotations (no costs)'], ['finance@oolaa.demo', 'Finance', 'Invoices, payments, margins'], ['owner@oolaa.demo', 'Media Owner', 'Skyline Media Works'], ['customer@oolaa.demo', 'Customer', 'Kaveri Foods']];
  return <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8 items-start">
    <Card className="p-6"><h1 className="text-2xl font-bold">Demo sign in</h1><p className="text-sm text-slate-500 mb-4">Fictional demo identities. Any password works.</p>
      <Field label="Email"><Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="admin@oolaa.demo" /></Field>
      <Field label="Password" className="mt-3"><Input type="password" value={pw} onChange={(e: any) => setPw(e.target.value)} /></Field>
      <div className="text-right mt-1"><button type="button" className="text-sm text-orange-600 hover:underline" onClick={() => setForgot(true)}>Forgot password?</button></div>
      {err && <div className="text-sm text-rose-600 mt-2">{err}</div>}<Button className="w-full mt-4" onClick={() => go(email)}>Sign in</Button>
      <div className="mt-4"><Notice>Browser-side role permissions are for demonstration only and do not provide production-grade security.</Notice></div></Card>
    {forgot && <ForgotPassword initialEmail={email} onClose={() => setForgot(false)} />}
    <div><h2 className="font-semibold mb-3">One-click demo accounts</h2><div className="grid sm:grid-cols-2 gap-3">{quick.map(([e, r, d]) => <button key={e} onClick={() => go(e)} className="text-left p-4 rounded-2xl border bg-white hover:border-orange-400 hover:shadow-md transition"><div className="font-semibold">{r}</div><div className="text-xs text-slate-500">{d}</div><div className="text-[11px] text-orange-600 mt-2">{e}</div></button>)}</div></div>
  </div>;
}
