import { beforeAll, describe, expect, it } from 'vitest';
import { buildDrawings } from '../src/core/drawing';
import { computeJoint } from '../src/core/joint';
import { initKernel, type Kernel } from '../src/core/kernel';
import { DEFAULTS, type Params } from '../src/core/params';
import { buildModel, type MeshData } from '../src/core/shapes';
import { drawingToDxf } from '../src/export/dxf';
import { drawingsToPdf } from '../src/export/pdf';
import { meshToStl } from '../src/export/stl';
import { drawingToSvg } from '../src/export/svg';

let k: Kernel;
beforeAll(async () => {
  k = await initKernel();
});

const build = (over: Partial<Params> = {}) => {
  const j = computeJoint({ ...DEFAULTS, ...over });
  return { j, m: buildModel(k, j) };
};

function volume(m: MeshData): number {
  let v = 0;
  const P = m.positions;
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
      - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
      + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}

function zRange(m: MeshData): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 2; i < m.positions.length; i += 3) {
    lo = Math.min(lo, m.positions[i]);
    hi = Math.max(hi, m.positions[i]);
  }
  return [lo, hi];
}

describe('solids', () => {
  it('builds closed, positive-volume solids', () => {
    const { m } = build();
    for (const mesh of [m.socket.mesh, m.socket.printMesh, m.tenon.mesh, m.tenon.printMesh, m.beam, m.joist]) {
      expect(volume(mesh)).toBeGreaterThan(1000);
    }
  });

  it('print orientation puts the router face on the bed', () => {
    const { m, j } = build();
    const [lo, hi] = zRange(m.socket.printMesh);
    expect(lo).toBeCloseTo(0, 5);
    expect(hi).toBeCloseTo(j.p.templateThickness + j.p.lipDepth, 5);
  });

  it('socket removes about the expected amount of wood', () => {
    const { m, j } = build();
    const p = j.p;
    const len = 2 * (m.socket.bounds.x1) + 160;
    const removed = len * p.beamWidth * p.beamHeight - volume(m.beam);
    // Roughly width × height × depth of the socket.
    const rough = j.width * j.height * j.socketDepth;
    expect(removed).toBeGreaterThan(rough * 0.5);
    expect(removed).toBeLessThan(rough);
  });

  it('handles frame off, no lips, no holes, no taper', () => {
    const { m } = build({ frame: false, lipDepth: 0, screwDiameter: 0, taperDeg: 0 });
    expect(m.tenon.lips).toHaveLength(0);
    expect(m.tenon.outline).toHaveLength(1);
    expect(volume(m.tenon.mesh)).toBeGreaterThan(1000);
  });

  it('support bracket stays clear of the bit and prints flat', () => {
    const { m, j } = build({ supportBracket: true });
    const br = m.tenon.bracket!;
    expect(br).toBeDefined();
    expect(volume(br.mesh)).toBeGreaterThan(1000);
    expect(volume(br.printMesh)).toBeCloseTo(volume(br.mesh), 0);
    expect(zRange(br.printMesh)).toEqual([0, br.size[0]]);
    // Two extra screw holes in the frame.
    expect(m.tenon.outline.length).toBe(build().m.tenon.outline.length + 2);
    // Nothing of the bracket in the zone the bit sweeps (above the bit tip,
    // inside the frame window minus the guide offset).
    const P = br.mesh.positions;
    const window = m.tenon.bounds.y1 - j.p.border;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 2] > -j.tenonDepth) expect(-P[i + 1]).toBeGreaterThanOrEqual(window - Math.min(0, j.offset) - 1e-3);
    }
  });

  it('leaves the bracket out without frame or screws', () => {
    expect(build({ supportBracket: true, frame: false }).m.tenon.bracket).toBeUndefined();
    expect(build({ supportBracket: true, screwDiameter: 0 }).m.tenon.bracket).toBeUndefined();
  });

  it('exports every format', () => {
    const { m, j } = build();
    const drawings = buildDrawings(j, m);
    expect(drawings).toHaveLength(2);
    for (const d of drawings) {
      expect(drawingToSvg(d, true)).toMatch(/^<svg[^>]+width="[\d.]+mm"/);
      expect(drawingToDxf(d)).toContain('TEMPLATE');
    }
    const stl = meshToStl(m.socket.printMesh);
    expect(stl.byteLength).toBe(84 + (m.socket.printMesh.indices.length / 3) * 50);
    expect(drawingsToPdf(drawings, 'a4').byteLength).toBeGreaterThan(1000);
  });
});
