# 01 アーキテクチャ

## ファイル構成(security-tracer main)
```
index.html            入口。script タグが読み込み順の正本
css/style.css         全スタイル(約34KB)。トークン + コンポーネント
js/core.js            ST 名前空間、ヘルパー、進捗、復習、スキルツリー、引き継ぎコード、ウィジェット登録、ルーター
js/data/sources.js    出典(ST.SRC)
js/data/terms.js      用語集(ST.TERMS / ST.TERM)
js/data/scenarios.js  攻撃シミュレーター(ST.SCEN / ST.SC)
js/data/courses.js    コースとレッスン(ST.COURSES / ST.COURSE / ST.LESSON)
js/data/quiz.js       クイズ(ST.QUIZ)
js/data/news.js       ニュース(ST.NEWS_STATIC)
js/data/legal.js      法的注意枠(このテーマ固有。別テーマでは「注意枠」に差し替え)
js/widgets/_kit.js    ウィジェット共通部品(ST.seq, ST.segHtml, ST.lineChart, ST.flyPacket, ST.sha256 ほか)
js/widgets/<分野>-<話題>.js  図解ラボ。約20KBを超えたら話題で分割
js/views.js           画面(home, courses, course, tree, lesson, lab, labitem, sim, terms, term, quiz, news)
js/app.js             画面の枠(ヘッダ、下部タブ、SVGシンボル)と起動
sw.js                 Service Worker(オフライン)
manifest.webmanifest  PWA(ホーム画面に追加)
icon.svg, icon-180.png
robots.txt, <meta robots noindex>   検索に載せない設定(個人用)
.nojekyll             空ファイル。絶対に消さない(後述)
tools/check.js        整合性チェック(依存なし、node のみ)
tools/test.js         core.js の単体テスト(node:test)
vendor/               同梱した外部ライブラリ(MIT の sql.js)。遅延読み込み
HANDOFF.md ROADMAP.md README.md   引き継ぎ・予定・構成
```
- `js/redline.js`(法的注意枠 + 練習場)と `js/widgets/battle.js`(攻防対戦)、`js/data/ops*.js` は後から足された応用機能。別テーマで最初から真似る必要はない。まず上の核だけ作る。

## 読み込み順(index.html の script タグ。順序厳守)
core → data/sources → data/terms → data/scenarios → data/courses → data/quiz → data/news → data/legal → widgets/_kit → widgets/* → (redline) → views → app。
- 理由: terms/courses が `ST.SRC` を参照、views が `ST.W`(ウィジェット登録)から一覧を作る、app が最後に起動する。
- ビルドしないので **script タグを足し忘れると動かない**。check.js が index.html と js/widgets/ の食い違い、sw.js のキャッシュ一覧の漏れを検出する。

## core.js の API(ST.*)
- DOM: `esc(s)` HTMLエスケープ、`$`/`$$` querySelector、`sleep`(視覚効果軽減なら60ms上限)、`shuffle`、`uid`。
- `ST.md(s)`: コンテンツ文字列の簡易マークアップ。`**太字**`、`` `code` ``、`[[term-id]]` または `[[term-id|表示名]]`(用語ページへのリンク)。**コンテンツ内のHTMLは常にこれ経由**(先にエスケープするので安全)。
- `ST.srcList(keys)`: 出典キーの配列 → 出典リストHTML。
- 進捗 `ST.P = {terms:{id:{c,w,seen}}, sims:{}, lessons:{id:完了時刻ms}, labs:{id:時刻}, quiz:{answered,correct}, streak:{last,days}, updated}`。
  - localStorage キー `sectracer.progress.v2`。**別アプリではキー名を必ず変える**(同一オリジンのGitHub Pages同士で衝突し得る。例: `<app>.progress.v1`)。
  - `ST.save()`、`ST.markLesson(id)`、`ST.markLab(id)`、`ST.touchStreak()`、`ST.termStat(id)`、`ST.mastery(id)`(0〜3 = 正解数-不正解数)、`ST.masteryDots(id)`。
- 復習: `ST.REVIEW_DAYS=[1,3,7,14,30]`、`ST.nextReview(doneAt,count)`、`ST.isDue`、`ST.daysUntilReview`、`ST.dueLessons(now)`、`ST.upcomingReviews(now,days)`。現状 count は 0 固定(復習回数の保存は未設計。HANDOFF 参照)。
- スキルツリー: `ST.LOCK`("off"|"soft"|"hard")、`ST.missingReqs(id)`、`ST.lessonState(id)`("done"|"open"|"locked")、`ST.labOpen(widgetId)`、`ST.gated(key)`。**状態は新しく保存しない**。開いているかは `ST.P.lessons`(読了記録)から毎回計算する。
- 引き継ぎコード: `ST.exportCode()`(`ST1-` + base64url(JSON))、`ST.importCode(text)`。`ST.mergeProgress(a,b)` は和集合(完了は早い方の時刻、用語は回答数が多い方、クイズは大きい方、ストリークは新しい方)。**上書きしない**。`ST.parseCode` は形式・サイズ(200000字)・中身を検証。
- 動き: `ST.motion`("normal"|"slow"|"off"、localStorage `st.motion`)、`ST.motionScale()`(1/2.4/0)。OSの「視覚効果を減らす」に従う。
- ウィジェット: `ST.widget(id, def)` 登録、`ST.mountWidget(host,id,opts)`、`ST.mountAll(root)`。`def.mount(el, opts)` は **後始末関数を返す**(タイマー停止)。ルーター遷移時に自動で全cleanupを実行。
- ルーター: `#名前` のハッシュのみ。`ST.view(name, fn(v,arg))`、`ST.route(prefix, view, tab)`。prefix が `-` で終わるものは `#l-<id>` のように引数付き。`ST.go()`、`ST.refresh()`(スクロール維持)。`hashchange` で再描画。例外は画面内に「表示できませんでした」を出して握りつぶさない(console.error も出す)。
- `ST.checkedOf(keys)`: 出典キー群の中で最も古い確認日を返す(画面の「出典確認日」表示用)。

## 画面とルート
| ルート | view | 内容 |
|---|---|---|
| #home | home | 「今日やること」カード(次のレッスン)、統計4つ、復習カード、今日の用語、おすすめラボ、引き継ぎコード、注意書き |
| #courses / #course-<id> | courses/course | コース一覧(地下鉄路線図風)、レッスン一覧 |
| #l-<lessonId> | lesson | レッスン本体 |
| #tree | tree | スキルツリー(前提の深さで段) |
| #lab / #lab-<widgetId> | lab/labitem | ラボ一覧(分野別)、単独ラボ |
| #sim / #sim-<id> | sim | 攻撃シミュレーター |
| #terms / #term-<id> | terms/term | 用語集(検索・分類)、用語詳細 |
| #quiz | quiz | クイズ |
| #news | news | ニュース |
下部タブは `app.js` の TABS(ホーム/学ぶ/ラボ/用語/クイズ/ニュース、アイコンはインラインSVG path)。タブの `tab` 名とルート定義の第3引数を一致させると現在地が強調される。

## 追加の種類ごとの手順
- 新しいラボ: `js/widgets/<分野>-<話題>.js` に `ST.widget("id",{title,group,name,desc,order,motion?,mount})`。`group` は `ST.LAB_GROUPS` の id。group が無いと「ラボ」ではなく埋め込み専用(攻撃シミュレーターがそう)。ラボ一覧は登録内容から自動生成される。→ index.html に script 追加(`_kit.js` の後、`views.js` の前)→ sw.js の SHELL に追加 → `node tools/check.js`。
- 新しい分野: `ST.LAB_GROUPS` に追加、css の色トークン `--cN` をライト・ダーク計3か所に追加、`ST.COURSES` に追加(ニュースは最後)、用語分類 `ST.TERM_CATS` にも追加。
- 新しいレッスン: courses.js の該当コースに追加(スキーマは 02)。`requires` を必ず書く。

## PWA・公開
- 公開: GitHub Pages(Settings → Pages → main → / root)。URL `https://<user>.github.io/<repo>/`。GitHub の設定系 APIは作業エージェントに権限が無い。**ユーザーが画面で有効化する**。
- **`.nojekyll` を消さない**: GitHub Pages は既定で Jekyll が動き、`_` で始まるファイル(`js/widgets/_kit.js`)を配信しない。消すとスマホで「ST.segHtml is not a function」になった(2026-11-05 実害)。
- sw.js: ネットワーク優先、失敗時にキャッシュ。同一オリジン GET のみ。外部フォントはキャッシュしない(オフラインはシステムフォント)。`CACHE = "sectracer-vN"` を変える(別アプリでは名前も変える)。SHELL に全 script と vendor を列挙。**check.js が script・vendor の漏れを検出**。キャッシュ名のバージョンは構成を変えたら上げる。
- manifest: `display:"standalone"`、`lang:"ja"`、icon は svg + 180px png(apple-touch-icon)。`theme-color` はライト/ダークの2つを media で出し分け。
- 個人用なので `noindex,nofollow,noarchive` と robots.txt `Disallow: /`。公開する別アプリでは方針を決めてから変更。
- 公開リポジトリなので、**個人情報・秘密をコミットしない**。check.js が全テキストファイルをスキャン(メール、電話番号、秘密鍵、トークン形)。意図的なダミーは行に `scan-ok` を付ける。
- 外部ライブラリは同梱(vendor/)が基本。CDN は web フォント(Google Fonts)のみ。重いものは使われるときだけ動的に読み込む(例: sql.js をSQLラボを開いたときだけ)。

## Artifact 版(参考・現在は廃止)
最初は claude.ai Artifact でも配信していた(`window.claude.use("db")` で端末間同期とニュース共有)。ユーザー決定(2026-10-31)で **GitHub のみ運用**に一本化し、artifact.html は削除済み。二重運用はコストなので別プロジェクトでも勧めない。端末間の進捗共有は引き継ぎコードで足りる。

## 性能・保守の目安(reviews/security-tracer-maintainability.md より)
- JS 合計は一括読み込みで問題ない規模(約380KB時点)。ウィジェットが40を超える、またはJSが1MBに近づいたら、ラボ単位の遅延読み込みを検討。
- 1ファイル約20KBを目安に話題で分割。`web2.js` のような番号付き名は避ける。
- ラボ一覧の二重管理を避ける(ウィジェットのメタ情報から自動生成)。script 一覧の重複も避ける(今は index.html だけ)。
- ウィジェット内の結果欄に `data-v` 属性を使わない(`ST.segHtml` のボタンが `data-v` を持ち、querySelector が衝突する)。`data-out` などを使う。
- 長時間の await ループには離脱時の停止フラグを持たせる(cleanup で止める)。
