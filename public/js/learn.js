// Learn-mode typing engine (uses window.api for fetching exercises).
// Page sets `window.LEARN_CONFIG = { section: '...', mode: 'learn' }` before this script.
(function () {
  const cfg = window.LEARN_CONFIG || { section: 'english', mode: 'learn' };
  const targetEl = document.getElementById('target');
  const inputEl = document.getElementById('input');
  const lessonSelect = document.getElementById('lesson-select');
  const nextKeyEl = document.getElementById('next-key');
  const progressEl = document.getElementById('progress-bar');
  const accuracyEl = document.getElementById('accuracy');
  const resetBtn = document.getElementById('reset-btn');

  let exercises = [];
  let target = '';
  let typed = '';
  let totalTyped = 0;
  let correctTyped = 0;

  async function loadExercises() {
    try {
      exercises = await api.listExercises(cfg.section, cfg.mode);
    } catch (e) {
      exercises = [];
    }
    if (!exercises.length) {
      targetEl.textContent = 'No lessons available yet. Ask an admin to add some.';
      lessonSelect.innerHTML = '<option>-- empty --</option>';
      return;
    }
    lessonSelect.innerHTML = exercises.map((e, i) => `<option value="${i}">${e.title}</option>`).join('');
    setLesson(0);
  }

  function setLesson(i) {
    target = exercises[i].content;
    typed = '';
    totalTyped = 0;
    correctTyped = 0;
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus();
    render();
  }

  function render() {
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const tch = target[i];
      const ich = typed[i];
      let cls = 'ch';
      if (i < typed.length) cls += ich === tch ? ' done' : ' bad';
      else if (i === typed.length) cls += ' cur';
      const display = tch === ' ' ? '\u00A0' : tch;
      html += `<span class="${cls}">${escapeHtml(display)}</span>`;
    }
    targetEl.innerHTML = html;
    if (nextKeyEl) {
      const next = target[typed.length];
      nextKeyEl.textContent = next === ' ' ? 'Space' : (next || '✓ done');
    }
    if (progressEl) {
      const pct = target.length ? Math.min(100, (typed.length / target.length) * 100) : 0;
      progressEl.style.width = pct + '%';
    }
    if (accuracyEl) {
      const acc = totalTyped ? Math.round((correctTyped / totalTyped) * 100) : 100;
      accuracyEl.textContent = acc + '%';
    }
  }

  function onInput() {
    const v = inputEl.value;
    if (v.length > typed.length) {
      const newCh = v[v.length - 1];
      const expected = target[v.length - 1];
      totalTyped++;
      if (newCh === expected) correctTyped++;
    }
    typed = v;
    render();
    if (typed.length >= target.length) {
      inputEl.disabled = true;
      setTimeout(() => alert('Lesson complete! Great job.'), 50);
    }
  }

  inputEl.addEventListener('input', onInput);
  lessonSelect.addEventListener('change', () => setLesson(+lessonSelect.value));
  resetBtn.addEventListener('click', () => setLesson(+lessonSelect.value));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  loadExercises();
})();
