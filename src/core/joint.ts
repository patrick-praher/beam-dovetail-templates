import { num, t } from '../i18n';
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
  const m = t().issues;
  const label = (k: string) => t().fields[k as keyof Params]?.label ?? k;

  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number' && !Number.isFinite(v)) err(m.notANumber(label(k)));
  }
  const positive: (keyof Params)[] = [
    'joistWidth', 'joistHeight', 'beamWidth', 'beamHeight', 'tenonLength',
    'bitDiameter', 'bushingDiameter', 'templateThickness', 'border', 'leadIn',
  ];
  for (const k of positive) if (!((p[k] as number) > 0)) err(m.notPositive(label(k)));

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

  const f = (n: number) => num(n, 1);

  if (!(r > 0) || !(yc > 0)) {
    err(m.impossible);
  } else {
    if (r < p.bitDiameter / 2) {
      err(m.bottomTooSmall(f(r), f(p.bitDiameter / 2)));
    }
    if (tongue.rho < 2) {
      err(m.tongueTooThin(f(tongue.rho)));
    }
  }
  if (neckDiameter <= 0) err(m.noNeck);
  else if (neckDiameter < 6) warn(m.thinNeck(f(neckDiameter)));

  if (socketDepth > p.bitCutLength) warn(m.tooDeep(f(socketDepth), f(p.bitCutLength)));
  if (offset < 0) warn(m.bitLarger);
  else if (offset < 1) warn(m.bitSameSize);
  if (p.bushingLength >= p.templateThickness) warn(m.collarTooLong(f(p.bushingLength), f(p.templateThickness)));
  if (socketDepth > p.beamWidth / 2) warn(m.socketHalfBeam);
  if (height > p.joistHeight) warn(m.tallerThanJoist);
  if (height > p.beamHeight - 15) warn(m.thinUnderSocket);
  if (width > p.joistWidth - 16) warn(m.narrowShoulders);
  if (p.taperDeg > 0 && p.clearance > 0 && seatDrop > 0.5) warn(m.seatDrop(f(seatDrop)));
  if (p.supportBracket && !p.frame) warn(m.bracketNeedsFrame);
  else if (p.supportBracket && !(p.screwDiameter > 0)) warn(m.bracketNeedsScrews);
  if (p.taperDeg === 0 && p.bottomRelief > 0) info(m.noTaperRelief);
  if (p.taperDeg > 0) info(m.fineTuning(num(sinB, 3)));

  return {
    p, width, height, beta, alpha, offset, socketDepth, tenonDepth, neckDiameter,
    slot, tongue, socketDeep, socketSurface, tenonEnd, tenonShoulder,
    seatDrop, issues,
    ok: !issues.some((i) => i.level === 'error'),
  };
}
