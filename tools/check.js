#!/usr/bin/env node
"use strict";
/* Consistency check (no dependencies): node tools/check.js
   Loads the site's scripts in a bare VM and cross-checks catalogs. Exits 1 on any problem. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const problems = [];
const bad = m => problems.push(m);

const scripts = f => [...fs.readFileSync(path.join(root, f), "utf8").matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const pages = ["index.html"];
const lists = pages.map(scripts);
lists.forEach((l, i) => { if (JSON.stringify(l) !== JSON.stringify(lists[0])) bad(`${pages[i]} の script 一覧が ${pages[0]} と違う`); });
const loaded = new Set(lists[0]);
fs.readdirSync(path.join(root, "js/widgets")).filter(f => f.endsWith(".js")).forEach(f => { if (!loaded.has("js/widgets/" + f)) bad(`js/widgets/${f} が script タグにない`); });
lists[0].forEach(f => { if (!fs.existsSync(path.join(root, f))) bad(`${f} が存在しない`); });
const swText = fs.existsSync(path.join(root, "sw.js")) ? fs.readFileSync(path.join(root, "sw.js"), "utf8") : "";
if (!swText) bad("sw.js がない");
lists[0].forEach(f => { if (swText && !swText.includes(`"${f}"`)) bad(`sw.js のキャッシュ一覧に ${f} がない（オフラインで開けなくなる）`); });

/* Lazy-loaded vendor files (not in index.html) must still be cached for offline use. */
(function walk(d) { fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => { const rel = d + "/" + e.name; if (e.isDirectory()) return walk(rel); if (/\.(js|wasm)$/.test(e.name) && swText && !swText.includes(`"${rel}"`)) bad(`sw.js のキャッシュ一覧に ${rel} がない`); }); })("vendor");

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
    if (!(l.src || []).length) bad(`lesson ${l.id}: 出典（src）が1つもない`);
    (l.practice || []).forEach(s => { if (!ST.SRC[s]) bad(`lesson ${l.id}: 未登録の外部教材 ${s}`); });
  });
  /* Skill tree: every lesson declares requires (lesson ids), no unknown ids, no cycles. */
  lessons.forEach(l => {
    if (!Array.isArray(l.requires)) return bad(`lesson ${l.id}: requires がない（入口なら []）`);
    l.requires.forEach(r => { if (!ST.LESSON[r]) bad(`lesson ${l.id}: requires に未登録のレッスン ${r}`); if (r === l.id) bad(`lesson ${l.id}: requires に自分自身`); });
  });
  const seen = {}, visit = (id, stack) => {
    if (seen[id] === 2) return; if (seen[id] === 1) return bad(`requires が循環している: ${[...stack, id].join(" → ")}`);
    seen[id] = 1; ((ST.LESSON[id] || {}).requires || []).forEach(r => visit(r, [...stack, id])); seen[id] = 2;
  };
  lessons.forEach(l => visit(l.id, []));
  ST.TERMS.forEach(t => {
    if (t.lab && !(ST.W[t.lab] && ST.W[t.lab].group)) bad(`term ${t.id}: lab ${t.lab} がラボとして未登録`);
    if (t.sim && !ST.SC[t.sim]) bad(`term ${t.id}: 未登録のシミュレーター ${t.sim}`);
    (t.src || []).forEach(s => { if (!ST.SRC[s]) bad(`term ${t.id}: 未登録の出典 ${s}`); });
    if (!(t.src || []).length) bad(`term ${t.id}: 出典（src）が1つもない`);
    JSON.stringify([t.summary, t.how, t.risk, t.defense]).replace(/\[\[([\w-]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { if (!ST.TERM[id]) bad(`term ${t.id}: リンク先の用語 ${id} がない`); });
  });
  lessons.forEach(l => JSON.stringify(l.blocks).replace(/\[\[([\w-]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { if (!ST.TERM[id]) bad(`lesson ${l.id}: リンク先の用語 ${id} がない`); }));
  ST.QUIZ.forEach((q, i) => { if (q.term && !ST.TERM[q.term]) bad(`quiz #${i + 1}: 未登録の用語 ${q.term}`); });
  (ST.NEWS_STATIC || []).forEach(n => (n.terms || []).forEach(t => { if (!ST.TERM[t]) bad(`news ${n.id}: 未登録の用語 ${t}`); }));
  Object.entries(ST.SRC).forEach(([k, s]) => {
    if (!s.org || !s.label) bad(`出典 ${k}: org / label がない`);
    if (!/^https:\/\/[^\s]+$/.test(s.url || "")) bad(`出典 ${k}: url が https で始まっていない`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checked || "")) bad(`出典 ${k}: 確認日（checked, YYYY-MM-DD）がない`);
  });
  ST.QUIZ.forEach((q, i) => { if (!q.term) bad(`quiz #${i + 1}: term がない（出典を引けない）`); if (!q.exp) bad(`quiz #${i + 1}: 解説（exp）がない`); });
  const used = new Set([...lessons.flatMap(l => l.practice || []), ...lessons.flatMap(l => l.src || []), ...ST.TERMS.flatMap(t => t.src || [])]);
  const unused = Object.keys(ST.SRC).filter(k => !used.has(k));
  if (unused.length) console.log("（参考）どこからも引用されていない出典: " + unused.join(", "));
  console.log(`ウィジェット ${widgets.size}、ラボ ${Object.keys(ST.LAB).length}、レッスン ${lessons.length}、用語 ${ST.TERMS.length}`);
} else bad("ST.W が作られていない");

/* The repository is public: scan every text file for personal data and secrets (email, phone number, private key, token).
   A line carrying the marker "scan-ok" is skipped (for deliberate dummy examples such as example.com addresses). */
const SCAN_RULES = [
  ["メールアドレス", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, m => !/@(?:[\w.-]+\.)?(?:example\.(?:com|org|net|jp)|example|test|invalid|localhost)$/i.test(m) && !/^[\w.+-]+@\d/.test(m)],
  ["電話番号", /(?<![\d-])(?:0\d{1,4}-\d{1,4}-\d{3,4}|0[789]0\d{8}|\+81[- ]?\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4})(?![\d-])/g],
  ["秘密鍵", /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g],
  ["トークンの形", /\b(?:ghp_|gho_|ghs_|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/g] // scan-ok
];
(function scanText(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    if (d.name === ".git" || d.name === "node_modules") return;
    const f = path.join(dir, d.name);
    if (d.isDirectory()) return scanText(f);
    if (!/\.(js|html|css|md|json|svg|webmanifest|txt|yml|yaml)$/i.test(d.name)) return;
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (line.includes("scan-ok")) return;
      SCAN_RULES.forEach(([name, re, keep]) => { (line.match(re) || []).forEach(m => { if (!keep || keep(m)) bad(`${path.relative(root, f)}:${i + 1} に${name}らしき文字列（公開リポジトリには置かない）: ${m.slice(0, 8)}…`); }); });
    });
  });
})(root);

if (problems.length) { console.error("NG:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("OK");
