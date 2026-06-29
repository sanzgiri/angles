/* app.js — game loop / UI wiring */
(function () {
  const $ = id => document.getElementById(id);

  const state = {
    current: null,
    solved: 0,
    streak: 0,
    best: Number(localStorage.getItem('angles.best') || 0),
    attempts: 0,           // attempts on current puzzle
    revealed: false,
    mode: 'mixed',
  };

  function diffRange(mode) {
    if (mode === 'easy') return [1, 2];
    if (mode === 'hard') return [3, 5];
    return [1, 5];
  }

  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  function render() {
    const p = state.current;
    $('puzzleTitle').textContent = p.title;
    $('difficulty').textContent = stars(p.difficulty);
    $('figure').innerHTML = p.svg;
    $('answer').value = '';
    $('answer').focus();
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('submitBtn').style.display = '';
    $('revealBtn').style.display = '';
    $('nextBtn').style.display = 'none';
    $('explainBox').open = false;
    $('explain').innerHTML = `
      <div class="concept"><b>Concept:</b> ${p.concept}</div>
      <ol>${p.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    `;
    $('solved').textContent = state.solved;
    $('streak').textContent = state.streak;
    $('best').textContent   = state.best;
  }

  function loadNew() {
    state.attempts = 0;
    state.revealed = false;
    const [lo, hi] = diffRange(state.mode);
    state.current = newPuzzle(lo, hi);
    render();
  }

  function submit() {
    if (!state.current) return;
    const raw = $('answer').value.trim();
    if (raw === '') {
      $('feedback').textContent = 'Type a number first.';
      $('feedback').className = 'feedback info';
      return;
    }
    const guess = Number(raw);
    if (!Number.isFinite(guess)) {
      $('feedback').textContent = 'That doesn\'t look like a number.';
      $('feedback').className = 'feedback bad';
      return;
    }
    state.attempts += 1;
    const ans = state.current.answer;
    if (Math.abs(guess - ans) < 0.5) {
      const bonus = state.attempts === 1 && !state.revealed;
      state.solved += 1;
      if (bonus) state.streak += 1; else state.streak = 0;
      state.best = Math.max(state.best, state.streak);
      localStorage.setItem('angles.best', String(state.best));
      $('feedback').innerHTML = bonus
        ? `✓ Correct — x = ${ans}°. <span style="color:var(--muted)">Streak ${state.streak} (best ${state.best}).</span>`
        : `✓ Correct — x = ${ans}°. <span style="color:var(--muted)">(streak reset)</span>`;
      $('feedback').className = 'feedback ok';
      $('explainBox').open = true;
      $('submitBtn').style.display = 'none';
      $('revealBtn').style.display = 'none';
      $('nextBtn').style.display = '';
      $('nextBtn').focus();
      $('solved').textContent = state.solved;
      $('streak').textContent = state.streak;
      $('best').textContent   = state.best;
    } else {
      const hint = guess > ans ? 'too high' : 'too low';
      $('feedback').textContent = `Not quite — ${hint}. Try again. (attempt ${state.attempts})`;
      $('feedback').className = 'feedback bad';
      $('answer').select();
    }
  }

  function reveal() {
    if (!state.current) return;
    state.revealed = true;
    state.streak = 0;
    $('feedback').innerHTML = `Answer: x = <b>${state.current.answer}°</b>.`;
    $('feedback').className = 'feedback info';
    $('explainBox').open = true;
    $('submitBtn').style.display = 'none';
    $('revealBtn').style.display = 'none';
    $('nextBtn').style.display = '';
    $('nextBtn').focus();
    $('streak').textContent = state.streak;
  }

  // ---- wire up ----
  $('submitBtn').addEventListener('click', submit);
  $('revealBtn').addEventListener('click', reveal);
  $('nextBtn').addEventListener('click', loadNew);

  $('answer').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if ($('nextBtn').style.display !== 'none') loadNew();
      else submit();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'n' || e.key === 'N') loadNew();
    if (e.key === 'r' || e.key === 'R') reveal();
  });

  document.querySelectorAll('input[name="mode"]').forEach(el => {
    el.addEventListener('change', () => {
      state.mode = document.querySelector('input[name="mode"]:checked').value;
      loadNew();
    });
  });

  loadNew();
})();
