import type { Drawing, LineKind } from '../core/drawing';

const LAYERS: Partial<Record<LineKind, string>> = {
  template: 'TEMPLATE',
  wood: 'WOOD',
  cut: 'CUT_SURFACE',
  cutDeep: 'CUT_DEEP',
  center: 'CENTER',
  lip: 'LIPS',
};

/** Minimal DXF (R12 polylines, mm, y up). Dimensions and text are left out. */
export function drawingToDxf(d: Drawing): string {
  const out: (string | number)[] = [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES'];
  for (const p of d.paths) {
    const layer = LAYERS[p.kind];
    if (!layer) continue;
    out.push(0, 'POLYLINE', 8, layer, 66, 1, 70, p.closed ? 1 : 0);
    for (const q of p.pts) out.push(0, 'VERTEX', 8, layer, 10, q.x.toFixed(4), 20, (-q.y).toFixed(4));
    out.push(0, 'SEQEND');
  }
  out.push(0, 'ENDSEC', 0, 'EOF');
  return out.join('\n') + '\n';
}
