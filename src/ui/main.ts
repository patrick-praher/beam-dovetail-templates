import wasmUrl from 'manifold-3d/manifold.wasm?url';
import './style.css';
import { buildDrawings, type Drawing } from '../core/drawing';
import { computeJoint, halfWidthAt, type Joint } from '../core/joint';
import { initKernel, type Kernel } from '../core/kernel';
import { DEFAULTS, FIELD_GROUPS, type Params } from '../core/params';
import { buildModel, type Model } from '../core/shapes';
import { drawingToDxf } from '../export/dxf';
import { drawingToSvg } from '../export/svg';
import { meshToStl } from '../export/stl';
import { View3D, type SceneItem } from './view3d';

const STORE_KEY = 'dovetail-params-v1';
const WOOD_BEAM = 0xd9b380;
const WOOD_JOIST = 0xc0894a;
const PLASTIC = 0x2f7fd6;
const BRACKET = 0xe0702a;

type ViewName = 'drawings' | 'joint' | 'socket' | 'tenon';

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const form = $<HTMLFormElement>('form');
const drawingsEl = $('drawings');
const threeEl = $('three');
const blockedEl = $('blocked');
const explodeWrap = $('explode-wrap');
const explode = $<HTMLInputElement>('explode');

let params = loadParams();
let view: ViewName = 'drawings';
let kernel: Kernel | undefined;
let view3d: View3D | undefined;
let current: { joint: Joint; model: Model; drawings: Drawing[] } | undefined;

function loadParams(): Params {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const merged: Record<string, unknown> = { ...DEFAULTS };
      for (const k of Object.keys(DEFAULTS)) {
        if (typeof saved[k] === typeof merged[k]) merged[k] = saved[k];
      }
      return merged as unknown as Params;
    }
  } catch {
    // Storage unavailable or corrupt: fall back to defaults.
  }
  return { ...DEFAULTS };
}

function saveParams() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(params));
  } catch {
    // Not persisted; the app works without it.
  }
}

function buildForm() {
  form.replaceChildren();
  for (const group of FIELD_GROUPS) {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = group.title;
    fs.append(legend);
    for (const field of group.fields) {
      const row = document.createElement('div');
      const label = document.createElement('label');
      label.htmlFor = `f-${field.key}`;
      label.textContent = field.label;
      const input = document.createElement('input');
      input.id = `f-${field.key}`;
      input.name = field.key;
      const value = params[field.key];
      if (typeof value === 'boolean') {
        row.className = 'field check';
        input.type = 'checkbox';
        input.checked = value;
        row.append(input, label);
      } else {
        row.className = 'field';
        input.type = 'number';
        input.value = String(value);
        input.step = String(field.step ?? 1);
        if (field.min !== undefined) input.min = String(field.min);
        if (field.max !== undefined) input.max = String(field.max);
        const wrap = document.createElement('div');
        wrap.className = 'unit';
        const unit = document.createElement('span');
        unit.textContent = field.unit ?? '';
        wrap.append(input, unit);
        row.append(label, wrap);
      }
      if (field.hint) {
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = field.hint;
        row.append(hint);
      }
      fs.append(row);
    }
    form.append(fs);
  }
}

function readForm() {
  const next: Record<string, unknown> = { ...params };
  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      const input = form.elements.namedItem(field.key) as HTMLInputElement;
      next[field.key] = input.type === 'checkbox' ? input.checked : input.valueAsNumber;
    }
  }
  params = next as unknown as Params;
}

function syncAutoFields(joint: Joint) {
  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      if (!field.auto) continue;
      const input = form.elements.namedItem(field.key) as HTMLInputElement;
      input.disabled = params.autoSize;
      if (params.autoSize) input.value = String(field.key === 'tailWidth' ? joint.width : joint.height);
    }
  }
}

const mm = (v: number) => `${v.toFixed(1)} mm`;

function renderResults(j: Joint, m?: Model) {
  const p = j.p;
  const rows: [string, string][] = [
    ['Dovetail width at top × height', `${mm(j.width)} × ${mm(j.height)}`],
    ['Guide offset (guide Ø − bit Ø) / 2', mm(j.offset)],
    ['Socket: slot width at beam top', mm(2 * halfWidthAt(j.slot, j.beta, 0))],
    ['Socket: opening on the beam face, at top', mm(2 * halfWidthAt(j.socketSurface, j.beta, 0))],
    ['Socket: bit depth below router base', mm(p.templateThickness + j.socketDepth)],
    ['Tenon: tongue width at joist top', mm(2 * halfWidthAt(j.tongue, j.beta, 0))],
    ['Tenon: width at end face / at shoulder, at top', `${mm(2 * halfWidthAt(j.tenonEnd, j.beta, 0))} / ${mm(2 * halfWidthAt(j.tenonShoulder, j.beta, 0))}`],
    ['Tenon: bit depth below router base', mm(p.templateThickness + j.tenonDepth)],
    ['Joist top relative to beam top when seated', Math.abs(j.seatDrop) < 0.05 ? 'flush' : `${mm(Math.abs(j.seatDrop))} ${j.seatDrop > 0 ? 'below' : 'above'}`],
  ];
  if (m) {
    const br = m.tenon.bracket;
    if (br) {
      rows.push(['Support bracket size', `${br.size.map((v) => v.toFixed(0)).join(' × ')} mm`]);
      rows.push(['Support bracket screws', `2 × Ø${p.screwDiameter} × ${br.frameScrew} into frame, 1 × Ø${p.screwDiameter} × ${br.joistScrew} into joist`]);
    }
    for (const t of [m.socket, m.tenon]) {
      const w = t.bounds.x1 - t.bounds.x0, h = t.bounds.y1 - t.bounds.y0;
      rows.push([`${t.name === 'socket' ? 'Socket' : 'Tenon'} template size`, `${w.toFixed(0)} × ${h.toFixed(0)} × ${(p.templateThickness + p.lipDepth).toFixed(0)} mm`]);
    }
  }
  $('results').replaceChildren(
    ...rows.map(([k, v]) => {
      const tr = document.createElement('tr');
      const a = document.createElement('td'), b = document.createElement('td');
      a.textContent = k;
      b.textContent = v;
      tr.append(a, b);
      return tr;
    }),
  );
}

function renderIssues(j: Joint, m?: Model) {
  const issues = [...j.issues];
  if (m) {
    const fits = (w: number, h: number) => (w <= p.bedX && h <= p.bedY) || (w <= p.bedY && h <= p.bedX);
    const p = j.p;
    for (const t of [m.socket, m.tenon]) {
      const w = t.bounds.x1 - t.bounds.x0, h = t.bounds.y1 - t.bounds.y0;
      if (!fits(w, h)) {
        issues.push({
          level: 'warn',
          msg: `The ${t.name} template (${w.toFixed(0)} × ${h.toFixed(0)} mm) does not fit the ${p.bedX} × ${p.bedY} mm print bed.${t.name === 'tenon' && p.frame ? ' Turn off the support frame, reduce the border, ' : ' Reduce the border, '}or use the 1:1 PDF / DXF to cut it from plywood.`,
        });
      }
    }
  }
  const names = { error: 'Error', warn: 'Check', info: 'Tip' };
  $('issues').replaceChildren(
    ...issues.map((i) => {
      const div = document.createElement('div');
      div.className = `issue ${i.level}`;
      const b = document.createElement('b');
      b.textContent = names[i.level];
      div.append(b, i.msg);
      return div;
    }),
  );
}

function renderView() {
  const is3d = view !== 'drawings';
  blockedEl.hidden = !!current;
  drawingsEl.hidden = is3d;
  threeEl.hidden = !is3d;
  explodeWrap.hidden = view !== 'joint' || !current;
  if (!current) return;
  const { joint, model, drawings } = current;

  if (!is3d) {
    drawingsEl.replaceChildren(
      ...drawings.map((d) => {
        const fig = document.createElement('figure');
        fig.innerHTML = drawingToSvg(d, false);
        return fig;
      }),
    );
    return;
  }

  view3d ??= new View3D(threeEl);
  let items: SceneItem[];
  if (view === 'socket') {
    items = [{ mesh: model.beam, color: WOOD_BEAM }, { mesh: model.socket.mesh, color: PLASTIC, opacity: 0.85 }];
  } else if (view === 'tenon') {
    items = [{ mesh: model.joist, color: WOOD_JOIST }, { mesh: model.tenon.mesh, color: PLASTIC, opacity: 0.85 }];
    if (model.tenon.bracket) items.push({ mesh: model.tenon.bracket.mesh, color: BRACKET, opacity: 0.9 });
  } else {
    const lift = explode.checked ? joint.height * 0.9 : -joint.seatDrop;
    items = [
      { mesh: model.beam, color: WOOD_BEAM },
      { mesh: model.joist, color: WOOD_JOIST, turn: true, position: [0, lift, -joint.tenonDepth] },
    ];
  }
  view3d.show(view, items);
}

function update() {
  readForm();
  saveParams();
  const joint = computeJoint(params);
  syncAutoFields(joint);
  current = undefined;
  let model: Model | undefined;
  if (joint.ok && kernel) {
    try {
      model = buildModel(kernel, joint);
      current = { joint, model, drawings: buildDrawings(joint, model) };
    } catch (e) {
      joint.issues.unshift({ level: 'error', msg: `Could not build the geometry: ${(e as Error).message}` });
    }
  }
  blockedEl.textContent = kernel ? 'Fix the errors below to see the templates.' : 'Loading geometry kernel…';
  renderResults(joint, model);
  renderIssues(joint, model);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-dl]')) {
    b.disabled = !current || (b.dataset.dl === 'stl-bracket' && !current.model.tenon.bracket);
  }
  renderView();
}

function save(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function download(kind: string) {
  if (!current) return;
  const { model, drawings, joint } = current;
  const [what, which] = kind.split('-') as [string, 'socket' | 'tenon' | 'bracket' | undefined];
  const tag = `${joint.p.joistWidth}x${joint.p.joistHeight}`;
  if (what === 'pdf') {
    // jsPDF is large; load it only when a PDF is actually requested.
    const { drawingsToPdf } = await import('../export/pdf');
    const paper = $<HTMLSelectElement>('paper').value as 'a4' | 'a3' | 'letter';
    save(`dovetail-templates-${tag}.pdf`, drawingsToPdf(drawings, paper), 'application/pdf');
    return;
  }
  if (which === 'bracket') {
    const bracket = model.tenon.bracket;
    if (bracket) save(`dovetail-support-bracket-${tag}.stl`, meshToStl(bracket.printMesh), 'model/stl');
    return;
  }
  const drawing = drawings.find((d) => d.id === which)!;
  const name = `dovetail-${which}-template-${tag}`;
  if (what === 'stl') save(`${name}.stl`, meshToStl(model[which!].printMesh), 'model/stl');
  else if (what === 'svg') save(`${name}.svg`, drawingToSvg(drawing, true), 'image/svg+xml');
  else if (what === 'dxf') save(`${name}.dxf`, drawingToDxf(drawing), 'application/dxf');
}

buildForm();
form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
explode.addEventListener('change', renderView);
$('reset').addEventListener('click', () => {
  params = { ...DEFAULTS };
  buildForm();
  update();
});
$('tabs').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
  if (!btn) return;
  view = btn.dataset.view as ViewName;
  for (const b of $('tabs').querySelectorAll('button')) b.setAttribute('aria-selected', String(b === btn));
  renderView();
});
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-dl]')) {
  b.addEventListener('click', () => void download(b.dataset.dl!));
}

update();
initKernel(wasmUrl).then(
  (k) => {
    kernel = k;
    update();
  },
  (e: Error) => {
    blockedEl.textContent = `Could not load the geometry kernel: ${e.message}`;
  },
);
