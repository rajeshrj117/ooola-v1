import { History } from 'lucide-react';
import type { Asset } from '../types';
import { useDB } from '../services/storage.service';
import { Badge, Button, Modal, Empty } from './ui';
import { custName } from './shared';
import { fmtDate, inr } from '../utils';

/** Small "History" button — place it right after the Disable/Enable button. */
export const BookingHistoryBtn = ({ onClick }: { onClick: () => void }) =>
  <Button size="sm" variant="ghost" onClick={onClick} title="Booking history"><History size={14} className="text-sky-600" />History</Button>;

/**
 * All bookings ever made for an asset (every status, newest first), including while the asset is disabled.
 * `amount`: 'customer' = what the customer paid (admin), 'supplier' = what the media owner earns (owner portal).
 * `showCost` adds the supplier cost column for admins who are allowed to see costs.
 */
export function BookingHistoryModal({ asset, onClose, amount = 'customer', showCost = false }: { asset: Asset | null; onClose: () => void; amount?: 'customer' | 'supplier'; showCost?: boolean }) {
  const db = useDB();
  const rows = asset ? db.bookings.filter(b => b.assetId === asset.id).sort((a, b) => b.start.localeCompare(a.start)) : [];
  const live = rows.filter(b => !['Cancelled'].includes(b.status));
  const total = live.reduce((s, b) => s + (amount === 'supplier' ? b.supplierCost : b.amount), 0);
  return <Modal open={!!asset} onClose={onClose} wide title={asset ? <span>Booking history — {asset.name} {asset.disabled && <Badge>Disabled</Badge>}</span> : ''}>
    {asset && (rows.length === 0 ? <Empty title="No bookings yet" body="Bookings for this asset will appear here, even after it is disabled." /> : <>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-3 text-slate-600">
        <span>{asset.code}</span><span><b>{rows.length}</b> booking{rows.length === 1 ? '' : 's'} ({live.length} not cancelled)</span><span>{amount === 'supplier' ? 'Your total' : 'Total value'}: <b>{inr(total)}</b></span></div>
      <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 text-left"><tr><th className="px-3 py-2">Booking</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Campaign</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">{amount === 'supplier' ? 'Your rate' : 'Amount'}</th>{showCost && amount === 'customer' && <th className="px-3 py-2 text-right">Supplier cost</th>}</tr></thead>
        <tbody className="divide-y">{rows.map(b => <tr key={b.id}>
          <td className="px-3 py-2 font-medium whitespace-nowrap">{b.number}</td>
          <td className="px-3 py-2">{custName(db, b.customerId)}</td>
          <td className="px-3 py-2">{db.campaigns.find(c => c.id === b.campaignId)?.name || '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(b.start)} – {fmtDate(b.end)}</td>
          <td className="px-3 py-2"><Badge>{b.status}</Badge></td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{inr(amount === 'supplier' ? b.supplierCost : b.amount)}</td>
          {showCost && amount === 'customer' && <td className="px-3 py-2 text-right whitespace-nowrap text-rose-600">{inr(b.supplierCost)}</td>}</tr>)}</tbody></table></div></>)}
  </Modal>;
}
