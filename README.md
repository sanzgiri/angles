# ∠ Angles — a geometry puzzle game

A small, replayable web game inspired by *Geometry Snacks* (Ed Southall &
Vincent Pantaloni). You're shown a figure with the **minimum** information
needed and you deduce the missing angle **x** using fundamental rules.

23 puzzle types across 4 difficulty tiers, regenerated each time you play.

## Rules covered

- Vertically opposite angles
- Angles on a straight line (supplementary)
- Complementary angles (inside a right angle)
- Angles around a point sum to 360°
- Triangle angle sum (180°)
- Isosceles base angles
- Exterior angle of a triangle
- Parallel lines: corresponding (F), alternate (Z), co-interior (C)
- Quadrilateral angle sum (360°); pentagon (540°)
- 5-pointed star: tip-angle sum = 180°
- Compound / chained puzzles:
  - Bow-tie (vertical + triangle-sum)
  - Isosceles bow-tie (isosceles + vertical + triangle-sum)
  - Zigzag between parallels (auxiliary parallel + alternate)
  - Chained isosceles (BD = DA = AC — two isosceles + straight line)
  - Isosceles trapezoid (isosceles base angles + co-interior)
  - Quadrilateral split by a diagonal (triangle-sum twice)
  - Parallel + triangle (alternate + straight-line sum)
  - Parallels with a crossing (alternate + linear pair)

## Run

No build step. Just open it:

```bash
open index.html
# or serve it locally:
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploy

It's a static site — drop the folder on Vercel, Netlify, GitHub Pages, etc.

## Graphics conventions used in the figures

- **Blue filled wedge + value** = a *given* angle
- **Red filled wedge + `x`** = the angle you must find
- **Tick marks** (∣, ∥) on edges = equal lengths
- **Triangular arrowheads** (▸, ▸▸) along a line = parallel lines
- **Small square at a vertex** = right angle (90°)
- **Italic letters** (*A*, *B*, *C*, ...) label vertices
- **Dashed green line** = an auxiliary construction hint

## Add a new puzzle

Open `puzzles.js`. Each puzzle is an object pushed to `PUZZLES`:

```js
PUZZLES.push({
  name: 'My Puzzle',
  difficulty: 3,            // 1 (warm-up) ↔ 5 (hardest)
  concept: 'One-line statement of the rule(s) used.',
  gen() {
    // randomize inputs, build SVG using the helpers below.
    return {
      svg:    '<...svg inner markup...>',
      answer: 47,
      steps:  ['First step…', 'Then…', 'So x = 47°.'],
    };
  },
});
```

Helpers in `puzzles.js`:

| Helper                                       | Purpose                                       |
| -------------------------------------------- | --------------------------------------------- |
| `P(cx, cy, r, angDeg)`                       | Point on circle (angle in degrees)            |
| `line(x1,y1,x2,y2,opts)`                     | Line segment (opts: stroke, width, dash)      |
| `ray(cx,cy,len,ang,opts)`                    | Ray from a vertex                             |
| `poly(pts, opts)`                            | Filled polygon (cream interior, dark stroke)  |
| `wedge(cx,cy,r,a1,a2,color)`                 | Filled translucent angle wedge                |
| `arcOnly(cx,cy,r,a1,a2,color)`               | Stroke-only arc (when right-angle square sits at same vertex) |
| `angleLabel(cx,cy,r,a1,a2,text,color,off)`   | Text label on the angle's bisector            |
| `angle(cx,cy,r,a1,a2,text,color)`            | Wedge + label                                 |
| `angleArc(cx,cy,r,a1,a2,text,color)`         | Arc + label                                   |
| `rightAngleSquare(cx,cy,size,a1)`            | Small square marker for a 90° corner          |
| `ticks(x1,y1,x2,y2,count)`                   | Equal-length tick marks                       |
| `parMark(x1,y1,x2,y2,count)`                 | Triangular chevrons for parallel lines        |
| `V(x,y,letter,cx,cy)` / `vDot(x,y)`          | Vertex dot + outward-pointing italic label    |
| `triFromBase(Bx,By,Cx,Cy,angA,angB)`         | Compute apex given two base angles            |
| `centroid(pts)` / `angOf(px,py,qx,qy)`       | Geometry helpers                              |

Angle convention: degrees, **0° = east**, increasing **clockwise** (matches
SVG `Math.cos`/`Math.sin` with y-down).

## Roadmap

- Circle theorems (inscribed angle, tangent–chord, cyclic quadrilateral)
- Regular polygon interior/exterior angles
- Bearings
- Multi-unknown puzzles where you fill several inputs
- Daily puzzle (seeded from date)
- Share-a-puzzle link (encode puzzle state in URL)
- Dark mode
