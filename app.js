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
const thumbOf = (c) => { const t = document.createElement('canvas'); t.width = 56; t.height = 56; t.getContext('2d').drawImage(c, 0, 0, 56, 56); return t.toDataURL(); };

/* ffmpeg.wasm (video/audio + rare image formats), loaded on first use */
let ffP = null;
function getFF() {
  return (ffP ||= (async () => {
    const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm');
    const { toBlobURL, fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm');
    const ff = new FFmpeg(); const core = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    await ff.load({ coreURL: await toBlobURL(`${core}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${core}/ffmpeg-core.wasm`, 'application/wasm'), classWorkerURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js', 'text/javascript') });
    return { ff, fetchFile };
  })().catch((e) => { ffP = null; throw new Error(`Could not load the converter (needs internet): ${e.message}`); }));
}
async function ffRun(file, args, outName, onP) {
  const { ff, fetchFile } = await getFF(); const inn = `in.${(file.name.split('.').pop() || 'bin').replace(/\W/g, '')}`;
  await ff.writeFile(inn, await fetchFile(file)); const h = ({ progress }) => onP?.(Math.min(1, Math.max(0, progress))); ff.on('progress', h);
  try { await ff.exec(['-i', inn, ...args, outName]); const d = await ff.readFile(outName); return new Blob([d.buffer]); } finally { ff.off('progress', h); try { await ff.deleteFile(inn); await ff.deleteFile(outName); } catch { /* ignore */ } }
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
  let vfile = null; const vmsg = (t) => { q('[data-vmsg]').textContent = t; };
  wireDrop($('[data-p="vid"]', el), (fs) => { vfile = fs[0] || null; q('[data-vname]').textContent = vfile ? `${vfile.name} · ${fmtBytes(vfile.size)}` : 'No file chosen.'; }, 'video/*,audio/*');
  q('[data-vgo]').addEventListener('click', async () => {
    if (!vfile) return vmsg('Choose a file first.');
    const fmt = q('[data-vf]').value; const [, base, kind] = VID[fmt]; const args = [...base];
    if (kind === 'v') {
      const vf = []; if (fmt === 'gif') vf.push('fps=12'); if (q('[data-vr]').value) vf.push(`scale=-2:${q('[data-vr]').value}`); if (vf.length) args.push('-vf', vf.join(','));
      if (args.includes('libx264')) args.push('-crf', q('[data-vq]').value); if (q('[data-vm]').checked || fmt === 'gif') args.push('-an');
    }
    if (q('[data-vs]').value) args.push('-ss', q('[data-vs]').value); if (q('[data-ve]').value) args.push('-to', q('[data-ve]').value);
    try {
      vmsg('Loading converter and working…'); q('[data-vout]').innerHTML = '';
      const blob = await ffRun(vfile, args, `out.${fmt}`, (p) => q('[data-vbar]').style.setProperty('--progress', `${Math.round(p * 100)}%`));
      q('[data-vbar]').style.setProperty('--progress', '100%'); addResult(q('[data-vout]'), `${vfile.name.replace(/\.[^.]+$/, '')}.${fmt}`, blob); vmsg('Done.');
    } catch (e) { vmsg(`✗ ${e.message}`); }
  });
}

/* ---------- Document Tools ---------- */
function docTool(el) {
  const OUT = { pdf: 'Merged PDF', pptx: 'PowerPoint (.pptx)', images: 'Page images (PNG)', compress: 'Compressed PDF' };
  el.innerHTML = `${dropHtml('Drop PDFs and images — mix as many as you like')}<div class="list" data-files></div>
    <div class="opt-grid"><label>Output <select class="select-field" data-o>${Object.entries(OUT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>Only these pages (optional) <input class="field" data-range placeholder="e.g. 1-3, 5" /></label>
    <label>Compression <select class="select-field" data-lvl><option value="0">Light</option><option value="1" selected>Balanced</option><option value="2">Maximum</option></select></label></div>
    <p class="hint">Files are combined in the order shown, then converted to your chosen output. Word, Excel and PowerPoint inputs are coming next.</p>
    <div class="row"><button class="btn primary" data-go>Create</button><span class="hint" data-msg></span></div><div class="list" data-res></div>`;
  let files = []; const msg = (t) => { $('[data-msg]', el).textContent = t; };
  const paint = () => { $('[data-files]', el).innerHTML = files.map((f, i) => `<div class="list-row"><span class="grow">${esc(f.name)} <small>${fmtBytes(f.size)}</small></span><button class="chip" data-up="${i}" aria-label="Move up">↑</button><button class="chip" data-rm="${i}" aria-label="Remove">✕</button></div>`).join(''); };
  $('[data-files]', el).addEventListener('click', (e) => { const u = e.target.closest('[data-up]'); const r = e.target.closest('[data-rm]'); if (u && +u.dataset.up > 0) { const i = +u.dataset.up; [files[i - 1], files[i]] = [files[i], files[i - 1]]; } if (r) files.splice(+r.dataset.rm, 1); paint(); });
  wireDrop(el, (fs) => { files = [...files, ...fs.filter((f) => isPdf(f) || f.type.startsWith('image/') || isHeic(f))]; paint(); }, 'application/pdf,image/*,.heic');
  $('[data-go]', el).addEventListener('click', async () => {
    if (!files.length) return msg('Add at least one file.'); const res = $('[data-res]', el); res.innerHTML = ''; const kind = $('[data-o]', el).value;
    try {
      msg('Working…'); await loadScript(PDFLIB); const { PDFDocument } = window.PDFLib; let out = await PDFDocument.create();
      for (const f of files) {
        if (isPdf(f)) { const s = await PDFDocument.load(await f.arrayBuffer()); (await out.copyPages(s, s.getPageIndices())).forEach((p) => out.addPage(p)); } else {
          const c = await toCanvas(f); const im = await out.embedJpg(await (await blobOf(c, 'image/jpeg', 0.92)).arrayBuffer()); out.addPage([c.width, c.height]).drawImage(im, { x: 0, y: 0, width: c.width, height: c.height });
        }
      }
      const range = $('[data-range]', el).value.trim();
      if (range) { const idx = parseRange(range, out.getPageCount()); if (!idx.length) return msg(`Enter valid pages (1–${out.getPageCount()}).`); const o2 = await PDFDocument.create(); (await o2.copyPages(out, idx)).forEach((p) => o2.addPage(p)); out = o2; }
      const bytes = await out.save();
      if (kind === 'pdf') { addResult(res, 'merged.pdf', new Blob([bytes], { type: 'application/pdf' }), `· ${out.getPageCount()} pages`); return msg('Done.'); }
      const doc = await pdfDoc(bytes.slice()); const n = doc.numPages; const lvl = +$('[data-lvl]', el).value;
      if (kind === 'images') { for (let i = 1; i <= n; i += 1) { msg(`Rendering page ${i}/${n}…`); const c = await renderPage(doc, i, 2); addResult(res, `page-${i}.png`, await blobOf(c), '', thumbOf(c)); } }
      if (kind === 'compress') {
        const [scale, qual] = [[1.8, 0.8], [1.3, 0.62], [1, 0.45]][lvl]; const d = await PDFDocument.create();
        for (let i = 1; i <= n; i += 1) { msg(`Compressing page ${i}/${n}…`); const c = await renderPage(doc, i, scale); const im = await d.embedJpg(await (await blobOf(c, 'image/jpeg', qual)).arrayBuffer()); d.addPage([c.width / scale, c.height / scale]).drawImage(im, { x: 0, y: 0, width: c.width / scale, height: c.height / scale }); }
        addResult(res, 'compressed.pdf', new Blob([await d.save()], { type: 'application/pdf' }), `· was ${fmtBytes(bytes.length)} (text becomes images)`);
      }
      if (kind === 'pptx') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'); const p = new window.PptxGenJS(); const first = await renderPage(doc, 1, 1); const H = (10 * first.height) / first.width;
        p.defineLayout({ name: 'DOC', width: 10, height: H }); p.layout = 'DOC';
        for (let i = 1; i <= n; i += 1) { msg(`Building slide ${i}/${n}…`); const c = await renderPage(doc, i, 1.6); p.addSlide().addImage({ data: c.toDataURL('image/jpeg', 0.85), x: 0, y: 0, w: 10, h: (10 * c.height) / c.width }); }
        addResult(res, 'document.pptx', await p.write('blob'), `· ${n} slides`);
      }
      msg('Done.');
    } catch (e) { msg(`✗ ${/encrypt/i.test(e.message) ? 'A PDF is encrypted or damaged.' : e.message}`); }
  });
}

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
        if (/\.(dwg|dxf|psd|ai)$/i.test(file.a.name + file.b.name)) return msg('CAD and layered design files (DWG, DXF, PSD, AI) cannot be opened in a browser. Export both as PDF or PNG from your design app, then compare them here.');
        const a = await toCanvas(file.a); const b = await toCanvas(file.b); const r = pixelDiff(a, b, th); const row = document.createElement('div'); row.className = 'cmp-row'; row.append(fig(a, 'Original'), fig(b, 'New version'), fig(r.canvas, `Differences (red) — ${r.pct.toFixed(2)}% changed`)); out.append(row);
        msg(r.pct === 0 ? 'No visible difference.' : `${r.pct.toFixed(2)}% of pixels differ.${a.width !== b.width || a.height !== b.height ? ' Sizes differ, so the new version was scaled to match.' : ''}`);
      } else if (mode === 'pdf') {
        const da = await pdfDoc(await file.a.arrayBuffer()); const db = await pdfDoc(await file.b.arrayBuffer()); const n = Math.min(da.numPages, db.numPages); let changed = 0;
        for (let i = 1; i <= n; i += 1) { msg(`Comparing page ${i}/${n}…`); const r = pixelDiff(await renderPage(da, i, 1.2), await renderPage(db, i, 1.2), th); if (r.pct > 0.02) { changed += 1; out.append(fig(r.canvas, `Page ${i} — ${r.pct.toFixed(2)}% changed (red)`)); } }
        msg(`${changed} of ${n} page(s) changed.${da.numPages !== db.numPages ? ` Page counts differ (${da.numPages} vs ${db.numPages}).` : ''}`);
      } else {
        const ta = await textOf(file.a); const tb = await textOf(file.b); let tok = (s) => s.split(/(\s+)/); if ((ta.length + 1) * (tb.length + 1) > 0 && tok(ta).length * tok(tb).length > 6e6) tok = (s) => s.split(/(\n)/);
        const ops = seqDiff(tok(ta), tok(tb)); let add = 0; let del = 0;
        const html = ops.map(([t, s]) => (t === '=' ? esc(s) : t === '+' ? (s.trim() ? (add += 1, `<ins style="background:rgba(34,197,94,.5);text-decoration:none;border-radius:3px">${esc(s)}</ins>`) : esc(s)) : (s.trim() ? (del += 1, `<del style="background:rgba(239,68,68,.55);border-radius:3px">${esc(s)}</del>`) : ''))).join('');
        out.innerHTML = `<div class="panel-card diff-doc">${html}</div>`; msg(`${add} addition(s) in green, ${del} deletion(s) in red.`);
      }
    } catch (e) { msg(`✗ ${e.message}`); }
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
        const v = $('[data-v]', el); v.src = url; v.hidden = false; const dl = $('[data-dl]', el); dl.href = url; dl.download = 'recording.webm'; dl.removeAttribute('data-saved'); dl.hidden = false; go.textContent = 'Start recording'; msg.textContent = 'Recording ready.';
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
      $('[data-r]', el).src = url; $('[data-r]', el).hidden = false; const dl = $('[data-dl]', el); dl.href = url; dl.download = `${f.name.replace(/\.[^.]+$/, '')}-nobg.png`; dl.removeAttribute('data-saved'); dl.hidden = false; msg.textContent = 'Done.';
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

function padTool(el) {
  el.innerHTML = `<textarea class="textarea-panel" data-t placeholder="Scratchpad — saves automatically in this browser…" aria-label="Scratchpad"></textarea><p class="hint" data-s>Saved</p>`;
  const t = $('[data-t]', el); t.value = store.get('scratchpad', ''); let timer;
  t.addEventListener('input', () => { $('[data-s]', el).textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(() => { store.set('scratchpad', t.value); $('[data-s]', el).textContent = 'Saved'; }, 350); });
}

/* ---------- Translate & Grammar ---------- */
const LANGS = [['en', 'English'], ['hi', 'Hindi'], ['kn', 'Kannada'], ['ta', 'Tamil'], ['te', 'Telugu'], ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['ur', 'Urdu'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['tr', 'Turkish'], ['nl', 'Dutch']];
function chunkText(t, max) {
  const out = []; let cur = '';
  for (const part of t.match(/[^.!?\n।]+[.!?।]*\s*|\n+/g) || [t]) {
    if (cur && (cur + part).length > max) { out.push(cur); cur = ''; }
    cur += part; while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur); return out;
}
async function ltCheck(text, lang) {
  const matches = []; let base = 0;
  for (const chunk of chunkText(text, 15000)) {
    const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text: chunk, language: lang }) });
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
    <textarea class="textarea-panel" data-dst readonly placeholder="Translation appears here" aria-label="Translation"></textarea><div class="row"><button class="btn" data-tcopy>Copy translation</button></div></section>
  <section data-p="gr" class="stack-gap" hidden><div class="row"><select class="select-field" data-glang aria-label="Language"><option value="auto">Detect language</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="de-DE">German</option><option value="fr">French</option><option value="es">Spanish</option><option value="it">Italian</option><option value="pt-PT">Portuguese</option><option value="nl">Dutch</option></select></div>
    <textarea class="textarea-panel" data-gtxt placeholder="Paste your text to check spelling and grammar" aria-label="Text to check"></textarea>
    <div class="row"><button class="btn primary" data-ggo>Check grammar</button><button class="btn" data-gfix>Fix all</button><button class="btn" data-gcopy>Copy text</button><span class="hint" data-gmsg></span></div><div class="list" data-gout></div>
    <p class="hint">Grammar checking covers English and major European languages. Indian languages are not supported by this checker.</p></section>`;
  const q = (s) => $(s, el);
  $$('[data-m]', el).forEach((t) => t.addEventListener('click', () => { $$('[data-m]', el).forEach((x) => x.classList.toggle('is-on', x === t)); $$('[data-p]', el).forEach((p) => { p.hidden = p.dataset.p !== t.dataset.m; }); }));
  q('[data-swap]').addEventListener('click', () => { const f = q('[data-from]'); const t = q('[data-to]'); if (f.value === 'auto') return; [f.value, t.value] = [t.value, f.value]; q('[data-src]').value = q('[data-dst]').value; q('[data-dst]').value = ''; });
  q('[data-tcopy]').addEventListener('click', () => copy(q('[data-dst]').value));
  const mm = (c) => (c === 'zh' ? 'zh-CN' : c); const tmsg = (t) => { q('[data-tmsg]').textContent = t; };
  q('[data-tgo]').addEventListener('click', async () => {
    const text = q('[data-src]').value; if (!text.trim()) return; const from = q('[data-from]').value; const to = q('[data-to]').value; const dst = q('[data-dst]'); dst.value = '';
    try {
      if (window.Translator) {
        try {
          let s = from; if (s === 'auto') { if (!window.LanguageDetector) throw new Error('no detector'); s = (await (await window.LanguageDetector.create()).detect(text.slice(0, 2000)))[0].detectedLanguage; }
          if (s === to) { dst.value = text; return tmsg('Source and target language are the same.'); }
          if ((await window.Translator.availability({ sourceLanguage: s, targetLanguage: to })) === 'unavailable') throw new Error('pair unavailable');
          tmsg('Preparing on-device translator…'); const tr = await window.Translator.create({ sourceLanguage: s, targetLanguage: to }); const parts = chunkText(text, 1500); const res = [];
          for (let i = 0; i < parts.length; i += 1) { tmsg(`Translating ${i + 1}/${parts.length} on your device…`); res.push(await tr.translate(parts[i])); dst.value = res.join(''); }
          return tmsg('Done · translated on your device, nothing was uploaded.');
        } catch { /* fall back to online service */ }
      }
      const parts = chunkText(text, 450); const res = [];
      for (let i = 0; i < parts.length; i += 1) {
        tmsg(`Translating ${i + 1}/${parts.length}…`);
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(parts[i])}&langpair=${from === 'auto' ? 'Autodetect' : mm(from)}|${mm(to)}`); const j = await r.json();
        const t = j.responseData?.translatedText || ''; if (/MYMEMORY WARNING/i.test(t) || (j.responseStatus && +j.responseStatus !== 200)) throw new Error('The free translation limit for today has been reached. Try again tomorrow or use a shorter text.');
        res.push(t); dst.value = res.join('');
      }
      tmsg('Done · translated with the free online service.');
    } catch (e) { tmsg(`✗ ${e.message}`); }
  });
  let matches = []; const gta = q('[data-gtxt]'); const gmsg = (t) => { q('[data-gmsg]').textContent = t; };
  const check = async () => {
    if (!gta.value.trim()) return; gmsg('Checking…');
    try {
      matches = await ltCheck(gta.value, q('[data-glang]').value); const text = gta.value;
      q('[data-gout]').innerHTML = matches.length ? matches.slice(0, 150).map((m, i) => `<div class="list-row"><span class="grow"><b>${esc(text.substr(m.offset, m.length) || '·')}</b> — ${esc(m.message)}</span>${m.replacements.slice(0, 3).map((r, k) => `<button class="chip" data-fix="${i}:${k}">${esc(r.value) || '(remove)'}</button>`).join('')}</div>`).join('') : '<p class="hint">✓ No problems found.</p>';
      gmsg(matches.length ? `${matches.length} issue(s) found.` : 'All good.');
    } catch (e) { gmsg(`✗ ${e.message}`); }
  };
  const applyFix = (m, rep) => { gta.value = gta.value.slice(0, m.offset) + rep + gta.value.slice(m.offset + m.length); };
  q('[data-ggo]').addEventListener('click', check);
  q('[data-gout]').addEventListener('click', (e) => { const b = e.target.closest('[data-fix]'); if (!b) return; const [i, k] = b.dataset.fix.split(':').map(Number); applyFix(matches[i], matches[i].replacements[k].value); check(); });
  q('[data-gfix]').addEventListener('click', () => { let limit = Infinity; [...matches].sort((a, b) => b.offset - a.offset).forEach((m) => { if (m.replacements.length && m.offset + m.length <= limit) { applyFix(m, m.replacements[0].value); limit = m.offset; } }); check(); });
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
      rec.onerror = (e) => { if (e.error === 'not-allowed') { on = false; q('[data-vmsg]').textContent = 'Microphone permission was denied.'; } };
      rec.onend = () => { if (on && el.isConnected) rec.start(); else { on = false; mic.innerHTML = '<i class="fa-solid fa-microphone"></i> Start speaking'; } }; rec.start();
    };
    start(); mic.innerHTML = '<i class="fa-solid fa-stop"></i> Stop'; q('[data-vmsg]').textContent = '● Listening…';
  });
  q('[data-vcopy]').addEventListener('click', () => copy(vtxt.value)); q('[data-vclear]').addEventListener('click', () => { vtxt.value = ''; });
  const synth = window.speechSynthesis; const vsel = q('[data-voice]');
  const loadVoices = () => { const vs = synth?.getVoices() || []; vsel.innerHTML = vs.map((v, i) => `<option value="${i}">${esc(v.name)} (${v.lang})</option>`).join('') || '<option>No voices found</option>'; const d = vs.findIndex((v) => /en-IN/i.test(v.lang)); if (d >= 0) vsel.value = d; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  q('[data-play]').addEventListener('click', () => {
    if (!synth) return (q('[data-rmsg]').textContent = 'Read aloud is not supported in this browser.');
    synth.cancel(); const parts = chunkText(q('[data-rtxt]').value, 180).filter((p) => p.trim()); const voice = synth.getVoices()[+vsel.value]; let i = 0;
    const next = () => { if (i >= parts.length || !el.isConnected) { q('[data-rmsg]').textContent = ''; return; } const u = new SpeechSynthesisUtterance(parts[i]); if (voice) { u.voice = voice; u.lang = voice.lang; } u.rate = +q('[data-rate]').value; i += 1; u.onend = next; q('[data-rmsg]').textContent = `Reading ${i}/${parts.length}…`; synth.speak(u); };
    next();
  });
  q('[data-pause]').addEventListener('click', (e) => { if (synth.paused) { synth.resume(); e.target.textContent = 'Pause'; } else { synth.pause(); e.target.textContent = 'Resume'; } });
  q('[data-stop]').addEventListener('click', () => { synth.cancel(); q('[data-rmsg]').textContent = ''; });
}

/* ---------- AI Assistant (talks to your Cloudflare Worker) ---------- */
const AI_URL = 'https://calm-wood-0799.sridhar-kulkarni150.workers.dev';
async function textFromFile(f) {
  if (isPdf(f)) { const d = await pdfDoc(await f.arrayBuffer()); let t = ''; for (let i = 1; i <= d.numPages && t.length < 20000; i += 1) { const c = await (await d.getPage(i)).getTextContent(); t += `${c.items.map((x) => x.str).join(' ')}\n`; } return t; }
  if (/\.docx$/i.test(f.name)) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'); return (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
  return f.text();
}
const mdLite = (s) => esc(s).split(/```/).map((p, i) => (i % 2 ? `<pre><code>${p.replace(/^\w*\n/, '')}</code></pre>` : p.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br />'))).join('');
function aiTool(el) {
  el.innerHTML = `<div class="chat-log" data-log aria-live="polite"></div>
    <div class="row"><button class="chip" data-qp="Summarize this in simple words:\n\n">Summarize</button><button class="chip" data-qp="Explain this simply:\n\n">Explain simply</button><button class="chip" data-qp="Write a polite, professional email about: ">Write an email</button><button class="chip" data-qp="Fix the grammar and improve this text:\n\n">Improve my text</button></div>
    <div class="chat-input"><textarea class="textarea-panel" data-in rows="2" placeholder="Ask anything… (Enter to send, Shift+Enter for a new line)" aria-label="Message"></textarea><button class="btn primary" data-send>Send</button></div>
    <div class="row"><label class="btn"><i class="fa-solid fa-paperclip"></i> Attach file<input type="file" hidden data-file accept=".txt,.md,.csv,.json,.pdf,.docx" /></label><span class="hint grow" data-att></span><button class="chip" data-clear>New chat</button></div>`;
  const q = (s) => $(s, el); const log = q('[data-log]'); const input = q('[data-in]'); let msgs = store.get('ai-chat', []); let attach = null; let busy = false;
  const paint = (extra = '') => {
    log.innerHTML = (msgs.length ? msgs.map((m, i) => `<div class="bubble ${m.role === 'user' ? 'user' : 'ai'}">${mdLite(m.show ?? m.content)}${m.role === 'assistant' ? `<div class="bubble-tools"><button class="chip" data-copy="${i}">Copy</button><button class="chip" data-canvas="${i}">Send to Canvas</button></div>` : ''}</div>`).join('') : '<p class="hint">Hi! Ask me anything, paste text to summarize or rewrite, or attach a PDF, Word or text file to ask about it.</p>') + extra;
    log.scrollTop = log.scrollHeight;
  };
  const send = async () => {
    const text = input.value.trim(); if (busy || (!text && !attach)) return;
    let content = text || 'Please summarize this file.'; let show = content;
    if (attach) { content += `\n\n[Attached file: ${attach.name}]\n${attach.text}`; show += `\n📎 ${attach.name}`; }
    msgs.push({ role: 'user', content, show }); input.value = ''; attach = null; q('[data-att]').textContent = ''; busy = true; paint('<div class="bubble ai"><span class="hint">Thinking…</span></div>');
    try {
      const body = JSON.stringify({ messages: msgs.slice(-12).map((m, i, a) => ({ role: m.role, content: i === a.length - 1 ? m.content : m.content.slice(0, 3000) })) });
      const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error || !j.reply) throw new Error(r.status === 403 ? 'The AI only works when WizOS is opened from your website.' : j.error || `The AI returned an error (${r.status}). The free daily limit may be used up.`);
      msgs.push({ role: 'assistant', content: j.reply }); msgs = msgs.slice(-40); store.set('ai-chat', msgs); paint();
    } catch (e) { paint(`<div class="bubble ai err">✗ ${esc(e.message === 'Failed to fetch' ? 'Could not reach the AI. Check your internet connection.' : e.message)}</div>`); }
    busy = false;
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
    if (k) { blocks.unshift({ id: Date.now(), type: 'text', data: msgs[+k.dataset.canvas].content }); saveBlocks(); if (canvasRoot?.isConnected) renderCanvas(); toast('Saved to Canvas'); }
  });
  paint();
}

const TOOLS = [
  { id: 'ai', name: 'AI Assistant', icon: 'fa-brain', group: 'AI & Writing', render: aiTool },
  { id: 'media', name: 'Media Converter', icon: 'fa-photo-film', group: 'Image & Media', render: mediaTool },
  { id: 'bg', name: 'Background Remover', icon: 'fa-wand-magic-sparkles', group: 'Image & Media', render: bgTool },
  { id: 'docs', name: 'Document Tools', icon: 'fa-file-pdf', group: 'Documents', render: docTool },
  { id: 'compare', name: 'Compare', icon: 'fa-code-compare', group: 'Documents', render: compareTool },
  { id: 'write', name: 'Translate & Grammar', icon: 'fa-language', group: 'Writing & Language', render: writeTool },
  { id: 'speak', name: 'Read & Speak', icon: 'fa-microphone-lines', group: 'Writing & Language', render: speakTool },
  { id: 'qr', name: 'QR Generator', icon: 'fa-qrcode', group: 'Quick Utilities', render: qrTool },
  { id: 'rec', name: 'Screen Recorder', icon: 'fa-video', group: 'Quick Utilities', render: recorderTool },
  { id: 'pad', name: 'Scratchpad', icon: 'fa-note-sticky', group: 'Quick Utilities', render: padTool },
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
  ...TOOLS.map((t) => ({ id: t.id, name: t.name, sub: t.group, icon: t.icon, render: t.render }))].map((a, i) => ({ ...a, color: COLORS[i] }));
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
  layer.append(el); wins.set(id, { el, app }); app.render($('.win-body', el)); focusWin(id);
  el.addEventListener('pointerdown', () => { if (focusedId !== id) focusWin(id); }, true);
  const bar = $('.win-bar', el);
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) el.classList.toggle('max'); });
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || compact() || el.classList.contains('max')) return;
    const sx = e.clientX - el.offsetLeft; const sy = e.clientY - el.offsetTop; bar.setPointerCapture(e.pointerId);
    const move = (ev) => { el.style.left = `${Math.min(innerWidth - 120, Math.max(120 - el.offsetWidth, ev.clientX - sx))}px`; el.style.top = `${Math.min(innerHeight - 150, Math.max(70, ev.clientY - sy))}px`; };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
  });
  $('.win-btns', el).addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; if (b.dataset.w === 'min') minimise(id); else if (b.dataset.w === 'max') el.classList.toggle('max'); else closeWin(id); });
}

function closeStacks() { switcher.classList.remove('is-open'); switcher.setAttribute('aria-hidden', 'true'); $('#stacksButton').classList.remove('is-active'); }
function renderStacks() {
  stackList.innerHTML = wins.size ? [...wins.entries()].map(([id, { el, app }]) => `<article class="stack-card${id === focusedId ? ' is-current' : ''}" data-stack="${id}" role="button" tabindex="0" aria-label="Open ${esc(app.name)}"><span class="stack-card-icon" style="background:${app.color}"><i class="fa-solid ${app.icon}" aria-hidden="true"></i></span><span><strong>${esc(app.name)}</strong><small>${el.hidden ? 'Minimised' : id === focusedId ? 'In front' : 'Open'}${unsaved(el) ? ' · unsaved result' : ''}</small></span><button class="terminate-app-btn" type="button" data-close="${id}" aria-label="Close ${esc(app.name)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></article>`).join('') : '<div class="empty-stacks">No open windows. Launch a tool from the home screen.</div>';
}
stackList.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) { e.stopPropagation(); closeWin(c.dataset.close); return; } const s = e.target.closest('[data-stack]'); if (s) { focusWin(s.dataset.stack); closeStacks(); } });
stackList.addEventListener('keydown', (e) => { const s = e.target.closest('[data-stack]'); if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focusWin(s.dataset.stack); closeStacks(); } });
$('#backButton').addEventListener('click', () => { closeStacks(); if (focusedId) minimise(focusedId); });
$('#homeButton').addEventListener('click', () => { closeStacks(); wins.forEach((_, id) => minimise(id)); });
$('#stacksButton').addEventListener('click', () => { const open = !switcher.classList.contains('is-open'); switcher.classList.toggle('is-open', open); switcher.setAttribute('aria-hidden', String(!open)); $('#stacksButton').classList.toggle('is-active', open); if (open) renderStacks(); });
$('#closeStacksBtn').addEventListener('click', closeStacks);

/* ---------- Stages, device choice, clock ---------- */
$('#getStartedBtn').addEventListener('click', () => switchStage('device'));
$$('[data-device]').forEach((b) => b.addEventListener('click', () => { $('#systemMode').textContent = `WizOS - ${b.dataset.device} Mode`; closeStacks(); switchStage('desktop'); }));
const tick = () => { const n = new Date(); $('#clockDisplay').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }); $('#clockDisplay').dateTime = n.toISOString(); };
tick(); setInterval(tick, 1000); renderStacks(); showShared();
