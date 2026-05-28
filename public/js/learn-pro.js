// Rich English Learn typing engine.
// Features: exercise navigation, font-size + bold, settings (backspace mode,
// show keyboard, hands-on-keyboard mode, play sounds, move on error),
// visual keyboard with current-key highlight, per-finger hand-guide,
// floating fingertip indicators that smoothly slide to the next key,
// and a modern result modal with Method 1 / Method 2 tabs.
(function () {
  // ------------------------------------------------------------------
  // Keyboard layout (US QWERTY) with finger zones
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
      if (/^[a-z]$/.test(key.c)) CHAR_MAP[key.c.toUpperCase()] = { r, k, f: key.f, shift: true };
      if (key.s) CHAR_MAP[key.s] = { r, k, f: key.f, shift: true };
    }
  }));

  // Home-row position for each finger code (used as the "rest" position
  // for floating fingertip indicators when not pressing a key).
  const FINGER_HOMES = {
    L4: { r: 2, k: 1 },   // A
    L3: { r: 2, k: 2 },   // S
    L2: { r: 2, k: 3 },   // D
    L1: { r: 2, k: 4 },   // F
    R1: { r: 2, k: 6 },   // J
    R2: { r: 2, k: 7 },   // K
    R3: { r: 2, k: 8 },   // L
    R4: { r: 2, k: 9 },   // ;
    TH: { r: 4, k: 2 },   // Space
  };

  const FINGER_LABELS = {
    L4: 'P', L3: 'R', L2: 'M', L1: 'I',
    R1: 'I', R2: 'M', R3: 'R', R4: 'P',
    TH: '⌴',
  };

  const FINGER_ORDER = ['L4', 'L3', 'L2', 'L1', 'TH', 'R1', 'R2', 'R3', 'R4'];

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
  const handsOnKbdChk = document.getElementById('opt-hands-on-keyboard');
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
    handsOnKbd: false,
    playSound: true,
    moveOnError: true,
    bsMode: 'off',
    started: false,
    startedAt: 0,
    timer: null,
    elapsed: 0,
    totalChars: 0,
    correctChars: 0,
    errors: 0,
    backspaces: 0,
  };

  // ------------------------------------------------------------------
  // Audio (Web Audio beep)
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
    buildFingertips();
  }

  // Build 9 fingertip indicators (4 left + 4 right + 1 thumb).
  function buildFingertips() {
    // Remove any previous
    kbdEl.querySelectorAll('.fingertip').forEach((n) => n.remove());
    FINGER_ORDER.forEach((f) => {
      const el = document.createElement('div');
      el.className = 'fingertip';
      el.dataset.finger = f;
      el.textContent = FINGER_LABELS[f];
      kbdEl.appendChild(el);
    });
  }

  function highlightKeyboard(ch) {
    document.querySelectorAll('.kbd-key.cur').forEach((el) => el.classList.remove('cur'));
    if (!ch) return;
    const map = CHAR_MAP[ch];
    if (!map) {
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
    if (map.shift) {
      kbdEl.querySelectorAll('.kbd-key').forEach((el) => {
        if (el.textContent === 'Shift') el.classList.add('cur');
      });
    }
  }

  function flashKeyPress() {
    const cur = kbdEl.querySelector('.kbd-key.cur');
    if (!cur) return;
    cur.classList.add('pressed');
    setTimeout(() => cur.classList.remove('pressed'), 100);
  }

  // ------------------------------------------------------------------
  // Side-card hands (existing) - finger highlight
  // ------------------------------------------------------------------
  function fingerSvg(side) {
    const flip = side === 'R' ? ' transform="scale(-1,1) translate(-200,0)"' : '';
    const codes = side === 'L'
      ? ['L4','L3','L2','L1','TH']
      : ['R4','R3','R2','R1','TH'];
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
    return `<svg class="hand-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"><g${flip}>${fingers}<ellipse class="palm" cx="110" cy="170" rx="80" ry="40"/></g></svg>`;
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
  // Hands-on-Keyboard fingertip overlay
  // ------------------------------------------------------------------
  // Computes the (x, y) center of a key relative to the keyboard.
  function keyCenter(r, k) {
    const row = kbdEl.children[r];
    if (!row) return null;
    const key = row.children[k];
    if (!key) return null;
    const kr = key.getBoundingClientRect();
    const cr = kbdEl.getBoundingClientRect();
    return {
      x: kr.left - cr.left + kr.width / 2,
      y: kr.top - cr.top + kr.height / 2,
    };
  }

  function placeFingertip(finger, r, k, isActive) {
    const el = kbdEl.querySelector(`.fingertip[data-finger="${finger}"]`);
    if (!el) return;
    const c = keyCenter(r, k);
    if (!c) return;
    el.style.setProperty('--tx', c.x + 'px');
    el.style.setProperty('--ty', c.y + 'px');
    el.classList.toggle('active', !!isActive);
  }

  // Send each finger to its home; the active finger goes to the target key.
  function repositionFingertips(ch) {
    if (!state.handsOnKbd) return;
    const map = CHAR_MAP[ch] || (ch === ' ' ? { f: 'TH', r: 4, k: 2 } : null);
    const activeFinger = map ? map.f : null;
    FINGER_ORDER.forEach((f) => {
      if (activeFinger && f === activeFinger) {
        placeFingertip(f, map.r, map.k, true);
      } else {
        const home = FINGER_HOMES[f];
        placeFingertip(f, home.r, home.k, false);
      }
    });
  }

  function applyHandsOnKbd() {
    document.body.classList.toggle('hands-on-active', state.handsOnKbd);
    kbdEl.classList.toggle('hands-on', state.handsOnKbd);
    if (state.handsOnKbd) {
      // give layout one frame to settle then position
      requestAnimationFrame(() => repositionFingertips(state.target[state.typed.length]));
    }
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
    drillEl.style.fontSize = state.fontSize + 'px';
    drillEl.classList.toggle('bold', state.bold);

    const next = state.target[state.typed.length];
    highlightKeyboard(next);
    highlightFinger(next);
    repositionFingertips(next);
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
  function stopTimer() { clearInterval(state.timer); state.timer = null; }

  // ------------------------------------------------------------------
  // Typing input handling
  // ------------------------------------------------------------------
  function handleKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
    // Don't intercept keystrokes when result modal is open
    if (resultModal.classList.contains('show')) return;

    if (document.activeElement !== drillEl && !drillEl.contains(document.activeElement)) {
      if (e.key.length === 1 || e.key === 'Backspace') drillEl.focus();
      else return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (state.bsMode === 'off') return;
      if (!state.typed.length) return;
      state.backspaces++;
      if (state.bsMode === 'full') {
        state.typed = state.typed.slice(0, -1);
      } else if (state.bsMode === 'word') {
        let t = state.typed.replace(/\s+$/, '');
        const sp = t.lastIndexOf(' ');
        state.typed = sp === -1 ? '' : t.slice(0, sp + 1);
      }
      renderDrill();
      return;
    }

    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    e.preventDefault();
    startTimerIfNeeded();

    const expected = state.target[state.typed.length];
    if (expected === undefined) return;

    state.totalChars++;
    if (e.key === expected) {
      state.correctChars++;
      state.typed += e.key;
      beepGood();
      flashKeyPress();
    } else {
      state.errors++;
      beepBad();
      if (state.moveOnError) {
        state.typed += e.key;
      }
    }
    renderDrill();
    updateStats();

    if (state.typed.length >= state.target.length) finish();
  }

  function finish() {
    stopTimer();
    completeToast.classList.add('show');
    setTimeout(() => completeToast.classList.remove('show'), 1500);
    setTimeout(() => showResult(), 600);
  }

  // ------------------------------------------------------------------
  // Result modal
  // ------------------------------------------------------------------
  const resultModal     = document.getElementById('result-modal');
  const resultPrintBtn  = document.getElementById('result-print');
  const resultCloseBtn  = document.getElementById('result-close');
  const resultRepeatBtn = document.getElementById('result-repeat');
  const resultNextBtn   = document.getElementById('result-next');
  const methodTabs      = document.querySelectorAll('.method-tab');
  const methodPanels    = {
    1: document.getElementById('method-panel-1'),
    2: document.getElementById('method-panel-2'),
  };
  const ringFg          = document.getElementById('ring-acc');
  const RING_LEN        = 327; // 2π × 52

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function gradeFromScore(wpm, acc) {
    // Combined heuristic: weight accuracy heavier
    const score = (acc * 0.6) + (Math.min(wpm, 80) / 80 * 100 * 0.4);
    if (score >= 90) return { grade: 'A+', label: 'Outstanding' };
    if (score >= 80) return { grade: 'A',  label: 'Excellent' };
    if (score >= 70) return { grade: 'B',  label: 'Great work' };
    if (score >= 55) return { grade: 'C',  label: 'Keep going' };
    if (score >= 40) return { grade: 'D',  label: 'Practice more' };
    return { grade: 'E', label: 'Try again' };
  }

  function computeMethod2Words() {
    const t = state.target.split(/\s+/).filter(Boolean);
    const u = state.typed.split(/\s+/).filter(Boolean);
    const total = u.length;
    let correct = 0;
    for (let i = 0; i < u.length; i++) {
      if (u[i] === t[i]) correct++;
    }
    return { total, correct, incorrect: total - correct };
  }

  function showResult() {
    const seconds = Math.max(state.elapsed, 1);
    const minutes = seconds / 60;

    // Method 1 (5 chars = 1 word)
    const grossKs = state.totalChars;
    const netKs   = state.correctChars;
    const m1GrossWpm = Math.round((grossKs / 5) / minutes);
    const m1NetWpm   = Math.round((netKs   / 5) / minutes);
    const m1GrossKsm = Math.round(grossKs / minutes);
    const m1NetKsm   = Math.round(netKs   / minutes);
    const m1Acc      = state.totalChars ? Math.round((state.correctChars / state.totalChars) * 100) : 0;

    // Method 2 (space-separated words)
    const m2 = computeMethod2Words();
    const m2GrossWpm = Math.round(m2.total   / minutes);
    const m2NetWpm   = Math.round(m2.correct / minutes);
    const m2Acc      = m2.total ? Math.round((m2.correct / m2.total) * 100) : 0;

    // Hero numbers
    setText('hero-wpm', m1NetWpm);
    setText('hero-acc', m1Acc + '%');

    // Grade
    const { grade, label } = gradeFromScore(m1NetWpm, m1Acc);
    setText('result-grade', grade);
    setText('result-eyebrow', label.toUpperCase());
    document.getElementById('result-title').textContent =
      m1Acc >= 95 ? 'Beautiful job!' :
      m1Acc >= 80 ? 'Nicely done!' :
      m1Acc >= 60 ? 'Solid effort!' :
                    'Lesson complete';

    // Animate accuracy ring
    if (ringFg) {
      ringFg.style.strokeDashoffset = String(RING_LEN);
      requestAnimationFrame(() => {
        ringFg.style.strokeDashoffset = String(RING_LEN * (1 - m1Acc / 100));
      });
    }

    // Mini stats
    setText('r-duration',         seconds < 60 ? `${seconds}s` : `${Math.floor(seconds/60)}m ${seconds%60}s`);
    setText('r-total-words',      m2.total);
    setText('r-correct-words',    m2.correct);
    setText('r-incorrect-words',  m2.incorrect);
    setText('r-bs-count',         state.backspaces);

    // Method 1 fields
    setText('r1-net-wpm',   m1NetWpm);
    setText('r1-net-ksm',   m1NetKsm);
    setText('r1-net-ksh',   m1NetKsm * 60);
    setText('r1-gross-wpm', m1GrossWpm);
    setText('r1-gross-ksm', m1GrossKsm);
    setText('r1-gross-ksh', m1GrossKsm * 60);
    setText('r1-acc',       m1Acc);

    // Method 2 fields
    setText('r2-net-wpm',   m2NetWpm);
    setText('r2-net-ksm',   m1NetKsm);
    setText('r2-net-ksh',   m1NetKsm * 60);
    setText('r2-gross-wpm', m2GrossWpm);
    setText('r2-gross-ksm', m1GrossKsm);
    setText('r2-gross-ksh', m1GrossKsm * 60);
    setText('r2-acc',       m2Acc);

    // Typed text
    const typedBlock = document.getElementById('r-typed-block');
    const typedEl    = document.getElementById('r-typed');
    if (state.typed.length === 0) {
      typedBlock.style.display = 'none';
    } else {
      typedBlock.style.display = '';
      let html = '';
      for (let i = 0; i < state.typed.length; i++) {
        const tch = state.target[i];
        const ich = state.typed[i];
        const cls = ich === tch ? 'ok' : 'bad';
        const display = ich === ' ' ? '\u00A0' : ich;
        html += `<span class="${cls}">${escapeHtml(display)}</span>`;
      }
      typedEl.innerHTML = html;
    }

    // Default to Method 1 tab
    switchMethod(1);
    resultModal.classList.add('show');
  }

  function hideResult() { resultModal.classList.remove('show'); }

  function switchMethod(n) {
    methodTabs.forEach((t) => t.classList.toggle('active', +t.dataset.method === n));
    methodPanels[1].hidden = n !== 1;
    methodPanels[2].hidden = n !== 2;
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
    state.backspaces = 0;
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
    if (state.showKbd && state.handsOnKbd) {
      requestAnimationFrame(() => repositionFingertips(state.target[state.typed.length]));
    }
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
    handsOnKbdChk.addEventListener('change', () => {
      state.handsOnKbd = handsOnKbdChk.checked;
      applyHandsOnKbd();
    });
    playSoundChk.addEventListener('change', () => { state.playSound = playSoundChk.checked; if (state.playSound) ensureAudio(); });
    moveOnErrorChk.addEventListener('change', () => { state.moveOnError = moveOnErrorChk.checked; });
    backspaceRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) state.bsMode = r.value; }));

    document.addEventListener('keydown', handleKey);
    drillEl.addEventListener('click', () => drillEl.focus());
    drillEl.addEventListener('focus', () => drillEl.classList.add('focused'));
    drillEl.addEventListener('blur',  () => drillEl.classList.remove('focused'));

    // Reposition fingertips on resize (key positions change)
    window.addEventListener('resize', () => {
      if (state.handsOnKbd) repositionFingertips(state.target[state.typed.length]);
    });

    // Result modal bindings
    methodTabs.forEach((t) => t.addEventListener('click', () => switchMethod(+t.dataset.method)));
    resultPrintBtn.addEventListener('click', () => window.print());
    resultCloseBtn.addEventListener('click', hideResult);
    resultRepeatBtn.addEventListener('click', () => {
      hideResult();
      setExercise(state.idx);
    });
    resultNextBtn.addEventListener('click', () => {
      hideResult();
      const target = Math.min(state.idx + 1, state.exercises.length - 1);
      setExercise(target);
    });
    resultModal.addEventListener('click', (e) => {
      if (e.target === resultModal) hideResult();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && resultModal.classList.contains('show')) hideResult();
    });
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  buildKeyboard();
  renderHands();
  bindUi();
  applyFontSize();
  applyShowKbd();
  applyHandsOnKbd();
  loadExercises();
})();
