"use strict";
/* App shell and boot. Renders header, tab bar and shared SVG symbols, then starts the router and optional cloud sync. */
(function (ST) {
  const TABS = [
    ["home", "ホーム", '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>'],
    ["courses", "学ぶ", '<path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5z"/><path d="M12 6v13.5"/>'],
    ["lab", "ラボ", '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/>'],
    ["terms", "用語", '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>'],
    ["quiz", "クイズ", '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>'],
    ["news", "ニュース", '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12.5h7M7 16h4"/>']
  ];
  const root = document.getElementById("root");
  root.innerHTML = `<div class="app">
    <header class="top"><div class="top-in">
      <a class="brand" href="#home"><svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="1" y="1" width="24" height="24" rx="6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="18" r="2.4" fill="currentColor"/><circle cx="19" cy="8" r="2.4" fill="currentColor"/><path d="M8.8 16.4 17.2 9.6" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="10.4" width="5" height="3.6" rx=".8" fill="var(--packet)"/></svg><span>Security Tracer <small>LAB</small></span></a>
      <span class="sync" id="sync">この端末に保存</span></div></header>
    <main><div class="wrap" id="view"></div></main>
    <nav class="tabs" aria-label="メイン"><div class="in">${TABS.map(([v, l, d]) => `<a href="#${v}" data-v="${v}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${d}</svg>${l}</a>`).join("")}</div></nav>
  </div>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="i-phone" viewBox="-14 -14 28 28"><rect x="-8" y="-12" width="16" height="24" rx="3"/><path d="M-3 8.5h6" fill="none"/></symbol>
    <symbol id="i-pc" viewBox="-14 -14 28 28"><rect x="-12" y="-10" width="24" height="15" rx="2"/><path d="M-5 10h10M0 5v5" fill="none"/></symbol>
    <symbol id="i-server" viewBox="-14 -14 28 28"><rect x="-10" y="-12" width="20" height="10" rx="2"/><rect x="-10" y="2" width="20" height="10" rx="2"/><circle cx="-5" cy="-7" r="1.2"/><circle cx="-5" cy="7" r="1.2"/></symbol>
    <symbol id="i-router" viewBox="-14 -14 28 28"><ellipse cx="0" cy="3" rx="12" ry="6"/><path d="M-12 3v-4M12 3v-4" fill="none"/><ellipse cx="0" cy="-1" rx="12" ry="6"/><path d="M-5 -1h10M2 -3.5l3 2.5-3 2.5" fill="none"/></symbol>
    <symbol id="i-db" viewBox="-14 -14 28 28"><path d="M-10 -8v16c0 3 20 3 20 0v-16"/><ellipse cx="0" cy="-8" rx="10" ry="3.6"/><path d="M-10 0c0 3 20 3 20 0" fill="none"/></symbol>
    <symbol id="i-cloud" viewBox="-14 -14 28 28"><path d="M-8 8h16a6 6 0 0 0 0-12 8 8 0 0 0-15-1 5.5 5.5 0 0 0-1 13z"/></symbol>
    <symbol id="i-ap" viewBox="-14 -14 28 28"><rect x="-11" y="2" width="22" height="9" rx="2"/><path d="M-7 -2a10 10 0 0 1 14 0M-4 1a5 5 0 0 1 8 0" fill="none"/></symbol>
    <symbol id="i-attacker" viewBox="-14 -14 28 28"><rect x="-12" y="-10" width="24" height="15" rx="2"/><path d="M-5 10h10M0 5v5" fill="none"/><path d="M-4 -6l8 7M4 -6l-8 7" fill="none"/></symbol>
    <symbol id="i-web" viewBox="-14 -14 28 28"><rect x="-12" y="-11" width="24" height="22" rx="2"/><path d="M-12 -5h24" fill="none"/><circle cx="-8.5" cy="-8" r="1"/><circle cx="-5.5" cy="-8" r="1"/></symbol>
  </defs>
</svg>`;
  addEventListener("hashchange", () => ST.go());
  ST.go();

  // Optional: shared news + cross-device progress when running as a claude.ai artifact.
  (async () => {
    try {
      if (!window.claude || !window.claude.use) return;
      const db = await window.claude.use("db");
      if (!db) return;
      db.collection("news").orderBy("date", "desc").limit(60).onSnapshot(snap => {
        if (snap.empty) return;
        ST.NEWS = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        if (["home", "news", "term"].includes(ST.current.view)) ST.refresh();
      }, () => {});
      const user = await window.claude.use("user");
      const id = user && await user.id();
      if (id) { const changed = await ST.bindRemoteProgress(db, id); ST.setSync("同期済み"); if (changed && !["sim", "labitem", "lesson"].includes(ST.current.view)) ST.refresh(); }
    } catch (e) { console.warn(e); }
  })();
})(window.ST);
