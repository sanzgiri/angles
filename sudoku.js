/* sudoku.js — "Find all angles" mode (Angle Sudoku)
 *
 * A puzzle is a planar tiling of a rectangular region into N convex polygons
 * (3–6 sides each). Each cell-vertex has an interior angle; the player fills
 * in every unknown angle given a small set of revealed givens.
 *
 * This file exposes:
 *   SudokuTemplates    – array of templates
 *   makeSudokuPuzzle(templateIndex?) → instantiated puzzle
 *   renderSudokuSVG(puzzle)          → SVG string
 *
 * The bounding rectangle is the outer SVG box at (40,40) – (460,360).
 * Interior dividing edges are always slanted (no axis-aligned interior cuts),
 * so cells are never accidentally rectangular.
 */
(function (global) {
  'use strict';

  // ---------- colours / style ----------
  const INK    = '#1a1a1a';
  const RULE   = '#4a4a4a';
  const GIVEN  = '#1a73e8';
  const UNK    = '#9aa0a6';
  const SOLVED = '#0f9d58';
  const WRONG  = '#d93025';
  const FACE   = '#fdfaf0';

  // ---------- random helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const jit  = (base, amt) => base + (Math.random() * 2 - 1) * amt;

  // ---------- bounding box ----------
  const BOX = { x0: 40, y0: 40, x1: 460, y1: 360 };

  // ---------- geometry helpers ----------
  function dist(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1]); }
  function dirDeg(from, to) {
    return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
  }
  // Interior angle of a CONVEX polygon at vertex `cur`, with neighbours
  // `prev` and `next`. Always in (0, 180).
  function interiorAngle(prev, cur, next) {
    const ax = prev[0] - cur[0], ay = prev[1] - cur[1];
    const bx = next[0] - cur[0], by = next[1] - cur[1];
    const dot = ax * bx + ay * by;
    const ma = Math.hypot(ax, ay), mb = Math.hypot(bx, by);
    return Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
  }
  // Centroid of a list of points.
  function centroid(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }
  // True if point p is at an outer corner of the bounding box.
  function isOuterCorner(p) {
    return (p[0] === BOX.x0 || p[0] === BOX.x1) &&
           (p[1] === BOX.y0 || p[1] === BOX.y1);
  }
  // True if p is on the outer edge but not a corner.
  function isOuterEdge(p) {
    if (isOuterCorner(p)) return false;
    return p[0] === BOX.x0 || p[0] === BOX.x1 ||
           p[1] === BOX.y0 || p[1] === BOX.y1;
  }

  // ---------- SVG helpers ----------
  const fmt = n => Math.abs(n) < 1e-6 ? '0' : Number(n.toFixed(2)).toString();
  function pt(cx, cy, r, angDeg) {
    const a = angDeg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function polygonPath(pts) {
    return pts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + fmt(p[0]) + ' ' + fmt(p[1])).join(' ') + ' Z';
  }
  function svgPolygon(pts, fill = FACE, stroke = INK, sw = 2) {
    return `<path d="${polygonPath(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  }
  // Filled wedge marking an angle (short side), at vertex (cx,cy), between
  // rays at degrees a1 and a2.
  function wedge(cx, cy, r, a1, a2, color, fillOp = 0.18) {
    const [x1, y1] = pt(cx, cy, r, a1);
    const [x2, y2] = pt(cx, cy, r, a2);
    let d = ((a2 - a1) % 360 + 360) % 360;
    let sweep;
    if (d <= 180) sweep = 1;
    else { sweep = 0; d = 360 - d; }
    return `<path d="M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 0 ${sweep} ${fmt(x2)} ${fmt(y2)} Z" fill="${color}" fill-opacity="${fillOp}" stroke="${color}" stroke-width="1.6" stroke-opacity="0.9" stroke-linejoin="round"/>`;
  }
  // Hollow wedge outline (used for unknowns before they're solved).
  function wedgeOutline(cx, cy, r, a1, a2, color = UNK) {
    const [x1, y1] = pt(cx, cy, r, a1);
    const [x2, y2] = pt(cx, cy, r, a2);
    let d = ((a2 - a1) % 360 + 360) % 360;
    let sweep;
    if (d <= 180) sweep = 1;
    else { sweep = 0; d = 360 - d; }
    return `<path d="M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 0 ${sweep} ${fmt(x2)} ${fmt(y2)} Z" fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-width="1.4" stroke-dasharray="3 2" stroke-linejoin="round"/>`;
  }
  function rightAngleSquare(cx, cy, size, a1) {
    const [ax, ay] = pt(cx, cy, size, a1);
    const [bx, by] = pt(cx, cy, size * Math.SQRT2, a1 + 45);
    const [dxv, dyv] = pt(cx, cy, size, a1 + 90);
    return `<path d="M ${fmt(ax)} ${fmt(ay)} L ${fmt(bx)} ${fmt(by)} L ${fmt(dxv)} ${fmt(dyv)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // ---------- templates ----------
  // Each template returns { vertices, cells, givenIdxs }.
  //   vertices : array of [x, y]
  //   cells    : array of { id, name, vIdx: [global vertex indices in CCW order around the cell] }
  //   givenIdxs: array of "cellId@k" strings — which angles are revealed as givens.
  // Vertex 0..3 are always the outer corners (TL, TR, BR, BL).

  const TEMPLATES = [];

  // -- Template 1: "Pinwheel" (2x2, 4 irregular quads) --
  TEMPLATES.push({
    id: 'pinwheel',
    label: 'Pinwheel',
    size: '2×2',
    description: '4 irregular quadrilaterals share one interior vertex.',
    difficulty: 2,
    generate() {
      const xT = jit(230, 30);
      const yL = jit(190, 30);
      const xB = jit(260, 30);
      const yR = jit(210, 30);
      const qx = jit(230, 30);
      const qy = jit(200, 30);
      const vertices = [
        [BOX.x0, BOX.y0],  // 0 TL
        [BOX.x1, BOX.y0],  // 1 TR
        [BOX.x1, BOX.y1],  // 2 BR
        [BOX.x0, BOX.y1],  // 3 BL
        [xT, BOX.y0],      // 4 top
        [BOX.x1, yR],      // 5 right
        [xB, BOX.y1],      // 6 bottom
        [BOX.x0, yL],      // 7 left
        [qx, qy],          // 8 interior Q
      ];
      const cells = [
        { id: 'C1', name: 'quad', vIdx: [0, 4, 8, 7] }, // top-left
        { id: 'C2', name: 'quad', vIdx: [4, 1, 5, 8] }, // top-right
        { id: 'C3', name: 'quad', vIdx: [8, 5, 2, 6] }, // bottom-right
        { id: 'C4', name: 'quad', vIdx: [7, 8, 6, 3] }, // bottom-left
      ];
      const givenIdxs = ['C1@1', 'C2@1', 'C3@3', 'C4@0'];
      return { vertices, cells, givenIdxs };
    },
  });

  // -- Template 2: "Fan with Notch" (2x2, 3 triangles + 1 quad) --
  TEMPLATES.push({
    id: 'fan-notch',
    label: 'Fan with Notch',
    size: '2×2',
    description: 'Three triangles meet at an interior point; one corner becomes a quad.',
    difficulty: 2,
    generate() {
      const yM = jit(220, 30);
      const qx = jit(210, 25);
      const qy = jit(190, 30);
      const vertices = [
        [BOX.x0, BOX.y0],  // 0 TL
        [BOX.x1, BOX.y0],  // 1 TR
        [BOX.x1, BOX.y1],  // 2 BR
        [BOX.x0, BOX.y1],  // 3 BL
        [BOX.x0, yM],      // 4 M on left edge
        [qx, qy],          // 5 Q interior
      ];
      const cells = [
        { id: 'C1', name: 'triangle', vIdx: [0, 1, 5] },   // TL-TR-Q
        { id: 'C2', name: 'triangle', vIdx: [1, 2, 5] },   // TR-BR-Q
        { id: 'C3', name: 'quad',     vIdx: [5, 2, 3, 4] },// Q-BR-BL-M
        { id: 'C4', name: 'triangle', vIdx: [4, 5, 0] },   // M-Q-TL
      ];
      const givenIdxs = ['C1@1', 'C3@1', 'C4@1'];
      return { vertices, cells, givenIdxs };
    },
  });

  // -- Template 3: "Two-Point Mosaic" (2x2, 2 quads + 2 triangles) --
  //  P and Q are two interior points side by side. P connects to TL, BL and Q;
  //  Q connects to TR, BR and P. The interior is partitioned into 4 cells.
  TEMPLATES.push({
    id: 'two-point',
    label: 'Two-Point Mosaic',
    size: '2×2',
    description: 'Two interior points carve the rectangle into a band of four cells — two quads sandwiched between two triangles.',
    difficulty: 3,
    generate() {
      const px = jit(180, 22), py = jit(190, 28);
      const qx = jit(310, 22), qy = jit(195, 28);
      const vertices = [
        [BOX.x0, BOX.y0],  // 0 TL
        [BOX.x1, BOX.y0],  // 1 TR
        [BOX.x1, BOX.y1],  // 2 BR
        [BOX.x0, BOX.y1],  // 3 BL
        [px, py],          // 4 P
        [qx, qy],          // 5 Q
      ];
      const cells = [
        { id: 'C1', name: 'quad',     vIdx: [0, 1, 5, 4] },   // top band: TL-TR-Q-P
        { id: 'C2', name: 'triangle', vIdx: [1, 2, 5] },      // right tri: TR-BR-Q
        { id: 'C3', name: 'quad',     vIdx: [4, 5, 2, 3] },   // bottom band: P-Q-BR-BL
        { id: 'C4', name: 'triangle', vIdx: [3, 0, 4] },      // left tri: BL-TL-P
      ];
      const givenIdxs = ['C1@1', 'C2@1', 'C3@2', 'C4@2'];
      return { vertices, cells, givenIdxs };
    },
  });

  // -- Template 4: "Irregular Grid 9" (3x3, 9 irregular quads) --
  // 16 vertices: 4 corners + 8 edge points (2 per side) + 4 interior.
  TEMPLATES.push({
    id: 'grid-9',
    label: 'Irregular Grid 9',
    size: '3×3',
    description: 'A 3×3 layout of nine irregular quadrilaterals with slanted dividers.',
    difficulty: 4,
    generate() {
      const x = BOX.x0, X = BOX.x1, y = BOX.y0, Y = BOX.y1;
      const tx1 = jit(180, 18), tx2 = jit(320, 18);
      const bx1 = jit(190, 18), bx2 = jit(310, 18);
      const ly1 = jit(150, 18), ly2 = jit(260, 18);
      const ry1 = jit(160, 18), ry2 = jit(250, 18);
      // 4 interior vertices roughly at grid positions, jittered:
      const i00 = [jit(180, 14), jit(160, 14)];
      const i10 = [jit(320, 14), jit(150, 14)];
      const i01 = [jit(180, 14), jit(260, 14)];
      const i11 = [jit(320, 14), jit(250, 14)];
      const vertices = [
        [x, y], [X, y], [X, Y], [x, Y],            // 0..3 corners
        [tx1, y], [tx2, y],                        // 4,5 top
        [X, ry1], [X, ry2],                        // 6,7 right
        [bx2, Y], [bx1, Y],                        // 8,9 bottom
        [x, ly2], [x, ly1],                        // 10,11 left
        i00, i10, i11, i01,                        // 12..15 interior (TL, TR, BR, BL ordering)
      ];
      const cells = [
        // Row 1 (top): 3 quads
        { id: 'C1', name: 'quad', vIdx: [0, 4, 12, 11] },
        { id: 'C2', name: 'quad', vIdx: [4, 5, 13, 12] },
        { id: 'C3', name: 'quad', vIdx: [5, 1, 6, 13] },
        // Row 2 (middle): 3 quads
        { id: 'C4', name: 'quad', vIdx: [11, 12, 15, 10] },
        { id: 'C5', name: 'quad', vIdx: [12, 13, 14, 15] },
        { id: 'C6', name: 'quad', vIdx: [13, 6, 7, 14] },
        // Row 3 (bottom): 3 quads
        { id: 'C7', name: 'quad', vIdx: [10, 15, 9, 3] },
        { id: 'C8', name: 'quad', vIdx: [15, 14, 8, 9] },
        { id: 'C9', name: 'quad', vIdx: [14, 7, 2, 8] },
      ];
      // 11 givens (we have 11 dof on 36 unknowns):
      const givenIdxs = [
        'C1@1', 'C2@1', 'C3@1',
        'C4@1', 'C5@1', 'C6@1',
        'C7@1', 'C8@1', 'C9@1',
        'C5@2', 'C5@3',
      ];
      return { vertices, cells, givenIdxs };
    },
  });



  // ---------- puzzle construction ----------
  // Build an instantiated puzzle from a template.
  function makeSudokuPuzzle(templateIndex) {
    const tplIdx = (templateIndex == null)
      ? Math.floor(Math.random() * TEMPLATES.length)
      : templateIndex;
    const tpl = TEMPLATES[tplIdx];
    let inst = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const cand = tpl.generate();
      if (cand && validate(cand)) { inst = cand; break; }
    }
    if (!inst) throw new Error(`Could not instantiate template ${tpl.id}`);

    // Compute the interior angle at every (cell, vertex-in-cell) pair.
    const angles = [];
    for (const cell of inst.cells) {
      const n = cell.vIdx.length;
      const pts = cell.vIdx.map(i => inst.vertices[i]);
      for (let k = 0; k < n; k++) {
        const prev = pts[(k - 1 + n) % n];
        const cur  = pts[k];
        const next = pts[(k + 1) % n];
        const val = interiorAngle(prev, cur, next);
        angles.push({
          id: `${cell.id}@${k}`,
          cellId: cell.id,
          cellName: cell.name,
          k,
          vIdx: cell.vIdx[k],
          prevPt: prev,
          curPt: cur,
          nextPt: next,
          cellCentroid: centroid(pts),
          value: val,                       // exact answer in degrees
          rounded: Math.round(val),         // shown to the user (we accept ±0.5 tolerance)
          isGiven: inst.givenIdxs.includes(`${cell.id}@${k}`),
        });
      }
    }
    // Add constraints (purely informational for now).
    const constraints = listConstraints(inst, angles);
    return {
      templateId: tpl.id,
      templateLabel: tpl.label,
      size: tpl.size,
      difficulty: tpl.difficulty,
      description: tpl.description,
      vertices: inst.vertices,
      cells: inst.cells,
      angles,
      constraints,
    };
  }

  // Sanity check on an instantiated template: no cell is rectangular, all
  // cells are convex, no two vertices coincide.
  function validate(inst) {
    if (!inst || !inst.cells) return false;
    let rectCount = 0;
    for (const cell of inst.cells) {
      const n = cell.vIdx.length;
      const pts = cell.vIdx.map(i => inst.vertices[i]);
      // convexity: all interior angles < 180
      // rectangular check: all 4 angles within 2° of 90°
      let allNear90 = (n === 4);
      for (let k = 0; k < n; k++) {
        const ang = interiorAngle(pts[(k-1+n)%n], pts[k], pts[(k+1)%n]);
        if (ang < 8 || ang > 172) return false; // too degenerate
        if (Math.abs(ang - 90) > 2) allNear90 = false;
      }
      if (allNear90) rectCount++;
    }
    if (rectCount > 1) return false;
    return true;
  }

  // List the constraints implied by the topology.
  function listConstraints(inst, angles) {
    const out = [];
    // Polygon-sum per cell
    for (const cell of inst.cells) {
      const n = cell.vIdx.length;
      out.push({
        kind: 'cell-sum',
        text: `${cellName(cell.name)} (${cell.id}): angles sum to ${(n - 2) * 180}°`,
        cellId: cell.id,
        members: angles.filter(a => a.cellId === cell.id).map(a => a.id),
        total: (n - 2) * 180,
      });
    }
    // Vertex sums
    const byVertex = new Map();
    for (const a of angles) {
      if (!byVertex.has(a.vIdx)) byVertex.set(a.vIdx, []);
      byVertex.get(a.vIdx).push(a);
    }
    for (const [vIdx, group] of byVertex) {
      const p = inst.vertices[vIdx];
      let total = null, label = null;
      if (isOuterCorner(p)) { total = 90;  label = '90° corner of the bounding rectangle'; }
      else if (isOuterEdge(p)) { total = 180; label = '180° on the outer edge'; }
      else { total = 360; label = '360° around an interior vertex'; }
      out.push({
        kind: 'vertex-sum',
        text: `Vertex ${vIdx}: ${label} (${group.length} cell-angle${group.length>1?'s':''})`,
        vIdx,
        members: group.map(g => g.id),
        total,
      });
    }
    return out;
  }
  function cellName(n) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  // ---------- rendering ----------
  // Build the SVG for the figure. Each unknown wedge is wrapped in a <g>
  // with class="wedge unk" data-aid="<angle.id>" for click handling.
  function renderSudokuSVG(puzzle) {
    const parts = [];
    // Cell fills
    for (const cell of puzzle.cells) {
      const pts = cell.vIdx.map(i => puzzle.vertices[i]);
      parts.push(svgPolygon(pts, FACE, INK, 2));
    }
    // Corner annotation: a tiny "90°" hint outside each corner of the
    // bounding rectangle. Kept *outside* the figure so it never collides
    // with the per-cell wedges drawn at the same vertex.
    const cornerOffsets = [[-6, -6], [6, -6], [6, 6], [-6, 6]];
    for (let i = 0; i < 4; i++) {
      const p = puzzle.vertices[i];
      const [ox, oy] = cornerOffsets[i];
      parts.push(`<text x="${fmt(p[0] + ox)}" y="${fmt(p[1] + oy + 4)}" text-anchor="${ox < 0 ? 'end' : 'start'}" font-size="10" fill="#b5b0a4" font-style="italic">90°</text>`);
    }
    // Vertex dots
    for (const v of puzzle.vertices) {
      parts.push(`<circle cx="${fmt(v[0])}" cy="${fmt(v[1])}" r="2.4" fill="${INK}"/>`);
    }
    // Cell ID labels at centroid, tiny
    for (const cell of puzzle.cells) {
      const c = centroid(cell.vIdx.map(i => puzzle.vertices[i]));
      parts.push(`<text x="${fmt(c[0])}" y="${fmt(c[1] + 4)}" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="13" fill="#a8a195">${cell.id}</text>`);
    }
    // Angle wedges
    for (const a of puzzle.angles) {
      // Skip the four outer corners that are pure 90° — they're already shown
      // by the right-angle square. They still exist as angles for the puzzle's
      // bookkeeping, but we don't redraw them as wedges.
      const v = puzzle.vertices[a.vIdx];
      const isPlainCornerSingle = isOuterCorner(v) && Math.abs(a.value - 90) < 1.0
                                  && puzzle.angles.filter(b => b.vIdx === a.vIdx).length === 1;
      if (isPlainCornerSingle) continue;

      const cx = a.curPt[0], cy = a.curPt[1];
      const aPrev = dirDeg(a.curPt, a.prevPt);
      const aNext = dirDeg(a.curPt, a.nextPt);
      // Pick a1, a2 so the wedge between them sweeps the SHORT arc (the cell
      // interior). When two arcs are possible, the polygon interior is the
      // one containing the cell centroid direction.
      const dToCent = dirDeg(a.curPt, a.cellCentroid);
      const candA = chooseShortArc(aPrev, aNext, dToCent);
      const r = wedgeRadius(a);
      const labelPos = pt(cx, cy, r + labelOffset(a, puzzle), bisect(candA.a1, candA.a2));
      if (a.isGiven) {
        parts.push(wedge(cx, cy, r, candA.a1, candA.a2, GIVEN));
        parts.push(`<text x="${fmt(labelPos[0])}" y="${fmt(labelPos[1] + 4)}" text-anchor="middle" font-size="13" font-weight="700" fill="${GIVEN}">${a.rounded}°</text>`);
      } else {
        // Wrap unknown wedge in a clickable group.
        parts.push(`<g class="wedge unk" data-aid="${a.id}" data-cx="${fmt(labelPos[0])}" data-cy="${fmt(labelPos[1])}">`);
        parts.push(wedgeOutline(cx, cy, r, candA.a1, candA.a2, UNK));
        parts.push(`<text x="${fmt(labelPos[0])}" y="${fmt(labelPos[1] + 4)}" text-anchor="middle" font-size="13" font-weight="700" fill="${UNK}" pointer-events="none">?</text>`);
        parts.push(`</g>`);
      }
    }
    return parts.join('\n');
  }

  // Helper: pick the (a1, a2) ordering whose short arc contains direction
  // `inside`. Used to decide which side of the angle to fill.
  function chooseShortArc(a, b, inside) {
    const norm = x => ((x % 360) + 360) % 360;
    const within = (lo, hi, x) => {
      const span = ((hi - lo) % 360 + 360) % 360;
      const off  = ((x  - lo) % 360 + 360) % 360;
      return off >= 0 && off <= span;
    };
    // Try (a, b) — short arc goes from a to b CW (when sweep=1 in our wedge).
    // Check whether `inside` lies between a and b on the short side.
    const dAB = ((b - a) % 360 + 360) % 360;
    const shortStart = dAB <= 180 ? a : b;
    const shortEnd   = dAB <= 180 ? b : a;
    if (within(shortStart, shortEnd, norm(inside))) {
      return { a1: shortStart, a2: shortEnd };
    }
    // Otherwise flip.
    return { a1: shortEnd, a2: shortStart };
  }
  function bisect(a1, a2) {
    let d = ((a2 - a1) % 360 + 360) % 360;
    if (d > 180) d -= 360;
    return a1 + d / 2;
  }
  function wedgeRadius(a) {
    // Smaller wedge for tight angles so the label stays inside the cell.
    if (a.value < 25) return 16;
    if (a.value < 45) return 20;
    if (a.value < 75) return 24;
    return 28;
  }
  // How many cells share this angle's vertex — used to push labels
  // further out at busy vertices so they don't pile up.
  function labelOffset(a, puzzle) {
    const sharing = puzzle.angles.filter(b => b.vIdx === a.vIdx).length;
    if (sharing >= 4) return 18;
    if (sharing >= 3) return 16;
    return 14;
  }

  // ---------- public ----------
  global.SudokuTemplates  = TEMPLATES;
  global.makeSudokuPuzzle = makeSudokuPuzzle;
  global.renderSudokuSVG  = renderSudokuSVG;
})(typeof window !== 'undefined' ? window : this);
