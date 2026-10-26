import { useState, useMemo, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Bell, Menu, X, Search, LogOut, ChevronLeft, ChevronRight, Heart, MapPin, Users, LayoutDashboard, type LucideIcon } from 'lucide-react';
import * as I from 'lucide-react';
import { useDB, useSession, setSession, api } from '../services/storage.service';
import { can, type Perm, homeFor } from '../services/workflows';
import { cn, Button } from './ui';
import type { User, Notification } from '../types';

// ---------- shortlist (public + customer)
const SK = 'oolaa_shortlist'; let sl: string[] = (() => { try { return JSON.parse(localStorage.getItem(SK) || '[]'); } catch { return []; } })(); const sll = new Set<() => void>();
export const shortlist = { toggle(id: string) { sl = sl.includes(id) ? sl.filter(x => x !== id) : [...sl, id]; localStorage.setItem(SK, JSON.stringify(sl)); sll.forEach(l => l()); }, clear() { sl = []; localStorage.setItem(SK, '[]'); sll.forEach(l => l()); } };
export const useShortlist = () => useSyncExternalStore(cb => { sll.add(cb); return () => sll.delete(cb); }, () => sl);

export const Logo = ({ light }: { light?: boolean }) => <Link to="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight"><span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 grid place-items-center text-white text-sm shadow">O</span><span className={light ? 'text-white' : 'text-slate-900'}>oolaa<span className="text-orange-500">.in</span></span></Link>;
export const DemoBanner = () => <div className="bg-slate-900 text-slate-200 text-xs text-center px-3 py-1.5 print:hidden"><b className="text-orange-400">Oolaa Demo Environment</b> — Explore the complete outdoor advertising workflow using sample data. Data is stored locally in this browser only.</div>;

export function PublicLayout() {
  const user = useSession(); const s = useShortlist(); const [open, setOpen] = useState(false);
  const links = [['/explore', 'Explore Spaces'], ['/map', 'Map'], ['/plan', 'Plan Campaign'], ['/list-your-space', 'For Media Owners']];
  return <div className="min-h-screen flex flex-col bg-white">
    <DemoBanner />
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b"><div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
      <Logo />
      <nav className="hidden md:flex gap-6 text-sm text-slate-600">{links.map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => cn('hover:text-orange-600', isActive && 'text-orange-600 font-medium')}>{l}</NavLink>)}</nav>
      <div className="flex items-center gap-2">
        <Link to="/shortlist" className="relative p-2 rounded-lg hover:bg-slate-100"><Heart size={20} />{s.length > 0 && <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 grid place-items-center">{s.length}</span>}</Link>
        {user ? <Link to={homeFor(user)}><Button size="sm" variant="dark">My Workspace</Button></Link> : <Link to="/login"><Button size="sm">Demo Login</Button></Link>}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div></div>
      {open && <div className="md:hidden border-t px-4 py-2 flex flex-col">{links.map(([to, l]) => <Link key={to} onClick={() => setOpen(false)} to={to} className="py-2 text-sm">{l}</Link>)}</div>}
    </header>
    <main className="flex-1"><Outlet /></main>
    <footer className="bg-slate-950 text-slate-400 text-sm"><div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
      <div><Logo light /><p className="mt-3 text-xs leading-relaxed">Outdoor advertising marketplace & campaign management — demonstration build. All locations, companies and prices are fictional sample data.</p></div>
      <div><div className="text-white font-medium mb-2">Advertisers</div><Link className="block py-1 hover:text-white" to="/explore">Explore spaces</Link><Link className="block py-1 hover:text-white" to="/map">Inventory map</Link><Link className="block py-1 hover:text-white" to="/plan">Plan a campaign</Link></div>
      <div><div className="text-white font-medium mb-2">Media owners</div><Link className="block py-1 hover:text-white" to="/list-your-space">List your space</Link><Link className="block py-1 hover:text-white" to="/login">Owner portal</Link></div>
      <div><div className="text-white font-medium mb-2">Company</div><p className="text-xs">Oolaa.in (demo) · Chennai, Tamil Nadu<br />hello@oolaa.demo</p><Link className="block py-1 hover:text-white" to="/login">Command Centre</Link></div>
    </div><div className="text-center text-xs border-t border-slate-800 py-4">© {new Date().getFullYear()} Oolaa.in demo. Not a live marketplace.</div></footer>
  </div>;
}

type NavItem = { to: string; label: string; icon: keyof typeof I; perm?: Perm };
export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: 'LayoutDashboard' }, { to: '/admin/activity', label: 'Activity Feed', icon: 'Activity' }, { to: '/admin/intelligence', label: 'Demo Analytics', icon: 'Sparkles' }] },
  { group: 'Marketplace', items: [{ to: '/admin/inventory', label: 'Advertising Inventory', icon: 'Building2' }, { to: '/admin/owners', label: 'Media Owners', icon: 'Handshake' }, { to: '/admin/verification', label: 'Ownership Verification', icon: 'ShieldCheck', perm: 'verify' }, { to: '/admin/calendar', label: 'Availability Calendar', icon: 'CalendarDays' }, { to: '/admin/map', label: 'Inventory Map', icon: 'Map' }] },
  { group: 'Sales', items: [{ to: '/admin/customers', label: 'Customers', icon: 'Users', perm: 'sales' }, { to: '/admin/brands', label: 'Brands', icon: 'Tag', perm: 'sales' }, { to: '/admin/campaigns', label: 'Campaigns', icon: 'Megaphone' }, { to: '/admin/planning', label: 'Media Planning', icon: 'Route', perm: 'sales' }, { to: '/admin/quote-requests', label: 'Quotation Requests', icon: 'Inbox', perm: 'sales' }, { to: '/admin/quotations', label: 'Quotations', icon: 'FileText', perm: 'sales' }, { to: '/admin/bookings', label: 'Bookings', icon: 'BookmarkCheck' }, { to: '/admin/disputes', label: 'Disputes', icon: 'ShieldAlert', perm: 'disputes' }] },
  { group: 'Campaign Operations', items: [{ to: '/admin/artwork', label: 'Artwork', icon: 'Image', perm: 'ops' }, { to: '/admin/artwork-approvals', label: 'Artwork Approvals', icon: 'BadgeCheck', perm: 'ops' }, { to: '/admin/installations', label: 'Installation Tasks', icon: 'Wrench', perm: 'ops' }, { to: '/admin/proofs', label: 'Proof of Advertising', icon: 'Camera', perm: 'ops' }, { to: '/admin/campaign-reports', label: 'Campaign Reports', icon: 'ClipboardList' }] },
  { group: 'Finance', items: [{ to: '/admin/invoices', label: 'Customer Invoices', icon: 'Receipt', perm: 'finance' }, { to: '/admin/receipts', label: 'Customer Receipts', icon: 'Wallet', perm: 'finance' }, { to: '/admin/purchase-orders', label: 'Supplier POs', icon: 'ShoppingCart', perm: 'viewCosts' }, { to: '/admin/supplier-payments', label: 'Supplier Payments', icon: 'Banknote', perm: 'finance' }, { to: '/admin/refunds', label: 'Refunds', icon: 'Undo2', perm: 'finance' }, { to: '/admin/expenses', label: 'Expenses', icon: 'CreditCard', perm: 'finance' }, { to: '/admin/margins', label: 'Margin Reports', icon: 'TrendingUp', perm: 'viewCosts' }, { to: '/admin/reports', label: 'Reports & Analytics', icon: 'BarChart3' }] },
  { group: 'Administration', items: [{ to: '/admin/users', label: 'Users and Roles', icon: 'UserCog', perm: 'admin' }, { to: '/admin/categories', label: 'Categories', icon: 'Layers', perm: 'admin' }, { to: '/admin/workflows', label: 'Approval Workflows', icon: 'GitBranch', perm: 'admin' }, { to: '/admin/notifications', label: 'Notifications', icon: 'Bell' }, { to: '/admin/settings', label: 'Settings', icon: 'Settings', perm: 'admin' }, { to: '/admin/demo-data', label: 'Demo Data Management', icon: 'Database', perm: 'admin' }] },
];
export const CUSTOMER_NAV = [{ group: 'Advertiser', items: [{ to: '/customer', label: 'Dashboard', icon: 'LayoutDashboard' }, { to: '/customer/plan', label: 'Media Planning', icon: 'Route' }, { to: '/customer/campaigns', label: 'Campaigns', icon: 'Megaphone' }, { to: '/customer/quotations', label: 'Quotations', icon: 'FileText' }, { to: '/customer/bookings', label: 'Bookings', icon: 'BookmarkCheck' }, { to: '/customer/artwork', label: 'Artwork', icon: 'Image' }, { to: '/customer/reports', label: 'Campaign Reports', icon: 'ClipboardList' }, { to: '/customer/invoices', label: 'Invoices', icon: 'Receipt' }, { to: '/customer/disputes', label: 'Disputes', icon: 'ShieldAlert' }, { to: '/customer/account', label: 'Account & Brands', icon: 'Building' }, { to: '/customer/notifications', label: 'Notifications', icon: 'Bell' }] }] as { group: string; items: NavItem[] }[];
export const OWNER_NAV = [{ group: 'Media Owner', items: [{ to: '/owner', label: 'Dashboard', icon: 'LayoutDashboard' }, { to: '/owner/inventory', label: 'My Inventory', icon: 'Building2' }, { to: '/owner/calendar', label: 'Availability', icon: 'CalendarDays' }, { to: '/owner/orders', label: 'Purchase Orders', icon: 'ShoppingCart' }, { to: '/owner/proofs', label: 'Installation Proof', icon: 'Camera' }, { to: '/owner/disputes', label: 'Disputes', icon: 'ShieldAlert' }, { to: '/owner/profile', label: 'Registration & Profile', icon: 'IdCard' }, { to: '/owner/notifications', label: 'Notifications', icon: 'Bell' }] }] as { group: string; items: NavItem[] }[];

export const audienceFor = (u: User): Notification['audience'] => u.role === 'Customer' ? 'customer' : u.role === 'Media Owner' ? 'owner' : 'internal';
export const myNotifications = (list: Notification[], u: User) => list.filter(n => n.audience === audienceFor(u) && (n.audience === 'internal' || n.targetId === (u.customerId || u.ownerId)));

export function RequireRole({ area }: { area: 'admin' | 'customer' | 'owner' }) {
  const u = useSession();
  if (!u) return <Navigate to="/login" replace />;
  const ok = area === 'admin' ? can(u, 'internal') : area === 'customer' ? u.role === 'Customer' : u.role === 'Media Owner';
  if (!ok) return <Navigate to={homeFor(u)} replace />;
  const nav = area === 'admin' ? ADMIN_NAV : area === 'customer' ? CUSTOMER_NAV : OWNER_NAV;
  return <DashLayout nav={nav} area={area} user={u} />;
}

function DashLayout({ nav, area, user }: { nav: { group: string; items: NavItem[] }[]; area: string; user: User }) {
  const [collapsed, setCollapsed] = useState(false); const [mobile, setMobile] = useState(false); const [bell, setBell] = useState(false); const [q, setQ] = useState('');
  const loc = useLocation(); const nav2 = useNavigate(); const db = useDB();
  const notes = myNotifications(db.notifications, user); const unread = notes.filter(n => !n.read).length;
  const visible = nav.map(g => ({ ...g, items: g.items.filter(i => !i.perm || can(user, i.perm)) })).filter(g => g.items.length);
  const flat = visible.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));
  const current = [...flat].sort((a, b) => b.to.length - a.to.length).find(i => loc.pathname.startsWith(i.to));
  const results = useMemo(() => {
    if (q.length < 2) return [];
    const s = q.toLowerCase(); const out: { label: string; sub: string; to: string }[] = [];
    flat.filter(i => i.label.toLowerCase().includes(s)).forEach(i => out.push({ label: i.label, sub: 'Page', to: i.to }));
    if (area === 'admin') {
      db.assets.filter(a => (a.name + a.code + a.city).toLowerCase().includes(s)).slice(0, 5).forEach(a => out.push({ label: a.name, sub: 'Asset · ' + a.code, to: `/admin/inventory?id=${a.id}` }));
      db.campaigns.filter(c => c.name.toLowerCase().includes(s)).slice(0, 5).forEach(c => out.push({ label: c.name, sub: 'Campaign', to: `/admin/campaigns/${c.id}` }));
      db.customers.filter(c => c.company.toLowerCase().includes(s)).slice(0, 4).forEach(c => out.push({ label: c.company, sub: 'Customer', to: `/admin/customers` }));
      db.quotations.filter(c => c.number.toLowerCase().includes(s)).slice(0, 4).forEach(c => out.push({ label: c.number, sub: 'Quotation', to: `/admin/quotations/${c.id}` }));
      db.invoices.filter(c => c.number.toLowerCase().includes(s)).slice(0, 4).forEach(c => out.push({ label: c.number, sub: 'Invoice', to: `/admin/invoices/${c.id}` }));
    }
    return out.slice(0, 12);
  }, [q, db]);
  const switchTo = (email: string) => { const u = db.users.find(x => x.email === email); if (u) { setSession(u); nav2(homeFor(u)); } };
  const Side = <aside className={cn('bg-slate-950 text-slate-300 flex flex-col h-full transition-all', collapsed ? 'w-[72px]' : 'w-64')}>
    <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">{collapsed ? <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 grid place-items-center text-white text-sm font-bold">O</span> : <Logo light />}<button className="md:hidden" onClick={() => setMobile(false)}><X /></button></div>
    <div className="flex-1 overflow-y-auto py-3">{visible.map(g => <div key={g.group} className="mb-3">{!collapsed && <div className="px-4 text-[10px] uppercase tracking-wider text-slate-500 mb-1">{g.group}</div>}
      {g.items.map(i => { const Ic = (I as any)[i.icon] as LucideIcon || LayoutDashboard; return <NavLink key={i.to} to={i.to} end={i.to.split('/').length === 2} onClick={() => setMobile(false)} title={i.label} className={({ isActive }) => cn('flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 hover:text-white', isActive && 'bg-orange-500/15 text-orange-400')}><Ic size={18} className="shrink-0" />{!collapsed && <span className="truncate">{i.label}</span>}</NavLink>; })}</div>)}</div>
    <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex items-center justify-center h-10 border-t border-slate-800 hover:bg-slate-900">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
  </aside>;
  return <div className="min-h-screen flex flex-col bg-slate-50">
    <DemoBanner />
    <div className="flex flex-1 min-h-0">
      <div className="hidden md:block sticky top-0 h-screen print:hidden">{Side}</div>
      {mobile && <div className="fixed inset-0 z-50 md:hidden flex"><div className="h-full">{Side}</div><div className="flex-1 bg-black/40" onClick={() => setMobile(false)} /></div>}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b flex items-center gap-3 px-4 sticky top-0 z-30 print:hidden">
          <button className="md:hidden" onClick={() => setMobile(true)}><Menu /></button>
          <div className="hidden lg:block text-xs text-slate-400 whitespace-nowrap"><Link to="/" className="hover:text-slate-700">Oolaa</Link> / {area === 'admin' ? 'Command Centre' : area === 'customer' ? 'Customer Portal' : 'Media Owner Portal'} {current && <>/ <span className="text-slate-700">{current.label}</span></>}</div>
          <div className="relative flex-1 max-w-md ml-auto"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages, assets, campaigns…" className="w-full bg-slate-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            {results.length > 0 && <div className="absolute top-11 left-0 right-0 bg-white shadow-xl rounded-xl border max-h-80 overflow-y-auto z-50">{results.map((r, i) => <button key={i} onClick={() => { nav2(r.to); setQ(''); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"><div>{r.label}</div><div className="text-xs text-slate-400">{r.sub}</div></button>)}</div>}</div>
          <div className="relative"><button onClick={() => setBell(!bell)} className="relative p-2 rounded-lg hover:bg-slate-100"><Bell size={20} />{unread > 0 && <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 grid place-items-center">{unread}</span>}</button>
            {bell && <div className="absolute right-0 top-11 w-80 bg-white shadow-xl rounded-xl border z-50"><div className="flex justify-between items-center px-4 py-2 border-b"><b className="text-sm">Notifications</b><button className="text-xs text-orange-600" onClick={() => { notes.forEach(n => !n.read && api.update('notifications', n.id, { read: true }, '', true)); }}>Mark all read</button></div>
              <div className="max-h-80 overflow-y-auto">{notes.slice(0, 8).map(n => <button key={n.id} onClick={() => { api.update('notifications', n.id, { read: true }, '', true); setBell(false); nav2(n.link); }} className={cn('w-full text-left px-4 py-2.5 border-b hover:bg-slate-50', !n.read && 'bg-orange-50/50')}><div className="text-sm font-medium flex gap-2 items-center">{!n.read && <span className="w-2 h-2 rounded-full bg-orange-500" />}{n.title}</div><div className="text-xs text-slate-500">{n.body}</div></button>)}{!notes.length && <div className="p-6 text-center text-sm text-slate-400">No notifications</div>}</div>
              <Link onClick={() => setBell(false)} to={`/${area}/notifications`} className="block text-center text-xs py-2 text-orange-600">View all</Link></div>}</div>
          <div className="relative group"><button className="flex items-center gap-2 pl-2"><span className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 grid place-items-center text-sm font-bold">{user.name[0]}</span><span className="hidden sm:block text-left"><span className="block text-sm leading-tight">{user.name}</span><span className="block text-[11px] text-slate-400">{user.role}</span></span></button>
            <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border p-2 hidden group-hover:block group-focus-within:block z-50">
              <div className="text-[10px] uppercase text-slate-400 px-2 pt-1">Switch demo role</div>
              {['admin@oolaa.demo', 'operations@oolaa.demo', 'sales@oolaa.demo', 'finance@oolaa.demo', 'coordinator@oolaa.demo', 'owner@oolaa.demo', 'customer@oolaa.demo'].map(e => { const u = db.users.find(x => x.email === e); return u && <button key={e} onClick={() => switchTo(e)} className={cn('w-full text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100', u.id === user.id && 'text-orange-600')}>{u.role} <span className="text-xs text-slate-400">· {u.name}</span></button>; })}
              <hr className="my-1" /><Link to="/" className="flex gap-2 items-center text-sm px-2 py-1.5 rounded hover:bg-slate-100"><MapPin size={14} />Public website</Link>
              <button onClick={() => { setSession(null); nav2('/login'); }} className="w-full flex gap-2 items-center text-sm px-2 py-1.5 rounded hover:bg-slate-100 text-rose-600"><LogOut size={14} />Sign out</button>
            </div></div>
        </header>
        <main className="p-4 md:p-6 flex-1 min-w-0"><Outlet /></main>
      </div>
    </div>
  </div>;
}
export { Users };
