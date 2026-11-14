import { Camera, ExternalLink } from 'lucide-react';

export function StreetViewPanel({ street, city, state, zip, lat, lng }: {
  street: string;
  city: string;
  state: string;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const address = [street, city, state, zip].filter(Boolean).join(', ');
  const query = encodeURIComponent(address);
  const params = new URLSearchParams({ q: address, layer: 'c', cbp: '12,0,0,0,0', output: 'svembed' });
  if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
    params.set('cbll', `${lat},${lng}`);
  }
  const src = `https://maps.google.com/maps?${params.toString()}`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return <section className="street-view-panel" aria-label={`Google Street View for ${address}`}>
    <div className="section-heading"><h3><Camera size={15} /> Google Street View</h3><a href={openUrl} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a></div>
    <iframe title={`Google Street View of ${address}`} src={src} loading="lazy" allowFullScreen referrerPolicy="no-referrer" />
    <p className="section-note">External Google imagery. Coverage and capture date vary; it may not show the current house. Verify the property in person before making an offer.</p>
  </section>;
}
