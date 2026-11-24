// Client-side DPR (pre-feasibility note) as a PDF, via jsPDF.
import { jsPDF } from 'jspdf';
import { ASSUMPTIONS as A, applyWorks, metrics, type Levers, type Work } from '../model/model';
import type { Observation } from '../model/diagnose';
import { STRINGS } from '../i18n/strings';

export function exportDpr(opts: { city: string; place: string; baseline: Levers; works: Work[]; observations: Observation[]; workLabel: (w: Work) => string }) {
  const T = STRINGS.en; // jsPDF core fonts have no Devanagari; the PDF is English.
  const { baseline, works } = opts;
  const b = metrics(baseline, baseline, true);
  const p = metrics(applyWorks(works, baseline), baseline);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = 0;
  const teal: [number, number, number] = [15, 139, 141];
  const page = () => { doc.addPage(); y = M; };
  const need = (h: number) => { if (y + h > 280) page(); };
  const h2 = (s: string) => { need(14); y += 4; doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...teal).text(s.toUpperCase(), M, y); y += 2; doc.setDrawColor(220).line(M, y, W - M, y); y += 6; doc.setTextColor(30); };
  const para = (s: string, size = 9.5, color = 30) => { doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(color); const lines = doc.splitTextToSize(s, W - 2 * M); need(lines.length * 4.6); doc.text(lines, M, y); y += lines.length * 4.6; };
  const row = (a: string, bb: string, c: string, bold = false) => { need(6); doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9.5).setTextColor(30); doc.text(a, M, y); doc.text(bb, 130, y, { align: 'right' }); doc.text(c, W - M, y, { align: 'right' }); y += 5.6; };

  // Cover band
  doc.setFillColor(...teal).rect(0, 0, W, 44, 'F');
  doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(22).text('Constructive', M, 20);
  doc.setFont('helvetica', 'normal').setFontSize(11).text('Pre-feasibility note (indicative)', M, 28);
  doc.setFontSize(9).text(`${opts.place}, ${opts.city}  ·  ${new Date().toLocaleDateString('en-IN')}`, M, 36);
  y = 56;
  para(T.disclaimer, 9, 90);

  h2('Summary');
  row('', 'Today', 'Proposed', true);
  row(T.metrics.fire, `${b.fire.toFixed(1)} min`, `${p.fire.toFixed(1)} min`);
  row('Clear width', `${b.clear.toFixed(1)} m`, `${p.clear.toFixed(1)} m`);
  row(T.metrics.flood, b.flood.toFixed(0), p.flood.toFixed(0));
  row(T.metrics.heat, `${b.heat.toFixed(1)} °C`, `${p.heat.toFixed(1)} °C`);
  row(T.metrics.safety, String(b.safety), String(p.safety));
  row(T.metrics.walk, String(b.walk), String(p.walk));
  const d = p.displacement;
  para(`Displacement: ${d.stallsLost} stalls displaced, ${d.stallsRelocated} relocated, ${d.plotsAffected} plots set back ${d.setback.toFixed(1)} m.`);

  h2(T.observations);
  opts.observations.forEach((o) => para(`[${o.sev.toUpperCase()}] ${o.where}: ${o.text}  (Source: ${o.source}; ${o.verified ? 'verified' : 'unverified'})`));

  h2(T.works);
  if (!works.length) para('No works proposed.');
  works.forEach((w, i) => para(`${i + 1}. ${opts.workLabel(w)}`));

  h2('Indicative cost');
  row('Total', `Rs ${p.cost.totalCr.toFixed(2)} Cr`, `range ${p.cost.lowCr.toFixed(2)}–${p.cost.highCr.toFixed(2)} Cr`, true);
  Object.entries(p.cost.items).filter(([, v]) => v > 0).forEach(([k, v]) => row(`  ${k}`, `Rs ${v.toFixed(3)} Cr`, ''));

  h2(T.checks + ' (proposed)');
  p.checks.forEach((c) => row(T.checkNames[c.id], c.unit ? `${c.value.toFixed(c.unit === 'm' ? 1 : 0)} ${c.unit}` : '', c.pass ? 'Meets' : 'Fails'));

  page();
  h2('Assumptions (editable placeholders)');
  Object.entries(A).filter(([k]) => k !== 'rates').forEach(([k, v]) => row(k, String(v), ''));
  Object.entries(A.rates).forEach(([k, v]) => row(`rate · ${k}`, `Rs ${v.toLocaleString('en-IN')}`, ''));
  para('Fire-tender clear width of 3.5 m is a working assumption (2.5 m body + 1 m margin). It must be verified against NBC 2016 Part 4 and local fire bye-laws. Costs are ±40% placeholders, not a schedule of rates.', 9, 70);
  h2('Data sources');
  para('Street, building, drain, green and fire-station data: © OpenStreetMap contributors, ODbL 1.0. Widths and heights not tagged in OSM are estimated from road class or defaults and must be verified on site.', 9, 70);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8).setTextColor(140).text(`Constructive · indicative pre-feasibility · page ${i} of ${n}`, M, 290); }
  doc.save(`Constructive-DPR-${opts.city.replace(/\s+/g, '-')}.pdf`);
}
