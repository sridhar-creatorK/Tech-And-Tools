/* WizOS workspace: tool library + block canvas. All processing runs in the browser. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`wizos:${k}`)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`wizos:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
async function copy(t) {
  if (!t) return toast('Nothing to copy');
  try { await navigator.clipboard.writeText(t); toast('Copied'); return; } catch { /* fall back below */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove(); toast(ok ? 'Copied' : 'Copy is blocked in this browser — select the text and copy it manually');
}
const loaded = {};
const loadScript = (url) => (loaded[url] ||= new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = url; s.onload = () => res();
  // forget failed loads so the next attempt can retry once the connection is back
  s.onerror = () => { delete loaded[url]; s.remove(); rej(new Error('Could not load a helper library (check your internet connection and try again)')); };
  document.head.append(s);
}));
function toast(msg) {
  let box = $('.toast-box');
  if (!box) { box = document.createElement('div'); box.className = 'toast-box'; box.setAttribute('role', 'status'); document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.append(t); setTimeout(() => t.remove(), 3000);
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.hidden = true; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const dropHtml = (label) => `<div class="drop" tabindex="0"><i class="fa-solid fa-cloud-arrow-up"></i><span>${label}</span><input type="file" hidden /></div>`;
function wireDrop(el, cb, accept) {
  const d = $('.drop', el); const i = $('input', d);
  i.accept = accept; i.multiple = true;
  d.onclick = () => i.click();
  d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); i.click(); } };
  i.onchange = () => { cb([...i.files]); i.value = ''; };
  d.ondragover = (e) => { e.preventDefault(); d.classList.add('over'); };
  d.ondragleave = () => d.classList.remove('over');
  d.ondrop = (e) => { e.preventDefault(); d.classList.remove('over'); const fs = [...e.dataTransfer.files]; if (fs.length) cb(fs); };
}

/* ---------- Tools ---------- */
/* ---------- Shared media helpers ---------- */
const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const isPdf = (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
const isHeic = (f) => /hei[cf]$/i.test(f.name) || /hei[cf]/i.test(f.type);
async function toBitmap(f) {
  if (isHeic(f)) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js'); const r = await window.heic2any({ blob: f, toType: 'image/png' }); f = Array.isArray(r) ? r[0] : r; }
  return createImageBitmap(f);
}
async function toCanvas(f) {
  const b = await toBitmap(f); const c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(b, 0, 0); return c;
}
async function pdfjs() {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); const L = window.pdfjsLib;
  L.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; return L;
}
const pdfDoc = async (data) => (await pdfjs()).getDocument({ data }).promise;
async function renderPage(doc, n, scale) {
  const p = await doc.getPage(n); const v = p.getViewport({ scale }); const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
  await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; return c;
}
const blobOf = (c, type = 'image/png', q) => new Promise((r) => c.toBlob(r, type, q));
function parseRange(text, n) {
  const idx = [];
  text.split(',').forEach((part) => {
    const [a, b = a] = part.trim().split('-').map((x) => parseInt(x, 10)); if (Number.isNaN(a) || Number.isNaN(b)) return;
    for (let p = Math.max(1, Math.min(a, b)); p <= Math.min(n, Math.max(a, b)); p += 1) if (!idx.includes(p - 1)) idx.push(p - 1);
  });
  return idx;
}
function addResult(list, name, blob, note = '', thumbCanvas) {
  const url = URL.createObjectURL(blob); const row = document.createElement('div'); row.className = 'list-row';
  row.innerHTML = `${thumbCanvas ? `<img class="thumb" src="${thumbCanvas}" alt="" />` : ''}<span class="grow">${esc(name)}<br /><small>${fmtBytes(blob.size)} ${note}</small></span><a class="btn primary" download="${esc(name)}" href="${url}">Save</a>`;
  list.append(row);
}
const thumbOf = (c) => {
  const t = document.createElement('canvas'); t.width = 56; t.height = 56; const side = Math.min(c.width, c.height);
  t.getContext('2d').drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, 56, 56); return t.toDataURL();
};

/* ffmpeg.wasm (video/audio + rare image formats), loaded on first use */
let ffP = null;

/*
 * FFmpeg WASM compatibility build:
 *   @ffmpeg/ffmpeg 0.11.6  -> vendor/ffmpeg.min.js
 *   @ffmpeg/core-st 0.11.1 -> vendor/ffmpeg-core.js
 *                              vendor/ffmpeg-core.wasm
 *                              vendor/ffmpeg-core.worker.js
 *
 * Keep these three core files from the SAME core-st 0.11.1 package.
 * Do not mix them with @ffmpeg/core 0.12.x files.
 */
const FF_WRAPPER = 'vendor/ffmpeg.min.js';
const FF_CHUNK = 'vendor/046d0074eee1d99a674a.js';
const FF_CORE = 'vendor/ffmpeg-core.js';
const errText = (e) => String((e && (e.message || e.reason || e.type)) || e || 'unknown error');
const ffFetchFile = async (f) => new Uint8Array(await f.arrayBuffer());

async function getFF() {
  return (ffP ||= (async () => {
    // Load the 0.11.6 split bundle. Some static hosts/browsers fail to
    // resolve its companion chunk automatically, so explicitly load it too.
    await loadScript(FF_WRAPPER);
    if (!window.FFmpeg || typeof window.FFmpeg.createFFmpeg !== 'function') {
      try { await loadScript(FF_CHUNK); } catch (_) { /* report the clearer error below */ }
    }
    if (!window.FFmpeg || typeof window.FFmpeg.createFFmpeg !== 'function') {
      throw new Error('FFmpeg wrapper did not initialize. Check that vendor/ffmpeg.min.js and vendor/046d0074eee1d99a674a.js are both uploaded from @ffmpeg/ffmpeg 0.11.6.');
    }

    // corePath must be a real URL/path, not a blob URL. The 0.11 wrapper
    // uses it to locate the matching WASM and worker files.
    const corePath = new URL(FF_CORE, document.baseURI).href;
    const ff = window.FFmpeg.createFFmpeg({
      log: false,
      corePath,
    });

    await ff.load();
    return { ff, fetchFile: window.FFmpeg.fetchFile || ffFetchFile };
  })().catch((e) => {
    ffP = null;
    throw new Error(`The video converter could not start: ${errText(e)}`);
  }));
}

async function ffRun(file, args, outName, onP) {
  const { ff, fetchFile } = await getFF();
  const ext = (file.name.split('.').pop() || 'bin').replace(/\W/g, '');
  const inn = `in.${ext}`;

  ff.setProgress(({ ratio }) => onP?.(Math.min(1, Math.max(0, ratio || 0))));
  await ff.FS('writeFile', inn, await fetchFile(file));
  try {
    await ff.run('-i', inn, ...args, outName);
    const d = ff.FS('readFile', outName);
    return new Blob([d]);
  } finally {
    try { ff.FS('unlink', inn); } catch { /* ignore */ }
    try { ff.FS('unlink', outName); } catch { /* ignore */ }
  }
}

function bmpBlob(c) {
  const w = c.width; const h = c.height; const d = c.getContext('2d').getImageData(0, 0, w, h).data; const rs = w * 4; const buf = new ArrayBuffer(54 + rs * h); const v = new DataView(buf); const u = new Uint8Array(buf);
  v.setUint16(0, 0x4d42, true); v.setUint32(2, 54 + rs * h, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 32, true); v.setUint32(34, rs * h, true);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const s = ((h - 1 - y) * w + x) * 4; const o = 54 + y * rs + x * 4; u[o] = d[s + 2]; u[o + 1] = d[s + 1]; u[o + 2] = d[s]; u[o + 3] = d[s + 3]; }
  return new Blob([buf], { type: 'image/bmp' });
}
async function icoBlob(c) {
  const s = Math.min(256, Math.max(c.width, c.height)); const t = document.createElement('canvas'); t.width = s; t.height = s; const r = Math.min(s / c.width, s / c.height);
  t.getContext('2d').drawImage(c, (s - c.width * r) / 2, (s - c.height * r) / 2, c.width * r, c.height * r);
  const png = new Uint8Array(await (await blobOf(t)).arrayBuffer()); const b = new Uint8Array(22 + png.length); const v = new DataView(b.buffer);
  v.setUint16(2, 1, true); v.setUint16(4, 1, true); b[6] = s >= 256 ? 0 : s; b[7] = b[6]; v.setUint16(10, 1, true); v.setUint16(12, 32, true); v.setUint32(14, png.length, true); v.setUint32(18, 22, true); b.set(png, 22);
  return new Blob([b], { type: 'image/x-icon' });
}
async function encodeImg(c, fmt, qual) {
  if (fmt === 'jpg') return blobOf(c, 'image/jpeg', qual); if (fmt === 'webp') return blobOf(c, 'image/webp', qual); if (fmt === 'png') return blobOf(c);
  if (fmt === 'bmp') return bmpBlob(c); if (fmt === 'ico') return icoBlob(c);
  if (fmt === 'pdf') { await loadScript(PDFLIB); const { PDFDocument } = window.PDFLib; const d = await PDFDocument.create(); const im = await d.embedPng(await (await blobOf(c)).arrayBuffer()); d.addPage([c.width, c.height]).drawImage(im, { x: 0, y: 0, width: c.width, height: c.height }); return new Blob([await d.save()], { type: 'application/pdf' }); }
  return ffRun(new File([await blobOf(c)], 'x.png'), [], `out.${fmt}`);
}

/* ---------- Media Converter ---------- */
function mediaTool(el) {
  const IMG = { jpg: 'JPG', png: 'PNG', webp: 'WebP', bmp: 'BMP', ico: 'ICO (icon)', pdf: 'PDF', gif: 'GIF', tiff: 'TIFF', tga: 'TGA', ppm: 'PPM' };
  const VID = { mp4: ['MP4 (H.264)', ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart'], 'v'], webm: ['WebM (VP8)', ['-c:v', 'libvpx', '-b:v', '2M', '-c:a', 'libvorbis'], 'v'], mkv: ['MKV', ['-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac'], 'v'], mov: ['MOV', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac'], 'v'], avi: ['AVI', ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame'], 'v'], ogv: ['OGV (Theora)', ['-c:v', 'libtheora', '-q:v', '6', '-c:a', 'libvorbis'], 'v'], gif: ['Animated GIF', [], 'v'], mp3: ['MP3 audio', ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], 'a'], wav: ['WAV audio', ['-vn'], 'a'], ogg: ['OGG audio', ['-vn', '-c:a', 'libvorbis'], 'a'], m4a: ['M4A (AAC) audio', ['-vn', '-c:a', 'aac'], 'a'], flac: ['FLAC audio', ['-vn', '-c:a', 'flac'], 'a'] };
  const opts = (o) => Object.entries(o).map(([k, v]) => `<option value="${k}">${Array.isArray(v) ? v[0] : v}</option>`).join('');
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="img"><i class="fa-solid fa-image"></i> Images</button><button class="tab" data-m="vid"><i class="fa-solid fa-film"></i> Video &amp; audio</button></div>
  <section data-p="img" class="stack-gap">${dropHtml('Drop images (JPG, PNG, WebP, GIF, BMP, HEIC…)')}
    <div class="opt-grid"><label>Convert to <select class="select-field" data-f>${opts(IMG)}</select></label><label>Quality <input type="range" min="10" max="100" value="85" data-q /></label>
    <label>Width px <input class="field" type="number" min="1" data-w placeholder="auto" /></label><label>Height px <input class="field" type="number" min="1" data-h placeholder="auto" /></label>
    <label>Crop to ratio <select class="select-field" data-crop><option value="">None</option><option>1:1</option><option>4:3</option><option>3:2</option><option>16:9</option><option>9:16</option><option>4:5</option></select></label>
    <label>Rotate <select class="select-field" data-rot><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
    <label>Effect <select class="select-field" data-fx><option value="">None</option><option value="grayscale(1)">Black &amp; white</option><option value="sepia(1)">Sepia</option><option value="invert(1)">Invert</option><option value="blur(3px)">Blur</option></select></label>
    <label>Brightness <input type="range" min="50" max="150" value="100" data-br /></label><label>Contrast <input type="range" min="50" max="150" value="100" data-ct /></label>
    <label class="chip"><input type="checkbox" data-fh /> Flip ↔</label><label class="chip"><input type="checkbox" data-fv /> Flip ↕</label></div>
    <div class="row"><button class="btn primary" data-ic>Convert</button><span class="hint" data-imsg></span></div><div class="list" data-iout></div></section>
  <section data-p="vid" class="stack-gap" hidden>${dropHtml('Drop a video or audio file (MP4, MOV, MKV, AVI, WebM, MP3…)')}<p class="hint" data-vname>No file chosen.</p>
    <div class="opt-grid"><label>Convert to <select class="select-field" data-vf>${opts(VID)}</select></label>
    <label>Quality <select class="select-field" data-vq><option value="20">High</option><option value="24" selected>Balanced</option><option value="30">Smallest</option></select></label>
    <label>Resolution <select class="select-field" data-vr><option value="">Original</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option><option value="360">360p</option></select></label>
    <label>Start (sec) <input class="field" type="number" min="0" data-vs /></label><label>End (sec) <input class="field" type="number" min="0" data-ve /></label><label class="chip"><input type="checkbox" data-vm /> Mute</label></div>
    <div class="row"><button class="btn primary" data-vgo>Convert</button><span class="hint" data-vmsg>Runs on your device. The first use downloads the converter (~30 MB); large videos take a while.</span></div>
    <div class="progress-rail"><span class="progress-fill" data-vbar style="--progress:0%"></span></div><div class="list" data-vout></div></section>`;
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  const q = (s) => $(s, el); let files = []; let tok = 0;
  const runImg = async () => {
    const t = ++tok; const out = q('[data-iout]'); out.innerHTML = ''; if (!files.length) return q('[data-imsg]').textContent = 'Add images first.';
    q('[data-imsg]').textContent = 'Converting…'; const fmt = q('[data-f]').value;
    for (const f of files) {
      try {
        const bmp = await toBitmap(f); let sw = bmp.width; let sh = bmp.height; let sx = 0; let sy = 0; const cr = q('[data-crop]').value;
        if (cr) { const [a, b] = cr.split(':').map(Number); const r = a / b; if (sw / sh > r) { const nw = sh * r; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / r; sy = (sh - nh) / 2; sh = nh; } }
        let w = +q('[data-w]').value || 0; let h = +q('[data-h]').value || 0;
        if (w && !h) h = Math.round((sh * w) / sw); else if (h && !w) w = Math.round((sw * h) / sh); else if (!w) { w = Math.round(sw); h = Math.round(sh); }
        const rot = +q('[data-rot]').value; const swap = rot % 180; const c = document.createElement('canvas'); c.width = swap ? h : w; c.height = swap ? w : h; const x = c.getContext('2d');
        if (fmt === 'jpg' || fmt === 'ppm') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.filter = `${q('[data-fx]').value} brightness(${q('[data-br]').value}%) contrast(${q('[data-ct]').value}%)`.trim();
        x.translate(c.width / 2, c.height / 2); x.rotate((rot * Math.PI) / 180); x.scale(q('[data-fh]').checked ? -1 : 1, q('[data-fv]').checked ? -1 : 1);
        x.drawImage(bmp, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
        const blob = await encodeImg(c, fmt, q('[data-q]').value / 100); if (t !== tok) return;
        addResult(out, `${f.name.replace(/\.[^.]+$/, '')}.${fmt}`, blob, `· from ${fmtBytes(f.size)} · ${c.width}×${c.height}`, thumbOf(c));
      } catch (e) { out.insertAdjacentHTML('beforeend', `<div class="list-row">Could not convert ${esc(f.name)}: ${esc(e.message)}</div>`); }
    }
    q('[data-imsg]').textContent = 'Done.';
  };
  wireDrop($('[data-p="img"]', el), (fs) => { files = fs.filter((f) => f.type.startsWith('image/') || isHeic(f)); q('[data-imsg]').textContent = `${files.length} image(s) ready — press Convert.`; }, 'image/*,.heic,.heif');
  q('[data-ic]').addEventListener('click', runImg);
  let vfile = null; let busyV = false; const vmsg = (t) => { q('[data-vmsg]').textContent = t; };
  wireDrop($('[data-p="vid"]', el), (fs) => { vfile = fs[0] || null; q('[data-vname]').textContent = vfile ? `${vfile.name} · ${fmtBytes(vfile.size)}` : 'No file chosen.'; }, 'video/*,audio/*');
  q('[data-vgo]').addEventListener('click', async () => {
    if (!vfile) return vmsg('Choose a file first.');
    const fmt = q('[data-vf]').value; const [, base, kind] = VID[fmt]; const args = [...base];
    if (kind === 'v') {
      const vf = []; if (fmt === 'gif') vf.push('fps=12'); if (q('[data-vr]').value) vf.push(`scale=-2:${q('[data-vr]').value}`); if (vf.length) args.push('-vf', vf.join(','));
      if (args.includes('libx264')) args.push('-crf', q('[data-vq]').value); if (q('[data-vm]').checked || fmt === 'gif') args.push('-an');
    }
    const vs = q('[data-vs]').value; const ve = q('[data-ve]').value;
    if (vs && ve && +ve <= +vs) return vmsg('The end time must be later than the start time.');
    if (vs) args.push('-ss', vs); if (ve) args.push('-to', ve);
    if (busyV) return; busyV = true; q('[data-vgo]').disabled = true;
    try {
      vmsg('Loading converter and working…'); q('[data-vout]').innerHTML = '';
      const blob = await ffRun(vfile, args, `out.${fmt}`, (p) => q('[data-vbar]').style.setProperty('--progress', `${Math.round(p * 100)}%`));
      q('[data-vbar]').style.setProperty('--progress', '100%'); addResult(q('[data-vout]'), `${vfile.name.replace(/\.[^.]+$/, '')}.${fmt}`, blob); vmsg('Done.');
    } catch (e) { vmsg(`✗ ${e.message}`); } finally { busyV = false; q('[data-vgo]').disabled = false; }
  });
}

/* ---------- Document Tools ---------- */
/* ---------- Document Tools (PDF, images, Word, Excel, CSV, PowerPoint, text, HTML) ---------- */
const LIBS = { xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js' };
const extOf = (f) => (f.name.split('.').pop() || '').toLowerCase();
const OFFICE_EXT = ['docx', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json', 'html', 'htm', 'pptx'];
function cleanHtml(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
  return d.body.innerHTML;
}
async function officeSource(f) {
  const e = extOf(f);
  if (e === 'docx') { await loadScript(LIBS.mammoth); const ab = await f.arrayBuffer(); return { html: (await window.mammoth.convertToHtml({ arrayBuffer: ab })).value, text: (await window.mammoth.extractRawText({ arrayBuffer: ab })).value }; }
  if (['xlsx', 'xls', 'csv'].includes(e)) {
    await loadScript(LIBS.xlsx); const X = window.XLSX; const wb = e === 'csv' ? X.read(await f.text(), { type: 'string' }) : X.read(await f.arrayBuffer(), { type: 'array' });
    return { html: wb.SheetNames.map((n) => `<h3>${esc(n)}</h3>${X.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}`).join(''), text: wb.SheetNames.map((n) => `# ${n}\n${X.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n'), landscape: true };
  }
  if (e === 'pptx') {
    await loadScript(LIBS.zip); const z = await window.JSZip.loadAsync(await f.arrayBuffer()); const num = (n) => parseInt(n.match(/\d+/g).pop(), 10);
    const names = Object.keys(z.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b)); const slides = [];
    for (const n of names) { const x = new DOMParser().parseFromString(await z.files[n].async('string'), 'text/xml'); slides.push([...x.getElementsByTagName('a:p')].map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent).join('')).filter(Boolean)); }
    return { html: slides.map((p, i) => `<div class="slide"><small>Slide ${i + 1}</small><h2>${esc(p[0] || '')}</h2>${p.slice(1).map((s) => `<p>• ${esc(s)}</p>`).join('')}</div>`).join(''), text: slides.map((p, i) => `Slide ${i + 1}\n${p.join('\n')}`).join('\n\n'), landscape: true, slides: true };
  }
  if (e === 'html' || e === 'htm') { const html = cleanHtml(await f.text()); const t = document.createElement('div'); t.innerHTML = html; return { html, text: t.textContent }; }
  const t = await f.text(); return { html: `<pre style="white-space:pre-wrap;font:13px/1.5 Consolas,monospace">${esc(t)}</pre>`, text: t };
}
async function htmlPages(src) {
  await loadScript(LIBS.h2c); const W = src.landscape ? 1123 : 794; const H = Math.round(W * (src.landscape ? 0.7071 : 1.4142));
  const box = document.createElement('div'); box.className = 'doc-render'; box.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;background:#fff;color:#111;padding:${src.slides ? 0 : 48}px;box-sizing:border-box;font:14px/1.55 Arial,'Noto Sans',sans-serif`;
  box.innerHTML = src.html.replace(/class="slide"/g, `class="slide" style="height:${H}px"`); document.body.append(box);
  try {
    const sc = Math.max(0.4, Math.min(1.5, 30000 / Math.max(1, box.scrollHeight))); const big = await window.html2canvas(box, { scale: sc, backgroundColor: '#fff', useCORS: true }); const ph = Math.floor((H * big.width) / W); const pages = [];
    for (let y = 0; y < big.height; y += ph) { const h = Math.min(ph, big.height - y); const c = document.createElement('canvas'); c.width = big.width; c.height = ph; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(big, 0, y, big.width, h, 0, 0, big.width, h); pages.push({ c, landscape: !!src.landscape }); }
    return pages;
  } finally { box.remove(); }
}
/* Word (.docx) from plain text, built with JSZip: no extra library needed */
async function docxBlob(text) {
  await loadScript(LIBS.zip); const z = new window.JSZip(); const hd = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const x = (s) => esc(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  z.file('[Content_Types].xml', `${hd}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file('_rels/.rels', `${hd}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file('word/document.xml', `${hd}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split(/\r?\n/).map((l) => `<w:p>${/^=== .* ===$/.test(l) ? '<w:r><w:rPr><w:b/></w:rPr>' : '<w:r>'}<w:t xml:space="preserve">${x(l.replace(/^=== | ===$/g, ''))}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
/* OCR: reads text from scanned PDFs and photos on the device (tesseract.js, loaded on first use) */
async function ocrFiles(files, lang, say, bar) {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); say('Loading the text reader (the first run downloads language data)…');
  const w = await window.Tesseract.createWorker(lang); const out = []; let done = 0;
  try {
    for (const f of files) {
      if (isPdf(f)) { const d = await pdfDoc(await f.arrayBuffer()); const n = Math.min(d.numPages, 30); for (let i = 1; i <= n; i += 1) { say(`Reading ${f.name}, page ${i}/${n}…`); out.push(`=== ${f.name} — page ${i} ===\n${(await w.recognize(await renderPage(d, i, 2))).data.text.trim()}`); } if (d.numPages > n) out.push(`[${f.name}: only the first ${n} pages were read]`); }
      else if (f.type.startsWith('image/') || isHeic(f)) { say(`Reading ${f.name}…`); out.push(`=== ${f.name} ===\n${(await w.recognize(await toCanvas(f))).data.text.trim()}`); }
      done += 1; bar(Math.round((done / files.length) * 100));
    }
  } finally { await w.terminate(); }
  return out.join('\n\n');
}
function docTool(el) {
  const OUT = {
    'Combine & convert': { pdf: 'Merge into one PDF', pptx: 'PowerPoint (.pptx)', word: 'Word (.doc, keeps images)', docx: 'Word (.docx, text only)', text: 'Plain text (.txt)', ocr: 'Text from scans (OCR, .txt)', xlsx: 'Excel (.xlsx) from CSV or Excel', csv: 'CSV from Excel sheets' },
    'Pages': { split: 'Split: one PDF per page', splitr: 'Split by ranges (1-3, 4-6…)', delete: 'Remove pages', reverse: 'Reverse page order', images: 'Pages to images (PNG)', jpg: 'Pages to images (JPG)' },
    'Improve': { compress: 'Compress PDF', numbers: 'Add page numbers', mark: 'Add text watermark' },
  };
  const PDFK = ['pdf', 'split', 'splitr', 'delete', 'reverse', 'images', 'jpg', 'compress', 'pptx', 'numbers', 'mark'];
  const FOR = { range: PDFK, rot: PDFK, lvl: ['compress'], mark: ['mark'], ocr: ['ocr'] };
  const HINT0 = 'Files are joined in the order shown. Word, Excel and PowerPoint pages become page images in PDF outputs (layout kept, text not selectable). Old .doc/.ppt files: save as .docx/.pptx first.';
  const HINTS = {
    docx: 'Makes a clean Word file with the text only (no pictures or layout). Use the .doc option to keep scanned pages as images.', text: 'Pulls out the selectable text. For scanned pages use “Text from scans (OCR)”.',
    ocr: 'Reads text from scanned PDFs and photos on your device (first 30 pages of each PDF). The first run downloads language data, so it needs internet. Accuracy depends on scan quality.',
    delete: 'Type the pages to delete, e.g. 2, 5-7. All files are merged first, then those pages are removed.', splitr: 'Each comma-separated range becomes its own PDF, e.g. 1-3, 4-6, 7.',
    reverse: 'Flips the page order (last page first). Use “Only these pages” to reverse just part of the file.', numbers: 'Adds “1 / N” at the bottom centre of every page.',
    mark: 'Adds a faint diagonal text across every page. Use English letters and numbers.', compress: 'Pages are re-saved as images to shrink the file, so text stops being selectable. Maximum gives the smallest file.',
    xlsx: 'Spreadsheets only: CSV becomes an Excel file (.xlsx).', csv: 'Spreadsheets only: every Excel sheet becomes its own CSV file.',
  };
  const NAMES = { pdf: 'merged.pdf', delete: 'pages-removed.pdf', reverse: 'reversed.pdf', numbers: 'numbered.pdf', mark: 'watermarked.pdf' };
  el.innerHTML = `${dropHtml('Drop PDF, Word, Excel, CSV, PowerPoint, images, text or HTML files — mix as you like')}<div class="list" data-files></div>
    <div class="opt-grid"><label>Create <select class="select-field" data-o>${Object.entries(OUT).map(([g, o]) => `<optgroup label="${g}">${Object.entries(o).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label data-for="range"><span data-rl>Only these pages</span> <input class="field" data-range placeholder="e.g. 1-3, 5 (optional)" /></label>
    <label data-for="rot">Rotate pages <select class="select-field" data-rot><option value="0">No</option><option value="90">90° right</option><option value="180">180°</option><option value="270">90° left</option></select></label>
    <label data-for="lvl">Compression <select class="select-field" data-lvl><option value="0">Light</option><option value="1" selected>Balanced</option><option value="2">Maximum</option></select></label>
    <label data-for="mark">Watermark text <input class="field" data-mark value="CONFIDENTIAL" maxlength="40" /></label>
    <label data-for="ocr">Language in the scan <select class="select-field" data-ocrl>${[['eng', 'English'], ['hin', 'Hindi'], ['kan', 'Kannada'], ['tam', 'Tamil'], ['tel', 'Telugu'], ['mal', 'Malayalam'], ['mar', 'Marathi'], ['ben', 'Bengali'], ['guj', 'Gujarati'], ['pan', 'Punjabi'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German']].map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select></label></div>
    <p class="hint" data-hint></p>
    <div class="row"><button class="btn primary" data-go>Create</button><button class="chip" data-zip hidden>Save all (ZIP)</button><button class="chip" data-clear>Clear files</button><span class="hint" data-msg></span></div><div class="progress-rail"><span class="progress-fill" data-bar style="--progress:0%"></span></div><div class="list" data-res></div>`;
  let files = []; let busyD = false; const q = (s) => $(s, el); const msg = (t) => { q('[data-msg]').textContent = t; }; const bar = (p) => q('[data-bar]').style.setProperty('--progress', `${p}%`);
  const sync = () => { const k = q('[data-o]').value; $$('[data-for]', el).forEach((l) => { l.hidden = !FOR[l.dataset.for].includes(k); }); q('[data-rl]').textContent = k === 'delete' ? 'Pages to remove' : k === 'splitr' ? 'Ranges, e.g. 1-3, 4-6' : 'Only these pages'; q('[data-hint]').textContent = HINTS[k] || HINT0; };
  q('[data-o]').addEventListener('change', sync); sync();
  const paint = () => { q('[data-files]').innerHTML = files.map((f, i) => `<div class="list-row"><span class="grow">${esc(f.name)} <small>${fmtBytes(f.size)}</small></span><button class="chip" data-up="${i}" aria-label="Move up">↑</button><button class="chip" data-rm="${i}" aria-label="Remove">✕</button></div>`).join(''); };
  q('[data-files]').addEventListener('click', (e) => { const u = e.target.closest('[data-up]'); const r = e.target.closest('[data-rm]'); if (u && +u.dataset.up > 0) { const i = +u.dataset.up; [files[i - 1], files[i]] = [files[i], files[i - 1]]; } if (r) files.splice(+r.dataset.rm, 1); paint(); });
  q('[data-clear]').addEventListener('click', () => { files = []; paint(); q('[data-res]').innerHTML = ''; q('[data-zip]').hidden = true; msg(''); bar(0); });
  q('[data-zip]').addEventListener('click', async () => { try { await loadScript(LIBS.zip); const z = new window.JSZip(); for (const a of $$('a[download]', q('[data-res]'))) z.file(a.download, await (await fetch(a.href)).blob()); download(await z.generateAsync({ type: 'blob' }), 'wizos-files.zip'); } catch (e) { msg(`✗ ${e.message}`); } });
  wireDrop(el, (fs) => {
    const ok = fs.filter((f) => isPdf(f) || f.type.startsWith('image/') || isHeic(f) || OFFICE_EXT.includes(extOf(f))); const bad = fs.length - ok.length;
    files = [...files, ...ok]; paint(); if (bad) msg(`${bad} file(s) skipped — unsupported type (old .doc/.ppt need saving as .docx/.pptx).`);
  }, '.pdf,application/pdf,image/*,.heic,.heif,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html,.htm,.pptx');
  const parts = async (kind) => {
    const out = [];
    for (const f of files) {
      if (isPdf(f)) { const d = await pdfDoc(await f.arrayBuffer()); for (let i = 1; i <= d.numPages; i += 1) { const t = (await (await d.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ').trim(); out.push({ name: `${f.name} — page ${i}`, text: t, img: !t && kind === 'word' && i <= 30 ? (await renderPage(d, i, 1.2)).toDataURL('image/jpeg', 0.7) : '' }); } }
      else if (f.type.startsWith('image/') || isHeic(f)) out.push({ name: f.name, text: '', img: kind === 'word' ? (await toCanvas(f)).toDataURL('image/jpeg', 0.8) : '' });
      else out.push({ name: f.name, text: (await officeSource(f)).text });
    }
    return out;
  };
  q('[data-go]').addEventListener('click', async () => {
    if (busyD) return; if (!files.length) return msg('Add at least one file.'); if (files.reduce((n, f) => n + f.size, 0) > 250 * 1048576) return msg('These files add up to over 250 MB, which is too much for the browser. Try fewer or smaller files.');
    const res = q('[data-res]'); res.innerHTML = ''; q('[data-zip]').hidden = true; const kind = q('[data-o]').value; bar(0); busyD = true; q('[data-go]').disabled = true;
    const pdfBlob = (b) => new Blob([b], { type: 'application/pdf' });
    try {
      if (kind === 'xlsx' || kind === 'csv') {
        const tab = files.filter((f) => ['xlsx', 'xls', 'csv'].includes(extOf(f))); if (!tab.length) return msg('Add an Excel or CSV file for this option.');
        await loadScript(LIBS.xlsx); const X = window.XLSX;
        for (const [i, f] of tab.entries()) {
          msg(`Converting ${f.name}…`); const e = extOf(f); const wb = e === 'csv' ? X.read(await f.text(), { type: 'string' }) : X.read(await f.arrayBuffer(), { type: 'array' }); const base = f.name.replace(/\.[^.]+$/, '');
          if (kind === 'xlsx') addResult(res, `${base}.xlsx`, new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
          else wb.SheetNames.forEach((n) => addResult(res, wb.SheetNames.length > 1 ? `${base}-${n.replace(/[\\/:*?"<>|]/g, '_')}.csv` : `${base}.csv`, new Blob([`\ufeff${X.utils.sheet_to_csv(wb.Sheets[n])}`], { type: 'text/csv' }), `· sheet “${n}”`));
          bar(Math.round(((i + 1) / tab.length) * 100));
        }
        return msg('Done.');
      }
      if (kind === 'ocr') {
        if (!files.some((f) => isPdf(f) || f.type.startsWith('image/') || isHeic(f))) return msg('Add a scanned PDF or an image for OCR.');
        const t = await ocrFiles(files, q('[data-ocrl]').value, msg, bar); addResult(res, 'scanned-text.txt', new Blob([t], { type: 'text/plain' }), t.replace(/=== .* ===|\s/g, '') ? '' : '· no text found'); bar(100); return msg('Done.');
      }
      if (kind === 'text' || kind === 'word' || kind === 'docx') {
        msg('Reading files…'); const ps = await parts(kind); const empty = ps.every((p) => !p.text && !p.img);
        const plain = ps.map((p) => `=== ${p.name} ===\n${p.text || '[no selectable text]'}`).join('\n\n');
        if (kind === 'text') addResult(res, 'document.txt', new Blob([plain], { type: 'text/plain' }), empty ? '· no selectable text found — try OCR' : '');
        else if (kind === 'docx') addResult(res, 'document.docx', await docxBlob(plain), empty ? '· no selectable text found — try OCR' : '· opens in Word');
        else addResult(res, 'document.doc', new Blob([`<html><head><meta charset="utf-8"></head><body>${ps.map((p) => `<h2>${esc(p.name)}</h2>${p.text ? `<p>${esc(p.text).replace(/\n/g, '<br>')}</p>` : ''}${p.img ? `<p><img src="${p.img}" width="600"></p>` : ''}`).join('')}</body></html>`], { type: 'application/msword' }), '· opens in Word');
        bar(100); return msg('Done.');
      }
      await loadScript(PDFLIB); const { PDFDocument, degrees, StandardFonts, rgb } = window.PDFLib; let out = await PDFDocument.create();
      for (let k = 0; k < files.length; k += 1) {
        const f = files[k]; msg(`Reading ${f.name}…`); bar(Math.round((k / files.length) * 40));
        if (isPdf(f)) { const s = await PDFDocument.load(await f.arrayBuffer()); (await out.copyPages(s, s.getPageIndices())).forEach((p) => out.addPage(p)); }
        else if (f.type.startsWith('image/') || isHeic(f)) { const c = await toCanvas(f); const im = await out.embedJpg(await (await blobOf(c, 'image/jpeg', 0.92)).arrayBuffer()); out.addPage([c.width, c.height]).drawImage(im, { x: 0, y: 0, width: c.width, height: c.height }); }
        else { for (const { c, landscape } of await htmlPages(await officeSource(f))) { const im = await out.embedJpg(await (await blobOf(c, 'image/jpeg', 0.9)).arrayBuffer()); const pw = landscape ? 841.89 : 595.28; const ph = (pw * c.height) / c.width; out.addPage([pw, ph]).drawImage(im, { x: 0, y: 0, width: pw, height: ph }); } }
      }
      const range = q('[data-range]').value.trim(); const total = out.getPageCount(); const pick = async (idx) => { const o2 = await PDFDocument.create(); (await o2.copyPages(out, idx)).forEach((p) => o2.addPage(p)); return o2; };
      if (kind === 'delete') { const del = parseRange(range, total); if (!del.length) return msg(`Type the pages to remove (1–${total}).`); if (del.length >= total) return msg('That would remove every page.'); out = await pick([...Array(total).keys()].filter((i) => !del.includes(i))); }
      else if (kind === 'reverse') { const all = [...Array(total).keys()]; const idx = range ? parseRange(range, total).sort((a, b) => a - b) : all.slice(); if (!idx.length) return msg(`Enter valid pages (1–${total}).`); const rev = idx.slice().reverse(); idx.forEach((p, i) => { all[p] = rev[i]; }); out = await pick(all); }
      else if (kind !== 'splitr' && range) { const idx = parseRange(range, total); if (!idx.length) return msg(`Enter valid pages (1–${total}).`); out = await pick(idx); }
      const rot = +q('[data-rot]').value; if (rot) out.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + rot) % 360)));
      if (kind === 'splitr') {
        const groups = range.split(',').map((g) => parseRange(g, total)).filter((g) => g.length); if (!groups.length) return msg(`Type the ranges to split at, e.g. 1-3, 4-6 (pages 1–${total}).`);
        for (const [gi, g] of groups.entries()) { const d = await PDFDocument.create(); (await d.copyPages(out, g)).forEach((p) => d.addPage(p)); addResult(res, `part-${gi + 1}.pdf`, pdfBlob(await d.save()), `· ${g.length} page(s)`); bar(Math.round(((gi + 1) / groups.length) * 100)); }
        return msg('Done.');
      }
      if (kind === 'numbers' || kind === 'mark') {
        const txt = q('[data-mark]').value.trim(); if (kind === 'mark' && !txt) return msg('Type the watermark text.');
        const font = await out.embedFont(kind === 'mark' ? StandardFonts.HelveticaBold : StandardFonts.Helvetica); const pgs = out.getPages();
        pgs.forEach((p, i) => {
          const { width, height } = p.getSize();
          if (kind === 'numbers') { const t = `${i + 1} / ${pgs.length}`; p.drawText(t, { x: (width - font.widthOfTextAtSize(t, 10)) / 2, y: 18, size: 10, font, color: rgb(0.25, 0.25, 0.25) }); return; }
          const s = Math.min(80, (0.7 * Math.hypot(width, height)) / font.widthOfTextAtSize(txt, 1)); const w = font.widthOfTextAtSize(txt, s); const h = s * 0.7; const r = Math.PI / 4;
          p.drawText(txt, { x: width / 2 - (w / 2) * Math.cos(r) + (h / 2) * Math.sin(r), y: height / 2 - (w / 2) * Math.sin(r) - (h / 2) * Math.cos(r), size: s, font, color: rgb(0.5, 0.5, 0.5), opacity: 0.22, rotate: degrees(45) });
        });
      }
      const bytes = await out.save(); const n = out.getPageCount(); bar(50);
      if (NAMES[kind]) addResult(res, NAMES[kind], pdfBlob(bytes), `· ${n} pages`);
      if (kind === 'split') { const src = await PDFDocument.load(bytes); for (let i = 0; i < n; i += 1) { const d = await PDFDocument.create(); d.addPage((await d.copyPages(src, [i]))[0]); addResult(res, `page-${i + 1}.pdf`, pdfBlob(await d.save())); bar(50 + Math.round(((i + 1) / n) * 50)); } }
      if (['images', 'jpg', 'compress', 'pptx'].includes(kind)) {
        const doc = await pdfDoc(bytes.slice()); const lvl = +q('[data-lvl]').value;
        if (kind === 'images' || kind === 'jpg') for (let i = 1; i <= n; i += 1) { msg(`Rendering page ${i}/${n}…`); const c = await renderPage(doc, i, 2); addResult(res, `page-${i}.${kind === 'jpg' ? 'jpg' : 'png'}`, kind === 'jpg' ? await blobOf(c, 'image/jpeg', 0.9) : await blobOf(c), '', thumbOf(c)); bar(50 + Math.round((i / n) * 50)); }
        if (kind === 'compress') {
          const [scale, qual] = [[1.8, 0.8], [1.3, 0.62], [1, 0.45]][lvl]; const d = await PDFDocument.create();
          for (let i = 1; i <= n; i += 1) { msg(`Compressing page ${i}/${n}…`); const c = await renderPage(doc, i, scale); const im = await d.embedJpg(await (await blobOf(c, 'image/jpeg', qual)).arrayBuffer()); d.addPage([c.width / scale, c.height / scale]).drawImage(im, { x: 0, y: 0, width: c.width / scale, height: c.height / scale }); bar(50 + Math.round((i / n) * 50)); }
          addResult(res, 'compressed.pdf', pdfBlob(await d.save()), `· was ${fmtBytes(bytes.length)} (text becomes images)`);
        }
        if (kind === 'pptx') {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'); const p = new window.PptxGenJS(); const first = await renderPage(doc, 1, 1); p.defineLayout({ name: 'DOC', width: 10, height: (10 * first.height) / first.width }); p.layout = 'DOC';
          for (let i = 1; i <= n; i += 1) { msg(`Building slide ${i}/${n}…`); const c = await renderPage(doc, i, 1.6); p.addSlide().addImage({ data: c.toDataURL('image/jpeg', 0.85), x: 0, y: 0, w: 10, h: (10 * c.height) / c.width }); bar(50 + Math.round((i / n) * 50)); }
          addResult(res, 'document.pptx', await p.write('blob'), `· ${n} slides`);
        }
      }
      bar(100); msg('Done.');
    } catch (e) { msg(`✗ ${/encrypt/i.test(e.message) ? 'A PDF is encrypted or damaged.' : /WinAnsi|encode/i.test(e.message) ? 'The watermark supports English letters, numbers and common symbols only.' : e.message}`); } finally { busyD = false; q('[data-go]').disabled = false; q('[data-zip]').hidden = $$('a[download]', res).length < 2; }
  });
}

/* ---------- Footer pages (About / Contact / Privacy) ---------- */
const CONTACT_EMAIL = ''; // put your public contact email here, e.g. 'hello@example.com'
const REPO_URL = 'https://github.com/sridhar-creatorK/Tech-And-Tools';
const INFO = {
  about: ['About WizOS', '<p>WizOS is a free workspace of everyday tech tools — documents, media, writing and AI helpers — in one place. It is part of <b>Tech Tool Wiz</b>, made by Sridhar Kulkarni.</p><p>Most tools run entirely inside your browser, so your files stay on your device.</p>'],
  contact: ['Contact', CONTACT_EMAIL ? `<p>Questions, ideas or bugs? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>` : `<p>Found a bug or have an idea? Please open an issue on the <a href="${REPO_URL}/issues" target="_blank" rel="noopener noreferrer">project page on GitHub</a>.</p>`],
  privacy: ['Privacy Policy', '<p><b>Your files stay with you.</b> Converting, merging, compressing, comparing and recording happen inside your browser. Files are not uploaded.</p><p><b>Saved data.</b> Notes, canvas blocks, chats and your daily usage counters are stored in your own browser. Clearing your browser data removes them.</p><p><b>Tools that use online services.</b> Only the text you submit is sent, and only to the service that answers:</p><ul><li><b>AI Assistant, Letter &amp; Form Writer, Web Tricks coach:</b> Cloudflare Workers AI (main). If it is busy, backups take over: Groq and Google Gemini through our Worker, then Pollinations, then your browser’s built-in AI if available.</li><li><b>Our Worker</b> does not store your text. It keeps only a request counter per connection to enforce fair-use limits.</li><li><b>Grammar check:</b> LanguageTool (main), then backup AI proofreaders (Pollinations, Cloudflare Workers AI), then your browser’s built-in AI.</li><li><b>Translate:</b> your browser’s on-device translator (main), then MyMemory, then backup AI translators (Pollinations, Cloudflare Workers AI).</li><li><b>Voice typing:</b> your browser’s speech service.</li></ul><p>Some tools download helper libraries and AI model files from public CDNs. Do not enter passwords or other secrets in the online tools.</p><p><b>Fair-use limits.</b> Each AI tool has a daily limit so the free service stays available for everyone.</p><p><b>No accounts, no ads.</b> WizOS does not ask you to sign up and does not add advertising. Fonts are loaded from Google Fonts.</p>'],
  terms: ['Terms & Copyright', '<p><b>© 2026 Tech Tool Wiz. All rights reserved.</b></p><p>WizOS, the Tech Tool Wiz name and logo, the design, text and source code of this website are owned by Sridhar Kulkarni / Tech Tool Wiz. You may not copy, reproduce, republish, sell, distribute or build a competing service from them without written permission.</p><p><b>Your content.</b> Files, text and results you create with WizOS belong to you. We do not claim any rights over them.</p><p><b>Third-party software.</b> WizOS uses open-source libraries under their own licences, including pdf-lib, PDF.js, SheetJS, html2canvas, JSZip, mammoth.js, PptxGenJS, heic2any, FFmpeg.wasm, QRCode.js, the IMG.LY background-removal model and Font Awesome. Their names and marks belong to their owners.</p><p><b>Trademarks.</b> All other product names, logos and brands mentioned are trademarks of their respective owners and are used only to identify them. No endorsement is implied.</p><p><b>No warranty.</b> WizOS is provided “as is”, free of charge. AI answers, translations and grammar suggestions can contain mistakes, so check anything important (letters, forms, legal or financial text) before you use it. We are not liable for loss or damage arising from the use of the tools.</p><p>To ask for permission or report a copyright concern, use the Contact page.</p>'],
};
let infoOpener = null;
const closeInfo = () => { const m = $('#infoModal'); if (m.hidden) return; m.hidden = true; infoOpener?.focus(); infoOpener = null; };
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-info]'); const modal = $('#infoModal');
  if (b && INFO[b.dataset.info]) { const [t, body] = INFO[b.dataset.info]; infoOpener = b; $('#infoTitle').textContent = t; $('#infoBody').innerHTML = body; modal.hidden = false; $('#infoClose').focus(); return; }
  if (e.target === modal || e.target.closest('#infoClose')) closeInfo();
});

/* ---------- Compare ---------- */
function pixelDiff(ca, cb, th) {
  const w = ca.width; const h = ca.height; const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, w, h); tx.drawImage(cb, 0, 0, w, h);
  const A = ca.getContext('2d').getImageData(0, 0, w, h).data; const B = tx.getImageData(0, 0, w, h).data; const out = new ImageData(w, h); let n = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > th) { out.data.set([255, 30, 90, 255], i); n += 1; } else { const g = ((A[i] + A[i + 1] + A[i + 2]) / 3) * 0.3 + 165; out.data.set([g, g, g, 255], i); }
  }
  const dc = document.createElement('canvas'); dc.width = w; dc.height = h; dc.getContext('2d').putImageData(out, 0, 0); return { canvas: dc, pct: (n * 100) / (w * h) };
}
function seqDiff(a, b) {
  const n = a.length; const m = b.length; const W = m + 1; const L = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) L[i * W + j] = a[i] === b[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const o = []; let i = 0; let j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { o.push(['=', a[i]]); i += 1; j += 1; } else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { o.push(['-', a[i]]); i += 1; } else { o.push(['+', b[j]]); j += 1; } }
  while (i < n) { o.push(['-', a[i]]); i += 1; } while (j < m) { o.push(['+', b[j]]); j += 1; } return o;
}
function compareTool(el) {
  const ACC = { img: 'image/*,.heic,.dwg,.dxf,.psd,.ai', pdf: 'application/pdf', doc: '.txt,.md,.csv,.json,.html,.docx' };
  el.innerHTML = `<div class="tabs">${[['img', 'Images & designs'], ['pdf', 'PDF'], ['doc', 'Word / text']].map(([k, l], i) => `<button class="tab ${i ? '' : 'is-on'}" data-m="${k}">${l}</button>`).join('')}</div>
    <div class="two"><div class="drop" data-pick="a" tabindex="0"><i class="fa-solid fa-file"></i><span>Original file</span><input type="file" hidden /></div><div class="drop" data-pick="b" tabindex="0"><i class="fa-solid fa-file-pen"></i><span>New version</span><input type="file" hidden /></div></div>
    <div class="row"><label>Sensitivity <input type="range" min="5" max="120" value="30" data-th /></label><button class="btn primary" data-go>Compare</button><span class="hint" data-msg></span></div><div class="stack-gap" data-out></div>`;
  let mode = 'img'; const file = {}; const msg = (t) => { $('[data-msg]', el).textContent = t; }; const out = $('[data-out]', el);
  $$('[data-pick]', el).forEach((box) => {
    const inp = $('input', box); const set = (f) => { if (!f) return; file[box.dataset.pick] = f; $('span', box).textContent = f.name; };
    box.onclick = () => { inp.accept = ACC[mode]; inp.click(); }; inp.onchange = () => set(inp.files[0]);
    box.ondragover = (e) => { e.preventDefault(); box.classList.add('over'); }; box.ondragleave = () => box.classList.remove('over'); box.ondrop = (e) => { e.preventDefault(); box.classList.remove('over'); set(e.dataTransfer.files[0]); };
  });
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { mode = t.dataset.m; $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); out.innerHTML = ''; msg(''); }));
  const fig = (c, cap) => { const f = document.createElement('figure'); f.className = 'cmp'; c.className = 'cmp-canvas'; const k = document.createElement('figcaption'); k.textContent = cap; f.append(c, k); return f; };
  const textOf = async (f) => { if (/\.docx$/i.test(f.name)) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'); return (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; } return f.text(); };
  $('[data-go]', el).addEventListener('click', async () => {
    if (!file.a || !file.b) return msg('Choose both files.'); out.innerHTML = ''; const th = +$('[data-th]', el).value; msg('Comparing…');
    try {
      if (mode === 'img') {
        if ([file.a, file.b].some((f) => /\.(dwg|dxf|psd|ai)$/i.test(f.name))) return msg('CAD and layered design files (DWG, DXF, PSD, AI) cannot be opened in a browser. Export both as PDF or PNG from your design app, then compare them here.');
        const a = await toCanvas(file.a); const b = await toCanvas(file.b); const r = pixelDiff(a, b, th); const row = document.createElement('div'); row.className = 'cmp-row'; row.append(fig(a, 'Original'), fig(b, 'New version'), fig(r.canvas, `Differences (red) — ${r.pct.toFixed(2)}% changed`)); out.append(row);
        msg(r.pct === 0 ? 'No visible difference.' : `${r.pct.toFixed(2)}% of pixels differ.${a.width !== b.width || a.height !== b.height ? ' Sizes differ, so the new version was scaled to match.' : ''}`);
      } else if (mode === 'pdf') {
        const da = await pdfDoc(await file.a.arrayBuffer()); const db = await pdfDoc(await file.b.arrayBuffer()); const n = Math.min(da.numPages, db.numPages); let changed = 0;
        for (let i = 1; i <= n; i += 1) { msg(`Comparing page ${i}/${n}…`); const r = pixelDiff(await renderPage(da, i, 1.2), await renderPage(db, i, 1.2), th); if (r.pct > 0.02) { changed += 1; out.append(fig(r.canvas, `Page ${i} — ${r.pct.toFixed(2)}% changed (red)`)); } }
        msg(`${changed} of ${n} page(s) changed.${da.numPages !== db.numPages ? ` Page counts differ (${da.numPages} vs ${db.numPages}).` : ''}`);
      } else {
        const ta = await textOf(file.a); const tb = await textOf(file.b); let tok = (s) => s.split(/(\s+)/); if (tok(ta).length * tok(tb).length > 6e6) tok = (s) => s.split(/(\n)/);
        if (tok(ta).length * tok(tb).length > 6e6) throw new Error('These files are too large to compare in the browser. Try comparing smaller parts.');
        const ops = seqDiff(tok(ta), tok(tb)); let add = 0; let del = 0;
        const html = ops.map(([t, s]) => (t === '=' ? esc(s) : t === '+' ? (s.trim() ? (add += 1, `<ins style="background:rgba(34,197,94,.5);text-decoration:none;border-radius:3px">${esc(s)}</ins>`) : esc(s)) : (s.trim() ? (del += 1, `<del style="background:rgba(239,68,68,.55);border-radius:3px">${esc(s)}</del>`) : ''))).join('');
        out.innerHTML = `<div class="panel-card diff-doc">${html}</div>`; msg(`${add} addition(s) in green, ${del} deletion(s) in red.`);
      }
    } catch (e) { msg(`✗ ${e.message}`); }
  });
}

const b64u = (s) => { let bin = ''; const u = new TextEncoder().encode(s); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(bin); };
const b64uClean = (b) => b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64url = (s) => b64uClean(b64u(s));
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const wq = (s = '') => s.replace(/([\\;,:"])/g, '\\$1');
const vq = (s = '') => String(s).replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
const QR_KINDS = {
  text: { label: 'Text, name or word', f: [['t', 'Type anything…', 'area']], out: (v) => v.t },
  url: { label: 'Website link', f: [['u', 'https://example.com']], out: (v) => v.u && (/^[a-z]+:/i.test(v.u) ? v.u : `https://${v.u}`) },
  page: { label: 'Web page (opens when scanned)', f: [['title', 'Page title'], ['body', 'Page text — links become clickable', 'area']], out: (v) => (v.title || v.body ? `${location.origin}${location.pathname}#share=${b64url(JSON.stringify({ t: v.title || '', b: v.body || '' }))}` : '') },
  wifi: { label: 'Wi-Fi', f: [['ssid', 'Network name'], ['pw', 'Password'], ['sec', '', 'sel:WPA,WEP,nopass']], out: (v) => (v.ssid ? `WIFI:T:${v.sec};S:${wq(v.ssid)};${v.sec === 'nopass' ? '' : `P:${wq(v.pw)};`};` : '') },
  contact: { label: 'Contact card', f: [['name', 'Full name'], ['phone', 'Phone'], ['email', 'Email'], ['org', 'Company']], out: (v) => (v.name ? `BEGIN:VCARD\nVERSION:3.0\nFN:${vq(v.name)}\nTEL:${vq(v.phone)}\nEMAIL:${vq(v.email)}\nORG:${vq(v.org)}\nEND:VCARD` : '') },
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
  let qrTok = 0;
  const make = async () => {
    const my = ++qrTok; msg.textContent = ''; box.innerHTML = '';
    const payload = QR_KINDS[$('[data-k]', el).value].out(values()); if (!payload) return;
    if ($('[data-k]', el).value === 'page' && !/^https?:$/.test(location.protocol)) msg.textContent = 'Web-page codes only work once WizOS is hosted online.';
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'); if (my !== qrTok) return; const s = +$('[data-s]', el).value;
      new window.QRCode(box, { text: payload, width: s, height: s, correctLevel: payload.length > 350 ? window.QRCode.CorrectLevel.L : window.QRCode.CorrectLevel.M });
    } catch (err) { box.innerHTML = ''; msg.textContent = /overflow/i.test(err.message) ? 'Too much content for one QR code (about 2,000 characters max).' : err.message; }
  };
  const fields = () => {
    $('[data-fields]', el).innerHTML = QR_KINDS[$('[data-k]', el).value].f.map(([n, ph, t = '']) => (t === 'area' ? `<textarea class="textarea-panel small" data-n="${n}" placeholder="${ph}" aria-label="${ph}"></textarea>` : t.startsWith('sel:') ? `<select class="select-field" data-n="${n}" aria-label="Security">${t.slice(4).split(',').map((o) => `<option>${o}</option>`).join('')}</select>` : `<input class="field" data-n="${n}" placeholder="${ph}" aria-label="${ph}" />`)).join('');
    $$('[data-n]', el).forEach((i) => i.addEventListener('input', make)); make();
  };
  $('[data-k]', el).addEventListener('change', fields); $('[data-s]', el).addEventListener('change', make);
  $('[data-dl]', el).addEventListener('click', () => { const c = $('canvas', box); if (c) c.toBlob((b) => b && download(b, 'qr-code.png')); else msg.textContent = 'Type something first, then download.'; });
  fields();
}

function recorderTool(el) {
  el.innerHTML = `<div class="row"><label class="chip"><input type="checkbox" data-aud checked /> Include tab/system audio</label><label class="chip"><input type="checkbox" data-mic /> Include microphone</label></div><div class="row"><button class="btn primary" data-go>Start recording</button><span class="hint" data-msg></span></div><video class="rec-video" data-v controls playsinline hidden></video><div class="row"><a class="btn primary" data-dl hidden>Download recording</a></div>`;
  let rec = null; let lastUrl = ''; const go = $('[data-go]', el); const msg = $('[data-msg]', el);
  const pickType = () => ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  go.addEventListener('click', async () => {
    if (rec && rec.state !== 'inactive') { rec.stop(); return; }
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) { msg.textContent = 'Screen recording is not supported in this browser (try Chrome, Edge or Firefox on a computer).'; return; }
    const streams = [];
    try {
      streams.push(await navigator.mediaDevices.getDisplayMedia({ video: true, audio: $('[data-aud]', el).checked })); const tracks = [...streams[0].getTracks()];
      if ($('[data-mic]', el).checked) { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); streams.push(m); tracks.push(...m.getAudioTracks()); }
      const chunks = []; const type = pickType(); rec = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        if (!chunks.length) { go.textContent = 'Start recording'; msg.textContent = 'Nothing was recorded.'; return; }
        const mime = rec.mimeType || type || 'video/webm'; if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(new Blob(chunks, { type: mime }));
        const v = $('[data-v]', el); v.src = lastUrl; v.hidden = false; const dl = $('[data-dl]', el); dl.href = lastUrl; dl.download = `recording.${/mp4/.test(mime) ? 'mp4' : 'webm'}`; dl.removeAttribute('data-saved'); dl.hidden = false; go.textContent = 'Start recording'; msg.textContent = 'Recording ready.';
      };
      streams[0].getVideoTracks()[0].onended = () => { if (rec && rec.state !== 'inactive') rec.stop(); };
      rec.start(1000); go.textContent = 'Stop recording'; msg.textContent = '● Recording…';
    } catch (e) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop())); rec = null; go.textContent = 'Start recording';
      msg.textContent = e.name === 'NotAllowedError' ? 'Permission was denied.' : e.message;
    }
  });
}

function bgTool(el) {
  let bgBusy = false;
  el.innerHTML = `${dropHtml('Drop a photo to remove its background')}<p class="hint" data-msg>The first use downloads an AI model (about 40 MB); after that it is fast.</p><div class="row"><img class="bg-prev" data-o alt="Original" hidden /><img class="bg-prev checker" data-r alt="Result" hidden /></div><div class="row"><a class="btn primary" data-dl hidden>Download PNG</a></div>`;
  wireDrop(el, async (fs) => {
    const msg = $('[data-msg]', el); const f = fs.find((x) => x.type.startsWith('image/')); if (!f) { msg.textContent = 'Please choose an image file (JPG, PNG, WebP).'; return; }
    if (bgBusy) { msg.textContent = 'Please wait — the previous image is still being processed.'; return; } bgBusy = true;
    [$('[data-o]', el).src, $('[data-r]', el).src].forEach((u) => u?.startsWith('blob:') && URL.revokeObjectURL(u));
    $('[data-o]', el).src = URL.createObjectURL(f); $('[data-o]', el).hidden = false; $('[data-r]', el).hidden = true; $('[data-dl]', el).hidden = true; msg.textContent = 'Removing background… this can take a minute the first time.';
    try {
      let blob; try { const m = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm'); blob = await m.removeBackground(f); } catch (e1) {
        msg.textContent = 'Trying the backup engine…'; const m = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.0.0/dist/index.mjs'); blob = await m.removeBackground(f, { publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.0.0/dist/' });
      } const url = URL.createObjectURL(blob);
      $('[data-r]', el).src = url; $('[data-r]', el).hidden = false; const dl = $('[data-dl]', el); dl.href = url; dl.download = `${f.name.replace(/\.[^.]+$/, '')}-nobg.png`; dl.removeAttribute('data-saved'); dl.hidden = false; msg.textContent = 'Done.';
    } catch (e) { msg.textContent = `Could not run the model: ${e.message}`; } finally { bgBusy = false; }
  }, 'image/*');
}

function showShared() {
  const m = location.hash.match(/^#share=(.+)$/); if (!m) return; $('.share-view')?.remove();
  try {
    const d = JSON.parse(unb64u(m[1])); const body = esc(d.b || '').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    const v = document.createElement('div'); v.className = 'share-view';
    v.innerHTML = `<article class="panel-card share-card"><p class="eyebrow">Shared with WizOS</p><h2>${esc(d.t || 'Shared note')}</h2><div class="share-body">${body}</div><div class="row"><button class="btn" data-c>Copy text</button><button class="btn primary" data-x>Open WizOS</button></div></article>`;
    $('[data-c]', v).onclick = () => copy(`${d.t}\n${d.b}`); $('[data-x]', v).onclick = () => { v.remove(); history.replaceState(null, '', location.pathname); }; document.body.append(v);
  } catch { /* not a valid share link */ }
}

function padTool(el) {
  el.innerHTML = `<textarea class="textarea-panel" data-t placeholder="Scratchpad — saves automatically in this browser…" aria-label="Scratchpad"></textarea><p class="hint" data-s>Saved</p>`;
  const t = $('[data-t]', el); t.value = store.get('scratchpad', ''); let timer;
  const flush = () => { clearTimeout(timer); store.set('scratchpad', t.value); $('[data-s]', el).textContent = 'Saved'; };
  t.addEventListener('input', () => { $('[data-s]', el).textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(flush, 350); });
  t.addEventListener('blur', flush); window.addEventListener('pagehide', () => { if (t.isConnected) flush(); });
}

/* ---------- AI engine ----------
   Every AI feature has its OWN chain: 1 main service + 3 backups. If the main one is busy,
   offline or out of quota, the next backup takes over automatically (the person never has to retry).
   Each feature also has its own daily limits (AI_LIMITS). Limits are counted in the visitor's browser
   to keep usage fair; real server-side limits belong in your Cloudflare Worker. */
const AI_URL = 'https://wizos-ai.thegamer-sridhar.workers.dev'; // MAIN chat AI: your Cloudflare Worker
const POLL_URL = 'https://text.pollinations.ai/openai'; // free backup AI (no key needed)
const AI_LIMITS = {
  assistant: { label: 'the AI Assistant', noun: 'messages', req: 40, chars: 80000, max: 26000, gap: 1200 },
  writer: { label: 'the Letter, Form & Coach tools', noun: 'requests', req: 20, chars: 40000, max: 6000, gap: 1500 },
  grammar: { label: 'the grammar checker', noun: 'checks', req: 60, chars: 120000, max: 30000, gap: 800 },
  translate: { label: 'the Translator', noun: 'translations', req: 80, chars: 150000, max: 30000, gap: 800 },
};
const SYS_CHAT = 'You are WizOS Assistant, a friendly and accurate helper. Reply in the same language the user writes in. Be clear, practical and concise. If you are not sure about something, say so instead of guessing.';
const SYS_GRAMMAR = 'You are a careful proofreader. Correct spelling, grammar and punctuation in the user\'s text. Keep the same language, meaning, tone, line breaks and formatting. Do not add comments, quotes or explanations. Output ONLY the corrected text.';

const aiDay = () => new Date().toLocaleDateString('en-CA');
const aiUse = (f) => { const u = store.get('ai-usage', {}); return u.day === aiDay() ? (u[f] || { req: 0, chars: 0 }) : { req: 0, chars: 0 }; };
function aiCount(f, chars) {
  let u = store.get('ai-usage', {}); if (u.day !== aiDay()) u = { day: aiDay() };
  const c = u[f] || { req: 0, chars: 0 }; u[f] = { req: c.req + 1, chars: c.chars + chars }; store.set('ai-usage', u);
}
const aiLeft = (f) => { const L = AI_LIMITS[f]; return `${Math.max(0, L.req - aiUse(f).req)} of ${L.req} ${L.noun} left today`; };
const aiLast = {}; const aiFails = {}; const aiDown = {};
function aiGuard(f, chars) {
  const L = AI_LIMITS[f]; const u = aiUse(f);
  if (chars > L.max) throw new Error(`That is too long for ${L.label}. The limit is ${L.max.toLocaleString()} characters at a time — please shorten it or send it in parts.`);
  if (u.req >= L.req) throw new Error(`You have used all ${L.req} ${L.noun} for ${L.label} today. The limit resets at midnight.`);
  if (u.chars + chars > L.chars) throw new Error(`This would pass the daily text limit for ${L.label} (${L.chars.toLocaleString()} characters). Try a shorter text, or come back tomorrow.`);
  if (Date.now() - (aiLast[f] || 0) < L.gap) throw new Error('Please wait a moment before sending the next request.');
}
/* Runs one request through the chain: main first, then Backup 1, 2, 3. Returns { value, via, tier }. */
async function aiChain(f, providers, call, chars) {
  aiGuard(f, chars); aiLast[f] = Date.now(); let originBlocked = false; let prev = '';
  for (const [i, p] of providers.entries()) {
    const key = `${f}:${p.id}`; const tier = i === 0 ? 'Main AI' : `Backup ${i}`;
    if (p.ready && !p.ready()) continue; // not available in this browser
    if ((aiDown[key] || 0) > Date.now()) continue; // failed twice recently: rest for a minute
    if (prev) call.note?.(`${prev} is busy — switching to ${tier}…`);
    prev = tier; const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), p.timeout || 30000);
    try {
      const value = await p.run(call, ctl.signal);
      if (!value || (typeof value === 'string' && !value.trim())) throw new Error('empty answer');
      aiFails[key] = 0; aiCount(f, chars); return { value, via: `${tier} · ${p.name}`, tier };
    } catch (e) {
      if (e.code === 'origin') originBlocked = true;
      aiFails[key] = (aiFails[key] || 0) + 1; if (aiFails[key] >= 2) { aiDown[key] = Date.now() + 60000; aiFails[key] = 0; }
    } finally { clearTimeout(timer); }
  }
  throw new Error(originBlocked ? 'The main AI only works when WizOS is opened from your website, and the backup services could not be reached right now.' : 'All AI services for this tool are busy or offline right now. Please try again in a minute.');
}

/* --- provider building blocks --- */
const within = (pr, ms) => Promise.race([pr, new Promise((_, rej) => { setTimeout(() => rej(new Error('timeout')), ms); })]); // a stuck browser API must never block the next service
const withSystem = (messages, system) => (system && messages.length ? [{ role: messages[0].role, content: `${system}\n\n${messages[0].content}` }, ...messages.slice(1)] : messages);
const aiWorker = (id, name, url) => ({
  id, name, timeout: 40000,
  async run({ messages, system }, signal) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: withSystem(messages, system) }), signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error || !j.reply) { const err = new Error(j.error || `status ${r.status}`); if (r.status === 403) err.code = 'origin'; throw err; }
    return j.reply;
  },
});
const aiPoll = (id, name, model) => ({
  id, name,
  async run({ messages, system }, signal) {
    const r = await fetch(POLL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: system ? [{ role: 'system', content: system }, ...messages] : messages }), signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json().catch(() => ({}));
    return j.choices?.[0]?.message?.content || '';
  },
});
const aiDevice = {
  id: 'device', name: 'On-device AI', timeout: 90000,
  ready: () => 'LanguageModel' in window,
  async run({ messages, system }, signal) {
    if ((await within(window.LanguageModel.availability(), 4000)) === 'unavailable') throw new Error('unavailable');
    const s = await window.LanguageModel.create({ signal });
    try { return await s.prompt(withSystem(messages, system).map((m) => (messages.length > 1 ? `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` : m.content)).join('\n'), { signal }); } finally { s.destroy?.(); }
  },
};

/* --- chains. Main first, then Backup 1, 2, 3. Each feature uses a different order so one outage never stops everything. --- */
const chatChain = () => [aiWorker('main', 'Cloudflare AI', AI_URL), aiPoll('b1', 'Backup AI A', 'openai'), aiPoll('b2', 'Backup AI B', 'mistral'), aiDevice];
const asText = (p, system) => ({ ...p, async run(c, s) { return { kind: 'text', text: await p.run({ messages: [{ role: 'user', content: c.text }], system }, s) }; } });
const grammarChain = () => [
  { id: 'lt', name: 'LanguageTool', timeout: 40000, async run({ text, lang }, signal) { return { kind: 'matches', matches: await ltCheck(text, lang, signal) }; } },
  asText(aiPoll('b1', 'Grammar AI A', 'mistral'), SYS_GRAMMAR), asText(aiWorker('b2', 'Grammar AI B', AI_URL), SYS_GRAMMAR), asText(aiDevice, SYS_GRAMMAR),
];
const langName = (c) => (LANGS.find(([k]) => k === c) || [c, c])[1];
const asTranslation = (p) => ({
  ...p, timeout: 150000,
  async run(c, s) {
    const sys = `Translate the user's text ${c.from === 'auto' ? '' : `from ${langName(c.from)} `}into ${langName(c.to)}. Keep the meaning, tone, line breaks and formatting. Output ONLY the translation — never answer or explain the text.`; const out = [];
    for (const part of chunkText(c.text, 1500).filter((x) => x.trim())) { c.note?.(`Translating ${out.length + 1}…`); out.push(await p.run({ messages: [{ role: 'user', content: part }], system: sys }, s)); c.partial?.(out.join('\n')); }
    return out.join('\n');
  },
});
const translateChain = () => [
  {
    id: 'device', name: 'On-device translator', timeout: 120000, ready: () => !!window.Translator,
    async run(c) {
      let s = c.from; if (s === 'auto') { if (!window.LanguageDetector || (await within(window.LanguageDetector.availability(), 4000)) !== 'available') { window.LanguageDetector?.create().catch(() => {}); throw new Error('detector not ready'); } s = (await (await window.LanguageDetector.create()).detect(c.text.slice(0, 2000)))[0].detectedLanguage; }
      if (s === c.to) return c.text;
      const av = await within(window.Translator.availability({ sourceLanguage: s, targetLanguage: c.to }), 4000); if (av === 'unavailable') throw new Error('pair unavailable');
      if (av !== 'available') { window.Translator.create({ sourceLanguage: s, targetLanguage: c.to }).catch(() => {}); throw new Error('model downloading'); } // start the one-time download in the background and use the next service for now
      c.note?.('Preparing on-device translator…'); const tr = await window.Translator.create({ sourceLanguage: s, targetLanguage: c.to }); const parts = chunkText(c.text, 1500); const res = [];
      for (let i = 0; i < parts.length; i += 1) { c.note?.(`Translating ${i + 1}/${parts.length} on your device…`); res.push(await tr.translate(parts[i])); c.partial?.(res.join('')); }
      return res.join('');
    },
  },
  {
    id: 'mymemory', name: 'MyMemory', timeout: 150000,
    async run(c, signal) {
      const mm = (x) => (x === 'zh' ? 'zh-CN' : x); const parts = chunkBytes(c.text, 450).filter((p) => p.trim()); const res = [];
      for (let i = 0; i < parts.length; i += 1) {
        c.note?.(`Translating ${i + 1}/${parts.length}…`);
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(parts[i])}&langpair=${c.from === 'auto' ? 'Autodetect' : mm(c.from)}|${mm(c.to)}`, { signal }); const j = await r.json();
        if (!r.ok) throw new Error(`status ${r.status}`);
        const t = j.responseData?.translatedText || ''; if (/MYMEMORY WARNING/i.test(t) || (j.responseStatus && +j.responseStatus !== 200)) throw new Error('daily limit');
        res.push(t); c.partial?.(res.join(''));
      }
      return res.join('');
    },
  },
  asTranslation(aiPoll('b2', 'Translation AI A', 'openai')), asTranslation(aiWorker('b3', 'Translation AI B', AI_URL)),
];

/* ---------- Translate & Grammar ---------- */
const LANGS = [['en', 'English'], ['hi', 'Hindi'], ['kn', 'Kannada'], ['ta', 'Tamil'], ['te', 'Telugu'], ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['ur', 'Urdu'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['tr', 'Turkish'], ['nl', 'Dutch']];
function chunkText(t, max) {
  const out = []; let cur = '';
  for (const part of t.match(/[^.!?\n।]+[.!?।]*\s*|[.!?।]+\s*|\n+/g) || [t]) {
    if (cur && (cur + part).length > max) { out.push(cur); cur = ''; }
    cur += part; while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur); return out;
}
/* MyMemory rejects requests over 500 bytes; Indian scripts use 3 bytes per character, so count bytes, not characters */
function chunkBytes(t, maxBytes) {
  const enc = new TextEncoder(); const out = []; let cur = '';
  const push = (p) => { if (cur && enc.encode(cur + p).length > maxBytes) { out.push(cur); cur = ''; } cur += p; };
  for (const part of chunkText(t, maxBytes)) {
    if (enc.encode(part).length <= maxBytes) { push(part); continue; }
    for (const ch of part) push(ch);
  }
  if (cur) out.push(cur); return out;
}
async function ltCheck(text, lang, signal) {
  const matches = []; let base = 0;
  for (const chunk of chunkText(text, 15000)) {
    const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text: chunk, language: lang }), signal });
    if (!r.ok) throw new Error(r.status === 429 ? 'Too many requests — wait a minute and try again.' : `Grammar service error (${r.status})`);
    (await r.json()).matches.forEach((m) => matches.push({ ...m, offset: m.offset + base })); base += chunk.length;
  }
  return matches;
}
function writeTool(el) {
  const opt = (sel) => LANGS.map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${n}</option>`).join('');
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="tr">Translate</button><button class="tab" data-m="gr">Grammar check</button></div>
  <section data-p="tr" class="stack-gap"><div class="row"><select class="select-field" data-from aria-label="From"><option value="auto">Detect language</option>${opt('')}</select><span>→</span><select class="select-field" data-to aria-label="To">${opt('en')}</select><button class="chip" data-swap aria-label="Swap languages">⇄</button></div>
    <textarea class="textarea-panel" data-src placeholder="Paste or type your text — long documents are fine" aria-label="Text to translate"></textarea>
    <div class="row"><button class="btn primary" data-tgo>Translate</button><span class="hint" data-tmsg></span></div>
    <textarea class="textarea-panel" data-dst readonly placeholder="Translation appears here" aria-label="Translation"></textarea><div class="row"><button class="btn" data-tcopy>Copy translation</button><span class="hint" data-tmeter></span></div></section>
  <section data-p="gr" class="stack-gap" hidden><div class="row"><select class="select-field" data-glang aria-label="Language"><option value="auto">Detect language</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="de-DE">German</option><option value="fr">French</option><option value="es">Spanish</option><option value="it">Italian</option><option value="pt-PT">Portuguese</option><option value="nl">Dutch</option></select></div>
    <textarea class="textarea-panel" data-gtxt placeholder="Paste your text to check spelling and grammar" aria-label="Text to check"></textarea>
    <div class="row"><button class="btn primary" data-ggo>Check grammar</button><button class="btn" data-gfix>Fix all</button><button class="btn" data-gcopy>Copy text</button><span class="hint" data-gmsg></span></div><div class="list" data-gout></div>
    <p class="hint" data-gmeter></p>
    <p class="hint">Grammar checking covers English and major European languages. For other languages, the backup AI proofreader will suggest a corrected version.</p></section>`;
  const q = (s) => $(s, el);
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  const meters = () => { q('[data-tmeter]').textContent = aiLeft('translate'); q('[data-gmeter]').textContent = aiLeft('grammar'); }; meters();
  q('[data-swap]').addEventListener('click', () => { const f = q('[data-from]'); const t = q('[data-to]'); if (f.value === 'auto') return; [f.value, t.value] = [t.value, f.value]; q('[data-src]').value = q('[data-dst]').value; q('[data-dst]').value = ''; });
  q('[data-tcopy]').addEventListener('click', () => copy(q('[data-dst]').value));
  const tmsg = (t) => { q('[data-tmsg]').textContent = t; }; let tBusy = false;
  q('[data-tgo]').addEventListener('click', async () => {
    if (tBusy) return; const text = q('[data-src]').value; if (!text.trim()) return tmsg('Type or paste some text first.');
    const from = q('[data-from]').value; const to = q('[data-to]').value; const dst = q('[data-dst]'); dst.value = '';
    if (from === to) { dst.value = text; return tmsg('Source and target language are the same.'); }
    tBusy = true; q('[data-tgo]').disabled = true; tmsg('Translating…');
    try {
      const { value, via } = await aiChain('translate', translateChain(), { text, from, to, note: tmsg, partial: (p) => { dst.value = p; } }, text.length);
      dst.value = value; tmsg(`Done · ${via}`);
    } catch (e) { tmsg(`✗ ${e.message}`); } finally { tBusy = false; q('[data-tgo]').disabled = false; meters(); }
  });
  let matches = []; let aiFix = ''; const gta = q('[data-gtxt]'); const gmsg = (t) => { q('[data-gmsg]').textContent = t; }; const gout = q('[data-gout]'); let gBusy = false;
  const paintMatches = () => {
    const text = gta.value; aiFix = '';
    gout.innerHTML = matches.length ? matches.slice(0, 150).map((m, i) => `<div class="list-row"><span class="grow"><b>${esc(text.slice(m.offset, m.offset + m.length) || '·')}</b> — ${esc(m.message)}</span>${m.replacements.slice(0, 3).map((r, k) => `<button class="chip" data-fix="${i}:${k}">${esc(r.value) || '(remove)'}</button>`).join('')}</div>`).join('') : '<p class="hint">✓ No problems found.</p>';
  };
  const paintAiFix = (orig, fixed) => {
    aiFix = fixed; const a = orig.split(/(\s+)/); const b = fixed.split(/(\s+)/); let html;
    if (a.length * b.length > 4e6) html = esc(fixed);
    else html = seqDiff(a, b).map(([t, s]) => (t === '=' ? esc(s) : t === '+' ? (s.trim() ? `<ins style="background:rgba(34,197,94,.5);text-decoration:none;border-radius:3px">${esc(s)}</ins>` : esc(s)) : (s.trim() ? `<del style="background:rgba(239,68,68,.55);border-radius:3px">${esc(s)}</del>` : ''))).join('');
    gout.innerHTML = `<div class="panel-card diff-doc">${html}</div><div class="row"><button class="btn primary" data-guse>Use corrected text</button></div>`;
  };
  const check = async () => {
    if (gBusy) return; const text = gta.value; if (!text.trim()) return gmsg('Paste some text first.');
    gBusy = true; q('[data-ggo]').disabled = true; gmsg('Checking…');
    try {
      const { value, via } = await aiChain('grammar', grammarChain(), { text, lang: q('[data-glang]').value, note: gmsg }, text.length);
      if (value.kind === 'matches') { matches = value.matches; paintMatches(); gmsg(`${matches.length ? `${matches.length} issue(s) found` : 'All good'} · ${via}`); }
      else { matches = []; paintAiFix(text, value.text.trim()); gmsg(`Suggested corrections shown · ${via}`); }
    } catch (e) { gmsg(`✗ ${e.message}`); } finally { gBusy = false; q('[data-ggo]').disabled = false; meters(); }
  };
  /* fixing a suggestion edits the text locally and moves the other suggestions along — no extra request is used */
  const applyFix = (m, rep) => { const d = rep.length - m.length; gta.value = gta.value.slice(0, m.offset) + rep + gta.value.slice(m.offset + m.length); matches = matches.filter((x) => x !== m); matches.forEach((x) => { if (x.offset > m.offset) x.offset += d; }); };
  q('[data-ggo]').addEventListener('click', check);
  gout.addEventListener('click', (e) => {
    if (e.target.closest('[data-guse]')) { gta.value = aiFix; gout.innerHTML = '<p class="hint">✓ Corrected text applied.</p>'; aiFix = ''; return gmsg('Done.'); }
    const b = e.target.closest('[data-fix]'); if (!b) return; const [i, k] = b.dataset.fix.split(':').map(Number); applyFix(matches[i], matches[i].replacements[k].value); paintMatches(); gmsg(`${matches.length} issue(s) left.`);
  });
  q('[data-gfix]').addEventListener('click', () => {
    if (aiFix) { gta.value = aiFix; gout.innerHTML = '<p class="hint">✓ Corrected text applied.</p>'; aiFix = ''; return gmsg('Done.'); }
    if (!matches.length) return gmsg('Run “Check grammar” first.');
    let limit = Infinity; [...matches].sort((a, b) => b.offset - a.offset).forEach((m) => { if (m.replacements.length && m.offset + m.length <= limit) { applyFix(m, m.replacements[0].value); limit = m.offset; } }); paintMatches(); gmsg('Fixed. Press Check grammar to re-check.');
  });
  q('[data-gcopy]').addEventListener('click', () => copy(gta.value));
}

/* ---------- Read & Speak: voice typing + read aloud ---------- */
function speakTool(el) {
  const VL = [['en-IN', 'English (India)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['hi-IN', 'Hindi'], ['kn-IN', 'Kannada'], ['ta-IN', 'Tamil'], ['te-IN', 'Telugu'], ['ml-IN', 'Malayalam'], ['mr-IN', 'Marathi'], ['bn-IN', 'Bengali'], ['gu-IN', 'Gujarati'], ['pa-IN', 'Punjabi'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German']];
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="vt"><i class="fa-solid fa-microphone"></i> Voice typing</button><button class="tab" data-m="ra"><i class="fa-solid fa-volume-high"></i> Read aloud</button></div>
  <section data-p="vt" class="stack-gap"><div class="row"><select class="select-field" data-vl aria-label="Spoken language">${VL.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select><button class="btn primary" data-mic><i class="fa-solid fa-microphone"></i> Start speaking</button><span class="hint" data-vmsg></span></div>
    <textarea class="textarea-panel" data-vtxt placeholder="Your words appear here as you speak" aria-label="Voice typing text"></textarea><div class="row"><button class="btn" data-vcopy>Copy</button><button class="btn" data-vclear>Clear</button></div></section>
  <section data-p="ra" class="stack-gap" hidden><textarea class="textarea-panel" data-rtxt placeholder="Paste text to have it read aloud" aria-label="Text to read"></textarea>
    <div class="opt-grid"><label>Voice <select class="select-field" data-voice></select></label><label>Speed <input type="range" min="0.6" max="1.6" step="0.1" value="1" data-rate /></label></div>
    <div class="row"><button class="btn primary" data-play><i class="fa-solid fa-play"></i> Read</button><button class="btn" data-pause>Pause</button><button class="btn" data-stop>Stop</button><span class="hint" data-rmsg></span></div></section>`;
  const q = (s) => $(s, el);
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null; let on = false; const mic = q('[data-mic]'); const vtxt = q('[data-vtxt]');
  mic.addEventListener('click', () => {
    if (!SR) return (q('[data-vmsg]').textContent = 'Voice typing needs Chrome or Edge.');
    if (on) { on = false; rec?.stop(); mic.innerHTML = '<i class="fa-solid fa-microphone"></i> Start speaking'; q('[data-vmsg]').textContent = ''; return; }
    on = true; let base = vtxt.value ? `${vtxt.value} ` : '';
    const start = () => {
      rec = new SR(); rec.lang = q('[data-vl]').value; rec.continuous = true; rec.interimResults = true;
      rec.onresult = (e) => { let fin = ''; let tmp = ''; for (let i = e.resultIndex; i < e.results.length; i += 1) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); if (fin) base += `${fin} `; vtxt.value = base + tmp; };
      rec.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed'].includes(e.error)) { on = false; q('[data-vmsg]').textContent = 'Microphone permission was denied.'; }
        else if (e.error === 'network') { on = false; q('[data-vmsg]').textContent = 'Voice typing needs an internet connection.'; }
        else if (e.error === 'audio-capture') { on = false; q('[data-vmsg]').textContent = 'No microphone was found.'; }
      };
      rec.onend = () => { if (on && el.isConnected) { try { rec.start(); } catch { on = false; } } if (!on || !el.isConnected) { on = false; mic.innerHTML = '<i class="fa-solid fa-microphone"></i> Start speaking'; } }; rec.start();
    };
    start(); mic.innerHTML = '<i class="fa-solid fa-stop"></i> Stop'; q('[data-vmsg]').textContent = '● Listening…';
  });
  q('[data-vcopy]').addEventListener('click', () => copy(vtxt.value)); q('[data-vclear]').addEventListener('click', () => { vtxt.value = ''; });
  const synth = window.speechSynthesis; const vsel = q('[data-voice]'); let speakRun = 0;
  const loadVoices = () => { const vs = synth?.getVoices() || []; vsel.innerHTML = vs.map((v, i) => `<option value="${i}">${esc(v.name)} (${v.lang})</option>`).join('') || '<option>No voices found</option>'; const d = vs.findIndex((v) => /en-IN/i.test(v.lang)); if (d >= 0) vsel.value = d; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  q('[data-play]').addEventListener('click', () => {
    if (!synth) return (q('[data-rmsg]').textContent = 'Read aloud is not supported in this browser.');
    synth.cancel(); const run = ++speakRun; const parts = chunkText(q('[data-rtxt]').value, 180).filter((p) => p.trim()); const voice = synth.getVoices()[+vsel.value]; let i = 0;
    if (!parts.length) { q('[data-rmsg]').textContent = 'Paste some text first.'; return; }
    const next = () => { if (run !== speakRun || i >= parts.length || !el.isConnected) { q('[data-rmsg]').textContent = ''; return; } const u = new SpeechSynthesisUtterance(parts[i]); if (voice) { u.voice = voice; u.lang = voice.lang; } u.rate = +q('[data-rate]').value; i += 1; u.onend = next; q('[data-rmsg]').textContent = `Reading ${i}/${parts.length}…`; synth.speak(u); };
    next();
  });
  q('[data-pause]').addEventListener('click', (e) => { if (!synth) return; if (synth.paused) { synth.resume(); e.target.textContent = 'Pause'; } else { synth.pause(); e.target.textContent = 'Resume'; } });
  q('[data-stop]').addEventListener('click', () => { speakRun += 1; synth?.cancel(); q('[data-pause]').textContent = 'Pause'; q('[data-rmsg]').textContent = ''; });
}

/* ---------- AI Assistant: helpers (the AI itself is in the AI engine above) ---------- */
async function textFromFile(f) {
  if (isPdf(f)) { const d = await pdfDoc(await f.arrayBuffer()); let t = ''; for (let i = 1; i <= d.numPages && t.length < 20000; i += 1) { const c = await (await d.getPage(i)).getTextContent(); t += `${c.items.map((x) => x.str).join(' ')}\n`; } return t; }
  if (/\.docx$/i.test(f.name)) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'); return (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
  return f.text();
}
const mdLite = (s) => esc(s).split(/```/).map((p, i) => (i % 2 ? `<pre><code>${p.replace(/^\w*\n/, '')}</code></pre>` : p.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br />'))).join('');
function aiTool(el) {
  el.innerHTML = `<div class="chat-log" data-log aria-live="polite"></div>
    <div class="row"><button class="chip" data-qp="Summarize this in simple words:\n\n">Summarize</button><button class="chip" data-qp="Explain this simply:\n\n">Explain simply</button><button class="chip" data-qp="Write a polite, professional email about: ">Write an email</button><button class="chip" data-qp="Fix the grammar and improve this text:\n\n">Improve my text</button></div>
    <div class="chat-input"><textarea class="textarea-panel" data-in rows="2" maxlength="12000" placeholder="Ask anything… (Enter to send, Shift+Enter for a new line)" aria-label="Message"></textarea><button class="btn primary" data-send>Send</button></div>
    <div class="row"><label class="btn"><i class="fa-solid fa-paperclip"></i> Attach file<input type="file" hidden data-file accept=".txt,.md,.csv,.json,.pdf,.docx" /></label><span class="hint grow" data-att></span><button class="chip" data-clear>New chat</button></div>
    <p class="hint" data-meter></p>`;
  const q = (s) => $(s, el); const log = q('[data-log]'); const input = q('[data-in]'); let msgs = store.get('ai-chat', []); let attach = null; let busy = false;
  const meter = () => { q('[data-meter]').textContent = `${aiLeft('assistant')} · if the main AI is busy, 3 backups take over automatically`; };
  const paint = (extra = '') => {
    log.innerHTML = (msgs.length ? msgs.map((m, i) => `<div class="bubble ${m.role === 'user' ? 'user' : 'ai'}">${mdLite(m.show ?? m.content)}${m.role === 'assistant' ? `<div class="bubble-tools"><button class="chip" data-copy="${i}">Copy</button><button class="chip" data-canvas="${i}">Send to Canvas</button>${m.via ? `<small class="hint">${esc(m.via)}</small>` : ''}</div>` : ''}</div>`).join('') : '<p class="hint">Hi! Ask me anything, paste text to summarize or rewrite, or attach a PDF, Word or text file to ask about it.</p>') + extra;
    log.scrollTop = log.scrollHeight;
  };
  const send = async () => {
    const text = input.value.trim(); if (busy || (!text && !attach)) return;
    let content = text || 'Please summarize this file.'; let show = content;
    if (attach) { content += `\n\n[Attached file: ${attach.name}]\n${attach.text}`; show += `\n📎 ${attach.name}`; }
    const hold = attach; msgs.push({ role: 'user', content, show }); input.value = ''; attach = null; q('[data-att]').textContent = ''; busy = true; q('[data-send]').disabled = true; paint('<div class="bubble ai"><span class="hint" data-live>Thinking…</span></div>');
    try {
      const messages = msgs.slice(-12).map((m, i, a) => ({ role: m.role, content: i === a.length - 1 ? m.content : m.content.slice(0, 3000) }));
      const { value, via } = await aiChain('assistant', chatChain(), { messages, system: SYS_CHAT, note: (t) => { const l = $('[data-live]', log); if (l) l.textContent = t; } }, content.length);
      msgs.push({ role: 'assistant', content: value, via }); msgs = msgs.slice(-40); store.set('ai-chat', msgs); paint();
    } catch (e) {
      msgs.pop(); input.value = text; attach = hold; if (hold) q('[data-att]').textContent = `📎 ${hold.name}`; // give the message back so nothing is lost and the history stays valid
      paint(`<div class="bubble ai err">✗ ${esc(e.message === 'Failed to fetch' ? 'Could not reach the AI. Check your internet connection.' : e.message)}</div>`);
    }
    busy = false; q('[data-send]').disabled = false; meter();
  };
  q('[data-send]').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $$('[data-qp]', el).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.qp.replace(/\\n/g, '\n'); input.focus(); }));
  q('[data-clear]').addEventListener('click', () => { msgs = []; store.set('ai-chat', []); paint(); });
  q('[data-file]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; q('[data-att]').textContent = 'Reading file…';
    try { const t = await textFromFile(f); attach = { name: f.name, text: t.slice(0, 12000) }; q('[data-att]').textContent = `📎 ${f.name}${t.length > 12000 ? ' (first 12,000 characters used)' : ''}`; } catch (err) { q('[data-att]').textContent = `Could not read that file: ${err.message}`; }
  });
  log.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]'); const k = e.target.closest('[data-canvas]');
    if (c) copy(msgs[+c.dataset.copy].content);
    if (k) sendToCanvas(msgs[+k.dataset.canvas].content);
  });
  paint(); meter();
}

/* ---------- shared AI helper (Letter writer, Form helper, Web Tricks coach: separate daily limit from the chat) ---------- */
async function askAI(messages, feature = 'writer') {
  const { value } = await aiChain(feature, chatChain(), { messages, system: SYS_CHAT }, messages.reduce((n, m) => n + m.content.length, 0));
  return value;
}

const sendToCanvas = (text) => { blocks.unshift({ id: Date.now(), type: 'text', data: text }); saveBlocks(); if (canvasRoot?.isConnected) renderCanvas(); toast('Saved to Canvas'); };

/* ---------- Letter & Form Writer ---------- */
function letterTool(el) {
  const TYPES = ['Leave application', 'Job application', 'Resignation letter', 'Complaint letter', 'Request letter', 'Bank or office letter', 'Recommendation letter', 'Formal email', 'Something else'];
  const LANGS2 = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Spanish', 'French', 'German'];
  const sel = (items, dflt) => items.map((x) => `<option${x === dflt ? ' selected' : ''}>${x}</option>`).join('');
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="lt"><i class="fa-solid fa-envelope-open-text"></i> Write a letter</button><button class="tab" data-m="fm"><i class="fa-solid fa-file-pen"></i> Form helper</button></div>
  <section data-p="lt" class="stack-gap"><div class="opt-grid"><label>Type <select class="select-field" data-type>${sel(TYPES)}</select></label><label>Language <select class="select-field" data-lang>${sel(LANGS2, 'English')}</select></label>
    <label>Tone <select class="select-field" data-tone>${sel(['Formal', 'Polite', 'Firm', 'Friendly'])}</select></label><label>Length <select class="select-field" data-len>${sel(['Short', 'Medium', 'Detailed'], 'Medium')}</select></label></div>
    <div class="opt-grid"><label>To (name / office) <input class="field" data-to placeholder="e.g. The Principal, ABC School" /></label><label>From (your name) <input class="field" data-from placeholder="Your name" /></label></div>
    <label class="stack-gap">What is it about? Give the key facts (dates, reasons, amounts)<textarea class="textarea-panel small" data-det placeholder="e.g. I need leave from 10 to 12 October because of a family function."></textarea></label>
    <div class="row"><button class="btn primary" data-go>Write the letter</button><span class="hint" data-msg></span></div>
    <textarea class="textarea-panel" data-out placeholder="Your letter appears here — you can edit it" aria-label="Letter"></textarea>
    <div class="row"><button class="btn" data-copy>Copy</button><button class="btn" data-dl>Download .txt</button><button class="btn" data-cv>Send to Canvas</button></div></section>
  <section data-p="fm" class="stack-gap" hidden><label class="stack-gap">Paste the question or instruction from the form<textarea class="textarea-panel small" data-ftxt placeholder="e.g. Enter your permanent address as per Aadhaar / Declaration of dependents"></textarea></label>
    <label class="stack-gap">Your situation (optional)<textarea class="textarea-panel small" data-fsit placeholder="e.g. I live in a rented house, my parents live in our village."></textarea></label>
    <div class="row"><label>Explain in <select class="select-field" data-flang>${sel(LANGS2, 'English')}</select></label><button class="btn primary" data-fgo>Explain it</button><span class="hint" data-fmsg></span></div>
    <div class="panel-card form-out" data-fout>The explanation appears here.</div><div class="row"><button class="btn" data-fcopy>Copy</button></div></section>`;
  const q = (s) => $(s, el);
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  q('[data-go]').addEventListener('click', async () => {
    const det = q('[data-det]').value.trim(); if (!det) return (q('[data-msg]').textContent = 'Please add the key details first.');
    q('[data-msg]').textContent = 'Writing…';
    const prompt = `Write a ${q('[data-type]').value} in ${q('[data-lang]').value}. Tone: ${q('[data-tone]').value}. Length: ${q('[data-len]').value}. Recipient: ${q('[data-to]').value || 'the concerned person'}. Sender name: ${q('[data-from]').value || '(leave a blank line for the name)'}. Details: ${det}\nUse a proper letter format with a date line, subject line, salutation, body and closing. Do not invent facts that were not given; use [brackets] for anything missing. Output only the letter.`;
    try { q('[data-out]').value = await askAI([{ role: 'user', content: prompt }]); q('[data-msg]').textContent = `Done — check names and dates before sending. ${aiLeft('writer')}.`; } catch (e) { q('[data-msg]').textContent = `✗ ${e.message}`; }
  });
  q('[data-copy]').addEventListener('click', () => copy(q('[data-out]').value));
  q('[data-dl]').addEventListener('click', () => download(new Blob([q('[data-out]').value], { type: 'text/plain' }), 'letter.txt'));
  q('[data-cv]').addEventListener('click', () => q('[data-out]').value && sendToCanvas(q('[data-out]').value));
  q('[data-fgo]').addEventListener('click', async () => {
    const t = q('[data-ftxt]').value.trim(); if (!t) return (q('[data-fmsg]').textContent = 'Paste the form text first.'); q('[data-fmsg]').textContent = 'Thinking…';
    const prompt = `I am filling in a form and need help. Explain in simple ${q('[data-flang]').value}: what this field or instruction means, exactly what to write, and which documents I may need. Form text: ${t}\nMy situation: ${q('[data-fsit]').value || 'not given'}\nBe short and practical. If it depends on local rules, say so.`;
    try { q('[data-fout]').innerHTML = mdLite(await askAI([{ role: 'user', content: prompt }])); q('[data-fmsg]').textContent = ''; } catch (e) { q('[data-fmsg]').textContent = `✗ ${e.message}`; }
  });
  q('[data-fcopy]').addEventListener('click', () => copy(q('[data-fout]').innerText));
}

/* ---------- Web Tricks ---------- */
const RECIPES = [
  { t: 'Chrome dino game: don’t die', g: 'Play the offline dinosaur game without ever losing.', s: ['Turn off your internet (or type chrome://dino in the address bar) and open the dinosaur game.', 'Press F12, then click the Console tab.', 'Paste the line below, press Enter, then press Space to play.', 'Refresh the page to go back to normal.'], c: 'Runner.instance_.gameOver = function () {};' },
  { t: 'Change the dino’s speed', g: 'Make the game faster or slower.', s: ['Open the dino game and the Console as above.', 'Paste the line below. Bigger numbers are faster.'], c: 'Runner.instance_.setSpeed(12);' },
  { t: 'Edit any text on a page', g: 'Change words on a page on your own screen (great for learning or mock-ups). Nothing is saved to the website.', s: ['Press F12 and open the Console.', 'Paste the line below and press Enter.', 'Click any text on the page and type. Refresh to undo.'], c: "document.designMode = 'on';" },
  { t: 'Remove a pop-up covering the page', g: 'Get rid of a newsletter or cookie box that is blocking content you can already see.', s: ['Right-click the pop-up and choose Inspect.', 'In the Elements panel the box is highlighted. Press Delete to remove it.', 'If the page won’t scroll, click <body> in Elements and, in the Styles panel, untick “overflow: hidden”.', 'This only clears what covers the page. It will not unlock content that a site reserves for members.'] },
  { t: 'Show a password you typed', g: 'Check what you typed in a password box on your own account.', s: ['Right-click the password box and choose Inspect.', 'Double-click type="password" in the highlighted line.', 'Change it to text and press Enter. The dots turn into letters.'] },
  { t: 'See how a page looks on a phone', g: 'Test any page at phone or tablet size.', s: ['Press F12, then Ctrl + Shift + M.', 'Pick a device at the top, such as Samsung Galaxy or iPad.', 'Press Ctrl + Shift + M again to go back.'] },
  { t: 'Test a slow or offline connection', g: 'See how a page behaves on bad internet.', s: ['Press F12 and open the Network tab.', 'Find the “No throttling” dropdown and choose Slow 3G or Offline.', 'Reload the page. Set it back to No throttling when done.'] },
  { t: 'Find the colours and fonts a page uses', g: 'Copy exact colour codes without a colour-picker tool.', s: ['Right-click the thing you’re curious about and choose Inspect.', 'In the Styles panel, look for color or background-color.', 'Click the little coloured square to see and copy the code. The Computed tab shows the font.'] },
  { t: 'Speed up any video', g: 'Play a video faster than the player’s buttons allow.', s: ['Press F12 and open the Console.', 'Paste the line below. Use 0.5 for half speed.'], c: "document.querySelector('video').playbackRate = 2;" },
  { t: 'Start fresh on a site', g: 'Clear one site’s saved data when it’s misbehaving.', s: ['Press F12 and open the Application tab.', 'Choose Storage in the left list.', 'Click “Clear site data”, then reload.'] },
];
function tricksTool(el) {
  el.innerHTML = `<div class="tabs"><button class="tab is-on" data-m="rc">Recipes</button><button class="tab" data-m="pr">Practice page</button><button class="tab" data-m="ask">Ask the coach</button></div>
  <section data-p="rc" class="stack-gap"><input class="field" data-find placeholder="Search recipes — dino, popup, password…" aria-label="Search recipes" /><p class="hint">Open Developer Tools with F12 (or Ctrl + Shift + I). Right-click → Inspect also works. These tricks change only what you see on your own screen.</p><div data-list class="stack-gap"></div></section>
  <section data-p="pr" class="stack-gap" hidden><p class="hint">A safe pretend website to practise on. Press F12 and try the missions below.</p>
    <div class="practice-site" data-site><div class="practice-popup" data-pop><b>Subscribe now!</b><br />This box is blocking the shop. (Mission 2: remove it with Inspect.)</div><h3 data-shop>Joe’s Bakery</h3><p>Fresh bread: <b data-price>$5.00</b></p><p><label>Password: <input type="password" class="field" value="MySecret123" /></label></p></div>
    <ol class="mission"><li>Right-click the price → Inspect → double-click the text → change it to $1.00.</li><li>Right-click the pop-up → Inspect → press Delete.</li><li>Inspect the password box and change type="password" to type="text".</li><li>Console: <code>document.body.style.background = 'pink'</code></li></ol><div class="row"><button class="btn" data-reset>Reset practice page</button></div></section>
  <section data-p="ask" class="stack-gap" hidden><div class="row"><button class="chip" data-ex="How do I see a website’s colours using Developer Tools?">Find colours</button><button class="chip" data-ex="How do I find out why a web page is slow?">Page is slow</button><button class="chip" data-ex="How do I take a full-page screenshot using Developer Tools?">Full-page screenshot</button></div>
    <textarea class="textarea-panel small" data-q placeholder="Describe the site or game and what you want to do…"></textarea><div class="row"><button class="btn primary" data-ask>Ask</button><span class="hint" data-msg></span></div><div class="panel-card form-out" data-ans>Answers appear here.</div></section>`;
  const q = (s) => $(s, el);
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  const paint = (f = '') => {
    q('[data-list]').innerHTML = RECIPES.map((r, i) => [r, i]).filter(([r]) => `${r.t} ${r.g}`.toLowerCase().includes(f.toLowerCase())).map(([r, i]) => `<details class="recipe"><summary>${esc(r.t)}</summary><p>${esc(r.g)}</p><ol>${r.s.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${r.c ? `<pre class="css-out">${esc(r.c)}</pre><button class="chip" data-cp="${i}">Copy code</button>` : ''}</details>`).join('') || '<p class="hint">No recipe matches.</p>';
  };
  q('[data-find]').addEventListener('input', (e) => paint(e.target.value)); q('[data-list]').addEventListener('click', (e) => { const b = e.target.closest('[data-cp]'); if (b) copy(RECIPES[+b.dataset.cp].c); }); paint();
  const site = q('[data-site]'); const original = site.innerHTML; q('[data-reset]').addEventListener('click', () => { site.innerHTML = original; });
  $$('[data-ex]', el).forEach((b) => b.addEventListener('click', () => { q('[data-q]').value = b.dataset.ex; }));
  q('[data-ask]').addEventListener('click', async () => {
    const t = q('[data-q]').value.trim(); if (!t) return; q('[data-msg]').textContent = 'Thinking…';
    const prompt = `You are a friendly browser Developer Tools coach for non-technical people using Chrome (version 109 on Windows). Give short, numbered, click-by-click steps and any exact Console code to paste. Only help with things that change the user's own screen, their own pages, games, learning, or debugging. Politely decline anything that bypasses logins, paywalls, access restrictions or security, or that impersonates a site. Question: ${t}`;
    try { q('[data-ans]').innerHTML = mdLite(await askAI([{ role: 'user', content: prompt }])); q('[data-msg]').textContent = ''; } catch (e) { q('[data-msg]').textContent = `✗ ${e.message}`; }
  });
}

const TOOLS = [
  { id: 'ai', name: 'AI Assistant', icon: 'fa-brain', group: 'AI & Writing', render: aiTool },
  { id: 'media', name: 'Media Converter', icon: 'fa-photo-film', group: 'Image & Media', render: mediaTool },
  { id: 'bg', name: 'Background Remover', icon: 'fa-wand-magic-sparkles', group: 'Image & Media', render: bgTool },
  { id: 'docs', name: 'Document Toolkit', icon: 'fa-file-pdf', group: 'Documents', render: docTool },
  { id: 'compare', name: 'Compare', icon: 'fa-code-compare', group: 'Documents', render: compareTool },
  { id: 'write', name: 'Translate & Grammar', icon: 'fa-language', group: 'Writing & Language', render: writeTool },
  { id: 'speak', name: 'Read & Speak', icon: 'fa-microphone-lines', group: 'Writing & Language', render: speakTool },
  { id: 'letter', name: 'Letter & Form Writer', icon: 'fa-envelope-open-text', group: 'AI & Writing', render: letterTool },
  { id: 'tricks', name: 'Web Tricks', icon: 'fa-terminal', group: 'Learn', render: tricksTool },
  { id: 'qr', name: 'QR Generator', icon: 'fa-qrcode', group: 'Quick Utilities', render: qrTool },
  { id: 'rec', name: 'Display Recorder', icon: 'fa-video', group: 'Quick Utilities', render: recorderTool },
  { id: 'pad', name: 'Scratchpad', icon: 'fa-note-sticky', group: 'Quick Utilities', render: padTool },
];
const toolById = (id) => TOOLS.find((t) => t.id === id);

/* ---------- Block canvas ---------- */
let blocks = store.get('blocks', null);
if (!Array.isArray(blocks)) blocks = [{ id: 1, type: 'text', data: 'Welcome to WizOS.\nAdd notes, checklists and tools as blocks — everything saves automatically.' }];
blocks = blocks.filter((b) => b && ['text', 'check', 'tool'].includes(b.type));
const saveBlocks = () => store.set('blocks', blocks);
let canvasRoot = null;
function addBlock(spec) { blocks.unshift({ id: Date.now(), data: spec.type === 'check' ? [] : '', ...spec }); saveBlocks(); renderCanvas(); }

function renderCanvas() {
  const c = canvasRoot; if (!c) return; c.innerHTML = blocks.length ? '' : '<p class="hint">Empty canvas — use “Add block” to start.</p>';
  blocks.forEach((b, i) => {
    const tool = b.type === 'tool' ? toolById(b.tool) : null;
    if (b.type === 'tool' && !tool) return;
    const card = document.createElement('article'); const wide = b.w ?? b.type === 'tool'; card.className = `block panel-card${wide ? ' wide' : ''}`;
    card.innerHTML = `<header class="block-head"><strong>${b.type === 'text' ? 'Note' : b.type === 'check' ? 'Checklist' : esc(tool.name)}</strong><span><button class="chip" data-sz aria-label="Resize block">⤢</button><button class="chip" data-mv="-1" aria-label="Move up">↑</button><button class="chip" data-mv="1" aria-label="Move down">↓</button><button class="chip" data-rm aria-label="Delete block">✕</button></span></header><div class="block-body"></div>`;
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
    $('[data-sz]', card).onclick = () => { b.w = !wide; saveBlocks(); renderCanvas(); };
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
  ...TOOLS.map((t) => ({ id: t.id, name: t.name, sub: t.group, icon: t.icon, render: t.render }))].map((a, i) => ({ ...a, color: COLORS[i % COLORS.length] }));
const appById = (id) => APPS.find((a) => a.id === id);

/* ---------- Window manager: movable, resizable, multi-window; apps stay alive ---------- */
const stackList = $('#taskStackList'); const switcher = $('#taskSwitcher');
const stages = { landing: $('#landingStage'), device: $('#deviceStage'), desktop: $('#desktopStage') };
const switchStage = (n) => Object.entries(stages).forEach(([k, s]) => { s.classList.toggle('is-active', k === n); s.setAttribute('aria-hidden', String(k !== n)); });
const layer = document.createElement('div'); layer.id = 'winLayer'; $('#desktopStage').append(layer);
const wins = new Map(); let zTop = 1; let focusedId = null; let cascade = 0;
const compact = () => matchMedia('(max-width: 820px)').matches;
const unsaved = (el) => el.querySelector('a[download]:not([hidden]):not([data-saved])');

$('.launcher-grid').innerHTML = APPS.map((a) => `<button class="launcher-tile" type="button" data-app="${a.id}"><span class="launcher-orb" style="background:${a.color}"><i class="fa-solid ${a.icon}" aria-hidden="true"></i></span><span class="launcher-name">${a.name}</span></button>`).join('');
$('.launcher-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b) openApp(b.dataset.app); });
document.addEventListener('click', (e) => { const a = e.target.closest('a[download]'); if (a) a.dataset.saved = '1'; });
window.addEventListener('beforeunload', (e) => { if ([...wins.values()].some((w) => unsaved(w.el))) { e.preventDefault(); e.returnValue = ''; } });

function focusWin(id) {
  const w = wins.get(id); if (!w) return;
  w.el.hidden = false; w.el.style.zIndex = ++zTop; focusedId = id;
  wins.forEach((x, k) => x.el.classList.toggle('is-focus', k === id)); renderStacks();
}
function closeWin(id) {
  const w = wins.get(id); if (!w) return;
  if (unsaved(w.el) && !window.confirm(`${w.app.name} has a result you haven't saved yet. Close it anyway?`)) return;
  w.el.remove(); wins.delete(id);
  if (focusedId === id) { focusedId = null; const top = [...wins.entries()].filter(([, x]) => !x.el.hidden).sort((a, b) => b[1].el.style.zIndex - a[1].el.style.zIndex)[0]; if (top) focusWin(top[0]); }
  renderStacks();
}
function minimise(id) { const w = wins.get(id); if (!w) return; w.el.hidden = true; w.el.classList.remove('is-focus'); if (focusedId === id) focusedId = null; renderStacks(); }

function openApp(id) {
  const app = appById(id); if (!app) return;
  if (wins.has(id)) { focusWin(id); return; }
  const el = document.createElement('section'); el.className = 'win'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', app.name);
  const w = Math.min(780, innerWidth - 40); const h = Math.min(540, innerHeight - 190); const n = cascade % 6; cascade += 1;
  el.style.cssText = `width:${w}px;height:${h}px;left:${Math.max(10, (innerWidth - w) / 2 + (n - 3) * 30)}px;top:${96 + n * 30}px`;
  el.innerHTML = `<header class="win-bar"><span class="win-icon" style="background:${app.color}"><i class="fa-solid ${app.icon}" aria-hidden="true"></i></span><strong class="win-title">${esc(app.name)}</strong><span class="win-btns"><button data-w="min" aria-label="Minimise">–</button><button data-w="max" aria-label="Maximise">□</button><button data-w="close" aria-label="Close">✕</button></span></header><div class="win-body"></div>`;
  layer.append(el); wins.set(id, { el, app });
  try { app.render($('.win-body', el)); } catch (err) { $('.win-body', el).innerHTML = `<p class="hint">✗ Could not open ${esc(app.name)}: ${esc(err.message)}</p>`; }
  focusWin(id);
  el.addEventListener('pointerdown', () => { if (focusedId !== id) focusWin(id); }, true);
  const bar = $('.win-bar', el);
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) el.classList.toggle('max'); });
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || compact() || el.classList.contains('max')) return;
    const sx = e.clientX - el.offsetLeft; const sy = e.clientY - el.offsetTop; bar.setPointerCapture(e.pointerId);
    const move = (ev) => { el.style.left = `${Math.min(innerWidth - 120, Math.max(120 - el.offsetWidth, ev.clientX - sx))}px`; el.style.top = `${Math.min(innerHeight - 150, Math.max(70, ev.clientY - sy))}px`; };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  });
  $('.win-btns', el).addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; if (b.dataset.w === 'min') minimise(id); else if (b.dataset.w === 'max') el.classList.toggle('max'); else closeWin(id); });
}

function closeStacks() { switcher.classList.remove('is-open'); switcher.setAttribute('aria-hidden', 'true'); $('#stacksButton').classList.remove('is-active'); $('#stacksButton').setAttribute('aria-expanded', 'false'); }
function renderStacks() {
  stackList.innerHTML = wins.size ? [...wins.entries()].map(([id, { el, app }]) => `<article class="stack-card${id === focusedId ? ' is-current' : ''}" data-stack="${id}" role="button" tabindex="0" aria-label="Open ${esc(app.name)}"><span class="stack-card-icon" style="background:${app.color}"><i class="fa-solid ${app.icon}" aria-hidden="true"></i></span><span><strong>${esc(app.name)}</strong><small>${el.hidden ? 'Minimised' : id === focusedId ? 'In front' : 'Open'}${unsaved(el) ? ' · unsaved result' : ''}</small></span><button class="terminate-app-btn" type="button" data-close="${id}" aria-label="Close ${esc(app.name)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></article>`).join('') : '<div class="empty-stacks">No open windows. Launch a tool from the home screen.</div>';
}
stackList.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) { e.stopPropagation(); closeWin(c.dataset.close); return; } const s = e.target.closest('[data-stack]'); if (s) { focusWin(s.dataset.stack); closeStacks(); } });
stackList.addEventListener('keydown', (e) => { const s = e.target.closest('[data-stack]'); if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focusWin(s.dataset.stack); closeStacks(); } });
$('#backButton').addEventListener('click', () => {
  const wasOpen = switcher.classList.contains('is-open'); closeStacks(); if (wasOpen) return;
  if (focusedId) { minimise(focusedId); return; }
  if (wins.size === 0) stepTo('device'); // nothing open at all: go back to the device choice
});
$('#homeButton').addEventListener('click', () => { closeStacks(); wins.forEach((_, id) => minimise(id)); });
$('#stacksButton').addEventListener('click', () => { const open = !switcher.classList.contains('is-open'); switcher.classList.toggle('is-open', open); switcher.setAttribute('aria-hidden', String(!open)); $('#stacksButton').classList.toggle('is-active', open); $('#stacksButton').setAttribute('aria-expanded', String(open)); if (open) renderStacks(); });
$('#closeStacksBtn').addEventListener('click', closeStacks);

/* ---------- Stages, device choice, clock ---------- */
/* Three screens: landing → device choice → launcher. The browser's own Back button / phone back gesture walks the same path. */
const ORDER = ['landing', 'device', 'desktop']; let at = 0; let histOk = true; let pending = null; let starting = false;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
try { history.replaceState({ s: 'landing' }, '', location.href); } catch { histOk = false; }
function showDeviceHint() { const h = $('#deviceHint'); const a = pending && appById(pending); h.textContent = a ? `Next: ${a.name} will open on your home screen.` : ''; h.hidden = !a; }
function stepTo(name) {
  const i = ORDER.indexOf(name);
  if (i > at) { switchStage(name); if (histOk) { try { history.pushState({ s: name }, '', location.href); } catch { histOk = false; } } at = i; }
  else if (i < at) {
    if (histOk && at - i === 1) { history.back(); setTimeout(() => { if (at !== i) { switchStage(name); at = i; if (!i) pending = null; } }, 400); } // popstate normally does this; the timer is a safety net
    else { switchStage(name); at = i; }
    if (!i) { pending = null; showDeviceHint(); }
  }
}
window.addEventListener('popstate', (e) => {
  const n = ORDER.includes(e.state?.s) ? e.state.s : 'landing'; if (ORDER.indexOf(n) === at) return;
  closeStacks(); switchStage(n); at = ORDER.indexOf(n); if (!at) { pending = null; showDeviceHint(); }
});
function startFlow(appId) {
  if (starting) return; starting = true; pending = appId && appById(appId) ? appId : null; const l = $('#loader'); l.hidden = false;
  setTimeout(() => { l.hidden = true; starting = false; showDeviceHint(); stepTo('device'); $('.tw-device-btn')?.focus({ preventScroll: true }); }, reduced() ? 100 : 900);
}
$('#getStartedBtn').addEventListener('click', () => startFlow(null));
$('#deviceBack').addEventListener('click', () => stepTo('landing'));
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-launch]'); if (l) { e.preventDefault(); startFlow(l.dataset.launch); return; }
  const s = e.target.closest('[data-scroll]'); if (s) document.getElementById(s.dataset.scroll)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#infoModal').hidden) closeInfo(); else if (switcher.classList.contains('is-open')) closeStacks(); else if (at === 1 && !starting) stepTo('landing');
});
window.addEventListener('hashchange', showShared);
$$('[data-device]').forEach((b) => b.addEventListener('click', () => {
  $('#systemMode').textContent = `WizOS - ${b.dataset.device} Mode`; closeStacks(); stepTo('desktop');
  if (pending) { const id = pending; pending = null; showDeviceHint(); openApp(id); }
}));
const tick = () => { const n = new Date(); $('#clockDisplay').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }); $('#clockDisplay').dateTime = n.toISOString(); };
tick(); setInterval(tick, 1000); renderStacks(); showShared();

/* gentle scroll-reveal for the landing page cards */
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-ready');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$('.tw-card').forEach((c, i) => { c.style.transitionDelay = `${(i % 3) * 80}ms`; io.observe(c); });
}

/* Links from the tool pages (index.html#open-docs) open that tool straight away */
{ const m = location.hash.match(/^#open-([a-z]+)$/); if (m && appById(m[1])) startFlow(m[1]); }
