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
import { registerPmtiles, overture, OVERTURE_SRC, OVERTURE_URL, HEIGHT_EXPR, BASE_EXPR } from '../services/buildings';
registerPmtiles();
import { ASSUMPTIONS } from '../model/model';
import { useT } from '../i18n/strings';
import { usePalette, type Palette } from '../theme';


function DeckOverlay({ layers }: { layers: Layer[] }) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: false, layers: [] }));
  overlay.setProps({ layers, onError: (e) => console.error('deck', e) });
  if (import.meta.env.DEV) (window as unknown as { __deck: unknown }).__deck = overlay;
  return null;
}

const widthColor = (P: Palette, w: number): [number, number, number] =>
  w < ASSUMPTIONS.fireTenderClear + 0.6 ? P.narrow : w < 5.5 ? P.tight : P.clear;
type Street = { geometry: { coordinates: number[][] }; properties: { width: number; bridge?: boolean; nh?: boolean } };

export default function CityMap() {
  const T = useT();
  const ref = useRef<MapRef>(null);
  const { city, area, point, areaStatus, set, setArea, toast } = useApp();
  const [t, setT] = useState(0);
  const P = usePalette();

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

  const addLayers = (force = false) => {
    const map = ref.current?.getMap(); if (!map || (!force && !map.isStyleLoaded())) return;
    if (import.meta.env.DEV) (window as unknown as { __map: unknown }).__map = map;
    // 3D buildings. OSM (OpenFreeMap) extrusions always load first as a safe fallback;
    // Overture footprints (denser) take over only once their tiles actually arrive.
    for (const id of ['c-3d-buildings', 'c-osm-buildings']) if (map.getLayer(id)) map.removeLayer(id);
    const omt = Object.keys(map.getStyle().sources).find((s) => s !== OVERTURE_SRC && (map.getStyle().sources[s] as { type: string }).type === 'vector') ?? 'openmaptiles';
    for (const l of map.getStyle().layers) if ((l as { 'source-layer'?: string })['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
    const osmH = ['coalesce', ['get', 'render_height'], 8] as never;
    map.addLayer({
      id: 'c-osm-buildings', type: 'fill-extrusion', source: omt, 'source-layer': 'building', minzoom: 13,
      layout: { visibility: overture.ok ? 'none' : 'visible' },
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], osmH, 0, P.buildingRamp[0], 15, P.buildingRamp[1], 40, P.buildingRamp[2]],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, osmH],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.95,
      },
    });
    try {
      if (!map.getSource(OVERTURE_SRC)) map.addSource(OVERTURE_SRC, { type: 'vector', url: OVERTURE_URL, attribution: '© Overture Maps Foundation' });
      map.addLayer({
        id: 'c-3d-buildings', type: 'fill-extrusion', source: OVERTURE_SRC, 'source-layer': 'building', minzoom: 13,
        filter: ['!=', ['get', 'is_underground'], true],
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT_EXPR as never, 0, P.buildingRamp[0], 15, P.buildingRamp[1], 40, P.buildingRamp[2]],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, HEIGHT_EXPR as never],
          'fill-extrusion-base': BASE_EXPR as never,
          'fill-extrusion-opacity': overture.ok ? 0.96 : 0, // invisible (but still loading) until tiles arrive
          'fill-extrusion-vertical-gradient': true,
        },
      });
    } catch (e) { console.warn('Overture buildings unavailable, using OSM', e); }
    if (!overture.ok) {
      const onData = (ev: { sourceId?: string; isSourceLoaded?: boolean }) => {
        if (ev.sourceId !== OVERTURE_SRC || !ev.isSourceLoaded) return;
        if (map.querySourceFeatures(OVERTURE_SRC, { sourceLayer: 'building' }).length === 0) return;
        overture.ok = true; map.off('sourcedata', onData);
        if (map.getLayer('c-3d-buildings')) map.setPaintProperty('c-3d-buildings', 'fill-extrusion-opacity', 0.96);
        if (map.getLayer('c-osm-buildings')) map.setLayoutProperty('c-osm-buildings', 'visibility', 'none');
      };
      map.on('sourcedata', onData);
    }
    map.setLight?.({ anchor: 'map', position: [1.4, 210, 40], intensity: 0.42, color: '#ffffff' });
    map.setSky?.({ 'sky-color': P.sky.sky, 'horizon-color': P.sky.horizon, 'fog-color': P.sky.fog, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.4 } as never);
  };
  // re-apply after theme (style) changes
  useEffect(() => {
    const map = ref.current?.getMap(); if (!map) return;
    const h = () => addLayers(true);
    map.on('style.load', h);
    if (map.isStyleLoaded()) addLayers();
    return () => { map.off('style.load', h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P]);

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
        stroked: true, filled: true, getFillColor: [...P.scan, areaStatus === 'loading' ? 40 * (1 - pulse) : 12], getLineColor: [...P.scan, areaStatus === 'loading' ? 255 * (1 - pulse) : 170], lineWidthMinPixels: 1.5,
        updateTriggers: { getRadius: t, getFillColor: t, getLineColor: t } }));
    }
    if (area) {
      const maxH = Math.max(12, ...area.buildings.map((b) => b.properties.height));
      L.push(new PolygonLayer({
        id: 'bld', data: area.buildings, extruded: true, wireframe: true, pickable: true,
        getPolygon: (f) => (f as typeof area.buildings[number]).geometry.coordinates as any,
        getElevation: (f) => (f as typeof area.buildings[number]).properties.height,
        getFillColor: (f) => { const k = (f as typeof area.buildings[number]).properties.height / maxH; return [0, 1, 2].map((c) => Math.round(P.bldLow[c] + (P.bldHigh[c] - P.bldLow[c]) * k)).concat(240) as [number, number, number, number]; },
        getLineColor: P.bldEdge, material: { ambient: 0.55, diffuse: 0.55, shininess: 20, specularColor: [40, 40, 40] },
        transitions: { getElevation: { duration: 1200, enter: () => [0] } },
      }));
      const ground = area.streets.filter((s) => !s.properties.bridge);
      const fly = area.streets.filter((s) => s.properties.bridge);
      const nh = area.streets.filter((s) => s.properties.nh && !s.properties.bridge);
      L.push(new PathLayer({ id: 'nh', data: nh, getPath: (f) => (f as Street).geometry.coordinates as any,
        getWidth: (f) => (f as Street).properties.width + 5, widthUnits: 'meters', getColor: [...P.nh, 70], capRounded: true, jointRounded: true }));
      L.push(new PathLayer({ id: 'streets-glow', data: ground, getPath: (f) => (f as typeof area.streets[number]).geometry.coordinates as any,
        getWidth: (f) => (f as typeof area.streets[number]).properties.width * 0.5 + 2.5, widthUnits: 'meters', getColor: (f) => [...widthColor(P, (f as typeof area.streets[number]).properties.width), 50], capRounded: true, jointRounded: true }));
      L.push(new PathLayer({ id: 'streets', data: ground, getPath: (f) => (f as typeof area.streets[number]).geometry.coordinates as any, pickable: true,
        getWidth: (f) => (f as typeof area.streets[number]).properties.width * 0.45, widthUnits: 'meters', widthMinPixels: 1.5, getColor: (f) => [...widthColor(P, (f as typeof area.streets[number]).properties.width), 230], capRounded: true, jointRounded: true }));
      L.push(new PathLayer({ id: 'drains', data: area.drains, getPath: (f) => (f as typeof area.drains[number]).geometry.coordinates as any, getWidth: 2, widthUnits: 'meters', widthMinPixels: 2,
        getColor: [...P.drain, 230] }));
      // flyovers drawn as raised decks (8 m) so they read as grade-separated
      L.push(new PathLayer({ id: 'flyover', data: fly, getPath: (f) => (f as Street).geometry.coordinates.map((c) => [c[0], c[1], 8]) as any,
        getWidth: (f) => Math.max(7, (f as Street).properties.width), widthUnits: 'meters', getColor: [...P.flyover, 235], capRounded: true, jointRounded: true, billboard: false }));
      const nearest = area.stations.map((s) => ({ s, km: turf.distance(turf.point(area.center), s) })).sort((a, b) => a.km - b.km)[0];
      if (nearest) {
        L.push(new ArcLayer({ id: 'arc', data: [nearest], getSourcePosition: (d) => (d as typeof nearest).s.geometry.coordinates as [number, number], getTargetPosition: () => area.center,
          getSourceColor: [...P.station, 255], getTargetColor: [...P.narrow, 255], getWidth: 3, getHeight: 0.25, greatCircle: false }));
        const p2 = ((t + 0.8) % 1.6) / 1.6;
        L.push(new ScatterplotLayer({ id: 'station', data: [nearest.s], getPosition: (d) => (d as typeof nearest.s).geometry.coordinates as [number, number], radiusUnits: 'pixels',
          getRadius: 6 + p2 * 18, getFillColor: [...P.station, 200 * (1 - p2)], stroked: true, getLineColor: [...P.station, 255], lineWidthMinPixels: 2, updateTriggers: { getRadius: t, getFillColor: t } }));
      }
    }
    return L;
  }, [area, point, areaStatus, t, P]);

  return (
    <Map
      ref={ref}
      initialViewState={{ longitude: city.lng, latitude: city.lat, zoom: 15.6, pitch: 62, bearing: -24 }}
      mapStyle={P.mapStyle}
      onLoad={() => addLayers(true)}
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
