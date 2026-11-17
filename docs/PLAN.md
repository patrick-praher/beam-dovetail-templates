# Implementation plan

## Goal

Enter wood, bit, template guide and fit → see the result → download templates
for 3D printing (STL) or as 1:1 drawings (PDF, SVG, DXF).

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Platform | Static single-page app, Vite + TypeScript, no framework | One form and one viewer; hostable anywhere, works offline |
| Joint maths | Own module without dependencies | Small, exact (closed form), easy to test |
| Solids | [Manifold](https://github.com/elalish/manifold) (WebAssembly) | Guaranteed watertight STL; 2D booleans and offsets from the same kernel, so drawings and STL cannot disagree |
| 3D view | three.js | Standard, orbit controls included |
| PDF | jsPDF, loaded on demand | Tiling over several sheets for templates larger than the paper |
| Tests | vitest | Runs the same kernel in Node |

## Steps

1. **Research** existing tools → `docs/RESEARCH.md`. ✅
2. **Joint model** (`src/core/joint.ts`): U-shaped contours, guide offset, bit
   angle, clearance, taper, bottom relief, validation messages. ✅
3. **Template shapes** (`src/core/shapes.ts`): socket plate with slot and
   lead-in; tenon plate with tongue and optional support frame; stop lips,
   screw holes with counterbores, alignment notches; wood solids for preview. ✅
4. **Drawings** (`src/core/drawing.ts`): outline, wood, cut lines at surface and
   depth, centreline, overall dimensions, 100 mm scale bar, settings notes. ✅
5. **Exports** (`src/export`): binary STL, SVG in mm, DXF polylines, tiled PDF. ✅
6. **UI** (`src/ui`): generated form with hints, saved in localStorage; 2D view;
   3D views (joint, each template on its beam); result table; warnings. ✅
7. **Tests**: fit condition against an independent bit simulation, shape
   sanity, all exporters. ✅
8. **CI** and optional GitHub Pages deployment. ✅

## Ideas for later

- Split templates larger than the print bed into parts with alignment keys.
- Joist top below/above the main beam top (vertical offset), sloped joists.
- Presets for common bits and guides (Arunda, Festool, Makita, Bosch).
- 3MF export with both templates on one plate; engraved labels.
- German translation.
- Blind (stopped) socket for joists lower than the main beam top.
