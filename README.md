# ∠ Angles — a geometry puzzle game

A small, replayable web game inspired by *Geometry Snacks* (Ed Southall &
Vincent Pantaloni). Two ways to play, switched via the tab toggle:

1. **Find x** — you see a figure with the *minimum* information needed and
   deduce the missing angle **x** using fundamental rules. 23 generators,
   freshly randomized each play.
2. **Find all angles** *(Angle Sudoku)* — you see a bounded rectangle
   divided into a tiling of 4 or 9 irregular polygons, with only a few
   angles revealed. Click any unknown wedge and type its value; correct
   answers lock in green. Fill every angle to win.

## Find-x rules covered

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

## Find-all-angles rules

Every puzzle is a planar tiling of an axis-aligned rectangle into convex
polygons (3–6 sides each). The bounding rectangle's outer corners are 90°,
but at most one *interior* cell may be rectangular — so the puzzle is
never trivialised by axis-aligned cuts. The constraints fall out for free:

- Each *n*-gon's interior angles sum to (*n* − 2) × 180°.
- Around an interior vertex, all cell-side angles sum to 360°.
- On an outer edge (not a corner), the cell-side angles sum to 180°.
- At an outer corner of the bounding rectangle, the cell-side angles sum
  to 90°.

Milestone-1 templates (hand-authored, randomised each play):

| Template            | Size | Cells          | Difficulty |
| ------------------- | ---- | -------------- | ---------- |
| Pinwheel            | 2×2  | 4 quads        | ★★         |
| Fan with Notch      | 2×2  | 3 tri + 1 quad | ★★         |
| Two-Point Mosaic    | 2×2  | 2 quad + 2 tri | ★★★       |
| Irregular Grid 9    | 3×3  | 9 quads        | ★★★★     |

Milestone 2 (next): constraint solver (so any tiling can auto-pick its
minimal givens for a target difficulty) + a procedural tiling generator.

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
Live demo: https://sanzgiri.github.io/angles/

## Graphics conventions

- **Blue filled wedge + value** = a *given* angle
- **Red filled wedge + `x`** = the angle you must find (Find-x mode)
- **Dashed grey wedge + `?`** = an unknown to click and fill (Sudoku mode)
- **Green filled wedge + value** = an angle you've solved (Sudoku mode)
- **Tick marks** (∣, ∥) on edges = equal lengths
- **Triangular arrowheads** (▸, ▸▸) along a line = parallel lines
- **Small square at a vertex** = right angle (90°)
- **Italic letters** (*A*, *B*, *C*, ...) label vertices
- **Dashed green line** = an auxiliary construction hint

## Add a new Find-x puzzle

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

## Add a new Sudoku template

Open `sudoku.js`. Each template is an object pushed to `TEMPLATES`:

```js
TEMPLATES.push({
  id: 'my-tiling',
  label: 'My Tiling',
  size: '2×2',          // or '3×3'
  description: 'One-line description shown to the player.',
  difficulty: 3,
  generate() {
    return {
      vertices: [ /* [x,y] points; first 4 are the bounding-rectangle corners */ ],
      cells: [
        { id: 'C1', name: 'quad',     vIdx: [0, 4, 5, 7] },
        { id: 'C2', name: 'triangle', vIdx: [4, 1, 5] },
        // …
      ],
      givenIdxs: ['C1@0', 'C2@1', /* … */],   // angles revealed as givens
    };
  },
});
```

`makeSudokuPuzzle(i)` instantiates a template (randomly jittering its
interior vertex positions), computes every interior angle, and rejects
any layout that produces more than one rectangular cell (a hard design
rule — no all-axis-aligned puzzles).

## Roadmap

- Constraint solver for Find-all-angles mode (auto-picks minimal givens,
  rates difficulty by max deduction-chain depth, drives a Hint button)
- Procedural tiling generator (infinite variety, no hand-authored
  templates needed)
- Circle theorems (inscribed angle, tangent–chord, cyclic quadrilateral)
- Regular polygon interior/exterior angles
- Bearings
- Daily puzzle (seeded from date)
- Share-a-puzzle link (encode puzzle state in URL)
- Dark mode


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
