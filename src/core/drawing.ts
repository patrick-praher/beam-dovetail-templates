import { num, t as messages } from '../i18n';
import { halfWidthAt, uContour, type Joint, type Pt } from './joint';
import type { Model, Rect, TemplateModel } from './shapes';

export type LineKind = 'template' | 'wood' | 'cut' | 'cutDeep' | 'center' | 'lip' | 'dim' | 'scale';

export interface Path {
  kind: LineKind;
  pts: Pt[];
  closed: boolean;
}

export interface Label {
  x: number;
  y: number;
  text: string;
  size: number;
  anchor: 'start' | 'middle';
  vertical?: boolean;
}

/** A 1:1 drawing in millimetres, y pointing down. */
export interface Drawing {
  id: 'socket' | 'tenon';
  title: string;
  paths: Path[];
  labels: Label[];
  bounds: Rect;
}

const TEXT = 3.5;
const f = (n: number) => num(Math.round(n * 10) / 10);

function base(title: string, t: TemplateModel): { paths: Path[]; labels: Label[] } {
  const paths: Path[] = t.outline.map((pts) => ({ kind: 'template', pts, closed: true }));
  for (const l of t.lips) {
    paths.push({
      kind: 'lip',
      closed: true,
      pts: [{ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y0 }, { x: l.x1, y: l.y1 }, { x: l.x0, y: l.y1 }],
    });
  }
  const b = t.bounds;
  paths.push({ kind: 'center', closed: false, pts: [{ x: 0, y: b.y0 - 6 }, { x: 0, y: b.y1 + 6 }] });
  const labels: Label[] = [{ x: b.x0, y: b.y0 - 12, text: title, size: 5, anchor: 'start' }];
  return { paths, labels };
}

function finish(id: Drawing['id'], title: string, t: TemplateModel, paths: Path[], labels: Label[], notes: string[]): Drawing {
  const b = t.bounds;
  // Overall dimensions.
  const yd = b.y1 + 8;
  paths.push({ kind: 'dim', closed: false, pts: [{ x: b.x0, y: b.y1 + 2 }, { x: b.x0, y: yd + 2 }] });
  paths.push({ kind: 'dim', closed: false, pts: [{ x: b.x1, y: b.y1 + 2 }, { x: b.x1, y: yd + 2 }] });
  paths.push({ kind: 'dim', closed: false, pts: [{ x: b.x0, y: yd }, { x: b.x1, y: yd }] });
  labels.push({ x: 0, y: yd - 1.2, text: f(b.x1 - b.x0), size: TEXT, anchor: 'middle' });
  const xd = b.x1 + 8;
  paths.push({ kind: 'dim', closed: false, pts: [{ x: b.x1 + 2, y: b.y0 }, { x: xd + 2, y: b.y0 }] });
  paths.push({ kind: 'dim', closed: false, pts: [{ x: b.x1 + 2, y: b.y1 }, { x: xd + 2, y: b.y1 }] });
  paths.push({ kind: 'dim', closed: false, pts: [{ x: xd, y: b.y0 }, { x: xd, y: b.y1 }] });
  labels.push({ x: xd - 1.2, y: (b.y0 + b.y1) / 2, text: f(b.y1 - b.y0), size: TEXT, anchor: 'middle', vertical: true });

  // 100 mm bar to verify the print scale.
  let y = yd + 12;
  const x0 = b.x0;
  paths.push({ kind: 'scale', closed: false, pts: [{ x: x0, y }, { x: x0 + 100, y }] });
  for (let i = 0; i <= 10; i++) {
    paths.push({ kind: 'scale', closed: false, pts: [{ x: x0 + i * 10, y: y - (i % 5 === 0 ? 3 : 1.5) }, { x: x0 + i * 10, y }] });
  }
  labels.push({ x: x0 + 103, y: y, text: messages().drawing.scale, size: TEXT, anchor: 'start' });
  for (const n of notes) {
    y += TEXT * 1.6;
    labels.push({ x: x0, y, text: n, size: TEXT, anchor: 'start' });
  }

  let minX = b.x0, maxX = b.x1 + 12;
  for (const p of paths) for (const q of p.pts) {
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
  }
  const textWidth = Math.max(...labels.filter((l) => l.anchor === 'start').map((l) => l.x + l.text.length * l.size * 0.52));
  return {
    id, title, paths, labels,
    bounds: { x0: minX - 4, y0: b.y0 - 20, x1: Math.max(maxX, textWidth) + 4, y1: y + 5 },
  };
}

export function buildDrawings(j: Joint, m: Model): Drawing[] {
  const { p, beta } = j;
  const T = p.templateThickness;
  const txt = messages().drawing;
  const router = txt.router(f(p.bitDiameter), f(p.bitAngleDeg), f(p.bushingDiameter), f(T));

  // Socket template on the side face of the main beam.
  const sTitle = txt.socketTitle;
  const s = base(sTitle, m.socket);
  const sb = m.socket.bounds;
  for (const y of [0, p.beamHeight]) {
    s.paths.push({ kind: 'wood', closed: false, pts: [{ x: sb.x0 - 10, y }, { x: sb.x1 + 10, y }] });
  }
  s.paths.push({ kind: 'cut', closed: false, pts: uContour(j.socketSurface, beta, 0) });
  s.paths.push({ kind: 'cutDeep', closed: false, pts: uContour(j.socketDeep, beta, 0) });
  s.labels.push({ x: sb.x0 - 10, y: -1.5, text: txt.beamTop, size: 3, anchor: 'start' });
  const socket = finish('socket', sTitle, m.socket, s.paths, s.labels, [
    txt.slot(f(2 * halfWidthAt(j.slot, beta, 0)), f(j.slot.rho)),
    router,
    txt.socketDepth(f(T + j.socketDepth), f(j.socketDepth)),
    txt.socketLegend,
    ...txt.disclaimer,
  ]);

  // Tenon template on the end grain of the joist.
  const tTitle = txt.tenonTitle;
  const t = base(tTitle, m.tenon);
  const hw = p.joistWidth / 2;
  t.paths.push({
    kind: 'wood',
    closed: true,
    pts: [{ x: -hw, y: 0 }, { x: hw, y: 0 }, { x: hw, y: p.joistHeight }, { x: -hw, y: p.joistHeight }],
  });
  t.paths.push({ kind: 'cut', closed: false, pts: uContour(j.tenonEnd, beta, 0) });
  t.paths.push({ kind: 'cutDeep', closed: false, pts: uContour(j.tenonShoulder, beta, 0) });
  const br = m.tenon.bracket;
  if (br) {
    const r = br.footprint;
    t.paths.push({ kind: 'lip', closed: true, pts: [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }] });
  }
  const tenon = finish('tenon', tTitle, m.tenon, t.paths, t.labels, [
    txt.tongue(f(2 * halfWidthAt(j.tongue, beta, 0)), f(j.tongue.rho)),
    router,
    txt.tenonDepth(f(T + j.tenonDepth), f(j.tenonDepth)),
    txt.tenonLegend,
    ...txt.disclaimer,
    ...(br
      ? [txt.bracket(br.size.map((v) => f(v)).join(' × '), f(p.screwDiameter), br.frameScrew, br.joistScrew)]
      : []),
  ]);

  return [socket, tenon];
}
