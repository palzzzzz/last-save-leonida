// LAST SAVE - offline GTA VI trophy guide. Classic script (works from file:// and from a static server).
(function () {
  'use strict';
  const KEY = 'last-save-v1';
  const DATA_CACHE_KEY = 'last-save-data-v1';
  const POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
  const GRADES = [['platinum', 'P'], ['gold', 'G'], ['silver', 'S'], ['bronze', 'B']];
  const STAGES = [
    { id: 1, title: 'Stage 1: Story', note: 'Play the story chapters in order. Grouped by chapter.', test: (t) => t.category === 'story' },
    { id: 2, title: 'Stage 2: The 100% Checklist', note: 'Collectibles, activities and criminal work: the road to A Long Road.', test: (t) => ['collectible', 'activity', 'criminal'].includes(t.category) },
    { id: 3, title: 'Stage 3: Strangers & Character Quests', note: 'Side quests and character missions.', test: (t) => t.category === 'quest' },
    { id: 4, title: 'Stage 4: Cleanup & Platinum', note: 'Money goals, hidden encounters and the final trophies.', test: (t) => ['money', 'encounter', 'meta'].includes(t.category) },
  ];
  const BADGES = {
    confirmed: { mark: '✓', label: 'confirmed', text: 'Confirmed: two or more sources agree on how this trophy unlocks.' },
    'single-source': { mark: '◐', label: 'single source', text: 'Single source: only one guide describes this one, so treat the steps as likely, not certain.' },
    conflict: { mark: '!', label: 'conflict', text: 'Conflict: sources disagree on a detail of this trophy. Read the steps for what differs.' },
    unconfirmed: { mark: '?', label: 'unconfirmed', text: 'Unconfirmed: the trigger is not known yet. Nothing here is verified; expect to find out by playing.' },
  };
  const CHAPTER_LABELS = ['Before starting', 'Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Finished'];

  // ---------- storage (degrades to memory) ----------
  let storageOK = true;
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { storageOK = false; return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { storageOK = false; return false; } }

  // ---------- state ----------
  const defaults = () => ({ earned: {}, chapter: 0, hideHidden: false, filters: { grade: 'all', cat: 'all', conf: 'all', q: '' }, savedAt: null });
  let state = defaults();
  let doc = null;
  const revealed = new Set();

  function normalize(raw) {
    const s = defaults();
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw)) raw = { earned: raw };
    const e = raw.earned;
    const byName = new Map(doc.trophies.map((t) => [t.name, t.id]));
    const ids = new Set(doc.trophies.map((t) => t.id));
    const add = (k, ts) => {
      const id = ids.has(Number(k)) ? Number(k) : byName.get(k);
      if (id != null) s.earned[id] = typeof ts === 'number' ? ts : Date.now();
    };
    if (Array.isArray(e)) e.forEach((k) => add(k));
    else if (e && typeof e === 'object') Object.entries(e).forEach(([k, v]) => add(k, v));
    const ch = Number(raw.chapter);
    if (Number.isInteger(ch) && ch >= 0 && ch <= 6) s.chapter = ch;
    s.hideHidden = raw.hideHidden === true;
    const f = raw.filters || {};
    for (const k of Object.keys(s.filters)) if (typeof f[k] === 'string') s.filters[k] = f[k];
    s.savedAt = typeof raw.savedAt === 'number' ? raw.savedAt : null;
    return s;
  }
  function load() {
    const raw = sget(KEY);
    try { state = normalize(raw ? JSON.parse(raw) : null); } catch (e) { state = defaults(); }
  }
  function save() {
    state.savedAt = Date.now();
    sset(KEY, JSON.stringify(state));
    renderSaved(true);
  }

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }
  const chapterOf = (t) => { const m = /^Chapter (\d)/.exec(t.stage); return m ? Number(m[1]) : null; };
  const stageOf = (t) => STAGES.find((s) => s.test(t));
  const isEarned = (t) => state.earned[t.id] != null;
  function maskOf(t) {
    if (revealed.has(t.id)) return null;
    const ch = chapterOf(t);
    if (t.category === 'story' && ch != null && ch > state.chapter) return 'story';
    if (state.hideHidden && t.hidden) return 'hidden';
    return null;
  }
  const fmtDate = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' });

  function badge(conf) {
    const b = BADGES[conf] || BADGES.unconfirmed;
    return h('span', { class: 'badge ' + conf, title: b.text }, h('i', { text: b.mark, 'aria-hidden': 'true' }), b.label);
  }
  const chip = (grade) => h('span', { class: 'chip ' + grade, text: grade });

  // ---------- header / audit ----------
  function renderHeader() {
    const all = doc.trophies;
    const got = all.filter(isEarned);
    $('earned').textContent = got.length;
    $('total').textContent = all.length;
    $('pct').textContent = Math.round((got.length / all.length) * 100) + '%';
    $('grades').replaceChildren(...GRADES.map(([g, l]) => {
      const n = got.filter((t) => t.grade === g).length;
      const tot = all.filter((t) => t.grade === g).length;
      return h('span', { class: 'chip ' + g, title: g }, `${l} `, h('span', { class: 'num', text: `${n}/${tot}` }));
    }));
    const pts = got.reduce((a, t) => a + POINTS[t.grade], 0);
    const totalPts = all.reduce((a, t) => a + POINTS[t.grade], 0);
    $('pts').textContent = pts;
    $('ptstotal').textContent = totalPts;
    $('ptsfill').style.width = (totalPts ? (pts / totalPts) * 100 : 0) + '%';
    const bar = $('ptsbar');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(totalPts)); bar.setAttribute('aria-valuenow', String(pts));
  }
  function renderSaved(flash) {
    const el = $('saved');
    el.classList.toggle('off', !storageOK);
    $('savedAt').textContent = state.savedAt ? fmtDate(state.savedAt) : 'nothing yet';
    el.firstChild.textContent = storageOK ? 'Saved in this browser: ' : 'Browser storage unavailable (changes live in memory; use Export): ';
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  function renderAudit() {
    const t = doc.trophies;
    const hidden = t.filter((x) => x.hidden).length;
    const dates = doc.sources.map((s) => s.accessed).filter(Boolean).sort();
    const last = dates[dates.length - 1];
    const read = last ? new Date(last + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'n/a';
    const cells = [
      [t.length, 'trophies'],
      [`${t.length - hidden} / ${hidden}`, 'visible / hidden'],
      [t.filter((x) => x.sources && x.sources.length > 0).length, 'guides citing a source'],
      [doc.sources.length, 'sources in registry'],
      [t.filter((x) => x.missable === 'possibly').length, 'possibly missable', 'warn'],
      [t.filter((x) => x.confidence === 'unconfirmed').length, 'unconfirmed triggers', 'warn'],
      [doc.conflicts.length, 'source conflicts', 'warn'],
      [read, 'sources read'],
    ];
    $('audit').replaceChildren(...cells.map(([v, l, c]) => h('div', { class: 'cell ' + (c || '') }, h('b', { text: String(v) }), h('span', { text: l }))));
  }

  // ---------- list ----------
  function passes(t) {
    const f = state.filters;
    if (f.grade !== 'all' && t.grade !== f.grade) return false;
    if (f.cat !== 'all' && t.category !== f.cat) return false;
    if (f.conf !== 'all' && t.confidence !== f.conf) return false;
    const q = f.q.trim().toLowerCase();
    // never search names of masked trophies: that would leak them
    if (q && (maskOf(t) || !t.name.toLowerCase().includes(q))) return false;
    return true;
  }
  function row(t) {
    const mask = maskOf(t);
    const box = h('input', { type: 'checkbox', 'aria-label': 'Earned' });
    box.checked = isEarned(t);
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => toggle(t.id, box.checked));
    const line = h('div', { class: 'tline' });
    const main = h('div', { class: 'tmain' }, line);
    if (mask) {
      line.append(
        h('span', { class: 'tname', text: mask === 'story' ? 'Hidden story trophy' : 'Hidden trophy' }),
        h('span', { class: 'blurfill', 'aria-hidden': 'true', text: 'xxxxxxxx xxxxx' }),
        chip(t.grade),
        h('span', { class: 'chip meta', text: t.category }),
      );
      const ch = chapterOf(t);
      if (ch) line.append(h('span', { class: 'chip meta', text: 'Chapter ' + ch }));
    } else {
      line.append(h('span', { class: 'tname', text: t.name }), chip(t.grade), badge(t.confidence));
      if (t.missable === 'possibly') line.append(h('span', { class: 'tag-miss', text: 'MISSABLE' }));
      if (t.target) main.append(h('div', { class: 'ttarget num', text: t.target }));
    }
    const r = h('div', {
      class: 'trow' + (isEarned(t) ? ' done' : '') + (mask ? ' masked' : '') + (t.missable === 'possibly' && !isEarned(t) ? ' missable' : ''),
      role: 'button', tabindex: '0', 'data-id': t.id,
      onclick: () => { location.hash = '#t/' + t.id; },
      onkeydown: (e) => { if (e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = '#t/' + t.id; } },
    }, box, main);
    return r;
  }
  function renderList() {
    const container = $('stages');
    const shownList = doc.trophies.filter(passes);
    $('shown').textContent = `Showing ${shownList.length} of ${doc.trophies.length}`;
    const frag = document.createDocumentFragment();
    for (const st of STAGES) {
      const all = doc.trophies.filter((t) => stageOf(t) === st);
      const vis = all.filter(passes);
      const got = all.filter(isEarned).length;
      const risk = all.filter((t) => t.missable === 'possibly' && !isEarned(t)).length;
      const sec = h('section', { class: 'stage' },
        h('h2', {}, st.title, h('span', { class: 'sp', text: `${got}/${all.length} earned` }),
          h('span', { class: 'sm' + (risk ? ' risk' : ''), text: `${risk} possibly missable left` })));
      sec.append(h('p', { class: 'note', text: st.note }));
      if (!vis.length) { sec.append(h('p', { class: 'note', text: 'No trophies match the current filters.' })); frag.append(sec); continue; }
      if (st.id === 1) {
        for (let c = 1; c <= 5; c++) {
          const inCh = vis.filter((t) => chapterOf(t) === c);
          if (!inCh.length) continue;
          sec.append(h('h3', { class: 'chap', text: 'Chapter ' + c }), ...inCh.map(row));
        }
      } else sec.append(...vis.map(row));
      frag.append(sec);
    }
    container.replaceChildren(frag);
  }
  function renderAll() { renderHeader(); renderList(); if (currentDetail != null) renderDetail(currentDetail); }

  function toggle(id, on) {
    if (on) state.earned[id] = Date.now(); else delete state.earned[id];
    save(); renderAll();
  }

  // ---------- detail ----------
  let currentDetail = null;
  function srcMarkers(ids) { return (ids || []).map((id) => h('span', { class: 'src', text: `[${id}] ` })); }
  function renderDetail(id) {
    const t = doc.trophies.find((x) => x.id === id);
    const view = $('detailView');
    if (!t) { view.replaceChildren(h('p', { class: 'empty', text: 'Trophy not found.' }), h('button', { class: 'back', onclick: () => { location.hash = ''; }, text: 'Back to list' })); return; }
    const mask = maskOf(t);
    const ch = chapterOf(t);
    const stage = stageOf(t);
    const box = h('input', { type: 'checkbox', id: 'dEarned' });
    box.checked = isEarned(t);
    box.addEventListener('change', () => toggle(t.id, box.checked));
    const kids = [h('button', { class: 'back', onclick: () => { location.hash = ''; }, text: '< Back to checklist' })];
    const d = h('article', { class: 'detail' });
    const meta = h('div', { class: 'meta' }, chip(t.grade), h('span', { class: 'chip meta', text: t.category }),
      h('label', {}, box, ' Earned'));
    if (mask) {
      d.append(h('h2', { text: mask === 'story' ? 'Hidden story trophy' : 'Hidden trophy' }), meta,
        h('div', { class: 'block' }, h('h3', { text: 'Spoiler protected' }),
          h('p', {}, `This ${mask === 'story' ? 'story ' : ''}trophy is hidden by your spoiler settings. Grade, category${ch ? ' and chapter (Chapter ' + ch + ')' : ''} are still shown.`),
          h('button', { class: 'reveal', text: 'Reveal this trophy anyway', onclick: () => { revealed.add(t.id); renderAll(); } })));
    } else {
      d.append(h('h2', { text: t.name }), meta);
      const info = h('div', { class: 'meta' }, badge(t.confidence));
      if (t.missable === 'possibly') info.append(h('span', { class: 'tag-miss', text: 'MISSABLE' }));
      if (t.hidden) info.append(h('span', { class: 'chip meta', text: 'hidden on PSN' }));
      d.append(info);
      if (t.missable === 'possibly') {
        d.append(h('div', { class: 'panel-miss' },
          h('h3', { text: 'MISSABLE: POINT OF NO RETURN' }),
          h('p', {}, h('b', { text: 'Chapter 1 window. ' }), 'The Chapter 1 balcony meditation (the morning after Down to Earth) vanishes for good once Chapter 1 ends.'),
          h('p', { text: 'Honest status: it is not yet confirmed whether that Chapter 1 meditation is required for this trophy. One guide author did it and got the trophy, so do it to be safe.' })));
      }
      d.append(
        h('div', { class: 'block' }, h('h3', { text: 'Official description' }), h('p', { text: t.description })),
        h('div', { class: 'block' }, h('h3', { text: 'Guide steps' }),
          h('ol', {}, (t.guide || '').split('\n').map((l) => l.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean).map((l) => h('li', { text: l }))),
          h('p', { class: 'hint' }, 'Cited: ', ...srcMarkers(t.sources))),
        h('div', { class: 'block explain' }, h('h3', { text: 'Confidence' }), h('p', {}, badge(t.confidence), ' ', (BADGES[t.confidence] || BADGES.unconfirmed).text)),
        h('div', { class: 'block' }, h('h3', { text: 'Where it fits' }),
          h('p', { text: `Stage: ${stage ? stage.title : 'n/a'}. Chapter/stage field: ${t.stage}. PSN order: #${t.psn}.` }),
          t.target ? h('p', {}, 'Target: ', h('span', { class: 'num', text: t.target })) : null),
        h('div', { class: 'block' }, h('h3', { text: 'Sources' }),
          h('ul', { class: 'src-list' }, (t.sources || []).map((sid) => {
            const s = doc.sources.find((x) => x.id === sid);
            return h('li', {}, h('span', { class: 'src', text: `[${sid}] ` }), s ? (s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }) : s.name) : 'unknown source');
          }))));
    }
    kids.push(d);
    view.replaceChildren(...kids);
  }
  function route() {
    const m = /^#t\/(\d+)$/.exec(location.hash);
    if (!doc) return;
    if (m) {
      currentDetail = Number(m[1]);
      renderDetail(currentDetail);
      $('listView').hidden = true; $('detailView').hidden = false;
      window.scrollTo(0, 0);
    } else {
      currentDetail = null;
      $('detailView').hidden = true; $('listView').hidden = false;
    }
  }

  // ---------- controls / persistence ----------
  function syncControls() {
    $('chapter').value = String(state.chapter);
    $('hideHidden').checked = state.hideHidden;
    $('fGrade').value = state.filters.grade;
    $('fConf').value = state.filters.conf;
    $('fQ').value = state.filters.q;
    $('fCat').value = state.filters.cat;
    if ($('fCat').value !== state.filters.cat) { state.filters.cat = 'all'; $('fCat').value = 'all'; }
  }
  function msg(text) { $('toolmsg').textContent = text; }
  function wire() {
    const cats = [...new Set(doc.trophies.map((t) => t.category))];
    $('fCat').replaceChildren(h('option', { value: 'all', text: 'All' }), ...cats.map((c) => h('option', { value: c, text: c })));
    $('chapter').addEventListener('change', (e) => { state.chapter = Number(e.target.value); revealed.clear(); save(); renderAll(); });
    $('hideHidden').addEventListener('change', (e) => { state.hideHidden = e.target.checked; revealed.clear(); save(); renderAll(); });
    const f = (id, key) => $(id).addEventListener(id === 'fQ' ? 'input' : 'change', (e) => { state.filters[key] = e.target.value; save(); renderList(); });
    f('fGrade', 'grade'); f('fCat', 'cat'); f('fConf', 'conf'); f('fQ', 'q');
    $('fClear').addEventListener('click', () => { state.filters = defaults().filters; syncControls(); save(); renderList(); });
    $('export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ app: 'last-save', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'last-save-progress.json' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      msg('Exported ' + Object.keys(state.earned).length + ' earned trophies.');
    });
    $('import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const next = normalize(JSON.parse(await file.text()));
        state = next; syncControls(); save(); renderAll();
        msg('Imported ' + Object.keys(state.earned).length + ' earned trophies.');
      } catch (err) { msg('Import failed: that file is not a LAST SAVE export.'); }
    });
    $('reset').addEventListener('click', () => {
      if (!window.confirm('Reset all progress, chapter and filters in this browser? Export first if you want a backup.')) return;
      state = defaults(); revealed.clear();
      try { localStorage.removeItem(KEY); } catch (e) { storageOK = false; }
      syncControls(); renderAll(); renderSaved(true); msg('Progress reset.');
    });
    window.addEventListener('hashchange', route);
  }

  function start(data) {
    doc = data;
    load();
    wire(); syncControls(); renderAudit(); renderHeader(); renderList(); renderSaved(false); route();
  }

  // ---------- data loading: fetch, with a file-picker fallback for file:// ----------
  function fail() {
    const pick = h('input', { type: 'file', accept: 'application/json,.json' });
    pick.addEventListener('change', async () => {
      try {
        const data = JSON.parse(await pick.files[0].text());
        if (!data.trophies || !data.sources) throw new Error('bad');
        sset(DATA_CACHE_KEY, JSON.stringify(data));
        box.remove(); start(data);
      } catch (e) { box.append(h('p', { text: 'That file is not trophies.json.' })); }
    });
    const box = h('div', { class: 'loadfail' },
      h('p', {}, 'This browser blocked loading data/trophies.json from a local file. Choose that file once (it is in the app/data folder) and it will be remembered, or run ', h('code', { text: 'node serve.ts' }), '.'),
      pick);
    $('main').prepend(box);
  }
  function boot() {
    fetch('data/trophies.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(() => {
      const cached = sget(DATA_CACHE_KEY);
      if (cached) { try { start(JSON.parse(cached)); return; } catch (e) { /* fall through */ } }
      fail();
    });
  }
  boot();
})();
