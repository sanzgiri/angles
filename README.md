# ∠ Angles — a geometry puzzle game

A small, replayable web game inspired by *Geometry Snacks* (Ed Southall &
Vincent Pantaloni). You're shown a figure with the **minimum** information
needed and you deduce the missing angle **x** using fundamental rules:

- Vertically opposite angles
- Angles on a straight line (supplementary)
- Complementary angles (in a right angle)
- Angles around a point sum to 360°
- Triangle angle sum (180°)
- Isosceles base angles
- Exterior angle of a triangle
- Parallel lines: corresponding (F), alternate (Z), co-interior (C)
- Quadrilateral angle sum (360°)
- 5-pointed star: tip-angle sum = 180°
- Combined / multi-step puzzles (bow-tie, parallel + triangle, etc.)

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

## Add a new puzzle

Open `puzzles.js`. Each puzzle is an object pushed to `PUZZLES`:

```js
PUZZLES.push({
  name: 'My Puzzle',
  difficulty: 2,            // 1 (warm-up) ↔ 5 (tricky)
  concept: 'One-line statement of the rule used.',
  gen() {
    // randomize inputs, build SVG using the helpers (P, line, ray,
    // arcMark, angleLabel, rightAngleSquare, ticks, parMark, dot)
    return {
      svg:    '<...svg inner markup...>',
      answer: 47,
      steps:  ['First...', 'Then...', 'So x = 47°.'],
    };
  },
});
```

Helpers in `puzzles.js`:

| Helper                                      | Purpose                                |
| ------------------------------------------- | -------------------------------------- |
| `P(cx, cy, r, angDeg)`                      | Point on circle (angle in degrees)     |
| `line(x1,y1,x2,y2)` / `ray(cx,cy,len,ang)`  | Straight segments                      |
| `arcMark(cx,cy,r,a1,a2,color?)`             | Small arc marking an angle             |
| `angleLabel(cx,cy,r,a1,a2,text,color?)`     | Text label on angle bisector           |
| `rightAngleSquare(cx,cy,size,a1)`           | Little square for a 90° corner         |
| `ticks(x1,y1,x2,y2,count)`                  | Equal-length tick marks on a segment   |
| `parMark(x1,y1,x2,y2,count)`                | Arrow chevrons (parallel marker)       |
| `dot(x,y,label,dx,dy)`                      | Vertex dot + label                     |

Angle convention: degrees, **0° = east**, increasing **clockwise** (matches
SVG `Math.cos`/`Math.sin` with y-down).

## Roadmap

- Circle theorems (inscribed angle, tangent–chord, cyclic quadrilateral)
- Polygon interior/exterior angles
- Bearings
- Multi-unknown puzzles where you fill several inputs
- Difficulty-aware streak scoring
- Daily puzzle (seeded from date)
- Share-a-puzzle link (encode puzzle state in URL)
- Dark mode
