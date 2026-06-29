/* puzzles.js — Angle puzzle generators
 *
 * Each puzzle generator returns:
 *   {
 *     title, concept, difficulty (1..5),
 *     svg:    string of SVG inner markup,
 *     answer: integer degrees,
 *     steps:  array of human-readable solution steps,
 *   }
 *
 * SVG coords: 500x400. Angle convention: degrees, 0° = east (+x),
 * increasing CLOCKWISE (so 90° = south because SVG y is down).
 * That's natural for placing arcs with Math.cos/Math.sin directly.
 */

// ---------- tiny helpers ----------
const TAU = Math.PI * 2;
const rad = d => d * Math.PI / 180;
const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick    = arr => arr[Math.floor(Math.random() * arr.length)];

const GIVEN = '#1565c0';
const UNK   = '#c62828';
const INK   = '#1a1a1a';
const RULE  = '#555';

function P(cx, cy, r, a) {
  const t = rad(a);
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
}

function line(x1, y1, x2, y2, opts = {}) {
  const s = opts.stroke ?? INK;
  const w = opts.width ?? 2;
  const dash = opts.dash ? `stroke-dasharray="${opts.dash}"` : '';
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${s}" stroke-width="${w}" stroke-linecap="round" ${dash}/>`;
}

function ray(cx, cy, len, ang, opts = {}) {
  const [x, y] = P(cx, cy, len, ang);
  return line(cx, cy, x, y, opts);
}

// Arc marking the angle from a1 to a2 (always draws the SHORTER arc <= 180°)
function arcMark(cx, cy, r, a1, a2, color = RULE) {
  const [x1, y1] = P(cx, cy, r, a1);
  const [x2, y2] = P(cx, cy, r, a2);
  let d = ((a2 - a1) % 360 + 360) % 360;
  let sweep, large = 0;
  if (d <= 180) sweep = 1;
  else { sweep = 0; d = 360 - d; }
  return `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${color}" stroke-width="1.6" fill="none"/>`;
}

// Position label on bisector of the SHORTER arc
function angleLabel(cx, cy, r, a1, a2, text, color = GIVEN, offset = 16) {
  let d = ((a2 - a1) % 360 + 360) % 360;
  let mid;
  if (d <= 180) mid = a1 + d / 2;
  else          mid = a1 - (360 - d) / 2;
  const [x, y] = P(cx, cy, r + offset, mid);
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="17" font-weight="700">${text}</text>`;
}

function rightAngleSquare(cx, cy, size, a1) {
  // Draws an L at vertex assuming second ray is at a1+90 (cw)
  const [ax, ay] = P(cx, cy, size, a1);
  const [bx, by] = P(cx, cy, size * Math.SQRT2, a1 + 45);
  const [dx, dy] = P(cx, cy, size, a1 + 90);
  return `<path d="M ${ax.toFixed(1)} ${ay.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} L ${dx.toFixed(1)} ${dy.toFixed(1)}" stroke="${RULE}" stroke-width="1.6" fill="none"/>`;
}

function dot(x, y, label, dx = 10, dy = -8) {
  let s = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" fill="${INK}"/>`;
  if (label) s += `<text x="${(x+dx).toFixed(1)}" y="${(y+dy).toFixed(1)}" font-size="14" font-style="italic" fill="${INK}">${label}</text>`;
  return s;
}

// Tick marks (equal-length indicator) at midpoint of segment, perpendicular
function ticks(x1, y1, x2, y2, count = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const px = -Math.sin(a), py = Math.cos(a);        // perpendicular unit
  const tx = Math.cos(a),  ty = Math.sin(a);        // along
  const len = 6, sp = 4;
  let s = '';
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * sp;
    const cxi = mx + tx * off, cyi = my + ty * off;
    s += `<line x1="${(cxi-px*len).toFixed(1)}" y1="${(cyi-py*len).toFixed(1)}" x2="${(cxi+px*len).toFixed(1)}" y2="${(cyi+py*len).toFixed(1)}" stroke="${RULE}" stroke-width="1.6"/>`;
  }
  return s;
}

// Chevron arrowheads indicating parallel lines
function parMark(x1, y1, x2, y2, count = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  let s = '';
  const sp = 7, sz = 6, open = 0.6;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * sp;
    const bx = mx + Math.cos(a) * off, by = my + Math.sin(a) * off;
    const lx = bx + Math.cos(a + Math.PI - open) * sz, ly = by + Math.sin(a + Math.PI - open) * sz;
    const rx = bx + Math.cos(a + Math.PI + open) * sz, ry = by + Math.sin(a + Math.PI + open) * sz;
    s += `<path d="M ${lx.toFixed(1)} ${ly.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)}" stroke="${RULE}" stroke-width="1.6" fill="none"/>`;
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
  concept: 'When two straight lines cross, the angles directly opposite are equal (vertically opposite angles).',
  gen() {
    const base = randInt(15, 65);
    const inner = randInt(30, 75);
    const cx = 250, cy = 200, L = 170;
    const a1 = base, a2 = base + inner;
    const [p1x, p1y] = P(cx, cy, L, a1),   [p2x, p2y] = P(cx, cy, L, a1 + 180);
    const [q1x, q1y] = P(cx, cy, L, a2),   [q2x, q2y] = P(cx, cy, L, a2 + 180);
    const svg = [
      line(p1x, p1y, p2x, p2y),
      line(q1x, q1y, q2x, q2y),
      arcMark(cx, cy, 30, a1, a2),
      angleLabel(cx, cy, 30, a1, a2, inner + '°', GIVEN),
      arcMark(cx, cy, 30, a1 + 180, a2 + 180, UNK),
      angleLabel(cx, cy, 30, a1 + 180, a2 + 180, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: inner,
      steps: [
        `x and ${inner}° are vertically opposite angles (the two crossing lines reflect them across the intersection).`,
        `Vertically opposite angles are equal, so x = ${inner}°.`,
      ],
    };
  },
});

// ---------- 2. Linear pair (supplementary) ----------
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
    const rayAng = tilt + 180 - a;  // ray going up-ish
    const [ux, uy] = P(cx, cy, 160, rayAng);
    const svg = [
      line(lx, ly, rx, ry),
      line(cx, cy, ux, uy),
      arcMark(cx, cy, 32, rayAng, 0 + tilt),
      angleLabel(cx, cy, 32, rayAng, 0 + tilt, a + '°', GIVEN),
      arcMark(cx, cy, 32, 180 + tilt, rayAng, UNK),
      angleLabel(cx, cy, 32, 180 + tilt, rayAng, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 180 - a,
      steps: [
        `x and ${a}° sit on the same straight line — they form a linear pair.`,
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
    // Three rays leaving a point; two angles given, find third (all < 180° for clarity).
    const a = randInt(80, 150);
    const b = randInt(80, 150);
    const c = 360 - a - b;
    if (c < 50 || c > 170) return this.gen();
    const cx = 250, cy = 210, L = 130;
    const start = randInt(0, 90);
    const r1 = start;
    const r2 = start + a;
    const r3 = start + a + b;
    const svg = [
      ray(cx, cy, L, r1),
      ray(cx, cy, L, r2),
      ray(cx, cy, L, r3),
      arcMark(cx, cy, 30, r1, r2),
      angleLabel(cx, cy, 30, r1, r2, a + '°', GIVEN),
      arcMark(cx, cy, 30, r2, r3),
      angleLabel(cx, cy, 30, r2, r3, b + '°', GIVEN),
      arcMark(cx, cy, 42, r3, r1, UNK),
      angleLabel(cx, cy, 42, r3, r1, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: c,
      steps: [
        `The three angles meet at one point and together sweep all the way around.`,
        `Angles around a point sum to 360°, so x = 360° − ${a}° − ${b}° = ${c}°.`,
      ],
    };
  },
});

// ---------- 4. Right angle split ----------
PUZZLES.push({
  name: 'Complementary Angles',
  difficulty: 1,
  concept: 'Two angles that make a right angle are complementary — they sum to 90°.',
  gen() {
    const a = randInt(20, 70);
    const tilt = randInt(0, 30);
    const cx = 250, cy = 270, L = 170;
    const r1 = -90 + tilt;          // up-ish
    const r2 = 0 + tilt;            // right-ish (perp to r1)
    const rMid = r1 + a;            // splits the 90°
    const svg = [
      ray(cx, cy, L, r1),
      ray(cx, cy, L, r2),
      ray(cx, cy, L * 0.95, rMid),
      rightAngleSquare(cx, cy, 14, r1),  // hint that r1↔r2 is 90°
      arcMark(cx, cy, 30, r1, rMid),
      angleLabel(cx, cy, 30, r1, rMid, a + '°', GIVEN),
      arcMark(cx, cy, 30, rMid, r2, UNK),
      angleLabel(cx, cy, 30, rMid, r2, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 90 - a,
      steps: [
        `The little square shows the outer two rays meet at 90°.`,
        `${a}° and x together fill that right angle, so x = 90° − ${a}° = ${90 - a}°.`,
      ],
    };
  },
});

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
    // Build triangle vertices
    const ax = 100, ay = 320;
    const bx = 400, by = 320;
    // Place C such that angle at A = A, angle at B = B
    // Using law of sines or simple geometry: drop perpendiculars
    const baseLen = bx - ax;
    // Height where it meets:
    // From A side: line at angle (-A) above horizontal (toward upper-right)
    // From B side: line at angle (180 + B) (toward upper-left)
    const a1 = -A * Math.PI / 180;          // SVG: negative angle goes up
    const a2 = (180 + B) * Math.PI / 180;
    // Intersection of two parametric lines from A and B
    // From A: (ax + t cos a1, ay + t sin a1)
    // From B: (bx + s cos a2, by + s sin a2)
    // Solve t cos a1 - s cos a2 = bx - ax,  t sin a1 - s sin a2 = 0
    const det = Math.cos(a1) * (-Math.sin(a2)) - (-Math.cos(a2)) * Math.sin(a1);
    const t = ((bx - ax) * (-Math.sin(a2)) - (-Math.cos(a2)) * 0) / det;
    const cx = ax + t * Math.cos(a1);
    const cy = ay + t * Math.sin(a1);

    // Angle directions at A
    const A_to_B = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const A_to_C = Math.atan2(cy - ay, cx - ax) * 180 / Math.PI;
    const B_to_A = Math.atan2(ay - by, ax - bx) * 180 / Math.PI;
    const B_to_C = Math.atan2(cy - by, cx - bx) * 180 / Math.PI;
    const C_to_A = Math.atan2(ay - cy, ax - cx) * 180 / Math.PI;
    const C_to_B = Math.atan2(by - cy, bx - cx) * 180 / Math.PI;

    const svg = [
      line(ax, ay, bx, by),
      line(bx, by, cx, cy),
      line(cx, cy, ax, ay),
      arcMark(ax, ay, 28, A_to_B, A_to_C),
      angleLabel(ax, ay, 28, A_to_B, A_to_C, A + '°', GIVEN),
      arcMark(bx, by, 28, B_to_C, B_to_A),
      angleLabel(bx, by, 28, B_to_C, B_to_A, B + '°', GIVEN),
      arcMark(cx, cy, 28, C_to_A, C_to_B, UNK),
      angleLabel(cx, cy, 28, C_to_A, C_to_B, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: C,
      steps: [
        `The three interior angles of a triangle add to 180°.`,
        `${A}° + ${B}° + x = 180°, so x = 180° − ${A + B}° = ${C}°.`,
      ],
    };
  },
});

// ---------- 6. Isosceles: given apex, find base ----------
PUZZLES.push({
  name: 'Isosceles Triangle — Base Angles',
  difficulty: 2,
  concept: 'The two base angles of an isosceles triangle are equal.',
  gen() {
    const apex = randInt(20, 120);
    const base = (180 - apex) / 2;
    if (!Number.isInteger(base)) return this.gen();
    const cx = 250, cyApex = 90;
    const half = apex / 2;
    const sideLen = 220;
    const Lx = cx - Math.sin(rad(half)) * sideLen;
    const Ly = cyApex + Math.cos(rad(half)) * sideLen;
    const Rx = cx + Math.sin(rad(half)) * sideLen;
    const Ry = Ly;
    const svg = [
      line(cx, cyApex, Lx, Ly),
      line(cx, cyApex, Rx, Ry),
      line(Lx, Ly, Rx, Ry),
      ticks(cx, cyApex, Lx, Ly, 1),
      ticks(cx, cyApex, Rx, Ry, 1),
      // apex angle
      arcMark(cx, cyApex, 28,
        Math.atan2(Ly - cyApex, Lx - cx) * 180 / Math.PI,
        Math.atan2(Ry - cyApex, Rx - cx) * 180 / Math.PI),
      angleLabel(cx, cyApex, 28,
        Math.atan2(Ly - cyApex, Lx - cx) * 180 / Math.PI,
        Math.atan2(Ry - cyApex, Rx - cx) * 180 / Math.PI,
        apex + '°', GIVEN),
      // base angle at L (ask for this)
      arcMark(Lx, Ly, 26,
        Math.atan2(Ry - Ly, Rx - Lx) * 180 / Math.PI,
        Math.atan2(cyApex - Ly, cx - Lx) * 180 / Math.PI, UNK),
      angleLabel(Lx, Ly, 26,
        Math.atan2(Ry - Ly, Rx - Lx) * 180 / Math.PI,
        Math.atan2(cyApex - Ly, cx - Lx) * 180 / Math.PI, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: base,
      steps: [
        `The tick marks show the two slanted sides are equal — this is an isosceles triangle.`,
        `Its two base angles are equal. Call each one x.`,
        `Triangle angles sum to 180°, so 2x + ${apex}° = 180° → x = ${base}°.`,
      ],
    };
  },
});

// ---------- 7. Isosceles: given base, find apex ----------
PUZZLES.push({
  name: 'Isosceles Triangle — Apex Angle',
  difficulty: 2,
  concept: 'Base angles of an isosceles triangle are equal; all three sum to 180°.',
  gen() {
    const base = randInt(35, 75);
    const apex = 180 - 2 * base;
    const cx = 250, cyApex = 90;
    const half = apex / 2;
    const sideLen = 220;
    const Lx = cx - Math.sin(rad(half)) * sideLen;
    const Ly = cyApex + Math.cos(rad(half)) * sideLen;
    const Rx = cx + Math.sin(rad(half)) * sideLen;
    const Ry = Ly;
    const svg = [
      line(cx, cyApex, Lx, Ly),
      line(cx, cyApex, Rx, Ry),
      line(Lx, Ly, Rx, Ry),
      ticks(cx, cyApex, Lx, Ly, 1),
      ticks(cx, cyApex, Rx, Ry, 1),
      arcMark(cx, cyApex, 28,
        Math.atan2(Ly - cyApex, Lx - cx) * 180 / Math.PI,
        Math.atan2(Ry - cyApex, Rx - cx) * 180 / Math.PI, UNK),
      angleLabel(cx, cyApex, 28,
        Math.atan2(Ly - cyApex, Lx - cx) * 180 / Math.PI,
        Math.atan2(Ry - cyApex, Rx - cx) * 180 / Math.PI, 'x', UNK),
      arcMark(Lx, Ly, 26,
        Math.atan2(Ry - Ly, Rx - Lx) * 180 / Math.PI,
        Math.atan2(cyApex - Ly, cx - Lx) * 180 / Math.PI),
      angleLabel(Lx, Ly, 26,
        Math.atan2(Ry - Ly, Rx - Lx) * 180 / Math.PI,
        Math.atan2(cyApex - Ly, cx - Lx) * 180 / Math.PI, base + '°', GIVEN),
    ].join('');
    return {
      svg,
      answer: apex,
      steps: [
        `Equal tick marks → isosceles triangle, so both base angles equal ${base}°.`,
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
    const A = randInt(35, 80);
    const B = randInt(35, 80);
    const ext = A + B;          // exterior at C
    const C = 180 - ext;
    if (C < 20) return this.gen();
    const ax = 90, ay = 300;
    const a1 = -A * Math.PI / 180;
    const a2 = (180 + B) * Math.PI / 180;
    const bx = 360, by = 300;
    const det = Math.cos(a1) * (-Math.sin(a2)) - (-Math.cos(a2)) * Math.sin(a1);
    const t = ((bx - ax) * (-Math.sin(a2))) / det;
    const cx = ax + t * Math.cos(a1);
    const cy = ay + t * Math.sin(a1);
    // Extend BC past C to point E
    const dirBC = Math.atan2(cy - by, cx - bx);
    const ex = cx + Math.cos(dirBC) * 110;
    const ey = cy + Math.sin(dirBC) * 110;

    const A_to_B = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const A_to_C = Math.atan2(cy - ay, cx - ax) * 180 / Math.PI;
    const B_to_A = Math.atan2(ay - by, ax - bx) * 180 / Math.PI;
    const B_to_C = Math.atan2(cy - by, cx - bx) * 180 / Math.PI;
    const C_to_A = Math.atan2(ay - cy, ax - cx) * 180 / Math.PI;
    const C_to_E = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;

    const svg = [
      line(ax, ay, bx, by),
      line(ax, ay, cx, cy),
      line(bx, by, ex, ey),  // BC extended through C to E
      arcMark(ax, ay, 26, A_to_B, A_to_C),
      angleLabel(ax, ay, 26, A_to_B, A_to_C, A + '°', GIVEN),
      arcMark(bx, by, 26, B_to_C, B_to_A),
      angleLabel(bx, by, 26, B_to_C, B_to_A, B + '°', GIVEN),
      arcMark(cx, cy, 26, C_to_A, C_to_E, UNK),
      angleLabel(cx, cy, 26, C_to_A, C_to_E, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: ext,
      steps: [
        `x is an exterior angle of the triangle (it's outside, on the extended side).`,
        `The exterior angle equals the sum of the two non-adjacent interior angles.`,
        `So x = ${A}° + ${B}° = ${ext}°.`,
      ],
    };
  },
});

// ---------- 9. Parallel lines — corresponding angles ----------
PUZZLES.push({
  name: 'Corresponding Angles (F-angles)',
  difficulty: 2,
  concept: 'When a transversal cuts two parallel lines, corresponding angles are equal.',
  gen() {
    const ang = randInt(35, 145);
    // Two horizontal parallel lines, one transversal at angle "ang"
    const y1 = 130, y2 = 290;
    // Transversal slope from angle ang at intersection 1
    // Choose intersection points
    const ix1 = 200;
    const slope = Math.tan(rad(ang));            // dy/dx
    // For ang in (0, 180), slope = tan, but vertical handles itself; avoid 90.
    const dx = (y2 - y1) / Math.tan(rad(ang));
    const ix2 = ix1 + dx;
    // Endpoints far enough
    const ext = 180;
    const tx1 = ix1 - Math.cos(rad(ang)) * ext;
    const ty1 = y1  - Math.sin(rad(ang)) * ext;
    const tx2 = ix2 + Math.cos(rad(ang)) * ext;
    const ty2 = y2  + Math.sin(rad(ang)) * ext;

    const svg = [
      line(40, y1, 460, y1), parMark(40, y1, 460, y1, 1),
      line(40, y2, 460, y2), parMark(40, y2, 460, y2, 1),
      line(tx1, ty1, tx2, ty2),
      // angle at upper intersection: between line going right (0°) and transversal going down (ang)
      arcMark(ix1, y1, 28, 0, ang),
      angleLabel(ix1, y1, 28, 0, ang, ang + '°', GIVEN),
      // corresponding at lower: same position (right + transversal-down)
      arcMark(ix2, y2, 28, 0, ang, UNK),
      angleLabel(ix2, y2, 28, 0, ang, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: ang,
      steps: [
        `The chevron marks show the two horizontal lines are parallel.`,
        `${ang}° and x are corresponding angles (same position at each intersection — the "F" shape).`,
        `Corresponding angles between parallel lines are equal, so x = ${ang}°.`,
      ],
    };
  },
});

// ---------- 10. Parallel lines — alternate (Z-angles) ----------
PUZZLES.push({
  name: 'Alternate Angles (Z-angles)',
  difficulty: 2,
  concept: 'Alternate interior angles formed by a transversal cutting parallel lines are equal.',
  gen() {
    const ang = randInt(30, 75);
    const y1 = 130, y2 = 290;
    const ix1 = 200;
    const dx = (y2 - y1) / Math.tan(rad(ang));
    const ix2 = ix1 + dx;
    const ext = 180;
    const tx1 = ix1 - Math.cos(rad(ang)) * ext;
    const ty1 = y1  - Math.sin(rad(ang)) * ext;
    const tx2 = ix2 + Math.cos(rad(ang)) * ext;
    const ty2 = y2  + Math.sin(rad(ang)) * ext;
    const svg = [
      line(40, y1, 460, y1), parMark(40, y1, 460, y1, 1),
      line(40, y2, 460, y2), parMark(40, y2, 460, y2, 1),
      line(tx1, ty1, tx2, ty2),
      // upper intersection: angle between transversal going up (ang+180) and line going right (0)... no
      // Use the interior angle at upper intersection on the LEFT of transversal (between left ray and transversal going down)
      arcMark(ix1, y1, 28, ang, 180),
      angleLabel(ix1, y1, 28, ang, 180, ang + '°', GIVEN),
      // alternate at lower intersection: between line going right (0) and transversal going up (ang+180)
      arcMark(ix2, y2, 28, 0, ang + 180, UNK),
      angleLabel(ix2, y2, 28, 0, ang + 180, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: ang,
      steps: [
        `Both arrowed lines are parallel; one transversal crosses both.`,
        `${ang}° and x sit on opposite sides of the transversal, between the parallels — they form a "Z".`,
        `Alternate interior angles are equal, so x = ${ang}°.`,
      ],
    };
  },
});

// ---------- 11. Parallel lines — co-interior (C-angles) ----------
PUZZLES.push({
  name: 'Co-interior Angles (C-angles)',
  difficulty: 2,
  concept: 'Co-interior (allied) angles on the same side of a transversal between parallels sum to 180°.',
  gen() {
    const ang = randInt(50, 130);
    const y1 = 130, y2 = 290;
    const ix1 = 200;
    const dx = (y2 - y1) / Math.tan(rad(ang));
    const ix2 = ix1 + dx;
    const ext = 180;
    const tx1 = ix1 - Math.cos(rad(ang)) * ext;
    const ty1 = y1  - Math.sin(rad(ang)) * ext;
    const tx2 = ix2 + Math.cos(rad(ang)) * ext;
    const ty2 = y2  + Math.sin(rad(ang)) * ext;
    const svg = [
      line(40, y1, 460, y1), parMark(40, y1, 460, y1, 1),
      line(40, y2, 460, y2), parMark(40, y2, 460, y2, 1),
      line(tx1, ty1, tx2, ty2),
      // Upper intersection: angle between transversal-down (ang) and line going right (0)... wait this is corresponding
      // We want interior on the right at upper: between line going right (0) and transversal going down (ang).
      arcMark(ix1, y1, 28, 0, ang),
      angleLabel(ix1, y1, 28, 0, ang, ang + '°', GIVEN),
      // Lower intersection co-interior on same side (right of transversal, between parallels):
      // angle between transversal going up (ang+180) and line going right (0)
      arcMark(ix2, y2, 28, ang + 180, 360, UNK),  // 0 == 360, draw from ang+180 to 0 via right
      angleLabel(ix2, y2, 28, ang + 180, 360, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 180 - ang,
      steps: [
        `${ang}° and x are on the same side of the transversal, between the two parallel lines — co-interior angles.`,
        `Co-interior angles sum to 180°, so x = 180° − ${ang}° = ${180 - ang}°.`,
      ],
    };
  },
});

// ---------- 12. Bow-tie (vertical + triangle sum twice) ----------
PUZZLES.push({
  name: 'Bow-tie',
  difficulty: 3,
  concept: 'Two triangles meeting at a vertex form vertically opposite angles at the centre, then triangle-sum gives the missing angle.',
  gen() {
    // Two triangles sharing a vertex O; opposite angles at O are equal.
    // Triangle 1: O, A, B with angles A, B given; angle at O is 180 - A - B.
    // Triangle 2: O, C, D; angle at O equals the triangle-1 angle (vertical). Plus angle at C given, find angle at D = x.
    const A = randInt(40, 80);
    const B = randInt(40, 80);
    const O = 180 - A - B;        // angle at O in triangle 1 = vertical angle in triangle 2
    if (O < 30) return this.gen();
    const C = randInt(35, 175 - O);
    const D = 180 - O - C;
    if (D < 15) return this.gen();

    const ox = 250, oy = 200;
    const ax = 80,  ay = 100;
    const bx = 80,  by = 300;
    const cx = 420, cy = 100;
    const dx = 420, dy = 300;

    const arcA1 = Math.atan2(oy - ay, ox - ax) * 180 / Math.PI;
    const arcA2 = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const arcB1 = Math.atan2(ay - by, ax - bx) * 180 / Math.PI;
    const arcB2 = Math.atan2(oy - by, ox - bx) * 180 / Math.PI;
    const arcC1 = Math.atan2(dy - cy, dx - cx) * 180 / Math.PI;
    const arcC2 = Math.atan2(oy - cy, ox - cx) * 180 / Math.PI;
    const arcD1 = Math.atan2(oy - dy, ox - dx) * 180 / Math.PI;
    const arcD2 = Math.atan2(cy - dy, cx - dx) * 180 / Math.PI;

    const svg = [
      line(ax, ay, bx, by), line(ax, ay, ox, oy), line(bx, by, ox, oy),
      line(cx, cy, dx, dy), line(cx, cy, ox, oy), line(dx, dy, ox, oy),
      arcMark(ax, ay, 26, arcA1, arcA2), angleLabel(ax, ay, 26, arcA1, arcA2, A + '°', GIVEN),
      arcMark(bx, by, 26, arcB1, arcB2), angleLabel(bx, by, 26, arcB1, arcB2, B + '°', GIVEN),
      arcMark(cx, cy, 26, arcC1, arcC2), angleLabel(cx, cy, 26, arcC1, arcC2, C + '°', GIVEN),
      arcMark(dx, dy, 26, arcD1, arcD2, UNK), angleLabel(dx, dy, 26, arcD1, arcD2, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: D,
      steps: [
        `Left triangle: its angle at the centre = 180° − ${A}° − ${B}° = ${O}°.`,
        `That centre angle and the centre angle of the right triangle are vertically opposite, so they're equal (${O}°).`,
        `Right triangle: x = 180° − ${O}° − ${C}° = ${D}°.`,
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
    // pick three angles, find the fourth — keep all in [60, 130] for nicely convex visuals
    let A, B, C, D;
    for (let tries = 0; tries < 200; tries++) {
      A = randInt(65, 125);
      B = randInt(65, 125);
      C = randInt(65, 125);
      D = 360 - A - B - C;
      if (D >= 60 && D <= 130) break;
    }
    // Walk the polygon: start at A, edge to B, turn by (180-B), etc.
    const len = 130;
    let dir = -randInt(5, 25);
    let pts = [[0, 0]];
    pts.push([pts[0][0] + Math.cos(rad(dir)) * len, pts[0][1] + Math.sin(rad(dir)) * len]);
    dir = dir + (180 - B);
    pts.push([pts[1][0] + Math.cos(rad(dir)) * len, pts[1][1] + Math.sin(rad(dir)) * len]);
    dir = dir + (180 - C);
    pts.push([pts[2][0] + Math.cos(rad(dir)) * len, pts[2][1] + Math.sin(rad(dir)) * len]);
    // Center to canvas (500x400)
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const ox = 250 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = 200 - (Math.min(...ys) + Math.max(...ys)) / 2;
    pts = pts.map(p => [p[0] + ox, p[1] + oy]);
    const [[ax, ay], [bx, by], [ccx, ccy], [dxv, dyv]] = pts;

    const arcAng = (px, py, q1x, q1y, q2x, q2y) => [
      Math.atan2(q1y - py, q1x - px) * 180 / Math.PI,
      Math.atan2(q2y - py, q2x - px) * 180 / Math.PI,
    ];
    const [aA1, aA2] = arcAng(ax, ay, dxv, dyv, bx, by);
    const [aB1, aB2] = arcAng(bx, by, ax, ay, ccx, ccy);
    const [aC1, aC2] = arcAng(ccx, ccy, bx, by, dxv, dyv);
    const [aD1, aD2] = arcAng(dxv, dyv, ccx, ccy, ax, ay);

    const svg = [
      line(ax, ay, bx, by),
      line(bx, by, ccx, ccy),
      line(ccx, ccy, dxv, dyv),
      line(dxv, dyv, ax, ay),
      arcMark(ax, ay, 24, aA1, aA2), angleLabel(ax, ay, 24, aA1, aA2, A + '°', GIVEN),
      arcMark(bx, by, 24, aB1, aB2), angleLabel(bx, by, 24, aB1, aB2, B + '°', GIVEN),
      arcMark(ccx, ccy, 24, aC1, aC2), angleLabel(ccx, ccy, 24, aC1, aC2, C + '°', GIVEN),
      arcMark(dxv, dyv, 24, aD1, aD2, UNK), angleLabel(dxv, dyv, 24, aD1, aD2, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: D,
      steps: [
        `A quadrilateral's interior angles sum to 360° (split it into two triangles to see why).`,
        `x = 360° − ${A}° − ${B}° − ${C}° = ${D}°.`,
      ],
    };
  },
});

// ---------- 14. Star (5-point) ----------
PUZZLES.push({
  name: 'Five-pointed Star',
  difficulty: 4,
  concept: 'The five point-angles of any 5-pointed star sum to 180°.',
  gen() {
    // Generate 5 random point angles summing to 180, all in [20, 60]
    let pts;
    for (let tries = 0; tries < 500; tries++) {
      pts = [randInt(22, 50), randInt(22, 50), randInt(22, 50), randInt(22, 50)];
      const last = 180 - pts.reduce((a, b) => a + b, 0);
      if (last >= 22 && last <= 55) { pts.push(last); break; }
    }
    if (!pts || pts.length !== 5) pts = [30, 35, 40, 40, 35];

    // Just draw a generic 5-pointed star geometry (regular for clarity)
    // The actual labelled angles use our values, even though geometry is regular.
    // This is a common convention in puzzle books — labels are "given" not measured.
    const cx = 250, cy = 200, R = 150, r = 60;
    const tipOff = -90;
    const verts = [];
    for (let i = 0; i < 10; i++) {
      const ang = tipOff + i * 36;
      const radius = i % 2 === 0 ? R : r;
      verts.push(P(cx, cy, radius, ang));
    }
    // Outline path
    let d = `M ${verts[0][0]} ${verts[0][1]}`;
    for (let i = 1; i < 10; i++) d += ` L ${verts[i][0]} ${verts[i][1]}`;
    d += ' Z';

    let svg = `<path d="${d}" stroke="${INK}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;

    // Label angles at the 5 tips (indices 0,2,4,6,8). Smaller arc + tighter label for tip clarity.
    let unknownIdx = randInt(0, 4);
    for (let i = 0; i < 5; i++) {
      const tip = verts[i * 2];
      const prev = verts[(i * 2 + 9) % 10];
      const next = verts[(i * 2 + 1) % 10];
      const a1 = Math.atan2(prev[1] - tip[1], prev[0] - tip[0]) * 180 / Math.PI;
      const a2 = Math.atan2(next[1] - tip[1], next[0] - tip[0]) * 180 / Math.PI;
      const isUnknown = (i === unknownIdx);
      svg += arcMark(tip[0], tip[1], 18, a1, a2, isUnknown ? UNK : RULE);
      svg += angleLabel(tip[0], tip[1], 18, a1, a2,
        isUnknown ? 'x' : (pts[i] + '°'),
        isUnknown ? UNK : GIVEN, 20);
    }

    const known = pts.filter((_, i) => i !== unknownIdx);
    const answer = pts[unknownIdx];

    return {
      svg,
      answer,
      steps: [
        `Classic result: the five "point" angles of any 5-pointed star sum to 180°.`,
        `(Each tip is an exterior angle of a triangle formed by two star edges and an internal chord.)`,
        `So x = 180° − (${known.join('° + ')}°) = ${answer}°.`,
      ],
    };
  },
});

// ---------- 15. Two-step: parallel + triangle ----------
PUZZLES.push({
  name: 'Parallel + Triangle',
  difficulty: 4,
  concept: 'Combine alternate angles (parallel lines) with triangle-sum.',
  gen() {
    // Triangle ABC; line through C parallel to AB; angle at A given, angle at B given,
    // find angle x at C using alternate angles back to A and B.
    const A = randInt(40, 80);
    const B = randInt(40, 80);
    const C = 180 - A - B;
    const ax = 90, ay = 290;
    const bx = 410, by = 290;
    const a1 = -A * Math.PI / 180;
    const a2 = (180 + B) * Math.PI / 180;
    const det = Math.cos(a1) * (-Math.sin(a2)) - (-Math.cos(a2)) * Math.sin(a1);
    const t = ((bx - ax) * (-Math.sin(a2))) / det;
    const cxv = ax + t * Math.cos(a1);
    const cyv = ay + t * Math.sin(a1);
    // Draw line through C parallel to AB (horizontal)
    const px = 40, py = cyv;
    const qx = 460, qy = cyv;

    const A_to_B = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const A_to_C = Math.atan2(cyv - ay, cxv - ax) * 180 / Math.PI;
    const B_to_A = Math.atan2(ay - by, ax - bx) * 180 / Math.PI;
    const B_to_C = Math.atan2(cyv - by, cxv - bx) * 180 / Math.PI;
    const C_to_A = Math.atan2(ay - cyv, ax - cxv) * 180 / Math.PI;
    const C_to_B = Math.atan2(by - cyv, bx - cxv) * 180 / Math.PI;

    const svg = [
      line(ax, ay, bx, by), parMark(ax, ay, bx, by, 1),
      line(px, py, qx, qy), parMark(px, py, qx, qy, 1),
      line(ax, ay, cxv, cyv),
      line(bx, by, cxv, cyv),
      arcMark(ax, ay, 26, A_to_B, A_to_C), angleLabel(ax, ay, 26, A_to_B, A_to_C, A + '°', GIVEN),
      arcMark(bx, by, 26, B_to_C, B_to_A), angleLabel(bx, by, 26, B_to_C, B_to_A, B + '°', GIVEN),
      arcMark(cxv, cyv, 26, C_to_A, C_to_B, UNK), angleLabel(cxv, cyv, 26, C_to_A, C_to_B, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: C,
      steps: [
        `Either: angles in triangle ABC sum to 180°, giving x = 180° − ${A}° − ${B}° = ${C}°.`,
        `Or via the parallel line through C: the two outer angles at C are alternate to ${A}° and ${B}° (Z-angles), leaving x = 180° − ${A}° − ${B}° = ${C}°.`,
      ],
    };
  },
});

// ---------- 16. Right triangle, one acute given ----------
PUZZLES.push({
  name: 'Right Triangle Acute',
  difficulty: 1,
  concept: 'In a right triangle the two acute angles sum to 90°.',
  gen() {
    const a = randInt(20, 70);
    const x = 90 - a;
    const ax = 100, ay = 300;
    const bx = 380, by = 300;
    const cx = 380, cy = 300 - Math.tan(rad(a)) * (bx - ax);
    const A_to_B = 0, A_to_C = Math.atan2(cy - ay, cx - ax) * 180 / Math.PI;
    const B_to_A = 180, B_to_C = -90;
    const C_to_A = Math.atan2(ay - cy, ax - cx) * 180 / Math.PI;
    const C_to_B = 90;
    const svg = [
      line(ax, ay, bx, by),
      line(bx, by, cx, cy),
      line(cx, cy, ax, ay),
      rightAngleSquare(bx, by, 14, 180),
      arcMark(ax, ay, 28, A_to_B, A_to_C), angleLabel(ax, ay, 28, A_to_B, A_to_C, a + '°', GIVEN),
      arcMark(cx, cy, 28, C_to_A, C_to_B, UNK), angleLabel(cx, cy, 28, C_to_A, C_to_B, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: x,
      steps: [
        `The small square marks the right angle (90°) at the lower-right vertex.`,
        `In a right triangle the two acute angles sum to 90°.`,
        `So x = 90° − ${a}° = ${x}°.`,
      ],
    };
  },
});

// ---------- 17. Two crossing lines + parallel transversal chain ----------
PUZZLES.push({
  name: 'Z plus Vertical',
  difficulty: 3,
  concept: 'Alternate angles transfer a value across parallels; vertical angles bounce it across the crossing.',
  gen() {
    const ang = randInt(40, 80);
    const y1 = 130, y2 = 290;
    const ix1 = 200;
    const dx = (y2 - y1) / Math.tan(rad(ang));
    const ix2 = ix1 + dx;
    const ext = 180;
    const tx1 = ix1 - Math.cos(rad(ang)) * ext;
    const ty1 = y1  - Math.sin(rad(ang)) * ext;
    const tx2 = ix2 + Math.cos(rad(ang)) * ext;
    const ty2 = y2  + Math.sin(rad(ang)) * ext;
    const svg = [
      line(40, y1, 460, y1), parMark(40, y1, 460, y1, 1),
      line(40, y2, 460, y2), parMark(40, y2, 460, y2, 1),
      line(tx1, ty1, tx2, ty2),
      // Given: alternate-interior on upper left
      arcMark(ix1, y1, 28, ang, 180),
      angleLabel(ix1, y1, 28, ang, 180, ang + '°', GIVEN),
      // Unknown x: vertical to the alternate at lower intersection (so still equals ang) — but mark its supplement instead
      // Pick: angle at lower intersection between transversal-down (ang) and horizontal-left (180) — that's supplementary to the alternate
      arcMark(ix2, y2, 28, ang, 180, UNK),
      angleLabel(ix2, y2, 28, ang, 180, 'x', UNK),
    ].join('');
    return {
      svg,
      answer: 180 - ang,
      steps: [
        `By alternate angles, the angle at the lower intersection between the transversal (going up) and the lower line (going right) is ${ang}°.`,
        `x sits next to it on a straight line, so x + ${ang}° = 180° → x = ${180 - ang}°.`,
        `(Equivalently: x and the upper given are co-interior, so they sum to 180°.)`,
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
