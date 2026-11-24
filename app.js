import { ASSUMPTIONS, BASELINE, WORKS, PRESETS, applyWorks, metrics } from './model.js';
import { STR } from './i18n.js';
import { createScene } from './scene.js';

const $ = (id) => document.getElementById(id);
const state = { lang: 'en', role: 'officer', view: 'plan', scenario: 'normal', works: [] };
const t = () => STR[state.lang];
const fmt = (n, d = 1) => Number(n).toFixed(d);
const scene = createScene($('view'));

// ---------- dropdown builders ----------
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
}

// ---------- observations (today state, sourced) ----------
function observations(m) {
  const T = t(), d = m;
  return [
    { ch: 'Ch. 0–120', what: `Clear width ${fmt(d.clear)} m (lane ${BASELINE.width} m, stalls ${BASELINE.encroach} m). Fire tender (${ASSUMPTIONS.fireTenderClear} m assumed) cannot enter.`, sev: 'fails', src: T.src.photo, ok: true },
    { ch: 'Ch. 40–120', what: 'Open nala, silted; no outfall to trunk drain. Waterlogging most monsoons.', sev: 'fails', src: T.src.field, ok: false },
    { ch: 'Ch. 0–120', what: `${ASSUMPTIONS.baseStalls} stalls encroach ${BASELINE.encroach} m into carriageway.`, sev: 'marginal', src: T.src.photo, ok: true },
    { ch: '7 of 24 plots', what: 'G+4/G+5 structures with visible facade cracks; no setback.', sev: 'fails', src: T.src.auto, ok: false },
    { ch: 'Whole lane', what: `Green cover ~${BASELINE.green}%; no shaded walkway. Heat-island excess ≈ ${fmt(d.heat)} °C.`, sev: 'fails', src: `${T.src.osm} + ${T.src.photo}`, ok: false },
    { ch: 'Whole lane', what: 'No footpath; pedestrians share carriageway with two-wheelers.', sev: 'marginal', src: T.src.field, ok: true },
  ];
}

// ---------- render ----------
function render() {
  const T = t();
  const base = metrics(BASELINE, true);
  const Lplan = applyWorks(state.works);
  const plan = metrics(Lplan, false);
  const shown = state.view === 'today' ? { L: BASELINE, m: base } : { L: Lplan, m: plan };

  scene.build({ L: shown.L, isPlan: state.view === 'plan', scenario: state.scenario });

  // status
  const st = $('status');
  if (state.scenario === 'fire') {
    const blocked = shown.m.clear < ASSUMPTIONS.fireTenderClear;
    st.hidden = false; st.className = 'status ' + (blocked ? 'bad' : 'good');
    st.textContent = `${blocked ? T.blocked : T.through} · ${T.metrics.fire} ${fmt(shown.m.fire)} min · clear ${fmt(shown.m.clear)} m`;
  } else if (state.scenario === 'monsoon') {
    st.hidden = false; st.className = 'status ' + (shown.m.flood > 50 ? 'bad' : 'good');
    st.textContent = `${T.metrics.flood} ${fmt(shown.m.flood, 0)} · ~${fmt(shown.m.flood / 100 * 0.5 * 100, 0)} cm standing water`;
  } else st.hidden = true;

  // observations
  const obs = observations(base);
  $('obsCount').textContent = `${obs.filter((o) => o.ok).length} / ${obs.length} ${T.verified.toLowerCase()}`;
  $('observations').innerHTML = obs.map((o) => `
    <div class="obs"><span class="ch">${o.ch}</span><span>${o.what}</span><span class="sev ${o.sev}">${T.sev[o.sev]}</span>
    <span class="meta">${o.src} · ${o.ok ? T.verified : T.unverified}</span></div>`).join('');

  // works
  $('works').innerHTML = state.works.length
    ? state.works.map((w, i) => `<div class="work"><span class="n">${i + 1}</span><span class="t">${workLabel(w)}</span><button data-i="${i}">${T.remove}</button></div>`).join('')
    : `<div class="empty">${T.noWorks}</div>`;

  // metrics table: today vs proposed
  $('metricsTitle').textContent = `${T.today} → ${T.plan}`;
  const rows = [
    ['fire', base.fire, plan.fire, 'min', 1, -1],
    ['flood', base.flood, plan.flood, '/100', 0, -1],
    ['heat', base.heat, plan.heat, '°C', 1, -1],
    ['safety', base.safety, plan.safety, '/100', 0, 1],
    ['walk', base.walk, plan.walk, '/100', 0, 1],
  ];
  $('metrics').innerHTML = `<tr><th></th><th class="num">${T.today}</th><th class="num">${T.plan}</th></tr>` + rows.map(([k, a, b, u, d, dir]) => {
    const cls = Math.abs(b - a) < 1e-9 ? '' : (b - a) * dir > 0 ? 'delta-good' : 'delta-bad';
    return `<tr><td>${T.metrics[k]}</td><td class="num">${fmt(a, d)} ${u}</td><td class="num ${cls}">${fmt(b, d)} ${u}</td></tr>`;
  }).join('');

  // checks (proposed)
  $('checks').innerHTML = plan.checks.map((c) => `<tr><td>${T.checkNames[c.id]}</td><td class="num">${c.unit ? fmt(c.value, c.unit === '%' || c.unit === 'floors' || c.unit === 'pits' ? 0 : 1) + ' ' + c.unit : ''}</td><td class="num sev ${c.pass ? 'ok' : 'fails'}">${c.pass ? T.pass : T.fail}</td></tr>`).join('');

  // effects bar
  const d = plan.displacement;
  const parts = [];
  if (state.works.length) {
    parts.push(`${T.metrics.fire} <b>${fmt(base.fire)} → ${fmt(plan.fire)} min</b>`);
    parts.push(`${T.metrics.flood} <b>${fmt(base.flood, 0)} → ${fmt(plan.flood, 0)}</b>`);
    if (d.stallsRelocated) parts.push(`<b>${d.stallsRelocated}</b> ${T.stallsMoved}`);
    if (d.stallsLost) parts.push(`<b class="delta-bad">${d.stallsLost}</b> ${T.stallsLost}`);
    if (d.plotsAffected) parts.push(`<b>${d.plotsAffected}</b> ${T.plots} ${fmt(d.setback)} m`);
  }
  $('effects').innerHTML = `<span style="color:var(--muted)">${T.effects}:</span> ` + (parts.join(' · ') || '—');
  $('cost').textContent = state.works.length ? `${T.metrics.cost}: ₹${fmt(plan.cost.totalCr, 2)} Cr (₹${fmt(plan.cost.lowCr, 2)}–${fmt(plan.cost.highCr, 2)})` : '';
}

// ---------- DPR (text; PDF comes in a later PR) ----------
function dprText() {
  const base = metrics(BASELINE, true), L = applyWorks(state.works), p = metrics(L);
  const A = ASSUMPTIONS, line = '─'.repeat(64);
  const out = [
    'CONSTRUCTIVE — PRE-FEASIBILITY NOTE (INDICATIVE)',
    'Ward 14 · Sadar Bazaar (representative) · Gali 7 · 120 m', line,
    'SITE OBSERVATIONS', ...observations(base).map((o) => `  ${o.ch.padEnd(14)} ${o.what}  [${o.src}; ${o.ok ? 'verified' : 'unverified'}]`), '',
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
  ];
  return out.join('\n');
}

// ---------- events ----------
$('lang').onchange = (e) => { state.lang = e.target.value; buildControls(); render(); };
$('role').onchange = (e) => { state.role = e.target.value; };
$('state').onchange = (e) => { state.view = e.target.value; render(); };
$('scenario').onchange = (e) => { state.scenario = e.target.value; render(); };
$('addWork').onchange = (e) => {
  if (!e.target.value) return;
  const [id, v] = e.target.value.split(':');
  state.works = state.works.filter((w) => w.id !== id).concat({ id, value: v === undefined ? undefined : +v });
  state.view = 'plan'; buildControls(); render();
};
$('preset').onchange = (e) => {
  if (!e.target.value) return;
  state.works = PRESETS[e.target.value].map((w) => ({ ...w }));
  state.view = 'plan'; buildControls(); render();
};
$('works').onclick = (e) => {
  const i = e.target.dataset?.i; if (i === undefined) return;
  state.works.splice(+i, 1); render();
};
$('exportDpr').onclick = () => { $('dprText').textContent = dprText(); $('dpr').showModal(); };
$('dprClose').onclick = () => $('dpr').close();
$('dprCopy').onclick = () => navigator.clipboard?.writeText($('dprText').textContent);

state.view = 'today';
buildControls();
render();
