# Research: existing tools

Web research done on 2026-11-17. It was a short survey, not an exhaustive one.

## Commercial systems for beam dovetails

- **Arunda (sold by Mafell)** — the reference for this joint. A pair of
  aluminium templates, a dedicated dovetail cutter with replaceable knives and
  a copy ring for the Mafell LO 65 router. Template sizes are fixed per joint
  width; larger templates give wider, stronger joints.
  [Mafell brochure](https://marketing.mafell.de/download/brochures/Arunda/mafell_prospekt_arunda_de_1025_s.pdf),
  [dealer page](https://neureiter-shop.at/en/produkte/elektrowerkzeuge-mit-zubehor/mafell/frasen/arunda-schwalbenschwanz-schablonen/)
- **Furniture dovetail jigs** (Leigh, Rockler, Trend, UJK, …) — comb templates
  for boards up to about 300 mm wide and 25 mm thick; some include a template
  for sliding/housing dovetails. Not usable at beam scale.
  [UJK manual](https://tsoproducts.com/content/106843_manual.pdf)
- **Milescraft Dovetail Template Master** — a master template for making your
  own comb templates, again for boards.
  [Woodcraft](https://www.woodcraft.com/products/dovetailtemplatemaster-milescraft)

## 3D-printed and parametric templates

- [Instructables: through-dovetail jig with 3D-printed templates](https://www.instructables.com/3D-Printed-Jig-for-Through-Dovetails-With-Variable)
  — double-ended printed fingers (tapered end for pins, forked end for tails),
  dimensions tied to one bit and guide. Furniture scale.
- [MakerWorld: bowtie / dovetail key templates](https://makerworld.com/models/859750)
  — fixed sizes for one guide bushing.
- [MakerWorld: parametric router mortise template generator](https://makerworld.com/en/models/1222054)
  — parametric, but for rectangular mortises.
- [Printables: hole-cutting jig with bushing and bit parameters](https://printables.com/model/312853-router-hole-cutting-jig-with-bushing-and-bit-size-),
  [parametric radius guides](https://www.printables.com/model/508191-parametric-router-radius-guides)
  — show the usual approach: take guide Ø and bit Ø as parameters and apply the
  offset.

## Rules taken from the literature

- Guide offset = (guide Ø − bit Ø) / 2; templates grow or shrink by that
  amount depending on whether the guide runs inside or outside.
  [Fine Woodworking](https://finewoodworking.com/?p=57397),
  [Lee Valley](https://www.leevalley.com/en-us/discover/woodworking/2020/august/router-template-guides)
- The guide collar must be shorter than the template is thick (same sources).
- For housed joints the template needs a stop so the router does not cut
  through the far edge. [Woodworkers Institute](https://woodworkersinstitute.com/router-housing-jig/)

## Conclusion

No tool was found that generates beam-size dovetail templates for an arbitrary
bit and guide. The gap this app fills:

1. beam-scale joint (socket in the side of a main beam, tenon on a joist end),
2. any dovetail bit / guide combination, including the bit's flank angle in
   the offset (plain offset calculators ignore it),
3. adjustable fit (clearance, wedge taper, bottom relief),
4. output for a 3D printer *and* as 1:1 drawings for templates too large to
   print.

Not verified: the exact geometry of the Arunda cutter and templates (the
manufacturer's manual was not found), so this app follows the principle, not
their dimensions.
