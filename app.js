/* WizOS workspace: tool library + block canvas. All processing runs in the browser. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`wizos:${k}`)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`wizos:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const copy = (t) => { navigator.clipboard?.writeText(t); toast('Copied'); };
const loaded = {};
const loadScript = (url) => (loaded[url] ||= new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('Could not load library (check your connection)')); document.head.append(s);
}));
function toast(msg) {
  let box = $('.toast-box');
  if (!box) { box = document.createElement('div'); box.className = 'toast-box'; box.setAttribute('role', 'status'); document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.append(t); setTimeout(() => t.remove(), 3000);
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const dropHtml = (label) => `<div class="drop" tabindex="0"><i class="fa-solid fa-cloud-arrow-up"></i><span>${label}</span><input type="file" hidden /></div>`;
function wireDrop(el, cb, accept) {
  const d = $('.drop', el); const i = $('input', d);
  i.accept = accept; i.multiple = true;
  d.onclick = () => i.click();
  d.onkeydown = (e) => { if (e.key === 'Enter') i.click(); };
  i.onchange = () => { cb([...i.files]); i.value = ''; };
  d.ondragover = (e) => { e.preventDefault(); d.classList.add('over'); };
  d.ondragleave = () => d.classList.remove('over');
  d.ondrop = (e) => { e.preventDefault(); d.classList.remove('over'); cb([...e.dataTransfer.files]); };
}

/* ---------- Tools ---------- */
function imageTool(el) {
  el.innerHTML = `${dropHtml('Drop images here or click to choose')}
    <div class="row"><label>Quality <input type="range" min="10" max="100" value="75" data-q /> <b data-qv>75</b>%</label>
      <select class="select-field" data-fmt aria-label="Output format"><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG (lossless)</option></select>
      <input class="field" type="number" min="16" data-w placeholder="Max width px" aria-label="Max width" /></div>
    <div class="list" data-out></div>`;
  const q = $('[data-q]', el); const fmt = $('[data-fmt]', el); const mw = $('[data-w]', el); const out = $('[data-out]', el);
  let files = []; let tok = 0;
  const run = async () => {
    const t = ++tok; const rows = [];
    for (const f of files) {
      try {
        const bmp = await createImageBitmap(f);
        const w = +mw.value > 0 ? Math.min(+mw.value, bmp.width) : bmp.width; const h = Math.round((bmp.height * w) / bmp.width);
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
        const blob = await new Promise((r) => c.toBlob(r, fmt.value, q.value / 100));
        const ext = fmt.value.split('/')[1].replace('jpeg', 'jpg'); const url = URL.createObjectURL(blob);
        const pct = Math.round((1 - blob.size / f.size) * 100);
        rows.push(`<div class="list-row"><img class="thumb" src="${url}" alt="" /><span class="grow">${esc(f.name)}<br /><small>${fmtBytes(f.size)} → ${fmtBytes(blob.size)} (${Math.abs(pct)}% ${pct >= 0 ? 'smaller' : 'larger'}) · ${w}×${h}</small></span><a class="btn primary" download="${esc(f.name.replace(/\.[^.]+$/, ''))}-wiz.${ext}" href="${url}">Save</a></div>`);
      } catch { rows.push(`<div class="list-row">Could not read ${esc(f.name)}</div>`); }
    }
    if (t === tok) out.innerHTML = rows.join('');
  };
  wireDrop(el, (fs) => { files = fs.filter((f) => f.type.startsWith('image/')); run(); }, 'image/*');
  [q, fmt, mw].forEach((c) => c.addEventListener('input', () => { $('[data-qv]', el).textContent = q.value; if (files.length) run(); }));
}

function parseRange(text, n) {
  const idx = [];
  text.split(',').forEach((part) => {
    const [a, b = a] = part.trim().split('-').map((x) => parseInt(x, 10));
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    for (let p = Math.max(1, Math.min(a, b)); p <= Math.min(n, Math.max(a, b)); p += 1) if (!idx.includes(p - 1)) idx.push(p - 1);
  });
  return idx;
}

function pdfTool(el) {
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="merge">Merge</button><button class="tab" data-m="split">Split / Extract</button></div>
    ${dropHtml('Drop PDF files here or click to choose')}<div class="list" data-files></div>
    <div class="row" data-splitrow hidden><input class="field grow" data-range placeholder="Pages to extract, e.g. 1-3, 5, 8-10" /></div>
    <div class="row"><button class="btn primary" data-go>Merge PDFs</button><span class="hint" data-msg></span></div>`;
  let mode = 'merge'; let files = [];
  const msg = (t) => { $('[data-msg]', el).textContent = t; };
  const paint = () => { $('[data-files]', el).innerHTML = files.map((f, i) => `<div class="list-row"><span class="grow">${esc(f.name)} <small>${fmtBytes(f.size)}</small></span><button class="chip" data-up="${i}" aria-label="Move up">↑</button><button class="chip" data-rm="${i}" aria-label="Remove">✕</button></div>`).join(''); };
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => {
    mode = t.dataset.m; $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t));
    if (mode === 'split') files = files.slice(0, 1);
    $('[data-splitrow]', el).hidden = mode !== 'split'; $('[data-go]', el).textContent = mode === 'merge' ? 'Merge PDFs' : 'Extract pages'; msg(''); paint();
  }));
  $('[data-files]', el).addEventListener('click', (e) => {
    const up = e.target.closest('[data-up]'); const rm = e.target.closest('[data-rm]');
    if (up && +up.dataset.up > 0) { const i = +up.dataset.up; [files[i - 1], files[i]] = [files[i], files[i - 1]]; }
    if (rm) files.splice(+rm.dataset.rm, 1);
    paint();
  });
  wireDrop(el, (fs) => { const pdfs = fs.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)); files = mode === 'split' ? pdfs.slice(0, 1) : [...files, ...pdfs]; paint(); }, 'application/pdf');
  $('[data-go]', el).addEventListener('click', async () => {
    try {
      if (mode === 'merge' && files.length < 2) return msg('Add at least 2 PDFs.');
      if (mode === 'split' && !files.length) return msg('Add a PDF first.');
      msg('Working…'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
      const { PDFDocument } = window.PDFLib; const out = await PDFDocument.create();
      if (mode === 'merge') {
        for (const f of files) { const s = await PDFDocument.load(await f.arrayBuffer()); (await out.copyPages(s, s.getPageIndices())).forEach((p) => out.addPage(p)); }
      } else {
        const s = await PDFDocument.load(await files[0].arrayBuffer()); const idx = parseRange($('[data-range]', el).value, s.getPageCount());
        if (!idx.length) return msg(`Enter valid pages (1–${s.getPageCount()}).`);
        (await out.copyPages(s, idx)).forEach((p) => out.addPage(p));
      }
      download(new Blob([await out.save()], { type: 'application/pdf' }), mode === 'merge' ? 'merged.pdf' : 'extracted.pdf'); msg('Done — file downloaded.');
    } catch (err) { msg(err.message.includes('encrypt') ? 'This PDF is encrypted or damaged.' : err.message); }
  });
}

function qrTool(el) {
  el.innerHTML = `<textarea class="textarea-panel small" data-t placeholder="URL, text, Wi-Fi string…" aria-label="QR content">https://</textarea>
    <div class="row"><select class="select-field" data-s aria-label="Size"><option value="192">Small</option><option value="256" selected>Medium</option><option value="384">Large</option></select>
    <button class="btn primary" data-dl>Download PNG</button><span class="hint" data-msg></span></div><div class="qr-box" data-qr></div>`;
  const box = $('[data-qr]', el);
  const make = async () => {
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
      box.innerHTML = ''; const text = $('[data-t]', el).value.trim(); const s = +$('[data-s]', el).value;
      if (text) new window.QRCode(box, { text, width: s, height: s, correctLevel: window.QRCode.CorrectLevel.M });
    } catch (err) { $('[data-msg]', el).textContent = err.message; }
  };
  $('[data-t]', el).addEventListener('input', make); $('[data-s]', el).addEventListener('change', make);
  $('[data-dl]', el).addEventListener('click', () => { const c = $('canvas', box); if (c) c.toBlob((b) => download(b, 'qr-code.png')); });
  make();
}

function wordTool(el) {
  el.innerHTML = `<textarea class="textarea-panel" data-t placeholder="Paste or type your text…" aria-label="Text to analyse"></textarea><div class="stat-grid" data-stats></div><div class="hint" data-kw></div>`;
  const t = $('[data-t]', el);
  const update = () => {
    const v = t.value; const words = v.match(/[\p{L}\p{N}'’-]+/gu) || [];
    const stats = { Words: words.length, Characters: v.length, 'No spaces': v.replace(/\s/g, '').length, Sentences: (v.match(/[^.!?]+[.!?]+/g) || (v.trim() ? [v] : [])).length, Paragraphs: v.split(/\n\s*\n/).filter((p) => p.trim()).length, 'Reading time': `${Math.ceil(words.length / 220)} min` };
    $('[data-stats]', el).innerHTML = Object.entries(stats).map(([k, n]) => `<div class="panel-card"><small>${k}</small><strong>${n}</strong></div>`).join('');
    const freq = {}; words.map((w) => w.toLowerCase()).filter((w) => w.length > 3).forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('[data-kw]', el).textContent = top.length ? `Top keywords: ${top.map(([w, n]) => `${w} (${((n / words.length) * 100).toFixed(1)}%)`).join(', ')}` : '';
  };
  t.addEventListener('input', update); update();
}

const W = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').match(/[\p{L}\p{N}]+/gu) || [];
const caseFns = {
  UPPERCASE: (s) => s.toUpperCase(), lowercase: (s) => s.toLowerCase(),
  'Title Case': (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()),
  'Sentence case': (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  camelCase: (s) => W(s).map((x, i) => (i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase())).join(''),
  snake_case: (s) => W(s).join('_').toLowerCase(), 'kebab-case': (s) => W(s).join('-').toLowerCase(),
};
function caseTool(el) {
  el.innerHTML = `<textarea class="textarea-panel small" data-t placeholder="Type or paste text…" aria-label="Text"></textarea>
    <div class="row">${Object.keys(caseFns).map((k) => `<button class="chip" data-c="${k}">${k}</button>`).join('')}</div><div class="row"><button class="btn" data-copy>Copy</button></div>`;
  const t = $('[data-t]', el);
  $$('[data-c]', el).forEach((b) => b.addEventListener('click', () => { t.value = caseFns[b.dataset.c](t.value); }));
  $('[data-copy]', el).addEventListener('click', () => copy(t.value));
}

function jsonTool(el) {
  el.innerHTML = `<textarea class="textarea-panel code" data-t placeholder='{"paste":"JSON here"}' aria-label="JSON"></textarea>
    <div class="row"><button class="btn primary" data-f>Format</button><button class="btn" data-m>Minify</button><button class="btn" data-copy>Copy</button><span class="hint grow" data-msg></span></div>`;
  const t = $('[data-t]', el); const msg = $('[data-msg]', el);
  const run = (space) => { try { t.value = JSON.stringify(JSON.parse(t.value), null, space); msg.textContent = '✓ Valid JSON'; } catch (e) { msg.textContent = `✗ ${e.message}`; } };
  $('[data-f]', el).addEventListener('click', () => run(2)); $('[data-m]', el).addEventListener('click', () => run(0));
  $('[data-copy]', el).addEventListener('click', () => copy(t.value));
}

function encodeTool(el) {
  el.innerHTML = `<textarea class="textarea-panel small" data-t placeholder="Input" aria-label="Input"></textarea>
    <div class="row"><button class="chip" data-a="b64e">Base64 encode</button><button class="chip" data-a="b64d">Base64 decode</button><button class="chip" data-a="ue">URL encode</button><button class="chip" data-a="ud">URL decode</button></div>
    <textarea class="textarea-panel small" data-o readonly placeholder="Output" aria-label="Output"></textarea><div class="row"><button class="btn" data-copy>Copy output</button></div>`;
  const acts = {
    b64e: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))),
    b64d: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))),
    ue: encodeURIComponent, ud: decodeURIComponent,
  };
  $$('[data-a]', el).forEach((b) => b.addEventListener('click', () => { try { $('[data-o]', el).value = acts[b.dataset.a]($('[data-t]', el).value); } catch { $('[data-o]', el).value = 'Invalid input for this operation.'; } }));
  $('[data-copy]', el).addEventListener('click', () => copy($('[data-o]', el).value));
}

function padTool(el) {
  el.innerHTML = `<textarea class="textarea-panel" data-t placeholder="Scratchpad — saves automatically in this browser…" aria-label="Scratchpad"></textarea><p class="hint" data-s>Saved</p>`;
  const t = $('[data-t]', el); t.value = store.get('scratchpad', ''); let timer;
  t.addEventListener('input', () => { $('[data-s]', el).textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(() => { store.set('scratchpad', t.value); $('[data-s]', el).textContent = 'Saved'; }, 350); });
}

const TOOLS = [
  { id: 'image', name: 'Image Compressor', icon: 'fa-image', group: 'Image & Media', render: imageTool },
  { id: 'pdf', name: 'PDF Merge & Split', icon: 'fa-file-pdf', group: 'PDF & Documents', render: pdfTool },
  { id: 'words', name: 'Word Counter', icon: 'fa-text-height', group: 'Text & Content', render: wordTool },
  { id: 'case', name: 'Case Converter', icon: 'fa-font', group: 'Text & Content', render: caseTool },
  { id: 'json', name: 'JSON Formatter', icon: 'fa-code', group: 'Developer', render: jsonTool },
  { id: 'encode', name: 'Base64 & URL', icon: 'fa-lock', group: 'Developer', render: encodeTool },
  { id: 'qr', name: 'QR Generator', icon: 'fa-qrcode', group: 'Quick Utilities', render: qrTool },
  { id: 'pad', name: 'Scratchpad', icon: 'fa-note-sticky', group: 'Quick Utilities', render: padTool },
];
const toolById = (id) => TOOLS.find((t) => t.id === id);

/* ---------- Block canvas ---------- */
let blocks = store.get('blocks', [{ id: 1, type: 'text', data: 'Welcome to WizOS.\nAdd notes, checklists and tools as blocks — everything saves automatically.' }]);
const saveBlocks = () => store.set('blocks', blocks);
let canvasRoot = null;
function addBlock(spec) { blocks.push({ id: Date.now(), data: spec.type === 'check' ? [] : '', ...spec }); saveBlocks(); renderCanvas(); }

function renderCanvas() {
  const c = canvasRoot; c.innerHTML = blocks.length ? '' : '<p class="hint">Empty canvas — use “Add block” to start.</p>';
  blocks.forEach((b, i) => {
    const tool = b.type === 'tool' ? toolById(b.tool) : null;
    if (b.type === 'tool' && !tool) return;
    const card = document.createElement('article'); card.className = 'block panel-card';
    card.innerHTML = `<header class="block-head"><strong>${b.type === 'text' ? 'Note' : b.type === 'check' ? 'Checklist' : esc(tool.name)}</strong><span><button class="chip" data-mv="-1" aria-label="Move up">↑</button><button class="chip" data-mv="1" aria-label="Move down">↓</button><button class="chip" data-rm aria-label="Delete block">✕</button></span></header><div class="block-body"></div>`;
    const body = $('.block-body', card);
    if (b.type === 'text') {
      const ta = document.createElement('textarea'); ta.className = 'textarea-panel small'; ta.value = b.data; ta.setAttribute('aria-label', 'Note');
      ta.addEventListener('input', () => { b.data = ta.value; saveBlocks(); }); body.append(ta);
    } else if (b.type === 'check') {
      const paint = () => {
        body.innerHTML = `${b.data.map((it, n) => `<div class="list-row"><label class="grow ${it.d ? 'is-done' : ''}"><input type="checkbox" data-n="${n}" ${it.d ? 'checked' : ''} /> ${esc(it.t)}</label><button class="chip" data-x="${n}" aria-label="Remove item">✕</button></div>`).join('')}<div class="row"><input class="field grow" placeholder="Add item, press Enter" aria-label="New item" /></div>`;
        $('input.field', body).onkeydown = (e) => { if (e.key === 'Enter' && e.target.value.trim()) { b.data.push({ t: e.target.value.trim(), d: false }); saveBlocks(); paint(); $('input.field', body).focus(); } };
      };
      body.addEventListener('change', (e) => { if (e.target.dataset.n) { b.data[+e.target.dataset.n].d = e.target.checked; saveBlocks(); paint(); } });
      body.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (x) { b.data.splice(+x.dataset.x, 1); saveBlocks(); paint(); } });
      paint();
    } else tool.render(body);
    $('[data-rm]', card).onclick = () => { blocks.splice(i, 1); saveBlocks(); renderCanvas(); };
    $$('[data-mv]', card).forEach((m) => { m.onclick = () => { const j = i + +m.dataset.mv; if (j < 0 || j >= blocks.length) return; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; saveBlocks(); renderCanvas(); }; });
    c.append(card);
  });
}


const COLORS = ['linear-gradient(135deg,#8b5cf6,#22d3ee)', 'linear-gradient(135deg,#ec4899,#fb7185)', 'linear-gradient(135deg,#ff4d6d,#be123c)', 'linear-gradient(135deg,#2563eb,#38bdf8)', 'linear-gradient(135deg,#16a34a,#86efac)', 'linear-gradient(135deg,#ffb347,#ff7a45)', 'linear-gradient(135deg,#6366f1,#14b8a6)', 'linear-gradient(135deg,#0ea5e9,#6366f1)', 'linear-gradient(135deg,#f59e0b,#ef4444)'];
function canvasApp(el) {
  el.innerHTML = `<div class="work-head"><p class="hint">Mix notes, checklists and tools on one page. Everything saves automatically.</p><select id="addBlock" class="select-field" aria-label="Add block"><option value="">+ Add block…</option><option value="text">Note</option><option value="check">Checklist</option>${TOOLS.map((t) => `<option value="tool:${t.id}">${t.name}</option>`).join('')}</select></div><div class="canvas"></div>`;
  canvasRoot = $('.canvas', el);
  $('#addBlock', el).addEventListener('change', (e) => { const v = e.target.value; e.target.value = ''; if (v) addBlock(v.startsWith('tool:') ? { type: 'tool', tool: v.slice(5) } : { type: v }); });
  renderCanvas();
}
const APPS = [{ id: 'canvas', name: 'Canvas', sub: 'Block workspace for notes & tools', icon: 'fa-table-cells-large', render: canvasApp },
  ...TOOLS.map((t) => ({ id: t.id, name: t.name, sub: t.group, icon: t.icon, render: t.render }))].map((a, i) => ({ ...a, color: COLORS[i] }));
const appById = (id) => APPS.find((a) => a.id === id);

/* ---------- App shell: launcher, sheets, stacks ---------- */
const layer = $('#appSheetLayer'); const switcher = $('#taskSwitcher'); const stackList = $('#taskStackList');
const running = new Set(); const appHistory = []; let current = null;
const stages = { landing: $('#landingStage'), device: $('#deviceStage'), desktop: $('#desktopStage') };
const switchStage = (n) => Object.entries(stages).forEach(([k, s]) => { s.classList.toggle('is-active', k === n); s.setAttribute('aria-hidden', String(k !== n)); });

$('.launcher-grid').innerHTML = APPS.map((a) => `<button class="launcher-tile" type="button" data-app="${a.id}"><span class="launcher-orb" style="background:${a.color}"><i class="fa-solid ${a.icon}" aria-hidden="true"></i></span><span class="launcher-name">${a.name}</span></button>`).join('');
$('.launcher-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b) openApp(b.dataset.app); });

function openApp(id, { track = true } = {}) {
  const app = appById(id); if (!app) return;
  if (current && current !== id && track) appHistory.push(current);
  running.add(id); current = id;
  layer.innerHTML = `<article class="app-sheet" role="dialog" aria-modal="true" aria-label="${esc(app.name)}"><header class="sheet-header"><span class="sheet-app-icon" style="background:${app.color}"><i class="fa-solid ${app.icon}" aria-hidden="true"></i></span><div class="sheet-title-group"><h2>${esc(app.name)}</h2><p>${esc(app.sub)}</p></div></header><div class="sheet-body"></div></article>`;
  layer.classList.add('is-open'); layer.setAttribute('aria-hidden', 'false');
  const sheet = $('.app-sheet', layer); requestAnimationFrame(() => sheet.classList.add('is-active'));
  app.render($('.sheet-body', layer)); renderStacks();
}
function closeSheet(clear) {
  if (clear) appHistory.length = 0;
  current = null; const sheet = $('.app-sheet', layer); if (sheet) sheet.classList.remove('is-active');
  setTimeout(() => { if (!current) { layer.innerHTML = ''; layer.classList.remove('is-open'); layer.setAttribute('aria-hidden', 'true'); } }, 420);
}
function closeStacks() { switcher.classList.remove('is-open'); switcher.setAttribute('aria-hidden', 'true'); $('#stacksButton').classList.remove('is-active'); }
function goBack() { closeStacks(); if (!current) return; const prev = appHistory.pop(); if (prev) openApp(prev, { track: false }); else { closeSheet(); renderStacks(); } }
function goHome() { closeStacks(); closeSheet(true); renderStacks(); }
function terminate(id) { running.delete(id); for (let i = appHistory.length - 1; i >= 0; i -= 1) if (appHistory[i] === id) appHistory.splice(i, 1); if (current === id) closeSheet(); renderStacks(); }
function renderStacks() {
  stackList.innerHTML = running.size ? [...running].map((id) => { const a = appById(id); return `<article class="stack-card${id === current ? ' is-current' : ''}" data-stack="${id}" role="button" tabindex="0" aria-label="Switch to ${esc(a.name)}"><span class="stack-card-icon" style="background:${a.color}"><i class="fa-solid ${a.icon}" aria-hidden="true"></i></span><span><strong>${esc(a.name)}</strong><small>${esc(a.sub)}</small></span><button class="terminate-app-btn" type="button" data-close="${id}" aria-label="Close ${esc(a.name)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></article>`; }).join('') : '<div class="empty-stacks">No running apps yet. Launch a tool from the home screen.</div>';
}
stackList.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) { e.stopPropagation(); return terminate(c.dataset.close); } const s = e.target.closest('[data-stack]'); if (s) { openApp(s.dataset.stack); closeStacks(); } });
stackList.addEventListener('keydown', (e) => { const s = e.target.closest('[data-stack]'); if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openApp(s.dataset.stack); closeStacks(); } });
$('#backButton').addEventListener('click', goBack);
$('#homeButton').addEventListener('click', goHome);
$('#stacksButton').addEventListener('click', () => { const open = !switcher.classList.contains('is-open'); switcher.classList.toggle('is-open', open); switcher.setAttribute('aria-hidden', String(!open)); $('#stacksButton').classList.toggle('is-active', open); if (open) renderStacks(); });
$('#closeStacksBtn').addEventListener('click', closeStacks);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) goHome(); });

/* ---------- Stages, device choice, clock ---------- */
$('#getStartedBtn').addEventListener('click', () => switchStage('device'));
$$('[data-device]').forEach((b) => b.addEventListener('click', () => { $('#systemMode').textContent = `WizOS - ${b.dataset.device} Mode`; closeStacks(); closeSheet(true); switchStage('desktop'); }));
const tick = () => { const n = new Date(); $('#clockDisplay').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }); $('#clockDisplay').dateTime = n.toISOString(); };
tick(); setInterval(tick, 1000); renderStacks();
