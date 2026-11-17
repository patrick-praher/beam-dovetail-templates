import type { MeshData } from '../core/shapes';

/** Binary STL, units = mm. */
export function meshToStl(m: MeshData): ArrayBuffer {
  const tris = m.indices.length / 3;
  const buf = new ArrayBuffer(84 + tris * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris, true);
  const P = m.positions;
  let o = 84;
  for (let t = 0; t < tris; t++) {
    const a = m.indices[t * 3] * 3, b = m.indices[t * 3 + 1] * 3, c = m.indices[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz]) { view.setFloat32(o, v, true); o += 4; }
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) { view.setFloat32(o, P[i + k], true); o += 4; }
    o += 2;
  }
  return buf;
}
