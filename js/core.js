"use strict";
/* Security Tracer core: namespace, helpers, progress store, router, widget registry. */
window.ST = window.ST || {};
(function (ST) {
  ST.CHECKED = "2026-10-27";

  /* ---------- DOM helpers ---------- */
  ST.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  ST.$ = (s, root) => (root || document).querySelector(s);
  ST.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  ST.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Motion setting for packet animations: "normal" | "slow" | "off" (per device; default follows the OS reduce-motion setting). */
  ST.motion = (() => { try { const v = localStorage.getItem("st.motion"); if (v === "normal" || v === "slow" || v === "off") return v; } catch (e) {} return ST.reduceMotion ? "off" : "normal"; })();
  ST.motionScale = () => ST.motion === "off" ? 0 : ST.motion === "slow" ? 2.4 : 1;
  ST.MOTION_LABEL = { normal: "動き：標準", slow: "動き：ゆっくり", off: "動き：停止" };
  ST.sleep = ms => new Promise(r => setTimeout(r, ST.reduceMotion ? Math.min(ms, 60) : ms));
  ST.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  ST.uid = (() => { let n = 0; return p => (p || "u") + (++n); })();

  /* Lightweight inline markup for content strings: **bold**, `code`, [[term-id]] or [[term-id|label]] links. */
  ST.md = s => ST.esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, id, label) => {
      const t = ST.TERM && ST.TERM[id];
      return `<a href="#term-${id}">${label || (t ? ST.esc(t.name) : id)}</a>`;
    });

  /* ---------- Sources ---------- */
  ST.srcList = keys => `<ul class="sources">${keys.filter(k => ST.SRC[k]).map(k => { const s = ST.SRC[k]; return `<li><span class="org">${ST.esc(s.org)}</span><a href="${ST.esc(s.url)}" target="_blank" rel="noopener">${ST.esc(s.label)}</a></li>`; }).join("")}</ul>`;

  /* Oldest check date among the given sources (falls back to the site-wide date). */
  ST.checkedOf = keys => (keys || []).map(k => ST.SRC[k] && ST.SRC[k].checked).filter(Boolean).sort()[0] || ST.CHECKED;

  /* ---------- Progress (per device): localStorage. Move between devices with the handoff code below. ---------- */
  const LS_KEY = "sectracer.progress.v2";
  ST.P = { terms: {}, sims: {}, lessons: {}, labs: {}, quiz: { answered: 0, correct: 0 }, streak: { last: "", days: 0 }, updated: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || localStorage.getItem("sectracer.progress.v1") || "null");
    if (s && s.terms) ST.P = Object.assign(ST.P, s);
  } catch (e) {}
  ST.save = () => {
    ST.P.updated = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(ST.P)); } catch (e) {}
  };
  ST.touchStreak = () => {
    const today = new Date().toISOString().slice(0, 10);
    const st = ST.P.streak || (ST.P.streak = { last: "", days: 0 });
    if (st.last === today) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    st.days = st.last === y ? st.days + 1 : 1; st.last = today;
  };
  ST.termStat = id => ST.P.terms[id] || { c: 0, w: 0, seen: 0 };
  ST.mastery = id => { const s = ST.termStat(id); return Math.max(0, Math.min(3, (s.c || 0) - (s.w || 0))); };
  ST.masteryDots = id => { const m = ST.mastery(id); return `<span class="mastery" title="理解度 ${m}/3">${[0, 1, 2].map(i => `<i class="${i < m ? "on" : ""}"></i>`).join("")}</span>`; };
  ST.markLesson = id => { if (!ST.P.lessons[id]) { ST.P.lessons[id] = Date.now(); ST.touchStreak(); ST.save(); } };
  ST.markLab = id => { if (!ST.P.labs[id]) { ST.P.labs[id] = Date.now(); ST.touchStreak(); ST.save(); } };
  /* 復習の間隔（日）。復習するたびに次の間隔へ進む。 */
  ST.REVIEW_DAYS = [1, 3, 7, 14, 30];
  /* 次に復習する時刻（ミリ秒）。doneAt は最後に学んだ時刻、count は復習した回数（0 なら初回の復習）。 */
  ST.nextReview = (doneAt, count) => {
    const i = Math.min(count, ST.REVIEW_DAYS.length - 1);
    return doneAt + ST.REVIEW_DAYS[i] * 86400000;
  };
  /* いま復習する時期なら true。now は現在時刻（ミリ秒）。 */
  ST.isDue = (doneAt, count, now) => {
    return now  >= ST.nextReview(doneAt, count);
  };
  /* 復習まであと何日か（整数）。時期なら 0。 */
  ST.daysUntilReview = (doneAt, count, now) => {
    const ms = ST.nextReview(doneAt, count) - now;
    return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
  };
  /*復習が必要なレッスンidの配列*/
  ST.dueLessons = now => { Object.keys(ST.P.lessons) .filter( id => ST.isDue(ST.P.lessons[id],0,now)) };
  /* ---------- Skill tree: lesson.requires (js/data/courses.js). Derived from ST.P.lessons only; nothing new is stored. ---------- */
  ST.LOCK = "off"; // "soft": show a gate with a "read anyway" button; "hard": no button; "off": order hints only.
  ST.peek = new Set(); // gates opened with "read anyway" in this page session (not saved)
  ST.missingReqs = id => ((ST.LESSON[id] || {}).requires || []).filter(r => !ST.P.lessons[r]);
  ST.lessonState = id => ST.P.lessons[id] ? "done" : !ST.missingReqs(id).length ? "open" : "locked";
  ST.labOpeners = w => ST.COURSES.flatMap(c => c.lessons).filter(l => l.blocks.some(b => b.w === w));
  ST.labOpen = w => { const ls = ST.labOpeners(w); return !ls.length || ls.some(l => ST.P.lessons[l.id]); };
  ST.gated = key => ST.LOCK !== "off" && !ST.peek.has(key);
  /* ---------- Handoff code: copy progress as text on one device, paste on another. No server; merged, never overwritten. ---------- */
  const CODE_PREFIX = "ST1-", CODE_MAX = 200000;
  ST.exportCode = () => CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(ST.P)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const isObj = o => o && typeof o === "object" && !Array.isArray(o);
  ST.parseCode = text => {
    const t = String(text || "").trim();
    if (!t.startsWith(CODE_PREFIX) || t.length > CODE_MAX) throw new Error("引き継ぎコードの形式が違います");
    let o;
    try { o = JSON.parse(decodeURIComponent(escape(atob(t.slice(CODE_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { throw new Error("コードを読み取れませんでした（途中で切れていないか確認してください）"); }
    if (!isObj(o) || !isObj(o.terms) || !isObj(o.lessons) || !isObj(o.labs)) throw new Error("コードの中身が学習記録ではありません");
    return o;
  };
  /* Union of completed items (earliest time kept); per term, the entry with more answers; the larger quiz tally; the later streak. */
  ST.mergeProgress = (a, b) => {
    const union = (x, y, pick) => { const r = Object.assign({}, x); for (const k in y) r[k] = k in r ? pick(r[k], y[k]) : y[k]; return r; };
    const early = (p, q) => (typeof p === "number" && typeof q === "number" ? Math.min(p, q) : p);
    const n = s => (s.c || 0) + (s.w || 0) + (s.seen || 0);
    const qa = a.quiz || { answered: 0, correct: 0 }, qb = b.quiz || { answered: 0, correct: 0 };
    return {
      terms: union(a.terms || {}, b.terms || {}, (p, q) => (n(q) > n(p) ? q : p)),
      sims: union(a.sims || {}, b.sims || {}, (p, q) => ((q && q.at || 0) < (p && p.at || 0) ? q : p)),
      lessons: union(a.lessons || {}, b.lessons || {}, early),
      labs: union(a.labs || {}, b.labs || {}, early),
      quiz: (qb.answered || 0) > (qa.answered || 0) ? qb : qa,
      streak: ((b.streak && b.streak.last) || "") > ((a.streak && a.streak.last) || "") ? b.streak : (a.streak || { last: "", days: 0 }),
      updated: Date.now()
    };
  };
  ST.importCode = text => { ST.P = ST.mergeProgress(ST.P, ST.parseCode(text)); ST.save(); };

  /* ---------- Widgets: ST.widget(name, {title, mount(el, opts) -> optional cleanup}) ---------- */
  ST.W = {};
  ST.widget = (name, def) => { ST.W[name] = def; };
  const live = [];
  ST.mountWidget = (host, name, opts) => {
    const def = ST.W[name];
    if (!def) { host.innerHTML = `<p class="empty">ウィジェット「${ST.esc(name)}」は準備中です。</p>`; return; }
    host.innerHTML = `<div class="bench"><div class="bench-h"><span class="led"></span><span class="eyebrow">${ST.esc((opts && opts.title) || def.title)}</span>${def.motion ? `<button type="button" class="chip" data-motion title="パケットの動きの速さを切り替える">${ST.MOTION_LABEL[ST.motion]}</button>` : ""}${def.group ? `<a class="chip" href="#lab-${name}" title="単独で開く">LAB</a>` : ""}</div><div class="bench-b"></div></div>`;
    const body = host.querySelector(".bench-b");
    const mb = host.querySelector("[data-motion]");
    if (mb) mb.onclick = () => { ST.motion = ST.motion === "normal" ? "slow" : ST.motion === "slow" ? "off" : "normal"; try { localStorage.setItem("st.motion", ST.motion); } catch (e) {} ST.$$("[data-motion]").forEach(b => b.textContent = ST.MOTION_LABEL[ST.motion]); };
    try {
      const cleanup = def.mount(body, opts || {});
      if (typeof cleanup === "function") live.push(cleanup);
    } catch (e) { body.innerHTML = `<p class="empty">表示できませんでした: ${ST.esc(e.message)}</p>`; console.error(e); }
  };
  ST.mountAll = root => ST.$$("[data-widget]", root).forEach(h => {
    let opts = {}; try { opts = JSON.parse(h.dataset.opts || "{}"); } catch (e) {}
    ST.mountWidget(h, h.dataset.widget, opts);
  });
  const cleanupWidgets = () => { while (live.length) { try { live.pop()(); } catch (e) {} } };

  /* ---------- Router: plain #name hashes only ---------- */
  ST.views = {};
  ST.view = (name, fn) => { ST.views[name] = fn; };
  ST.routes = []; // [{prefix, view, tab}]
  ST.route = (prefix, view, tab) => ST.routes.push({ prefix, view, tab });
  ST.current = { view: "home", arg: null, tab: "home" };
  ST.parseHash = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    for (const r of ST.routes) {
      if (r.prefix.endsWith("-") ? h.startsWith(r.prefix) : h === r.prefix) {
        const arg = r.prefix.endsWith("-") ? h.slice(r.prefix.length) : null;
        if (r.prefix.endsWith("-") && !arg) continue;
        return { view: r.view, arg, tab: r.tab };
      }
    }
    return { view: "home", arg: null, tab: "home" };
  };
  ST.go = (keepScroll) => {
    cleanupWidgets();
    ST.current = ST.parseHash();
    ST.$$("nav.tabs a").forEach(a => { if (a.dataset.v === ST.current.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const view = document.getElementById("view");
    const fn = ST.views[ST.current.view] || ST.views.home;
    try { fn(view, ST.current.arg); } catch (e) { view.innerHTML = `<p class="empty">ページを表示できませんでした: ${ST.esc(e.message)}</p>`; console.error(e); }
    ST.mountAll(view);
    if (!keepScroll) window.scrollTo(0, 0);
  };
  ST.refresh = () => ST.go(true);
})(window.ST);
