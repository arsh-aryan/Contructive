// Detailed street study: React Three Fiber + postprocessing (AO, bloom, vignette).
// A representative 120 m section driven by the area's levers. No network assets.
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, ContactShadows, Environment, Html, Lightformer, Sky, Instances, Instance } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, Vignette, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ASSUMPTIONS as A, clearWidth, footpathWidth, floodDepth, treeCount, type Levers } from '../model/model';
import type { Scenario } from '../store/useApp';

const C = {
  ground: '#1a2124', road: '#3a4246', foot: '#56615f', bld: '#d9d4ca', bldOld: '#bdb3a2', cracked: '#7d7a74',
  accent: '#2dd4bf', stall: '#c98a4b', tarp: '#3f6e9a', drain: '#141617', slab: '#8f8a80', tree: '#4f8a55', trunk: '#6a4b32',
};

function rng(seed: number) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

interface Props { L: Levers; isPlan: boolean; scenario: Scenario; labels: { call: string; blocked: string; through: string } }

function Lane({ L, isPlan, scenario, labels }: Props) {
  const len = A.corridorLength, half = len / 2, fp = footpathWidth(L), roadHalf = L.width / 2;
  const group = useRef<THREE.Group>(null);
  const grow = useRef(0);
  useEffect(() => { grow.current = 0; }, [L, isPlan]);

  const plots = useMemo(() => {
    const r = rng(7), out: { x: number; s: number; floors: number; today: number; cracked: boolean; tone: number; tank: boolean }[] = [];
    for (const s of [-1, 1]) for (let i = 0; i < A.plotsPerSide; i++) {
      const today = 3 + Math.floor(r() * 4), cracked = r() < 0.3, tone = r(), tank = r() < 0.6;
      out.push({ x: -half + A.plotFrontage * (i + 0.5), s, today, floors: isPlan ? Math.min(today, L.floors) : today, cracked, tone, tank });
    }
    return out;
  }, [L.floors, isPlan, half]);

  const tender = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const bus = useRef<THREE.Mesh>(null);
  const blocked = clearWidth(L) < A.fireTenderClear;
  const stop = blocked ? -half + 3 : 0;
  useEffect(() => { if (tender.current) tender.current.position.x = -half - 24; }, [scenario, blocked, half]);

  useFrame((st, dt) => {
    if (group.current && grow.current < 1) { grow.current = Math.min(1, grow.current + dt * 1.8); group.current.scale.y = 0.02 + 0.98 * (1 - Math.pow(1 - grow.current, 3)); }
    if (tender.current && tender.current.position.x < stop) tender.current.position.x = Math.min(stop, tender.current.position.x + dt * 16);
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(st.clock.elapsedTime * 12) > 0 ? 8 : 0.5;
    if (bus.current) { bus.current.position.x += dt * 9; if (bus.current.position.x > half + 10) bus.current.position.x = -half - 10; }
  });

  const setback = roadHalf + fp;
  const trees = treeCount(L);
  return (
    <group ref={group}>
      <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[len, 0.1, L.width]} /><meshStandardMaterial color={C.road} roughness={0.95} /></mesh>
      {fp > 0 && [-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.14, s * (roadHalf + fp / 2)]} receiveShadow><boxGeometry args={[len, 0.28, fp]} /><meshStandardMaterial color={isPlan ? '#7fd8cc' : C.foot} roughness={0.8} /></mesh>
      ))}
      {/* drain */}
      {L.drain
        ? Array.from({ length: 30 }, (_, i) => <mesh key={i} position={[-half + 2 + i * 4, 0.13, -(roadHalf - 0.4)]} castShadow><boxGeometry args={[3.8, 0.18, 0.8]} /><meshStandardMaterial color={C.slab} /></mesh>)
        : <mesh position={[0, 0.06, -(roadHalf - 0.4)]}><boxGeometry args={[len, 0.04, 0.8]} /><meshStandardMaterial color={C.drain} roughness={0.2} metalness={0.4} /></mesh>}
      {/* buildings */}
      {plots.map((p, i) => {
        const h = p.floors * 3.1, w = A.plotFrontage - 0.6, z = p.s * (setback + A.plotDepth / 2);
        const changed = isPlan && (p.floors < p.today || (L.retrofit && p.cracked));
        const color = changed ? '#e6f7f4' : !isPlan && p.cracked ? C.cracked : p.tone < 0.5 ? C.bld : C.bldOld;
        return (
          <group key={i} position={[p.x, 0, z]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[w, h, A.plotDepth]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
            {/* windows: emissive strips, catch bloom at dusk */}
            {Array.from({ length: p.floors - 1 }, (_, f) => (
              <mesh key={f} position={[0, 3.1 * (f + 1) + 1.4, -p.s * (A.plotDepth / 2 + 0.01)]}><planeGeometry args={[w * 0.7, 0.9]} />
                <meshStandardMaterial color="#1c2a2c" emissive="#ffcf8a" emissiveIntensity={(i + f) % 3 === 0 ? 1.6 : 0.05} side={THREE.DoubleSide} /></mesh>
            ))}
            <mesh position={[0, 1.2, -p.s * (A.plotDepth / 2 + 0.02)]}><planeGeometry args={[w * 0.75, 2.2]} /><meshStandardMaterial color="#5b544b" side={THREE.DoubleSide} /></mesh>
            {changed && L.retrofit && p.cracked && <mesh position={[0, h - 0.2, 0]}><boxGeometry args={[w + 0.12, 0.35, A.plotDepth + 0.12]} /><meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={1.4} /></mesh>}
            {isPlan && L.solar && <mesh position={[0, h + 0.45, 0]} rotation={[0.25 * p.s, 0, 0]} castShadow><boxGeometry args={[w * 0.7, 0.12, A.plotDepth * 0.6]} /><meshStandardMaterial color="#1d3557" metalness={0.8} roughness={0.25} /></mesh>}
            {!isPlan && p.tank && <mesh position={[-2, h + 0.7, 0]} castShadow><cylinderGeometry args={[0.7, 0.7, 1.4, 16]} /><meshStandardMaterial color="#222" /></mesh>}
          </group>
        );
      })}
      {/* stalls */}
      {L.encroach > 0 && Array.from({ length: A.baseStalls }, (_, i) => {
        const s = i % 2 ? 1 : -1, x = -half + 4 + (i / A.baseStalls) * (len - 8), z = s * (roadHalf - L.encroach / 2);
        return <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[1.6, 1, L.encroach + 0.6]} /><meshStandardMaterial color={C.stall} /></mesh>
          <mesh position={[0, 2.1, 0]} castShadow><boxGeometry args={[1.9, 0.06, L.encroach + 1]} /><meshStandardMaterial color={i % 3 ? C.tarp : '#c8b04a'} /></mesh>
        </group>;
      })}
      {L.vendor && <group>
        <mesh position={[0, 0.12, roadHalf - 0.75]}><boxGeometry args={[len - 10, 0.04, 1.5]} /><meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.25} /></mesh>
        {Array.from({ length: A.baseStalls }, (_, i) => <mesh key={i} position={[-half + 6 + i * ((len - 12) / A.baseStalls), 0.55, roadHalf - 0.75]} castShadow><boxGeometry args={[1.4, 0.9, 1.1]} /><meshStandardMaterial color={C.stall} /></mesh>)}
      </group>}
      {/* trees (instanced) */}
      {trees > 0 && <>
        <Instances limit={200}><icosahedronGeometry args={[1.7, 1]} /><meshStandardMaterial color={C.tree} flatShading roughness={0.9} />
          {Array.from({ length: trees }, (_, i) => <Instance key={i} position={[-half + 3 + (i / trees) * (len - 6), 3.6, (i % 2 ? 1 : -1) * (fp > 0 ? roadHalf + fp / 2 : roadHalf - 0.3)]} />)}
        </Instances>
        <Instances limit={200}><cylinderGeometry args={[0.15, 0.22, 2.6]} /><meshStandardMaterial color={C.trunk} />
          {Array.from({ length: trees }, (_, i) => <Instance key={i} position={[-half + 3 + (i / trees) * (len - 6), 1.3, (i % 2 ? 1 : -1) * (fp > 0 ? roadHalf + fp / 2 : roadHalf - 0.3)]} />)}
        </Instances>
      </>}
      {isPlan && L.shade && Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-half + 5 + i * 10, 3.4, -(roadHalf + Math.max(fp, 1.8) / 2)]} castShadow><boxGeometry args={[9, 0.08, 2]} /><meshPhysicalMaterial color="#ffffff" transmission={0.5} roughness={0.3} /></mesh>)}
      {isPlan && L.brt && <>
        <mesh position={[0, 0.11, 0]}><boxGeometry args={[len, 0.02, 3]} /><meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.4} /></mesh>
        <mesh ref={bus} position={[-half, 1.7, 0]} castShadow><boxGeometry args={[10, 3, 2.5]} /><meshStandardMaterial color="#0f8b8d" metalness={0.3} roughness={0.4} /></mesh>
      </>}
      {scenario === 'fire' && <>
        <group ref={tender} position={[-half - 24, 0, 0]}>
          <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[7, 2.8, 2.5]} /><meshStandardMaterial color="#c0392b" metalness={0.3} roughness={0.4} /></mesh>
          <mesh position={[0, 3.1, 0]}><boxGeometry args={[6, 0.2, 0.6]} /><meshStandardMaterial color="#ddd" metalness={0.8} /></mesh>
          <mesh position={[2.6, 3.15, 0]}><boxGeometry args={[0.6, 0.3, 1.6]} /><meshStandardMaterial ref={beacon} color="#3a7bff" emissive="#3a7bff" emissiveIntensity={6} /></mesh>
          <Html position={[0, 6, 0]} center><div className={`whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full text-white ${blocked ? 'bg-fail' : 'bg-ok'}`}>{blocked ? labels.blocked : labels.through}</div></Html>
        </group>
        <mesh position={[0, 1.5, 0]}><coneGeometry args={[1, 3, 12]} /><meshStandardMaterial color="#ff7b2c" emissive="#ff5a1f" emissiveIntensity={4} /></mesh>
        <Html position={[0, 5, 0]} center><div className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full bg-[#3a2416] text-[#ffb27a] border border-[#ff7b2c]/50">{labels.call}</div></Html>
      </>}
      {[0, 30, 60, 90, 120].map((ch) => <Html key={ch} position={[-half + ch, 0.3, setback + A.plotDepth + 3]} center><div className="text-[10px] text-muted tnum">Ch. {ch}</div></Html>)}
    </group>
  );
}

function Rain() {
  const ref = useRef<THREE.LineSegments>(null);
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 2500; i++) { const x = (Math.random() - 0.5) * 170, y = Math.random() * 50, z = (Math.random() - 0.5) * 90; pts.push(x, y, z, x + 0.3, y - 1.8, z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
  }, []);
  useFrame((_, dt) => { if (ref.current) { ref.current.position.y -= dt * 45; if (ref.current.position.y < -25) ref.current.position.y = 0; } });
  return <lineSegments ref={ref} geometry={geo}><lineBasicMaterial color="#9cc8ff" transparent opacity={0.35} /></lineSegments>;
}

function Rig({ scenario }: { scenario: Scenario }) {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const v = { normal: [-95, 70, 55, 0, 0, 0], fire: [-100, 22, 18, -25, 2, 0], monsoon: [-55, 16, 40, 0, 0, 0] }[scenario];
    ref.current?.setLookAt(v[0], v[1], v[2], v[3], v[4], v[5], true);
  }, [scenario]);
  return <CameraControls ref={ref} maxPolarAngle={Math.PI * 0.48} minDistance={15} maxDistance={260} smoothTime={0.6} />;
}

export default function StudyScene({ L, isPlan, scenario, labels }: Props) {
  const monsoon = scenario === 'monsoon';
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [-95, 70, 55], fov: 38, near: 0.5, far: 1200 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <color attach="background" args={[monsoon ? '#273138' : '#0e1113']} />
      <fog attach="fog" args={[monsoon ? '#273138' : '#0e1113', 140, 360]} />
      <Sky distance={4500} sunPosition={monsoon ? [0, 0.05, -1] : [-60, 18, 30]} turbidity={monsoon ? 18 : 6} rayleigh={monsoon ? 4 : 1.2} />
      <hemisphereLight args={['#dfe9ff', '#2a2420', monsoon ? 0.6 : 0.9]} />
      <directionalLight position={[-50, 70, 35]} intensity={monsoon ? 0.8 : 2.4} color="#ffe3c0" castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-bias={-0.0004} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} position={[0, 30, -40]} scale={[100, 20, 1]} color="#ffd9b0" />
        <Lightformer form="rect" intensity={1} position={[-50, 20, 40]} scale={[60, 20, 1]} color="#9ccfff" />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[800, 800]} /><meshStandardMaterial color={C.ground} roughness={1} /></mesh>
      <Lane L={L} isPlan={isPlan} scenario={scenario} labels={labels} />
      {monsoon && <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floodDepth(L), 0]}><planeGeometry args={[A.corridorLength + 40, 90]} />
          <meshPhysicalMaterial color="#3d6f99" transparent opacity={0.72} roughness={0.08} metalness={0.1} clearcoat={1} /></mesh>
        <Rain />
      </>}
      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={200} blur={2.5} far={20} />
      <Rig scenario={scenario} />
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={3} intensity={2.2} distanceFalloff={1} halfRes />
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.3} darkness={0.55} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
