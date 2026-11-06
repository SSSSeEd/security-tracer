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

/* 復習が必要なレッスンid（バイト方式の第4題）。 */
/* vm の中で作られた配列は別の Array なので、[...] でこちらの配列にしてから比べる。 */
const hasDueLessons = typeof ST.dueLessons === "function";

test("dueLessons: 配列を返す（undefined ではない）", { skip: !hasDueLessons }, () => {
  ST.P.lessons = {};
  assert.deepStrictEqual([...ST.dueLessons(0)], []);
});

test("dueLessons: 1日以上たったレッスンだけ返す", { skip: !hasDueLessons }, () => {
  ST.P.lessons = { old: 0, fresh: 2 * DAY };
  assert.deepStrictEqual([...ST.dueLessons(DAY + 1)], ["old"]);
});

test("dueLessons: 学んだ直後は含まない", { skip: !hasDueLessons }, () => {
  ST.P.lessons = { a: 1000 };
  assert.deepStrictEqual([...ST.dueLessons(1000)], []);
});

/* もうすぐ復習になるレッスンid（バイト方式の第5題）。 */
const hasUpcoming = typeof ST.upcomingReviews === "function";

test("upcomingReviews: 今日が復習のものは含まず、days 日以内のものだけ返す", { skip: !hasUpcoming }, () => {
  ST.P.lessons = { today: 0, soon: 0.5 * DAY, far: 29 * DAY };
  /* now = 1日。today は残り0日、soon は残り1日（切り上げ）、far は残り約29日。 */
  assert.deepStrictEqual([...ST.upcomingReviews(DAY, 3)], ["soon"]);
});

test("upcomingReviews: 残り日数が少ない順に並ぶ", { skip: !hasUpcoming }, () => {
  /* now = 0.1日。b は残り1日、a は残り2日、c は残り3日（count=0 の間隔は1日なので、学んだ時刻を未来にずらして作る）。 */
  ST.P.lessons = { c: 2.1 * DAY, a: 1.1 * DAY, b: 0.1 * DAY };
  assert.deepStrictEqual([...ST.upcomingReviews(0.1 * DAY - 1, 5)], ["b", "a", "c"]);
});

test("upcomingReviews: 該当なしなら空の配列", { skip: !hasUpcoming }, () => {
  ST.P.lessons = {};
  assert.deepStrictEqual([...ST.upcomingReviews(0, 3)], []);
});

test("upcomingReviews: days より先のものは含まない", () => {
  // ST.P.lessons を用意する（例: { x: 0 }）
  // ST.upcomingReviews(now, days) を呼ぶ
  // 結果を assert.deepStrictEqual([...結果], 期待する配列) で比べる // [...] はテスト用のおまじない
  ST.P.lessons={x:0};
  assert.deepStrictEqual([...ST.upcomingReviews(0,0)], []);
  assert.deepStrictEqual([...ST.upcomingReviews(0,1)], ["x"]);
});

