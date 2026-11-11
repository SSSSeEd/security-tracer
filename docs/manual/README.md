# Security Tracer 方式 学習アプリ制作・運営マニュアル(別プロジェクトのエージェント向け)

作成: 2026-11-11 / 対象読者: 別テーマの学習・研修アプリ(例: 医療、会計、語学、資格試験)を、security-tracer とほぼ同じ作り・形式・デザイン・UI で作って運営するエージェント。人間向けの文章ではない。

## 事実の出どころ
- リポジトリ https://github.com/sssseed/security-tracer (main、2026-11-10 時点、PR #36 まで)。README.md / HANDOFF.md / ROADMAP.md / tools/check.js / tools/test.js / sw.js / css/style.css / js/*.js を直接読んで書いた。
- 共有フォルダ ui-note/ui-development.md(全プロジェクト共通のUI知見)、ui-shots/ のスクリーンショット(幅390px)、reviews/ の保守レビュー、Notion「運用ルール」。
- 推測は書かない。リポジトリの数字(コース数など)は日々増えるので、必ず自分で `git log` と `node tools/check.js` で現在値を確認すること。

## 最重要の方針(これを外すと別物になる)
1. **静的サイト・ビルドなし・素のJS・グローバル名前空間 `ST`**。npm もバンドラも使わない。`index.html` を開くだけで動く。
2. **iPhone の Safari を基準に設計**(幅390px)。ただし iPad/PC でも崩れない。
3. **データと表示を分ける**。内容は `js/data/*.js` の配列/オブジェクト、図解ラボは `js/widgets/*.js`、画面は `js/views.js`。内容を足すのにコアを触らない。
4. **出典がすべて**。解説・用語・クイズ・ニュースに出典キーが必須で、`tools/check.js` が機械的に強制する。出典で確認できないことは書かない(ハルシネーション対策の中心)。
5. **ログイン無し・サーバー無し**。進捗は localStorage、端末間は「引き継ぎコード」(コピー&ペースト)。
6. **見て動かして分かる**(Cisco Packet Tracer のシミュレーションモードが手本)。文章だけのレッスンにせず、レッスンの途中に操作できる図解ラボ(ウィジェット)を挟む。

## 文書の構成
| ファイル | 内容 |
|---|---|
| 01-architecture.md | ファイル構成、読み込み順、core.js の API、ルーター、進捗保存、スキルツリー、復習、PWA、公開 |
| 02-data-schemas.md | sources / terms / courses(lessons) / quiz / scenarios / news / widgets の正確なスキーマと書き方 |
| 03-design-ui.md | デザイントークン、レイアウト、コンポーネント、iPhone 対応、アニメーション、UI原則、画面一覧 |
| 04-accuracy-and-updates.md | ハルシネーション対策、出典運用、check.js、ニュース週次更新、毎日改善、法務・安全方針 |
| 05-operations.md | スレッド運用(窓口→Sonnet作業スレッド、HANDOFF)、PR運用、Notion記録、予算、定期タスク |
| 06-new-project-checklist.md | 流用する/差し替える/作り直す箇所のチェックリスト、立ち上げ手順、落とし穴 |

## 最短の使い方
1. 06 の「立ち上げ手順」を上から実行。
2. 作るもの(データ)は 02、見た目は 03 に従う。
3. 内容を書く前に 04 の出典ルールを必ず読む。
4. 運営(スレッド・記録)は 05。
