import { useEffect, useRef, useState } from 'react';
import type { Asset } from '../types';
import { Card, cn } from './ui';
import { inr } from '../utils';

/** Set VITE_GOOGLE_MAPS_API_KEY in .env (see .env.example). Without a key the app falls back to the schematic map. */
export const GMAPS_KEY: string | undefined = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || undefined;

let loader: Promise<any> | null = null;
export function loadGoogleMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  if (!GMAPS_KEY) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    // Google calls this when the key is invalid / restricted / billing is off
    w.gm_authFailure = () => window.dispatchEvent(new Event('gmaps-auth-failed'));
    w.__oolaaGmapsReady = () => resolve(w.google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GMAPS_KEY)}&callback=__oolaaGmapsReady&v=weekly`;
    s.async = true; s.defer = true;
    s.onerror = () => { loader = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(s);
  });
  return loader;
}

const pin = (color: string, big: boolean) => {
  const w = big ? 40 : 32, h = big ? 50 : 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 40"><path d="M16 1C8 1 2 7 2 15c0 10 14 24 14 24s14-14 14-24C30 7 24 1 16 1z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="#fff"/></svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: { width: w, height: h }, anchor: { x: w / 2, y: h } };
};

export function GoogleMapView({ assets, onSelect, selected, onFail }: { assets: Asset[]; onSelect?: (a: Asset) => void; selected?: string; onFail: () => void }) {
  const cities = [...new Set(assets.map(a => a.city))];
  const [city, setCity] = useState(cities.includes('Chennai') ? 'Chennai' : cities[0]);
  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); const info = useRef<any>(null); const markers = useRef<Record<string, any>>({});
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const list = assets.filter(a => a.city === city);

  // keep selected city valid when the asset list changes (e.g. filters)
  useEffect(() => { if (!cities.includes(city) && cities.length) setCity(cities[0]); }, [cities.join('|')]);

  useEffect(() => {
    let dead = false;
    const fail = () => { if (!dead) onFail(); };
    window.addEventListener('gmaps-auth-failed', fail);
    loadGoogleMaps().then(g => {
      if (dead || !el.current) return;
      map.current = new g.Map(el.current, { center: { lat: 13.0827, lng: 80.2707 }, zoom: 11, mapTypeControl: false, streetViewControl: true, fullscreenControl: true, clickableIcons: false });
      info.current = new g.InfoWindow();
      setReady(true);
    }).catch(fail);
    return () => { dead = true; window.removeEventListener('gmaps-auth-failed', fail); };
  }, []);

  // (re)draw markers when city / assets change
  useEffect(() => {
    if (!ready || !map.current) return;
    const g = (window as any).google.maps;
    Object.values(markers.current).forEach((m: any) => m.setMap(null)); markers.current = {};
    const bounds = new g.LatLngBounds();
    list.forEach(a => {
      const m = new g.Marker({ position: { lat: a.lat, lng: a.lng }, map: map.current, title: a.name, icon: pin(a.availability === 'Available' ? '#f97316' : '#64748b', false) });
      m.addListener('click', () => {
        const box = document.createElement('div'); box.style.cssText = 'font:13px system-ui;max-width:220px';
        if (a.images[0]) { const im = document.createElement('img'); im.src = a.images[0]; im.style.cssText = 'width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:6px'; box.appendChild(im); }
        const t = document.createElement('b'); t.textContent = a.name; box.appendChild(t);
        const s = document.createElement('div'); s.style.cssText = 'color:#64748b;font-size:12px;margin:2px 0 6px'; s.textContent = `${a.location} · ${inr(a.rate)}/mo · ${a.availability}`; box.appendChild(s);
        const b = document.createElement('button'); b.textContent = 'View / select'; b.style.cssText = 'background:#f97316;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer';
        b.onclick = () => onSelectRef.current?.(a); box.appendChild(b);
        info.current.setContent(box); info.current.open({ map: map.current, anchor: m });
      });
      markers.current[a.id] = m; bounds.extend(m.getPosition());
    });
    info.current?.close();
    if (list.length === 1) { map.current.setCenter({ lat: list[0].lat, lng: list[0].lng }); map.current.setZoom(15); }
    else if (list.length > 1) map.current.fitBounds(bounds, 48);
  }, [ready, city, list.map(a => a.id + a.availability).join('|')]);

  // highlight hovered / selected marker
  useEffect(() => {
    list.forEach(a => { const m = markers.current[a.id]; if (!m) return; const on = hover === a.id || selected === a.id; m.setIcon(pin(a.availability === 'Available' ? '#f97316' : '#64748b', on)); m.setZIndex(on ? 999 : 1); });
  }, [hover, selected, ready, city]);

  const focus = (a: Asset) => { map.current?.panTo({ lat: a.lat, lng: a.lng }); markers.current[a.id] && (window as any).google.maps.event.trigger(markers.current[a.id], 'click'); };

  return <div className="grid lg:grid-cols-[1fr_320px] gap-4">
    <Card className="overflow-hidden">
      <div className="flex gap-1 p-2 border-b overflow-x-auto">{cities.map(c => <button key={c} onClick={() => setCity(c)} className={cn('px-3 py-1 rounded-full text-xs whitespace-nowrap', c === city ? 'bg-slate-900 text-white' : 'bg-slate-100')}>{c} ({assets.filter(a => a.city === c).length})</button>)}</div>
      <div className="relative aspect-[4/3] bg-slate-100">
        <div ref={el} className="absolute inset-0" />
        {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">Loading Google Maps…</div>}
      </div>
    </Card>
    <Card className="max-h-[520px] overflow-y-auto divide-y">{list.map(a => <button key={a.id} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} onClick={() => focus(a)} className={cn('w-full flex gap-3 p-3 text-left hover:bg-orange-50', selected === a.id && 'bg-orange-50')}><img src={a.images[0]} className="w-16 h-12 rounded object-cover" /><div className="min-w-0"><div className="text-sm font-medium truncate">{a.name}</div><div className="text-xs text-slate-500">{a.location} · {inr(a.rate)}/mo</div></div></button>)}
      {!list.length && <div className="p-6 text-sm text-slate-400 text-center">No sites to show on the map.</div>}</Card>
  </div>;
}
