// Renders the real analysed area (OSM footprints + streets) in 3D, with the
// proposed works applied to the real geometry.
import { useFrame } from '@react-three/fiber';
import { Html, Instances, Instance } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ASSUMPTIONS as A, clearWidth, floodDepth, type Levers } from '../model/model';
import type { Scenario } from '../store/useApp';
import { pointAt, sampleLine, type StudyGeometry, type XZ } from './geometry';
import { usePalette } from '../theme';

// Facade texture: one floor (3.2 m) tall, 3 m wide bay, window + slab band.
let facadeTex: THREE.CanvasTexture | null = null;
function facade() {
  if (facadeTex) return facadeTex;
  const c = document.createElement('canvas'); c.width = 96; c.height = 102; const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 96, 102);
  x.fillStyle = '#d9d4cc'; x.fillRect(0, 92, 96, 10);            // floor slab band
  x.fillStyle = '#3c4654'; x.fillRect(22, 26, 52, 50);            // window
  x.fillStyle = '#6d7a8a'; x.fillRect(22, 26, 52, 8);             // chajja shadow / lintel
  x.fillStyle = '#c9c2b6'; x.fillRect(46, 34, 4, 42);             // mullion
  facadeTex = new THREE.CanvasTexture(c);
  facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
  facadeTex.repeat.set(1 / 3, 1 / 3.2); facadeTex.anisotropy = 8; facadeTex.colorSpace = THREE.SRGBColorSpace;
  return facadeTex;
}
// Indian roofs: parapet + black water tank on a share of buildings.
const rnd = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

const FACADES = ['#e9dcc4', '#f1c9a5', '#d9e3d0', '#efe3a8', '#e7c7c7', '#cfdbe6', '#f3efe8'];
function Building({ ring, height, color, id, varied }: { ring: XZ[]; height: number; color: string; id: number; varied: boolean }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shapeOf(ring), { depth: height, bevelEnabled: false }), [ring, height]);
  const parapet = useMemo(() => {
    const sh = shapeOf(ring); const hole = new THREE.Path(); // inset ring for the parapet hole
    const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cz = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    ring.forEach(([x, z], i) => { const ix = cx + (x - cx) * 0.92, iz = cz + (z - cz) * 0.92; if (i) hole.lineTo(ix, -iz); else hole.moveTo(ix, -iz); });
    sh.holes.push(hole);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false });
  }, [ring]);
  useEffect(() => () => { geo.dispose(); parapet.dispose(); }, [geo, parapet]);
  const tank = rnd(id) < 0.45 && height > 5 && ring.length > 3;
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cz = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const tint = useMemo(() => new THREE.Color(color).lerp(new THREE.Color(FACADES[Math.floor(rnd(id + 11) * FACADES.length)]), varied ? 0.45 : 0).offsetHSL((rnd(id + 7) - 0.5) * 0.04, (rnd(id + 3) - 0.5) * 0.12, (rnd(id + 5) - 0.5) * 0.1), [color, id, varied]);
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial attach="material-0" color={tint} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={tint} map={height >= 4 ? facade() : null} roughness={0.8} />
      </mesh>
      <mesh geometry={parapet} rotation={[-Math.PI / 2, 0, 0]} position={[0, height, 0]} castShadow>
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      {tank && <mesh position={[cx + (rnd(id + 1) - 0.5) * 2, height + 1.1, cz + (rnd(id + 2) - 0.5) * 2]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 1.5, 14]} /><meshStandardMaterial color="#1c1c1f" roughness={0.6} />
      </mesh>}
    </group>
  );
}

const shapeOf = (ring: XZ[]) => new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));

function Extruded({ ring, height, color, opacity = 1, emissive, y = 0 }: { ring: XZ[]; height: number; color: string; opacity?: number; emissive?: string; y?: number }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shapeOf(ring), { depth: height, bevelEnabled: false }), [ring, height]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} castShadow={opacity === 1} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity < 1} opacity={opacity} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 0.6 : 0} depthWrite={opacity === 1} />
    </mesh>
  );
}

function Flat({ ring, color, y, emissive }: { ring: XZ[]; color: string; y: number; emissive?: string }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shapeOf(ring)), [ring]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
    <meshStandardMaterial color={color} roughness={0.95} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 0.35 : 0} />
  </mesh>;
}

/** Offset a sampled point sideways from the lane centreline. */
const side = (s: { p: XZ; dir: XZ }, off: number): XZ => [s.p[0] - s.dir[1] * off, s.p[1] + s.dir[0] * off];

interface Props { g: StudyGeometry; L: Levers; isPlan: boolean; scenario: Scenario; labels: { call: string; blocked: string; through: string } }

export default function RealArea({ g, L, isPlan, scenario, labels }: Props) {
  const S = usePalette().scene;
  const group = useRef<THREE.Group>(null);
  const grow = useRef(0);
  useEffect(() => { grow.current = 0; }, [g]);

  const samples = useMemo(() => g.laneSegments.flatMap((seg) => (seg.length > 1 ? sampleLine(seg, 7) : [])), [g.laneSegments]);
  const half = L.width / 2;
  const blocked = clearWidth(L) < A.fireTenderClear;

  // Fire tender along the real lane: stops at the lane entry when blocked.
  const tender = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const dist = useRef(-30);
  const stopAt = blocked ? 2 : Math.max(10, g.laneLength * 0.6);
  useEffect(() => { dist.current = -30; }, [scenario, blocked, g]);

  useFrame((st, dt) => {
    if (group.current && grow.current < 1) { grow.current = Math.min(1, grow.current + dt * 1.6); group.current.scale.y = 0.02 + 0.98 * (1 - Math.pow(1 - grow.current, 3)); }
    if (tender.current && g.lane.length > 1) {
      if (dist.current < stopAt) dist.current = Math.min(stopAt, dist.current + dt * 14);
      // approach from outside: extend before the first vertex
      const d = dist.current;
      if (d < 0) {
        const { angle } = pointAt(g.lane, 0); const [x0, z0] = g.lane[0];
        tender.current.position.set(x0 - Math.cos(angle) * -d, 0, z0 + Math.sin(angle) * -d);
        tender.current.rotation.y = angle;
      } else {
        const { p, angle } = pointAt(g.lane, d);
        tender.current.position.set(p[0], 0, p[1]); tender.current.rotation.y = angle;
      }
    }
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(st.clock.elapsedTime * 12) > 0 ? 8 : 0.4;
  });

  return (
    <group>
      {/* site disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[g.radius + 30, 64]} /><meshStandardMaterial color={S.disc} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[g.radius - 0.8, g.radius, 96]} /><meshBasicMaterial color={S.ring} transparent opacity={0.5} />
      </mesh>

      {/* streets (real widths), studied lane highlighted */}
      {g.streets.map((s, i) => (
        s.bridge ? null : <Flat key={i} ring={s.ring} y={s.isStudy ? 0.07 : 0.05} color={s.isStudy ? (isPlan ? S.lanePlan : S.laneToday) : s.nh ? S.nh : S.street} />
      ))}
      {g.newCorridors.map((r, i) => <Flat key={`row${i}`} ring={r} y={0.09} color={S.row} />)}
      {/* flyovers: raised decks on pillars (grade-separated, untouched by ground works) */}
      {g.streets.filter((s) => s.bridge).map((s, i) => (
        <group key={`fly${i}`}>
          <Extruded ring={s.ring} height={0.9} y={7.2} color={S.flyover} />
          {sampleLine(s.line, 18).map((p, j) => (
            <mesh key={j} position={[p.p[0], 3.6, p.p[1]]} castShadow><cylinderGeometry args={[0.7, 0.8, 7.2, 12]} /><meshStandardMaterial color={S.pillar} roughness={0.7} /></mesh>
          ))}
        </group>
      ))}

      <group ref={group}>
        {/* real buildings */}
        {g.buildings.filter((b) => b.ring.length > 2).map((b) => (
          <Building key={b.id} id={b.id} ring={b.ring} height={Math.max(3, b.height)} varied={!(isPlan && (b.capped || b.affected))}
            color={isPlan && (b.capped || b.affected) ? S.bldChanged : b.estimated ? S.bldEst : S.bld} />
        ))}
        {/* parts removed by the setback, shown as red ghosts */}
        {isPlan && g.buildings.flatMap((b) => b.cut.map((r, j) => (
          <Extruded key={`${b.id}-cut-${j}`} ring={r} height={Math.max(3, b.baseHeight)} color={S.cut} opacity={0.35} />
        )))}
        {/* height cap: ghost of the removed upper floors */}
        {isPlan && g.buildings.filter((b) => b.capped && b.ring.length > 2).map((b) => (
          <Extruded key={`${b.id}-cap`} ring={b.ring} height={b.baseHeight - b.height} y={b.height} color={S.cap} opacity={0.25} />
        ))}
        {/* rooftop solar */}
        {isPlan && L.solar && g.buildings.filter((b) => b.ring.length > 2).slice(0, 120).map((b) => {
          const cx = b.ring.reduce((a, p) => a + p[0], 0) / b.ring.length, cz = b.ring.reduce((a, p) => a + p[1], 0) / b.ring.length;
          return <mesh key={`${b.id}-pv`} position={[cx, b.height + 0.3, cz]} rotation={[-0.3, 0, 0]}><boxGeometry args={[3, 0.1, 2]} /><meshStandardMaterial color="#1d3557" metalness={0.8} roughness={0.25} /></mesh>;
        })}
      </group>

      {/* encroaching stalls along the real lane */}
      {L.encroach > 0 && samples.length > 0 && (
        <Instances limit={400} castShadow><boxGeometry args={[1.6, 1.1, 1]} /><meshStandardMaterial color="#c98a4b" />
          {samples.map((s, i) => { const [x, z] = side(s, (i % 2 ? 1 : -1) * (half - L.encroach / 2)); return <Instance key={i} position={[x, 0.55, z]} rotation={[0, Math.atan2(-s.dir[1], s.dir[0]), 0]} />; })}
        </Instances>
      )}
      {L.encroach > 0 && samples.length > 0 && (
        <Instances limit={400}><boxGeometry args={[2, 0.06, 1.6]} /><meshStandardMaterial color="#3f6e9a" />
          {samples.map((s, i) => { const [x, z] = side(s, (i % 2 ? 1 : -1) * (half - L.encroach / 2)); return <Instance key={i} position={[x, 2.1, z]} rotation={[0, Math.atan2(-s.dir[1], s.dir[0]), 0]} />; })}
        </Instances>
      )}
      {/* designated vending zone */}
      {isPlan && L.vendor && samples.length > 0 && (
        <Instances limit={400}><boxGeometry args={[1.4, 0.9, 1.1]} /><meshStandardMaterial color="#c98a4b" emissive={S.ring} emissiveIntensity={0.1} />
          {samples.filter((_, i) => i % 2 === 0).map((s, i) => { const [x, z] = side(s, half - 0.75); return <Instance key={i} position={[x, 0.5, z]} rotation={[0, Math.atan2(-s.dir[1], s.dir[0]), 0]} />; })}
        </Instances>
      )}
      {/* drain along one edge of the lane */}
      {samples.length > 0 && (
        <Instances limit={400}><boxGeometry args={[6.6, L.drain ? 0.18 : 0.04, 0.8]} /><meshStandardMaterial color={L.drain ? S.drainSlab : S.drainOpen} roughness={L.drain ? 0.9 : 0.15} metalness={L.drain ? 0 : 0.5} />
          {samples.map((s, i) => { const [x, z] = side(s, -(half - 0.4)); return <Instance key={i} position={[x, 0.12, z]} rotation={[0, Math.atan2(-s.dir[1], s.dir[0]), 0]} />; })}
        </Instances>
      )}
      {/* street trees along the lane */}
      {isPlan && L.green >= 10 && samples.length > 0 && <>
        <Instances limit={400}><icosahedronGeometry args={[1.7, 1]} /><meshStandardMaterial color="#4f8a55" flatShading />
          {samples.filter((_, i) => i % (L.green >= 22 ? 1 : 2) === 0).map((s, i) => { const [x, z] = side(s, (i % 2 ? 1 : -1) * (half + 0.6)); return <Instance key={i} position={[x, 3.6, z]} />; })}
        </Instances>
        <Instances limit={400}><cylinderGeometry args={[0.15, 0.22, 2.6]} /><meshStandardMaterial color="#6a4b32" />
          {samples.filter((_, i) => i % (L.green >= 22 ? 1 : 2) === 0).map((s, i) => { const [x, z] = side(s, (i % 2 ? 1 : -1) * (half + 0.6)); return <Instance key={i} position={[x, 1.3, z]} />; })}
        </Instances>
      </>}
      {/* shade canopy */}
      {isPlan && L.shade && samples.length > 0 && (
        <Instances limit={400}><boxGeometry args={[6.4, 0.08, 1.8]} /><meshPhysicalMaterial color="#ffffff" transmission={0.5} roughness={0.3} />
          {samples.map((s, i) => { const [x, z] = side(s, half - 0.9); return <Instance key={i} position={[x, 3.4, z]} rotation={[0, Math.atan2(-s.dir[1], s.dir[0]), 0]} />; })}
        </Instances>
      )}

      {/* lane label */}
      {g.lane.length > 1 && (() => { const m = pointAt(g.lane, g.laneLength / 2).p; return (
        <Html position={[m[0], 14, m[1]]} center><div className={`whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isPlan ? 'bg-white text-accent-text border-accent/40' : 'bg-white text-fail border-fail/40'}`}>
          {g.laneName} · {L.width.toFixed(1)} m · clear {clearWidth(L).toFixed(1)} m</div></Html>); })()}

      {scenario === 'fire' && g.lane.length > 1 && (
        <group ref={tender}>
          <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[7, 2.8, 2.5]} /><meshStandardMaterial color="#c0392b" metalness={0.3} roughness={0.4} /></mesh>
          <mesh position={[0, 3.1, 0]}><boxGeometry args={[6, 0.2, 0.6]} /><meshStandardMaterial color="#ddd" metalness={0.8} /></mesh>
          <mesh position={[2.6, 3.15, 0]}><boxGeometry args={[0.6, 0.3, 1.6]} /><meshStandardMaterial ref={beacon} color="#3a7bff" emissive="#3a7bff" emissiveIntensity={6} /></mesh>
          <Html position={[0, 7, 0]} center><div className={`whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full text-white ${blocked ? 'bg-fail' : 'bg-ok'}`}>{blocked ? labels.blocked : labels.through}</div></Html>
        </group>
      )}
      {scenario === 'monsoon' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floodDepth(L) + 0.05, 0]}>
          <circleGeometry args={[g.radius + 30, 64]} />
          <meshPhysicalMaterial color="#3d6f99" transparent opacity={0.7} roughness={0.08} clearcoat={1} />
        </mesh>
      )}
    </group>
  );
}
