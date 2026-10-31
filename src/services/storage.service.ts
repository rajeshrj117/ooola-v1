import { useSyncExternalStore } from 'react';
import type { DB, CollectionKey, User, Notification } from '../types';
import { buildSeed, SCHEMA_VERSION } from '../data/seed-data';
import { uid } from '../utils';

const KEY = 'oolaa_demo_db_v1';
const SESSION = 'oolaa_demo_session';
let db: DB;
const listeners = new Set<() => void>();

const REQUIRED: CollectionKey[] = ['categories', 'assets', 'owners', 'customers', 'brands', 'campaigns', 'quotations', 'bookings', 'artworks', 'installations', 'proofs', 'purchaseOrders', 'invoices', 'receipts', 'supplierPayments', 'expenses', 'refunds', 'disputes', 'users', 'notifications', 'audit'];
export function isValidDB(x: any): x is DB {
  if (!x || typeof x !== 'object') return false;
  // Migrate older browser demo data without discarding existing bookings or invoices.
  if (x.schemaVersion === 1 && !Array.isArray(x.disputes)) x.disputes = [];
  if (x.schemaVersion === 1 || x.schemaVersion === 2) {
    if (!Array.isArray(x.disputes)) x.disputes = [];
    if (Array.isArray(x.users)) {
      const seededOwners = buildSeed().users.filter(u => u.role === 'Media Owner' && u.ownerId);
      const emails = new Set(x.users.map((u: User) => u.email));
      seededOwners.filter(u => !emails.has(u.email)).forEach(u => x.users.push(u));
    }
    x.schemaVersion = SCHEMA_VERSION;
  }
  return x.schemaVersion === SCHEMA_VERSION && x.settings && REQUIRED.every(k => Array.isArray(x[k]));
}
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const parsed = JSON.parse(raw); if (isValidDB(parsed)) return parsed; console.warn('Stored demo data invalid; reseeding'); }
  } catch { console.warn('Corrupted demo data; reseeding'); }
  const s = buildSeed(); persist(s); return s;
}
function persist(d: DB) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.error('localStorage full', e); alert('Browser storage is full. Some changes may not persist. Consider removing large uploaded files.'); } }
db = load();
function emit() { persist(db); listeners.forEach(l => l()); }

export const getDB = () => db;
export function useDB<T = DB>(sel?: (d: DB) => T): T { const d = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => db); return sel ? sel(d) : (d as any); }

// ------- session / auth (demo only)
export function getSession(): User | null { try { const id = localStorage.getItem(SESSION); return db.users.find(u => u.id === id) || null; } catch { return null; } }
const sessListeners = new Set<() => void>();
let sessVersion = 0;
export function setSession(u: User | null) { if (u) localStorage.setItem(SESSION, u.id); else localStorage.removeItem(SESSION); sessVersion++; sessListeners.forEach(l => l()); }
export function useSession() { useSyncExternalStore(cb => { sessListeners.add(cb); return () => sessListeners.delete(cb); }, () => sessVersion); useDB(); return getSession(); }

const delay = (ms = 180) => new Promise(r => setTimeout(r, ms));

export function audit(action: string, entity: string, entityId: string, summary: string) {
  const u = getSession();
  db = { ...db, audit: [{ id: uid('aud'), at: new Date().toISOString(), user: u ? `${u.name} (${u.role})` : 'Public visitor', action, entity, entityId, summary }, ...db.audit].slice(0, 1000) };
}
export function notify(n: Omit<Notification, 'id' | 'read' | 'at'>) {
  db = { ...db, notifications: [{ ...n, id: uid('ntf'), read: false, at: new Date().toISOString() }, ...db.notifications] };
}

/** Mutations apply immediately (optimistic) and resolve after simulated latency. */
export const api = {
  async list<K extends CollectionKey>(k: K): Promise<DB[K]> { await delay(); return db[k]; },
  async create<K extends CollectionKey>(k: K, data: any, prefix = k.slice(0, 3), summary?: string): Promise<any> {
    const rec = { ...data, id: data.id || uid(prefix) };
    db = { ...db, [k]: [rec, ...(db[k] as any[])] };
    audit('Created', k, rec.id, summary || `${k} record created`); emit(); await delay(); return rec;
  },
  async update<K extends CollectionKey>(k: K, id: string, patch: any, summary?: string, silent = false): Promise<any> {
    let out: any;
    db = { ...db, [k]: (db[k] as any[]).map(r => r.id === id ? (out = { ...r, ...patch }) : r) };
    if (!silent) audit('Updated', k, id, summary || `${k} record updated`); emit(); await delay(); return out;
  },
  async remove<K extends CollectionKey>(k: K, id: string, summary?: string) {
    db = { ...db, [k]: (db[k] as any[]).filter(r => r.id !== id) };
    audit('Deleted', k, id, summary || `${k} record deleted`); emit(); await delay();
  },
  async settings(patch: Partial<DB['settings']>) { db = { ...db, settings: { ...db.settings, ...patch } }; audit('Settings changed', 'settings', '-', Object.keys(patch).join(', ') + ' updated'); emit(); await delay(); },
  /** run a multi-step transaction against a draft db */
  async tx(fn: (d: DB) => DB | void) { const draft = structuredClone(db); const res = fn(draft); db = (res as DB) || draft; emit(); await delay(); },
  commit() { emit(); },
  reset() { db = buildSeed(); emit(); },
  replace(next: DB) { db = next; audit('Imported', 'Demo', '-', 'Dataset imported from JSON'); emit(); },
};

// convenient service aliases (as per spec)
export const getAssets = () => api.list('assets');
export const createAsset = (d: any) => api.create('assets', d, 'ast', `Asset "${d.name}" created`);
export const updateAsset = (id: string, d: any) => api.update('assets', id, d, `Asset updated`);
export const deleteAsset = (id: string) => api.remove('assets', id, 'Asset deleted');
export const getCampaigns = () => api.list('campaigns');
export const createCampaign = (d: any) => api.create('campaigns', d, 'cmp', `Campaign "${d.name}" created`);
export const updateCampaign = (id: string, d: any) => api.update('campaigns', id, d);
export const deleteCampaign = (id: string) => api.remove('campaigns', id);

// ------- IndexedDB for binary files
const IDB = 'oolaa_files';
function idb(): Promise<IDBDatabase> { return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function saveFile(file: Blob): Promise<string> { const key = uid('file'); const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(file, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); return key; }
export async function getFile(key: string): Promise<Blob | undefined> { const d = await idb(); return new Promise((res) => { const r = d.transaction('files').objectStore('files').get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); }); }
export async function fileToThumb(file: File, max = 480): Promise<string> {
  if (!file.type.startsWith('image/')) return '';
  const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode().catch(() => null);
  const c = document.createElement('canvas'); const s = Math.min(1, max / Math.max(img.width || 1, img.height || 1)); c.width = (img.width || 1) * s; c.height = (img.height || 1) * s;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', 0.7);
}
