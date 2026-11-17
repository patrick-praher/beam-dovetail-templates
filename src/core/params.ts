import type { Messages } from '../i18n/en';

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
  supportBracket: boolean;
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
  supportBracket: false,
  bedX: 256,
  bedY: 256,
};

/** Labels and hints live in the translations (`fields` in src/i18n). */
export interface Field {
  key: keyof Params;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  /** Disabled while "auto size" is on. */
  auto?: boolean;
}

export interface FieldGroup {
  id: keyof Messages['groups'];
  fields: Field[];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'wood',
    fields: [
      { key: 'joistWidth', unit: 'mm', min: 20 },
      { key: 'joistHeight', unit: 'mm', min: 20 },
      { key: 'beamWidth', unit: 'mm', min: 20 },
      { key: 'beamHeight', unit: 'mm', min: 20 },
    ],
  },
  {
    id: 'dovetail',
    fields: [
      { key: 'autoSize' },
      { key: 'tailWidth', unit: 'mm', min: 5, auto: true },
      { key: 'tailHeight', unit: 'mm', min: 5, auto: true },
      { key: 'taperDeg', unit: '°', step: 0.5, min: 0, max: 15 },
      { key: 'tenonLength', unit: 'mm', step: 0.5, min: 3 },
      { key: 'depthGap', unit: 'mm', step: 0.5, min: 0 },
    ],
  },
  {
    id: 'router',
    fields: [
      { key: 'bitDiameter', unit: 'mm', step: 0.1, min: 3 },
      { key: 'bitAngleDeg', unit: '°', step: 0.5, min: 0, max: 30 },
      { key: 'bitCutLength', unit: 'mm', step: 0.5, min: 1 },
      { key: 'bushingDiameter', unit: 'mm', step: 0.1, min: 3 },
      { key: 'bushingLength', unit: 'mm', step: 0.5, min: 0 },
    ],
  },
  {
    id: 'fit',
    fields: [
      { key: 'clearance', unit: 'mm', step: 0.05 },
      { key: 'bottomRelief', unit: 'mm', step: 0.5, min: 0 },
    ],
  },
  {
    id: 'template',
    fields: [
      { key: 'templateThickness', unit: 'mm', step: 0.5, min: 2 },
      { key: 'border', unit: 'mm', min: 15 },
      { key: 'leadIn', unit: 'mm', min: 5 },
      { key: 'lipDepth', unit: 'mm', min: 0 },
      { key: 'screwDiameter', unit: 'mm', step: 0.5, min: 0 },
      { key: 'frame' },
      { key: 'supportBracket' },
      { key: 'bedX', unit: 'mm', min: 50 },
      { key: 'bedY', unit: 'mm', min: 50 },
    ],
  },
];
