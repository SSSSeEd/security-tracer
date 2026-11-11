# 06 別テーマで作るときのチェックリスト

前提: ユーザーが「別テーマで security-tracer と同じ作り・形式・デザイン・UIの学習アプリ」を求めている。テーマ名を `<THEME>`、アプリ名を `<APP>` と書く。

## A. まず決めて、ユーザーに確認すること(1通にまとめる)
1. テーマと学習の目的(何ができるようになりたいか)、使う端末(iPhone中心か)。
2. 一次情報の候補(公的機関・公式ドキュメント・標準・法令)。**一次情報が乏しい分野は、このアプリ方式の価値が下がる**ので率直に伝える。
3. 更新が必要な分野か(ニュース画面・週次更新が要るか)。
4. 「注意枠」が必要か(医療・法律・金融などは必須)。
5. 公開範囲(個人用 noindex か公開か)、GitHub リポジトリ名、GitHub Pages を使うか。
6. 運用モード: 通常PR運用 / バイト方式(ユーザーが学びながらコードを書く)。
ユーザーが「任せる」と言ったら、推奨を決めて進め、どう読んだかを1行で伝える。

## B. 立ち上げ手順(上から)
1. リポジトリを作る(security-tracer をテンプレートにコピーする。履歴は引き継がない)。`.nojekyll` を必ず残す。
2. **全文置換する固有名**: `Security Tracer`/`SecTracer`/`sectracer`/`st.motion`/localStorage キー `sectracer.progress.v2`/ sw.js の `CACHE="sectracer-v5"`/ manifest の name・short_name・色/ index.html の title・description・apple-mobile-web-app-title/ アイコン(icon.svg、icon-180.png)/ README。グローバル名 `ST` は変えてもよいが、**変えるなら全ファイルで一括置換**し check.js も追随(変えない方が安全)。
3. 内容を空にする: `js/data/*.js` の配列を最小(コース1・レッスン2〜3・用語10・クイズ5・シナリオ0〜1)に。**構造・先頭コメント・末尾の `ST.TERM = …` 等の定型行は残す**。
4. widgets は `_kit.js` と、テーマに合う 1〜2 本だけ残す(packetsim は「シナリオ分岐」を使うなら残す)。他は削除し、index.html と sw.js の一覧、`ST.LAB_GROUPS`、色トークンを整理。
5. `node tools/check.js` → OK になるまで。`node tools/test.js` も通す。
6. Pages を有効化(**ユーザー操作**)→ 公開URLを iPhone の Safari で開き、「ホーム画面に追加」まで確認してもらう。
7. HANDOFF.md / ROADMAP.md / README.md を新テーマ用に書き直す(方針、運用ルール、ユーザーの好み)。
8. 内容を足すサイクルへ(05 の 6)。

## C. そのまま流用する(変更不要・変更最小)
- core.js 全体(進捗、スキルツリー、復習、引き継ぎコード、ウィジェット登録、ルーター)。localStorage キー名だけ変更。
- app.js(枠・タブ・SVGシンボル。タブ名とアイコンは差し替え可)。
- views.js の構造(home, courses, course, tree, lesson, lab, labitem, terms, term, quiz, news)。文言(「攻撃と防御を…」等)は置換。
- css/style.css の構造と全コンポーネント。トークンの色相のみ調整(ライト/ダーク3か所)。
- widgets/_kit.js、tools/check.js、tools/test.js、sw.js(キャッシュ名と一覧)、manifest 構造、`.nojekyll`。
- データのスキーマ(02)と、出典必須・確認日・`unconfirmed`・check.js の強制。
- 画面の注意書き文言(AIが作成した解説である旨、出典を確認すること)。**必ず残す**。

## D. 差し替える(テーマ固有)
- `ST.TERM_CATS`、`ST.LAB_GROUPS`(分野と色)、コース、レッスン、用語、クイズ、シナリオ、ニュースの更新元(views.js の OFFICIAL リンク集)。
- ホームの見出し・説明文・おすすめラボ(`featured` 配列のウィジェットid)・今日の用語。
- ホームの注意書き・「出典の種類」の表現(セキュリティは JPCERT/IPA。別テーマは該当する公的機関)。
- ブランドのアイコン(`app.js` 内のSVGロゴ、icon.svg、icon-180.png)、`--packet` などの強調色。
- `ST.CHECKED`(core.js 先頭、出典に確認日が無いときの既定日)。
- 例示の固有名(架空であること)。

## E. 削除または作り直し(セキュリティ固有)
- `js/redline.js`、`js/data/legal.js`(不正アクセス禁止法などの法的注意枠)。→ 必要なら「その分野の注意枠」を同じ形で作る。不要なら script・sw.js・views.js の `ST.legalBox` 呼び出しを削除。
- `js/widgets/battle.js`、`js/data/ops*.js`、`js/widgets/ops.js`(攻防対戦・攻防端末)。応用機能なので最初は不要。
- 攻撃シミュレーター(packetsim、scenarios.js)は、分岐型シナリオとして流用可能。用語「攻撃/防御」の語彙は置換。
- `vendor/sqljs`(SQLラボ用)。不要なら削除し、sw.js と check.js の対象から外れることを確認。

## F. 落とし穴(実際に起きたもの)
1. **`.nojekyll` を消すとスマホで動かない**(`_kit.js` が配信されない。「ST.segHtml is not a function」)。
2. index.html の script 追加と sw.js の SHELL 追加の**両方**を忘れる(オフラインで開けなくなる)。check.js が検出する。
3. ウィジェットの結果欄に `data-v` を使うと `ST.segHtml` のボタンと衝突する。`data-out` を使う。
4. localStorage キーが同じオリジンの別アプリと衝突する(GitHub Pages は `<user>.github.io` を共有)。
5. 一次情報の本文が取得できないとき(PDF切れ、条文取得不可)に、記憶で補って書いてしまう。→ 保留して ROADMAP に残す。
6. 見出しが 390px で単語の途中で折れる。`text-wrap:balance; word-break:auto-phrase` と、見出しの長さを短くする。
7. 統計カードなどが縦に大きく、主役のカードが1画面目に出ない。
8. GitHub の設定系 API(Pages 有効化など)は作業エージェントの権限外。ユーザーに画面操作を案内する。
9. 外部サイトへの curl はプロキシで止まる。確認は WebFetch。
10. 利用上限で予定タスクが止まる。再開は翌日の回。
11. マージ済みブランチ名の再利用は強制pushが必要で許可されない。
12. 作業ディレクトリの clone を `rm -rf` しない(既存 clone を使い回す環境がある)。

## G. 完成の目安(最初のリリース)
- コース1〜3・レッスン計6〜10・用語30前後・クイズ20前後・ラボ3〜5・出典すべて確認日つき・`node tools/check.js` OK・幅390pxの全ルートでエラー/横はみ出しなし・ライト/ダーク確認・iPhone Safari で「ホーム画面に追加」して起動・引き継ぎコードで2端末の進捗合算を確認。
- security-tracer は約1.5週間(2026-10-27〜11-10)で 12コース・45レッスン・31ラボ・用語86・クイズ約53問まで育った(HANDOFF 2026-11-04 時点の記載。現在値は要再確認)。最初から大きく作らず、毎日1〜2個ずつ足す。

## H. 引き継ぎ時に最初に読む順
README.md(この manual/)→ 対象リポジトリの HANDOFF.md → ROADMAP.md → `node tools/check.js` → 02(データを書くとき)→ 03(画面を作るとき)→ 04(内容を書く前に必ず)。
