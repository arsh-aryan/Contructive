// City-scale 3D map: MapLibre (OpenFreeMap vector tiles, 3D buildings for every city)
// + deck.gl overlay for the analysed area (risk-coloured buildings, street widths,
// drains, fire-station arc, pulsing scan ring).
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { useControl, type MapRef } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PolygonLayer, PathLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import * as turf from '@turf/turf';
import { useApp } from '../store/useApp';
import { areaFromTiles } from '../services/tileArea';
import { ASSUMPTIONS } from '../model/model';
import { useT } from '../i18n/strings';

const STYLE = 'https://tiles.openfreemap.org/styles/dark';

function DeckOverlay({ layers }: { layers: Layer[] }) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: false, layers: [] }));
  overlay.setProps({ layers, onError: (e) => console.error('deck', e) });
  if (import.meta.env.DEV) (window as unknown as { __deck: unknown }).__deck = overlay;
  return null;
}

const widthColor = (w: number): [number, number, number] =>
  w < ASSUMPTIONS.fireTenderClear + 0.6 ? [242, 112, 90] : w < 5.5 ? [240, 180, 76] : [45, 212, 191];

export default function CityMap() {
  const T = useT();
  const ref = useRef<MapRef>(null);
  const { city, area, point, areaStatus, set, setArea, toast } = useApp();
  const [t, setT] = useState(0);

  // animation clock for pulses
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const loop = () => { setT((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fly to city
  useEffect(() => {
    ref.current?.flyTo({ center: [city.lng, city.lat], zoom: city.zoom ?? 15.6, pitch: 62, bearing: -24, duration: 3200, essential: true });
  }, [city]);

  // fly to analysed area
  useEffect(() => {
    if (area) ref.current?.flyTo({ center: area.center, zoom: 17.2, pitch: 66, bearing: -35, duration: 2200 });
  }, [area]);

  const onLoad = () => {
    const map = ref.current?.getMap(); if (!map) return;
    if (import.meta.env.DEV) (window as unknown as { __map: unknown }).__map = map;
    // 3D buildings from OpenMapTiles 'building' layer for every city
    if (!map.getLayer('c-3d-buildings')) {
      const src = Object.keys(map.getStyle().sources).find((s) => (map.getStyle().sources[s] as { type: string }).type === 'vector') ?? 'openmaptiles';
      map.addLayer({
        id: 'c-3d-buildings', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#24302f', 15, '#2e3d3c', 40, '#3d5250'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      });
    }
    map.setSky?.({ 'sky-color': '#0e1113', 'horizon-color': '#1d3a3a', 'fog-color': '#0e1113', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.4 } as never);
  };

  const onClick = async (e: { lngLat: { lng: number; lat: number } }) => {
    if (areaStatus === 'loading') return;
    const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    set({ point: p, areaStatus: 'loading', area: null });
    const map = ref.current?.getMap();
    await new Promise((r) => setTimeout(r, 900)); // let the scan ring play
    try {
      if (!map) throw new Error('map');
      setArea(areaFromTiles(map, p[1], p[0]));
    } catch (err) { console.error('area read failed', err); set({ areaStatus: 'error' }); toast(T.areaFailed); }
  };

  const layers = useMemo(() => {
    const L: Layer[] = [];
    if (point) {
      const pulse = (t % 1.6) / 1.6;
      L.push(new ScatterplotLayer({ id: 'scan', data: [point], getPosition: (d) => d, radiusUnits: 'meters', getRadius: areaStatus === 'loading' ? 40 + pulse * 260 : 250,
        stroked: true, filled: true, getFillColor: [45, 212, 191, areaStatus === 'loading' ? 40 * (1 - pulse) : 14], getLineColor: [45, 212, 191, areaStatus === 'loading' ? 255 * (1 - pulse) : 160], lineWidthMinPixels: 1.5,
        updateTriggers: { getRadius: t, getFillColor: t, getLineColor: t } }));
    }
    if (area) {
      const maxH = Math.max(12, ...area.buildings.map((b) => b.properties.height));
      L.push(new PolygonLayer({
        id: 'bld', data: area.buildings, extruded: true, wireframe: true, pickable: true,
        getPolygon: (f) => (f as typeof area.buildings[number]).geometry.coordinates as any,
        getElevation: (f) => (f as typeof area.buildings[number]).properties.height,
        getFillColor: (f) => { const k = (f as typeof area.buildings[number]).properties.height / maxH; return [Math.round(45 + 200 * k), Math.round(212 - 110 * k), Math.round(191 - 110 * k), 215]; },
        getLineColor: [255, 255, 255, 40], material: { ambient: 0.35, diffuse: 0.6, shininess: 40, specularColor: [60, 80, 80] },
        transitions: { getElevation: { duration: 1200, enter: () => [0] } },
      }));
      L.push(new PathLayer({ id: 'streets-glow', data: area.streets, getPath: (f) => (f as typeof area.streets[number]).geometry.coordinates as any,
        getWidth: (f) => (f as typeof area.streets[number]).properties.width * 0.5 + 2.5, widthUnits: 'meters', getColor: (f) => [...widthColor((f as typeof area.streets[number]).properties.width), 50], capRounded: true, jointRounded: true }));
      L.push(new PathLayer({ id: 'streets', data: area.streets, getPath: (f) => (f as typeof area.streets[number]).geometry.coordinates as any, pickable: true,
        getWidth: (f) => (f as typeof area.streets[number]).properties.width * 0.45, widthUnits: 'meters', widthMinPixels: 1.5, getColor: (f) => [...widthColor((f as typeof area.streets[number]).properties.width), 230], capRounded: true, jointRounded: true }));
      L.push(new PathLayer({ id: 'drains', data: area.drains, getPath: (f) => (f as typeof area.drains[number]).geometry.coordinates as any, getWidth: 2, widthUnits: 'meters', widthMinPixels: 2,
        getColor: [80, 160, 255, 230], getDashArray: [3, 2] }));
      const nearest = area.stations.map((s) => ({ s, km: turf.distance(turf.point(area.center), s) })).sort((a, b) => a.km - b.km)[0];
      if (nearest) {
        L.push(new ArcLayer({ id: 'arc', data: [nearest], getSourcePosition: (d) => (d as typeof nearest).s.geometry.coordinates as [number, number], getTargetPosition: () => area.center,
          getSourceColor: [255, 150, 60, 255], getTargetColor: [242, 80, 70, 255], getWidth: 3, getHeight: 0.25, greatCircle: false }));
        const p2 = ((t + 0.8) % 1.6) / 1.6;
        L.push(new ScatterplotLayer({ id: 'station', data: [nearest.s], getPosition: (d) => (d as typeof nearest.s).geometry.coordinates as [number, number], radiusUnits: 'pixels',
          getRadius: 6 + p2 * 18, getFillColor: [255, 150, 60, 255 * (1 - p2)], stroked: true, getLineColor: [255, 150, 60, 255], lineWidthMinPixels: 2, updateTriggers: { getRadius: t, getFillColor: t } }));
      }
    }
    return L;
  }, [area, point, areaStatus, t]);

  return (
    <Map
      ref={ref}
      initialViewState={{ longitude: city.lng, latitude: city.lat, zoom: 15.6, pitch: 62, bearing: -24 }}
      mapStyle={STYLE}
      onLoad={onLoad}
      onClick={onClick}
      maxPitch={80}
      minZoom={10}
      cursor={areaStatus === 'loading' ? 'progress' : 'crosshair'}
      attributionControl={{ compact: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <DeckOverlay layers={layers} />
    </Map>
  );
}
