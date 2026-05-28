/* ============================================================
   Typing Test PRO – engine
   Implements every option in the settings panel:
   - Backspace mode (full / one-word / disabled)
   - Highlight mode (word / word+error / none / letter)
   - Show / hide passage scrollbar
   - Auto-scroll passage to current position
   - Word limit
   - Word-processor mode (Enter, Tab, multi-line behaviour)
   - Bold + font-family + font-size
   - Duration, exercise switching, restart, submit
   - Printout / Exam modes
   - Add-new-exercise (saved in localStorage on this device)
   ============================================================ */
(function () {
  'use strict';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const app = $('tpApp');
  const passage = $('tpPassage');
  const input = $('tpInput');
  const fontFamily = $('tpFontFamily');
  const boldChk = $('tpBold');
  const wpmEl = $('tpWpm');
  const accEl = $('tpAcc');
  const errEl = $('tpErr');
  const timeEl = $('tpTime');
  const statusEl = $('tpStatus');
  const exSelect = $('tpExerciseSelect');
  const nextEx = $('tpNextEx');
  const durationSel = $('tpDuration');
  const fontUp = $('tpFontUp');
  const fontDown = $('tpFontDown');
  const fontVal = $('tpFontVal');
  const printBtn = $('tpPrintBtn');
  const examBtn = $('tpExamBtn');
  const restartBtn = $('tpRestart');
  const submitBtn = $('tpSubmit');
  const showScroll = $('tpShowScroll');
  const autoScroll = $('tpAutoScroll');
  const wlChk = $('tpWordLimit');
  const wlVal = $('tpWlVal');
  const wlUp = $('tpWlUp');
  const wlDown = $('tpWlDown');
  const wpChk = $('tpWordProc');
  const allowPara = $('tpAllowPara');
  const allowTabs = $('tpAllowTabs');
  const resetBtn = $('tpResetSettings');

  // result modal
  const rModal = $('tpResultModal');
  const rWpm = $('tpRWpm');
  const rAcc = $('tpRAcc');
  const rErr = $('tpRErr');
  const rChars = $('tpRChars');
  const rClose = $('tpRClose');
  const rRetry = $('tpRRetry');

  // add-exercise modal
  const addBtn = $('tpAddEx');
  const addModal = $('tpAddModal');
  const addTitle = $('tpAddTitle');
  const addContent = $('tpAddContent');
  const aSave = $('tpASave');
  const aCancel = $('tpACancel');

  // ---------- state ----------
  const LS_SETTINGS = 'tp_settings_v1';
  const LS_LOCAL_EX = 'tp_local_exercises_v1';

  const defaults = {
    backspace: 'disabled',
    highlight: 'word-error',
    showScrollbar: false,
    autoScroll: true,
    wordLimit: false,
    wordLimitVal: 500,
    wordProc: true,
    allowPara: false,
    allowTabs: false,
    bold: false,
    fontSize: 18,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    duration: 600,
  };

  let settings = { ...defaults, ...loadSettings() };

  let exercises = [];
  let exIndex = 0;
  let target = '';
  let typed = '';
  let durationSec = settings.duration;
  let timeLeft = durationSec;
  let timer = null;
  let started = false;
  let finished = false;
  let correctChars = 0;
  let totalChars = 0;
  let errorCount = 0;
  let mode = 'practice'; // practice | printout | exam

  // ---------- init ----------
  applySettingsToUI();
  applyVisualSettings();
  updateStats();
  loadExercises();
  bindEvents();

  // ---------- exercises ----------
  async function loadExercises() {
    let list = [];
    try {
      list = await window.api.listExercises('english', 'test');
    } catch (e) {
      list = [];
    }
    const local = loadLocalExercises();
    exercises = [...list, ...local];

    if (!exercises.length) {
      passage.textContent = 'No exercises available. Use "Add New Exercise" to create one.';
      exSelect.innerHTML = '<option>-- empty --</option>';
      input.disabled = true;
      return;
    }

    exSelect.innerHTML = exercises
      .map((e, i) => `<option value="${i}">${escapeHtml(e.title)}</option>`)
      .join('');
    setExercise(0);
  }

  function setExercise(i) {
    exIndex = ((i % exercises.length) + exercises.length) % exercises.length;
    exSelect.value = String(exIndex);
    target = applyWordLimit(exercises[exIndex].content);
    reset();
  }

  function applyWordLimit(text) {
    if (!settings.wordLimit) return text;
    const limit = clamp(parseInt(settings.wordLimitVal, 10) || 500, 50, 1500);
    const words = text.split(/\s+/);
    return words.slice(0, limit).join(' ');
  }

  // ---------- timer / state ----------
  function reset() {
    clearInterval(timer);
    timer = null;
    started = false;
    finished = false;
    typed = '';
    correctChars = 0;
    totalChars = 0;
    errorCount = 0;
    timeLeft = durationSec;
    input.value = '';
    input.disabled = false;
    statusEl.textContent = 'Select test duration and start typing. Timer starts automatically.';
    render();
    updateStats();
  }

  function startTimer() {
    started = true;
    statusEl.textContent = 'Test in progress…';
    timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) finish();
      updateStats();
    }, 1000);
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    input.disabled = true;
    statusEl.textContent = 'Test complete.';
    showResult();
  }

  function updateStats() {
    const elapsed = Math.max(durationSec - timeLeft, 0) || 0.001;
    const minutes = elapsed / 60;
    const wpm = Math.max(0, Math.round((correctChars / 5) / Math.max(minutes, 1 / 60)));
    const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 100;
    wpmEl.textContent = isFinite(wpm) ? wpm : 0;
    accEl.textContent = acc + '%';
    errEl.textContent = errorCount;
    timeEl.textContent = formatTime(timeLeft);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ---------- render passage ----------
  function render() {
    const hl = settings.highlight;

    if (hl === 'none') {
      passage.textContent = target;
      maybeAutoScroll();
      return;
    }

    if (hl === 'word' || hl === 'word-error') {
      // word-level
      const words = target.split(/(\s+)/); // keep separators
      let charIdx = 0;
      let html = '';
      // find current word
      const typedLen = typed.length;
      const wordRanges = [];
      let pos = 0;
      for (const tok of words) {
        wordRanges.push({ tok, start: pos, end: pos + tok.length });
        pos += tok.length;
      }
      const currentTokenIdx = wordRanges.findIndex(
        (r) => typedLen >= r.start && typedLen < r.end
      );
      for (let i = 0; i < wordRanges.length; i++) {
        const r = wordRanges[i];
        const isWS = /^\s+$/.test(r.tok);
        const isCurrent = i === currentTokenIdx && !isWS;
        // detect error in this word so far
        let hasErrorInThisWord = false;
        if (hl === 'word-error' && isCurrent) {
          for (let k = r.start; k < Math.min(r.end, typed.length); k++) {
            if (typed[k] !== target[k]) { hasErrorInThisWord = true; break; }
          }
        }
        let cls = '';
        if (isCurrent) cls = 'wd-current' + (hasErrorInThisWord ? ' wd-error' : '');

        // also color individual chars within
        let inner = '';
        for (let k = r.start; k < r.end; k++) {
          const tch = target[k];
          const ich = typed[k];
          let cclass = 'ch';
          if (k < typed.length) cclass += (ich === tch ? ' done' : ' bad');
          else if (k === typed.length) cclass += ' cur';
          inner += `<span class="${cclass}">${escapeHtml(tch)}</span>`;
        }
        html += cls ? `<span class="${cls}">${inner}</span>` : inner;
      }
      passage.innerHTML = html;
      maybeAutoScroll();
      return;
    }

    // letter-only highlight
    if (hl === 'letter') {
      let html = '';
      for (let i = 0; i < target.length; i++) {
        const tch = target[i];
        const ich = typed[i];
        let cls = 'ch';
        if (i < typed.length) cls += ich === tch ? ' done' : ' bad';
        else if (i === typed.length) cls += ' cur';
        html += `<span class="${cls}">${escapeHtml(tch)}</span>`;
      }
      passage.innerHTML = html;
      maybeAutoScroll();
    }
  }

  function maybeAutoScroll() {
    if (!settings.autoScroll) return;
    const cur = passage.querySelector('.cur, .wd-current');
    if (!cur) return;
    const wrapTop = passage.scrollTop;
    const wrapH = passage.clientHeight;
    const elTop = cur.offsetTop;
    if (elTop < wrapTop || elTop > wrapTop + wrapH - 60) {
      passage.scrollTop = elTop - wrapH / 2;
    }
  }

  // ---------- input handling ----------
  function onInputEvent() {
    if (finished) return;
    if (!started) startTimer();
    const v = input.value;

    // Detect deletion
    if (v.length < typed.length) {
      // Backspace was used (the input itself accepted it; we may need to roll back)
      typed = v;
      // recompute correct/total from scratch up to typed.length is cheaper but for simplicity:
      recomputeCounts();
    } else if (v.length > typed.length) {
      // Forward typing — increment counts
      for (let i = typed.length; i < v.length; i++) {
        const newCh = v[i];
        const expected = target[i];
        totalChars++;
        if (newCh === expected) correctChars++;
        else errorCount++;
      }
      typed = v;
    }

    if (typed.length >= target.length) finish();
    render();
    updateStats();
  }

  function recomputeCounts() {
    correctChars = 0; totalChars = 0; errorCount = 0;
    for (let i = 0; i < typed.length; i++) {
      totalChars++;
      if (typed[i] === target[i]) correctChars++;
      else errorCount++;
    }
  }

  function onKeyDown(e) {
    if (finished) { e.preventDefault(); return; }

    // Backspace control
    if (e.key === 'Backspace') {
      if (settings.backspace === 'disabled') {
        e.preventDefault();
        return;
      }
      if (settings.backspace === 'oneword') {
        e.preventDefault();
        // Delete back to start of previous word
        let v = input.value;
        if (!v.length) return;
        // strip trailing spaces
        let i = v.length;
        while (i > 0 && /\s/.test(v[i - 1])) i--;
        // strip word
        while (i > 0 && !/\s/.test(v[i - 1])) i--;
        input.value = v.slice(0, i);
        typed = input.value;
        recomputeCounts();
        render();
        updateStats();
        return;
      }
      // 'full' → let browser handle
    }

    // Tab
    if (e.key === 'Tab') {
      if (!settings.allowTabs) {
        e.preventDefault();
        return;
      }
      // insert literal tab
      e.preventDefault();
      insertAtCursor('\t');
    }

    // Enter / paragraph
    if (e.key === 'Enter') {
      const wpAllows = settings.wordProc && settings.allowPara;
      if (!wpAllows) {
        e.preventDefault();
      }
    }
  }

  function insertAtCursor(text) {
    const start = input.selectionStart, end = input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    onInputEvent();
  }

  function onPaste(e) {
    // disallow paste
    e.preventDefault();
  }

  // ---------- result ----------
  function showResult() {
    const elapsed = Math.max(durationSec - timeLeft, 1);
    const minutes = elapsed / 60;
    const wpm = Math.max(0, Math.round((correctChars / 5) / minutes));
    const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 100;
    rWpm.textContent = wpm;
    rAcc.textContent = acc + '%';
    rErr.textContent = errorCount;
    rChars.textContent = totalChars;
    rModal.classList.add('show');
  }

  // ---------- modes ----------
  function setMode(next) {
    mode = next;
    app.classList.remove('mode-printout', 'mode-exam');
    document.body.classList.remove('mode-printout', 'mode-exam');
    if (next === 'printout') {
      app.classList.add('mode-printout');
      document.body.classList.add('mode-printout');
    } else if (next === 'exam') {
      app.classList.add('mode-exam');
      document.body.classList.add('mode-exam');
    }
  }

  // ---------- visual settings ----------
  function applyVisualSettings() {
    passage.style.fontFamily = settings.fontFamily;
    input.style.fontFamily = settings.fontFamily;
    passage.style.fontSize = settings.fontSize + 'px';
    input.style.fontSize = settings.fontSize + 'px';
    fontVal.textContent = settings.fontSize;

    passage.classList.toggle('tp-bold', settings.bold);
    input.classList.toggle('tp-bold', settings.bold);

    // scrollbar
    if (settings.showScrollbar) {
      passage.classList.remove('tp-noscroll');
      passage.style.overflowY = 'auto';
    } else {
      passage.classList.add('tp-noscroll');
    }

    // word-processor controls behavior on input
    // (handled in keydown / paste)
  }

  function applySettingsToUI() {
    // Radios: backspace
    const bRadios = document.querySelectorAll('input[name="backspace"]');
    bRadios.forEach((r) => { r.checked = (r.value === settings.backspace); });
    // Radios: highlight
    const hRadios = document.querySelectorAll('input[name="highlight"]');
    hRadios.forEach((r) => { r.checked = (r.value === settings.highlight); });
    // Toggles
    showScroll.checked = !!settings.showScrollbar;
    autoScroll.checked = !!settings.autoScroll;
    wlChk.checked = !!settings.wordLimit;
    wlVal.value = settings.wordLimitVal;
    wlVal.disabled = !settings.wordLimit;
    wpChk.checked = !!settings.wordProc;
    allowPara.checked = !!settings.allowPara;
    allowTabs.checked = !!settings.allowTabs;
    boldChk.checked = !!settings.bold;
    fontFamily.value = settings.fontFamily;
    durationSel.value = String(settings.duration);
    durationSec = settings.duration;
    timeLeft = durationSec;
  }

  // ---------- persistence ----------
  function saveSettings() {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
  }
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}'); }
    catch (e) { return {}; }
  }
  function loadLocalExercises() {
    try { return JSON.parse(localStorage.getItem(LS_LOCAL_EX) || '[]'); }
    catch (e) { return []; }
  }
  function saveLocalExercises(list) {
    try { localStorage.setItem(LS_LOCAL_EX, JSON.stringify(list)); } catch (e) {}
  }

  // ---------- events ----------
  function bindEvents() {
    input.addEventListener('input', onInputEvent);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('paste', onPaste);

    durationSel.addEventListener('change', () => {
      settings.duration = parseInt(durationSel.value, 10);
      durationSec = settings.duration;
      saveSettings();
      reset();
    });

    exSelect.addEventListener('change', () => setExercise(parseInt(exSelect.value, 10)));
    nextEx.addEventListener('click', () => setExercise(exIndex + 1));

    fontFamily.addEventListener('change', () => {
      settings.fontFamily = fontFamily.value;
      saveSettings(); applyVisualSettings();
    });
    boldChk.addEventListener('change', () => {
      settings.bold = boldChk.checked;
      saveSettings(); applyVisualSettings();
    });
    fontUp.addEventListener('click', () => {
      settings.fontSize = clamp(settings.fontSize + 1, 12, 36);
      saveSettings(); applyVisualSettings();
    });
    fontDown.addEventListener('click', () => {
      settings.fontSize = clamp(settings.fontSize - 1, 12, 36);
      saveSettings(); applyVisualSettings();
    });

    // Radios
    document.querySelectorAll('input[name="backspace"]').forEach((r) =>
      r.addEventListener('change', () => {
        if (r.checked) { settings.backspace = r.value; saveSettings(); }
      })
    );
    document.querySelectorAll('input[name="highlight"]').forEach((r) =>
      r.addEventListener('change', () => {
        if (r.checked) { settings.highlight = r.value; saveSettings(); render(); }
      })
    );

    // Toggles
    showScroll.addEventListener('change', () => {
      settings.showScrollbar = showScroll.checked; saveSettings(); applyVisualSettings();
    });
    autoScroll.addEventListener('change', () => {
      settings.autoScroll = autoScroll.checked; saveSettings();
    });
    wlChk.addEventListener('change', () => {
      settings.wordLimit = wlChk.checked;
      wlVal.disabled = !settings.wordLimit;
      saveSettings();
      // re-apply current exercise text
      if (exercises.length) setExercise(exIndex);
    });
    wlVal.addEventListener('change', () => {
      const v = clamp(parseInt(wlVal.value, 10) || 500, 50, 1500);
      wlVal.value = v;
      settings.wordLimitVal = v;
      saveSettings();
      if (settings.wordLimit && exercises.length) setExercise(exIndex);
    });
    wlUp.addEventListener('click', () => {
      wlVal.value = clamp((parseInt(wlVal.value, 10) || 500) + 50, 50, 1500);
      wlVal.dispatchEvent(new Event('change'));
    });
    wlDown.addEventListener('click', () => {
      wlVal.value = clamp((parseInt(wlVal.value, 10) || 500) - 50, 50, 1500);
      wlVal.dispatchEvent(new Event('change'));
    });
    wpChk.addEventListener('change', () => { settings.wordProc = wpChk.checked; saveSettings(); });
    allowPara.addEventListener('change', () => { settings.allowPara = allowPara.checked; saveSettings(); });
    allowTabs.addEventListener('change', () => { settings.allowTabs = allowTabs.checked; saveSettings(); });

    // Modes
    printBtn.addEventListener('click', () => {
      setMode(mode === 'printout' ? 'practice' : 'printout');
    });
    examBtn.addEventListener('click', () => {
      setMode(mode === 'exam' ? 'practice' : 'exam');
    });

    // Restart / Submit
    restartBtn.addEventListener('click', reset);
    submitBtn.addEventListener('click', () => { if (!finished) finish(); });

    // Reset all settings
    resetBtn.addEventListener('click', () => {
      settings = { ...defaults };
      saveSettings();
      applySettingsToUI();
      applyVisualSettings();
      reset();
    });

    // Result modal
    rClose.addEventListener('click', () => rModal.classList.remove('show'));
    rRetry.addEventListener('click', () => { rModal.classList.remove('show'); reset(); input.focus(); });

    // Add-exercise modal
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      addTitle.value = '';
      addContent.value = '';
      addModal.classList.add('show');
      addTitle.focus();
    });
    aCancel.addEventListener('click', () => addModal.classList.remove('show'));
    aSave.addEventListener('click', () => {
      const t = addTitle.value.trim();
      const c = addContent.value.trim();
      if (!t || !c) {
        alert('Title and content are required.');
        return;
      }
      const local = loadLocalExercises();
      local.push({
        id: 'local-' + Date.now(),
        section: 'english',
        mode: 'test',
        title: '★ ' + t,
        content: c,
        local: true,
        createdAt: new Date().toISOString(),
      });
      saveLocalExercises(local);
      addModal.classList.remove('show');
      loadExercises().then(() => {
        // jump to the newly added (last)
        setExercise(exercises.length - 1);
      });
    });

    // close modal on backdrop click
    [rModal, addModal].forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
    });

    // Esc key exits exam/printout mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (mode === 'exam' || mode === 'printout')) {
        setMode('practice');
      }
    });
  }

  // ---------- utils ----------
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
