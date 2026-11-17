/** All lengths in millimetres, all angles in degrees. */
export interface Params {
  // Wood
  joistWidth: number;
  joistHeight: number;
  beamWidth: number;
  beamHeight: number;
  // Dovetail
  autoSize: boolean;
  tailWidth: number;
  tailHeight: number;
  taperDeg: number;
  tenonLength: number;
  depthGap: number;
  // Router
  bitDiameter: number;
  bitAngleDeg: number;
  bitCutLength: number;
  bushingDiameter: number;
  bushingLength: number;
  // Fit
  clearance: number;
  bottomRelief: number;
  // Template
  templateThickness: number;
  border: number;
  leadIn: number;
  lipDepth: number;
  screwDiameter: number;
  frame: boolean;
  bedX: number;
  bedY: number;
}

export const DEFAULTS: Params = {
  joistWidth: 80,
  joistHeight: 160,
  beamWidth: 120,
  beamHeight: 200,
  autoSize: true,
  tailWidth: 48,
  tailHeight: 112,
  taperDeg: 3,
  tenonLength: 20,
  depthGap: 1,
  bitDiameter: 25.4,
  bitAngleDeg: 14,
  bitCutLength: 22,
  bushingDiameter: 30,
  bushingLength: 6,
  clearance: 0,
  bottomRelief: 2,
  templateThickness: 8,
  border: 30,
  leadIn: 25,
  lipDepth: 20,
  screwDiameter: 4.5,
  frame: true,
  bedX: 256,
  bedY: 256,
};

export interface Field {
  key: keyof Params;
  label: string;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  /** Disabled while "auto size" is on. */
  auto?: boolean;
}

export interface FieldGroup {
  title: string;
  fields: Field[];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Wood',
    fields: [
      { key: 'joistWidth', label: 'Joist width', unit: 'mm', min: 20, hint: 'Beam that carries the dovetail tenon on its end' },
      { key: 'joistHeight', label: 'Joist height', unit: 'mm', min: 20 },
      { key: 'beamWidth', label: 'Main beam width', unit: 'mm', min: 20, hint: 'Beam that receives the socket in its side face' },
      { key: 'beamHeight', label: 'Main beam height', unit: 'mm', min: 20 },
    ],
  },
  {
    title: 'Dovetail',
    fields: [
      { key: 'autoSize', label: 'Size from joist (60 % width, 70 % height)' },
      { key: 'tailWidth', label: 'Width at top', unit: 'mm', min: 5, auto: true, hint: 'Socket width at its deepest point, measured at the beam top' },
      { key: 'tailHeight', label: 'Height', unit: 'mm', min: 5, auto: true, hint: 'From beam top to the lowest point of the round bottom' },
      { key: 'taperDeg', label: 'Wedge taper per side', unit: '°', step: 0.5, min: 0, max: 15, hint: 'Flanks converge downwards so the joint tightens as the joist drops in. 0 = parallel' },
      { key: 'tenonLength', label: 'Tenon length', unit: 'mm', step: 0.5, min: 3 },
      { key: 'depthGap', label: 'Extra socket depth', unit: 'mm', step: 0.5, min: 0, hint: 'Socket is routed this much deeper than the tenon is long, so the shoulders close' },
    ],
  },
  {
    title: 'Router',
    fields: [
      { key: 'bitDiameter', label: 'Dovetail bit Ø (largest)', unit: 'mm', step: 0.1, min: 3 },
      { key: 'bitAngleDeg', label: 'Bit angle per side', unit: '°', step: 0.5, min: 0, max: 30, hint: 'Flank angle measured from the bit axis (e.g. 14° for a 1:4 bit)' },
      { key: 'bitCutLength', label: 'Bit cutting length', unit: 'mm', step: 0.5, min: 1 },
      { key: 'bushingDiameter', label: 'Template guide Ø (outside)', unit: 'mm', step: 0.1, min: 3 },
      { key: 'bushingLength', label: 'Template guide collar length', unit: 'mm', step: 0.5, min: 0 },
    ],
  },
  {
    title: 'Fit',
    fields: [
      { key: 'clearance', label: 'Flank clearance per side', unit: 'mm', step: 0.05, hint: 'Positive = looser, negative = tighter' },
      { key: 'bottomRelief', label: 'Bottom relief', unit: 'mm', step: 0.5, min: 0, hint: 'Gap under the tenon so a tapered joint seats on its flanks, not on the round bottom' },
    ],
  },
  {
    title: 'Template',
    fields: [
      { key: 'templateThickness', label: 'Plate thickness', unit: 'mm', step: 0.5, min: 2 },
      { key: 'border', label: 'Border / frame width', unit: 'mm', min: 15 },
      { key: 'leadIn', label: 'Socket lead-in above beam', unit: 'mm', min: 5, hint: 'How far the slot continues above the beam top so the bit starts outside the wood' },
      { key: 'lipDepth', label: 'Stop lip depth', unit: 'mm', min: 0, hint: 'Lips hook over the top face of the wood. 0 = no lips' },
      { key: 'screwDiameter', label: 'Screw hole Ø', unit: 'mm', step: 0.5, min: 0, hint: '0 = no holes (clamp the template instead)' },
      { key: 'frame', label: 'Support frame around tenon template' },
      { key: 'bedX', label: 'Print bed X', unit: 'mm', min: 50 },
      { key: 'bedY', label: 'Print bed Y', unit: 'mm', min: 50 },
    ],
  },
];
