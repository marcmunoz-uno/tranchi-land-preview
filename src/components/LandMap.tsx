import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, AttributionControl, LngLatBounds } from 'maplibre-gl';
import { Layers, LocateFixed } from 'lucide-react';
import type { LandRecord } from '../types';
import { acresLabel, addressLabel } from '../lib/analysis';

const STREET_STYLE = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 19 }],
};
const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    esri: { type: 'raster' as const, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri', minzoom: 0, maxzoom: 19 }],
};

export function LandMap({ records, selectedId, onSelect }: { records: LandRecord[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [satellite, setSatellite] = useState(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const instance = new MapLibreMap({
        container: container.current,
        style: STREET_STYLE,
        center: [-81.62, 41.48],
        zoom: 10,
        cooperativeGestures: true,
        attributionControl: false,
      });
      instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
      instance.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      instance.on('load', () => { setReady(true); instance.resize(); });
      instance.on('error', (event) => {
        if (!ready && event.error) setFailed(true);
      });
      map.current = instance;
      const observer = new ResizeObserver(() => instance.resize());
      observer.observe(container.current);
      return () => { observer.disconnect(); instance.remove(); map.current = null; };
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!map.current || !ready) return;
    map.current.setStyle(satellite ? SATELLITE_STYLE : STREET_STYLE);
  }, [satellite, ready]);

  useEffect(() => {
    if (!map.current || !ready) return;
    markers.current.forEach(marker => marker.remove());
    markers.current = records.map(record => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `land-marker${record.id === selectedId ? ' is-selected' : ''}`;
      element.textContent = record.id === selectedId ? acresLabel(record.lot.acres) : '';
      element.title = `${addressLabel(record)} · ${acresLabel(record.lot.acres)}`;
      element.setAttribute('aria-label', `Select ${addressLabel(record)}, ${acresLabel(record.lot.acres)}`);
      element.addEventListener('click', event => { event.stopPropagation(); onSelect(record.id); });
      return new Marker({ element, anchor: 'center' }).setLngLat([record.address.lng, record.address.lat]).addTo(map.current!);
    });
    return () => { markers.current.forEach(marker => marker.remove()); markers.current = []; };
  }, [records, selectedId, ready, onSelect]);

  useEffect(() => {
    if (!map.current || !ready || !records.length) return;
    const bounds = new LngLatBounds();
    records.forEach(record => bounds.extend([record.address.lng, record.address.lat]));
    map.current.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 400 });
  }, [records.map(record => record.id).join('|'), ready]);

  const showAll = () => {
    if (!map.current || !records.length) return;
    const bounds = new LngLatBounds();
    records.forEach(record => bounds.extend([record.address.lng, record.address.lat]));
    map.current.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 400 });
  };

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <div className="segmented-control" aria-label="Map imagery">
          <button className={!satellite ? 'active' : ''} onClick={() => setSatellite(false)}>Street</button>
          <button className={satellite ? 'active' : ''} onClick={() => setSatellite(true)}>Satellite</button>
        </div>
        <button className="icon-button map-fit" onClick={showAll} title="Show all filtered parcels" aria-label="Show all filtered parcels"><LocateFixed size={17} /></button>
        <span className="map-layer-note"><Layers size={14} /> Points, not parcel boundaries</span>
      </div>
      <div ref={container} className="map-canvas" aria-label="Map of filtered land parcels" />
      {!ready && !failed && <div className="map-state">Loading map tiles…</div>}
      {failed && <div className="map-state map-error">Map tiles could not load. The parcel list and analysis still work.</div>}
    </div>
  );
}
