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

/* 復習の時期かどうか（バイト方式の第2題）。 */
const hasDue = typeof ST.isDue === "function";

test("isDue: 次の復習の時刻より前なら false", { skip: !hasDue }, () => {
  assert.strictEqual(ST.isDue(0, 0, DAY - 1), false);
});

test("isDue: ちょうど次の復習の時刻なら true", { skip: !hasDue }, () => {
  assert.strictEqual(ST.isDue(0, 0, DAY), true);
});

test("isDue: 時刻を過ぎていれば true", { skip: !hasDue }, () => {
  assert.strictEqual(ST.isDue(0, 0, 10 * DAY), true);
});

test("isDue: 復習回数が増えると間隔が延びる（2回目は3日後）", { skip: !hasDue }, () => {
  assert.strictEqual(ST.isDue(0, 1, 2 * DAY), false);
  assert.strictEqual(ST.isDue(0, 1, 3 * DAY), true);
});

/* 復習まであと何日か（バイト方式の第3題）。 */
const hasDays = typeof ST.daysUntilReview === "function";

test("daysUntilReview: 時期ならちょうど 0", { skip: !hasDays }, () => {
  assert.strictEqual(ST.daysUntilReview(0, 0, DAY), 0);
  assert.strictEqual(ST.daysUntilReview(0, 0, 5 * DAY), 0);
});

test("daysUntilReview: 残りは日数を切り上げる", { skip: !hasDays }, () => {
  assert.strictEqual(ST.daysUntilReview(0, 1, 0), 3);
  assert.strictEqual(ST.daysUntilReview(0, 1, 1.5 * DAY), 2);
  assert.strictEqual(ST.daysUntilReview(0, 1, 3 * DAY - 1), 1);
});

test("daysUntilReview: ほかの関数を壊さない（nextReview は関数のまま）", { skip: !hasDays }, () => {
  ST.daysUntilReview(0, 0, 0);
  assert.strictEqual(typeof ST.nextReview, "function");
});
