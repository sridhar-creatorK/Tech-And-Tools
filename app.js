const landingStage = document.querySelector('#landingStage');
const deviceStage = document.querySelector('#deviceStage');
const desktopStage = document.querySelector('#desktopStage');
const systemMode = document.querySelector('#systemMode');
const clockDisplay = document.querySelector('#clockDisplay');
const appSheetLayer = document.querySelector('#appSheetLayer');
const taskSwitcher = document.querySelector('#taskSwitcher');
const taskStackList = document.querySelector('#taskStackList');
const getStartedBtn = document.querySelector('#getStartedBtn');
const backButton = document.querySelector('#backButton');
const homeButton = document.querySelector('#homeButton');
const stacksButton = document.querySelector('#stacksButton');
const closeStacksBtn = document.querySelector('#closeStacksBtn');

const appRegistry = {
  clock: {
    title: 'Clock',
    subtitle: 'Time tracking modules',
    icon: 'fa-solid fa-clock',
    theme: 'theme-clock',
    body: () => `
      <section class="panel-grid" aria-label="Clock workspace">
        <article class="panel-card wide">
          <h3>Live WizOS Time</h3>
          <p>Use this timing hub for world clocks, countdowns, alarms, and workflow checkpoints.</p>
          <div class="big-metric" data-live-clock>--:--:-- --</div>
        </article>
        <article class="panel-card">
          <h3>Alarm Queue</h3>
          <ul class="panel-list">
            <li>Morning system check — 7:30 AM</li>
            <li>Project review — 1:00 PM</li>
            <li>Wind-down reminder — 8:45 PM</li>
          </ul>
        </article>
        <article class="panel-card">
          <h3>Focus Timer</h3>
          <p>Prepared for Pomodoro rounds, rest intervals, progress streaks, and notification tones.</p>
        </article>
      </section>
    `,
  },
  video: {
    title: 'Video Studio',
    subtitle: 'Media/video timeline panel',
    icon: 'fa-solid fa-film',
    theme: 'theme-video',
    body: () => `
      <section class="panel-grid" aria-label="Video Studio workspace">
        <article class="panel-card wide">
          <h3>Timeline Assembly</h3>
          <p>Storyboard prompt clips, transitions, captions, b-roll, aspect ratio presets, and export lanes.</p>
          <div class="progress-rail" aria-label="Timeline readiness"><span class="progress-fill" style="--progress: 66%"></span></div>
        </article>
        <article class="panel-card">
          <h3>Scene Stack</h3>
          <p>Scene 01: Intro shimmer<br />Scene 02: Product motion<br />Scene 03: Call-to-action close</p>
        </article>
        <article class="panel-card">
          <h3>Render Targets</h3>
          <p>Ready for 16:9, 9:16, 1:1, transparent overlays, thumbnails, and short-form exports.</p>
        </article>
      </section>
    `,
  },
  audio: {
    title: 'Audio Studio',
    subtitle: 'Voice & audio production panel',
    icon: 'fa-solid fa-microphone-lines',
    theme: 'theme-audio',
    body: () => `
      <section class="panel-grid" aria-label="Audio Studio workspace">
        <article class="panel-card wide">
          <h3>Production Chain</h3>
          <p>Generate narration, music beds, ambience, sound design, and mastering presets from one control surface.</p>
          <div class="progress-rail" aria-label="Audio readiness"><span class="progress-fill" style="--progress: 72%"></span></div>
        </article>
        <article class="panel-card">
          <h3>Voice Profiles</h3>
          <p>Warm narrator, product guide, tutorial host, energetic promo, and calm assistant slots.</p>
        </article>
        <article class="panel-card">
          <h3>Mix Console</h3>
          <p>Future controls for stems, levels, compression, equalization, spatial ambience, and delivery loudness.</p>
        </article>
      </section>
    `,
  },
  ai: {
    title: 'AI Assistant',
    subtitle: 'Jarvis core communication system',
    icon: 'fa-solid fa-brain',
    theme: 'theme-ai',
    body: () => `
      <section class="chat-panel" aria-label="AI assistant chat">
        <div class="chat-log" data-chat-log>
          <div class="message system">Welcome to WizOS AI. I can help plan, summarize, and prototype your next tool workflow.</div>
        </div>
        <form class="chat-form" data-chat-form>
          <input data-chat-input type="text" autocomplete="off" placeholder="Ask the WizOS assistant anything..." aria-label="Message the WizOS AI assistant" />
          <button type="submit" aria-label="Send message"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
        </form>
      </section>
    `,
  },
  calculator: {
    title: 'Calculator',
    subtitle: 'Quick formulas & arithmetic tool',
    icon: 'fa-solid fa-calculator',
    theme: 'theme-calculator',
    body: () => `
      <section class="calculator-shell" aria-label="Calculator workspace">
        <input class="display-panel" data-calculator-display value="0" aria-label="Calculator display" readonly />
        <div class="key-grid" aria-label="Calculator keypad">
          ${['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map((key) => `<button class="soft-key" type="button" data-calc-key="${key}">${key}</button>`).join('')}
          <button class="soft-key" type="button" data-calc-key="=" style="grid-column: 1 / -1">=</button>
        </div>
      </section>
    `,
  },
  converter: {
    title: 'Converter',
    subtitle: 'Unit scaling & translation workspace',
    icon: 'fa-solid fa-right-left',
    theme: 'theme-converter',
    body: () => `
      <section class="converter-shell" aria-label="Converter workspace">
        <article class="panel-card wide">
          <h3>Length Converter</h3>
          <p>Baseline conversion shell for meters, feet, inches, and kilometers.</p>
        </article>
        <div class="converter-grid">
          <input class="display-panel" data-converter-input type="number" value="1" aria-label="Value to convert" />
          <select class="select-field" data-converter-from aria-label="Convert from">
            <option value="meters">Meters</option>
            <option value="feet">Feet</option>
            <option value="inches">Inches</option>
            <option value="kilometers">Kilometers</option>
          </select>
          <select class="select-field" data-converter-to aria-label="Convert to">
            <option value="feet">Feet</option>
            <option value="meters">Meters</option>
            <option value="inches">Inches</option>
            <option value="kilometers">Kilometers</option>
          </select>
        </div>
        <article class="panel-card wide">
          <h3>Converted Result</h3>
          <div class="big-metric" data-converter-output>3.2808</div>
        </article>
      </section>
    `,
  },
  notepad: {
    title: 'Notepad',
    subtitle: 'Text management and code notes capture',
    icon: 'fa-solid fa-note-sticky',
    theme: 'theme-notepad',
    body: () => `
      <section class="notepad-shell" aria-label="Notepad workspace">
        <textarea class="textarea-panel" data-notepad-field aria-label="WizOS notepad"># WizOS Notes\n\n- Capture ideas\n- Draft utility logic\n- Store code snippets\n- Keep next actions visible</textarea>
        <article class="panel-card">
          <h3>Note Diagnostics</h3>
          <p><span data-note-count>93</span> characters captured in this local workspace.</p>
        </article>
      </section>
    `,
  },
};

/* ---------- Shared helpers ---------- */
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`wizos:${k}`)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`wizos:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
let sheetTick = null;
let audioCtx = null;

function beep(times = 3) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i += 1) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.4 + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.4);
      osc.stop(audioCtx.currentTime + i * 0.4 + 0.3);
    }
  } catch { /* audio blocked */ }
}

function toast(message) {
  let box = document.querySelector('.toast-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast-box';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  box.appendChild(item);
  window.setTimeout(() => item.remove(), 3200);
}

function wireTabs(root) {
  root.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
    root.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
  }));
}

/* Alarms fire in the background, even when the Clock sheet is closed */
let lastAlarmKey = '';
function checkAlarms() {
  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const key = `${now.toDateString()} ${hhmm}`;
  if (key === lastAlarmKey) return;
  const hit = store.get('alarms', []).filter((a) => a.on && a.time === hhmm);
  if (!hit.length) return;
  lastAlarmKey = key;
  beep(4);
  hit.forEach((a) => toast(`⏰ ${a.label || 'Alarm'} — ${hhmm}`));
}

/* ---------- Upgraded app definitions ---------- */
Object.assign(appRegistry, {
  clock: {
    title: 'Clock', subtitle: 'World clocks, timer, stopwatch & alarms', icon: 'fa-solid fa-clock', theme: 'theme-clock',
    body: () => `
      <div class="tabs" role="tablist">
        <button class="tab is-on" data-tab="world">World</button><button class="tab" data-tab="timer">Timer</button>
        <button class="tab" data-tab="stopwatch">Stopwatch</button><button class="tab" data-tab="alarm">Alarms</button>
      </div>
      <section data-pane="world" class="stack-gap">
        <article class="panel-card wide"><h3>Local time</h3><div class="big-metric" data-live-clock>--:--:-- --</div></article>
        <div class="city-grid" data-world></div>
      </section>
      <section data-pane="timer" class="stack-gap" hidden>
        <article class="panel-card wide"><div class="big-metric" data-timer-out>05:00</div>
          <div class="row"><input class="field" type="number" min="0" max="999" value="5" data-timer-min aria-label="Minutes" /><span>min</span>
          <input class="field" type="number" min="0" max="59" value="0" data-timer-sec aria-label="Seconds" /><span>sec</span></div>
          <div class="row"><button class="btn primary" data-timer-go>Start</button><button class="btn" data-timer-reset>Reset</button></div>
          <div class="row"><button class="chip" data-preset="25">Focus 25</button><button class="chip" data-preset="5">Break 5</button><button class="chip" data-preset="10">10</button></div>
        </article>
      </section>
      <section data-pane="stopwatch" class="stack-gap" hidden>
        <article class="panel-card wide"><div class="big-metric" data-sw-out>00:00.00</div>
          <div class="row"><button class="btn primary" data-sw-go>Start</button><button class="btn" data-sw-lap>Lap</button><button class="btn" data-sw-reset>Reset</button></div>
          <ol class="panel-list" data-sw-laps></ol></article>
      </section>
      <section data-pane="alarm" class="stack-gap" hidden>
        <article class="panel-card wide"><div class="row"><input class="field" type="time" value="07:30" data-alarm-time aria-label="Alarm time" />
          <input class="field grow" type="text" placeholder="Label (optional)" data-alarm-label aria-label="Alarm label" /><button class="btn primary" data-alarm-add>Add</button></div>
          <div class="list" data-alarm-list></div><p class="hint">Alarms ring while WizOS is open in this tab.</p></article>
      </section>`,
  },
  calculator: {
    title: 'Calculator', subtitle: 'Expressions, history & keyboard input', icon: 'fa-solid fa-calculator', theme: 'theme-calculator',
    body: () => `
      <section class="calc-layout" aria-label="Calculator workspace">
        <div class="calculator-shell">
          <input class="display-panel" data-calculator-display value="" placeholder="0" aria-label="Calculator display" inputmode="decimal" autocomplete="off" />
          <div class="calc-result" data-calc-result>&nbsp;</div>
          <div class="key-grid">
            ${['C', '(', ')', '⌫', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '^', '+', '%']
              .map((k) => `<button class="soft-key" type="button" data-calc-key="${k}">${k === '*' ? '×' : k === '/' ? '÷' : k}</button>`).join('')}
            <button class="soft-key eq-key" type="button" data-calc-key="=">=</button>
          </div>
        </div>
        <article class="panel-card"><h3>History <button class="chip" data-calc-clear>Clear</button></h3><div class="list" data-calc-history></div></article>
      </section>`,
  },
  converter: {
    title: 'Converter', subtitle: 'Length, weight, temperature, data, speed & more', icon: 'fa-solid fa-right-left', theme: 'theme-converter',
    body: () => `
      <section class="converter-shell">
        <div class="tabs" data-conv-cats></div>
        <div class="converter-grid">
          <input class="display-panel" data-converter-input type="number" value="1" aria-label="Value to convert" />
          <select class="select-field" data-converter-from aria-label="Convert from"></select>
          <select class="select-field" data-converter-to aria-label="Convert to"></select>
        </div>
        <div class="row"><button class="btn" data-conv-swap><i class="fa-solid fa-arrow-right-arrow-left"></i> Swap</button><button class="btn" data-conv-copy>Copy result</button></div>
        <article class="panel-card wide"><h3>Result</h3><div class="big-metric" data-converter-output>0</div></article>
      </section>`,
  },
  notepad: {
    title: 'Notepad', subtitle: 'Autosaving notes with export', icon: 'fa-solid fa-note-sticky', theme: 'theme-notepad',
    body: () => `
      <section class="notepad-shell">
        <div class="row"><button class="btn" data-note-copy><i class="fa-solid fa-copy"></i> Copy</button>
          <button class="btn" data-note-save><i class="fa-solid fa-download"></i> Download .txt</button>
          <button class="btn" data-note-clear><i class="fa-solid fa-trash"></i> Clear</button><span class="hint grow" data-note-status>Saved</span></div>
        <textarea class="textarea-panel" data-notepad-field aria-label="WizOS notepad" placeholder="Start typing — notes save automatically…"></textarea>
        <article class="panel-card"><p><span data-note-words>0</span> words · <span data-note-count>0</span> characters · <span data-note-read>0</span> min read</p></article>
      </section>`,
  },
  tasks: {
    title: 'Tasks', subtitle: 'To-do list that remembers', icon: 'fa-solid fa-list-check', theme: 'theme-tasks',
    body: () => `
      <section class="stack-gap">
        <article class="panel-card wide"><div class="row"><input class="field grow" data-task-input placeholder="Add a task and press Enter" aria-label="New task" autocomplete="off" />
          <button class="btn primary" data-task-add>Add</button></div>
          <div class="progress-rail"><span class="progress-fill" data-task-bar style="--progress:0%"></span></div>
          <p class="hint" data-task-stat></p><div class="list" data-task-list></div>
          <div class="row"><button class="chip" data-task-clean>Clear completed</button></div></article>
      </section>`,
  },
  password: {
    title: 'Password Lab', subtitle: 'Secure password generator', icon: 'fa-solid fa-key', theme: 'theme-password',
    body: () => `
      <section class="stack-gap">
        <article class="panel-card wide"><div class="pw-out" data-pw-out aria-live="polite"></div>
          <div class="progress-rail"><span class="progress-fill" data-pw-bar style="--progress:0%"></span></div><p class="hint" data-pw-strength></p>
          <label class="row">Length <input type="range" min="8" max="64" value="16" data-pw-len /> <strong data-pw-lenval>16</strong></label>
          <div class="row">
            <label class="chip"><input type="checkbox" checked data-pw-opt="abcdefghijklmnopqrstuvwxyz" /> a-z</label>
            <label class="chip"><input type="checkbox" checked data-pw-opt="ABCDEFGHIJKLMNOPQRSTUVWXYZ" /> A-Z</label>
            <label class="chip"><input type="checkbox" checked data-pw-opt="0123456789" /> 0-9</label>
            <label class="chip"><input type="checkbox" checked data-pw-opt="!@#$%^&*()-_=+[]{};:,.?" /> Symbols</label></div>
          <div class="row"><button class="btn primary" data-pw-gen>Generate</button><button class="btn" data-pw-copy>Copy</button></div></article>
      </section>`,
  },
});

/* ---------- Hydrators ---------- */
const $ = (sel) => appSheetLayer.querySelector(sel);
const $$ = (sel) => [...appSheetLayer.querySelectorAll(sel)];

function hydrateClock() {
  wireTabs(appSheetLayer);
  const cities = [['Bengaluru', 'Asia/Kolkata'], ['London', 'Europe/London'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['Dubai', 'Asia/Dubai'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
  const world = $('[data-world]');
  const paintWorld = () => {
    world.innerHTML = cities.map(([name, tz]) => `<article class="panel-card"><p>${name}</p><strong class="city-time">${new Date().toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit' })}</strong></article>`).join('');
  };
  paintWorld();

  // Timer
  const tOut = $('[data-timer-out]'); const tMin = $('[data-timer-min]'); const tSec = $('[data-timer-sec]'); const tGo = $('[data-timer-go]');
  let tEnd = 0; let tLeft = 0; let tRun = false;
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const setFromInputs = () => { tLeft = ((+tMin.value || 0) * 60 + (+tSec.value || 0)) * 1000; tOut.textContent = fmt(tLeft); };
  setFromInputs();
  [tMin, tSec].forEach((i) => i.addEventListener('input', () => { if (!tRun) setFromInputs(); }));
  tGo.addEventListener('click', () => {
    if (tRun) { tLeft = tEnd - Date.now(); tRun = false; tGo.textContent = 'Resume'; return; }
    if (tLeft <= 0) setFromInputs();
    if (tLeft <= 0) return;
    tEnd = Date.now() + tLeft; tRun = true; tGo.textContent = 'Pause';
  });
  $('[data-timer-reset]').addEventListener('click', () => { tRun = false; tGo.textContent = 'Start'; setFromInputs(); });
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => { tRun = false; tGo.textContent = 'Start'; tMin.value = b.dataset.preset; tSec.value = 0; setFromInputs(); }));

  // Stopwatch
  const sOut = $('[data-sw-out]'); const laps = $('[data-sw-laps]'); const sGo = $('[data-sw-go]');
  let sBase = 0; let sElapsed = 0; let sRun = false;
  const sFmt = (ms) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;
  sGo.addEventListener('click', () => {
    if (sRun) { sElapsed += performance.now() - sBase; sRun = false; sGo.textContent = 'Resume'; return; }
    sBase = performance.now(); sRun = true; sGo.textContent = 'Pause';
  });
  $('[data-sw-lap]').addEventListener('click', () => { if (sRun || sElapsed) laps.insertAdjacentHTML('afterbegin', `<li>${sOut.textContent}</li>`); });
  $('[data-sw-reset]').addEventListener('click', () => { sRun = false; sElapsed = 0; sGo.textContent = 'Start'; laps.innerHTML = ''; sOut.textContent = sFmt(0); });

  // Alarms
  const list = $('[data-alarm-list]');
  const paintAlarms = () => {
    const alarms = store.get('alarms', []);
    list.innerHTML = alarms.length ? alarms.map((a) => `<div class="list-row"><label class="grow"><input type="checkbox" data-alarm-toggle="${a.id}" ${a.on ? 'checked' : ''} /> <strong>${a.time}</strong> ${esc(a.label)}</label><button class="chip" data-alarm-del="${a.id}" aria-label="Delete alarm">✕</button></div>`).join('') : '<p class="hint">No alarms yet.</p>';
  };
  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-alarm-del]');
    if (del) { store.set('alarms', store.get('alarms', []).filter((a) => String(a.id) !== del.dataset.alarmDel)); paintAlarms(); }
  });
  list.addEventListener('change', (e) => {
    const id = e.target.dataset.alarmToggle;
    if (id) store.set('alarms', store.get('alarms', []).map((a) => (String(a.id) === id ? { ...a, on: e.target.checked } : a)));
  });
  $('[data-alarm-add]').addEventListener('click', () => {
    const time = $('[data-alarm-time]').value;
    if (!time) return;
    store.set('alarms', [...store.get('alarms', []), { id: Date.now(), time, label: $('[data-alarm-label]').value.trim(), on: true }].sort((a, b) => a.time.localeCompare(b.time)));
    $('[data-alarm-label]').value = ''; paintAlarms();
  });
  paintAlarms();

  sheetTick = window.setInterval(() => {
    paintWorld();
    if (sRun) sOut.textContent = sFmt(sElapsed + performance.now() - sBase);
    if (tRun) {
      const left = tEnd - Date.now(); tOut.textContent = fmt(left);
      if (left <= 0) { tRun = false; tGo.textContent = 'Start'; beep(4); toast('⏱ Timer finished'); setFromInputs(); }
    }
  }, 100);
}

function evalExpr(src) {
  const tokens = src.match(/\d*\.?\d+|[-+*/^%()]/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(); const r = term(); v = o === '+' ? v + r : v - r; } return v; };
  const term = () => { let v = power(); while (['*', '/', '%'].includes(peek())) { const o = next(); const r = power(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } return v; };
  const power = () => { const b = unary(); if (peek() === '^') { next(); return b ** power(); } return b; };
  const unary = () => { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return atom(); };
  const atom = () => {
    const x = next();
    if (x === '(') { const v = expr(); if (next() !== ')') throw new Error('paren'); return v; }
    if (x === undefined || Number.isNaN(Number(x))) throw new Error('syntax');
    return Number(x);
  };
  const result = expr();
  if (i < tokens.length || !Number.isFinite(result)) throw new Error('invalid');
  return parseFloat(result.toPrecision(12));
}

function hydrateCalculator() {
  const display = $('[data-calculator-display]'); const preview = $('[data-calc-result]'); const hist = $('[data-calc-history]');
  const paintHistory = () => {
    const items = store.get('calc-history', []);
    hist.innerHTML = items.length ? items.map((h, n) => `<button class="list-row hist-item" data-hist="${n}">${esc(h.q)} <strong>= ${esc(h.a)}</strong></button>`).join('') : '<p class="hint">Calculations appear here.</p>';
  };
  const live = () => { try { preview.textContent = display.value ? `= ${evalExpr(display.value)}` : '\u00a0'; } catch { preview.textContent = '\u00a0'; } };
  const commit = () => {
    if (!display.value) return;
    try {
      const answer = String(evalExpr(display.value));
      store.set('calc-history', [{ q: display.value, a: answer }, ...store.get('calc-history', [])].slice(0, 12));
      display.value = answer; preview.textContent = '\u00a0'; paintHistory();
    } catch { preview.textContent = 'Check your expression'; }
  };
  const press = (k) => {
    if (k === 'C') display.value = '';
    else if (k === '⌫') display.value = display.value.slice(0, -1);
    else if (k === '=') return commit();
    else display.value += k;
    live();
  };
  $$('[data-calc-key]').forEach((b) => b.addEventListener('click', () => press(b.dataset.calcKey)));
  display.addEventListener('input', () => { display.value = display.value.replace(/[^0-9.+\-*/^%()]/g, ''); live(); });
  display.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); display.value = ''; live(); } });
  hist.addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) { display.value = store.get('calc-history', [])[+b.dataset.hist].a; live(); display.focus(); } });
  $('[data-calc-clear]').addEventListener('click', () => { store.set('calc-history', []); paintHistory(); });
  paintHistory(); display.focus();
}

const unitSets = {
  Length: { Meters: 1, Kilometers: 1000, Centimeters: 0.01, Miles: 1609.344, Feet: 0.3048, Inches: 0.0254, Yards: 0.9144 },
  Weight: { Kilograms: 1, Grams: 0.001, Pounds: 0.45359237, Ounces: 0.028349523, Tonnes: 1000 },
  Temperature: { Celsius: 'C', Fahrenheit: 'F', Kelvin: 'K' },
  Data: { Bytes: 1, Kilobytes: 1024, Megabytes: 1024 ** 2, Gigabytes: 1024 ** 3, Terabytes: 1024 ** 4 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, Knots: 0.514444 },
  Time: { Seconds: 1, Minutes: 60, Hours: 3600, Days: 86400, Weeks: 604800 },
};

function convertUnits(cat, value, from, to) {
  if (cat === 'Temperature') {
    const c = { C: value, F: (value - 32) * 5 / 9, K: value - 273.15 }[unitSets[cat][from]];
    return { C: c, F: c * 9 / 5 + 32, K: c + 273.15 }[unitSets[cat][to]];
  }
  return (value * unitSets[cat][from]) / unitSets[cat][to];
}

function hydrateConverter() {
  const input = $('[data-converter-input]'); const from = $('[data-converter-from]'); const to = $('[data-converter-to]'); const out = $('[data-converter-output]'); const cats = $('[data-conv-cats]');
  let cat = store.get('conv-cat', 'Length');
  const run = () => {
    const r = convertUnits(cat, Number(input.value || 0), from.value, to.value);
    out.textContent = Number.isFinite(r) ? `${r.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to.value}` : '—';
  };
  const load = () => {
    const names = Object.keys(unitSets[cat]);
    const opts = names.map((n) => `<option>${n}</option>`).join('');
    from.innerHTML = opts; to.innerHTML = opts; to.selectedIndex = Math.min(1, names.length - 1);
    cats.innerHTML = Object.keys(unitSets).map((c) => `<button class="tab ${c === cat ? 'is-on' : ''}" data-cat="${c}">${c}</button>`).join('');
    run();
  };
  cats.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; store.set('conv-cat', cat); load(); } });
  [input, from, to].forEach((c) => c.addEventListener('input', run));
  $('[data-conv-swap]').addEventListener('click', () => { [from.value, to.value] = [to.value, from.value]; run(); });
  $('[data-conv-copy]').addEventListener('click', () => { navigator.clipboard?.writeText(out.textContent); toast('Result copied'); });
  load();
}

function hydrateNotepad() {
  const field = $('[data-notepad-field]'); const status = $('[data-note-status]');
  field.value = store.get('note', '# WizOS Notes\n\n- Capture ideas\n- Draft utility logic\n');
  let timer;
  const stats = () => {
    const words = (field.value.trim().match(/\S+/g) || []).length;
    $('[data-note-words]').textContent = words; $('[data-note-count]').textContent = field.value.length.toLocaleString(); $('[data-note-read]').textContent = Math.max(0, Math.ceil(words / 220));
  };
  field.addEventListener('input', () => {
    stats(); status.textContent = 'Saving…';
    clearTimeout(timer); timer = setTimeout(() => { store.set('note', field.value); status.textContent = 'Saved'; }, 400);
  });
  $('[data-note-copy]').addEventListener('click', () => { navigator.clipboard?.writeText(field.value); toast('Note copied'); });
  $('[data-note-clear]').addEventListener('click', () => { if (window.confirm('Clear this note?')) { field.value = ''; store.set('note', ''); stats(); } });
  $('[data-note-save]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([field.value], { type: 'text/plain' })); a.download = 'wizos-note.txt'; a.click(); URL.revokeObjectURL(a.href);
  });
  stats();
}

function hydrateTasks() {
  const input = $('[data-task-input]'); const list = $('[data-task-list]');
  const paint = () => {
    const tasks = store.get('tasks', []); const done = tasks.filter((t) => t.done).length;
    list.innerHTML = tasks.map((t) => `<div class="list-row"><label class="grow ${t.done ? 'is-done' : ''}"><input type="checkbox" data-task-toggle="${t.id}" ${t.done ? 'checked' : ''} /> ${esc(t.text)}</label><button class="chip" data-task-del="${t.id}" aria-label="Delete task">✕</button></div>`).join('') || '<p class="hint">Nothing here — add your first task.</p>';
    $('[data-task-bar]').style.setProperty('--progress', `${tasks.length ? (done / tasks.length) * 100 : 0}%`);
    $('[data-task-stat]').textContent = `${done} of ${tasks.length} completed`;
  };
  const add = () => { const text = input.value.trim(); if (!text) return; store.set('tasks', [...store.get('tasks', []), { id: Date.now(), text, done: false }]); input.value = ''; paint(); };
  $('[data-task-add]').addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  list.addEventListener('change', (e) => { const id = e.target.dataset.taskToggle; if (id) { store.set('tasks', store.get('tasks', []).map((t) => (String(t.id) === id ? { ...t, done: e.target.checked } : t))); paint(); } });
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-task-del]'); if (b) { store.set('tasks', store.get('tasks', []).filter((t) => String(t.id) !== b.dataset.taskDel)); paint(); } });
  $('[data-task-clean]').addEventListener('click', () => { store.set('tasks', store.get('tasks', []).filter((t) => !t.done)); paint(); });
  paint(); input.focus();
}

function hydratePassword() {
  const out = $('[data-pw-out]'); const len = $('[data-pw-len]');
  const generate = () => {
    const pools = $$('[data-pw-opt]').filter((c) => c.checked).map((c) => c.dataset.pwOpt);
    if (!pools.length) { out.textContent = 'Select at least one set'; return; }
    const all = pools.join(''); const n = +len.value;
    const rand = (max) => { const buf = new Uint32Array(1); let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= 4294967296 - (4294967296 % max)); return v % max; };
    const chars = pools.map((p) => p[rand(p.length)]);
    while (chars.length < n) chars.push(all[rand(all.length)]);
    for (let i = chars.length - 1; i > 0; i -= 1) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    out.textContent = chars.join('');
    const bits = n * Math.log2(all.length);
    $('[data-pw-bar]').style.setProperty('--progress', `${Math.min(100, (bits / 128) * 100)}%`);
    $('[data-pw-strength]').textContent = `${bits < 50 ? 'Weak' : bits < 80 ? 'Fair' : bits < 110 ? 'Strong' : 'Excellent'} · ~${Math.round(bits)} bits of entropy`;
  };
  len.addEventListener('input', () => { $('[data-pw-lenval]').textContent = len.value; generate(); });
  $$('[data-pw-opt]').forEach((c) => c.addEventListener('change', generate));
  $('[data-pw-gen]').addEventListener('click', generate);
  $('[data-pw-copy]').addEventListener('click', () => { navigator.clipboard?.writeText(out.textContent); toast('Password copied'); });
  generate();
}

const hydrators = { clock: hydrateClock, calculator: hydrateCalculator, converter: hydrateConverter, notepad: hydrateNotepad, tasks: hydrateTasks, password: hydratePassword };

let activeDevice = 'Computer';
let currentAppKey = null;
const runningApps = new Set();
const appHistory = [];

const stages = {
  landing: landingStage,
  device: deviceStage,
  desktop: desktopStage,
};

function switchStage(stageName) {
  Object.entries(stages).forEach(([name, stage]) => {
    const isActive = name === stageName;
    stage.classList.toggle('is-active', isActive);
    stage.setAttribute('aria-hidden', String(!isActive));
  });
}

function showDeviceSelection(event) {
  event?.preventDefault();
  switchStage('device');
}

function updateClock() {
  const now = new Date();
  const formatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  clockDisplay.textContent = formatted;
  clockDisplay.dateTime = now.toISOString();
  document.querySelectorAll('[data-live-clock]').forEach((node) => {
    node.textContent = formatted;
  });
}

function launchDesktop(device) {
  activeDevice = device;
  systemMode.textContent = `WizOS - ${device} Mode`;
  closeTaskSwitcher();
  closeActiveSheet({ clearHistory: true });
  switchStage('desktop');
}

function resetSystem() {
  runningApps.clear();
  appHistory.length = 0;
  currentAppKey = null;
  appSheetLayer.innerHTML = '';
  appSheetLayer.classList.remove('is-open');
  appSheetLayer.setAttribute('aria-hidden', 'true');
  activeDevice = 'Computer';
  systemMode.textContent = 'WizOS - Computer Mode';
  closeTaskSwitcher();
  renderTaskSwitcher();
  switchStage('landing');
}

function openApp(appKey, options = {}) {
  const app = appRegistry[appKey];
  if (!app) return;

  const shouldTrackHistory = options.trackHistory !== false;
  if (currentAppKey && currentAppKey !== appKey && shouldTrackHistory) {
    appHistory.push(currentAppKey);
  }

  runningApps.add(appKey);
  currentAppKey = appKey;
  appSheetLayer.innerHTML = createAppSheetMarkup(appKey, app);
  appSheetLayer.classList.add('is-open');
  appSheetLayer.setAttribute('aria-hidden', 'false');

  const sheet = appSheetLayer.querySelector('.app-sheet');
  requestAnimationFrame(() => sheet.classList.add('is-active'));
  hydrateAppSheet(appKey);
  renderTaskSwitcher();
}

function createAppSheetMarkup(appKey, app) {
  return `
    <article class="app-sheet" data-active-app="${appKey}" role="dialog" aria-modal="true" aria-label="${app.title}">
      <header class="sheet-header">
        <span class="sheet-app-icon ${app.theme}"><i class="${app.icon}" aria-hidden="true"></i></span>
        <div class="sheet-title-group">
          <h2>${app.title}</h2>
          <p>${app.subtitle}</p>
        </div>
      </header>
      <div class="sheet-body">${app.body()}</div>
    </article>
  `;
}

function closeActiveSheet(options = {}) {
  const sheet = appSheetLayer.querySelector('.app-sheet');
  if (options.clearHistory) {
    appHistory.length = 0;
  }
  currentAppKey = null;

  if (!sheet) {
    appSheetLayer.classList.remove('is-open');
    appSheetLayer.setAttribute('aria-hidden', 'true');
    return;
  }

  sheet.classList.remove('is-active');
  window.setTimeout(() => {
    if (!currentAppKey) {
      appSheetLayer.innerHTML = '';
      appSheetLayer.classList.remove('is-open');
      appSheetLayer.setAttribute('aria-hidden', 'true');
    }
  }, 420);
}

function goBack() {
  closeTaskSwitcher();
  if (!currentAppKey) return;

  const previousApp = appHistory.pop();
  if (previousApp) {
    openApp(previousApp, { trackHistory: false });
    return;
  }

  closeActiveSheet();
  renderTaskSwitcher();
}

function goHome() {
  closeTaskSwitcher();
  closeActiveSheet({ clearHistory: true });
  renderTaskSwitcher();
}

function toggleTaskSwitcher() {
  const willOpen = !taskSwitcher.classList.contains('is-open');
  taskSwitcher.classList.toggle('is-open', willOpen);
  taskSwitcher.setAttribute('aria-hidden', String(!willOpen));
  stacksButton.classList.toggle('is-active', willOpen);
  if (willOpen) {
    renderTaskSwitcher();
  }
}

function closeTaskSwitcher() {
  taskSwitcher.classList.remove('is-open');
  taskSwitcher.setAttribute('aria-hidden', 'true');
  stacksButton.classList.remove('is-active');
}

function renderTaskSwitcher() {
  if (!runningApps.size) {
    taskStackList.innerHTML = '<div class="empty-stacks">No running utilities yet. Launch a WizOS tool from the grid to build your stack.</div>';
    return;
  }

  taskStackList.innerHTML = [...runningApps].map((appKey) => {
    const app = appRegistry[appKey];
    const currentClass = appKey === currentAppKey ? ' is-current' : '';
    return `
      <article class="stack-card${currentClass}" data-stack-app="${appKey}" role="button" tabindex="0" aria-label="Switch to ${app.title}">
        <span class="stack-card-icon ${app.theme}"><i class="${app.icon}" aria-hidden="true"></i></span>
        <span><strong>${app.title}</strong><small>${app.subtitle}</small></span>
        <button class="terminate-app-btn" type="button" data-terminate-app="${appKey}" aria-label="Close ${app.title}">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </article>
    `;
  }).join('');

  taskStackList.querySelectorAll('[data-stack-app]').forEach((card) => {
    card.addEventListener('click', () => {
      openApp(card.dataset.stackApp);
      closeTaskSwitcher();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openApp(card.dataset.stackApp);
      closeTaskSwitcher();
    });
  });

  taskStackList.querySelectorAll('[data-terminate-app]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      terminateApp(button.dataset.terminateApp);
    });
  });
}

function terminateApp(appKey) {
  runningApps.delete(appKey);

  for (let index = appHistory.length - 1; index >= 0; index -= 1) {
    if (appHistory[index] === appKey) {
      appHistory.splice(index, 1);
    }
  }

  if (currentAppKey === appKey) {
    closeActiveSheet();
  }

  renderTaskSwitcher();
}

function hydrateAppSheet(appKey) {
  window.clearInterval(sheetTick);
  if (appKey === 'ai') hydrateAiAssistant();
  else hydrators[appKey]?.();
  updateClock();
}

function hydrateAiAssistant() {
  const form = appSheetLayer.querySelector('[data-chat-form]');
  const input = appSheetLayer.querySelector('[data-chat-input]');
  const log = appSheetLayer.querySelector('[data-chat-log]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    appendMessage(log, message, 'user');
    input.value = '';

    window.setTimeout(() => {
      const reply = createAssistantReply(message);
      appendMessage(log, reply, 'system');
    }, 650);
  });

  input.focus();
}

function appendMessage(log, text, type) {
  const bubble = document.createElement('div');
  bubble.className = `message ${type}`;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
}

function createAssistantReply(message) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('video')) {
    return 'Video Studio is ready as a full-sheet production surface. Next we can connect prompts, scenes, render presets, and asset exports.';
  }
  if (lowerMessage.includes('audio') || lowerMessage.includes('music') || lowerMessage.includes('voice')) {
    return 'Audio Studio is staged for voice, music, and mastering workflows. We can wire generation controls into the production panel next.';
  }
  if (lowerMessage.includes('clock') || lowerMessage.includes('time')) {
    return `The current ${activeDevice} mode system time is ${clockDisplay.textContent}. Alarm and timer modules are ready to extend.`;
  }
  if (lowerMessage.includes('calculator') || lowerMessage.includes('calculate')) {
    return 'Calculator is available in Stacks or from Home for quick arithmetic, formulas, and diagnostic checks.';
  }
  if (lowerMessage.includes('convert') || lowerMessage.includes('unit')) {
    return 'Converter is prepared for unit scaling and translation workspaces, with the baseline length converter active now.';
  }
  if (lowerMessage.includes('note') || lowerMessage.includes('notepad')) {
    return 'Notepad can capture your text, code snippets, checklists, and next actions directly inside WizOS.';
  }
  return 'I captured that. This local WizOS shell can be upgraded with model-backed intelligence, tool calls, memory, and media generation workflows.';
}

getStartedBtn.addEventListener('click', showDeviceSelection, { passive: false });
backButton.addEventListener('click', goBack);
homeButton.addEventListener('click', goHome);
stacksButton.addEventListener('click', toggleTaskSwitcher);
closeStacksBtn.addEventListener('click', closeTaskSwitcher);

document.querySelectorAll('[data-device]').forEach((button) => {
  button.addEventListener('click', () => launchDesktop(button.dataset.device));
});

document.querySelectorAll('[data-app]').forEach((button) => {
  button.addEventListener('click', () => openApp(button.dataset.app));
});

updateClock();
renderTaskSwitcher();
window.setInterval(updateClock, 1000);
window.setInterval(checkAlarms, 1000);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && currentAppKey) goHome(); });
