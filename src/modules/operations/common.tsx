import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, History, CheckCheck, CheckCircle2, Circle } from 'lucide-react';
import type { Artwork, Proof, Notification } from '../../types';
import { api, getDB, getFile, saveFile, fileToThumb, useDB, useSession, notify } from '../../services/storage.service';
import { campaignCompletion } from '../../services/workflows';
import { Button, Badge, Modal, toast, promptDialog, Card, Empty, PageHeader, Notice, cn, Stat, Field, Input } from '../../components/ui';
import { fmtDate, inr, today, sum, invoiceTotals, exportCSV } from '../../utils';
import { assetName, campName, PrintBtn } from '../../components/shared';
import { myNotifications } from '../../components/layout';
import { DisableBtn, DisabledTag, toggleDisabled } from '../../components/disable';
import { MapPin, Camera, Wallet, CalendarDays } from 'lucide-react';

const MAX = 15 * 1024 * 1024;
export function ArtworkUpload({ art, label = 'Upload' }: { art: Artwork; label?: string }) {
  const ref = useRef<HTMLInputElement>(null); const u = useSession(); const [busy, setBusy] = useState(false);
  const onFile = async (f?: File) => {
    if (!f) return; if (f.size > MAX) return toast('File exceeds 15 MB demo limit (browser storage)', 'error');
    setBusy(true);
    try { const key = await saveFile(f); const preview = await fileToThumb(f); await api.update('artworks', art.id, { fileName: f.name, fileSize: f.size, fileType: f.type, fileKey: key, preview, version: art.version + 1, status: 'Submitted', submittedAt: today(), history: [...art.history, { at: new Date().toISOString(), by: u?.name || '-', action: `Uploaded v${art.version + 1}`, note: f.name }] }, `Artwork v${art.version + 1} uploaded`);
      notify({ audience: 'internal', title: 'Artwork submitted', body: `${art.name} v${art.version + 1}`, link: '/admin/artwork-approvals' }); api.commit(); toast('Artwork uploaded — stored locally in this browser');
    } catch (e: any) { toast('Upload failed: ' + e.message, 'error'); } setBusy(false);
  };
  return <><input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} /><Button size="sm" variant="outline" loading={busy} onClick={() => ref.current?.click()}><Upload size={14} />{label}</Button></>;
}
export async function downloadStored(key: string | undefined, name: string, fallbackUrl?: string) {
  if (key) { const b = await getFile(key); if (b) { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); return; } }
  if (fallbackUrl) { window.open(fallbackUrl, '_blank'); return; }
  toast('File not available in this browser (seed records have preview images only)', 'info');
}
export async function reviewArtwork(art: Artwork, status: Artwork['status'], by: string) {
  let note: string | null = '';
  if (status === 'Rejected' || status === 'Revisions Requested') { note = await promptDialog(status === 'Rejected' ? 'Reject artwork' : 'Request revisions'); if (!note) return; }
  await api.update('artworks', art.id, { status, history: [...art.history, { at: new Date().toISOString(), by, action: status, note }] }, `Artwork ${status.toLowerCase()}: ${art.name}`);
  const c = getDB().campaigns.find(x => x.id === art.campaignId);
  if (status !== 'Under Review' && c) notify({ audience: 'customer', targetId: c.customerId, title: `Artwork ${status.toLowerCase()}`, body: `${art.name}${note ? ': ' + note : ''}`, link: '/customer/artwork' });
  if (status === 'Approved' && art.bookingId) { const b = getDB().bookings.find(x => x.id === art.bookingId); if (b && b.status === 'Confirmed') await api.update('bookings', b.id, { status: 'Artwork Pending' }, 'Booking moved to Artwork Pending (artwork approved; ready to schedule)', true); }
  api.commit(); toast(`Artwork ${status.toLowerCase()}`);
}
export function ArtworkHistory({ art, open, onClose }: { art: Artwork | null; open: boolean; onClose: () => void }) {
  if (!art) return null;
  return <Modal open={open} onClose={onClose} title={`${art.name} · v${art.version}`}>
    {art.preview ? <img src={art.preview} className="rounded-xl w-full max-h-72 object-contain bg-slate-100" /> : <div className="h-40 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-sm">No file uploaded yet</div>}
    <div className="text-xs text-slate-500 mt-2">{art.fileName || '—'} · {(art.fileSize / 1024 / 1024).toFixed(2)} MB · {art.fileType || '—'}</div>
    {art.fileName && <Button size="sm" variant="outline" className="mt-2" onClick={() => downloadStored(art.fileKey, art.fileName, art.preview)}><Download size={14} />Download</Button>}
    <h4 className="font-medium text-sm mt-4 mb-2 flex items-center gap-1"><History size={14} />Approval history</h4>
    <ol className="border-l-2 border-orange-200 pl-4 space-y-2">{art.history.map((h, i) => <li key={i} className="text-xs"><b>{h.action}</b> · {h.by} · {new Date(h.at).toLocaleString('en-IN')}{h.note && <div className="text-slate-500">{h.note}</div>}</li>)}{!art.history.length && <li className="text-xs text-slate-400">No history yet</li>}</ol>
  </Modal>;
}

export function ProofUpload({ installationId, assetId, campaignId, compact }: { installationId: string; assetId: string; campaignId: string; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [notes, setNotes] = useState(''); const [date, setDate] = useState(today());
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    for (const f of Array.from(files)) { if (f.size > MAX) { toast(`${f.name} too large`, 'error'); continue; } const key = await saveFile(f); const thumb = await fileToThumb(f, 720);
      const pending = getDB().proofs.find(p => p.installationId === installationId && p.status === 'Pending Upload');
      if (pending) await api.update('proofs', pending.id, { image: thumb, fileKey: key, captureDate: date, notes: notes || f.name, status: 'Submitted' }, 'Proof uploaded');
      else await api.create('proofs', { installationId, assetId, campaignId, captureDate: date, image: thumb, fileKey: key, notes: notes || f.name, status: 'Submitted', reason: '' }, 'prf', 'Proof uploaded'); }
    notify({ audience: 'internal', title: 'Proof submitted', body: assetName(getDB(), assetId), link: '/admin/proofs' }); api.commit(); setBusy(false); setNotes(''); toast('Proof submitted for review');
  };
  return <div className={cn('flex flex-wrap gap-2 items-end', !compact && 'p-3 rounded-xl bg-slate-50')}>
    {!compact && <><Field label="Capture date"><Input type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field><Field label="Notes" className="flex-1"><Input value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="Day shot, night shot…" /></Field></>}
    <input ref={ref} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => onFiles(e.target.files)} /><Button size="sm" loading={busy} onClick={() => ref.current?.click()}><Camera size={14} />Upload proof</Button></div>;
}
export async function reviewProof(p: Proof, status: Proof['status'] | 'More', by: string) {
  let reason = '';
  if (status === 'Rejected' || status === 'More') { const r = await promptDialog(status === 'More' ? 'Request additional evidence' : 'Reject proof'); if (!r) return; reason = r; }
  const s: Proof['status'] = status === 'More' ? 'Pending Upload' : status;
  await api.update('proofs', p.id, { status: s, reason }, `Proof ${status === 'More' ? 'additional evidence requested' : s.toLowerCase()} by ${by}`);
  const c = getDB().campaigns.find(x => x.id === p.campaignId);
  if (s === 'Approved' && c) notify({ audience: 'customer', targetId: c.customerId, title: 'Proof approved', body: `New proof photos for ${assetName(getDB(), p.assetId)}`, link: '/customer/reports' });
  if (status === 'More') { const a = getDB().assets.find(x => x.id === p.assetId); notify({ audience: 'owner', targetId: a?.ownerId, title: 'Additional proof requested', body: reason, link: '/owner/proofs' }); }
  api.commit(); toast('Proof updated');
}

export function NotificationsPage() {
  const db = useDB(); const u = useSession()!; const nav = useNavigate(); const list = myNotifications(db.notifications, u);
  return <div><PageHeader title="Notifications" subtitle={`${list.filter(n => !n.read).length} unread`} actions={<Button variant="outline" onClick={async () => { await api.tx(d => { d.notifications = d.notifications.map(n => list.some(l => l.id === n.id) ? { ...n, read: true } : n); }); toast('All marked read'); }}><CheckCheck size={16} />Mark all read</Button>} />
    <Card className="divide-y">{list.map((n: Notification) => <div key={n.id} className={cn('flex gap-3 p-4 items-start', !n.read && 'bg-orange-50/40')}>
      <span className={cn('mt-1.5 w-2 h-2 rounded-full', n.read ? 'bg-slate-200' : 'bg-orange-500')} />
      <button className="flex-1 text-left" onClick={() => { api.update('notifications', n.id, { read: true }, '', true); nav(n.link); }}><div className={cn('font-medium text-sm', n.disabled && 'opacity-60')}>{n.title} {n.disabled && <DisabledTag />}</div><div className="text-sm text-slate-500">{n.body}</div><div className="text-[11px] text-slate-400 mt-1">{new Date(n.at).toLocaleString('en-IN')}</div></button>
      {!n.read && <Button size="sm" variant="ghost" onClick={() => api.update('notifications', n.id, { read: true }, '', true)}>Mark read</Button>}
      <DisableBtn disabled={n.disabled} onClick={() => toggleDisabled('notifications', n, 'Notification')} /></div>)}
      {!list.length && <Empty title="You're all caught up" />}</Card></div>;
}

export function CampaignReport({ campaignId, internal }: { campaignId: string; internal?: boolean }) {
  const db = useDB(); const c = db.campaigns.find(x => x.id === campaignId);
  if (!c) return <Empty title="Campaign not found" />;
  const bk = db.bookings.filter(b => b.campaignId === c.id && b.status !== 'Cancelled');
  const proofs = db.proofs.filter(p => p.campaignId === c.id && p.status === 'Approved');
  const inv = db.invoices.filter(i => i.campaignId === c.id && i.status !== 'Draft');
  const spend = sum(inv.map(i => invoiceTotals(i, db).total));
  const comp = campaignCompletion(db, c.id);
  return <div className="space-y-4 print-area">
    <div className="flex justify-between items-start flex-wrap gap-2"><div><h2 className="text-xl font-bold">{c.name}</h2><div className="text-sm text-slate-500">{db.customers.find(x => x.id === c.customerId)?.company} · {fmtDate(c.start)} – {fmtDate(c.end)}</div></div><div className="flex gap-2 items-center"><Badge>{c.status}</Badge><PrintBtn /><Button size="sm" variant="outline" onClick={() => exportCSV(`campaign-report-${c.name}`, bk.map(b => ({ booking: b.number, asset: assetName(db, b.assetId), start: b.start, end: b.end, status: b.status, installation: db.installations.find(i => i.bookingId === b.id)?.status || '-', approvedProofs: proofs.filter(p => p.assetId === b.assetId).length })))}><Download size={14} />CSV</Button></div></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat icon={MapPin} label="Booked sites" value={bk.length} /><Stat icon={Camera} label="Approved proofs" value={proofs.length} tone="green" /><Stat icon={Wallet} label="Invoiced spend" value={inr(spend)} tone="blue" /><Stat icon={CalendarDays} label="Days" value={Math.max(0, Math.round((+new Date(c.end) - +new Date(c.start)) / 864e5) + 1)} tone="violet" /></div>
    <Card className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-left">Location</th><th className="p-3 text-left">Dates</th><th className="p-3 text-left">Booking</th><th className="p-3 text-left">Installation</th><th className="p-3 text-left">Proof</th></tr></thead>
      <tbody>{bk.map(b => { const a = db.assets.find(x => x.id === b.assetId); const ins = db.installations.find(i => i.bookingId === b.id); return <tr key={b.id} className="border-t"><td className="p-3">{a?.name}<div className="text-xs text-slate-400">{a?.location}, {a?.city}</div></td><td className="p-3 text-xs">{fmtDate(b.start)} – {fmtDate(b.end)}</td><td className="p-3"><Badge>{b.status}</Badge></td><td className="p-3">{ins ? <><Badge>{ins.status}</Badge><div className="text-xs text-slate-400">{fmtDate(ins.scheduled)}</div></> : '—'}</td><td className="p-3">{proofs.filter(p => p.assetId === b.assetId).length} approved</td></tr>; })}</tbody></table>{!bk.length && <Empty title="No bookings yet" />}</Card>
    <Card className="p-4"><h3 className="font-semibold mb-3">Proof-of-advertising photographs</h3>{proofs.length ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{proofs.map(p => <figure key={p.id}><img src={p.image} className="rounded-lg aspect-video object-cover w-full" /><figcaption className="text-[11px] text-slate-500 mt-1">{assetName(db, p.assetId)} · {fmtDate(p.captureDate)} · {p.notes}</figcaption></figure>)}</div> : <Empty title="No approved proof yet" />}
      <p className="text-[11px] text-slate-400 mt-3">Proof images are reviewed by the Oolaa team in the workflow; they are not independently authenticated.</p></Card>
    {internal && <Card className="p-4"><h3 className="font-semibold mb-2">Completion checklist</h3>{comp.checks.map(k => <div key={k.label} className="flex items-center gap-2 text-sm py-1">{k.ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-300" />}{k.label}</div>)}</Card>}
    <Notice tone="blue">Workflow statuses above reflect recorded demo actions. Any audience/traffic figures elsewhere are illustrative only.</Notice>
  </div>;
}
export { campName };
