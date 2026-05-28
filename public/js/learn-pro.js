// Rich English Learn typing engine.
// Features: exercise navigation, font-size + bold, settings (backspace mode,
// show keyboard, play sounds, move on error), visual keyboard with current-key
// highlight, and per-finger hand-guide highlight.
(function () {
  // ------------------------------------------------------------------
  // Keyboard layout (US QWERTY) with finger zones
  //   f = finger code (used for color zone + hand finger highlight)
  //     L4 = left pinky, L3 = ring, L2 = middle, L1 = index
  //     R1 = right index, R2 = middle, R3 = ring, R4 = pinky
  //     TH = thumbs, MOD = modifier (no finger guide)
  //   c = single character emitted by this key (lowercase)
  //   s = character emitted with Shift held
  //   k = special key label
  //   w = relative width (1 = standard)
  // ------------------------------------------------------------------
  const ROWS = [
    [
      {c:'`', s:'~', f:'L4'}, {c:'1', s:'!', f:'L4'}, {c:'2', s:'@', f:'L3'},
      {c:'3', s:'#', f:'L2'}, {c:'4', s:'$', f:'L1'}, {c:'5', s:'%', f:'L1'},
      {c:'6', s:'^', f:'R1'}, {c:'7', s:'&', f:'R1'}, {c:'8', s:'*', f:'R2'},
      {c:'9', s:'(', f:'R3'}, {c:'0', s:')', f:'R4'},
      {c:'-', s:'_', f:'R4'}, {c:'=', s:'+', f:'R4'},
      {k:'⌫', label:'Backspace', f:'MOD', w:2},
    ],
    [
      {k:'Tab', f:'MOD', w:1.5, text:true},
      {c:'q', f:'L4'}, {c:'w', f:'L3'}, {c:'e', f:'L2'}, {c:'r', f:'L1'}, {c:'t', f:'L1'},
      {c:'y', f:'R1'}, {c:'u', f:'R1'}, {c:'i', f:'R2'}, {c:'o', f:'R3'}, {c:'p', f:'R4'},
      {c:'[', s:'{', f:'R4'}, {c:']', s:'}', f:'R4'}, {c:'\\', s:'|', f:'R4', w:1.5},
    ],
    [
      {k:'Caps', f:'MOD', w:1.75, text:true},
      {c:'a', f:'L4'}, {c:'s', f:'L3'}, {c:'d', f:'L2'}, {c:'f', f:'L1'}, {c:'g', f:'L1'},
      {c:'h', f:'R1'}, {c:'j', f:'R1'}, {c:'k', f:'R2'}, {c:'l', f:'R3'},
      {c:';', s:':', f:'R4'}, {c:"'", s:'"', f:'R4'},
      {k:'Enter', f:'MOD', w:2.25, text:true},
    ],
    [
      {k:'Shift', f:'MOD', w:2.25, text:true},
      {c:'z', f:'L4'}, {c:'x', f:'L3'}, {c:'c', f:'L2'}, {c:'v', f:'L1'}, {c:'b', f:'L1'},
      {c:'n', f:'R1'}, {c:'m', f:'R1'}, {c:',', s:'<', f:'R2'}, {c:'.', s:'>', f:'R3'},
      {c:'/', s:'?', f:'R4'},
      {k:'Shift', f:'MOD', w:2.75, text:true},
    ],
    [
      {k:'Ctrl', f:'MOD', w:1.25, text:true},
      {k:'Alt', f:'MOD', w:1.25, text:true},
      {k:'Space', c:' ', f:'TH', w:6.5, text:true},
      {k:'Alt', f:'MOD', w:1.25, text:true},
      {k:'Ctrl', f:'MOD', w:1.25, text:true},
    ],
  ];

  // Lookup: char (or shifted char) -> {row, col, finger, shifted}
  const CHAR_MAP = {};
  ROWS.forEach((row, r) => row.forEach((key, k) => {
    if (key.c !== undefined) {
      CHAR_MAP[key.c] = { r, k, f: key.f, shift: false };
      // upper-case alpha
      if (/^[a-z]$/.test(key.c)) CHAR_MAP[key.c.toUpperCase()] = { r, k, f: key.f, shift: true };
      if (key.s) CHAR_MAP[key.s] = { r, k, f: key.f, shift: true };
    }
  }));

  // ------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------
  const drillEl = document.getElementById('drill');
  const exerciseSelect = document.getElementById('exercise-select');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const fontUpBtn = document.getElementById('font-up');
  const fontDownBtn = document.getElementById('font-down');
  const fontNumEl = document.getElementById('font-size');
  const boldChk = document.getElementById('opt-bold');
  const showKbdChk = document.getElementById('opt-show-keyboard');
  const playSoundChk = document.getElementById('opt-play-sound');
  const moveOnErrorChk = document.getElementById('opt-move-on-error');
  const backspaceRadios = document.querySelectorAll('input[name="bs-mode"]');
  const kbdEl = document.getElementById('keyboard');
  const wpmEl = document.getElementById('stat-wpm');
  const accEl = document.getElementById('stat-acc');
  const errEl = document.getElementById('stat-err');
  const timeEl = document.getElementById('stat-time');
  const leftHandEl = document.getElementById('left-hand');
  const rightHandEl = document.getElementById('right-hand');
  const completeToast = document.getElementById('complete-toast');
  const restartBtn = document.getElementById('restart-btn');

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    exercises: [],
    idx: 0,
    target: '',
    typed: '',
    fontSize: 22,
    bold: false,
    showKbd: true,
    playSound: true,
    moveOnError: true,
    bsMode: 'off', // 'full' | 'word' | 'off'
    started: false,
    startedAt: 0,
    timer: null,
    elapsed: 0,
    totalChars: 0,
    correctChars: 0,
    errors: 0,
  };

  // ------------------------------------------------------------------
  // Audio (Web Audio beep, no asset needed)
  // ------------------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(freq, ms = 60, type = 'sine', vol = 0.05) {
    if (!state.playSound) return;
    ensureAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000);
  }
  const beepGood = () => beep(880, 35, 'square', 0.04);
  const beepBad  = () => beep(180, 120, 'sawtooth', 0.06);

  // ------------------------------------------------------------------
  // Visual keyboard
  // ------------------------------------------------------------------
  function buildKeyboard() {
    kbdEl.innerHTML = '';
    ROWS.forEach((row) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'kbd-row';
      row.forEach((key) => {
        const div = document.createElement('div');
        const f = key.f || 'MOD';
        div.className = `kbd-key f-${f}` + (key.text ? ' text' : '');
        if (key.w) div.style.setProperty('--mul', key.w);
        div.dataset.char = key.c || '';
        div.dataset.label = key.k || (key.c ? key.c.toUpperCase() : '');
        div.textContent = key.k ? key.k : (key.c || '').toUpperCase();
        rowDiv.appendChild(div);
      });
      kbdEl.appendChild(rowDiv);
    });
  }

  function highlightKeyboard(ch) {
    document.querySelectorAll('.kbd-key.cur').forEach((el) => el.classList.remove('cur'));
    if (!ch) return;
    const map = CHAR_MAP[ch];
    if (!map) {
      // Space falls through to dataset.char ' '
      if (ch === ' ') {
        const space = kbdEl.querySelector('[data-char=" "]');
        if (space) space.classList.add('cur');
      }
      return;
    }
    const row = kbdEl.children[map.r];
    if (!row) return;
    const targetKey = row.children[map.k];
    if (targetKey) targetKey.classList.add('cur');
    // Add a shift highlight too
    if (map.shift) {
      kbdEl.querySelectorAll('.kbd-key').forEach((el) => {
        if (el.textContent === 'Shift') el.classList.add('cur');
      });
    }
  }

  function flashKeyPress(ok) {
    const cur = kbdEl.querySelector('.kbd-key.cur');
    if (!cur) return;
    cur.classList.add('pressed');
    setTimeout(() => cur.classList.remove('pressed'), 100);
  }

  // ------------------------------------------------------------------
  // Hand finger guide (SVG injected into placeholders)
  // ------------------------------------------------------------------
  function fingerSvg(side) {
    // Side: 'L' or 'R'. Each finger has data-finger attr matching CHAR_MAP.f code.
    const flip = side === 'R' ? ' transform="scale(-1,1) translate(-200,0)"' : '';
    const codes = side === 'L'
      ? ['L4','L3','L2','L1','TH']
      : ['R4','R3','R2','R1','TH'];
    // Five fingers along the top, palm at bottom
    const xs = [40, 75, 110, 145, 178];
    const fingers = xs.map((x, i) => {
      const isThumb = i === 4;
      const fy = isThumb ? 110 : 30;
      const fh = isThumb ? 60 : 90;
      const fw = isThumb ? 36 : 22;
      const fx = isThumb ? x - 18 : x - 11;
      return `
        <rect class="finger" data-finger="${codes[i]}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="11"/>
        <circle class="tip" data-finger="${codes[i]}" cx="${x}" cy="${fy + 8}" r="6"/>
      `;
    }).join('');
    return `
      <svg class="hand-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
        <g${flip}>
          ${fingers}
          <ellipse class="palm" cx="110" cy="170" rx="80" ry="40"/>
        </g>
      </svg>
    `;
  }

  function renderHands() {
    leftHandEl.innerHTML = fingerSvg('L');
    rightHandEl.innerHTML = fingerSvg('R');
  }

  function highlightFinger(ch) {
    document.querySelectorAll('.hand-svg .finger.active').forEach((e) => e.classList.remove('active'));
    if (!ch) return;
    const map = CHAR_MAP[ch] || (ch === ' ' ? { f: 'TH' } : null);
    if (!map) return;
    document.querySelectorAll(`.hand-svg .finger[data-finger="${map.f}"]`).forEach((e) => e.classList.add('active'));
  }

  // ------------------------------------------------------------------
  // Drill rendering
  // ------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function renderDrill() {
    let html = '';
    for (let i = 0; i < state.target.length; i++) {
      const tch = state.target[i];
      const ich = state.typed[i];
      let cls = 'ch';
      if (i < state.typed.length) cls += (ich === tch) ? ' done' : ' bad';
      else if (i === state.typed.length) cls += ' cur';
      const display = tch === ' ' ? '\u00A0' : tch;
      html += `<span class="${cls}">${escapeHtml(display)}</span>`;
    }
    drillEl.innerHTML = html;
    // Re-style for current font / bold settings
    drillEl.style.fontSize = state.fontSize + 'px';
    drillEl.classList.toggle('bold', state.bold);

    // Highlight next-key on visual keyboard + hand
    const next = state.target[state.typed.length];
    highlightKeyboard(next);
    highlightFinger(next);
  }

  // ------------------------------------------------------------------
  // Stats / timer
  // ------------------------------------------------------------------
  function updateStats() {
    const minutes = Math.max(state.elapsed, 1) / 60;
    const wpm = Math.round((state.correctChars / 5) / minutes);
    const acc = state.totalChars ? Math.round((state.correctChars / state.totalChars) * 100) : 100;
    wpmEl.textContent = isFinite(wpm) && wpm >= 0 ? wpm : 0;
    accEl.textContent = acc + '%';
    errEl.textContent = state.errors;
    const m = Math.floor(state.elapsed / 60).toString().padStart(2, '0');
    const s = (state.elapsed % 60).toString().padStart(2, '0');
    timeEl.textContent = `${m}:${s}`;
  }

  function startTimerIfNeeded() {
    if (state.started) return;
    state.started = true;
    state.startedAt = Date.now();
    state.timer = setInterval(() => {
      state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      updateStats();
    }, 250);
  }

  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
  }

  // ------------------------------------------------------------------
  // Typing input handling - keydown captured globally when drill focused
  // ------------------------------------------------------------------
  function handleKey(e) {
    // Ignore if user is typing in an input/select elsewhere
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

    // We need the drill to be the active focus ring; let drill be focusable
    if (document.activeElement !== drillEl && !drillEl.contains(document.activeElement)) {
      // Not focused on drill; ignore unless they pressed a printable character (auto-focus)
      if (e.key.length === 1 || e.key === 'Backspace') drillEl.focus();
      else return;
    }

    // Backspace handling
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (state.bsMode === 'off') return;
      if (!state.typed.length) return;
      if (state.bsMode === 'full') {
        state.typed = state.typed.slice(0, -1);
      } else if (state.bsMode === 'word') {
        // Strip trailing whitespace then up to next whitespace
        let t = state.typed.replace(/\s+$/, '');
        const sp = t.lastIndexOf(' ');
        state.typed = sp === -1 ? '' : t.slice(0, sp + 1);
      }
      renderDrill();
      return;
    }

    // Ignore non-printable keys
    if (e.key.length !== 1) return;
    // Ignore modifier combos
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    e.preventDefault();
    startTimerIfNeeded();

    const expected = state.target[state.typed.length];
    if (expected === undefined) return; // already done

    state.totalChars++;
    if (e.key === expected) {
      state.correctChars++;
      state.typed += e.key;
      beepGood();
      flashKeyPress(true);
    } else {
      state.errors++;
      beepBad();
      if (state.moveOnError) {
        state.typed += e.key; // record the wrong char
      }
    }
    renderDrill();
    updateStats();

    if (state.typed.length >= state.target.length) finish();
  }

  function finish() {
    stopTimer();
    completeToast.classList.add('show');
    setTimeout(() => completeToast.classList.remove('show'), 2500);
  }

  // ------------------------------------------------------------------
  // Exercise navigation
  // ------------------------------------------------------------------
  async function loadExercises() {
    let list = [];
    try {
      list = await api.listExercises('english', 'learn');
    } catch (e) { list = []; }
    if (!list.length) {
      drillEl.textContent = 'No lessons available yet.';
      exerciseSelect.innerHTML = '<option>-- empty --</option>';
      return;
    }
    state.exercises = list;
    exerciseSelect.innerHTML = list.map((e, i) => `<option value="${i}">Exercise ${i + 1} / ${list.length} — ${e.title}</option>`).join('');
    setExercise(0);
  }

  function setExercise(i) {
    if (i < 0 || i >= state.exercises.length) return;
    state.idx = i;
    state.target = state.exercises[i].content;
    state.typed = '';
    state.totalChars = 0;
    state.correctChars = 0;
    state.errors = 0;
    state.elapsed = 0;
    state.started = false;
    stopTimer();
    exerciseSelect.value = String(i);
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === state.exercises.length - 1;
    renderDrill();
    updateStats();
    drillEl.focus();
  }

  // ------------------------------------------------------------------
  // Settings + UI bindings
  // ------------------------------------------------------------------
  function applyFontSize() {
    fontNumEl.textContent = state.fontSize;
    drillEl.style.fontSize = state.fontSize + 'px';
  }

  function applyShowKbd() {
    kbdEl.style.display = state.showKbd ? '' : 'none';
  }

  function bindUi() {
    prevBtn.addEventListener('click', () => setExercise(state.idx - 1));
    nextBtn.addEventListener('click', () => setExercise(state.idx + 1));
    exerciseSelect.addEventListener('change', () => setExercise(+exerciseSelect.value));
    restartBtn.addEventListener('click', () => setExercise(state.idx));

    fontUpBtn.addEventListener('click', () => {
      state.fontSize = Math.min(48, state.fontSize + 2);
      applyFontSize();
    });
    fontDownBtn.addEventListener('click', () => {
      state.fontSize = Math.max(12, state.fontSize - 2);
      applyFontSize();
    });

    boldChk.addEventListener('change', () => { state.bold = boldChk.checked; renderDrill(); });
    showKbdChk.addEventListener('change', () => { state.showKbd = showKbdChk.checked; applyShowKbd(); });
    playSoundChk.addEventListener('change', () => { state.playSound = playSoundChk.checked; if (state.playSound) ensureAudio(); });
    moveOnErrorChk.addEventListener('change', () => { state.moveOnError = moveOnErrorChk.checked; });
    backspaceRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) state.bsMode = r.value; }));

    document.addEventListener('keydown', handleKey);
    drillEl.addEventListener('click', () => drillEl.focus());
    drillEl.addEventListener('focus', () => drillEl.classList.add('focused'));
    drillEl.addEventListener('blur',  () => drillEl.classList.remove('focused'));
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  buildKeyboard();
  renderHands();
  bindUi();
  applyFontSize();
  applyShowKbd();
  loadExercises();
})();
