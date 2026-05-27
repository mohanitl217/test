// Generic Test-mode typing engine with timer + WPM/accuracy.
// Page sets `window.TEST_CONFIG = { section: '...', mode: 'test' }` before this script.
(function () {
  const cfg = window.TEST_CONFIG || { section: 'english', mode: 'test' };

  const targetEl = document.getElementById('target');
  const inputEl  = document.getElementById('input');
  const lessonSelect = document.getElementById('lesson-select');
  const wpmEl = document.getElementById('stat-wpm');
  const accEl = document.getElementById('stat-acc');
  const errEl = document.getElementById('stat-err');
  const timeEl = document.getElementById('stat-time');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const resultModal = document.getElementById('result-modal');

  let exercises = [];
  let target = '';
  let typed = '';
  let durationSec = 60;
  let timeLeft = 60;
  let timer = null;
  let started = false;
  let correctChars = 0;
  let totalChars = 0;
  let errorCount = 0;

  async function loadExercises() {
    const res = await fetch(`/api/exercises?section=${encodeURIComponent(cfg.section)}&mode=${encodeURIComponent(cfg.mode)}`);
    exercises = await res.json();
    if (!exercises.length) {
      targetEl.textContent = 'No tests available yet. Ask an admin to add some.';
      lessonSelect.innerHTML = '<option>-- empty --</option>';
      return;
    }
    lessonSelect.innerHTML = exercises.map((e, i) => `<option value="${i}">${e.title}</option>`).join('');
    setTest(0);
  }

  function setTest(i) {
    target = exercises[i].content;
    reset();
  }

  function reset() {
    clearInterval(timer);
    timer = null;
    started = false;
    typed = '';
    correctChars = 0; totalChars = 0; errorCount = 0;
    timeLeft = durationSec;
    inputEl.value = '';
    inputEl.disabled = false;
    updateStats();
    render();
  }

  function startTimer() {
    started = true;
    timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) finish();
      updateStats();
    }, 1000);
  }

  function finish() {
    clearInterval(timer);
    inputEl.disabled = true;
    showResult();
  }

  function updateStats() {
    const elapsed = durationSec - timeLeft;
    const minutes = Math.max(elapsed, 1) / 60;
    // Standard WPM: chars / 5 / minutes
    const wpm = Math.round((correctChars / 5) / minutes);
    const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 100;
    wpmEl.textContent = isFinite(wpm) && wpm >= 0 ? wpm : 0;
    accEl.textContent = acc + '%';
    errEl.textContent = errorCount;
    timeEl.textContent = timeLeft + 's';
  }

  function render() {
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const tch = target[i];
      const ich = typed[i];
      let cls = 'ch';
      if (i < typed.length) cls += ich === tch ? ' done' : ' bad';
      else if (i === typed.length) cls += ' cur';
      const d = tch === ' ' ? '\u00A0' : tch;
      html += `<span class="${cls}">${escapeHtml(d)}</span>`;
    }
    targetEl.innerHTML = html;
  }

  function onInput() {
    if (!started) startTimer();
    const v = inputEl.value;
    if (v.length > typed.length) {
      const newCh = v[v.length - 1];
      const expected = target[v.length - 1];
      totalChars++;
      if (newCh === expected) correctChars++;
      else errorCount++;
    }
    typed = v;
    render();
    if (typed.length >= target.length) finish();
    updateStats();
  }

  function showResult() {
    const minutes = Math.max(durationSec - timeLeft, 1) / 60;
    const wpm = Math.round((correctChars / 5) / minutes);
    const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 100;
    document.getElementById('result-wpm').textContent = wpm;
    document.getElementById('result-acc').textContent = acc + '%';
    document.getElementById('result-err').textContent = errorCount;
    resultModal.classList.add('show');
  }

  // Duration picker
  document.querySelectorAll('.duration-picker button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.duration-picker button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      durationSec = +b.dataset.dur;
      reset();
    })
  );

  document.getElementById('result-close').addEventListener('click', () => resultModal.classList.remove('show'));

  inputEl.addEventListener('input', onInput);
  lessonSelect.addEventListener('change', () => setTest(+lessonSelect.value));
  if (startBtn) startBtn.addEventListener('click', () => inputEl.focus());
  restartBtn.addEventListener('click', reset);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  loadExercises();
})();
