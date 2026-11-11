# 03 デザイン・UI 方針

実装の正本は `css/style.css`(約34KB)。UI知見の蓄積は `/mnt/project-files/ui-note/ui-development.md`(全プロジェクト共通。作る前に読み、作った後に日付・プロジェクト名付きで**末尾に追記**する)。見本画像(幅390px・2倍解像度、2026-11-06撮影、進捗は初期状態): `/mnt/project-files/ui-shots/` の st-390-home.png / st-390-lesson.png / st-390-lab-tcp.png / st-390-tree.png / st-390-glossary.png。**新しい画面を作る前にこの5枚を見て、密度・余白・色づかいを揃える**。

## 1. 基本姿勢
- スマホ幅(390px)を基準に作り、横スクロールを出さない。広い画面は拡張として対応する。
- 飾りは最小限。読みやすさ優先。ただし「見た目で仕組みを想像できる」ことは重視(図解・動き)。
- 開いたら最初に答えを出す: ホーム最上段は「今日やること」カード(次のレッスン名・所要分・主ボタン「はじめる/続きから」・終わると何が開くか)。数字の統計はその下。
- 1画面に主役は1つ、ボタンは2〜3個まで、主ボタンは大きく(`.btn.primary.big` 高さ48px)。
- ユーザーの好み: 確認は最小限、作業は任せる、見た目で理解、コストを気にする、スマホで斜め読み(返信は短く)。

## 2. デザイントークン(`:root`)
```css
--bg --surface --sunken --ink --muted --line         /* 面と文字と罫線 */
--link --packet --attack --ok --warn --info          /* 意味色(リンク/注目/危険/安全/注意/情報) */
--attack-soft --ok-soft --warn-soft --packet-soft --info-soft --link-soft   /* 意味色の薄い背景 */
--c1 … --c12                                         /* 分野(コース)ごとの色 */
--f-body: "IBM Plex Sans JP", "Hiragino Sans", system-ui, sans-serif
--f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace
--r: 10px
```
- ライト値: bg #eef2f6 / surface #fff / ink #13202d / muted #566576 / line #cfd8e2 / link #0e6f68 / packet #c45a12 / attack #b42318 / ok #17803d。ダーク値: bg #0e151d / surface #16202b / ink #e4ebf2 / link #3bbfae / packet #f0954a / attack #f2705f / ok #4cc277(色は明るく振る)。
- **ダーク対応は3か所**: `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){…}}`、`:root[data-theme="dark"]{…}`、ライトの `:root`。分野色を足したら3か所すべてに値を足す。
- 別テーマでは **色相を変える**(例: ベースの緑〜青緑系 → 別系統)が、トークン名・構造・コントラスト比は維持。「攻撃=赤」「安全=緑」は意味色なので、別テーマでも「危険/誤り=赤、正しい=緑、注意=黄」として使い回すと学習UIとして一貫する。
- 本文 15px、行間 1.75、`text-wrap: balance`、`word-break: auto-phrase`(日本語の単語途中折り返しを減らす)。入力は 16px(iOSのズーム防止)。コードは mono。

## 3. レイアウト
- 構造: `header.top`(ブランド + 同期表示)/`main > .wrap#view`/`nav.tabs`(下部タブ)。`.wrap` は最大幅 1180px、縦に gap 18px。レッスン本文は `.reading`(最大 760px)。
- 下部タブは画面下固定の6タブ(アイコン + 10.5px ラベル)。**960px以上は左サイドレールに変形**(`nav.tabs` を縦並び固定、main に左パディング200px)。
- 幅の切替: 560px以下で統計を2列、820px以上で `.grid2` が2カラム、900px以上でラボの配置が広がる、横向き低高さ(`orientation:landscape` and `max-height:560px`)の専用調整(攻防対戦の戦場図を大きく)。
- **ノッチ・ホームバー対応**: `<meta viewport viewport-fit=cover>`、`env(safe-area-inset-top/bottom/left/right)` をヘッダ・本文・下部タブ・`:root` に適用。`apple-mobile-web-app-capable`、`theme-color` をライト/ダークで出し分け。
- タップ領域: `.btn` 最小高 42px(small は32px)、クイズの選択肢 48px。
- 動き: `prefers-reduced-motion: reduce` で `animation/transition` を全停止。さらにアプリ内「動き: 標準/ゆっくり/停止」切替(`ST.motion`)。「停止」でも結果は表示される。

## 4. コンポーネント(クラス名はそのまま流用できる)
- `.card` 白い面+罫線+角丸。`.eyebrow`(mono 11px 大文字の小見出し)、`.page-h`(eyebrow + h1)、`.lead`(説明)、`.section-h`。
- `.chip`(`.ok/.attack/.warn/.packet/.info`)、`.tag`、`.pills`(横スクロールの丸ボタン列)、`.filters`、`.seg`(切替ボタン)。
- `.list` + `.row`(アイコン/ドット + 本文 + 補足)。用語・ニュース・関連リンクの共通形。
- `.course`(路線図風カード: 左に色バー、`.stations` が○─○─●)、`.line-list`(レッスン一覧を地下鉄の路線のように縦線でつなぐ)、`.tree`/`.tree-tier`/`.tree-node`(スキルツリー画面。状態 done/open/locked)。
- `.stat`(統計の数字カード)、`.progressbar`、`.mastery`(理解度の3つの●)。
- `.callout`(`.info/.warn/.ok/.attack`)、`.keypoints`(左線付きの要点枠)、`.verdict`(`.good/.bad/.mid` 結果判定)、`.outcome`、`.notice`、`.verify`(「出典確認日…」の小注記)。
- ベンチ(ラボ枠): `.bench > .bench-h(.led + .eyebrow + LABチップ) + .bench-b`。中身に `.stage`(SVG領域)、`.btns`、`.toggle`(チェックボックス+説明 `.d`)、`.hexbox`(等幅の出力欄)、`.cap`(補足)、`.def`(防御トグル群)。SVGは `width:100%`、`viewBox` 固定(例 360×230)、テキストは `.svg-t/.svg-m`、ノードは `<symbol id="i-…">` を `<use>`(app.js 冒頭で定義)。
- 画面部品: `.gate`(ロック表示)、`.sources`(出典リスト: org + リンク)、`.sync`(右上に「この端末に保存」)。

## 5. 画面ごとの方針
- **ホーム**: 今日やること → 統計(レッスン n/N、ラボ、正答率、連続日数) → 復習(「今日の復習」「もうすぐ復習」) → 今日の用語 → おすすめラボ → 引き継ぎコード(折りたたみ気味、コピー/読み込み) → 注意書き(下記4章)。**改善候補(未対応)**: 見出しが390pxで単語途中で折れる、統計カード4枚が縦に大きく最初のレッスンカードが1画面目に収まりきらない → 同種のアプリでは最初から1画面目に主役が収まるよう統計を1行・小さくする。
- **学ぶ/レッスン**: 路線図風の一覧。レッスンは「文章 → 操作できるラボ → 文章」を交互に。完了ボタンは最下部、前後ナビ。
- **ラボ**: 分野別グリッド(`.lab-grid > .lab-card`)。各ラボは単独ページにもなる(#lab-<id>)。ロック時は理由と先に読むレッスンへのリンクを出す。
- **用語**: 検索 + 分類フィルタ + 一覧(理解度ドット付き)。詳細は 定義→仕組み→危険性→対策→関連ラボ→出典。
- **クイズ**: 1問ずつ、4択、解答後に「正解/不正解」チップ + 正解 + 解説 + 用語リンク。間違えた用語を優先出題。結果画面で復習すべき用語を並べる。
- **ニュース**: 重要度チップ(緊急/注意/情報) + 日付 + 発行元 + 原文リンク + 要点 + 関連用語 + 確認日。下に公式の情報源リンク集。
- **スキルツリー**: 前提の深さで段(tier)に分け、状態を色で示す。

## 6. UI原則(ui-development.md の共通ルールから、この種のアプリに効くもの)
1. スマホ幅基準、横スクロール禁止(`.scroll-x` で局所的に許可するのは図だけ)。
2. 最初に答え(今日何をするか)。数字は根拠として下に。
3. 数値は単独で出さず「いつもとの差」「n/N」で。
4. 主役は1つ、ボタンは少なく、親指が届く下側へ。
5. 文字と図形を重ねない。針のような飾りは避け、狭い幅で重なりを確認する(過去に走行ログビューアのゲージ針とラベルが重なって修正した)。
6. 入力は一度で済ませ、保存して次は差分だけ(進捗は自動保存。引き継ぎコードは合算)。
7. 機能が複数あるなら最初から画面(下タブ)に分ける。ただしタブ4つ+全部並べると「やる気が失せる」(別アプリで実際にあった指摘)。**最初は目的を1つに絞った画面**にする。
8. 売り切れ・未解放は「暗く + 理由の文言」で伝える。数字の「0回」のまま出さない。ロックなら何を先にやるかを出す。
9. 同じ操作は同じ見た目(ラボ共通の枠・部品)。新しい画面を作らず既存の操作画面を流用する方が、覚え直しが要らない。
10. 変化の前後を並べる(防御OFF→ON の結果差、Lv n → n+1)。押す前に結果が分かると良い。
11. 実機確認が要る機能(位置情報、外部通信)は最初に実機で確かめる。Claude側から押して確かめられない部分は、ユーザーの実機確認を依頼する。
12. 返信・報告は短く。

## 7. 検証手順(UIを変えたら必ず)
- ローカル: `python3 -m http.server 8765` → Playwright(Chromium事前導入済み)で **幅390px** の viewport、全ルート(#home #courses #course-… #l-… #tree #lab #lab-… #sim-… #terms #term-… #quiz #news)を巡回し、コンソールエラーと横はみ出し(`document.documentElement.scrollWidth > innerWidth`)が無いことを確認。
- スクリーンショットは deviceScaleFactor 2、幅390、`ui-shots/` に保存し、ui-development.md に追記。
- ライト/ダーク両方を目視(`emulateMedia({colorScheme:'dark'})`)。
- 外部サイトへの curl はプロキシで止まることがある。出典の確認は WebFetch を使う。
