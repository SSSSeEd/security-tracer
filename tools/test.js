"use strict";
/* 単体テスト。実行: リポジトリのルートで `node tools/test.js`（Node 18 以上。インストール不要）。
   js/core.js はブラウザ用なので、最低限のダミー（window など）を渡して読み込み、ST の関数だけ試す。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadST() {
  const store = {};
  const win = {};
  const ctx = {
    window: win,
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { hash: "" },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    addEventListener() {},
    console
  };
  win.addEventListener = ctx.addEventListener;
  ctx.self = win;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8"), ctx, { filename: "js/core.js" });
  return win.ST;
}

const ST = loadST();
const DAY = 86400000;

test("core.js が読み込めて、基本の関数がある", () => {
  assert.strictEqual(typeof ST.esc, "function");
  assert.strictEqual(ST.esc("<a>"), "&lt;a&gt;");
});

/* 復習スケジュール（バイト方式の第1題）。ST.nextReview が書かれたら有効になる。 */
const hasReview = typeof ST.nextReview === "function";

test("nextReview: 初回の復習は1日後", { skip: !hasReview }, () => {
  assert.strictEqual(ST.nextReview(0, 0), 1 * DAY);
});

test("nextReview: 復習のたびに間隔が延びる（3日・7日・14日・30日）", { skip: !hasReview }, () => {
  assert.deepStrictEqual([1, 2, 3, 4].map(n => ST.nextReview(0, n)), [3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY]);
});

test("nextReview: 5回を超えても30日のまま（配列の外を読まない）", { skip: !hasReview }, () => {
  assert.strictEqual(ST.nextReview(0, 99), 30 * DAY);
});

test("nextReview: 学んだ時刻に足した値を返す", { skip: !hasReview }, () => {
  assert.strictEqual(ST.nextReview(1000, 0), 1000 + DAY);
});
