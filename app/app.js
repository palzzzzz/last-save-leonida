// LAST SAVE - offline GTA VI trophy guide. Classic script (works from file:// and from a static server).
(function () {
  'use strict';
  const KEY = 'last-save-v1';
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
  const defaults = () => ({ earned: {}, chapter: 0, hideHidden: false, filters: { grade: 'all', cat: 'all', conf: 'all', q: '' }, med: {}, savedAt: null });
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
    if (raw.med && typeof raw.med === 'object' && !Array.isArray(raw.med)) {
      const valid = new Set();
      for (const sp of medSpots()) for (const w of whoOf(sp)) valid.add(sp.id + ':' + w);
      for (const [k, v] of Object.entries(raw.med)) if (v === true && valid.has(k)) s.med[k] = true;
    }
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
    document.querySelectorAll('.js-savedat').forEach((n) => { n.textContent = state.savedAt ? fmtDate(state.savedAt) : 'nothing yet'; });
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

  // ---------- meditation spot grid ----------
  const pma = () => doc.trophies.find((t) => t.id === 28);
  const medSpots = () => ((doc && pma() && pma().meditationSpots) || (doc ? [] : []));
  const whoOf = (sp) => (sp.kind === 'unmapped' ? [] : sp.kind === 'house' ? ['once'] : ['jason', 'lucia']);
  const medOn = (sp, w) => state.med[sp.id + ':' + w] === true;
  const medDone = (sp) => whoOf(sp).length > 0 && whoOf(sp).every((w) => medOn(sp, w));
  function kalagaUnlocked() {
    return medSpots().filter((sp) => sp.kind !== 'unmapped' && sp.kind !== 'final').every(medDone);
  }
  function medCount() {
    const unlocked = kalagaUnlocked();
    return medSpots().reduce((n, sp) => n + (sp.kind === 'final' && !unlocked ? 0 : whoOf(sp).filter((w) => medOn(sp, w)).length), 0);
  }
  function medToggle(sp, w, on) {
    if (on) state.med[sp.id + ':' + w] = true; else delete state.med[sp.id + ':' + w];
    save(); renderMed();
  }
  const WHO_LABEL = { jason: 'Jason', lucia: 'Lucia', once: 'Meditated' };
  function medCell(sp, unlocked) {
    if (sp.kind === 'unmapped') {
      return h('div', { class: 'mcell unmapped', 'aria-disabled': 'true' }, h('b', { text: 'Unmapped spot' }), h('span', { class: 'mnote', text: sp.label }));
    }
    const locked = sp.kind === 'final' && !unlocked;
    const cls = 'mcell' + (sp.kind === 'house' ? ' house' : '') + (locked ? ' locked' : '') + (medDone(sp) && !locked ? ' done' : '');
    const kids = [h('b', { text: sp.name }), h('span', { class: 'marea', text: sp.area })];
    if (sp.kind === 'house') kids.push(h('span', { class: 'mtag', text: 'CHAPTER 1 ONLY · single session · counts 1' }));
    if (locked) kids.push(h('span', { class: 'mtag lock', text: 'LOCKED until every other mapped spot is fully toggled' }));
    if (sp.note) kids.push(h('span', { class: 'mnote', text: sp.note }));
    const tg = h('div', { class: 'mtoggles' }, whoOf(sp).map((w) => {
      const box = h('input', { type: 'checkbox', disabled: locked, 'data-spot': sp.id, 'data-who': w, 'aria-label': `${sp.name}: ${WHO_LABEL[w]}` });
      box.checked = medOn(sp, w);
      box.addEventListener('change', () => medToggle(sp, w, box.checked));
      return h('label', {}, box, ' ' + WHO_LABEL[w]);
    }));
    return h('div', { class: cls }, ...kids, tg);
  }
  function renderMed() {
    const el = $('medgrid');
    if (!el) return;
    const spots = medSpots();
    const unlocked = kalagaUnlocked();
    const groups = [['coastal', 'Coastal'], ['inland', 'Inland'], ['special', 'Special']];
    const kids = [
      h('div', { class: 'mcount' },
        h('span', { class: 'mbig' }, h('b', { id: 'medCount', class: 'num', text: String(medCount()) }), ' meditations logged'),
        h('p', { class: 'mhonest', text: 'Honest count: the trophy counter target is 18 (PowerPyx and GTABase), but the 100% checklist asks for only 15. Published location counts do not fully reconcile yet, and two locations are still unmapped, so this grid does not add up to 18 on purpose.' })),
    ];
    for (const [key, label] of groups) {
      const inG = spots.filter((sp) => sp.region === key);
      if (!inG.length) continue;
      kids.push(h('h4', { class: 'mgroup', text: label }), h('div', { class: 'mgrid g-' + key }, inG.map((sp) => medCell(sp, unlocked))));
    }
    kids.push(h('p', { class: 'hint', text: 'Checking spots here never checks the trophy itself: tick “Earned” above when the game awards it.' }));
    el.replaceChildren(...kids);
  }

  // ---------- missable timeline (SVG) ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
    if (text != null) el.textContent = text;
    return el;
  }
  // Slots follow the "I am in" selector 1:1: 0 Before, 1-5 chapters, 6 After the story.
  const TL = { x0: 30, w: 134, n: 7 };
  const slotX = (i) => TL.x0 + i * TL.w;
  function renderTimeline() {
    const { x0, w, n } = TL;
    const xEnd = slotX(n), line = slotX(2), axisY = 342;
    const svg = s('svg', { viewBox: '0 0 1000 400', role: 'img', class: 'tl',
      'aria-label': 'Timeline of the run. Chapter 1 closes for good at the red line; Positive Mental Attitude has one meditation spot that only exists before it. You are in ' + CHAPTER_LABELS[state.chapter] + '.' });
    // chapter bands
    for (let i = 0; i < n; i++) svg.append(s('rect', { x: slotX(i), y: 40, width: w, height: axisY - 40, class: i % 2 ? 'band b1' : 'band b0' }));
    // PMA window bar: solid to the red line, faded after it
    const barY = 118, barH = 30;
    svg.append(s('rect', { x: slotX(1), y: barY, width: w, height: barH, rx: 4, class: 'pma-on' }));
    svg.append(s('rect', { x: line, y: barY, width: xEnd - line, height: barH, rx: 4, class: 'pma-off' }));
    svg.append(s('text', { x: line - 10, y: 84, 'text-anchor': 'end', class: 'tl-big hot' }, 'Positive Mental Attitude'));
    svg.append(s('text', { x: line - 10, y: 108, 'text-anchor': 'end', class: 'tl-mid hot' }, '1 spot only exists here'));
    svg.append(s('text', { x: line + 12, y: 176, class: 'tl-mid dim' }, '17 more meditations stay open'));
    // point of no return
    svg.append(s('line', { x1: line, x2: line, y1: 34, y2: axisY, class: 'noreturn' }));
    svg.append(s('text', { x: line + 12, y: 24, class: 'tl-big red' }, 'POINT OF NO RETURN — Chapter 1 closes'));
    // start markers (teal diamonds)
    const diamond = (cx, cy) => s('path', { d: `M${cx} ${cy - 11} L${cx + 11} ${cy} L${cx} ${cy + 11} L${cx - 11} ${cy} Z`, class: 'open-mark' });
    const open = [
      [slotX(2) + 18, 222, ['Both characters playable:', 'meditations count double']],
      [slotX(2) + 18, 276, ['Scooter Bros app (Moses)']],
      [slotX(4) + 18, 222, ['Bank vaults open']],
    ];
    for (const [cx, cy, lines] of open) {
      svg.append(diamond(cx, cy));
      lines.forEach((t, i) => svg.append(s('text', { x: cx + 18, y: cy + 6 + i * 22, class: 'tl-mid teal' }, t)));
    }
    // axis + labels
    svg.append(s('line', { x1: x0, x2: xEnd, y1: axisY, y2: axisY, class: 'axis' }));
    const names = [['Before', 'starting'], ['Chapter 1'], ['Chapter 2'], ['Chapter 3'], ['Chapter 4'], ['Chapter 5'], ['After the', 'story']];
    names.forEach((ls, i) => {
      svg.append(s('line', { x1: slotX(i), x2: slotX(i), y1: axisY, y2: axisY + 8, class: 'axis' }));
      ls.forEach((t, j) => svg.append(s('text', { x: slotX(i) + w / 2, y: axisY + 30 + j * 22, 'text-anchor': 'middle', class: 'tl-mid' + (i === state.chapter ? ' you-lbl' : '') }, t)));
    });
    svg.append(s('line', { x1: slotX(n), x2: slotX(n), y1: axisY, y2: axisY + 8, class: 'axis' }));
    // YOU marker
    const yx = slotX(state.chapter) + w / 2;
    // the dashed line goes under the labels (inserted right after the bands) so it never strikes through text
    svg.insertBefore(s('line', { x1: yx, x2: yx, y1: 190, y2: axisY - 20, class: 'you-line' }), svg.children[n]);
    svg.append(s('path', { d: `M${yx - 13} ${axisY - 22} L${yx + 13} ${axisY - 22} L${yx} ${axisY - 2} Z`, class: 'you-mark', id: 'tlYou', 'data-chapter': state.chapter }));
    svg.append(s('text', { x: yx, y: axisY - 28, 'text-anchor': 'middle', class: 'tl-big you' }, 'YOU'));
    $('tlsvg').replaceChildren(svg);
  }

  // ---------- "Before you finish Chapter N" panel ----------
  // Only pack-verified actions. `id` = trophy whose earned state means the action is done (null = reminder, state cannot know).
  const BEFORE = {
    1: [
      { id: 28, text: "Do Lucia's balcony meditation at Jason's house (the morning after Down to Earth) before the chapter ends. It is the one possibly-missable window; it is not confirmed as required, so do it to be safe.", done: 'Positive Mental Attitude is earned, so this is covered.' },
      { id: 20, text: "Watch for Cal's fishing text after a Chapter 1 mission (purple icon on the map): that is Baited My Tackle.", done: 'Baited My Tackle is earned.' },
      { id: null, text: 'Keep a manual save before big missions. There is no mission replay.' },
    ],
    2: [
      { id: 55, text: 'Pick up the Scooter Bros app from Moses and register vehicles as you find them (On the Spot wants 10).', done: 'On the Spot is earned.' },
      { id: 28, text: 'Meditations now count double when both characters meditate together, so use that for Positive Mental Attitude.', done: 'Positive Mental Attitude is earned.' },
    ],
    3: [
      { id: 39, text: "Yasmani's jobs give you the Snap Gun for a clean jewelry robbery: that is Sneakthief.", done: 'Sneakthief is earned.' },
    ],
    4: [
      { id: 40, text: 'Bank vaults open: bring a fast bike and expect 4 stars on every job. Maximum Withdrawal wants 5 of 8.', done: 'Maximum Withdrawal is earned.' },
    ],
    5: [
      { id: null, text: 'Never push your Criminal Profile to Irredeemable. It is permanent.' },
      { id: null, text: 'Cheats unlock after the credits and disable trophies and saving for that session. Save first.' },
    ],
  };
  BEFORE[6] = BEFORE[5];
  function renderBefore() {
    const ch = state.chapter;
    const el = $('before');
    const title = ch === 0 ? 'Before you start' : ch === 6 ? 'Now that the story is finished' : `Before you finish Chapter ${ch}`;
    const items = BEFORE[ch] || [];
    const kids = [h('h2', { text: title })];
    if (!items.length) {
      kids.push(h('p', { class: 'ok', text: 'Nothing is pending before you start. The first thing that can close on you is in Chapter 1: the balcony meditation at Jason’s house.' }));
    } else {
      const byId = (id) => state.earned[id] != null;
      const tracked = items.filter((it) => it.id != null);
      const left = tracked.filter((it) => !byId(it.id)).length;
      kids.push(h('p', { class: left ? 'warn' : 'ok', text: tracked.length
        ? (left ? `${left} of ${tracked.length} trackable action${tracked.length > 1 ? 's' : ''} still open.` : 'Every trackable action for this chapter is done. Reminders below still apply.')
        : 'Reminders only; this app cannot tell whether you have done these.' }));
      kids.push(h('ul', { class: 'blist' }, items.map((it) => {
        const done = it.id != null && byId(it.id);
        return h('li', { class: done ? 'done' : (it.id == null ? 'note' : 'todo') },
          h('i', { class: 'mk', 'aria-hidden': 'true', text: done ? '✓' : (it.id == null ? '•' : '○') }),
          h('span', {}, h('span', { class: 'st', text: done ? 'DONE ' : (it.id == null ? 'REMINDER ' : 'TO DO ') }), it.text, done ? h('em', { class: 'doneby', text: ' ' + it.done }) : null));
      })));
    }
    el.replaceChildren(...kids);
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
  function renderAll() { renderHeader(); renderTimeline(); renderBefore(); renderList(); if (currentDetail != null) renderDetail(currentDetail); if (location.hash === '#audit') renderAuditView(); }

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
        t.meditationSpots ? h('div', { class: 'block medblock' }, h('h3', { text: 'Meditation spots' }), h('div', { id: 'medgrid' })) : '',
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
    renderMed();
  }

  // ---------- Audit view ----------
  function renderAuditView() {
    const el = $('auditView');
    const srcs = doc.sources;
    const dates = srcs.map((x) => x.accessed).filter(Boolean).sort();
    const last = dates[dates.length - 1];
    const read = last ? new Date(last + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'n/a';
    const head = h('tr', {}, h('th', { class: 'c-psn', text: '#' }), h('th', { class: 'c-name', text: 'Trophy' }), h('th', { text: 'Grade' }), h('th', { text: 'Confidence' }),
      srcs.map((x) => h('th', { class: 'c-src', title: x.name, text: x.id })));
    const mkRow = (t) => h('tr', { 'data-psn': t.psn },
      h('td', { class: 'c-psn num', text: String(t.psn) }), h('td', { class: 'c-name', text: t.name }), h('td', {}, chip(t.grade)), h('td', {}, badge(t.confidence)),
      srcs.map((x) => (t.sources || []).includes(x.id) ? h('td', { class: 'c-src yes', title: x.name, 'aria-label': 'cited in ' + x.id, text: '●' }) : h('td', { class: 'c-src', 'aria-label': 'not cited in ' + x.id })));
    // Two half-tables (trophies 1-28 and 29-55): side by side on wide screens so the whole matrix fits one screen, stacked on narrow ones.
    const half = Math.ceil(doc.trophies.length / 2);
    const matrixTable = (list) => h('div', { class: 'matrixwrap' }, h('table', { class: 'matrix' }, h('thead', {}, head.cloneNode(true)), h('tbody', {}, list.map(mkRow))));
    const conflicts = doc.conflicts.map((c) => h('article', { class: 'conflict' },
      h('div', { class: 'chead' }, h('span', { class: 'badge conflict' }, h('i', { text: '!', 'aria-hidden': 'true' }), 'sources disagree'), h('h3', { text: c.topic })),
      h('div', { class: 'sides' }, c.sides.map((sd, i) => h('div', { class: 'side' },
        h('span', { class: 'sidelbl', text: 'Side ' + String.fromCharCode(65 + i) }), h('p', { text: sd.claim }),
        h('p', { class: 'num' }, 'Sources: ', sd.sources.map((id) => h('span', { class: 'src', text: `[${id}] ` })))))),
      c.note ? h('p', { class: 'cnote', text: c.note }) : null));
    el.replaceChildren(
      h('section', { class: 'apanel' }, h('h2', { text: 'Source matrix' }),
        h('p', { class: 'hint', text: `${doc.trophies.length} trophies × ${srcs.length} sources. ● = the source is cited for that trophy.` }),
        h('div', { class: 'matrixpair' }, matrixTable(doc.trophies.slice(0, half)), matrixTable(doc.trophies.slice(half)))),
      h('div', { class: 'abottom' },
      h('section', { class: 'apanel aconf' }, h('h2', { text: `Conflicts (${doc.conflicts.length})` }), h('div', { class: 'conflicts' }, conflicts)),
      h('section', { class: 'apanel adata' }, h('h2', { text: 'Data status' }),
        h('p', {}, 'Last saved: ', h('span', { class: 'num js-savedat', text: state.savedAt ? fmtDate(state.savedAt) : 'nothing yet' })),
        h('p', { class: 'num', text: 'Sources read ' + read }),
        h('div', { class: 'tools2' },
          h('button', { type: 'button', id: 'export2', onclick: doExport, text: 'Export' }),
          h('label', { class: 'filebtn' }, 'Import ', h('input', { type: 'file', id: 'import2', accept: 'application/json,.json', onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; doImport(f); } })),
          h('span', { class: 'hint', id: 'toolmsg2', role: 'status' })))));
  }
  function route() {
    const m = /^#t\/(\d+)$/.exec(location.hash);
    if (!doc) return;
    const audit = location.hash === '#audit';
    $('auditView').hidden = !audit;
    for (const id of ['timeline', 'before', 'tools', 'main', 'audit']) $(id).hidden = audit;
    $('viewGuide').setAttribute('aria-pressed', String(!audit)); $('viewAudit').setAttribute('aria-pressed', String(audit));
    document.body.classList.toggle('detail-open', !audit && !!m);
    document.body.classList.toggle('audit-open', audit);
    if (audit) { currentDetail = null; renderAuditView(); window.scrollTo(0, 0); return; }
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
  function msg(text) { $('toolmsg').textContent = text; const m2 = $('toolmsg2'); if (m2) m2.textContent = text; }
  function doExport() {
    const blob = new Blob([JSON.stringify({ app: 'last-save', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'last-save-progress.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg('Exported ' + Object.keys(state.earned).length + ' earned trophies and ' + Object.keys(state.med).length + ' meditation toggles.');
  }
  async function doImport(file) {
    if (!file) return;
    try {
      const next = normalize(JSON.parse(await file.text()));
      state = next; syncControls(); save(); renderAll();
      msg('Imported ' + Object.keys(state.earned).length + ' earned trophies and ' + Object.keys(state.med).length + ' meditation toggles.');
    } catch (err) { msg('Import failed: that file is not a LAST SAVE export.'); }
  }
  function wire() {
    const cats = [...new Set(doc.trophies.map((t) => t.category))];
    $('fCat').replaceChildren(h('option', { value: 'all', text: 'All' }), ...cats.map((c) => h('option', { value: c, text: c })));
    $('chapter').addEventListener('change', (e) => { state.chapter = Number(e.target.value); revealed.clear(); save(); renderAll(); });
    $('hideHidden').addEventListener('change', (e) => { state.hideHidden = e.target.checked; revealed.clear(); save(); renderAll(); });
    const f = (id, key) => $(id).addEventListener(id === 'fQ' ? 'input' : 'change', (e) => { state.filters[key] = e.target.value; save(); renderList(); });
    f('fGrade', 'grade'); f('fCat', 'cat'); f('fConf', 'conf'); f('fQ', 'q');
    $('fClear').addEventListener('click', () => { state.filters = defaults().filters; syncControls(); save(); renderList(); });
    $('export').addEventListener('click', doExport);
    $('import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; doImport(f); });
    $('viewGuide').addEventListener('click', () => { location.hash = ''; if (!location.hash) route(); });
    $('viewAudit').addEventListener('click', () => { location.hash = '#audit'; });
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
    wire(); syncControls(); renderAudit(); renderHeader(); renderTimeline(); renderBefore(); renderList(); renderSaved(false); route();
  }

  // ---------- data loading: the script mirror (works from file://), else fetch the JSON ----------
  function fail() {
    $('main').prepend(h('div', { class: 'loadfail' },
      h('p', {}, 'Could not load the trophy data (data/trophies.js and data/trophies.json). Check that the app/data folder is intact.')));
  }
  function boot() {
    if (window.LAST_SAVE_DATA) { start(window.LAST_SAVE_DATA); return; }
    fetch('data/trophies.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(fail);
  }
  boot();
})();
