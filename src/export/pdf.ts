import { jsPDF } from 'jspdf';
import type { Drawing, LineKind } from '../core/drawing';

export type Paper = 'a4' | 'a3' | 'letter';

const MARGIN = 10;
const OVERLAP = 10;

const STYLE: Record<LineKind, { w: number; dash: number[]; rgb: [number, number, number] }> = {
  template: { w: 0.35, dash: [], rgb: [17, 17, 17] },
  wood: { w: 0.25, dash: [4, 2], rgb: [154, 106, 47] },
  cut: { w: 0.25, dash: [], rgb: [21, 101, 192] },
  cutDeep: { w: 0.25, dash: [1.5, 1.5], rgb: [21, 101, 192] },
  center: { w: 0.18, dash: [8, 2, 1, 2], rgb: [119, 119, 119] },
  lip: { w: 0.2, dash: [0.8, 1.2], rgb: [119, 119, 119] },
  dim: { w: 0.15, dash: [], rgb: [119, 119, 119] },
  scale: { w: 0.3, dash: [], rgb: [17, 17, 17] },
};

/**
 * 1:1 PDF. Drawings larger than one sheet are tiled over several pages with
 * an overlap; the dashed tile border is the line to cut and join along.
 */
export function drawingsToPdf(drawings: Drawing[], paper: Paper): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: paper, orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth() - 2 * MARGIN;
  const ph = doc.internal.pageSize.getHeight() - 2 * MARGIN;
  let first = true;

  for (const d of drawings) {
    const b = d.bounds;
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    const cols = w <= pw ? 1 : Math.ceil((w - OVERLAP) / (pw - OVERLAP));
    const rows = h <= ph ? 1 : Math.ceil((h - OVERLAP) / (ph - OVERLAP));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!first) doc.addPage(paper, 'portrait');
        first = false;
        // Drawing coordinate that lands on the top-left of the printable area.
        const ox = b.x0 + c * (pw - OVERLAP) - MARGIN;
        const oy = b.y0 + r * (ph - OVERLAP) - MARGIN;

        doc.saveGraphicsState();
        doc.rect(MARGIN, MARGIN, pw, ph, null);
        doc.clip();
        doc.discardPath();
        for (const p of d.paths) {
          const s = STYLE[p.kind];
          doc.setLineWidth(s.w);
          doc.setLineDashPattern(s.dash, 0);
          doc.setDrawColor(...s.rgb);
          const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
          const rel: [number, number][] = [];
          for (let i = 1; i < pts.length; i++) rel.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
          doc.lines(rel, pts[0].x - ox, pts[0].y - oy, [1, 1], 'S', false);
        }
        doc.setTextColor(17, 17, 17);
        for (const l of d.labels) {
          doc.setFontSize(l.size * 2.83465);
          doc.text(l.text, l.x - ox, l.y - oy, { align: l.anchor === 'middle' ? 'center' : 'left', angle: l.vertical ? 90 : 0 });
        }
        doc.restoreGraphicsState();

        if (rows * cols > 1) {
          doc.setLineWidth(0.1);
          doc.setLineDashPattern([2, 2], 0);
          doc.setDrawColor(150, 150, 150);
          doc.rect(MARGIN, MARGIN, pw, ph, 'S');
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text(`${d.title} – sheet row ${r + 1}/${rows}, column ${c + 1}/${cols} – sheets overlap ${OVERLAP} mm`, MARGIN, MARGIN - 3);
        }
      }
    }
  }
  return doc.output('arraybuffer');
}
