# Beam Dovetail Template Generator

A browser app that designs router templates for **large dovetail joints between
wooden beams** (joist into main beam, in the style of the Arunda system) and
exports them as

- **STL** for 3D printing,
- **1:1 PDF** (tiled over A4 / A3 / Letter) to glue onto plywood,
- **SVG / DXF** for laser, CNC or further CAD work.

You enter the wood sizes, the dovetail bit, the template guide (copy ring) and
the fit; the app shows the templates in 2D, the templates on the wood in 3D and
the finished joint, and warns when something cannot work.

**Use it online: https://patrick-praher.github.io/beam-dovetail-templates/**

Everything runs locally in the browser — no server, no upload. The app is in
English and German (picked from the browser language, switchable in the header).

If this saves you a template or two, you can
[support the project on GitHub Sponsors](https://github.com/sponsors/patrick-praher).

## Run it

```sh
npm install
npm run dev      # development server
npm test         # geometry and export tests
npm run build    # static site in dist/
npm run presets  # ready-made STL sets for common joist sizes in makerworld/
```

`dist/` can be hosted anywhere. `.github/workflows/pages.yml` deploys it to
GitHub Pages on every push to `main`, after the tests pass.

## The joint

```
        main beam (side face)                 joist (end grain)
   ───────┐        ┌───────  beam top      ┌──────────────┐
          │ socket │                       │  ╲  tenon  ╱ │
          │        │                       │   ╲      ╱   │
           ╲      ╱                        │    ╲____╱    │
            ╲____╱                         │              │
                                           └──────────────┘
```

- The **socket** is routed into the side face of the main beam. It is open at
  the top, so the joist drops in from above.
- The **tenon** is routed on the end of the joist.
- Both are cut with the **same dovetail bit and the same template guide**, so
  the undercut flanks match by construction.
- Optionally the flanks **taper** towards the bottom, so the joint wedges tight
  as the joist is lowered.

### How the templates are calculated

A dovetail bit is widest at its tip. With bit Ø `D`, flank angle `α`, guide Ø
`G` and a cut `t` deep, the edge that is cut at the tip plane lies
`(G − D) / 2` away from the template edge; at the wood surface it lies
`(G − D) / 2 + t·tan α` away.

Socket and tenon meet "tip plane to surface": the socket is widest at its
bottom, the tenon at its end. Their flanks are parallel over the whole depth,
which gives one condition for the two template edges:

```
slot − tongue = (G − D) + socketDepth · tan α + clearance      (per side)
```

Every contour is a "U" — two flanks and a tangent round bottom — and all of
them are offsets of one another, so they share the arc centre and differ only
in radius. See `src/core/joint.ts`; `tests/joint.test.ts` checks the result
against an independent simulation of the bit.

### Adjusting the fit

| Setting | Effect |
| --- | --- |
| Flank clearance | Gap per side between tenon and socket flanks. Negative = tighter. |
| Wedge taper | Flanks converge downwards. With taper and 0 clearance the joint is tight exactly when the tops are flush. |
| Bottom relief | Gap under the tenon so a tapered joint seats on its flanks. |
| Extra socket depth | Socket deeper than the tenon is long, so the shoulders close. |

On the wood you can also fine-tune without reprinting: with a taper, moving a
template up or down by 1 mm changes the flank fit by `sin(taper)` mm.

## Using the templates

1. Print each template with the **router face on the bed** (that is how the STL
   is oriented). The lips then point up and need no supports. Use plenty of
   perimeters; PETG or similar holds up better than PLA near a hot bit.
2. **Socket template:** lay it on the side face of the main beam, lips hooked
   over the top face, centre notch on your layout line. Screw or clamp it.
3. **Tenon template:** lay it on the end grain of the joist, lip on the top
   face, centre notches on the joist centreline. The screw holes go into the
   tenon, where they are hidden later. If the frame flexes under the router,
   turn on the **support bracket**: a separate printed L-bracket screwed to the
   frame's bottom bar and up into the underside of the joist. It stays below
   the bit tip and outside the guide's path, so it never gets cut. Print it
   lying on its side as exported.
4. Set the bit depth **below the router base** to the value shown in the
   result table (plate thickness + cut depth). The **depth gauges** make this
   quick: stand the router on the printed block with the template guide in its
   hole and plunge until the bit tip touches the bench. One groove on the end
   marks the socket gauge, two the tenon gauge. Check the printed height with
   a caliper once.
5. A dovetail bit cannot plunge: start with the bit outside the wood (above
   the beam for the socket, beside the joist for the tenon), move in, and leave
   the same way. Never lift the router in the cut.
6. Remove most of the waste first (saw, drill, or a straight bit) — the
   dovetail bit should only do the final shape.
7. **Make a test joint in scrap** and adjust the clearance before cutting real
   beams.

The side notches on both templates mark the top face of the wood; the notches
at top and bottom mark the centreline.

> This tool produces geometry, not structural engineering. Load-bearing joints
> need to be dimensioned by someone qualified to do so.

## Related tools and prior art

See [docs/RESEARCH.md](docs/RESEARCH.md). In short: commercial systems exist
for exactly this joint (Arunda / Mafell) but with fixed aluminium templates,
and the parametric 3D-print generators that exist cover hinge mortises, bowties
and furniture-size dovetails. Nothing found combines beam-size dovetails with
free choice of bit and guide.

## Project layout

```
src/core/params.ts    inputs, defaults, form description
src/core/joint.ts     joint maths and validation
src/core/shapes.ts    2D outlines and 3D solids (Manifold CSG kernel)
src/core/drawing.ts   1:1 drawings shared by SVG, DXF and PDF
src/export/           STL, SVG, DXF, PDF writers
src/i18n/             English and German texts (en.ts defines the keys)
src/ui/               form, 2D view, three.js view
tests/                vitest
scripts/              preset generator for ready-made STL sets
docs/PLAN.md          implementation plan and status
```

## Disclaimer

This app generates router templates. It is **not a structural design tool**: it
does not check whether a joint can carry the loads in your structure; its
warnings only cover geometry and machining. Load-bearing connections must be
designed and checked by a qualified structural engineer according to the
applicable building codes (e.g. Eurocode 5).

All results, drawings and files are provided as is, without any warranty of
correctness or fitness for a particular purpose, and you use them at your own
risk. To the extent permitted by law, the author accepts no liability for damage
to property or injury to persons resulting from the use of this app or of parts
made with it. Test every template on scrap wood before cutting real beams.

## License

[PolyForm Noncommercial 1.0.0](LICENSE): free for personal, hobby, educational
and other non-commercial use, including templates you make for your own
projects. Commercial use — for example selling templates made with this tool,
or running it as part of a paid service — needs a separate licence; ask via a
GitHub issue.
