import { ASSUMPTIONS, BASELINE, WORKS, PRESETS, applyWorks, metrics } from './model.js';
import { STR } from './i18n.js';
import { createScene } from './scene.js';
import { loaderAnim, sirenAnim, okAnim, rainAnim } from './anims.js';

const $ = (id) => document.getElementById(id);
const state = { lang: 'en', role: 'officer', view: 'today', scenario: 'normal', works: [], justAdded: null };
const t = () => STR[state.lang];
const fmt = (n, d = 1) => Number(n).toFixed(d);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Lottie ----------
const L = window.lottie;
const play = (el, data, loop = true) => {
  if (!L) return null;
  el.innerHTML = '';
  return L.loadAnimation({ container: el, renderer: 'svg', loop, autoplay: true, animationData: data });
};
play($('loaderAnim'), loaderAnim());
play($('brandMark'), loaderAnim());

const scene = createScene($('view'));

// ---------- helpers ----------
function fillSelect(sel, options, value) {
  sel.innerHTML = '';
  for (const o of options) {
    if (o.group) {
      const g = document.createElement('optgroup'); g.label = o.group;
      for (const c of o.items) g.append(new Option(c.label, c.value));
      sel.append(g);
    } else sel.append(new Option(o.label, o.value));
  }
  if (value !== undefined) sel.value = value;
}

function workLabel(w) {
  const def = WORKS[w.id], name = t().workNames[w.id];
  if (w.value === undefined) return name;
  if (w.id === 'drain') return `${name}, ${w.value} mm, Ch. 0–120`;
  if (w.id === 'heightCap') return `${name} G+${w.value - 1}`;
  if (w.id === 'pits') return `${name} × ${w.value}`;
  return `${name} ${w.value}${def.unit === '%' ? '%' : ' ' + def.unit}`;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('toasts').append(el);
  setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove()); }, 2400);
}

// Animated number: tweens from the previous value to the new one.
const prevNum = new Map();
function tween(el, key, to, d) {
  const from = prevNum.has(key) ? prevNum.get(key) : to;
  prevNum.set(key, to);
  const t0 = performance.now(), dur = 700;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e, d);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- static-ish UI (rebuilt on language change) ----------
function buildControls() {
  const T = t();
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = T[el.dataset.i18n]));
  fillSelect($('role'), Object.entries(T.roles).map(([v, label]) => ({ value: v, label })), state.role);
  fillSelect($('state'), [{ value: 'today', label: T.today }, { value: 'plan', label: T.plan }], state.view);
  fillSelect($('scenario'), Object.entries(T.scenarios).map(([v, label]) => ({ value: v, label })), state.scenario);
  $('lang').value = state.lang;

  const groups = {};
  for (const [id, def] of Object.entries(WORKS)) {
    const items = def.options
      ? def.options.map((v) => ({ value: `${id}:${v}`, label: workLabel({ id, value: v }) }))
      : [{ value: id, label: workLabel({ id }) }];
    (groups[def.group] ||= []).push(...items);
  }
  fillSelect($('addWork'), [{ value: '', label: T.addWork }, ...Object.entries(groups).map(([g, items]) => ({ group: T.groups[g], items }))], '');
  fillSelect($('preset'), [{ value: '', label: T.streetType }, ...Object.entries(T.presets).map(([v, label]) => ({ value: v, label }))], '');

  $('legend').innerHTML = [
    ['#f4efe6', T.legend.existing], ['#9b968f', T.legend.cracked], ['#0f8b8d', T.legend.proposed], ['#c98a4b', T.legend.stall],
  ].map(([c, l]) => `<div><i style="background:${c}"></i>${l}</div>`).join('');

  renderObservations();
}

function observations() {
  const T = t(), d = metrics(BASELINE, true);
  return [
    { ch: 'Ch. 0–120', what: `Clear width ${fmt(d.clear)} m (lane ${BASELINE.width} m, stalls ${BASELINE.encroach} m). Fire tender (${ASSUMPTIONS.fireTenderClear} m assumed) cannot enter.`, sev: 'fails', src: T.src.photo, ok: true },
    { ch: 'Ch. 40–120', what: 'Open nala, silted; no outfall to trunk drain. Waterlogging most monsoons.', sev: 'fails', src: T.src.field, ok: false },
    { ch: 'Ch. 0–120', what: `${ASSUMPTIONS.baseStalls} stalls encroach ${BASELINE.encroach} m into carriageway.`, sev: 'marginal', src: T.src.photo, ok: true },
    { ch: '7 / 24 plots', what: 'G+4/G+5 structures with visible facade cracks; no setback.', sev: 'fails', src: T.src.auto, ok: false },
    { ch: 'Whole lane', what: `Green cover ~${BASELINE.green}%; no shaded walkway. Heat-island excess ≈ ${fmt(d.heat)} °C.`, sev: 'fails', src: `${T.src.osm} + ${T.src.photo}`, ok: false },
    { ch: 'Whole lane', what: 'No footpath; pedestrians share carriageway with two-wheelers.', sev: 'marginal', src: T.src.field, ok: true },
  ];
}

function renderObservations() {
  const T = t(), obs = observations();
  $('obsCount').textContent = `${obs.filter((o) => o.ok).length} / ${obs.length} ${T.verified.toLowerCase()}`;
  $('observations').innerHTML = obs.map((o, i) => `
    <div class="obs ${o.sev}" style="animation-delay:${i * 60}ms">
      <div class="top"><span>${o.ch}</span><span class="pill ${o.sev}">${T.sev[o.sev]}</span></div>
      <p>${esc(o.what)}</p>
      <div class="meta"><span class="vdot ${o.ok ? 'on' : ''}"></span>${o.src} · ${o.ok ? T.verified : T.unverified}</div>
    </div>`).join('');
}

// ---------- dynamic render ----------
let statusKey = '';
function renderStatus(m) {
  const T = t(), st = $('status');
  let key = '', html = '', cls = '', anim = null;
  if (state.scenario === 'fire') {
    const blocked = m.clear < ASSUMPTIONS.fireTenderClear;
    key = 'fire' + blocked; cls = blocked ? 'bad' : 'good'; anim = blocked ? sirenAnim() : okAnim();
    html = `<b>${blocked ? T.blocked : T.through}</b><small>${T.metrics.fire} ${fmt(m.fire)} min · clear ${fmt(m.clear)} m (need ${ASSUMPTIONS.fireTenderClear} m)</small>`;
  } else if (state.scenario === 'monsoon') {
    key = 'rain'; cls = m.flood > 50 ? 'bad' : 'good'; anim = rainAnim();
    html = `<b>~${fmt(m.flood / 100 * 50, 0)} cm ${T.standing}</b><small>${T.metrics.flood} ${fmt(m.flood, 0)} / 100</small>`;
  }
  if (!key) { st.classList.remove('show'); statusKey = ''; return; }
  st.className = `status show ${cls}`;
  $('statusText').innerHTML = html;
  if (key !== statusKey) { play($('statusIco'), anim); statusKey = key; }
}

const METRIC_DEFS = [
  // key, unit, decimals, max, lowerIsBetter
  ['fire', 'min', 1, 18, true],
  ['flood', '/100', 0, 100, true],
  ['heat', '°C', 1, 7, true],
  ['safety', '/100', 0, 100, false],
  ['walk', '/100', 0, 100, false],
];

function renderMetrics(base, plan) {
  const T = t(), host = $('metrics');
  if (!host.children.length || host.dataset.lang !== state.lang) {
    host.dataset.lang = state.lang;
    host.innerHTML = METRIC_DEFS.map(([k, u]) => `
      <div class="metric" data-k="${k}">
        <div class="row"><span class="name">${T.metrics[k]}</span>
          <span><span class="from"></span><span class="val"><span class="num"></span> <small>${u}</small></span></span></div>
        <div class="bar"><span class="base"></span><span class="fill"></span></div>
      </div>`).join('');
  }
  for (const [k, , d, max, lower] of METRIC_DEFS) {
    const card = host.querySelector(`[data-k="${k}"]`);
    const shown = state.view === 'today' ? base[k] : plan[k];
    const good = (v) => Math.max(0, Math.min(100, (lower ? 1 - v / max : v / max) * 100));
    tween(card.querySelector('.num'), k, shown, d);
    card.querySelector('.from').textContent = state.view === 'plan' && Math.abs(plan[k] - base[k]) > 1e-9 ? `${fmt(base[k], d)} →` : '';
    card.querySelector('.base').style.left = `${good(base[k])}%`;
    const fill = card.querySelector('.fill');
    fill.style.width = `${good(shown)}%`;
    fill.classList.toggle('worse', good(shown) < good(base[k]) - 0.01);
  }
}

function render({ flash = false } = {}) {
  const T = t();
  const base = metrics(BASELINE, true);
  const Lplan = applyWorks(state.works);
  const plan = metrics(Lplan, false);
  const shown = state.view === 'today' ? { L: BASELINE, m: base } : { L: Lplan, m: plan };

  if (flash) { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  scene.build({
    L: shown.L, isPlan: state.view === 'plan', scenario: state.scenario,
    text: { call: T.call, blocked: T.blocked, through: T.through, water: `~${fmt(shown.m.flood / 100 * 50, 0)} cm` },
  });
  renderStatus(shown.m);

  // works
  $('workCount').textContent = state.works.length ? String(state.works.length) : '';
  $('works').innerHTML = state.works.length
    ? state.works.map((w, i) => `<div class="work ${state.justAdded === w.id ? 'new' : ''}"><span class="n">${i + 1}</span>
        <span class="t"><span class="g">${T.groups[WORKS[w.id].group]}</span>${esc(workLabel(w))}</span>
        <button data-i="${i}" title="${T.remove}" aria-label="${T.remove}">×</button></div>`).join('')
    : `<div class="empty">${T.noWorks}</div>`;
  state.justAdded = null;

  $('metricsTitle').textContent = state.view === 'today' ? T.today : `${T.today} → ${T.plan}`;
  renderMetrics(base, plan);

  const checks = (state.view === 'today' ? base : plan).checks;
  $('checkCount').textContent = `${checks.filter((c) => c.pass).length} ${T.of} ${checks.length} ${T.met}`;
  $('checks').innerHTML = checks.map((c) => `<div class="check"><span>${T.checkNames[c.id]}</span>
    <span class="v">${c.unit ? fmt(c.value, ['%', 'floors', 'pits'].includes(c.unit) ? 0 : 1) + ' ' + c.unit : ''}</span>
    <span class="pill ${c.pass ? 'ok' : 'fails'}">${c.pass ? T.pass : T.fail}</span></div>`).join('');

  // effects bar
  const d = plan.displacement, chips = [];
  if (state.works.length) {
    const chip = (label, a, b, dec, unit, lowerBetter) => {
      const cls = b === a ? '' : (b < a) === lowerBetter ? 'good' : 'bad';
      return `<span class="chip ${cls}">${label} <b>${fmt(a, dec)} → ${fmt(b, dec)}${unit}</b></span>`;
    };
    chips.push(chip(T.metrics.fire, base.fire, plan.fire, 1, ' min', true));
    chips.push(chip(T.metrics.flood, base.flood, plan.flood, 0, '', true));
    if (d.stallsRelocated) chips.push(`<span class="chip"><b>${d.stallsRelocated}</b> ${T.stallsMoved}</span>`);
    if (d.stallsLost) chips.push(`<span class="chip bad"><b>${d.stallsLost}</b> ${T.stallsLost}</span>`);
    if (d.plotsAffected) chips.push(`<span class="chip"><b>${d.plotsAffected}</b> ${T.plots} ${fmt(d.setback)} m</span>`);
  }
  $('effects').innerHTML = `<span class="lbl">${T.effects}</span>` + (chips.join('') || '<span class="chip">—</span>');
  $('cost').innerHTML = state.works.length
    ? `<small>${T.metrics.cost}</small><b>₹${fmt(plan.cost.totalCr, 2)} Cr</b><small>₹${fmt(plan.cost.lowCr, 2)}–${fmt(plan.cost.highCr, 2)} Cr (±40%)</small>`
    : '';
}

// ---------- DPR (text; PDF comes in a later PR) ----------
function dprText() {
  const base = metrics(BASELINE, true), p = metrics(applyWorks(state.works));
  const A = ASSUMPTIONS, line = '─'.repeat(64);
  return [
    'CONSTRUCTIVE — PRE-FEASIBILITY NOTE (INDICATIVE)',
    'Ward 14 · Sadar Bazaar (representative) · Gali 7 · 120 m', line,
    'SITE OBSERVATIONS', ...observations().map((o) => `  ${o.ch.padEnd(14)} ${o.what}  [${o.src}; ${o.ok ? 'verified' : 'unverified'}]`), '',
    'PROPOSED WORKS', ...(state.works.length ? state.works.map((w, i) => `  ${i + 1}. ${workLabel(w)}`) : ['  (none)']), '',
    'METRICS (today → proposed)',
    `  Fire tender response   ${fmt(base.fire)} → ${fmt(p.fire)} min (clear ${fmt(base.clear)} → ${fmt(p.clear)} m)`,
    `  Waterlogging index     ${fmt(base.flood, 0)} → ${fmt(p.flood, 0)}`,
    `  Heat-island excess     ${fmt(base.heat)} → ${fmt(p.heat)} °C`,
    `  Structural screening   ${base.safety} → ${p.safety}`,
    `  Walkability            ${base.walk} → ${p.walk}`,
    `  Displacement           ${p.displacement.stallsLost} stalls displaced, ${p.displacement.stallsRelocated} relocated, ${p.displacement.plotsAffected} plots set back ${fmt(p.displacement.setback)} m`, '',
    `INDICATIVE COST  ₹${fmt(p.cost.totalCr, 2)} Cr  (range ₹${fmt(p.cost.lowCr, 2)}–${fmt(p.cost.highCr, 2)} Cr, ±${A.costUncertainty * 100}%)`,
    ...Object.entries(p.cost.items).filter(([, v]) => v > 0).map(([k, v]) => `  ${k.padEnd(10)} ₹${fmt(v, 3)} Cr`), '',
    'SCREENING CHECKS (proposed)', ...p.checks.map((c) => `  [${c.pass ? 'MEETS' : 'FAILS'}] ${STR.en.checkNames[c.id]}`), '',
    'ASSUMPTIONS', ...Object.entries(A).filter(([k]) => k !== 'rates').map(([k, v]) => `  ${k}: ${v}`),
    ...Object.entries(A.rates).map(([k, v]) => `  rate.${k}: ₹${v}`),
    '  Fire-tender clear width 3.5 m is a working assumption (2.5 m body + 1 m); verify against NBC 2016 Part 4 and local fire bye-laws.', line,
    STR.en.disclaimer,
  ].join('\n');
}

// ---------- events ----------
$('lang').onchange = (e) => { state.lang = e.target.value; buildControls(); render(); };
$('role').onchange = (e) => { state.role = e.target.value; };
$('state').onchange = (e) => { state.view = e.target.value; render({ flash: true }); };
$('scenario').onchange = (e) => { state.scenario = e.target.value; render(); };
$('addWork').onchange = (e) => {
  if (!e.target.value) return;
  const [id, v] = e.target.value.split(':');
  const w = { id, value: v === undefined ? undefined : +v };
  state.works = state.works.filter((x) => x.id !== id).concat(w);
  state.justAdded = id;
  const switched = state.view !== 'plan'; state.view = 'plan';
  $('state').value = 'plan'; e.target.value = '';
  toast(`${t().added}: ${workLabel(w)}`);
  render({ flash: switched });
};
$('preset').onchange = (e) => {
  if (!e.target.value) return;
  state.works = PRESETS[e.target.value].map((w) => ({ ...w }));
  toast(`${t().applied}: ${t().presets[e.target.value]}`);
  state.view = 'plan'; $('state').value = 'plan'; e.target.value = '';
  render({ flash: true });
};
$('works').onclick = (e) => {
  const i = e.target.dataset?.i; if (i === undefined) return;
  const row = e.target.closest('.work');
  const w = state.works[+i];
  row.classList.add('out');
  row.addEventListener('animationend', () => { state.works.splice(+i, 1); toast(`${t().removed}: ${workLabel(w)}`); render(); }, { once: true });
};
$('exportDpr').onclick = () => { $('dprText').textContent = dprText(); $('dpr').showModal(); };
$('dprClose').onclick = () => $('dpr').close();
$('dprCopy').onclick = () => navigator.clipboard?.writeText($('dprText').textContent);

buildControls();
render();
setTimeout(() => $('loader').classList.add('done'), 1600);
