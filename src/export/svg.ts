import type { Drawing } from '../core/drawing';

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Line styles shared by the screen view and the downloaded file. */
export const SVG_STYLE = `
.dt-template{fill:none;stroke:#111;stroke-width:.35}
.dt-wood{fill:none;stroke:#9a6a2f;stroke-width:.25;stroke-dasharray:4 2}
.dt-cut{fill:none;stroke:#1565c0;stroke-width:.25}
.dt-cutDeep{fill:none;stroke:#1565c0;stroke-width:.25;stroke-dasharray:1.5 1.5}
.dt-center{fill:none;stroke:#777;stroke-width:.18;stroke-dasharray:8 2 1 2}
.dt-lip{fill:none;stroke:#777;stroke-width:.2;stroke-dasharray:.8 1.2}
.dt-dim{fill:none;stroke:#777;stroke-width:.15}
.dt-scale{fill:none;stroke:#111;stroke-width:.3}
.dt-text{fill:#111;font-family:Helvetica,Arial,sans-serif}
`;

/**
 * Renders a drawing as SVG. With `physical` the root element is sized in mm,
 * so the file prints 1:1.
 */
export function drawingToSvg(d: Drawing, physical: boolean): string {
  const b = d.bounds;
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const size = physical ? ` width="${n(w)}mm" height="${n(h)}mm"` : '';
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="${n(b.x0)} ${n(b.y0)} ${n(w)} ${n(h)}">`,
    `<style>${SVG_STYLE}</style>`,
  ];
  for (const p of d.paths) {
    const pts = p.pts.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
    out.push(`<${p.closed ? 'polygon' : 'polyline'} class="dt-${p.kind}" points="${pts}"/>`);
  }
  for (const l of d.labels) {
    const rot = l.vertical ? ` transform="rotate(-90 ${n(l.x)} ${n(l.y)})"` : '';
    out.push(`<text class="dt-text" x="${n(l.x)}" y="${n(l.y)}" font-size="${l.size}" text-anchor="${l.anchor}"${rot}>${esc(l.text)}</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
