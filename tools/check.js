#!/usr/bin/env node
"use strict";
/* Consistency check (no dependencies): node tools/check.js
   Loads the site's scripts in a bare VM and cross-checks catalogs. Exits 1 on any problem. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const problems = [];
const bad = m => problems.push(m);

const scripts = f => [...fs.readFileSync(path.join(root, f), "utf8").matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const pages = ["index.html", "artifact.html"].filter(f => fs.existsSync(path.join(root, f)));
const lists = pages.map(scripts);
lists.forEach((l, i) => { if (JSON.stringify(l) !== JSON.stringify(lists[0])) bad(`${pages[i]} の script 一覧が ${pages[0]} と違う`); });
const loaded = new Set(lists[0]);
fs.readdirSync(path.join(root, "js/widgets")).filter(f => f.endsWith(".js")).forEach(f => { if (!loaded.has("js/widgets/" + f)) bad(`js/widgets/${f} が script タグにない`); });
lists[0].forEach(f => { if (!fs.existsSync(path.join(root, f))) bad(`${f} が存在しない`); });

/* Run everything up to (not including) app.js in a stub browser to inspect the catalogs. */
const noop = () => {}, el = () => new Proxy(function () {}, { get: () => el(), apply: () => el(), set: () => true });
const win = { addEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }), location: { hash: "" }, localStorage: { getItem: () => null, setItem: noop } };
const ctx = vm.createContext({ window: win, document: el(), localStorage: win.localStorage, matchMedia: win.matchMedia, navigator: {}, console, requestAnimationFrame: noop, crypto: {}, setTimeout, clearTimeout, setInterval, clearInterval, ST: undefined });
ctx.window = Object.assign(win, { ST: undefined });
vm.runInContext('var ST = (window.ST = {});', ctx);
for (const f of lists[0].filter(f => !/app\.js$/.test(f))) {
  try { vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f }); } catch (e) { bad(`${f} の読み込みで例外: ${e.message}`); }
}
const ST = ctx.ST;
if (ST && ST.W) {
  const widgets = new Set(Object.keys(ST.W));
  Object.entries(ST.W).forEach(([id, w]) => { if (w.group && !ST.LAB_GROUPS.some(g => g.id === w.group)) bad(`widget ${id}: 不明な group ${w.group}`); if (w.group && (!w.name || !w.desc)) bad(`widget ${id}: name/desc がない`); if (w.group && typeof w.order !== "number") bad(`widget ${id}: order がない`); });
  (ST.SCEN || []).forEach(s => { (s.terms || []).forEach(t => { if (!ST.TERM[t]) bad(`scenario ${s.id}: 未登録の用語 ${t}`); }); JSON.stringify(s).replace(/\[\[([\w-]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { if (!ST.TERM[id]) bad(`scenario ${s.id}: リンク先の用語 ${id} がない`); }); });
  const lessons = ST.COURSES.flatMap(c => c.lessons);
  lessons.forEach(l => {
    l.blocks.forEach(b => { if (b.w && !widgets.has(b.w)) bad(`lesson ${l.id}: 未登録のウィジェット ${b.w}`); });
    (l.terms || []).forEach(t => { if (!ST.TERM[t]) bad(`lesson ${l.id}: 未登録の用語 ${t}`); });
    (l.src || []).forEach(s => { if (!ST.SRC[s]) bad(`lesson ${l.id}: 未登録の出典 ${s}`); });
  });
  ST.TERMS.forEach(t => {
    if (t.lab && !(ST.W[t.lab] && ST.W[t.lab].group)) bad(`term ${t.id}: lab ${t.lab} がラボとして未登録`);
    if (t.sim && !ST.SC[t.sim]) bad(`term ${t.id}: 未登録のシミュレーター ${t.sim}`);
    (t.src || []).forEach(s => { if (!ST.SRC[s]) bad(`term ${t.id}: 未登録の出典 ${s}`); });
    JSON.stringify([t.summary, t.how, t.risk, t.defense]).replace(/\[\[([\w-]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { if (!ST.TERM[id]) bad(`term ${t.id}: リンク先の用語 ${id} がない`); });
  });
  lessons.forEach(l => JSON.stringify(l.blocks).replace(/\[\[([\w-]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { if (!ST.TERM[id]) bad(`lesson ${l.id}: リンク先の用語 ${id} がない`); }));
  ST.QUIZ.forEach((q, i) => { if (q.term && !ST.TERM[q.term]) bad(`quiz #${i + 1}: 未登録の用語 ${q.term}`); });
  (ST.NEWS_STATIC || []).forEach(n => (n.terms || []).forEach(t => { if (!ST.TERM[t]) bad(`news ${n.id}: 未登録の用語 ${t}`); }));
  const used = new Set([...lessons.flatMap(l => l.src || []), ...ST.TERMS.flatMap(t => t.src || [])]);
  const unused = Object.keys(ST.SRC).filter(k => !used.has(k));
  if (unused.length) console.log("（参考）どこからも引用されていない出典: " + unused.join(", "));
  console.log(`ウィジェット ${widgets.size}、ラボ ${Object.keys(ST.LAB).length}、レッスン ${lessons.length}、用語 ${ST.TERMS.length}`);
} else bad("ST.W が作られていない");

if (problems.length) { console.error("NG:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("OK");
