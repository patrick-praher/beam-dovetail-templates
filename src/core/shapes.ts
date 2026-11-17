import type { CrossSection, Manifold } from 'manifold-3d';
import type { Kernel } from './kernel';
import { halfWidthAt, uContour, type Joint, type Pt, type U } from './joint';

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Separate L-bracket that ties the bottom of the tenon frame to the joist. */
export interface Bracket {
  mesh: MeshData;
  /** Lying on its side: the L profile is on the bed, no overhangs. */
  printMesh: MeshData;
  /** Outline seen from the router side, in the 2D joint frame. */
  footprint: Rect;
  size: [number, number, number];
  /** Suggested screw lengths in mm. */
  frameScrew: number;
  joistScrew: number;
}

export interface TemplateModel {
  name: string;
  /** Closed polygons (outer boundaries and holes) in the 2D joint frame. */
  outline: Pt[][];
  /** Stop lips on the wood side of the plate. */
  lips: Rect[];
  bounds: Rect;
  /** On the wood: plate at z ∈ [0, T], wood behind z = 0, 3D Y = −y. */
  mesh: MeshData;
  /** Turned over for printing: router face on the bed. */
  printMesh: MeshData;
  bracket?: Bracket;
}

export interface Model {
  socket: TemplateModel;
  tenon: TemplateModel;
  /** Main beam with socket; routed face at z = 0, wood at z < 0. */
  beam: MeshData;
  /** Joist with tenon; tenon end face at z = 0, wood at z < 0. */
  joist: MeshData;
}

const CORNER = 3;
const NOTCH = 3;
const BRACKET_WIDTH = 40;
/** Wood left under the joist screw's counterbore in the bracket foot. */
const BRACKET_SCREW_GRIP = 12;

export function buildModel(k: Kernel, j: Joint): Model {
  const { p, beta } = j;
  const T = p.templateThickness;
  const B = p.border;
  const cb = Math.min(3.5, T / 2);
  // Wasm objects are not garbage collected; everything created here is
  // registered and freed once the meshes are extracted.
  const trash: { delete(): void }[] = [];
  const keep = <O extends { delete(): void }>(o: O): O => {
    trash.push(o);
    return o;
  };

  // --- 2D helpers (input in the joint frame, y down; kernel frame is y up) ---
  const cs = (pts: Pt[]): CrossSection => {
    const poly = pts.map((q): [number, number] => [q.x, -q.y]);
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (area < 0) poly.reverse();
    return keep(new k.CrossSection([poly], 'Positive'));
  };
  const rect = (r: Rect) => cs([{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }]);
  const roundRect = (r: Rect) =>
    keep(rect({ x0: r.x0 + CORNER, y0: r.y0 + CORNER, x1: r.x1 - CORNER, y1: r.y1 - CORNER }).offset(CORNER, 'Round', 2, 32));
  const circle = (x: number, y: number, d: number) => keep(keep(k.CrossSection.circle(d / 2, 32)).translate([x, -y]));
  const add = (a: CrossSection, b: CrossSection) => keep(a.add(b));
  const sub = (a: CrossSection, b: CrossSection) => keep(a.subtract(b));
  const uShape = (u: U, yTop: number) => cs(uContour(u, beta, yTop));
  /** V notch in a plate edge, tip pointing in direction (dx, dy). */
  const notch = (x: number, y: number, dx: number, dy: number) =>
    cs([
      { x: x - dx * 0.5 - dy * NOTCH * 0.6, y: y - dy * 0.5 - dx * NOTCH * 0.6 },
      { x: x - dx * 0.5 + dy * NOTCH * 0.6, y: y - dy * 0.5 + dx * NOTCH * 0.6 },
      { x: x + dx * NOTCH, y: y + dy * NOTCH },
    ]);
  const polygons = (c: CrossSection): Pt[][] => c.toPolygons().map((poly) => poly.map(([x, y]) => ({ x, y: -y })));

  // --- 3D helpers ---
  const extrude = (c: CrossSection, z0: number, z1: number): Manifold => keep(keep(c.extrude(z1 - z0)).translate([0, 0, z0]));
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Manifold =>
    keep(keep(k.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
  /** Solid between U contours at different z; exact because the Us are convex offsets of each other. */
  const loft = (sections: { u: U; z: number }[], yTop: number): Manifold => {
    const pts: [number, number, number][] = [];
    for (const s of sections) for (const q of uContour(s.u, beta, yTop)) pts.push([q.x, -q.y, s.z]);
    return keep(k.Manifold.hull(pts));
  };
  const meshOf = (m: Manifold): MeshData => {
    const mesh = m.getMesh();
    const n = mesh.numProp;
    const positions = new Float32Array((mesh.vertProperties.length / n) * 3);
    for (let i = 0, o = 0; i < mesh.vertProperties.length; i += n) {
      positions[o++] = mesh.vertProperties[i];
      positions[o++] = mesh.vertProperties[i + 1];
      positions[o++] = mesh.vertProperties[i + 2];
    }
    return { positions, indices: new Uint32Array(mesh.triVerts) };
  };
  /** Half turn about X: router face (z = T) lands on the bed (z = 0). */
  const flipped = (m: MeshData): MeshData => {
    const positions = new Float32Array(m.positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = m.positions[i];
      positions[i + 1] = -m.positions[i + 1];
      positions[i + 2] = T - m.positions[i + 2];
    }
    return { positions, indices: m.indices };
  };
  /** (X, Y, Z) → (Y, Z, X), then moved to the origin. A rotation, so normals stay outward. */
  const onSide = (m: MeshData): MeshData => {
    const positions = new Float32Array(m.positions.length);
    const min = [Infinity, Infinity, Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        positions[i + a] = m.positions[i + ((a + 1) % 3)];
        min[a] = Math.min(min[a], positions[i + a]);
      }
    }
    for (let i = 0; i < positions.length; i++) positions[i] -= min[i % 3];
    return { positions, indices: m.indices };
  };
  /** Cylinder along the joint y axis from y0 to y1. */
  const rodY = (x: number, y0: number, y1: number, z: number, d: number): Manifold =>
    keep(keep(keep(k.Manifold.cylinder(y1 - y0, d / 2, d / 2, 32)).rotate([90, 0, 0])).translate([x, -y0, z]));
  /** Cylinder along z from z0 to z1. */
  const rodZ = (x: number, y: number, z0: number, z1: number, d: number): Manifold =>
    keep(keep(k.Manifold.cylinder(z1 - z0, d / 2, d / 2, 32)).translate([x, -y, z0]));

  const template = (name: string, plate: CrossSection, holes: Pt[], lips: Rect[], bounds: Rect): TemplateModel => {
    let plate2d = plate;
    for (const h of holes) plate2d = sub(plate2d, circle(h.x, h.y, p.screwDiameter));
    let solid = extrude(plate2d, 0, T);
    for (const h of holes) solid = keep(solid.subtract(extrude(circle(h.x, h.y, p.screwDiameter * 2), T - cb, T + 1)));
    for (const l of lips) solid = keep(solid.add(extrude(rect(l), -p.lipDepth, 0.5)));
    const mesh = meshOf(solid);
    return { name, outline: polygons(plate2d), lips, bounds, mesh, printMesh: flipped(mesh) };
  };

  const hasHoles = p.screwDiameter > 0;
  const hasLips = p.lipDepth > 0;
  // How far the bit tip reaches past the template edge (only if bit > guide).
  const overreach = Math.max(0, -j.offset);
  const guideMax = Math.max(p.bushingDiameter, p.bitDiameter);

  try {
    // ---------- Socket template (main beam) ----------
    const E = p.leadIn;
    const slotTop = halfWidthAt(j.slot, beta, -E);
    const sHalf = slotTop + B;
    const sBottom = j.slot.yc + j.slot.rho + B;
    const sBounds: Rect = { x0: -sHalf, y0: -E, x1: sHalf, y1: sBottom };
    let sPlate = sub(roundRect(sBounds), uShape(j.slot, -E - 5));
    sPlate = sub(sPlate, notch(0, sBottom, 0, -1));
    sPlate = sub(sPlate, notch(-sHalf, 0, 1, 0));
    sPlate = sub(sPlate, notch(sHalf, 0, -1, 0));
    const sHoles: Pt[] = [];
    if (hasHoles) {
      const hx = sHalf - B / 2;
      const yLow = Math.min(sBottom - B / 2, p.beamHeight - 12);
      const yHigh = Math.min(20, yLow - 30);
      for (const y of yLow - yHigh >= 30 ? [yHigh, yLow] : [yLow]) sHoles.push({ x: -hx, y }, { x: hx, y });
    }
    const sLips: Rect[] = [];
    const lipInner = slotTop + overreach + 3;
    if (hasLips && sHalf - CORNER - lipInner >= 8) {
      sLips.push({ x0: lipInner, y0: -E + CORNER, x1: sHalf - CORNER, y1: 0 });
      sLips.push({ x0: -sHalf + CORNER, y0: -E + CORNER, x1: -lipInner, y1: 0 });
    }
    const socket = template('socket', sPlate, sHoles, sLips, sBounds);

    // ---------- Tenon template (joist end) ----------
    const Et = Math.max(8, j.offset + 3);
    const tongueTop = halfWidthAt(j.tongue, beta, -Et);
    const tongueBottom = j.tongue.yc + j.tongue.rho;
    const tongue = uShape(j.tongue, -Et - 1);
    let tPlate: CrossSection;
    let tBounds: Rect;
    let windowBottom: number | undefined;
    if (p.frame) {
      // The window lets the guide run fully clear of the joist on three
      // sides, so the bit can enter from outside the wood.
      const wHalf = Math.max(p.joistWidth / 2 + guideMax / 2 + 2, tongueTop + p.bushingDiameter + 2);
      const wBottom = Math.max(p.joistHeight + guideMax / 2 + 2, tongueBottom + p.bushingDiameter + 2);
      windowBottom = wBottom;
      tBounds = { x0: -wHalf - B, y0: -Et - B, x1: wHalf + B, y1: wBottom + B };
      tPlate = add(sub(roundRect(tBounds), rect({ x0: -wHalf, y0: -Et, x1: wHalf, y1: wBottom })), tongue);
      tPlate = sub(tPlate, notch(0, tBounds.y1, 0, -1));
      tPlate = sub(tPlate, notch(tBounds.x0, 0, 1, 0));
      tPlate = sub(tPlate, notch(tBounds.x1, 0, -1, 0));
    } else {
      const bar: Rect = { x0: -tongueTop - B, y0: -Et - B, x1: tongueTop + B, y1: -Et };
      tBounds = { ...bar, y1: tongueBottom };
      tPlate = add(roundRect(bar), tongue);
    }
    tPlate = sub(tPlate, notch(0, tBounds.y0, 0, 1));
    const tHoles: Pt[] = [];
    const head = p.screwDiameter;
    if (hasHoles && j.tongue.rho >= head + 3) {
      const upper = Math.max(15, j.tongue.yc * 0.3);
      if (j.tongue.yc - upper >= 25) tHoles.push({ x: 0, y: upper });
      tHoles.push({ x: 0, y: j.tongue.yc });
    }
    // Support bracket: its leg sits under the frame's bottom bar, beyond the
    // bit's reach; its foot runs below the bit tip to the underside of the
    // joist. Two screws hold it to the frame, one goes up into the joist.
    let bracketPlan: { yLeg: number; yOut: number; zTop: number; zBot: number; sx: number; sy: number } | undefined;
    if (windowBottom !== undefined && p.supportBracket && hasHoles) {
      const yLeg = windowBottom + overreach + 1;
      const yOut = tBounds.y1 - NOTCH - 1;
      const foot = Math.max(12, p.screwDiameter * 2 + 7);
      const zTop = -(j.tenonDepth + 2);
      bracketPlan = { yLeg, yOut, zTop, zBot: zTop - foot, sx: BRACKET_WIDTH / 4 + 2, sy: (yLeg + yOut) / 2 };
      tHoles.push({ x: -bracketPlan.sx, y: bracketPlan.sy }, { x: bracketPlan.sx, y: bracketPlan.sy });
    }
    const tLips: Rect[] = [];
    const lipHalf = halfWidthAt(j.tongue, beta, 0) - overreach - 2;
    if (hasLips && lipHalf >= 4) tLips.push({ x0: -lipHalf, y0: -Et - B + CORNER, x1: lipHalf, y1: 0 });
    const tenon = template('tenon', tPlate, tHoles, tLips, tBounds);
    if (bracketPlan) {
      const { yLeg, yOut, zTop, zBot, sx, sy } = bracketPlan;
      const hw = BRACKET_WIDTH / 2;
      const d = p.screwDiameter;
      let solid = keep(box(-hw, hw, -yOut, -yLeg, zBot, 0).add(box(-hw, hw, -yOut, -p.joistHeight, zBot, zTop)));
      const pilot = Math.min(-zBot - 3, 20);
      for (const x of [-sx, sx]) solid = keep(solid.subtract(rodZ(x, sy, -pilot, 1, d * 0.75)));
      const zMid = (zTop + zBot) / 2;
      solid = keep(solid.subtract(rodY(0, p.joistHeight - 1, yOut + 1, zMid, d + 0.5)));
      const yGrip = p.joistHeight + BRACKET_SCREW_GRIP;
      const counterbored = yOut - yGrip >= 2;
      if (counterbored) solid = keep(solid.subtract(rodY(0, yGrip, yOut + 1, zMid, d * 2 + 1)));
      const grip = counterbored ? BRACKET_SCREW_GRIP : yOut - p.joistHeight;
      const up5 = (v: number) => Math.ceil(v / 5) * 5;
      const mesh = meshOf(solid);
      tenon.bracket = {
        mesh,
        printMesh: onSide(mesh),
        footprint: { x0: -hw, y0: p.joistHeight, x1: hw, y1: yOut },
        size: [BRACKET_WIDTH, yOut - p.joistHeight, -zBot],
        frameScrew: up5(T - cb + pilot * 0.8),
        joistScrew: up5(grip + 30),
      };
    }

    // ---------- Wood ----------
    const tanA = Math.tan(j.alpha);
    const beamLen = 2 * sHalf + 160;
    const pocket = loft(
      [
        { u: { yc: j.socketSurface.yc, rho: j.socketSurface.rho - tanA }, z: 1 },
        { u: j.socketDeep, z: -j.socketDepth },
      ],
      -5,
    );
    const beam = keep(box(-beamLen / 2, beamLen / 2, -p.beamHeight, 0, -p.beamWidth, 0).subtract(pocket));

    const joistLen = Math.max(p.joistHeight * 1.2, 200);
    const t = j.tenonDepth;
    const tail = keep(
      loft(
        [
          { u: j.tenonEnd, z: 0 },
          { u: { yc: j.tenonShoulder.yc, rho: j.tenonShoulder.rho - tanA }, z: -t - 1 },
        ],
        -5,
      ).intersect(box(-p.joistWidth / 2, p.joistWidth / 2, -p.joistHeight, 0, -t - 1, 0)),
    );
    const joist = keep(box(-p.joistWidth / 2, p.joistWidth / 2, -p.joistHeight, 0, -joistLen, -t).add(tail));

    return { socket, tenon, beam: meshOf(beam), joist: meshOf(joist) };
  } finally {
    for (const o of trash) o.delete();
  }
}
