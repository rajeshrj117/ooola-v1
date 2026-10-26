import { useState } from 'react';
import { Check, X, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import { useDB, useSession, api, getDB } from '../../services/storage.service';
import { CrudPage } from '../../components/CrudPage';
import { Button, Card, Badge, PageHeader, Table, Select, toast, Empty, Notice, Tabs, Modal, promptDialog } from '../../components/ui';
import { assetName, campName } from '../../components/shared';
import { ArtworkUpload, ArtworkHistory, reviewArtwork, ProofUpload, reviewProof, CampaignReport } from '../operations/common';
import { fmtDate, today } from '../../utils';
import type { Artwork, Installation } from '../../types';

export function AdminArtwork() {
  const db = useDB(); const [h, setH] = useState<Artwork | null>(null);
  return <><CrudPage title="Artwork" entityLabel="Artwork" collection="artworks" rows={db.artworks} prefix="art" searchKeys={['name', 'fileName', 'status']} filters={[{ key: 'status', label: 'statuses', options: ['Awaiting Upload', 'Submitted', 'Under Review', 'Approved', 'Revisions Requested', 'Rejected'] }]}
    defaults={{ status: 'Awaiting Upload', version: 0, history: [], fileName: '', fileSize: 0, fileType: '', submittedAt: '' } as any}
    toRecord={(f, prev) => prev ? { name: f.name, campaignId: f.campaignId, bookingId: f.bookingId } : f}
    subtitle="Creative files stored locally (IndexedDB) with metadata & version history"
    extra={a => <><ArtworkUpload art={a} label="Upload" /><Button size="sm" variant="ghost" onClick={() => setH(a)}><Eye size={14} /></Button></>}
    cols={[{ key: 'p', label: '', render: a => a.preview ? <img src={a.preview} className="w-12 h-8 rounded object-cover" /> : <div className="w-12 h-8 rounded bg-slate-100" />, csv: a => a.id }, { key: 'name', label: 'Artwork', render: a => <div><b>{a.name}</b><div className="text-xs text-slate-400">{a.fileName || 'no file'} · v{a.version}</div></div>, csv: a => a.name }, { key: 'c', label: 'Campaign', render: a => campName(db, a.campaignId), csv: a => campName(db, a.campaignId) }, { key: 'submittedAt', label: 'Submitted', render: a => fmtDate(a.submittedAt) }, { key: 'status', label: 'Status', render: a => <Badge>{a.status}</Badge> }]}
    fields={[{ name: 'name', label: 'Artwork name', required: true, full: true }, { name: 'campaignId', label: 'Campaign', type: 'select', required: true, options: db.campaigns.map(c => ({ value: c.id, label: c.name })) }, { name: 'bookingId', label: 'Booking (optional)', type: 'select', options: db.bookings.map(b => ({ value: b.id, label: `${b.number} · ${assetName(db, b.assetId)}` })) }]} />
    <ArtworkHistory art={h} open={!!h} onClose={() => setH(null)} /></>;
}

export function ArtworkApprovals() {
  const db = useDB(); const u = useSession()!; const [tab, setTab] = useState('Pending'); const [h, setH] = useState<Artwork | null>(null);
  const rows = db.artworks.filter(a => tab === 'Pending' ? ['Submitted', 'Under Review'].includes(a.status) : a.status === tab);
  return <div><PageHeader title="Artwork Approvals" subtitle="Review submitted creatives" /><Tabs tabs={['Pending', 'Approved', 'Revisions Requested', 'Rejected']} value={tab} onChange={setTab} />
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map(a => <Card key={a.id} className="overflow-hidden">{a.preview ? <img src={a.preview} className="aspect-video w-full object-cover bg-slate-100" /> : <div className="aspect-video bg-slate-100" />}<div className="p-4 text-sm space-y-2"><div className="flex justify-between"><b>{a.name}</b><Badge>{a.status}</Badge></div><div className="text-xs text-slate-500">{campName(db, a.campaignId)} · v{a.version} · {fmtDate(a.submittedAt)}</div>
      <div className="flex flex-wrap gap-1">{a.status === 'Submitted' && <Button size="sm" variant="outline" onClick={() => reviewArtwork(a, 'Under Review', u.name)}>Start review</Button>}{['Submitted', 'Under Review'].includes(a.status) && <><Button size="sm" variant="success" onClick={() => reviewArtwork(a, 'Approved', u.name)}><Check size={14} />Approve</Button><Button size="sm" variant="outline" onClick={() => reviewArtwork(a, 'Revisions Requested', u.name)}><RotateCcw size={14} />Revise</Button><Button size="sm" variant="danger" onClick={() => reviewArtwork(a, 'Rejected', u.name)}><X size={14} />Reject</Button></>}<Button size="sm" variant="ghost" onClick={() => setH(a)}>History</Button></div></div></Card>)}</div>
    {!rows.length && <Card><Empty title="Nothing in this queue" /></Card>}<ArtworkHistory art={h} open={!!h} onClose={() => setH(null)} /></div>;
}

export function Installations() {
  const db = useDB(); const [proof, setProof] = useState<Installation | null>(null);
  const delayed = (i: Installation) => i.status !== 'Completed' && i.scheduled < today();
  const quick = async (i: Installation, status: Installation['status']) => { let notes = i.notes; if (status === 'Issue Reported') { const n = await promptDialog('Describe the issue'); if (!n) return; notes = (notes ? notes + '\n' : '') + n; } await api.update('installations', i.id, { status, notes, completedAt: status === 'Completed' ? today() : i.completedAt }, `Installation ${status}`); toast(`Installation ${status.toLowerCase()}`); };
  return <><CrudPage title="Installation Tasks" entityLabel="Installation task" collection="installations" rows={db.installations} prefix="ins" searchKeys={['assignee', 'status', 'instructions']} filters={[{ key: 'status', label: 'statuses', options: ['Scheduled', 'In Progress', 'Completed', 'Delayed', 'Issue Reported'] }]}
    headerExtra={<span className="text-xs text-rose-600 self-center flex items-center gap-1"><AlertTriangle size={14} />{db.installations.filter(delayed).length} overdue</span>}
    defaults={{ status: 'Scheduled', scheduled: today(), assignee: 'Murugan (Installer)', instructions: 'Mount creative, verify lighting, capture proof.', notes: '', completedAt: '' } as any}
    toRecord={f => { const b = getDB().bookings.find(x => x.id === f.bookingId); if (!b) throw new Error('Invalid booking'); return { ...f, campaignId: b.campaignId, assetId: b.assetId, supplierId: f.supplierId || b.ownerId, completedAt: f.status === 'Completed' && !f.completedAt ? today() : f.completedAt }; }}
    deleteCheck={i => db.proofs.some(p => p.installationId === i.id && p.status !== 'Pending Upload') ? 'Task has uploaded proof records' : null}
    extra={i => <>{i.status !== 'Completed' && <><Button size="sm" variant="ghost" onClick={() => quick(i, i.status === 'Scheduled' ? 'In Progress' : 'Completed')}>{i.status === 'Scheduled' ? 'Start' : 'Complete'}</Button><Button size="sm" variant="ghost" onClick={() => quick(i, 'Issue Reported')}>Issue</Button></>}<Button size="sm" variant="ghost" onClick={() => setProof(i)}>Proof</Button></>}
    cols={[{ key: 'id', label: 'ID', render: i => <span className="text-xs font-mono">{i.id.slice(-6)}</span> }, { key: 'a', label: 'Asset / location', render: i => <div><b>{assetName(db, i.assetId)}</b><div className="text-xs text-slate-400">{db.assets.find(a => a.id === i.assetId)?.location}</div></div>, csv: i => assetName(db, i.assetId) }, { key: 'c', label: 'Campaign', render: i => campName(db, i.campaignId), csv: i => campName(db, i.campaignId) }, { key: 'scheduled', label: 'Scheduled', render: i => <span className={delayed(i) ? 'text-rose-600 font-medium' : ''}>{fmtDate(i.scheduled)}{delayed(i) && ' ⚠'}</span> }, { key: 'assignee', label: 'Assigned' }, { key: 'status', label: 'Status', render: i => <Badge>{i.status}</Badge> }, { key: 'completedAt', label: 'Completed', render: i => fmtDate(i.completedAt) }]}
    fields={[{ name: 'bookingId', label: 'Booking', type: 'select', required: true, full: true, options: db.bookings.filter(b => b.status !== 'Cancelled').map(b => ({ value: b.id, label: `${b.number} · ${assetName(db, b.assetId)}` })) }, { name: 'scheduled', label: 'Scheduled date', type: 'date', required: true }, { name: 'assignee', label: 'Assigned employee', type: 'select', required: true, options: [...db.users.filter(u => ['Installation Staff', 'Campaign Coordinator'].includes(u.role)).map(u => u.name), 'Murugan (Installer)', 'Selvam (Installer)', 'Ajay (Coordinator)', 'Unassigned'] }, { name: 'supplierId', label: 'Assigned supplier', type: 'select', options: db.owners.map(o => ({ value: o.id, label: o.company })) }, { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In Progress', 'Completed', 'Delayed', 'Issue Reported'] }, { name: 'instructions', label: 'Installation instructions', type: 'textarea' }, { name: 'notes', label: 'Notes / issues', type: 'textarea' }]} />
    <Modal open={!!proof} onClose={() => setProof(null)} title="Upload proof">{proof && <ProofUpload installationId={proof.id} assetId={proof.assetId} campaignId={proof.campaignId} />}</Modal></>;
}

export function Proofs() {
  const db = useDB(); const u = useSession()!; const [tab, setTab] = useState('Review queue');
  const rows = db.proofs.filter(p => tab === 'Review queue' ? ['Submitted', 'Under Review'].includes(p.status) : tab === 'All' ? true : p.status === tab);
  return <div><PageHeader title="Proof of Advertising" subtitle="Review installation photographs" /><Notice>Approval reflects internal review only. Uploaded images are not independently authenticated.</Notice>
    <div className="mt-4"><Tabs tabs={['Review queue', 'Approved', 'Rejected', 'Pending Upload', 'All']} value={tab} onChange={setTab} /></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{rows.map(p => <Card key={p.id} className="overflow-hidden">{p.image ? <img src={p.image} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-slate-100 grid place-items-center text-xs text-slate-400">Awaiting upload</div>}
      <div className="p-3 text-xs space-y-1"><div className="flex justify-between gap-1"><b className="truncate">{assetName(db, p.assetId)}</b><Badge>{p.status}</Badge></div><div className="text-slate-500">{campName(db, p.campaignId)}</div><div>Captured {fmtDate(p.captureDate)} · {p.notes}</div>{p.reason && <div className="text-rose-600">{p.reason}</div>}
        <div className="flex flex-wrap gap-1 pt-1">{p.status === 'Submitted' && <Button size="sm" variant="outline" onClick={() => reviewProof(p, 'Under Review', u.name)}>Review</Button>}{['Submitted', 'Under Review'].includes(p.status) && <><Button size="sm" variant="success" onClick={() => reviewProof(p, 'Approved', u.name)}>Approve</Button><Button size="sm" variant="danger" onClick={() => reviewProof(p, 'Rejected', u.name)}>Reject</Button><Button size="sm" variant="ghost" onClick={() => reviewProof(p, 'More', u.name)}>More evidence</Button></>}
          {p.status === 'Pending Upload' && <ProofUpload compact installationId={p.installationId} assetId={p.assetId} campaignId={p.campaignId} />}</div></div></Card>)}</div>{!rows.length && <Card><Empty title="Nothing here" /></Card>}</div>;
}

export function AdminCampaignReports() {
  const db = useDB(); const camps = db.campaigns.filter(c => db.bookings.some(b => b.campaignId === c.id)); const [sel, setSel] = useState(camps[0]?.id || '');
  return <div><PageHeader title="Campaign Reports" actions={<Select className="w-72" options={camps.map(c => ({ value: c.id, label: c.name }))} value={sel} onChange={(e: any) => setSel(e.target.value)} />} />{sel ? <CampaignReport campaignId={sel} internal /> : <Empty />}</div>;
}
export { Table };
