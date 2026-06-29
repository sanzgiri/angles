/* puzzles.js — Angle puzzle generators with rich graphics
 *
 * SVG canvas 500×400. Angle convention: degrees, 0° = east (+x),
 * increasing CLOCKWISE (matches Math.cos/Math.sin with SVG y-down).
 *
 * Each puzzle returns {svg, answer, steps}; the wrapper attaches
 * title/difficulty/concept.
 */

// ============================================================
// Palette + tiny helpers
// ============================================================
const rad = d => d * Math.PI / 180;
const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = n => Math.round(n * 100) / 100;

const INK   = '#1a1a1a';
const RULE  = '#4a4a4a';
const GIVEN = '#1a73e8';   // blue — known values
const UNK   = '#d93025';   // red  — find this
const HINT  = '#0f9d58';   // green — auxiliary / second-given accent
const FACE  = '#fdfaf0';   // very pale cream — polygon fill
const FACE2 = '#f3eedf';

// Point on circle around (cx,cy) at radius r, angle a (degrees, SVG convention).
function P(cx, cy, r, a) {
  const t = rad(a);
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
}

function angOf(px, py, qx, qy) {
  return Math.atan2(qy - py, qx - px) * 180 / Math.PI;
}

function centroid(pts) {
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  return [sx / pts.length, sy / pts.length];
}

// ============================================================
// Drawing primitives
// ============================================================
function line(x1, y1, x2, y2, opts = {}) {
  const s = opts.stroke ?? INK;
  const w = opts.width ?? 2.2;
  const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${s}" stroke-width="${w}" stroke-linecap="round"${dash}/>`;
}

function ray(cx, cy, len, ang, opts) {
  const [x, y] = P(cx, cy, len, ang);
  return line(cx, cy, x, y, opts);
}

function poly(pts, opts = {}) {
  const fill = opts.fill ?? FACE;
  const stroke = opts.stroke ?? INK;
  const w = opts.width ?? 2.2;
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + fmt(p[0]) + ' ' + fmt(p[1])).join(' ');
  return `<path d="${d} Z" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

// Filled translucent wedge that marks an angle (always the shorter side).
function wedge(cx, cy, r, a1, a2, color = GIVEN, opacity = 0.16) {
  const [x1, y1] = P(cx, cy, r, a1);
  const [x2, y2] = P(cx, cy, r, a2);
  let d = ((a2 - a1) % 360 + 360) % 360;
  let sweep;
  if (d <= 180) sweep = 1;
  else { sweep = 0; d = 360 - d; }
  return `<path d="M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 0 ${sweep} ${fmt(x2)} ${fmt(y2)} Z" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="1.7" stroke-opacity="0.95" stroke-linejoin="round"/>`;
}

// Stroke-only arc marking an angle. Use when something else (e.g. a right-angle
// square) sits at the same vertex so it stays visible.
function arcOnly(cx, cy, r, a1, a2, color = GIVEN) {
  const [x1, y1] = P(cx, cy, r, a1);
  const [x2, y2] = P(cx, cy, r, a2);
  let d = ((a2 - a1) % 360 + 360) % 360;
  let sweep;
  if (d <= 180) sweep = 1;
  else { sweep = 0; d = 360 - d; }
  return `<path d="M ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 0 ${sweep} ${fmt(x2)} ${fmt(y2)}" fill="none" stroke="${color}" stroke-width="1.9"/>`;
}

// Label text on the bisector of the SHORTER arc, just outside.
function angleLabel(cx, cy, r, a1, a2, text, color = GIVEN, offset = 18) {
  let d = ((a2 - a1) % 360 + 360) % 360;
  let mid;
  if (d <= 180) mid = a1 + d / 2;
  else          mid = a1 - (360 - d) / 2;
  const [x, y] = P(cx, cy, r + offset, mid);
  return `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="16" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">${text}</text>`;
}

// Convenience: wedge + label combined.
function angle(cx, cy, r, a1, a2, text, color = GIVEN, labelOffset = 18) {
  return wedge(cx, cy, r, a1, a2, color) + angleLabel(cx, cy, r, a1, a2, text, color, labelOffset);
}

// Like angle() but uses a stroke-only arc — use at vertices that also carry
// a right-angle square so the square stays visible.
function angleArc(cx, cy, r, a1, a2, text, color = GIVEN, labelOffset = 16) {
  return arcOnly(cx, cy, r, a1, a2, color) + angleLabel(cx, cy, r, a1, a2, text, color, labelOffset);
}

// Right-angle square at vertex; stroke-only so it stays visible over wedges.
function rightAngleSquare(cx, cy, size, a1) {
  const [ax, ay] = P(cx, cy, size, a1);
  const [bx, by] = P(cx, cy, size * Math.SQRT2, a1 + 45);
  const [dxv, dyv] = P(cx, cy, size, a1 + 90);
  return `<path d="M ${fmt(ax)} ${fmt(ay)} L ${fmt(bx)} ${fmt(by)} L ${fmt(dxv)} ${fmt(dyv)}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
}

// Vertex dot
function vDot(x, y) {
  return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3.2" fill="${INK}"/>`;
}

// Vertex letter label placed outside the figure (away from the centroid).
function vLabel(x, y, text, cx, cy, offset = 16) {
  const a = Math.atan2(y - cy, x - cx);
  const lx = x + Math.cos(a) * offset;
  const ly = y + Math.sin(a) * offset;
  return `<text x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="15" font-style="italic" font-family="Georgia,'Times New Roman',serif">${text}</text>`;
}

// Dot + label
function V(x, y, text, cx, cy, offset = 16) {
  return vDot(x, y) + (text ? vLabel(x, y, text, cx, cy, offset) : '');
}

// Tick marks at midpoint of segment, perpendicular, indicating equal lengths.
function ticks(x1, y1, x2, y2, count = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const px = -Math.sin(a), py = Math.cos(a);
  const tx = Math.cos(a),  ty = Math.sin(a);
  const len = 7, sp = 5.5;
  let s = '';
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * sp;
    const cxi = mx + tx * off, cyi = my + ty * off;
    s += `<line x1="${fmt(cxi-px*len)}" y1="${fmt(cyi-py*len)}" x2="${fmt(cxi+px*len)}" y2="${fmt(cyi+py*len)}" stroke="${RULE}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return s;
}

// Triangular arrowhead chevrons indicating parallel lines.
function parMark(x1, y1, x2, y2, count = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  let s = '';
  const sp = 9, sz = 8, open = 0.55;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * sp;
    const bx = mx + Math.cos(a) * off, by = my + Math.sin(a) * off;
    const tipX = bx + Math.cos(a) * sz * 0.45, tipY = by + Math.sin(a) * sz * 0.45;
    const lx = bx + Math.cos(a + Math.PI - open) * sz, ly = by + Math.sin(a + Math.PI - open) * sz;
    const rx = bx + Math.cos(a + Math.PI + open) * sz, ry = by + Math.sin(a + Math.PI + open) * sz;
    s += `<path d="M ${fmt(lx)} ${fmt(ly)} L ${fmt(tipX)} ${fmt(tipY)} L ${fmt(rx)} ${fmt(ry)} Z" fill="${RULE}" stroke="${RULE}" stroke-width="0.8" stroke-linejoin="round"/>`;
  }
  return s;
}

// ===================================================================
// PUZZLE GENERATORS
// ===================================================================
const PUZZLES = [];

// ---------- 1. Vertical angles ----------
PUZZLES.push({
  name: 'Vertically Opposite',
  difficulty: 1,
  concept: 'When two straight lines cross, the angles directly opposite are equal.',
  gen() {
    const base = randInt(15, 65);
    const inner = randInt(35, 75);
    const cx = 250, cy = 200, L = 170;
    const a1 = base, a2 = base + inner;
    const [p1x, p1y] = P(cx, cy, L, a1),   [p2x, p2y] = P(cx, cy, L, a1 + 180);
    const [q1x, q1y] = P(cx, cy, L, a2),   [q2x, q2y] = P(cx, cy, L, a2 + 180);
    const svg = [
      line(p1x, p1y, p2x, p2y),
      line(q1x, q1y, q2x, q2y),
      angle(cx, cy, 30, a1, a2, inner + '°', GIVEN),
      angle(cx, cy, 30, a1 + 180, a2 + 180, 'x', UNK),
      vDot(cx, cy),
    ].join('');
    return {
      svg,
      answer: inner,
      steps: [
        `x and ${inner}° are vertically opposite (the two crossing lines reflect them across the intersection).`,
        `Vertically opposite angles are equal, so x = ${inner}°.`,
      ],
    };
  },
});

// ---------- 2. Linear pair ----------
PUZZLES.push({
  name: 'Angles on a Straight Line',
  difficulty: 1,
  concept: 'Angles on one side of a straight line add up to 180° (a linear pair).',
  gen() {
    const a = randInt(35, 145);
    const tilt = randInt(-10, 10);
    const cx = 250, cy = 250, L = 200;
    const [lx, ly] = P(cx, cy, L, 180 + tilt);
    const [rx, ry] = P(cx, cy, L,   0 + tilt);
    const rayAng = tilt + 180 - a;
    const [ux, uy] = P(cx, cy, 160, rayAng);
    const svg = [
      line(lx, ly, rx, ry),
      line(cx, cy, ux, uy),
      angle(cx, cy, 32, rayAng, 0 + tilt, a + '°', GIVEN),
      angle(cx, cy, 32, 180 + tilt, rayAng, 'x', UNK),
      vDot(cx, cy),
    ].join('');
    return {
      svg,
      answer: 180 - a,
      steps: [
        `x and ${a}° sit on the same straight line — a linear pair.`,
        `Angles on a straight line sum to 180°, so x = 180° − ${a}° = ${180 - a}°.`,
      ],
    };
  },
});

// ---------- 3. Angles around a point ----------
PUZZLES.push({
  name: 'Angles Around a Point',
  difficulty: 2,
  concept: 'Angles around a point sum to 360°.',
  gen() {
    const a = randInt(80, 150);
    const b = randInt(80, 150);
    const c = 360 - a - b;
    if (c < 50 || c > 170) return this.gen();
    const cx = 250, cy = 210, L = 135;
    const start = randInt(0, 90);
    const r1 = start, r2 = start + a, r3 = start + a + b;
    const svg = [
      ray(cx, cy, L, r1),
      ray(cx, cy, L, r2),
      ray(cx, cy, L, r3),
      angle(cx, cy, 30, r1, r2, a + '°', GIVEN),
      angle(cx, cy, 30, r2, r3, b + '°', GIVEN),
      angle(cx, cy, 44, r3, r1, 'x', UNK),
      vDot(cx, cy),
    ].join('');
    return {
      svg,
      answer: c,
      steps: [
        `The three angles meet at one point and sweep all the way around.`,
        `Angles around a point sum to 360°, so x = 360° − ${a}° − ${b}° = ${c}°.`,
      ],
    };
  },
});

// ---------- 4. Complementary inside a right angle ----------
PUZZLES.push({
  name: 'Complementary Angles',
  difficulty: 1,
  concept: 'Two angles that make a right angle are complementary — they sum to 90°.',
  gen() {
    const a = randInt(20, 70);
    const tilt = randInt(0, 18);
    const cx = 160, cy = 290, L = 195;
    const r1 = -90 + tilt;
    const r2 = 0 + tilt;
    const rMid = r1 + a;
    const svg = [
      ray(cx, cy, L, r1),
      ray(cx, cy, L, r2),
      ray(cx, cy, L * 0.95, rMid),
      // stroke-only arcs at this vertex so the right-angle L stays visible
      angleArc(cx, cy, 38, r1, rMid, a + '°', GIVEN),
      angleArc(cx, cy, 38, rMid, r2, 'x', UNK),
      rightAngleSquare(cx, cy, 18, r1),
      vDot(cx, cy),
    ].join('');
    return {
      svg,
      answer: 90 - a,
      steps: [
        `The small square shows the outer two rays meet at 90°.`,
        `${a}° and x fill that right angle together, so x = 90° − ${a}° = ${90 - a}°.`,
      ],
    };
  },
});

// Helper: build triangle from two base vertices + angles at each.
function triFromBase(Bx, By, Cx, Cy, angAtB, angAtC) {
  const a1 = -angAtB * Math.PI / 180;
  const a2 = (180 + angAtC) * Math.PI / 180;
  const det = Math.cos(a1) * (-Math.sin(a2)) - (-Math.cos(a2)) * Math.sin(a1);
  const t = ((Cx - Bx) * (-Math.sin(a2))) / det;
  return [Bx + t * Math.cos(a1), By + t * Math.sin(a1)];
}

// ---------- 5. Triangle angle sum ----------
PUZZLES.push({
  name: 'Triangle Angle Sum',
  difficulty: 2,
  concept: 'The three interior angles of any triangle sum to 180°.',
  gen() {
    const A = randInt(35, 95);
    const B = randInt(35, 130 - A);
    const C = 180 - A - B;
    if (C < 25) return this.gen();
    const Bx = 100, By = 320, Cx = 400, Cy = 320;
    const [Ax, Ay] = triFromBase(Bx, By, Cx, Cy, A, B);
    const cen = centroid([[Ax, Ay], [Bx, By], [Cx, Cy]]);
    const svg = [
      poly([[Ax, Ay], [Bx, By], [Cx, Cy]]),
      angle(Ax, Ay, 26, angOf(Ax, Ay, Bx, By), angOf(Ax, Ay, Cx, Cy), A + '°', GIVEN),
      angle(Bx, By, 26, angOf(Bx, By, Cx, Cy), angOf(Bx, By, Ax, Ay), B + '°', GIVEN),
      angle(Cx, Cy, 26, angOf(Cx, Cy, Ax, Ay), angOf(Cx, Cy, Bx, By), 'x', UNK),
      V(Ax, Ay, 'A', cen[0], cen[1]),
      V(Bx, By, 'B', cen[0], cen[1]),
      V(Cx, Cy, 'C', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: C,
      steps: [
        `The three interior angles of a triangle add to 180°.`,
        `${A}° + ${B}° + x = 180°, so x = ${C}°.`,
      ],
    };
  },
});

// ---------- 6. Isosceles — given apex, find base ----------
PUZZLES.push({
  name: 'Isosceles Triangle — Base Angles',
  difficulty: 2,
  concept: 'The two base angles of an isosceles triangle are equal.',
  gen() {
    const apex = 2 * randInt(10, 60);  // even -> integer base
    const base = (180 - apex) / 2;
    const cx = 250, cyApex = 90;
    const half = apex / 2;
    const sideLen = 220;
    const Lx = cx - Math.sin(rad(half)) * sideLen;
    const Ly = cyApex + Math.cos(rad(half)) * sideLen;
    const Rx = cx + Math.sin(rad(half)) * sideLen;
    const Ry = Ly;
    const cen = centroid([[cx, cyApex], [Lx, Ly], [Rx, Ry]]);
    const svg = [
      poly([[cx, cyApex], [Lx, Ly], [Rx, Ry]]),
      ticks(cx, cyApex, Lx, Ly, 1),
      ticks(cx, cyApex, Rx, Ry, 1),
      angle(cx, cyApex, 28, angOf(cx, cyApex, Lx, Ly), angOf(cx, cyApex, Rx, Ry), apex + '°', GIVEN),
      angle(Lx, Ly, 26, angOf(Lx, Ly, Rx, Ry), angOf(Lx, Ly, cx, cyApex), 'x', UNK),
      V(cx, cyApex, 'A', cen[0], cen[1]),
      V(Lx, Ly, 'B', cen[0], cen[1]),
      V(Rx, Ry, 'C', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: base,
      steps: [
        `Tick marks show AB = AC — the triangle is isosceles.`,
        `Its base angles ∠ABC and ∠ACB are equal. Call each x.`,
        `Triangle sum: 2x + ${apex}° = 180° → x = ${base}°.`,
      ],
    };
  },
});

// ---------- 7. Isosceles — given base, find apex ----------
PUZZLES.push({
  name: 'Isosceles Triangle — Apex Angle',
  difficulty: 2,
  concept: 'Base angles of an isosceles triangle are equal; all three sum to 180°.',
  gen() {
    const base = randInt(30, 75);
    const apex = 180 - 2 * base;
    const cx = 250, cyApex = 90;
    const half = apex / 2;
    const sideLen = 220;
    const Lx = cx - Math.sin(rad(half)) * sideLen;
    const Ly = cyApex + Math.cos(rad(half)) * sideLen;
    const Rx = cx + Math.sin(rad(half)) * sideLen;
    const Ry = Ly;
    const cen = centroid([[cx, cyApex], [Lx, Ly], [Rx, Ry]]);
    const svg = [
      poly([[cx, cyApex], [Lx, Ly], [Rx, Ry]]),
      ticks(cx, cyApex, Lx, Ly, 1),
      ticks(cx, cyApex, Rx, Ry, 1),
      angle(cx, cyApex, 28, angOf(cx, cyApex, Lx, Ly), angOf(cx, cyApex, Rx, Ry), 'x', UNK),
      angle(Lx, Ly, 26, angOf(Lx, Ly, Rx, Ry), angOf(Lx, Ly, cx, cyApex), base + '°', GIVEN),
      V(cx, cyApex, 'A', cen[0], cen[1]),
      V(Lx, Ly, 'B', cen[0], cen[1]),
      V(Rx, Ry, 'C', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: apex,
      steps: [
        `Equal tick marks ⇒ isosceles, so both base angles equal ${base}°.`,
        `Angles in a triangle sum to 180°, so x = 180° − 2·${base}° = ${apex}°.`,
      ],
    };
  },
});

// ---------- 8. Exterior angle of a triangle ----------
PUZZLES.push({
  name: 'Exterior Angle of a Triangle',
  difficulty: 3,
  concept: 'An exterior angle of a triangle equals the sum of the two non-adjacent interior angles.',
  gen() {
    const A = randInt(35, 75);
    const B = randInt(35, 75);
    const Bx = 100, By = 320, Cx = 360, Cy = 320;
    const [Ax, Ay] = triFromBase(Bx, By, Cx, Cy, A, B);
    const dirBC = Math.atan2(Ay - By, Ax - Bx);
    const ex = Ax + Math.cos(dirBC) * 110;
    const ey = Ay + Math.sin(dirBC) * 110;
    const cen = centroid([[Ax, Ay], [Bx, By], [Cx, Cy]]);
    const svg = [
      poly([[Ax, Ay], [Bx, By], [Cx, Cy]]),
      line(Bx, By, ex, ey),  // BC extended past A (we called it A but for the math we used "triFromBase" — angles A,B at the BASE)
      angle(Bx, By, 26, angOf(Bx, By, Cx, Cy), angOf(Bx, By, Ax, Ay), A + '°', GIVEN),
      angle(Cx, Cy, 26, angOf(Cx, Cy, Ax, Ay), angOf(Cx, Cy, Bx, By), B + '°', GIVEN),
      angle(Ax, Ay, 26, angOf(Ax, Ay, Cx, Cy), angOf(Ax, Ay, ex, ey), 'x', UNK),
      V(Bx, By, 'B', cen[0], cen[1]),
      V(Cx, Cy, 'C', cen[0], cen[1]),
      V(Ax, Ay, 'A', cen[0], cen[1], 18),
    ].join('');
    return {
      svg,
      answer: A + B,
      steps: [
        `x is the exterior angle of the triangle at A (formed by side AC and the extension of BA).`,
        `An exterior angle equals the sum of the two non-adjacent interior angles.`,
        `So x = ${A}° + ${B}° = ${A + B}°.`,
      ],
    };
  },
});

// ---------- Parallel-line transversal puzzles share a helper ----------
function parTransversal(ang, y1, y2) {
  const ix1 = 200;
  const dx = (y2 - y1) / Math.tan(rad(ang));
  const ix2 = ix1 + dx;
  const ext = 200;
  const tx1 = ix1 - Math.cos(rad(ang)) * ext;
  const ty1 = y1  - Math.sin(rad(ang)) * ext;
  const tx2 = ix2 + Math.cos(rad(ang)) * ext;
  const ty2 = y2  + Math.sin(rad(ang)) * ext;
  return { ix1, ix2, tx1, ty1, tx2, ty2 };
}

// ---------- 9. Corresponding angles ----------
PUZZLES.push({
  name: 'Corresponding Angles (F-angles)',
  difficulty: 2,
  concept: 'When a transversal cuts two parallel lines, corresponding angles are equal.',
  gen() {
    const ang = randInt(35, 75);
    const y1 = 130, y2 = 290;
    const T = parTransversal(ang, y1, y2);
    const svg = [
      line(40, y1, 470, y1), parMark(40, y1, 470, y1, 1),
      line(40, y2, 470, y2), parMark(40, y2, 470, y2, 1),
      line(T.tx1, T.ty1, T.tx2, T.ty2),
      angle(T.ix1, y1, 30, 0, ang, ang + '°', GIVEN),
      angle(T.ix2, y2, 30, 0, ang, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: ang,
      steps: [
        `The chevrons mark the two horizontal lines as parallel.`,
        `${ang}° and x are corresponding angles (same position at each intersection — the "F" shape).`,
        `Corresponding angles between parallels are equal, so x = ${ang}°.`,
      ],
    };
  },
});

// ---------- 10. Alternate angles (Z) ----------
PUZZLES.push({
  name: 'Alternate Angles (Z-angles)',
  difficulty: 2,
  concept: 'Alternate interior angles between two parallels are equal.',
  gen() {
    const ang = randInt(30, 75);
    const y1 = 130, y2 = 290;
    const T = parTransversal(ang, y1, y2);
    const svg = [
      line(40, y1, 470, y1), parMark(40, y1, 470, y1, 1),
      line(40, y2, 470, y2), parMark(40, y2, 470, y2, 1),
      line(T.tx1, T.ty1, T.tx2, T.ty2),
      angle(T.ix1, y1, 30, ang, 180, ang + '°', GIVEN),
      angle(T.ix2, y2, 30, 0, ang + 180, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: ang,
      steps: [
        `Both arrowed lines are parallel; one transversal crosses both.`,
        `${ang}° and x lie on opposite sides of the transversal, between the parallels — a "Z" shape.`,
        `Alternate interior angles are equal, so x = ${ang}°.`,
      ],
    };
  },
});

// ---------- 11. Co-interior angles (C) ----------
PUZZLES.push({
  name: 'Co-interior Angles (C-angles)',
  difficulty: 2,
  concept: 'Co-interior (same-side interior) angles between parallels sum to 180°.',
  gen() {
    const ang = randInt(50, 130);
    const y1 = 130, y2 = 290;
    const T = parTransversal(ang, y1, y2);
    const svg = [
      line(40, y1, 470, y1), parMark(40, y1, 470, y1, 1),
      line(40, y2, 470, y2), parMark(40, y2, 470, y2, 1),
      line(T.tx1, T.ty1, T.tx2, T.ty2),
      angle(T.ix1, y1, 30, 0, ang, ang + '°', GIVEN),
      angle(T.ix2, y2, 30, ang + 180, 360, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 180 - ang,
      steps: [
        `${ang}° and x lie on the same side of the transversal, between the parallels — co-interior angles.`,
        `Co-interior angles sum to 180°, so x = 180° − ${ang}° = ${180 - ang}°.`,
      ],
    };
  },
});

// ---------- 12. Bow-tie ----------
PUZZLES.push({
  name: 'Bow-tie',
  difficulty: 3,
  concept: 'Two triangles meet at a vertex; vertical angles at the centre, then triangle-sum gives the missing angle.',
  gen() {
    const A = randInt(40, 80);
    const B = randInt(40, 80);
    const O = 180 - A - B;
    if (O < 30) return this.gen();
    const C = randInt(35, 175 - O);
    const D = 180 - O - C;
    if (D < 15) return this.gen();
    const ox = 250, oy = 200;
    const Ax = 80, Ay = 100, Bx = 80, By = 300;
    const Cx = 420, Cy = 100, Dx = 420, Dy = 300;
    const cenL = centroid([[Ax, Ay], [Bx, By], [ox, oy]]);
    const cenR = centroid([[Cx, Cy], [Dx, Dy], [ox, oy]]);
    const svg = [
      poly([[Ax, Ay], [ox, oy], [Bx, By]]),
      poly([[Cx, Cy], [ox, oy], [Dx, Dy]]),
      angle(Ax, Ay, 26, angOf(Ax, Ay, ox, oy), angOf(Ax, Ay, Bx, By), A + '°', GIVEN),
      angle(Bx, By, 26, angOf(Bx, By, Ax, Ay), angOf(Bx, By, ox, oy), B + '°', GIVEN),
      angle(Cx, Cy, 26, angOf(Cx, Cy, Dx, Dy), angOf(Cx, Cy, ox, oy), C + '°', GIVEN),
      angle(Dx, Dy, 26, angOf(Dx, Dy, ox, oy), angOf(Dx, Dy, Cx, Cy), 'x', UNK),
      V(Ax, Ay, 'A', cenL[0], cenL[1]),
      V(Bx, By, 'B', cenL[0], cenL[1]),
      V(ox, oy, 'O', (cenL[0]+cenR[0])/2, (cenL[1]+cenR[1])/2, 12),
      V(Cx, Cy, 'C', cenR[0], cenR[1]),
      V(Dx, Dy, 'D', cenR[0], cenR[1]),
    ].join('');
    return {
      svg,
      answer: D,
      steps: [
        `Left triangle: angle at O = 180° − ${A}° − ${B}° = ${O}°.`,
        `Right triangle's angle at O is vertically opposite, so it equals ${O}° too.`,
        `Right triangle sum: x = 180° − ${O}° − ${C}° = ${D}°.`,
      ],
    };
  },
});

// ---------- 13. Quadrilateral sum ----------
PUZZLES.push({
  name: 'Quadrilateral Angle Sum',
  difficulty: 2,
  concept: 'The interior angles of any quadrilateral sum to 360°.',
  gen() {
    let A, B, C, D;
    for (let tries = 0; tries < 200; tries++) {
      A = randInt(65, 125); B = randInt(65, 125); C = randInt(65, 125);
      D = 360 - A - B - C;
      if (D >= 60 && D <= 130) break;
    }
    const len = 130;
    let dir = -randInt(5, 25);
    let pts = [[0, 0]];
    pts.push([pts[0][0] + Math.cos(rad(dir)) * len, pts[0][1] + Math.sin(rad(dir)) * len]);
    dir += (180 - B);
    pts.push([pts[1][0] + Math.cos(rad(dir)) * len, pts[1][1] + Math.sin(rad(dir)) * len]);
    dir += (180 - C);
    pts.push([pts[2][0] + Math.cos(rad(dir)) * len, pts[2][1] + Math.sin(rad(dir)) * len]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const ox = 250 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = 200 - (Math.min(...ys) + Math.max(...ys)) / 2;
    pts = pts.map(p => [p[0] + ox, p[1] + oy]);
    const [PA, PB, PC, PD] = pts;
    const cen = centroid(pts);
    const svg = [
      poly(pts),
      angle(PA[0], PA[1], 24, angOf(PA[0], PA[1], PD[0], PD[1]), angOf(PA[0], PA[1], PB[0], PB[1]), A + '°', GIVEN),
      angle(PB[0], PB[1], 24, angOf(PB[0], PB[1], PA[0], PA[1]), angOf(PB[0], PB[1], PC[0], PC[1]), B + '°', GIVEN),
      angle(PC[0], PC[1], 24, angOf(PC[0], PC[1], PB[0], PB[1]), angOf(PC[0], PC[1], PD[0], PD[1]), C + '°', GIVEN),
      angle(PD[0], PD[1], 24, angOf(PD[0], PD[1], PC[0], PC[1]), angOf(PD[0], PD[1], PA[0], PA[1]), 'x', UNK),
      V(PA[0], PA[1], 'A', cen[0], cen[1]),
      V(PB[0], PB[1], 'B', cen[0], cen[1]),
      V(PC[0], PC[1], 'C', cen[0], cen[1]),
      V(PD[0], PD[1], 'D', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: D,
      steps: [
        `A quadrilateral's interior angles sum to 360° (split it into two triangles).`,
        `x = 360° − ${A}° − ${B}° − ${C}° = ${D}°.`,
      ],
    };
  },
});

// ---------- 14. Five-pointed star ----------
PUZZLES.push({
  name: 'Five-pointed Star',
  difficulty: 4,
  concept: 'The five point-angles of any 5-pointed star sum to 180°.',
  gen() {
    let pts;
    for (let tries = 0; tries < 500; tries++) {
      pts = [randInt(24, 50), randInt(24, 50), randInt(24, 50), randInt(24, 50)];
      const last = 180 - pts.reduce((a, b) => a + b, 0);
      if (last >= 24 && last <= 52) { pts.push(last); break; }
    }
    if (!pts || pts.length !== 5) pts = [30, 35, 40, 40, 35];
    const cx = 250, cy = 200, R = 150, r = 60;
    const verts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -90 + i * 36;
      verts.push(P(cx, cy, i % 2 === 0 ? R : r, ang));
    }
    let svg = poly(verts);
    const unknownIdx = randInt(0, 4);
    for (let i = 0; i < 5; i++) {
      const tip = verts[i * 2];
      const prev = verts[(i * 2 + 9) % 10];
      const next = verts[(i * 2 + 1) % 10];
      const a1 = angOf(tip[0], tip[1], prev[0], prev[1]);
      const a2 = angOf(tip[0], tip[1], next[0], next[1]);
      const isUnk = (i === unknownIdx);
      svg += angle(tip[0], tip[1], 20, a1, a2,
        isUnk ? 'x' : (pts[i] + '°'),
        isUnk ? UNK : GIVEN, 22);
    }
    const known = pts.filter((_, i) => i !== unknownIdx);
    return {
      svg,
      answer: pts[unknownIdx],
      steps: [
        `Classic result: the five tip angles of any 5-pointed star sum to 180°.`,
        `(Each tip is an exterior angle of a triangle formed by two star edges and an internal chord.)`,
        `So x = 180° − (${known.join('° + ')}°) = ${pts[unknownIdx]}°.`,
      ],
    };
  },
});

// ---------- 15. Parallel + Triangle ----------
PUZZLES.push({
  name: 'Parallel + Triangle',
  difficulty: 4,
  concept: 'Combine alternate angles (parallel lines) with triangle-sum.',
  gen() {
    const A = randInt(40, 80);
    const B = randInt(40, 80);
    const C = 180 - A - B;
    const Bx = 90, By = 290, Cx = 410, Cy = 290;
    const [Ax, Ay] = triFromBase(Bx, By, Cx, Cy, A, B);
    const cen = centroid([[Ax, Ay], [Bx, By], [Cx, Cy]]);
    const svg = [
      // upper parallel through A
      line(40, Ay, 460, Ay), parMark(40, Ay, 460, Ay, 1),
      // lower parallel containing base BC
      line(40, By, 460, By), parMark(40, By, 460, By, 1),
      poly([[Ax, Ay], [Bx, By], [Cx, Cy]]),
      angle(Bx, By, 26, angOf(Bx, By, Cx, Cy), angOf(Bx, By, Ax, Ay), A + '°', GIVEN),
      angle(Cx, Cy, 26, angOf(Cx, Cy, Ax, Ay), angOf(Cx, Cy, Bx, By), B + '°', GIVEN),
      angle(Ax, Ay, 26, angOf(Ax, Ay, Cx, Cy), angOf(Ax, Ay, Bx, By), 'x', UNK),
      V(Bx, By, 'B', cen[0], cen[1]),
      V(Cx, Cy, 'C', cen[0], cen[1]),
      V(Ax, Ay, 'A', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: C,
      steps: [
        `Via the parallel through A: the angles either side of x are alternate to ${A}° and ${B}° (Z-angles).`,
        `Those two pieces and x lie on the straight upper parallel, summing to 180°.`,
        `So x = 180° − ${A}° − ${B}° = ${C}°.`,
        `(Equivalently: triangle ABC's angles sum to 180°.)`,
      ],
    };
  },
});

// ---------- 16. Right triangle acute ----------
PUZZLES.push({
  name: 'Right Triangle Acute',
  difficulty: 1,
  concept: 'In a right triangle the two acute angles sum to 90°.',
  gen() {
    const a = randInt(20, 70);
    const x = 90 - a;
    const Bx = 100, By = 300, Cx = 380, Cy = 300;
    const Ax = 380, Ay = 300 - Math.tan(rad(a)) * (Cx - Bx);
    const cen = centroid([[Ax, Ay], [Bx, By], [Cx, Cy]]);
    const svg = [
      poly([[Ax, Ay], [Bx, By], [Cx, Cy]]),
      rightAngleSquare(Cx, Cy, 16, 180),
      angle(Bx, By, 28, angOf(Bx, By, Cx, Cy), angOf(Bx, By, Ax, Ay), a + '°', GIVEN),
      angle(Ax, Ay, 28, angOf(Ax, Ay, Bx, By), angOf(Ax, Ay, Cx, Cy), 'x', UNK),
      V(Bx, By, 'B', cen[0], cen[1]),
      V(Cx, Cy, 'C', cen[0], cen[1]),
      V(Ax, Ay, 'A', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: x,
      steps: [
        `The square marks the right angle (90°) at C.`,
        `A right triangle's two acute angles sum to 90°.`,
        `So x = 90° − ${a}° = ${x}°.`,
      ],
    };
  },
});

// ============================================================
// COMPLEX / CHAINED PUZZLES — these need 2-4 deductions and
// the figures carry several visible features (ticks, parallels,
// extra cevians, multiple polygons).
// ============================================================

// ---------- 17. Zigzag between parallels ----------
PUZZLES.push({
  name: 'Zigzag Between Parallels',
  difficulty: 3,
  concept: 'Through the bend, draw a third line parallel to both. By alternate (Z) angles the bend equals the sum of the two outer angles.',
  gen() {
    const alpha = randInt(25, 65);
    const beta  = randInt(25, 65);
    const y1 = 110, y2 = 290;
    const A = [110, y1];
    const C = [110, y2];
    const sumR = rad(alpha + beta);
    const t = (y2 - y1) * Math.cos(rad(beta)) / Math.sin(sumR);
    const Bx = A[0] + t * Math.cos(rad(alpha));
    const By = A[1] + t * Math.sin(rad(alpha));
    const cen = [(A[0] + Bx + C[0]) / 3, (A[1] + By + C[1]) / 3];
    const svg = [
      line(40, y1, 470, y1), parMark(40, y1, 470, y1, 1),
      line(40, y2, 470, y2), parMark(40, y2, 470, y2, 1),
      // dashed auxiliary through B parallel to the two — hint of the solution method
      line(40, By, 470, By, { stroke: HINT, width: 1.4, dash: '5 5' }),
      line(A[0], A[1], Bx, By),
      line(Bx, By, C[0], C[1]),
      angle(A[0], A[1], 28, 0, angOf(A[0], A[1], Bx, By), alpha + '°', GIVEN),
      angle(C[0], C[1], 28, angOf(C[0], C[1], Bx, By), 0, beta + '°', GIVEN),
      angle(Bx, By, 32, angOf(Bx, By, A[0], A[1]), angOf(Bx, By, C[0], C[1]), 'x', UNK),
      V(A[0], A[1], 'A', cen[0], cen[1], 18),
      V(Bx, By, 'B', cen[0], cen[1], 18),
      V(C[0], C[1], 'C', cen[0], cen[1], 18),
    ].join('');
    return {
      svg,
      answer: alpha + beta,
      steps: [
        `Draw a line through B parallel to the two arrowed lines (shown dashed in green).`,
        `By alternate (Z) angles with the top parallel, the upper part of ∠ABC equals ${alpha}°.`,
        `By alternate angles with the bottom parallel, the lower part equals ${beta}°.`,
        `Add them: x = ${alpha}° + ${beta}° = ${alpha + beta}°.`,
      ],
    };
  },
});

// ---------- 18. Chained isosceles ----------
PUZZLES.push({
  name: 'Chained Isosceles',
  difficulty: 4,
  concept: 'Two isosceles triangles share the segment AD. Use base-angle equality, the straight-line rule, and triangle-sum — twice.',
  gen() {
    const c = 2 * randInt(15, 39);  // even c ⇒ integer answer
    const Bx = 80, Cx = 420, By = 310, Cy = 310;
    const cr = rad(c);
    const t = (Cx - Bx) * Math.sin(cr) / Math.sin(3 * cr / 2);
    const Ax = Bx + t * Math.cos(cr / 2);
    const Ay = By - t * Math.sin(cr / 2);
    const ACdist = Math.hypot(Ax - Cx, Ay - Cy);
    const Dx = Bx + ACdist;
    const Dy = By;
    if (Dx <= Bx + 40 || Dx >= Cx - 40) return this.gen();
    const cen = [(Ax + Bx + Cx) / 3, (Ay + By + Cy) / 3];
    const svg = [
      poly([[Ax, Ay], [Bx, By], [Cx, Cy]]),
      line(Dx, Dy, Ax, Ay),
      ticks(Bx, By, Dx, Dy, 1),
      ticks(Dx, Dy, Ax, Ay, 1),
      ticks(Ax, Ay, Cx, Cy, 1),
      angle(Cx, Cy, 26, angOf(Cx, Cy, Ax, Ay), angOf(Cx, Cy, Bx, By), c + '°', GIVEN),
      angle(Bx, By, 26, angOf(Bx, By, Cx, Cy), angOf(Bx, By, Ax, Ay), 'x', UNK),
      V(Ax, Ay, 'A', cen[0], cen[1]),
      V(Bx, By, 'B', cen[0], cen[1]),
      V(Cx, Cy, 'C', cen[0], cen[1]),
      V(Dx, Dy, 'D', cen[0], cen[1], 20),
    ].join('');
    return {
      svg,
      answer: c / 2,
      steps: [
        `Tick marks show BD = DA = AC (three equal segments).`,
        `△ADC is isosceles (AD = AC), so ∠ADC = ∠ACD = ${c}°.`,
        `∠ADB and ∠ADC are on the straight line BC, so ∠ADB = 180° − ${c}° = ${180 - c}°.`,
        `△ABD is isosceles (BD = AD), so ∠BAD = ∠ABD = x.`,
        `Triangle-sum in △ABD: 2x + ${180 - c}° = 180° → x = ${c / 2}°.`,
      ],
    };
  },
});

// ---------- 19. Isosceles bow-tie ----------
PUZZLES.push({
  name: 'Isosceles Bow-tie',
  difficulty: 4,
  concept: 'Isosceles base-angles on one side, vertical angles at the centre, triangle-sum on the other side.',
  gen() {
    const alpha = randInt(45, 75);
    const apex = 180 - 2 * alpha;
    let beta;
    let tries = 0;
    do { beta = randInt(20, Math.min(150, 2 * alpha - 25)); tries++; }
    while ((2 * alpha - beta < 20 || 2 * alpha - beta > 140) && tries < 30);
    const x = 2 * alpha - beta;
    if (x < 20 || x > 140) return this.gen();
    const Ox = 250, Oy = 200;
    const armL = 145;
    const Lhalf = apex / 2;
    const Ax = Ox - armL * Math.cos(rad(Lhalf));
    const Ay = Oy - armL * Math.sin(rad(Lhalf));
    const Bx = Ox - armL * Math.cos(rad(Lhalf));
    const By = Oy + armL * Math.sin(rad(Lhalf));
    // Right triangle: angle at O equals apex (vertically opposite). Build by ray intersection.
    // Place C on the upper-right ray (vertical to OA) at length s; D on the lower-right ray at length r.
    // Choose s such that angle OCD = beta. By law of sines in triangle OCD:
    //   OD / sin(beta) = OC / sin(x) = CD / sin(apex)
    // Pick s = OC = 150 (arbitrary), then OD = 150 * sin(beta)/sin(x).
    const OCdir =  apex / 2;            // SVG angle from O to C: mirror of OA across O = pointing upper-right at angle -Lhalf? actually OA direction was 180+Lhalf, vertical opposite = +Lhalf, but we want upper-right (y up = negative), so direction is -Lhalf.
    // Actually OA: Ax = Ox - cos(Lhalf)*arm → direction OA from O = 180 + Lhalf (in SVG; cos(180+Lhalf)<0, sin(180+Lhalf)<0 -> upper-left). Vertical opposite direction = +Lhalf (SVG; cos>0, sin>0 -> lower-right). Hmm so OC should be at SVG angle Lhalf, lower-right.
    // Let me reconsider what's vertical to OA. If A is upper-left of O, the vertical-opposite ray goes lower-right. So C should be lower-right of O. That's strange visually — usually a bow-tie has L-triangle on left (with A upper, B lower) and R-triangle on right (C upper, D lower). The vertical-opposite of OA (upper-left) is the ray going lower-right, which we'd call OD (lower-right vertex). Vertical of OB (lower-left) is the ray going upper-right, which we'd call OC (upper-right).
    // So C is upper-right (along ray from O at angle -Lhalf), D is lower-right (along ray from O at angle +Lhalf).
    const OCdirSVG = -Lhalf;    // upper-right (negative y in SVG = up)
    const ODdirSVG = +Lhalf;    // lower-right
    const armC = 150;
    const armD = armC * Math.sin(rad(beta)) / Math.sin(rad(x));
    const Cx2 = Ox + armC * Math.cos(rad(OCdirSVG));
    const Cy2 = Oy + armC * Math.sin(rad(OCdirSVG));
    const Dx2 = Ox + armD * Math.cos(rad(ODdirSVG));
    const Dy2 = Oy + armD * Math.sin(rad(ODdirSVG));
    const cenL = [(Ax + Bx + Ox) / 3, (Ay + By + Oy) / 3];
    const cenR = [(Cx2 + Dx2 + Ox) / 3, (Cy2 + Dy2 + Oy) / 3];
    const svg = [
      poly([[Ax, Ay], [Ox, Oy], [Bx, By]]),
      poly([[Cx2, Cy2], [Ox, Oy], [Dx2, Dy2]]),
      ticks(Ox, Oy, Ax, Ay, 1),
      ticks(Ox, Oy, Bx, By, 1),
      angle(Ax, Ay, 24, angOf(Ax, Ay, Ox, Oy), angOf(Ax, Ay, Bx, By), alpha + '°', GIVEN),
      angle(Cx2, Cy2, 24, angOf(Cx2, Cy2, Dx2, Dy2), angOf(Cx2, Cy2, Ox, Oy), beta + '°', GIVEN),
      angle(Dx2, Dy2, 24, angOf(Dx2, Dy2, Ox, Oy), angOf(Dx2, Dy2, Cx2, Cy2), 'x', UNK),
      V(Ax, Ay, 'A', cenL[0], cenL[1]),
      V(Bx, By, 'B', cenL[0], cenL[1]),
      // O label: anchored above-left so it never overlaps the central wedges
      vDot(Ox, Oy),
      `<text x="${fmt(Ox - 9)}" y="${fmt(Oy - 9)}" text-anchor="end" fill="${INK}" font-size="15" font-style="italic" font-family="Georgia,serif">O</text>`,
      V(Cx2, Cy2, 'C', cenR[0], cenR[1]),
      V(Dx2, Dy2, 'D', cenR[0], cenR[1]),
    ].join('');
    return {
      svg,
      answer: x,
      steps: [
        `Left triangle △OAB has OA = OB (tick marks), so it's isosceles: ∠OBA = ∠OAB = ${alpha}°.`,
        `Its apex at O: ∠AOB = 180° − 2·${alpha}° = ${apex}°.`,
        `By vertical angles, ∠COD = ∠AOB = ${apex}°.`,
        `Triangle-sum in △OCD: x = 180° − ${apex}° − ${beta}° = ${x}°.`,
      ],
    };
  },
});

// ---------- 20. Isosceles trapezoid ----------
PUZZLES.push({
  name: 'Isosceles Trapezoid',
  difficulty: 3,
  concept: 'Isosceles trapezoid has equal base angles; co-interior angles between the parallels sum to 180°.',
  gen() {
    const alpha = randInt(60, 120);   // angle at top-left vertex A
    const x = 180 - alpha;
    const yTop = 140, yBot = 290;
    const height = yBot - yTop;
    const L = height / Math.sin(rad(alpha));
    const dxLeg = L * Math.cos(rad(alpha));   // negative if alpha < 90 (top is wider)
    const halfTop = 70;
    const cxv = 250;
    const A = [cxv - halfTop, yTop];
    const B = [cxv + halfTop, yTop];
    const D = [A[0] + dxLeg, yBot];
    const C = [B[0] - dxLeg, yBot];
    const cen = centroid([A, B, C, D]);
    const svg = [
      poly([A, B, C, D]),
      parMark(A[0], A[1], B[0], B[1], 1),
      parMark(D[0], D[1], C[0], C[1], 1),
      ticks(A[0], A[1], D[0], D[1], 2),
      ticks(B[0], B[1], C[0], C[1], 2),
      angle(A[0], A[1], 26, angOf(A[0], A[1], B[0], B[1]), angOf(A[0], A[1], D[0], D[1]), alpha + '°', GIVEN),
      angle(C[0], C[1], 26, angOf(C[0], C[1], B[0], B[1]), angOf(C[0], C[1], D[0], D[1]), 'x', UNK),
      V(A[0], A[1], 'A', cen[0], cen[1]),
      V(B[0], B[1], 'B', cen[0], cen[1]),
      V(C[0], C[1], 'C', cen[0], cen[1]),
      V(D[0], D[1], 'D', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: x,
      steps: [
        `Chevrons: AB ∥ DC. Tick marks: AD = BC, so this is an isosceles trapezoid.`,
        `Isosceles trapezoid ⇒ base angles are equal: ∠ABC = ∠DAB = ${alpha}°, and ∠BCD = ∠ADC.`,
        `BC is a transversal of the two parallels, so ∠ABC + ∠BCD = 180° (co-interior).`,
        `Hence x = ∠BCD = 180° − ${alpha}° = ${x}°.`,
      ],
    };
  },
});

// ---------- 21. Pentagon angle sum ----------
PUZZLES.push({
  name: 'Pentagon Angle Sum',
  difficulty: 3,
  concept: 'Any pentagon\'s interior angles sum to 540° = (5−2)·180°.',
  gen() {
    let p;
    for (let tries = 0; tries < 500; tries++) {
      p = [randInt(85, 135), randInt(85, 135), randInt(85, 135), randInt(85, 135)];
      const last = 540 - p.reduce((a, b) => a + b, 0);
      if (last >= 80 && last <= 140) { p.push(last); break; }
    }
    if (!p || p.length !== 5) p = [108, 108, 108, 108, 108];
    const len = 100;
    let dir = -90 + randInt(-12, 12);
    let pts = [[0, 0]];
    for (let i = 0; i < 4; i++) {
      pts.push([pts[i][0] + Math.cos(rad(dir)) * len, pts[i][1] + Math.sin(rad(dir)) * len]);
      dir += (180 - p[(i + 1) % 5]);
    }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const ox = 250 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = 200 - (Math.min(...ys) + Math.max(...ys)) / 2;
    pts = pts.map(q => [q[0] + ox, q[1] + oy]);
    const unkIdx = randInt(0, 4);
    const cen = centroid(pts);
    let svg = poly(pts);
    const letters = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < 5; i++) {
      const prev = pts[(i + 4) % 5];
      const here = pts[i];
      const next = pts[(i + 1) % 5];
      const a1 = angOf(here[0], here[1], prev[0], prev[1]);
      const a2 = angOf(here[0], here[1], next[0], next[1]);
      const isUnk = (i === unkIdx);
      svg += angle(here[0], here[1], 22, a1, a2, isUnk ? 'x' : (p[i] + '°'), isUnk ? UNK : GIVEN);
      svg += V(here[0], here[1], letters[i], cen[0], cen[1], 18);
    }
    const known = p.filter((_, i) => i !== unkIdx);
    return {
      svg,
      answer: p[unkIdx],
      steps: [
        `A pentagon's interior angles sum to (5−2) × 180° = 540°.`,
        `(Split it into three triangles from one vertex.)`,
        `x = 540° − (${known.join('° + ')}°) = ${p[unkIdx]}°.`,
      ],
    };
  },
});

// ---------- 22. Quadrilateral cut by a diagonal (two triangles) ----------
PUZZLES.push({
  name: 'Quadrilateral with a Diagonal',
  difficulty: 3,
  concept: 'A diagonal splits a quadrilateral into two triangles — apply triangle-sum to each.',
  gen() {
    // Quadrilateral ABCD with diagonal AC. We give angles ∠BAC, ∠BCA, ∠ACD; find ∠CAD.
    // △ABC sum gives ∠ABC = 180 - ∠BAC - ∠BCA  (not asked, but consistent)
    // △ACD sum: x + ∠ACD + ∠ADC = 180, but we don't know ∠ADC unless we give it.
    // Better: give ∠BAC, ∠BCA, ∠ADC; find ∠ACD with x = 180 - ∠CAD - ∠ADC... need x to be solvable.
    // Cleanest: give the FOUR sub-angles at A and C, find the missing ∠ABC (or ∠ADC).
    // We give ∠BAC = p, ∠CAD = q (so ∠BAD = p+q), ∠ACD = r; find ∠ABC.
    // △ACD sum: q + r + ∠ADC = 180. Doesn't help find ∠ABC.
    //
    // Cleaner two-triangle puzzle:
    //   Given ∠BAC, ∠BCA in △ABC, and ∠CAD, ∠ACD in △ACD; find ∠ABC OR ∠ADC.
    //   △ABC sum → ∠ABC = 180 - ∠BAC - ∠BCA. (one step, but figure has 4 visible angles)
    //
    // Even cleaner chain: GIVEN three sub-angles of a 4-angle split at vertices A and C
    // (e.g., ∠BAC, ∠CAD, ∠ACB), FIND ∠ACD using the fact that the WHOLE quadrilateral angles sum to 360.
    //   ∠A + ∠B + ∠C + ∠D = 360. We know ∠A = ∠BAC + ∠CAD. We need ∠B and ∠D too.
    //   That requires more info.
    //
    // Simplest rich puzzle: triangles share the diagonal AC; both triangles' sums give one equation each.
    //   Give: ∠BAC = p, ∠ABC = q, ∠ACD = r; find ∠ADC = x.
    //   △ABC: ∠BCA = 180 - p - q. (not asked)
    //   △ACD: x = 180 - ∠CAD - r. We don't know ∠CAD.
    //   So we ALSO need to give ∠CAD or ∠BAD or use another relation.
    //
    // Let me just go with: give p = ∠BAC, q = ∠ABC, s = ∠CAD; find x = ∠BCA + ∠ACD = total ∠BCD.
    //   △ABC: ∠BCA = 180 - p - q.
    //   △ACD: ∠ACD = 180 - s - ∠ADC, but we don't know ∠ADC. STILL stuck.
    //
    // Definitive chain: give p = ∠BAC, q = ∠ABC, r = ∠ADC, s = ∠CAD;  find x = ∠BCD.
    //   △ABC: ∠BCA = 180 - p - q.
    //   △ACD: ∠ACD = 180 - s - r.
    //   x = ∠BCA + ∠ACD = (180 - p - q) + (180 - s - r) = 360 - p - q - r - s.
    //   Same as quadrilateral sum since ∠BAD = p + s.  Good chain, 4 givens.

    let p, q, r, s, x;
    for (let i = 0; i < 100; i++) {
      p = randInt(25, 70);
      s = randInt(20, 65);
      q = randInt(50, 130);
      r = randInt(50, 130);
      x = 360 - p - q - r - s;
      if (x >= 50 && x <= 140) break;
    }
    // Build quadrilateral ABCD with: ∠BAD = p+s at A, ∠ABC = q at B, ∠BCD = x at C, ∠ADC = r at D.
    // Walk around it like the quadrilateral puzzle.
    const angs = [p + s, q, x, r];
    const len = 130;
    let dir = -randInt(5, 25);
    let pts = [[0, 0]];
    for (let i = 0; i < 3; i++) {
      pts.push([pts[i][0] + Math.cos(rad(dir)) * len, pts[i][1] + Math.sin(rad(dir)) * len]);
      dir += (180 - angs[(i + 1) % 4]);
    }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const ox = 250 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = 200 - (Math.min(...ys) + Math.max(...ys)) / 2;
    pts = pts.map(q => [q[0] + ox, q[1] + oy]);
    const [A, B, C, D] = pts;
    const cen = centroid(pts);
    const svg = [
      poly(pts),
      line(A[0], A[1], C[0], C[1], { dash: '4 4', stroke: RULE, width: 1.6 }),
      // Two given sub-angles at A: ∠BAC = p (between AB and AC), ∠CAD = s (between AC and AD)
      angle(A[0], A[1], 24, angOf(A[0], A[1], B[0], B[1]), angOf(A[0], A[1], C[0], C[1]), p + '°', GIVEN),
      angle(A[0], A[1], 40, angOf(A[0], A[1], C[0], C[1]), angOf(A[0], A[1], D[0], D[1]), s + '°', GIVEN),
      angle(B[0], B[1], 24, angOf(B[0], B[1], A[0], A[1]), angOf(B[0], B[1], C[0], C[1]), q + '°', GIVEN),
      angle(D[0], D[1], 24, angOf(D[0], D[1], C[0], C[1]), angOf(D[0], D[1], A[0], A[1]), r + '°', GIVEN),
      angle(C[0], C[1], 24, angOf(C[0], C[1], B[0], B[1]), angOf(C[0], C[1], D[0], D[1]), 'x', UNK),
      V(A[0], A[1], 'A', cen[0], cen[1]),
      V(B[0], B[1], 'B', cen[0], cen[1]),
      V(C[0], C[1], 'C', cen[0], cen[1]),
      V(D[0], D[1], 'D', cen[0], cen[1]),
    ].join('');
    return {
      svg,
      answer: x,
      steps: [
        `Diagonal AC (dashed) splits the quadrilateral into △ABC and △ACD.`,
        `△ABC: ∠BCA = 180° − ${p}° − ${q}° = ${180 - p - q}°.`,
        `△ACD: ∠ACD = 180° − ${s}° − ${r}° = ${180 - s - r}°.`,
        `x = ∠BCA + ∠ACD = ${180 - p - q}° + ${180 - s - r}° = ${x}°.`,
      ],
    };
  },
});

// ---------- 23. Z plus Vertical (multi-step parallel chain) ----------
PUZZLES.push({
  name: 'Parallels with a Crossing',
  difficulty: 3,
  concept: 'Bounce an angle from one parallel to the other (alternate angles), then across a crossing (vertical or linear pair).',
  gen() {
    const ang = randInt(40, 80);
    const y1 = 130, y2 = 290;
    const T = parTransversal(ang, y1, y2);
    const svg = [
      line(40, y1, 470, y1), parMark(40, y1, 470, y1, 1),
      line(40, y2, 470, y2), parMark(40, y2, 470, y2, 1),
      line(T.tx1, T.ty1, T.tx2, T.ty2),
      angle(T.ix1, y1, 30, ang, 180, ang + '°', GIVEN),
      angle(T.ix2, y2, 30, ang, 180, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 180 - ang,
      steps: [
        `By alternate angles, the angle at the lower intersection between the lower line (going right) and the transversal (going up) equals ${ang}°.`,
        `x sits next to that angle on the straight lower line (linear pair).`,
        `So x = 180° − ${ang}° = ${180 - ang}°.  (Equivalently x and ${ang}° are co-interior.)`,
      ],
    };
  },
});

// =====================================================================
// Public API: choose a puzzle (optionally filtered by difficulty range)
// =====================================================================
function newPuzzle(minDiff = 1, maxDiff = 5) {
  const pool = PUZZLES.filter(p => p.difficulty >= minDiff && p.difficulty <= maxDiff);
  const def = pick(pool);
  const inst = def.gen();
  return {
    title: def.name,
    difficulty: def.difficulty,
    concept: def.concept,
    ...inst,
  };
}
