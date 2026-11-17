import type { Params } from './params';

export interface Pt {
  x: number;
  y: number;
}

export interface Issue {
  level: 'error' | 'warn' | 'info';
  msg: string;
}

/**
 * A "U": two straight flanks converging downwards at the taper angle, joined
 * by a tangent arc. Every contour of the joint (template edges, cut edges at
 * any depth) is such a U; they all share the taper angle and differ only in
 * arc centre and radius, because they are offsets of each other.
 *
 * 2D frame: x across the joint (0 = centreline), y downwards, y = 0 at the
 * top face of the wood.
 */
export interface U {
  yc: number;
  rho: number;
}

export interface Joint {
  p: Params;
  width: number;
  height: number;
  /** Taper and bit angle in radians. */
  beta: number;
  alpha: number;
  /** Guide offset: (bushing Ø − bit Ø) / 2. Negative if the bit is larger. */
  offset: number;
  /** Bit depth below the wood surface for the socket / the tenon. */
  socketDepth: number;
  tenonDepth: number;
  /** Bit Ø at the wood surface when cutting the socket. */
  neckDiameter: number;
  slot: U; // socket template edge
  tongue: U; // tenon template edge
  socketDeep: U; // socket at full depth (the nominal contour)
  socketSurface: U; // socket opening on the beam face
  tenonEnd: U; // tenon at its end face (widest)
  tenonShoulder: U; // tenon at the shoulder (narrowest)
  /** How far the joist top ends up below (+) or above (−) the beam top. */
  seatDrop: number;
  issues: Issue[];
  ok: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Half width of a U at height y (valid on the straight flanks). */
export function halfWidthAt(u: U, beta: number, y: number): number {
  return u.rho / Math.cos(beta) + (u.yc - y) * Math.tan(beta);
}

/** Polyline right flank top → round bottom → left flank top. */
export function uContour(u: U, beta: number, yTop: number, arcSegments = 64): Pt[] {
  const pts: Pt[] = [{ x: halfWidthAt(u, beta, yTop), y: yTop }];
  for (let i = 0; i <= arcSegments; i++) {
    const th = beta + ((Math.PI - 2 * beta) * i) / arcSegments;
    pts.push({ x: u.rho * Math.cos(th), y: u.yc + u.rho * Math.sin(th) });
  }
  pts.push({ x: -halfWidthAt(u, beta, yTop), y: yTop });
  return pts;
}

/** Radius of the dovetail bit at a given distance above its tip. */
export function bitRadiusAt(p: Params, aboveTip: number): number {
  return p.bitDiameter / 2 - aboveTip * Math.tan(rad(p.bitAngleDeg));
}

export function computeJoint(p: Params): Joint {
  const issues: Issue[] = [];
  const err = (msg: string) => issues.push({ level: 'error', msg });
  const warn = (msg: string) => issues.push({ level: 'warn', msg });
  const info = (msg: string) => issues.push({ level: 'info', msg });

  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number' && !Number.isFinite(v)) err(`"${k}" is not a number.`);
  }
  const positive: (keyof Params)[] = [
    'joistWidth', 'joistHeight', 'beamWidth', 'beamHeight', 'tenonLength',
    'bitDiameter', 'bushingDiameter', 'templateThickness', 'border', 'leadIn',
  ];
  for (const k of positive) if (!((p[k] as number) > 0)) err(`"${k}" must be greater than 0.`);

  const width = p.autoSize ? Math.round(p.joistWidth * 0.6) : p.tailWidth;
  const height = p.autoSize ? Math.round(p.joistHeight * 0.7) : p.tailHeight;
  const beta = rad(p.taperDeg);
  const alpha = rad(p.bitAngleDeg);
  const tanA = Math.tan(alpha);
  const sinB = Math.sin(beta);

  const offset = (p.bushingDiameter - p.bitDiameter) / 2;
  const tenonDepth = p.tenonLength;
  const socketDepth = p.tenonLength + p.depthGap;
  const neckDiameter = p.bitDiameter - 2 * socketDepth * tanA;

  // Nominal contour = socket at full depth. Its arc is tangent to both flanks
  // and bottoms out at `height`.
  const r = ((width / 2) * Math.cos(beta) - height * sinB) / (1 - sinB);
  const yc = height - r;

  // The bit is widest at its tip, so each template edge is the cut contour at
  // the tip plane shifted by the guide offset. Socket and tenon flanks are
  // parallel (same bit), so one clearance value holds over the whole depth:
  //   slot − tongue = 2·offset + socketDepth·tan(alpha) + clearance
  const socketDeep: U = { yc, rho: r };
  const slot: U = { yc, rho: r + offset };
  const socketSurface: U = { yc, rho: r - socketDepth * tanA };

  // Bottom relief lifts the tenon's arc centre; the flanks are wider apart
  // further up, so the radius grows by relief·sin(beta) to keep the flank
  // lines where they are.
  const ycT = yc - p.bottomRelief;
  const lift = p.bottomRelief * sinB;
  const tongueRho = r - p.clearance - offset - socketDepth * tanA + lift;
  const tongue: U = { yc: ycT, rho: tongueRho };
  const tenonShoulder: U = { yc: ycT, rho: tongueRho + offset };
  const tenonEnd: U = { yc: ycT, rho: tongueRho + offset + tenonDepth * tanA };

  const bottomGap = p.clearance + p.bottomRelief * (1 - sinB);
  let seatDrop: number;
  if (sinB > 1e-6) seatDrop = p.clearance >= 0 ? Math.min(p.clearance / sinB, bottomGap) : p.clearance / sinB;
  else seatDrop = Math.max(0, bottomGap);

  const f = (n: number) => n.toFixed(1);

  if (!(r > 0) || !(yc > 0)) {
    err('Dovetail shape is impossible: the height must be larger than the bottom radius and the flanks must not cross. Increase the width, or reduce the height or taper.');
  } else {
    if (r < p.bitDiameter / 2) {
      err(`The round bottom of the socket (radius ${f(r)} mm) is smaller than the bit radius (${f(p.bitDiameter / 2)} mm). Increase the width, reduce the height or taper, or use a smaller bit.`);
    }
    if (tongue.rho < 2) {
      err(`The tenon template would taper to nothing (tip radius ${f(tongue.rho)} mm). Increase the width, or reduce tenon length, bit angle, guide Ø or clearance.`);
    }
  }
  if (neckDiameter <= 0) err('The bit angle and cutting depth do not fit the bit diameter (the bit would have no neck). Reduce tenon length or bit angle.');
  else if (neckDiameter < 6) warn(`The bit is only ${f(neckDiameter)} mm thick at the wood surface — check the real bit, it is probably shorter or less steep than entered.`);

  if (socketDepth > p.bitCutLength) warn(`Socket depth (${f(socketDepth)} mm) exceeds the cutting length of the bit (${f(p.bitCutLength)} mm).`);
  if (offset < 0) warn('The bit is larger than the template guide: it cannot be pulled back through the guide. Always enter and leave the cut sideways and never lift the router while the bit is under the template.');
  else if (offset < 1) warn('Bit and template guide are almost the same diameter. Check that the bit really passes through the guide without touching it.');
  if (p.bushingLength >= p.templateThickness) warn(`The guide collar (${f(p.bushingLength)} mm) is not shorter than the template plate (${f(p.templateThickness)} mm): the router would ride on the collar instead of the template. Use a thicker plate or shorten the collar.`);
  if (socketDepth > p.beamWidth / 2) warn('The socket is deeper than half the main beam width.');
  if (height > p.joistHeight) warn('The dovetail is taller than the joist.');
  if (height > p.beamHeight - 15) warn('Less than 15 mm of wood remains under the socket in the main beam.');
  if (width > p.joistWidth - 16) warn('The shoulders left and right of the tenon are narrower than 8 mm.');
  if (p.taperDeg > 0 && p.clearance > 0 && seatDrop > 0.5) warn(`With this clearance the tapered tenon slides ${f(seatDrop)} mm further down before it is tight, so the joist ends up below the beam top. Use 0 clearance for a flush wedge fit, or shift the template instead.`);
  if (p.supportBracket && !p.frame) warn('The support bracket needs the support frame around the tenon template; it is left out.');
  else if (p.supportBracket && !(p.screwDiameter > 0)) warn('The support bracket is screwed on; enter a screw hole Ø to get it.');
  if (p.taperDeg === 0 && p.bottomRelief > 0) info('Without taper the joist rests on the round bottom; the bottom relief lowers it by the same amount.');
  if (p.taperDeg > 0) info(`Fine tuning: moving a template 1 mm up or down on the wood changes the flank fit by ${(sinB).toFixed(3)} mm per side.`);

  return {
    p, width, height, beta, alpha, offset, socketDepth, tenonDepth, neckDiameter,
    slot, tongue, socketDeep, socketSurface, tenonEnd, tenonShoulder,
    seatDrop, issues,
    ok: !issues.some((i) => i.level === 'error'),
  };
}
