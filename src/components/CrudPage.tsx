import { useMemo, useState, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../services/storage.service';
import type { CollectionKey } from '../types';
import { Button, Card, Modal, Field, inputCls, Table, type Col, PageHeader, ExportBtn, toast, confirmDialog, Empty, useFakeLoad, Select } from './ui';
import { exportCSV } from '../utils';

export interface FieldDef { name: string; label: string; type?: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'email' | 'checkbox'; options?: (string | { value: string; label: string })[]; required?: boolean; min?: number; full?: boolean; help?: string; }
export function validate(fields: FieldDef[], v: any) {
  const e: Record<string, string> = {};
  for (const f of fields) {
    const x = v[f.name];
    if (f.required && (x === undefined || x === null || String(x).trim() === '')) e[f.name] = `${f.label} is required`;
    else if (f.type === 'number' && x !== '' && x !== undefined && (isNaN(Number(x)) || (f.min !== undefined && Number(x) < f.min))) e[f.name] = `${f.label} must be ≥ ${f.min ?? 0}`;
    else if (f.type === 'email' && x && !/^\S+@\S+\.\S+$/.test(x)) e[f.name] = 'Invalid email';
  }
  return e;
}
export function FormFields({ fields, value, set, errors }: { fields: FieldDef[]; value: any; set: (k: string, v: any) => void; errors: Record<string, string> }) {
  return <div className="grid sm:grid-cols-2 gap-3">{fields.map(f => <Field key={f.name} label={f.label + (f.required ? ' *' : '')} error={errors[f.name]} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
    {f.type === 'select' ? <Select options={f.options || []} placeholder="Select…" value={value[f.name] ?? ''} onChange={(e: any) => set(f.name, e.target.value)} />
      : f.type === 'textarea' ? <textarea rows={3} className={inputCls} value={value[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />
        : f.type === 'checkbox' ? <input type="checkbox" className="h-5 w-5 accent-orange-500" checked={!!value[f.name]} onChange={e => set(f.name, e.target.checked)} />
          : <input type={f.type || 'text'} className={inputCls} value={value[f.name] ?? ''} onChange={e => set(f.name, f.type === 'number' ? e.target.value : e.target.value)} />}
    {f.help && <span className="text-[11px] text-slate-400">{f.help}</span>}</Field>)}</div>;
}

export interface CrudProps<R extends { id: string }> {
  title: string; subtitle?: string; collection: CollectionKey; rows: R[]; cols: Col<R>[]; fields: FieldDef[]; defaults?: Partial<R>;
  canCreate?: boolean; canEdit?: boolean | ((r: R) => boolean); canDelete?: boolean; deleteCheck?: (r: R) => string | null;
  filters?: { key: string; label: string; options: string[] }[]; searchKeys?: string[]; toRecord?: (form: any, prev?: R) => any; csvName?: string;
  extra?: (r: R) => ReactNode; onRow?: (r: R) => void; headerExtra?: ReactNode; entityLabel?: string; prefix?: string;
}
export function CrudPage<R extends { id: string }>(p: CrudProps<R>) {
  const [q, setQ] = useState(''); const [flt, setFlt] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<R | null | 'new'>(null); const [form, setForm] = useState<any>({}); const [errors, setErrors] = useState<any>({}); const [saving, setSaving] = useState(false);
  const loading = useFakeLoad();
  const label = p.entityLabel || p.title.replace(/s$/, '');
  const rows = useMemo(() => p.rows.filter(r => (!q || (p.searchKeys || Object.keys(r)).some(k => String((r as any)[k] ?? '').toLowerCase().includes(q.toLowerCase()))) && Object.entries(flt).every(([k, v]) => !v || String((r as any)[k]) === v)), [p.rows, q, flt]);
  const open = (r: R | 'new') => { setEditing(r); setErrors({}); setForm(r === 'new' ? { ...(p.defaults || {}) } : { ...r }); };
  const save = async () => {
    const e = validate(p.fields, form); setErrors(e); if (Object.keys(e).length) return;
    const data: any = { ...form }; p.fields.filter(f => f.type === 'number').forEach(f => data[f.name] = Number(data[f.name] || 0));
    const rec = p.toRecord ? p.toRecord(data, editing === 'new' ? undefined : editing!) : data;
    setSaving(true);
    if (editing === 'new') { const pr = api.create(p.collection, rec, p.prefix, `${label} created`); setEditing(null); await pr; toast(`${label} created`); }
    else { const pr = api.update(p.collection, (editing as R).id, rec, `${label} updated`); setEditing(null); await pr; toast(`${label} updated`); }
    setSaving(false);
  };
  const del = async (r: R) => {
    const block = p.deleteCheck?.(r); if (block) return toast(block, 'error');
    if (!(await confirmDialog(`Delete ${label}?`, 'This action cannot be undone and will be recorded in the audit log.'))) return;
    await api.remove(p.collection, r.id, `${label} deleted`); toast(`${label} deleted`);
  };
  const editable = (r: R) => typeof p.canEdit === 'function' ? p.canEdit(r) : p.canEdit !== false;
  const cols: Col<R>[] = [...p.cols, ...((p.canEdit !== false || p.canDelete !== false || p.extra) ? [{ key: '_a', label: '', className: 'text-right whitespace-nowrap', render: (r: R) => <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>{p.extra?.(r)}{editable(r) && <Button size="sm" variant="ghost" onClick={() => open(r)} title="Edit"><Pencil size={14} /></Button>}{p.canDelete !== false && <Button size="sm" variant="ghost" onClick={() => del(r)} title="Delete"><Trash2 size={14} className="text-rose-500" /></Button>}</div> }] : [])];
  return <div>
    <PageHeader title={p.title} subtitle={p.subtitle} actions={<>{p.headerExtra}<ExportBtn onClick={() => exportCSV(p.csvName || p.collection, rows.map(r => Object.fromEntries(p.cols.map(c => [c.label, c.csv ? c.csv(r) : (r as any)[c.key]]))))} />{p.canCreate !== false && <Button onClick={() => open('new')}><Plus size={16} />New {label}</Button>}</>} />
    <Card>
      <div className="p-3 border-b flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className={inputCls + ' pl-9'} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {p.filters?.map(f => <Select key={f.key} className="w-auto" options={f.options} placeholder={`All ${f.label}`} value={flt[f.key] || ''} onChange={(e: any) => setFlt({ ...flt, [f.key]: e.target.value })} />)}
      </div>
      <Table loading={loading} rows={rows} cols={cols} onRow={p.onRow} empty={<Empty title={`No ${p.title.toLowerCase()} found`} body={q ? 'Try a different search.' : 'Create the first record to get started.'} action={p.canCreate !== false && <Button onClick={() => open('new')}><Plus size={16} />New {label}</Button>} />} />
      <div className="px-4 py-2 text-xs text-slate-400 border-t">{rows.length} of {p.rows.length} records</div>
    </Card>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `New ${label}` : `Edit ${label}`} wide={p.fields.length > 8}
      footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <FormFields fields={p.fields} value={form} set={(k, v) => setForm((f: any) => ({ ...f, [k]: v }))} errors={errors} />
    </Modal>
  </div>;
}
