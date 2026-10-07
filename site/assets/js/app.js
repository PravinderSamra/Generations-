import { config } from './config.js';
import { createStore } from './store/index.js';
import {
  $, $$, esc, icon, avatar, firstName, toast, openSheet, closeSheet, initSheet, sheetHead,
  formatDuration, formatDate, formatBytes, inspectVideo, embedUrl, youtubeThumb, isTouch,
} from './ui.js';

const main = $('#main');
const state = { store: null, families: [], counts: {}, videoCache: new Map() };

const GEN_NAMES = ['Elders', 'Parents', 'Children', 'Grandchildren', 'Great-grandchildren'];
const PROMPTS = [
  'My earliest memory', 'Where I grew up', 'How we met', 'My parents and grandparents',
  'A family recipe', 'Our traditions', 'My proudest moment', 'Advice for the future',
  'What I want you to know',
];

// ---------------------------------------------------------------- data
async function loadData() {
  const res = await fetch('data/families.json', { cache: 'no-cache' });
  const seed = await res.json();
  const [overrides, counts] = await Promise.all([
    state.store.memberOverrides(), state.store.videoCounts(),
  ]);
  state.counts = counts;
  state.families = seed.families.map((f) => ({
    ...f,
    members: f.members.map((m) => ({ ...m, ...clean(overrides[m.id]), familyId: f.id })),
  }));
}
const clean = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

const family = (id) => state.families.find((f) => f.id === id);
const memberIn = (f, id) => f?.members.find((m) => m.id === id);
const allMembers = () => state.families.flatMap((f) => f.members);
const count = (id) => state.counts[id] || 0;
const genName = (g) => GEN_NAMES[g - 1] || `Generation ${g}`;
const memberHref = (m, tab = '') => `#/member/${m.familyId}/${m.id}${tab ? `/${tab}` : ''}`;

function relations(f, m) {
  const by = (id) => memberIn(f, id);
  return {
    parents: (m.parents || []).map(by).filter(Boolean),
    partner: m.partner ? by(m.partner) : null,
    children: f.members.filter((c) => (c.parents || []).includes(m.id)),
    siblings: f.members.filter((s) => s.id !== m.id && m.parents?.length && s.parents?.some((p) => m.parents.includes(p))),
  };
}

// ---------------------------------------------------------------- router
const routes = [
  [/^\/?$/, viewHome],
  [/^\/family\/([\w-]+)$/, viewFamily],
  [/^\/member\/([\w-]+)\/([\w-]+)(?:\/(about|videos))?$/, viewMember],
  [/^\/about$/, viewAbout],
];

async function route() {
  if (state.store.needsSignIn()) return viewSignIn();
  const path = location.hash.replace(/^#/, '') || '/';
  for (const [re, view] of routes) {
    const m = path.match(re);
    if (m) {
      const section = view === viewMember ? 'family' : view === viewFamily ? 'family' : view === viewAbout ? 'about' : 'home';
      $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
      await view(...m.slice(1));
      return;
    }
  }
  viewNotFound();
}

function render(html, { keepScroll = false } = {}) {
  main.innerHTML = `<div class="page"><div class="wrap">${html}</div></div>`;
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---------------------------------------------------------------- views
function viewHome() {
  const members = allMembers();
  const videos = members.reduce((n, m) => n + count(m.id), 0);
  const gens = new Set(members.map((m) => m.generation)).size;
  const f0 = state.families[0];
  const orbit = members.slice(0, 7);
  const spots = [[39, 2], [74, 18], [80, 56], [56, 78], [18, 70], [2, 38], [39, 39]];

  render(`
    <section class="hero">
      <div>
        <div class="eyebrow">A video family tree</div>
        <h1 class="display">Hear them <em>in their own voice.</em></h1>
        <p class="lede">Generations keeps first-hand videos of the people we come from, so the great-grandchildren not yet born can know who we really were and what we were like.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/family/${esc(f0.id)}">${icon('tree')} Explore the ${esc(f0.name)}</a>
          <button class="btn btn-lg" type="button" data-action="upload">${icon('camera')} Record a memory</button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <svg class="rings" viewBox="0 0 400 400">
          ${[190, 160, 128, 98, 70, 44].map((r, i) => `<circle cx="200" cy="200" r="${r}" stroke-width="${i % 2 ? 0.8 : 1.4}" opacity="${0.18 + i * 0.1}" ${i === 2 ? 'stroke-dasharray="2 7"' : ''}/>`).join('')}
        </svg>
        <div class="hero-faces">
          ${orbit.map((m, i) => avatar(m, `left:${spots[i][0]}%;top:${spots[i][1]}%;animation-delay:${-i * 0.9}s`)).join('')}
        </div>
      </div>
    </section>

    <section class="stats card" aria-label="Archive at a glance">
      <div class="stat"><b>${members.length}</b><span>family members</span></div>
      <div class="stat"><b>${videos}</b><span>${videos === 1 ? 'video' : 'videos'} kept</span></div>
      <div class="stat"><b>${gens}</b><span>generations</span></div>
    </section>

    <section>
      <div class="section-head">
        <div><div class="eyebrow">Families</div><h2>Choose a branch</h2></div>
      </div>
      ${state.families.map((f) => `
        <a class="card family-card" href="#/family/${esc(f.id)}">
          <div>
            <div class="eyebrow">${f.members.length} members · ${new Set(f.members.map((m) => m.generation)).size} generations</div>
            <h3>${esc(f.name)}</h3>
            <p class="muted" style="margin:0">${esc(f.motto || '')}</p>
          </div>
          <div class="face-stack">${f.members.slice(0, 6).map((m) => avatar(m)).join('')}</div>
        </a>`).join('')}
    </section>

    <section class="steps">
      ${[
        ['Find yourself', 'Open your family branch and tap your own name — or the person you are recording.'],
        ['Record or upload', 'On a phone, film something new or pick a video from your camera roll. On a computer, choose a file.'],
        ['Tell the story', 'Add a title, a few words of context and when it was filmed. It is kept for whoever comes next.'],
      ].map(([t, d], i) => `<div class="card step"><div class="num">0${i + 1}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </section>

    <section class="quote">
      <p>“We don’t remember days, we remember moments.”</p>
      <div class="muted">— Cesare Pavese</div>
    </section>
  `);
}

function orderGenerations(f) {
  const gens = [...new Set(f.members.map((m) => m.generation || 1))].sort((a, b) => a - b);
  const placed = {};
  return gens.map((g) => {
    const row = f.members.filter((m) => (m.generation || 1) === g);
    const key = (m, depth = 0) => {
      const p = (m.parents || []).map((id) => placed[id]).filter((v) => v !== undefined);
      if (p.length) return Math.min(...p);
      const partner = row.find((x) => x.id === m.partner);
      if (partner && depth < 1 && partner.parents?.some((id) => placed[id] !== undefined)) return key(partner, depth + 1) + 0.1;
      return 1e6 + row.indexOf(m);
    };
    const sorted = [...row].sort((a, b) => key(a) - key(b));
    const households = [];
    const used = new Set();
    for (const m of sorted) {
      if (used.has(m.id)) continue;
      used.add(m.id);
      const partner = sorted.find((x) => x.id === m.partner && !used.has(x.id));
      if (partner) used.add(partner.id);
      households.push(partner ? [m, partner] : [m]);
    }
    households.flat().forEach((m, i) => { placed[m.id] = i; });
    return { g, households };
  });
}

function nodeHtml(m) {
  const n = count(m.id);
  return `<a class="card node" href="${memberHref(m)}" data-id="${esc(m.id)}">
    ${avatar(m)}
    <div class="node-name">${esc(m.name)}</div>
    <div class="node-meta">${icon('play')} ${n} ${n === 1 ? 'video' : 'videos'}</div>
  </a>`;
}

let treeResize;
function viewFamily(fid) {
  const f = family(fid);
  if (!f) return viewNotFound();
  let mode = 'tree';
  try { mode = localStorage.getItem('gen-view') || 'tree'; } catch { /* default */ }

  render(`
    <div class="family-head">
      <div><div class="eyebrow">Family tree</div><h1>${esc(f.name)}</h1><p class="lede" style="margin:8px 0 0">${esc(f.motto || '')}</p></div>
      <div class="segmented glass" role="group" aria-label="Layout">
        <button type="button" data-mode="tree" aria-pressed="${mode === 'tree'}">${icon('tree')} Tree</button>
        <button type="button" data-mode="grid" aria-pressed="${mode === 'grid'}">${icon('grid')} Everyone</button>
      </div>
    </div>
    <div id="family-body"></div>
  `);

  const body = $('#family-body');
  const draw = () => {
    if (mode === 'grid') {
      body.innerHTML = `<div class="member-grid">${f.members.map((m) => `
        <a class="card member-tile" href="${memberHref(m)}">${avatar(m)}
          <div><b>${esc(m.name)}</b><span>${genName(m.generation)} · ${count(m.id)} videos</span></div></a>`).join('')}</div>`;
      return;
    }
    const gens = orderGenerations(f);
    body.innerHTML = `<div class="tree-scroller"><div class="tree">
      <svg class="tree-lines" aria-hidden="true"></svg>
      ${gens.map(({ g, households }) => `
        <div class="gen" aria-label="${genName(g)}"><span class="gen-label">${genName(g)}</span>
          ${households.map((h) => `<div class="household">${h.map(nodeHtml).join(`<span class="bond" title="Partners">${icon('heart')}</span>`)}</div>`).join('')}
        </div>`).join('')}
    </div></div>`;
    requestAnimationFrame(() => {
      drawLines(f);
      const sc = $('.tree-scroller');
      sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
    });
  };
  draw();

  $$('.segmented button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    try { localStorage.setItem('gen-view', mode); } catch { /* ignore */ }
    $$('.segmented button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    draw();
  }));

  window.removeEventListener('resize', treeResize);
  treeResize = () => $('.tree') && drawLines(f);
  window.addEventListener('resize', treeResize);
}

// Organic "root" curves from each couple down to their children.
function drawLines(f) {
  const tree = $('.tree');
  const svg = $('.tree-lines', tree);
  if (!tree || !svg) return;
  const box = tree.getBoundingClientRect();
  const rect = (id) => {
    const el = $(`.node[data-id="${CSS.escape(id)}"]`, tree);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left + r.width / 2, top: r.top - box.top, bottom: r.bottom - box.top };
  };
  const paths = [];
  for (const m of f.members) {
    const c = rect(m.id);
    if (!c) continue;
    const parents = (m.parents || []).map(rect).filter(Boolean);
    if (!parents.length) continue;
    const sx = parents.reduce((s, p) => s + p.x, 0) / parents.length;
    const sy = Math.max(...parents.map((p) => p.bottom));
    const my = (sy + c.top) / 2;
    paths.push(`<path d="M${sx} ${sy} C${sx} ${my}, ${c.x} ${my}, ${c.x} ${c.top}"/>`);
  }
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.innerHTML = paths.join('');
}

async function viewMember(fid, mid, tab = 'about') {
  const f = family(fid);
  const m = memberIn(f, mid);
  if (!m) return viewNotFound();
  const rel = relations(f, m);
  const chip = (p, label) => `<a class="chip" href="${memberHref(p)}">${avatar(p)}${esc(firstName(p.name))} <small>${label}</small></a>`;
  const n = count(m.id);

  render(`
    <a class="crumbs" href="#/family/${esc(f.id)}">${icon('back')} ${esc(f.name)}</a>
    <section class="card profile">
      ${avatar(m)}
      <div>
        <div class="eyebrow">${genName(m.generation)}</div>
        <h1>${esc(m.name)}</h1>
        <p class="tagline">${esc(m.tagline || [m.born && `Born ${m.born}`, m.place].filter(Boolean).join(' · ') || `${firstName(m.name)}’s story, told by ${firstName(m.name)}.`)}</p>
        <div class="relations">
          ${rel.parents.map((p) => chip(p, 'parent')).join('')}
          ${rel.partner ? chip(rel.partner, 'partner') : ''}
          ${rel.siblings.map((p) => chip(p, 'sibling')).join('')}
          ${rel.children.map((p) => chip(p, 'child')).join('')}
        </div>
      </div>
      <div class="profile-actions">
        <button class="btn btn-primary" type="button" data-upload-for="${esc(m.id)}">${icon('camera')} Add a video</button>
        <button class="btn" type="button" data-edit-profile>${icon('edit')} Edit profile</button>
      </div>
    </section>

    <nav class="tabs glass" role="tablist" aria-label="${esc(m.name)}">
      <span class="tab-ink" aria-hidden="true"></span>
      <a role="tab" href="${memberHref(m, 'about')}" aria-selected="${tab === 'about'}">About</a>
      <a role="tab" href="${memberHref(m, 'videos')}" aria-selected="${tab === 'videos'}">Videos <span class="count">${n}</span></a>
    </nav>
    <section id="tab-panel" role="tabpanel"></section>
  `, { keepScroll: main.dataset.member === m.id });
  main.dataset.member = m.id;

  placeInk();
  $('[data-upload-for]').addEventListener('click', () => openUpload(m.id));
  $('[data-edit-profile]').addEventListener('click', () => openEditProfile(m));

  const panel = $('#tab-panel');
  if (tab === 'about') {
    const facts = [['Born', m.born], ['From', m.place], ['Generation', genName(m.generation)], ['Videos', `${n} kept`]].filter(([, v]) => v);
    panel.innerHTML = `<div class="about-grid">
      <div class="card">
        ${m.bio
          ? `<p class="bio">${esc(m.bio)}</p>`
          : `<div class="empty" style="padding:24px 8px">
              <div class="empty-icon">${icon('edit')}</div>
              <h3>${esc(firstName(m.name))}’s story hasn’t been written yet</h3>
              <p>Who were they? What made them laugh, what did they care about, where did life take them?</p>
              <button class="btn btn-primary" type="button" data-edit-profile>${icon('edit')} Write the bio</button>
            </div>`}
      </div>
      <div class="card"><dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>
    </div>`;
    $$('[data-edit-profile]', panel).forEach((b) => b.addEventListener('click', () => openEditProfile(m)));
    return;
  }

  panel.innerHTML = `
    <div class="card upload-cta">
      <div><h3>Add a video of ${esc(firstName(m.name))}</h3><p>${isTouch() ? 'Record now or choose from your phone’s videos.' : 'Choose a file from your computer, or drag one here.'}</p></div>
      <button class="btn btn-primary btn-lg" type="button" data-upload-for="${esc(m.id)}">${icon('upload')} Upload video</button>
    </div>
    <div id="videos"><div class="muted">Loading videos…</div></div>`;
  $('[data-upload-for]', panel).addEventListener('click', () => openUpload(m.id));
  const cta = $('.upload-cta', panel);
  enableDrop(cta, (file) => openUpload(m.id, file));

  try {
    const videos = await state.store.listVideos(m.id);
    state.videoCache.set(m.id, videos);
    renderVideos(m, videos);
  } catch (e) {
    $('#videos').innerHTML = `<p class="muted">Couldn’t load videos: ${esc(e.message)}</p>`;
  }
}

function placeInk() {
  const tabs = $('.tabs');
  const sel = $('[aria-selected="true"]', tabs);
  const ink = $('.tab-ink', tabs);
  if (!sel || !ink) return;
  ink.style.left = `${sel.offsetLeft}px`;
  ink.style.width = `${sel.offsetWidth}px`;
}
window.addEventListener('resize', () => $('.tabs') && placeInk());

function renderVideos(m, videos) {
  const host = $('#videos');
  if (!videos.length) {
    host.innerHTML = `<div class="card empty">
      <div class="empty-icon">${icon('camera')}</div>
      <h3>No videos of ${esc(firstName(m.name))} yet</h3>
      <p>Even a two-minute clip of ${esc(firstName(m.name))} talking about an ordinary day will mean the world to someone one day.</p>
      <div class="muted" style="font-size:14px">Need ideas? Try: ${PROMPTS.slice(0, 3).map((p) => `“${p}”`).join(', ')}.</div>
    </div>`;
    return;
  }
  host.innerHTML = `<div class="video-grid">${videos.map((v) => {
    const thumb = v.thumbUrl || youtubeThumb(v.link);
    return `<button class="card video-card" type="button" data-video="${esc(v.id)}">
      <div class="thumb">
        ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : `<div class="thumb-fallback">${icon('camera')}</div>`}
        <span class="play">${icon('play')}</span>
        ${v.duration ? `<span class="duration">${formatDuration(v.duration)}</span>` : ''}
        ${v.link ? '<span class="badge">Link</span>' : ''}
      </div>
      <div class="video-body">
        <h4>${esc(v.title)}</h4>
        ${v.description ? `<p>${esc(v.description)}</p>` : ''}
        <div class="when">${esc(v.recordedOn ? `Filmed ${formatDate(v.recordedOn)}` : `Added ${formatDate(v.createdAt)}`)}${v.uploadedBy ? ` · by ${esc(v.uploadedBy)}` : ''}</div>
      </div>
    </button>`;
  }).join('')}</div>`;
  $$('[data-video]', host).forEach((b) => b.addEventListener('click', () => {
    openPlayer(m, videos.find((v) => v.id === b.dataset.video));
  }));
}

function viewAbout() {
  render(`<article class="prose">
    <div class="eyebrow">How it works</div>
    <h1 class="display" style="font-size:clamp(40px,6vw,64px);margin-top:12px">A family tree you can <em>hear.</em></h1>
    <p class="lede">Photos show what people looked like. Video shows who they were — the way they laughed, the stories they always told, the words they used.</p>
    <h2>Adding a video</h2>
    <p>Open any family member and tap <strong>Add a video</strong>. On a phone you can record straight away or pick something from your camera roll. On a computer, choose a file or drag it onto the page. Give it a title and a few words of context — <strong>who is speaking, where, and why it matters</strong>.</p>
    <h2>Long videos</h2>
    <p>For long recordings, upload them to YouTube as <strong>Unlisted</strong> and paste the link instead. They play right here in the archive and don’t use up storage.</p>
    <h2>Ideas to record</h2>
    <ul>${PROMPTS.map((p) => `<li>${p}</li>`).join('')}</ul>
    <h2>Privacy</h2>
    <p>${state.store.mode === 'local'
      ? '<strong>This copy is in preview mode:</strong> videos are saved only in this browser on this device. Once the shared archive is switched on, everyone in the family will see the same videos after signing in.'
      : 'Only family members who have signed in with their email can see or add videos.'}</p>
  </article>`);
}

function viewNotFound() {
  render(`<div class="card empty"><h3>We couldn’t find that page</h3><p>It may have moved, or the link was mistyped.</p><a class="btn btn-primary" href="#/">Go home</a></div>`);
}

function viewSignIn() {
  main.innerHTML = `<div class="page"><div class="wrap">
    <div class="card signin">
      <div class="eyebrow">Family only</div>
      <h1>Welcome to Generations</h1>
      <p class="muted">Enter your email and we’ll send you a link to sign in. No password needed.</p>
      <form id="signin">
        <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
        <button class="btn btn-primary" style="width:100%" type="submit">Email me a sign-in link</button>
      </form>
    </div></div></div>`;
  $('#signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', e.target);
    btn.disabled = true;
    try {
      await state.store.signIn($('#email').value.trim());
      e.target.innerHTML = '<div class="note">✉️ Check your inbox — tap the link in the email to come straight back here, signed in.</div>';
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });
}

// ---------------------------------------------------------------- upload
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;

function enableDrop(el, onFile) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault(); el.classList.remove('over');
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  });
}

function openUpload(memberId, initialFile = null) {
  const members = allMembers();
  const chosen = members.find((m) => m.id === memberId);
  let uploader = '';
  try { uploader = localStorage.getItem('gen-uploader') || ''; } catch { /* ignore */ }
  const touch = isTouch();

  const d = openSheet(`
    ${sheetHead(chosen ? `A video of ${firstName(chosen.name)}` : 'Add a video', 'New memory')}
    <form class="sheet-body" id="upload-form" novalidate>
      ${chosen ? `<input type="hidden" name="member" value="${esc(chosen.id)}">` : `
        <div class="field"><label for="u-member">Who is this video about?</label>
          <select class="select" id="u-member" name="member" required>
            <option value="">Choose a family member…</option>
            ${state.families.map((f) => `<optgroup label="${esc(f.name)}">${f.members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}
          </select></div>`}

      <div id="u-source">
        ${touch ? `
          <div class="pick-buttons">
            <label class="pick">${icon('library')}<span>Choose video</span><small>From your phone</small>
              <input class="sr-only" type="file" accept="video/*" data-file></label>
            <label class="pick">${icon('camera')}<span>Record now</span><small>Use the camera</small>
              <input class="sr-only" type="file" accept="video/*" capture="user" data-file></label>
          </div>` : `
          <label class="dropzone" id="u-drop">
            <span class="dz-icon">${icon('upload')}</span>
            <b>Choose a video file</b>
            <span>or drag and drop it here · up to ${state.store.maxUploadMB} MB</span>
            <input class="sr-only" type="file" accept="video/*,.mov,.mp4,.m4v,.webm" data-file>
          </label>`}
        <button type="button" class="link-toggle" id="u-link-toggle">${icon('link')} Long video? Paste a YouTube or Vimeo link instead</button>
      </div>
      <div id="u-link" hidden>
        <div class="field"><label for="u-url">Video link</label>
          <input class="input" id="u-url" name="link" type="url" inputmode="url" placeholder="https://youtu.be/…">
          <span class="hint">Tip: upload to YouTube as “Unlisted” so only people with the link can see it.</span></div>
      </div>

      <div id="u-details" hidden>
        <div id="u-preview"></div>
        <div class="label" style="margin-bottom:8px">Need a starting point?</div>
        <div class="prompts">${PROMPTS.map((p) => `<button type="button" data-prompt="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        <div class="field" style="margin-top:12px"><label for="u-title">Title</label>
          <input class="input" id="u-title" name="title" required maxlength="120" placeholder="e.g. Grandad on arriving in England, 1967"></div>
        <div class="field"><label for="u-desc">Description</label>
          <textarea class="textarea" id="u-desc" name="description" maxlength="4000" placeholder="Who’s speaking, where it was filmed, and why it matters…"></textarea></div>
        <div class="row">
          <div class="field"><label for="u-date">When was it filmed?</label><input class="input" id="u-date" name="recordedOn" type="date"></div>
          <div class="field"><label for="u-by">Added by</label><input class="input" id="u-by" name="uploadedBy" value="${esc(uploader)}" placeholder="Your name" autocomplete="name"></div>
        </div>
        ${state.store.mode === 'local' ? `<div class="note">${icon('info')}<span>Preview mode: this video is saved in this browser only. Switch on the shared archive to let the whole family see it.</span></div>` : ''}
        <div id="u-progress" hidden><div class="progress"><i></i></div><div class="hint" style="margin-top:6px" id="u-progress-text">Uploading…</div></div>
      </div>
    </form>
    <div class="sheet-foot">
      <button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="submit" form="upload-form" id="u-submit" disabled>${icon('upload')} Save video</button>
    </div>
  `);

  const form = $('#upload-form', d);
  const submit = $('#u-submit', d);
  let file = null;
  let info = { duration: 0, thumb: null };
  let lastPrompt = '';

  const showDetails = () => { $('#u-details', d).hidden = false; submit.disabled = false; };

  async function useFile(f) {
    const tooBig = f.size > state.store.maxUploadMB * 1024 * 1024;
    if (!(f.type.startsWith('video/') || VIDEO_EXT.test(f.name))) return toast('That doesn’t look like a video file.', 'error');
    if (tooBig) return toast(`That video is ${formatBytes(f.size)} — the limit is ${state.store.maxUploadMB} MB. Try a YouTube link instead.`, 'error');
    file = f;
    $('#u-source', d).hidden = true;
    const url = URL.createObjectURL(f);
    $('#u-preview', d).innerHTML = `
      <div class="preview"><video src="${url}" controls playsinline preload="metadata"></video>
        <button type="button" class="btn btn-sm change" id="u-change">Change</button></div>
      <div class="file-meta">${esc(f.name)} · ${formatBytes(f.size)}</div>`;
    $('#u-change', d).addEventListener('click', () => {
      file = null; URL.revokeObjectURL(url);
      $('#u-preview', d).innerHTML = ''; $('#u-source', d).hidden = false;
      $('#u-details', d).hidden = true; submit.disabled = true;
    });
    showDetails();
    info = await inspectVideo(f);
  }

  $$('[data-file]', d).forEach((input) => input.addEventListener('change', () => input.files[0] && useFile(input.files[0])));
  const drop = $('#u-drop', d);
  if (drop) enableDrop(drop, useFile);
  if (initialFile) useFile(initialFile);

  $('#u-link-toggle', d).addEventListener('click', () => {
    $('#u-source', d).hidden = true; $('#u-link', d).hidden = false; showDetails(); $('#u-url', d).focus();
  });

  $$('[data-prompt]', d).forEach((b) => b.addEventListener('click', () => {
    const t = $('#u-title', d);
    if (!t.value || t.value === lastPrompt) { t.value = b.dataset.prompt; lastPrompt = t.value; }
    $('#u-desc', d).focus();
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const link = (data.link || '').trim();
    if (!data.member) return toast('Choose who the video is about.', 'error');
    if (!file && !embedUrl(link)) return toast('Choose a video, or paste a YouTube or Vimeo link.', 'error');
    if (!data.title?.trim()) { $('#u-title', d).focus(); return toast('Give the video a title.', 'error'); }
    try { localStorage.setItem('gen-uploader', data.uploadedBy || ''); } catch { /* ignore */ }

    submit.disabled = true;
    $('#u-progress', d).hidden = false;
    const bar = $('.progress i', d);
    const text = $('#u-progress-text', d);
    try {
      await state.store.uploadVideo(data.member, file, {
        title: data.title.trim(), description: data.description.trim(), recordedOn: data.recordedOn,
        uploadedBy: data.uploadedBy.trim(), duration: info.duration, link: file ? '' : link,
      }, info.thumb, (p) => { bar.style.width = `${Math.round(p * 100)}%`; text.textContent = `Uploading… ${Math.round(p * 100)}%`; });
      state.counts[data.member] = count(data.member) + 1;
      closeSheet();
      toast('Video saved. Thank you for keeping this memory.');
      const m = members.find((x) => x.id === data.member);
      const target = memberHref(m, 'videos');
      if (location.hash === target) route(); else location.hash = target;
    } catch (err) {
      submit.disabled = false;
      text.textContent = 'Upload failed.';
      toast(err.message || 'Upload failed.', 'error');
    }
  });
}

// ---------------------------------------------------------------- player & edits
function openPlayer(m, v) {
  const embed = v.link ? embedUrl(v.link) : '';
  const d = openSheet(`
    <div class="player">${embed
      ? `<iframe src="${esc(embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(v.title)}"></iframe>`
      : `<video src="${esc(v.url)}" controls autoplay playsinline ${v.thumbUrl ? `poster="${esc(v.thumbUrl)}"` : ''}></video>`}</div>
    <div class="sheet-body player-info">
      <div class="eyebrow">${esc(m.name)}</div>
      <h2>${esc(v.title)}</h2>
      <div class="when">${esc(v.recordedOn ? `Filmed ${formatDate(v.recordedOn)}` : `Added ${formatDate(v.createdAt)}`)}${v.uploadedBy ? ` · added by ${esc(v.uploadedBy)}` : ''}</div>
      ${v.description ? `<p>${esc(v.description)}</p>` : ''}
    </div>
    <div class="sheet-foot">
      <button class="btn btn-ghost btn-danger" type="button" id="p-del">${icon('trash')} Delete</button>
      <button class="btn" type="button" id="p-edit">${icon('edit')} Edit details</button>
      <button class="btn btn-primary" type="button" data-close>Done</button>
    </div>`, { wide: true });

  $('#p-del', d).addEventListener('click', async () => {
    if (!confirm(`Delete “${v.title}”? This can’t be undone.`)) return;
    try {
      await state.store.deleteVideo(v.id, v);
      state.counts[m.id] = Math.max(0, count(m.id) - 1);
      closeSheet(); toast('Video deleted.'); route();
    } catch (e) { toast(e.message, 'error'); }
  });
  $('#p-edit', d).addEventListener('click', () => openEditVideo(m, v));
}

function openEditVideo(m, v) {
  const d = openSheet(`
    ${sheetHead('Edit video details', m.name)}
    <form class="sheet-body" id="ev-form">
      <div class="field"><label for="ev-title">Title</label><input class="input" id="ev-title" name="title" required maxlength="120" value="${esc(v.title)}"></div>
      <div class="field"><label for="ev-desc">Description</label><textarea class="textarea" id="ev-desc" name="description" maxlength="4000">${esc(v.description || '')}</textarea></div>
      <div class="field"><label for="ev-date">When was it filmed?</label><input class="input" id="ev-date" name="recordedOn" type="date" value="${esc(v.recordedOn || '')}"></div>
    </form>
    <div class="sheet-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="submit" form="ev-form">Save</button></div>`);
  $('#ev-form', d).addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.title.trim()) return toast('Give the video a title.', 'error');
    try {
      await state.store.updateVideo(v.id, { title: data.title.trim(), description: data.description.trim(), recordedOn: data.recordedOn });
      closeSheet(); toast('Saved.'); route();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function openEditProfile(m) {
  let photo = null;
  const d = openSheet(`
    ${sheetHead(`Edit ${firstName(m.name)}’s profile`, 'About')}
    <form class="sheet-body" id="ep-form">
      <div class="field"><span class="label">Photo</span>
        <div class="photo-field"><span id="ep-avatar">${avatar(m)}</span>
          <label class="btn btn-sm">${icon('library')} Choose photo<input class="sr-only" type="file" accept="image/*" id="ep-photo"></label></div></div>
      <div class="field"><label for="ep-tag">One-line description</label><input class="input" id="ep-tag" name="tagline" maxlength="140" value="${esc(m.tagline || '')}" placeholder="e.g. Engineer, storyteller, maker of the best parathas"></div>
      <div class="row">
        <div class="field"><label for="ep-born">Born</label><input class="input" id="ep-born" name="born" maxlength="60" value="${esc(m.born || '')}" placeholder="e.g. 1958"></div>
        <div class="field"><label for="ep-place">From</label><input class="input" id="ep-place" name="place" maxlength="80" value="${esc(m.place || '')}" placeholder="e.g. Jalandhar, Punjab"></div>
      </div>
      <div class="field"><label for="ep-bio">Bio</label><textarea class="textarea" id="ep-bio" name="bio" rows="9" placeholder="Their story — where they grew up, what they did, what they loved, what people remember about them…">${esc(m.bio || '')}</textarea></div>
    </form>
    <div class="sheet-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="submit" form="ep-form">Save profile</button></div>`);

  $('#ep-photo', d).addEventListener('change', (e) => {
    photo = e.target.files[0] || null;
    if (photo) $('#ep-avatar', d).innerHTML = avatar({ ...m, photoUrl: URL.createObjectURL(photo) });
  });
  $('#ep-form', d).addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const patch = { tagline: data.tagline.trim(), born: data.born.trim(), place: data.place.trim(), bio: data.bio.trim() };
    try {
      await state.store.updateMember(m.id, patch, photo);
      await loadData();
      closeSheet(); toast('Profile saved.'); route();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------------------------------------------------------------- search palette
function openSearch() {
  const members = allMembers();
  const d = openSheet(`
    <div class="sheet-head palette-input">${icon('search')}
      <input id="q" type="text" enterkeyhint="search" placeholder="Find a family member…" autocomplete="off" aria-label="Search family members">
      <button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button>
    </div>
    <ul class="results" id="results" role="listbox"></ul>`, { className: 'palette' });
  const q = $('#q', d);
  const list = $('#results', d);
  let active = 0;
  let matches = members;

  const draw = () => {
    const term = q.value.trim().toLowerCase();
    matches = members.filter((m) => m.name.toLowerCase().includes(term));
    active = Math.min(active, Math.max(matches.length - 1, 0));
    list.innerHTML = matches.length
      ? matches.map((m, i) => `<li><a href="${memberHref(m)}" role="option" aria-selected="${i === active}">${avatar(m)}${esc(m.name)}<span>${genName(m.generation)} · ${count(m.id)} videos</span></a></li>`).join('')
      : '<li class="none">No one by that name yet.</li>';
  };
  draw();
  q.focus();
  q.addEventListener('input', () => { active = 0; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = (active + 1) % matches.length; draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = (active - 1 + matches.length) % matches.length; draw(); e.preventDefault(); }
    if (e.key === 'Enter' && matches[active]) { location.hash = memberHref(matches[active]); closeSheet(); }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) closeSheet(); });
}

// ---------------------------------------------------------------- global wiring
function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = current === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('gen-theme', next); } catch { /* ignore */ }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'upload') {
    const current = location.hash.match(/^#\/member\/[\w-]+\/([\w-]+)/);
    openUpload(current?.[1]);
  }
  if (action === 'search') openSearch();
  if (action === 'theme') toggleTheme();
});

document.addEventListener('keydown', (e) => {
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName);
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
    e.preventDefault(); openSearch();
  }
});

async function start() {
  initSheet();
  try {
    state.store = await createStore(config);
    if (!state.store.needsSignIn()) await loadData();
  } catch (e) {
    main.innerHTML = `<div class="page"><div class="wrap"><div class="card empty"><h3>Something went wrong loading the archive</h3><p>${esc(e.message)}</p></div></div></div>`;
    return;
  }
  const f0 = state.families[0];
  if (f0) $$('[data-nav="family"]').forEach((a) => { a.href = `#/family/${f0.id}`; });
  $('.mode-note').textContent = state.store.mode === 'local' ? 'Preview mode — videos are saved on this device only.' : '';
  window.addEventListener('hashchange', route);
  route();
}

start();
