// Client-side DPR (pre-feasibility note) as a PDF via jsPDF.
// One typeface (Helvetica), a fixed type scale and a 4.8 mm baseline so every
// block of text sits the same way. jsPDF's core fonts only cover Latin-1, so
// symbols like ≈ → ₹ – ≥ are normalised first (they were what made the text
// uneven before).
import { jsPDF } from 'jspdf';
import { ASSUMPTIONS as A, applyWorks, metrics, type Levers, type Work } from '../model/model';
import type { Observation } from '../model/diagnose';
import { STRINGS } from '../i18n/strings';

const clean = (s: string) => s
  .replace(/≈/g, '~').replace(/→/g, '->').replace(/₹/g, 'Rs ').replace(/[–—]/g, '-')
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/×/g, 'x').replace(/·/g, '-')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/²/g, '2')
  .replace(/[^\x20-\x7E -ÿ]/g, '');

const NAVY: [number, number, number] = [27, 42, 74];
const CRIMSON: [number, number, number] = [176, 20, 60];
const INK: [number, number, number] = [15, 27, 51];
const MUTED: [number, number, number] = [90, 100, 120];
const RULE: [number, number, number] = [223, 227, 234];
const ZEBRA: [number, number, number] = [246, 247, 250];

const SIZE = { title: 22, h: 10.5, body: 9.5, small: 8 } as const;
const LH = 4.8; // baseline step (mm) for body text

export function exportDpr(opts: { city: string; place: string; baseline: Levers; works: Work[]; observations: Observation[]; workLabel: (w: Work) => string }) {
  const T = STRINGS.en; // PDF is English: the core fonts have no Devanagari.
  const { baseline, works } = opts;
  const b = metrics(baseline, baseline, true);
  const p = metrics(applyWorks(works, baseline), baseline);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18, CW = W - 2 * M, BOTTOM = 278;
  let y = 0;

  const font = (size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = INK) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const newPage = () => { doc.addPage(); y = M + 4; };
  const need = (h: number) => { if (y + h > BOTTOM) newPage(); };

  const heading = (s: string) => {
    need(16); y += 5;
    font(SIZE.h, 'bold', NAVY); doc.text(clean(s).toUpperCase(), M, y);
    doc.setDrawColor(...CRIMSON); doc.setLineWidth(0.6); doc.line(M, y + 2, M + 14, y + 2);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M + 14, y + 2, W - M, y + 2);
    y += 8;
  };

  const para = (s: string, color: [number, number, number] = INK, size: number = SIZE.body) => {
    font(size, 'normal', color);
    const lines = doc.splitTextToSize(clean(s), CW) as string[];
    for (const ln of lines) { need(LH); doc.text(ln, M, y); y += LH; }
    y += 1.5;
  };

  /** Simple table: columns with widths (mm) and alignment; header row in navy. */
  const table = (cols: { w: number; align?: 'left' | 'right' }[], head: string[] | null, rows: string[][]) => {
    const pad = 2.2;
    const drawRow = (cells: string[], opts: { bold?: boolean; fill?: [number, number, number]; color?: [number, number, number] }) => {
      font(SIZE.body, opts.bold ? 'bold' : 'normal', opts.color ?? INK);
      const wrapped = cells.map((c, i) => doc.splitTextToSize(clean(c), cols[i].w - pad * 2) as string[]);
      const h = Math.max(...wrapped.map((w) => w.length)) * LH + 2.4;
      need(h);
      if (opts.fill) { doc.setFillColor(...opts.fill); doc.rect(M, y - 3.6, CW, h, 'F'); }
      let x = M;
      wrapped.forEach((lines, i) => {
        const c = cols[i];
        lines.forEach((ln, k) => {
          const ty = y + k * LH;
          if (c.align === 'right') doc.text(ln, x + c.w - pad, ty, { align: 'right' }); else doc.text(ln, x + pad, ty);
        });
        x += c.w;
      });
      y += h;
    };
    if (head) drawRow(head, { bold: true, fill: NAVY, color: [255, 255, 255] });
    rows.forEach((r, i) => drawRow(r, { fill: i % 2 ? undefined : ZEBRA }));
    y += 2;
  };

  // ---- cover band ----
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 46, 'F');
  doc.setFillColor(...CRIMSON); doc.rect(0, 46, W, 1.4, 'F');
  // three-stripe mark
  doc.setDrawColor(...CRIMSON); doc.setLineWidth(1.6); doc.line(M, 26, M + 9, 17);
  doc.setDrawColor(230, 234, 242); doc.line(M + 3, 29, M + 12, 20);
  doc.setDrawColor(...CRIMSON); doc.line(M + 6, 32, M + 15, 23);
  font(SIZE.title, 'bold', [255, 255, 255]); doc.text('CONSTRUCTIVE', M + 21, 27);
  font(SIZE.body, 'normal', [210, 218, 235]); doc.text('Pre-feasibility note (indicative)', M + 21, 34);
  font(SIZE.small, 'normal', [210, 218, 235]);
  doc.text(clean(`${opts.place}, ${opts.city}`), M + 21, 40);
  doc.text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), W - M, 40, { align: 'right' });
  y = 58;
  para(T.disclaimer, MUTED, SIZE.small);

  heading('Summary');
  table([{ w: 84 }, { w: 45, align: 'right' }, { w: 45, align: 'right' }], ['Metric', 'Today', 'Proposed'], [
    [T.metrics.fire, `${b.fire.toFixed(1)} min`, `${p.fire.toFixed(1)} min`],
    ['Clear carriageway width', `${b.clear.toFixed(1)} m`, `${p.clear.toFixed(1)} m`],
    [T.metrics.flood, `${b.flood.toFixed(0)} / 100`, `${p.flood.toFixed(0)} / 100`],
    [T.metrics.heat, `${b.heat.toFixed(1)} C`, `${p.heat.toFixed(1)} C`],
    [T.metrics.safety, `${b.safety} / 100`, `${p.safety} / 100`],
    [T.metrics.walk, `${b.walk} / 100`, `${p.walk} / 100`],
  ]);
  const d = p.displacement;
  para(`Displacement: ${d.stallsLost} stalls displaced, ${d.stallsRelocated} relocated into a vending zone, ${d.plotsAffected} plots set back by ${d.setback.toFixed(1)} m.`);

  heading(T.observations);
  table([{ w: 22 }, { w: 40 }, { w: 112 }], ['Status', 'Location', 'Observation'],
    opts.observations.map((o) => [o.sev === 'fails' ? 'Fails' : o.sev === 'marginal' ? 'Marginal' : 'Meets', o.where, `${o.text} (Source: ${o.source}; ${o.verified ? 'verified' : 'unverified'})`]));

  heading(T.works);
  if (!works.length) para('No works proposed.');
  else table([{ w: 10, align: 'right' }, { w: 164 }], null, works.map((w, i) => [`${i + 1}.`, opts.workLabel(w)]));

  heading('Indicative cost');
  const costRows = Object.entries(p.cost.items).filter(([, v]) => v > 0)
    .map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), `Rs ${v.toFixed(3)} Cr`]);
  table([{ w: 120 }, { w: 54, align: 'right' }], ['Item', 'Amount'], [
    ...costRows,
    ['Total (indicative)', `Rs ${p.cost.totalCr.toFixed(2)} Cr`],
    ['Range (+/-40%)', `Rs ${p.cost.lowCr.toFixed(2)} - ${p.cost.highCr.toFixed(2)} Cr`],
  ]);

  heading(`${T.checks} (proposed)`);
  table([{ w: 100 }, { w: 44, align: 'right' }, { w: 30, align: 'right' }], ['Check', 'Value', 'Result'],
    p.checks.map((c) => [T.checkNames[c.id], c.unit ? `${c.value.toFixed(c.unit === 'm' ? 1 : 0)} ${c.unit}` : (c.value ? 'Yes' : 'No'), c.pass ? 'Meets' : 'Fails']));

  newPage();
  heading('Assumptions (editable placeholders)');
  table([{ w: 120 }, { w: 54, align: 'right' }], ['Parameter', 'Value'], [
    ...Object.entries(A).filter(([k]) => k !== 'rates').map(([k, v]) => [k, String(v)]),
    ...Object.entries(A.rates).map(([k, v]) => [`Rate: ${k}`, `Rs ${Number(v).toLocaleString('en-IN')}`]),
  ]);
  para('Fire-tender clear width of 3.5 m is a working assumption (2.5 m body + 1 m margin). It must be verified against NBC 2016 Part 4 and local fire bye-laws. Costs are +/-40% placeholders, not a schedule of rates.', MUTED);

  heading('Data sources');
  para('Street, building, drain, green, flyover and fire-station data: (c) OpenStreetMap contributors, ODbL 1.0. National highways are identified from OSM route refs and road class; they fall under NHAI / MoRTH and are excluded from municipal works. Widths and heights not tagged in OSM are estimated and must be verified on site.', MUTED);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M, 286, W - M, 286);
    font(SIZE.small, 'normal', MUTED);
    doc.text('Constructive - indicative pre-feasibility', M, 290);
    doc.text(`Page ${i} of ${n}`, W - M, 290, { align: 'right' });
  }
  doc.save(`Constructive-DPR-${opts.city.replace(/\s+/g, '-')}.pdf`);
}
