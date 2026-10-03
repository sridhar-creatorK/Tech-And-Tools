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
  el.innerHTML = `${dropHtml('Drop images here or click to choose (JPG, PNG, WebP, GIF, BMP…)')}
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

const b64u = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const wq = (s = '') => s.replace(/([\\;,:"])/g, '\\$1');
const QR_KINDS = {
  text: { label: 'Text, name or word', f: [['t', 'Type anything…', 'area']], out: (v) => v.t },
  url: { label: 'Website link', f: [['u', 'https://example.com']], out: (v) => v.u && (/^[a-z]+:/i.test(v.u) ? v.u : `https://${v.u}`) },
  page: { label: 'Web page (opens when scanned)', f: [['title', 'Page title'], ['body', 'Page text — links become clickable', 'area']], out: (v) => (v.title || v.body ? `${location.origin}${location.pathname}#share=${b64u(JSON.stringify({ t: v.title || '', b: v.body || '' }))}` : '') },
  wifi: { label: 'Wi-Fi', f: [['ssid', 'Network name'], ['pw', 'Password'], ['sec', '', 'sel:WPA,WEP,nopass']], out: (v) => (v.ssid ? `WIFI:T:${v.sec};S:${wq(v.ssid)};P:${wq(v.pw)};;` : '') },
  contact: { label: 'Contact card', f: [['name', 'Full name'], ['phone', 'Phone'], ['email', 'Email'], ['org', 'Company']], out: (v) => (v.name ? `BEGIN:VCARD\nVERSION:3.0\nFN:${v.name}\nTEL:${v.phone || ''}\nEMAIL:${v.email || ''}\nORG:${v.org || ''}\nEND:VCARD` : '') },
  mail: { label: 'Email', f: [['to', 'To'], ['sub', 'Subject'], ['body', 'Message', 'area']], out: (v) => (v.to ? `mailto:${v.to}?subject=${encodeURIComponent(v.sub || '')}&body=${encodeURIComponent(v.body || '')}` : '') },
  phone: { label: 'Phone number', f: [['n', '+91…']], out: (v) => (v.n ? `tel:${v.n}` : '') },
};
function qrTool(el) {
  el.innerHTML = `<div class="row"><select class="select-field" data-k aria-label="QR type">${Object.entries(QR_KINDS).map(([k, d]) => `<option value="${k}">${d.label}</option>`).join('')}</select>
    <select class="select-field" data-s aria-label="Size"><option value="192">Small</option><option value="256" selected>Medium</option><option value="384">Large</option></select></div>
    <div class="stack-gap" data-fields></div><div class="row"><button class="btn primary" data-dl>Download PNG</button><span class="hint" data-msg></span></div>
    <div class="qr-box" data-qr></div>
    <p class="hint">QR codes hold text and links, not files. For a file or folder, upload it to Drive or Dropbox and paste the share link under “Website link”.</p>`;
  const box = $('[data-qr]', el); const msg = $('[data-msg]', el);
  const values = () => Object.fromEntries($$('[data-n]', el).map((i) => [i.dataset.n, i.value.trim()]));
  const make = async () => {
    msg.textContent = ''; box.innerHTML = '';
    const payload = QR_KINDS[$('[data-k]', el).value].out(values()); if (!payload) return;
    if ($('[data-k]', el).value === 'page' && !/^https?:$/.test(location.protocol)) msg.textContent = 'Web-page codes only work once WizOS is hosted online.';
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'); const s = +$('[data-s]', el).value;
      new window.QRCode(box, { text: payload, width: s, height: s, correctLevel: payload.length > 350 ? window.QRCode.CorrectLevel.L : window.QRCode.CorrectLevel.M });
    } catch (err) { box.innerHTML = ''; msg.textContent = /overflow/i.test(err.message) ? 'Too much content for one QR code (about 2,000 characters max).' : err.message; }
  };
  const fields = () => {
    $('[data-fields]', el).innerHTML = QR_KINDS[$('[data-k]', el).value].f.map(([n, ph, t = '']) => (t === 'area' ? `<textarea class="textarea-panel small" data-n="${n}" placeholder="${ph}" aria-label="${ph}"></textarea>` : t.startsWith('sel:') ? `<select class="select-field" data-n="${n}" aria-label="Security">${t.slice(4).split(',').map((o) => `<option>${o}</option>`).join('')}</select>` : `<input class="field" data-n="${n}" placeholder="${ph}" aria-label="${ph}" />`)).join('');
    $$('[data-n]', el).forEach((i) => i.addEventListener('input', make)); make();
  };
  $('[data-k]', el).addEventListener('change', fields); $('[data-s]', el).addEventListener('change', make);
  $('[data-dl]', el).addEventListener('click', () => { const c = $('canvas', box); if (c) c.toBlob((b) => download(b, 'qr-code.png')); });
  fields();
}

function colorTool(el) {
  el.innerHTML = `<div class="row"><input type="color" class="colorpick" data-c value="#6366f1" aria-label="Pick colour" /><input class="field" data-hex value="#6366f1" aria-label="Hex" /><button class="btn" data-copy>Copy HEX</button>${window.EyeDropper ? '<button class="btn" data-eye>Pick from screen</button>' : ''}</div><p class="hint" data-fmt></p>${dropHtml('Drop an image to extract its colour palette')}<div class="swatches" data-sw></div>`;
  const set = (h) => {
    if (!/^#[0-9a-f]{6}$/i.test(h)) return;
    $('[data-c]', el).value = h; $('[data-hex]', el).value = h;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const R = r / 255; const G = g / 255; const B = b / 255;
    const mx = Math.max(R, G, B); const mn = Math.min(R, G, B); const l = (mx + mn) / 2; const d = mx - mn; let hh = 0; let s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); hh = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; hh = Math.round(hh * 60 + 360) % 360; }
    $('[data-fmt]', el).textContent = `RGB(${r}, ${g}, ${b}) · HSL(${hh}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  };
  $('[data-c]', el).addEventListener('input', (e) => set(e.target.value)); $('[data-hex]', el).addEventListener('input', (e) => set(e.target.value.trim()));
  $('[data-copy]', el).addEventListener('click', () => copy($('[data-hex]', el).value));
  $('[data-eye]', el)?.addEventListener('click', async () => { try { set((await new window.EyeDropper().open()).sRGBHex); } catch { /* cancelled */ } });
  $('[data-sw]', el).addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) { set(b.dataset.h); copy(b.dataset.h); } });
  wireDrop(el, async (fs) => {
    const f = fs.find((x) => x.type.startsWith('image/')); if (!f) return;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(await createImageBitmap(f), 0, 0, 64, 64);
    const px = x.getImageData(0, 0, 64, 64).data; const cnt = {};
    for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; const k = [px[i], px[i + 1], px[i + 2]].map((v) => v >> 5).join(); cnt[k] = (cnt[k] || 0) + 1; }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => `#${k.split(',').map((v) => ((+v << 5) + 16).toString(16).padStart(2, '0')).join('')}`);
    $('[data-sw]', el).innerHTML = top.map((h) => `<button class="swatch" style="background:${h}" data-h="${h}">${h}</button>`).join('');
  }, 'image/*'); set('#6366f1');
}

function diffTool(el) {
  el.innerHTML = `<div class="two"><textarea class="textarea-panel small code" data-a placeholder="Original text" aria-label="Original"></textarea><textarea class="textarea-panel small code" data-b placeholder="Changed text" aria-label="Changed"></textarea></div><div class="panel-card diff" data-o><span class="hint">Differences appear here.</span></div>`;
  const run = () => {
    const a = $('[data-a]', el).value.split('\n'); const b = $('[data-b]', el).value.split('\n'); const n = a.length; const m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0; let j = 0; let h = '';
    while (i < n && j < m) { if (a[i] === b[j]) { h += `<div>  ${esc(a[i])}</div>`; i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) { h += `<div class="del">− ${esc(a[i])}</div>`; i += 1; } else { h += `<div class="add">+ ${esc(b[j])}</div>`; j += 1; } }
    while (i < n) { h += `<div class="del">− ${esc(a[i])}</div>`; i += 1; } while (j < m) { h += `<div class="add">+ ${esc(b[j])}</div>`; j += 1; }
    $('[data-o]', el).innerHTML = h;
  };
  $$('textarea', el).forEach((t) => t.addEventListener('input', run));
}

function regexTool(el) {
  el.innerHTML = `<div class="row"><input class="field grow code" data-p placeholder="Pattern, e.g. \\d+" aria-label="Pattern" /><input class="field" style="width:5rem" data-f value="g" aria-label="Flags" /></div><textarea class="textarea-panel small" data-t placeholder="Test text…" aria-label="Test text"></textarea><div class="panel-card"><div class="rx-out" data-o></div><p class="hint" data-msg></p></div>`;
  const run = () => {
    const p = $('[data-p]', el).value; const t = $('[data-t]', el).value; const msg = $('[data-msg]', el); const o = $('[data-o]', el);
    if (!p) { o.textContent = t; msg.textContent = ''; return; }
    try {
      const fl = $('[data-f]', el).value; const re = new RegExp(p, fl.includes('g') ? fl : `${fl}g`); let last = 0; let html = ''; let n = 0;
      for (const m of t.matchAll(re)) { html += `${esc(t.slice(last, m.index))}<mark>${esc(m[0])}</mark>`; last = m.index + m[0].length; n += 1; if (n > 2000) break; }
      o.innerHTML = html + esc(t.slice(last)); msg.textContent = `${n} match${n === 1 ? '' : 'es'}`;
    } catch (e) { msg.textContent = `✗ ${e.message}`; }
  };
  $$('input,textarea', el).forEach((i) => i.addEventListener('input', run));
}

function cssTool(el) {
  const rgba = (h, a) => `rgba(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')}, ${a})`;
  const specs = {
    Gradient: { f: [['Colour 1', 'color', '#6366f1'], ['Colour 2', 'color', '#ec4899'], ['Angle', 'range', 135, 0, 360]], css: (v) => `background: linear-gradient(${v[2]}deg, ${v[0]}, ${v[1]});` },
    Shadow: { f: [['X', 'range', 0, -50, 50], ['Y', 'range', 12, -50, 50], ['Blur', 'range', 30, 0, 100], ['Spread', 'range', 0, -30, 30], ['Colour', 'color', '#000000'], ['Opacity %', 'range', 35, 0, 100]], css: (v) => `box-shadow: ${v[0]}px ${v[1]}px ${v[2]}px ${v[3]}px ${rgba(v[4], v[5] / 100)};` },
    Glass: { f: [['Blur', 'range', 16, 0, 40], ['Opacity %', 'range', 18, 0, 60]], css: (v) => `background: rgba(255, 255, 255, ${v[1] / 100});\nbackdrop-filter: blur(${v[0]}px);\nborder: 1px solid rgba(255, 255, 255, 0.35);` },
  };
  el.innerHTML = `<div class="tabs">${Object.keys(specs).map((k, i) => `<button class="tab ${i ? '' : 'is-on'}" data-sp="${k}">${k}</button>`).join('')}</div><div class="css-stage"><div class="css-preview" data-pv></div></div><div class="row" data-ctl></div><pre class="css-out" data-out></pre><div class="row"><button class="btn" data-copy>Copy CSS</button></div>`;
  let cur = 'Gradient'; let vals = [];
  const draw = () => { const css = specs[cur].css(vals); $('[data-out]', el).textContent = css; $('[data-pv]', el).style.cssText = css; };
  const load = (k) => {
    cur = k; vals = specs[k].f.map((f) => f[2]);
    $('[data-ctl]', el).innerHTML = specs[k].f.map((f, i) => `<label class="ctl">${f[0]} <input type="${f[1]}" value="${f[2]}" ${f[1] === 'range' ? `min="${f[3]}" max="${f[4]}"` : ''} data-i="${i}" /></label>`).join('');
    $$('[data-i]', el).forEach((inp) => inp.addEventListener('input', () => { vals[+inp.dataset.i] = inp.type === 'range' ? +inp.value : inp.value; draw(); })); draw();
  };
  $$('[data-sp]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-sp]', el).forEach((x) => x.classList.toggle('is-on', x === t)); load(t.dataset.sp); }));
  $('[data-copy]', el).addEventListener('click', () => copy($('[data-out]', el).textContent)); load('Gradient');
}

function unitTool(el) {
  el.innerHTML = `<article class="panel-card"><h3>Pixels ⇄ rem</h3><div class="row"><input class="field" type="number" data-px value="16" aria-label="Pixels" /> px = <b data-rem>1</b> rem · base <input class="field" type="number" data-base value="16" aria-label="Base size" /></div></article>
    <article class="panel-card"><h3>File size</h3><div class="row"><input class="field" type="number" data-d value="1" aria-label="Size" /><select class="select-field" data-du><option>KB</option><option selected>MB</option><option>GB</option><option>TB</option></select></div><p class="hint" data-dout></p></article>
    <article class="panel-card"><h3>Unix timestamp</h3><div class="row"><input class="field grow" data-ts placeholder="e.g. 1700000000" aria-label="Timestamp" /><button class="btn" data-now>Now</button></div><p class="hint" data-tsout></p></article>`;
  const px = () => { $('[data-rem]', el).textContent = (+$('[data-px]', el).value / (+$('[data-base]', el).value || 16)).toLocaleString(undefined, { maximumFractionDigits: 4 }); };
  const dz = () => { const b = +$('[data-d]', el).value * 1024 ** (1 + $('[data-du]', el).selectedIndex); $('[data-dout]', el).textContent = ['Bytes', 'KB', 'MB', 'GB', 'TB'].map((u, i) => `${(b / 1024 ** i).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${u}`).join(' · '); };
  const ts = () => { const v = $('[data-ts]', el).value.trim(); if (!v) { $('[data-tsout]', el).textContent = ''; return; } const n = +v; const d = new Date(n < 1e11 ? n * 1000 : n); $('[data-tsout]', el).textContent = Number.isNaN(d.getTime()) ? 'Invalid timestamp' : `${d.toLocaleString()} · ${d.toISOString()}`; };
  $$('[data-px],[data-base]', el).forEach((i) => i.addEventListener('input', px)); $$('[data-d],[data-du]', el).forEach((i) => i.addEventListener('input', dz));
  $('[data-ts]', el).addEventListener('input', ts); $('[data-now]', el).addEventListener('click', () => { $('[data-ts]', el).value = Math.floor(Date.now() / 1000); ts(); }); px(); dz();
}

function recorderTool(el) {
  el.innerHTML = `<div class="row"><label class="chip"><input type="checkbox" data-aud checked /> Include tab/system audio</label><label class="chip"><input type="checkbox" data-mic /> Include microphone</label></div><div class="row"><button class="btn primary" data-go>Start recording</button><span class="hint" data-msg></span></div><video class="rec-video" data-v controls hidden></video><div class="row"><a class="btn primary" data-dl hidden>Download recording</a></div>`;
  let rec = null; const go = $('[data-go]', el); const msg = $('[data-msg]', el);
  go.addEventListener('click', async () => {
    if (rec && rec.state !== 'inactive') { rec.stop(); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) { msg.textContent = 'Screen recording is not supported in this browser.'; return; }
    try {
      const streams = [await navigator.mediaDevices.getDisplayMedia({ video: true, audio: $('[data-aud]', el).checked })]; const tracks = [...streams[0].getTracks()];
      if ($('[data-mic]', el).checked) { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); streams.push(m); tracks.push(...m.getAudioTracks()); }
      const chunks = []; rec = new MediaRecorder(new MediaStream(tracks));
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop())); const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
        const v = $('[data-v]', el); v.src = url; v.hidden = false; const dl = $('[data-dl]', el); dl.href = url; dl.download = 'recording.webm'; dl.hidden = false; go.textContent = 'Start recording'; msg.textContent = 'Recording ready.';
      };
      streams[0].getVideoTracks()[0].onended = () => { if (rec.state !== 'inactive') rec.stop(); };
      rec.start(); go.textContent = 'Stop recording'; msg.textContent = '● Recording…';
    } catch (e) { msg.textContent = e.name === 'NotAllowedError' ? 'Permission was denied.' : e.message; }
  });
}

function bgTool(el) {
  el.innerHTML = `${dropHtml('Drop a photo to remove its background')}<p class="hint" data-msg>The first use downloads an AI model (about 40 MB); after that it is fast.</p><div class="row"><img class="bg-prev" data-o alt="Original" hidden /><img class="bg-prev checker" data-r alt="Result" hidden /></div><div class="row"><a class="btn primary" data-dl hidden>Download PNG</a></div>`;
  wireDrop(el, async (fs) => {
    const f = fs.find((x) => x.type.startsWith('image/')); if (!f) return; const msg = $('[data-msg]', el);
    $('[data-o]', el).src = URL.createObjectURL(f); $('[data-o]', el).hidden = false; $('[data-r]', el).hidden = true; $('[data-dl]', el).hidden = true; msg.textContent = 'Removing background… this can take a minute the first time.';
    try {
      const { removeBackground } = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm'); const blob = await removeBackground(f); const url = URL.createObjectURL(blob);
      $('[data-r]', el).src = url; $('[data-r]', el).hidden = false; const dl = $('[data-dl]', el); dl.href = url; dl.download = `${f.name.replace(/\.[^.]+$/, '')}-nobg.png`; dl.hidden = false; msg.textContent = 'Done.';
    } catch (e) { msg.textContent = `Could not run the model: ${e.message}`; }
  }, 'image/*');
}

function showShared() {
  const m = location.hash.match(/^#share=(.+)$/); if (!m) return;
  try {
    const d = JSON.parse(unb64u(m[1])); const body = esc(d.b || '').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    const v = document.createElement('div'); v.className = 'share-view';
    v.innerHTML = `<article class="panel-card share-card"><p class="eyebrow">Shared with WizOS</p><h2>${esc(d.t || 'Shared note')}</h2><div class="share-body">${body}</div><div class="row"><button class="btn" data-c>Copy text</button><button class="btn primary" data-x>Open WizOS</button></div></article>`;
    $('[data-c]', v).onclick = () => copy(`${d.t}\n${d.b}`); $('[data-x]', v).onclick = () => { v.remove(); history.replaceState(null, '', location.pathname); }; document.body.append(v);
  } catch { /* not a valid share link */ }
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
  { id: 'image', name: 'Image Converter', icon: 'fa-image', group: 'Image & Media', render: imageTool },
  { id: 'bg', name: 'Background Remover', icon: 'fa-wand-magic-sparkles', group: 'Image & Media', render: bgTool },
  { id: 'color', name: 'Color Picker', icon: 'fa-palette', group: 'Image & Media', render: colorTool },
  { id: 'pdf', name: 'PDF Merge & Split', icon: 'fa-file-pdf', group: 'PDF & Documents', render: pdfTool },
  { id: 'qr', name: 'QR Generator', icon: 'fa-qrcode', group: 'Quick Utilities', render: qrTool },
  { id: 'rec', name: 'Screen Recorder', icon: 'fa-video', group: 'Quick Utilities', render: recorderTool },
  { id: 'pad', name: 'Scratchpad', icon: 'fa-note-sticky', group: 'Quick Utilities', render: padTool },
  { id: 'regex', name: 'Regex Tester', icon: 'fa-asterisk', group: 'Developer', render: regexTool },
  { id: 'diff', name: 'Diff Checker', icon: 'fa-code-compare', group: 'Developer', render: diffTool },
  { id: 'css', name: 'CSS Generator', icon: 'fa-wand-magic', group: 'Developer', render: cssTool },
  { id: 'units', name: 'Unit Converter', icon: 'fa-ruler-combined', group: 'Developer', render: unitTool },
  { id: 'encode', name: 'Base64 & URL', icon: 'fa-lock', group: 'Developer', render: encodeTool },
];
const toolById = (id) => TOOLS.find((t) => t.id === id);

/* ---------- Block canvas ---------- */
let blocks = store.get('blocks', [{ id: 1, type: 'text', data: 'Welcome to WizOS.\nAdd notes, checklists and tools as blocks — everything saves automatically.' }]);
const saveBlocks = () => store.set('blocks', blocks);
let canvasRoot = null;
function addBlock(spec) { blocks.unshift({ id: Date.now(), data: spec.type === 'check' ? [] : '', ...spec }); saveBlocks(); renderCanvas(); }

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


const COLORS = ['linear-gradient(135deg,#8b5cf6,#22d3ee)', 'linear-gradient(135deg,#ec4899,#fb7185)', 'linear-gradient(135deg,#ff4d6d,#be123c)', 'linear-gradient(135deg,#2563eb,#38bdf8)', 'linear-gradient(135deg,#16a34a,#86efac)', 'linear-gradient(135deg,#ffb347,#ff7a45)', 'linear-gradient(135deg,#6366f1,#14b8a6)', 'linear-gradient(135deg,#0ea5e9,#6366f1)', 'linear-gradient(135deg,#f59e0b,#ef4444)', 'linear-gradient(135deg,#14b8a6,#3b82f6)', 'linear-gradient(135deg,#a855f7,#ec4899)', 'linear-gradient(135deg,#f97316,#eab308)', 'linear-gradient(135deg,#06b6d4,#22c55e)'];
function canvasApp(el) {
  el.innerHTML = `<div class="row"><button class="btn primary" data-add="text"><i class="fa-solid fa-plus"></i> New note</button><button class="btn primary" data-add="check"><i class="fa-solid fa-plus"></i> New checklist</button></div>
    <p class="hint">Or drop a tool onto your canvas:</p><div class="row">${TOOLS.map((t) => `<button class="chip" data-add="tool:${t.id}"><i class="fa-solid ${t.icon}"></i> ${t.name}</button>`).join('')}</div><div class="canvas"></div>`;
  canvasRoot = $('.canvas', el);
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const v = b.dataset.add; addBlock(v.startsWith('tool:') ? { type: 'tool', tool: v.slice(5) } : { type: v }); });
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
tick(); setInterval(tick, 1000); renderStacks(); showShared();
