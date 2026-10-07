// Small, dependency-free UI helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// Stable warm hue per person so each avatar has its own colour.
export function hue(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const warm = [10, 22, 34, 46, 28, 96, 150, 355];
  return warm[h % warm.length];
}

export function avatar(member, extraStyle = '') {
  const inner = member.photoUrl
    ? `<img src="${esc(member.photoUrl)}" alt="" loading="lazy">`
    : esc(initials(member.name));
  return `<span class="avatar" style="--h:${hue(member.id)};${extraStyle}" aria-hidden="true">${inner}</span>`;
}

export const firstName = (name) => name.split(/\s+/)[0];

export function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return '';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// ---------- Toasts ----------
export function toast(message, kind = '') {
  const host = $('.toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
}

// ---------- Sheet (modal dialog) ----------
const sheet = () => $('#sheet');

export function openSheet(html, { wide = false, className = '' } = {}) {
  const d = sheet();
  if (d.open) d.close();
  d.className = `sheet ${wide ? 'wide' : ''} ${className}`;
  d.innerHTML = html;
  d.showModal();
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', closeSheet));
  return d;
}

export function closeSheet() {
  const d = sheet();
  if (d.open) d.close();
}

// Close on backdrop click; stop media when closed.
export function initSheet() {
  const d = sheet();
  d.addEventListener('click', (e) => { if (e.target === d) closeSheet(); });
  d.addEventListener('close', () => {
    $$('video', d).forEach((v) => v.pause());
    d.innerHTML = '';
  });
}

export const sheetHead = (title, eyebrow = '') => `
  <div class="sheet-head">
    <div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h2>${esc(title)}</h2></div>
    <button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button>
  </div>`;

// ---------- Media ----------
// Reads duration and grabs a poster frame. Fails soft: some formats (e.g. HEVC
// .mov outside Safari) can't be decoded here, and that's fine.
export function inspectVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
    let done = false;
    const finish = (out) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(out); };
    setTimeout(() => finish({ duration: v.duration || 0, thumb: null }), 8000);
    v.onerror = () => finish({ duration: 0, thumb: null });
    v.onloadedmetadata = () => { v.currentTime = Math.min(1.5, (v.duration || 4) / 4); };
    v.onseeked = () => {
      try {
        const w = 640; const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        c.toBlob((blob) => finish({ duration: v.duration, thumb: blob }), 'image/jpeg', 0.82);
      } catch { finish({ duration: v.duration, thumb: null }); }
    };
  });
}

// Turns a YouTube / Vimeo share link into an embeddable player URL.
export function embedUrl(link) {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`;
  } catch { /* not a URL */ }
  return '';
}

export function youtubeThumb(link) {
  const e = embedUrl(link);
  const m = e.match(/youtube-nocookie\.com\/embed\/([\w-]+)/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : '';
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches
  || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
