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
      <button class="stack-card${currentClass}" type="button" data-stack-app="${appKey}">
        <span class="stack-card-icon ${app.theme}"><i class="${app.icon}" aria-hidden="true"></i></span>
        <span><strong>${app.title}</strong><small>${app.subtitle}</small></span>
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    `;
  }).join('');

  taskStackList.querySelectorAll('[data-stack-app]').forEach((button) => {
    button.addEventListener('click', () => {
      openApp(button.dataset.stackApp);
      closeTaskSwitcher();
    });
  });
}

function hydrateAppSheet(appKey) {
  if (appKey === 'ai') hydrateAiAssistant();
  if (appKey === 'calculator') hydrateCalculator();
  if (appKey === 'converter') hydrateConverter();
  if (appKey === 'notepad') hydrateNotepad();
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

function hydrateCalculator() {
  const display = appSheetLayer.querySelector('[data-calculator-display]');
  let expression = '';

  appSheetLayer.querySelectorAll('[data-calc-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.calcKey;
      if (key === 'C') {
        expression = '';
        display.value = '0';
        return;
      }
      if (key === '=') {
        try {
          const sanitized = expression.replace(/[^0-9.+\-*/()]/g, '');
          display.value = sanitized ? String(Function(`"use strict"; return (${sanitized})`)()) : '0';
          expression = display.value;
        } catch {
          display.value = 'Error';
          expression = '';
        }
        return;
      }
      expression += key;
      display.value = expression;
    });
  });
}

function hydrateConverter() {
  const input = appSheetLayer.querySelector('[data-converter-input]');
  const from = appSheetLayer.querySelector('[data-converter-from]');
  const to = appSheetLayer.querySelector('[data-converter-to]');
  const output = appSheetLayer.querySelector('[data-converter-output]');
  const metersPerUnit = {
    meters: 1,
    feet: 0.3048,
    inches: 0.0254,
    kilometers: 1000,
  };

  const convert = () => {
    const value = Number(input.value || 0);
    const meters = value * metersPerUnit[from.value];
    const result = meters / metersPerUnit[to.value];
    output.textContent = Number.isFinite(result) ? result.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
  };

  [input, from, to].forEach((control) => control.addEventListener('input', convert));
  [from, to].forEach((control) => control.addEventListener('change', convert));
  convert();
}

function hydrateNotepad() {
  const field = appSheetLayer.querySelector('[data-notepad-field]');
  const count = appSheetLayer.querySelector('[data-note-count]');
  const updateCount = () => {
    count.textContent = field.value.length.toLocaleString();
  };
  field.addEventListener('input', updateCount);
  updateCount();
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
