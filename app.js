const landingStage = document.querySelector('#landingStage');
const deviceStage = document.querySelector('#deviceStage');
const desktopStage = document.querySelector('#desktopStage');
const systemMode = document.querySelector('#systemMode');
const clockDisplay = document.querySelector('#clockDisplay');
const windowLayer = document.querySelector('#windowLayer');
const powerButton = document.querySelector('#powerButton');
const getStartedBtn = document.querySelector('#getStartedBtn');

const appRegistry = {
  clock: {
    title: 'Clock Command Center',
    icon: 'fa-solid fa-clock',
    body: () => `
      <section class="dashboard-grid" aria-label="Clock dashboard">
        <article class="dashboard-card wide">
          <h3>Live Local Time</h3>
          <p>Always-on timing module ready for alarms, world clocks, and schedules.</p>
          <div class="big-metric" data-live-clock>--:--:--</div>
        </article>
        <article class="dashboard-card">
          <h3>Next Alarm</h3>
          <p>Attach alarm logic here with repeat patterns, tone packs, and smart labels.</p>
        </article>
        <article class="dashboard-card">
          <h3>Focus Timer</h3>
          <p>Placeholder for Pomodoro sessions, productivity streaks, and break reminders.</p>
        </article>
      </section>
    `,
  },
  video: {
    title: 'Video Maker Studio',
    icon: 'fa-solid fa-video',
    body: () => `
      <section class="dashboard-grid" aria-label="Video maker dashboard">
        <article class="dashboard-card wide">
          <h3>Render Pipeline</h3>
          <p>Future home for prompt-to-video generation, storyboard control, and export presets.</p>
          <div class="progress-rail" aria-label="Render readiness"><span class="progress-fill"></span></div>
        </article>
        <article class="dashboard-card">
          <h3>Scene Builder</h3>
          <p>Structured drop zone for shots, captions, transitions, aspect ratios, and effects.</p>
        </article>
        <article class="dashboard-card">
          <h3>Asset Library</h3>
          <p>Connect generated clips, overlays, b-roll, and templates in a reusable library.</p>
        </article>
      </section>
    `,
  },
  audio: {
    title: 'Audio Maker Lab',
    icon: 'fa-solid fa-music',
    body: () => `
      <section class="dashboard-grid" aria-label="Audio maker dashboard">
        <article class="dashboard-card wide">
          <h3>Sonic Workbench</h3>
          <p>Prepared for text-to-music, voiceover generation, sound design, and mastering flows.</p>
          <div class="progress-rail" aria-label="Audio readiness"><span class="progress-fill"></span></div>
        </article>
        <article class="dashboard-card">
          <h3>Voice Profiles</h3>
          <p>Reserved area for narration settings, language controls, and character voices.</p>
        </article>
        <article class="dashboard-card">
          <h3>Mix Console</h3>
          <p>Future controls for stems, levels, ambience, compression, and final delivery.</p>
        </article>
      </section>
    `,
  },
  ai: {
    title: 'AI Assistant',
    icon: 'fa-solid fa-brain',
    body: () => `
      <section class="chat-panel" aria-label="AI assistant chat">
        <div class="chat-log" data-chat-log>
          <div class="message system">Welcome to Tech And Tools AI. I can help plan, summarize, and prototype your next creative workflow.</div>
        </div>
        <form class="chat-form" data-chat-form>
          <input data-chat-input type="text" autocomplete="off" placeholder="Ask the assistant anything..." aria-label="Message the AI assistant" />
          <button type="submit" aria-label="Send message"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
        </form>
      </section>
    `,
  },
};

let windowOffset = 0;
let activeDevice = 'Computer';

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
  switchStage('desktop');
}

function resetSystem() {
  windowLayer.innerHTML = '';
  windowOffset = 0;
  activeDevice = 'Computer';
  systemMode.textContent = 'WizOS - Computer Mode';
  switchStage('landing');
}

function openApp(appKey) {
  const app = appRegistry[appKey];
  if (!app) return;

  const existingWindow = windowLayer.querySelector(`[data-window="${appKey}"]`);
  if (existingWindow) {
    focusWindow(existingWindow);
    return;
  }

  const windowElement = document.createElement('article');
  windowElement.className = 'os-window';
  windowElement.dataset.window = appKey;
  windowElement.setAttribute('role', 'dialog');
  windowElement.setAttribute('aria-label', app.title);
  windowElement.style.marginLeft = `${windowOffset}px`;
  windowElement.style.marginTop = `${windowOffset}px`;
  windowOffset = (windowOffset + 26) % 104;

  windowElement.innerHTML = `
    <header class="window-titlebar">
      <i class="${app.icon}" aria-hidden="true"></i>
      <h2>${app.title}</h2>
      <button class="close-window" type="button" aria-label="Close ${app.title}">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </header>
    <div class="window-body">${app.body()}</div>
  `;

  windowLayer.appendChild(windowElement);
  requestAnimationFrame(() => windowElement.classList.add('is-open'));
  focusWindow(windowElement);
  hydrateWindow(windowElement, appKey);
}

function focusWindow(windowElement) {
  const maxZ = [...windowLayer.children].reduce((max, child) => {
    return Math.max(max, Number(child.style.zIndex || 30));
  }, 30);
  windowElement.style.zIndex = String(maxZ + 1);
  windowElement.classList.add('is-open');
}

function closeWindow(windowElement) {
  windowElement.classList.remove('is-open');
  windowElement.addEventListener('transitionend', () => windowElement.remove(), { once: true });
}

function hydrateWindow(windowElement, appKey) {
  windowElement.querySelector('.close-window').addEventListener('click', () => closeWindow(windowElement));
  windowElement.addEventListener('pointerdown', () => focusWindow(windowElement));

  if (appKey === 'ai') {
    const form = windowElement.querySelector('[data-chat-form]');
    const input = windowElement.querySelector('[data-chat-input]');
    const log = windowElement.querySelector('[data-chat-log]');

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
    return 'Video Maker is ready as a production shell. Next we can connect prompts, scenes, render presets, and asset exports.';
  }
  if (lowerMessage.includes('audio') || lowerMessage.includes('music')) {
    return 'Audio Maker is staged for voice, music, and mastering workflows. We can wire generation controls into the dashboard next.';
  }
  if (lowerMessage.includes('clock') || lowerMessage.includes('time')) {
    return `The current ${activeDevice} mode system time is ${clockDisplay.textContent}. Alarm and timer modules are ready to extend.`;
  }
  return 'I captured that. This local shell can be upgraded with model-backed intelligence, tool calls, memory, and media generation workflows.';
}

getStartedBtn.addEventListener('click', showDeviceSelection, { passive: false });

document.querySelectorAll('[data-device]').forEach((button) => {
  button.addEventListener('click', () => launchDesktop(button.dataset.device));
});

document.querySelectorAll('[data-app]').forEach((button) => {
  button.addEventListener('click', () => openApp(button.dataset.app));
});

powerButton.addEventListener('click', resetSystem);

updateClock();
window.setInterval(updateClock, 1000);
