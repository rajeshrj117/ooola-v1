import { useState } from 'react';
import { Check, Upload, ShieldCheck } from 'lucide-react';
import { useDB, useSession, api } from '../../services/storage.service';
import { Button, Notice, toast, Field, Select } from '../../components/ui';
import { FormFields, validate, type FieldDef } from '../../components/CrudPage';
import { cn } from '../../components/ui';

const STATES = ['Tamil Nadu', 'Karnataka', 'Telangana', 'Andhra Pradesh', 'Kerala', 'Maharashtra', 'Delhi', 'Gujarat', 'Other'];

const STEPS: { title: string; fields: FieldDef[] }[] = [
  { title: 'Company Details', fields: [
    { name: 'company', label: 'Company name', required: true },
    { name: 'businessType', label: 'Business type', type: 'select', options: ['Private Limited', 'Proprietorship', 'Partnership', 'LLP'], required: true },
    { name: 'yearEstablished', label: 'Year established', placeholder: '2015', pattern: /^(19|20)\d{2}$/, patternMsg: 'Enter a valid year' },
    { name: 'website', label: 'Website (optional)', placeholder: 'https://' },
  ] },
  { title: 'Business Address', fields: [
    { name: 'address', label: 'Address', full: true, required: true },
    { name: 'landmark', label: 'Landmark (optional)' },
    { name: 'city', label: 'City', required: true },
    { name: 'state', label: 'State', type: 'select', options: STATES, required: true },
    { name: 'pincode', label: 'Pincode', required: true, placeholder: '600001', pattern: /^\d{6}$/, patternMsg: 'Pincode must be 6 digits' },
  ] },
  { title: 'Legal Registration', fields: [
    { name: 'pan', label: 'PAN', required: true, upper: true, placeholder: 'ABCDE1234F', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, patternMsg: 'Invalid PAN (format ABCDE1234F)' },
    { name: 'gst', label: 'GSTIN (optional)', upper: true, placeholder: '33ABCDE1234F1Z5', pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, patternMsg: 'Invalid GSTIN (15 characters)' },
    { name: 'licenceNo', label: 'Advertising licence no. (optional)', full: true, help: 'Municipal / corporation outdoor advertising licence, if any' },
  ] },
  { title: 'Contact Details', fields: [
    { name: 'name', label: 'Contact person', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'phone', required: true },
    { name: 'altPhone', label: 'Alternate phone (optional)', type: 'phone' },
  ] },
];
const VERIFY = 4, REVIEW = 5;
const ALL = ['Company Details', 'Business Address', 'Legal Registration', 'Contact Details', 'Owner Verification', 'Review & Submit'];

const splitPhone = (p?: string) => { const m = (p || '').match(/^(\+\d{1,3})\s*(.*)$/); return m ? { code: m[1], num: m[2].replace(/\D/g, '') } : { code: '+91', num: (p || '').replace(/\D/g, '') }; };

export function OwnerOnboarding() {
  const u = useSession(); const db = useDB();
  const me = db.owners.find(o => o.id === u?.ownerId);
  const [step, setStep] = useState(0);
  const [v, setV] = useState<any>(() => { if (!me) return {}; const p = splitPhone(me.phone); return { ...me, phone: p.num, phoneCode: p.code, altPhone: splitPhone(me.altPhone).num, altPhoneCode: splitPhone(me.altPhone).code }; });
  const [e, setE] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!u || u.role !== 'Media Owner' || !me || me.onboardingComplete) return null;

  const set = (k: string, x: any) => setV((p: any) => ({ ...p, [k]: x }));
  const verifyErrors = () => { const er: Record<string, string> = {}; if (!v.idType) er.idType = 'Select an ID type'; if (!v.idUploaded) er.idUploaded = 'Upload the document (simulated)'; if (!v.consent) er.consent = 'Please accept the declaration'; return er; };
  const next = () => { const er = step < VERIFY ? validate(STEPS[step].fields, v) : step === VERIFY ? verifyErrors() : {}; setE(er); if (Object.keys(er).length) return; setStep(step + 1); };
  const back = () => { setE({}); setStep(step - 1); };
  const submit = async () => {
    setBusy(true);
    const phone = `${v.phoneCode || '+91'} ${v.phone}`; const altPhone = v.altPhone ? `${v.altPhoneCode || '+91'} ${v.altPhone}` : '';
    const { consent, phoneCode, altPhoneCode, ...rest } = v;
    await api.update('owners', me.id, { ...rest, phone, altPhone, onboardingComplete: true, onboardedAt: new Date().toISOString() }, 'Owner onboarding completed');
    toast('Onboarding complete — welcome to Oolaa!'); setBusy(false);
  };

  const reviewRows = (i: number) => STEPS[i].fields.map(f => [f.label.replace(' (optional)', ''), f.type === 'phone' ? (v[f.name] ? `${v[f.name + 'Code'] || '+91'} ${v[f.name]}` : '—') : (v[f.name] || '—')]);

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4">
    <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl max-h-[100vh] sm:max-h-[94vh] flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b">
        <h2 className="text-lg font-bold">Complete your media owner profile</h2>
        <p className="text-sm text-slate-500">Finish these 6 steps to access your portal.</p>
        <ol className="mt-4 flex items-start">{ALL.map((t, i) => <li key={t} className="flex-1 flex flex-col items-center text-center relative">
          {i > 0 && <span className={cn('absolute top-3.5 right-1/2 w-full h-0.5 -z-0', i <= step ? 'bg-orange-500' : 'bg-slate-200')} />}
          <span className={cn('relative z-10 w-7 h-7 rounded-full grid place-items-center text-xs font-bold', i < step ? 'bg-orange-500 text-white' : i === step ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-slate-200 text-slate-500')}>{i < step ? <Check size={14} /> : i + 1}</span>
          <span className={cn('mt-1.5 text-[10px] sm:text-xs leading-tight', i === step ? 'text-slate-900 font-medium' : 'text-slate-400')}>{t}</span></li>)}</ol>
      </div>
      <div className="p-5 overflow-y-auto flex-1">
        <h3 className="font-semibold mb-3">{step + 1}. {ALL[step]}</h3>
        {step < VERIFY && <FormFields fields={STEPS[step].fields} value={v} set={set} errors={e} />}
        {step === VERIFY && <div className="space-y-4">
          <Notice>Verification is simulated in this demo. Do not upload or enter real identity documents.</Notice>
          <Field label="ID type *" error={e.idType}><Select options={['Aadhaar', 'Voter ID', 'Driving Licence', 'Passport']} placeholder="Select…" value={v.idType ?? ''} onChange={(ev: any) => set('idType', ev.target.value)} /></Field>
          <div><div className="text-sm font-medium mb-1">ID document *</div>
            <button type="button" onClick={() => set('idUploaded', true)} className={cn('w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-1 text-sm', v.idUploaded ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50')}>{v.idUploaded ? <><ShieldCheck size={22} />Sample document attached (simulated)</> : <><Upload size={22} />Click to simulate document upload</>}</button>
            {e.idUploaded && <div className="text-xs text-rose-600 mt-1">{e.idUploaded}</div>}</div>
          <label className="flex gap-2 text-sm items-start"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-500" checked={!!v.consent} onChange={ev => set('consent', ev.target.checked)} />I confirm the details provided are correct and I am authorised to list advertising space for this business.</label>
          {e.consent && <div className="text-xs text-rose-600">{e.consent}</div>}
        </div>}
        {step === REVIEW && <div className="space-y-3">
          {STEPS.map((s, i) => <div key={s.title} className="border rounded-xl p-4"><div className="flex justify-between items-center mb-2"><b className="text-sm">{i + 1}. {s.title}</b><button className="text-xs text-orange-600 hover:underline" onClick={() => setStep(i)}>Edit</button></div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">{reviewRows(i).map(([k, val]) => <div key={k} className="flex gap-2"><dt className="text-slate-500 shrink-0">{k}:</dt><dd className="break-words min-w-0">{val}</dd></div>)}</dl></div>)}
          <div className="border rounded-xl p-4"><div className="flex justify-between items-center mb-1"><b className="text-sm">5. Owner Verification</b><button className="text-xs text-orange-600 hover:underline" onClick={() => setStep(VERIFY)}>Edit</button></div><div className="text-sm">{v.idType} — document attached (simulated)</div></div>
        </div>}
      </div>
      <div className="px-5 py-3 border-t bg-slate-50 sm:rounded-b-2xl flex justify-between items-center">
        <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
        <span className="text-xs text-slate-400">Step {step + 1} of 6</span>
        {step < REVIEW ? <Button onClick={next}>Next</Button> : <Button onClick={submit} disabled={busy}>Submit & enter portal</Button>}
      </div>
    </div></div>;
}
