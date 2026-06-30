/* sudoku-app.js — controller for the "Find all angles" mode.
 *
 * Click an unknown wedge → a small numeric input pops up at the wedge's
 * label position. Submit with Enter. Correct: wedge turns green and locks.
 * Wrong: brief red shake.
 */
(function (global) {
  'use strict';
  const $ = id => document.getElementById(id);

  const state = {
    puzzle: null,
    activeAid: null,        // id of the angle currently being edited
    activeGroupEl: null,    // SVG <g> element of that angle
    rendered: false,
    templateIdx: -1,        // -1 = random
  };

  // ---------- template selector ----------
  function populateTemplates() {
    const sel = $('sTemplateSel');
    const tpls = global.SudokuTemplates || [];
    // Remove all but "Random" option:
    while (sel.options.length > 1) sel.remove(1);
    tpls.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${t.label} · ${t.size} ${'★'.repeat(t.difficulty)}`;
      sel.appendChild(opt);
    });
  }

  // ---------- render ----------
  function load() {
    closeInput();
    const idx = state.templateIdx;
    const choice = idx < 0 ? null : idx;
    state.puzzle = global.makeSudokuPuzzle(choice);
    state.rendered = true;
    render();
  }

  function render() {
    const p = state.puzzle;
    $('sTitle').textContent = p.templateLabel;
    $('sSize').textContent = '· ' + p.size;
    $('sDiff').textContent = '★'.repeat(p.difficulty) + '☆'.repeat(5 - p.difficulty);
    $('sDesc').textContent = p.description;
    $('sudokuFigure').innerHTML = global.renderSudokuSVG(p);
    const unknowns = p.angles.filter(a => !a.isGiven).length;
    $('sFound').textContent = '0';
    $('sTotal').textContent = String(unknowns);
    $('sBarFill').style.width = '0%';
    $('sFeedback').textContent = '';
    $('sFeedback').className = 'feedback';
    wireWedgeClicks();
  }

  // ---------- wedge interaction ----------
  function wireWedgeClicks() {
    document.querySelectorAll('#sudokuFigure .wedge.unk').forEach(g => {
      g.addEventListener('click', () => openInput(g));
    });
  }

  function openInput(groupEl) {
    closeInput();
    const aid = groupEl.dataset.aid;
    state.activeAid = aid;
    state.activeGroupEl = groupEl;
    const popup = $('sudokuInput');
    const field = $('sudokuInputField');
    // Position the popup at the wedge label's actual rendered position by
    // using getBoundingClientRect — reliable regardless of SVG scaling.
    const wedgeRect = groupEl.getBoundingClientRect();
    const stageRect = $('sudokuFigure').parentElement.getBoundingClientRect();
    const cx = wedgeRect.left + wedgeRect.width / 2 - stageRect.left;
    const cy = wedgeRect.top  + wedgeRect.height / 2 - stageRect.top;
    popup.style.display = '';
    // Now we know the popup's own dimensions; centre it on the wedge.
    const pw = popup.offsetWidth || 90;
    const ph = popup.offsetHeight || 32;
    popup.style.left = Math.max(4, cx - pw / 2) + 'px';
    popup.style.top  = Math.max(4, cy - ph / 2) + 'px';
    field.value = '';
    field.classList.remove('wrong');
    field.focus();
  }

  function closeInput() {
    state.activeAid = null;
    state.activeGroupEl = null;
    const popup = $('sudokuInput');
    if (popup) popup.style.display = 'none';
  }

  function submitInput() {
    const aid = state.activeAid;
    if (!aid) return;
    const raw = $('sudokuInputField').value.trim();
    if (raw === '') return;
    const guess = Number(raw);
    if (!Number.isFinite(guess)) return;
    const angle = state.puzzle.angles.find(a => a.id === aid);
    if (!angle) return;
    if (Math.abs(guess - angle.value) < 0.5) {
      lockAngle(angle, state.activeGroupEl, guess);
      closeInput();
      updateProgress();
      if (allSolved()) winScreen();
    } else {
      const field = $('sudokuInputField');
      field.classList.add('wrong');
      field.select();
      // Show a small hint about whether high/low
      $('sFeedback').textContent = `Not quite — ${guess > angle.value ? 'too high' : 'too low'}.`;
      $('sFeedback').className = 'feedback bad';
      setTimeout(() => field.classList.remove('wrong'), 600);
    }
  }

  // Replace the unknown wedge with a SOLVED variant (green wedge + value).
  function lockAngle(angle, groupEl, value) {
    if (!groupEl) return;
    // Mark this angle as solved so it isn't editable any more.
    angle.solved = true;
    // Build a new <g class="wedge solved"> rendering.
    const ns = 'http://www.w3.org/2000/svg';
    const cx = angle.curPt[0], cy = angle.curPt[1];
    // Re-derive the wedge geometry exactly as the renderer did.
    const dirDeg = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
    const aPrev = dirDeg(angle.curPt, angle.prevPt);
    const aNext = dirDeg(angle.curPt, angle.nextPt);
    const cellCent = angle.cellCentroid;
    const dToCent = dirDeg(angle.curPt, cellCent);
    const arc = chooseShortArc(aPrev, aNext, dToCent);
    const r = wedgeRadius(angle);
    const cxLabel = parseFloat(groupEl.dataset.cx);
    const cyLabel = parseFloat(groupEl.dataset.cy);

    const path = wedgePath(cx, cy, r, arc.a1, arc.a2);
    const newG = document.createElementNS(ns, 'g');
    newG.setAttribute('class', 'wedge solved');
    newG.setAttribute('data-aid', angle.id);
    const wedgeEl = document.createElementNS(ns, 'path');
    wedgeEl.setAttribute('d', path);
    wedgeEl.setAttribute('fill', '#0f9d58');
    wedgeEl.setAttribute('fill-opacity', '0.22');
    wedgeEl.setAttribute('stroke', '#0f9d58');
    wedgeEl.setAttribute('stroke-width', '1.6');
    wedgeEl.setAttribute('stroke-linejoin', 'round');
    newG.appendChild(wedgeEl);
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', String(cxLabel));
    txt.setAttribute('y', String(cyLabel + 4));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '13');
    txt.setAttribute('font-weight', '700');
    txt.setAttribute('fill', '#0f9d58');
    txt.textContent = Math.round(value) + '°';
    newG.appendChild(txt);
    groupEl.replaceWith(newG);
  }

  // ---------- progress & win ----------
  function updateProgress() {
    const total = state.puzzle.angles.filter(a => !a.isGiven).length;
    const done  = state.puzzle.angles.filter(a => !a.isGiven && a.solved).length;
    $('sFound').textContent = String(done);
    $('sBarFill').style.width = (100 * done / total).toFixed(1) + '%';
    if (done > 0 && !allSolved()) {
      $('sFeedback').textContent = `✓ ${done} of ${total}. Keep going.`;
      $('sFeedback').className = 'feedback ok';
    }
  }
  function allSolved() {
    return state.puzzle.angles.every(a => a.isGiven || a.solved);
  }
  function winScreen() {
    $('sFeedback').innerHTML = '🎉 <b>Complete!</b> Every angle filled in.';
    $('sFeedback').className = 'feedback ok';
  }

  // ---------- "reveal all" ----------
  function revealAll() {
    if (!state.puzzle) return;
    state.puzzle.angles.forEach(a => {
      if (a.isGiven || a.solved) return;
      const g = document.querySelector(`#sudokuFigure .wedge.unk[data-aid="${a.id}"]`);
      if (g) lockAngle(a, g, a.value);
    });
    updateProgress();
    $('sFeedback').innerHTML = 'All angles revealed.';
    $('sFeedback').className = 'feedback info';
  }

  // ---------- geometry helpers (mirrored from sudoku.js) ----------
  function wedgeRadius(a) {
    if (a.value < 25) return 16;
    if (a.value < 45) return 20;
    if (a.value < 75) return 24;
    return 28;
  }
  function chooseShortArc(a, b, inside) {
    const norm = x => ((x % 360) + 360) % 360;
    const within = (lo, hi, x) => {
      const span = ((hi - lo) % 360 + 360) % 360;
      const off  = ((x  - lo) % 360 + 360) % 360;
      return off >= 0 && off <= span;
    };
    const dAB = ((b - a) % 360 + 360) % 360;
    const shortStart = dAB <= 180 ? a : b;
    const shortEnd   = dAB <= 180 ? b : a;
    if (within(shortStart, shortEnd, norm(inside))) {
      return { a1: shortStart, a2: shortEnd };
    }
    return { a1: shortEnd, a2: shortStart };
  }
  function wedgePath(cx, cy, r, a1, a2) {
    const fmt = n => Math.abs(n) < 1e-6 ? '0' : Number(n.toFixed(2)).toString();
    const toPt = (ang) => [cx + r * Math.cos(ang * Math.PI / 180), cy + r * Math.sin(ang * Math.PI / 180)];
    const [x1, y1] = toPt(a1);
    const [x2, y2] = toPt(a2);
    let d = ((a2 - a1) % 360 + 360) % 360;
    let sweep;
    if (d <= 180) sweep = 1;
    else { sweep = 0; d = 360 - d; }
    return `M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 0 ${sweep} ${fmt(x2)} ${fmt(y2)} Z`;
  }

  // ---------- wiring ----------
  function wire() {
    populateTemplates();
    $('sTemplateSel').addEventListener('change', () => {
      state.templateIdx = parseInt($('sTemplateSel').value, 10);
      load();
    });
    $('sNextBtn').addEventListener('click', load);
    $('sRevealBtn').addEventListener('click', revealAll);
    $('sudokuInputField').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitInput(); }
      if (e.key === 'Escape') { e.preventDefault(); closeInput(); }
    });
    document.addEventListener('click', e => {
      if (!state.activeAid) return;
      const popup = $('sudokuInput');
      const inFig = e.target.closest('#sudokuFigure .wedge.unk');
      const inPopup = e.target.closest('#sudokuInput');
      if (!inFig && !inPopup) closeInput();
    });
  }

  // Public API: called by the tab toggle when the tab is shown for the first time
  global.SudokuApp = {
    onShow() {
      if (!state.rendered) load();
    },
  };

  // Init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})(typeof window !== 'undefined' ? window : this);
