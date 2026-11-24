// Constructive — 3D lane scene (three.js). Reads levers + metrics, draws the corridor.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ASSUMPTIONS as A, clearWidth, footpathWidth, floodDepth, treeCount } from './model.js';

const COL = {
  ground: 0xe9e4da, road: 0xbdb6aa, footpath: 0xd9d3c7, building: 0xf4efe6, buildingOld: 0xd8cfc0,
  cracked: 0x9b968f, accent: 0x0f8b8d, stall: 0xc98a4b, tarp: 0x3f6e9a, drainOpen: 0x3b3a33, slab: 0x8f8a80,
  tree: 0x5f8a55, trunk: 0x7a5b3e, water: 0x4a86b5, fire: 0xc0392b, bus: 0x0f8b8d, solar: 0x24344d, shade: 0xffffff,
};

// Seeded RNG so the "today" lane looks the same every load.
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'labels';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f0ea);
  scene.fog = new THREE.Fog(0xf3f0ea, 160, 320);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1000);
  camera.position.set(-105, 95, 45);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-40, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: COL.ground }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  let world = new THREE.Group(); scene.add(world);
  const anim = { tender: null, tenderStop: 0, bus: null, rain: null, water: null, status: null, grow: 1, cam: null };

  const VIEWS = {
    normal:  { pos: [-105, 95, 45], target: [0, 0, 0] },
    fire:    { pos: [-110, 38, 26], target: [-30, 0, 0] },
    monsoon: { pos: [-60, 22, 48], target: [0, 0, 0] },
  };
  function flyTo(name) {
    const v = VIEWS[name] || VIEWS.normal;
    anim.cam = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: new THREE.Vector3(...v.pos), toT: new THREE.Vector3(...v.target) };
  }
  function label(text, x, y, z, cls = '') {
    const el = document.createElement('div');
    el.className = 'tag ' + cls; el.innerHTML = text;
    const o = new CSS2DObject(el); o.position.set(x, y, z); world.add(o); return o;
  }

  function mat(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }); }
  function box(w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; world.add(m); return m;
  }

  let lastScenario = null;
  function build({ L, isPlan, scenario, text = {} }) {
    scene.remove(world); world.traverse((o) => { o.geometry?.dispose(); if (o.isCSS2DObject) o.element.remove(); });
    world = new THREE.Group(); scene.add(world);
    world.scale.y = 0.02; anim.grow = 0;
    if (scenario !== lastScenario) { flyTo(scenario); lastScenario = scenario; }
    anim.tender = anim.bus = anim.rain = anim.water = null;

    const len = A.corridorLength, half = len / 2;
    const fp = footpathWidth(L);
    const roadHalf = L.width / 2;
    const r = rng(7);

    // Chainage markers
    for (const ch of [0, 30, 60, 90, 120]) label(`Ch. ${ch}`, -half + ch, 0.3, roadHalf + fp + A.plotDepth + 3, 'ch');

    // Carriageway and footpaths
    box(len, 0.1, L.width, COL.road, 0, 0.05, 0);
    if (fp > 0) for (const s of [-1, 1]) box(len, 0.25, fp, isPlan ? 0xcfe5e3 : COL.footpath, 0, 0.125, s * (roadHalf + fp / 2));

    // Drain along north edge
    const drainZ = -(roadHalf - 0.4);
    if (L.drain) {
      for (let x = -half + 2; x < half; x += 4) box(3.8, 0.18, 0.8, COL.slab, x, 0.12, drainZ);
    } else {
      box(len, 0.06, 0.8, COL.drainOpen, 0, 0.04, drainZ);
    }

    // Buildings: 12 per side
    const setback = roadHalf + fp;
    for (const s of [-1, 1]) {
      for (let i = 0; i < A.plotsPerSide; i++) {
        const x = -half + A.plotFrontage * (i + 0.5);
        const todayFloors = 3 + Math.floor(r() * 4); // G+2 .. G+5
        const cracked = r() < 0.3;
        const tone = r(), tank = r(); // always drawn so today/plan stay in sync
        const floors = isPlan ? Math.min(todayFloors, L.floors) : todayFloors;
        const h = floors * 3.1;
        const w = A.plotFrontage - 0.6;
        const color = isPlan ? (floors < todayFloors || cracked ? 0xe3f1f0 : COL.building) : cracked ? COL.cracked : tone < 0.5 ? COL.building : COL.buildingOld;
        const b = box(w, h, A.plotDepth, color, x, h / 2, s * (setback + A.plotDepth / 2));
        if (isPlan && (L.retrofit && cracked)) { // retrofit band
          box(w + 0.1, 0.35, A.plotDepth + 0.1, COL.accent, x, h - 0.2, b.position.z);
        }
        if (!isPlan && cracked) { // crack hint: dark diagonal strip on facade
          const c = box(0.25, h * 0.6, 0.05, 0x55524d, x + w * 0.15, h * 0.5, s * setback - s * 0.03);
          c.rotation.z = 0.5;
        }
        // shop shutters on ground floor
        box(w * 0.7, 2.2, 0.05, 0x8c8478, x, 1.2, s * (setback - 0.02));
        if (L.solar && isPlan) box(w * 0.7, 0.15, A.plotDepth * 0.6, COL.solar, x, h + 0.4, b.position.z).rotation.x = 0.2 * s;
        // water tank on today roofs
        if (!isPlan && tank < 0.6) {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), mat(0x2a2a2a));
          t.position.set(x - 2, h + 0.7, b.position.z); t.castShadow = true; world.add(t);
        }
      }
    }

    // Encroaching stalls (today) or vending zone (plan)
    if (L.encroach > 0) {
      for (let i = 0; i < A.baseStalls; i++) {
        const s = i % 2 ? 1 : -1;
        const x = -half + 4 + (i / A.baseStalls) * (len - 8);
        const z = s * (roadHalf - L.encroach / 2);
        box(1.6, 1, L.encroach + 0.6, COL.stall, x, 0.5, z);
        box(1.9, 0.08, L.encroach + 1, i % 3 ? COL.tarp : 0xc8b04a, x, 2.1, z);
      }
    }
    if (L.vendor) {
      const z = roadHalf - 0.75;
      box(len - 10, 0.05, 1.5, 0xd6efed, 0, 0.12, z);
      for (let i = 0; i < A.baseStalls; i++) {
        const x = -half + 6 + i * ((len - 12) / A.baseStalls);
        box(1.4, 0.9, 1.1, COL.stall, x, 0.55, z);
        box(1.6, 0.06, 1.3, COL.accent, x, 2.0, z);
      }
    }

    // Trees
    const trees = treeCount(L);
    for (let i = 0; i < trees; i++) {
      const s = i % 2 ? 1 : -1;
      const x = -half + 3 + (i / Math.max(1, trees)) * (len - 6);
      const z = s * (fp > 0 ? roadHalf + fp / 2 : roadHalf - 0.3);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.4), mat(COL.trunk));
      trunk.position.set(x, 1.2, z); world.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), mat(COL.tree, { flatShading: true }));
      crown.position.set(x, 3.4, z); crown.castShadow = true; world.add(crown);
    }

    // Shade canopy
    if (L.shade && isPlan) {
      const z = -(roadHalf + Math.max(fp, 1.8) / 2);
      for (let x = -half + 5; x < half; x += 10) box(9, 0.08, 2, COL.shade, x, 3.4, z, { transparent: true, opacity: 0.85 });
    }

    // BRT bus
    if (L.brt && isPlan) {
      box(len, 0.02, 3, 0xd6efed, 0, 0.12, 0);
      anim.bus = box(10, 3, 2.5, COL.bus, -half, 1.7, 0);
    }

    // Scenarios
    if (scenario === 'monsoon') {
      const d = floodDepth(L);
      anim.water = new THREE.Mesh(new THREE.PlaneGeometry(len + 40, 80), mat(COL.water, { transparent: true, opacity: 0.55 }));
      anim.water.rotation.x = -Math.PI / 2; anim.water.position.y = d; world.add(anim.water);
      const pts = [];
      for (let i = 0; i < 1500; i++) {
        const x = (Math.random() - 0.5) * 160, y = Math.random() * 50, z = (Math.random() - 0.5) * 80;
        pts.push(x, y, z, x + 0.3, y - 1.6, z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      anim.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6b8fb3, transparent: true, opacity: 0.5 }));
      world.add(anim.rain);
      label(text.water || `${Math.round(d * 100)} cm`, 20, d + 3, 0, 'water');
    }
    if (scenario === 'fire') {
      const clear = clearWidth(L);
      const blocked = clear < A.fireTenderClear;
      anim.tender = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(7, 2.8, 2.5), mat(COL.fire)); body.position.y = 1.6; body.castShadow = true;
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 0.6), mat(0xdddddd)); ladder.position.y = 3.1;
      anim.tender.add(body, ladder);
      anim.tender.position.set(-half - 20, 0, 0);
      anim.tenderStop = blocked ? -half + 4 : 0; // stops at lane mouth if blocked; reaches Ch. 60 otherwise
      world.add(anim.tender);
      const marker = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 8), mat(0xe67e22));
      marker.position.set(0, 1.5, 0); world.add(marker);
      label(text.call || 'Fire call · Ch. 60', 0, 6, 0, 'call');
      const tag = label(blocked ? (text.blocked || 'Blocked') : (text.through || 'Through'), 0, 6, 0, blocked ? 'bad' : 'good');
      anim.tender.add(tag); tag.position.set(0, 6, 0);
    }
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h); labelRenderer.setSize(w, h); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (anim.tender && anim.tender.position.x < anim.tenderStop) anim.tender.position.x = Math.min(anim.tenderStop, anim.tender.position.x + dt * 18);
    if (anim.bus) { anim.bus.position.x += dt * 10; if (anim.bus.position.x > A.corridorLength / 2 + 10) anim.bus.position.x = -A.corridorLength / 2 - 10; }
    if (anim.rain) { anim.rain.position.y -= dt * 40; if (anim.rain.position.y < -20) anim.rain.position.y = 0; }
    if (anim.grow < 1) { anim.grow = Math.min(1, anim.grow + dt * 2.2); world.scale.y = 0.02 + 0.98 * (1 - Math.pow(1 - anim.grow, 3)); }
    if (anim.cam) {
      anim.cam.t = Math.min(1, anim.cam.t + dt * 0.9);
      const k = anim.cam.t < 0.5 ? 4 * anim.cam.t ** 3 : 1 - Math.pow(-2 * anim.cam.t + 2, 3) / 2;
      camera.position.lerpVectors(anim.cam.fromP, anim.cam.toP, k);
      controls.target.lerpVectors(anim.cam.fromT, anim.cam.toT, k);
      if (anim.cam.t >= 1) anim.cam = null;
    }
    controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera);
  });

  return { build, flyTo };
}
