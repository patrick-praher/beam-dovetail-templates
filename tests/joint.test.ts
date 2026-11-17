import { describe, expect, it } from 'vitest';
import { bitRadiusAt, computeJoint, halfWidthAt, uContour } from '../src/core/joint';
import { DEFAULTS, type Params } from '../src/core/params';

const make = (over: Partial<Params> = {}) => computeJoint({ ...DEFAULTS, ...over });

/**
 * Simulates the router independently of the closed-form radii: the cut edge
 * at a plane is the template edge shifted by (guide radius − bit radius at
 * that plane).
 */
function cutRadii(p: Params, z: number) {
  const j = computeJoint(p);
  // z = distance from the main beam face into the socket.
  const socket = j.slot.rho - (p.bushingDiameter / 2 - bitRadiusAt(p, j.socketDepth - z));
  // The same plane is (tenonLength − z) below the joist end face; the bit tip is at tenonLength.
  const tenon = j.tongue.rho + (p.bushingDiameter / 2 - bitRadiusAt(p, z));
  return { j, socket, tenon };
}

describe('joint geometry', () => {
  it('nominal contour has the requested width and height', () => {
    const j = make({ autoSize: false, tailWidth: 50, tailHeight: 100, taperDeg: 4 });
    expect(2 * halfWidthAt(j.socketDeep, j.beta, 0)).toBeCloseTo(50, 9);
    expect(j.socketDeep.yc + j.socketDeep.rho).toBeCloseTo(100, 9);
  });

  it('flank gap equals the clearance at every depth', () => {
    for (const clearance of [0, 0.2, -0.1]) {
      const p = { ...DEFAULTS, clearance, bottomRelief: 0 };
      for (const z of [0, 7, p.tenonLength]) {
        const { socket, tenon } = cutRadii(p, z);
        expect(socket - tenon).toBeCloseTo(clearance, 9);
      }
    }
  });

  it('bottom relief opens the bottom but leaves the flanks alone', () => {
    const a = make({ bottomRelief: 0 });
    const b = make({ bottomRelief: 3 });
    for (const y of [0, 30, 60]) {
      expect(halfWidthAt(b.tenonEnd, b.beta, y)).toBeCloseTo(halfWidthAt(a.tenonEnd, a.beta, y), 9);
    }
    const bottom = (j: typeof a) => j.tenonEnd.yc + j.tenonEnd.rho;
    expect(bottom(a) - bottom(b)).toBeCloseTo(3 * (1 - Math.sin(a.beta)), 9);
  });

  it('works when the bit is larger than the guide', () => {
    const p = { ...DEFAULTS, bitDiameter: 25.4, bushingDiameter: 17, bottomRelief: 0 };
    const { j, socket, tenon } = cutRadii(p, 5);
    expect(j.ok).toBe(true);
    expect(j.offset).toBeLessThan(0);
    expect(socket - tenon).toBeCloseTo(0, 9);
  });

  it('contour flanks are tangent to the arc', () => {
    const j = make();
    const pts = uContour(j.slot, j.beta, -10, 32);
    const [a, b, c] = pts;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    // Nearly collinear: the flank continues smoothly into the first arc chord.
    expect(Math.abs(cross) / (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y))).toBeLessThan(0.06);
  });

  it('seats flush with a taper and zero clearance', () => {
    expect(make().seatDrop).toBe(0);
    expect(make({ clearance: 0.1 }).seatDrop).toBeCloseTo(0.1 / Math.sin(make().beta), 6);
  });

  it('rejects impossible input', () => {
    expect(make({ autoSize: false, tailWidth: 20 }).ok).toBe(false); // bottom radius < bit radius
    expect(make({ autoSize: false, tailWidth: 30, tailHeight: 150, taperDeg: 8 }).ok).toBe(false); // flanks cross
    expect(make({ tenonLength: 60 }).ok).toBe(false); // bit has no neck
    expect(make({ joistWidth: 0 }).ok).toBe(false);
  });
});
