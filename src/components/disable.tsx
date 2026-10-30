import { Ban, RotateCcw } from 'lucide-react';
import { api } from '../services/storage.service';
import { Button, confirmDialog, toast } from './ui';

export const DisabledTag = () => <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 whitespace-nowrap">Disabled</span>;

export function DisableBtn({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return <Button size="sm" variant="ghost" onClick={onClick} title={disabled ? 'Enable' : 'Disable'}>
    {disabled ? <><RotateCcw size={14} className="text-emerald-600" />Enable</> : <><Ban size={14} className="text-rose-500" />Disable</>}</Button>;
}

/** Soft-disable / re-enable a record (nothing is deleted). Returns true if the state changed. */
export async function toggleDisabled(collection: any, rec: { id: string; disabled?: boolean }, label: string): Promise<boolean> {
  const to = !rec.disabled;
  if (to && !(await confirmDialog(`Disable ${label}?`, 'It will be hidden from new use but kept in the records. You can enable it again any time.', false))) return false;
  await api.update(collection, rec.id, { disabled: to } as any, `${label} ${to ? 'disabled' : 'enabled'}`);
  toast(`${label} ${to ? 'disabled' : 'enabled'}`);
  return true;
}
