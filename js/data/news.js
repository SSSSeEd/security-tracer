"use strict";
/* News snapshot shipped with the site (works without the artifact database, e.g. on GitHub Pages).
   Updated weekly from JPCERT/CC and IPA primary sources. Newest first. */
ST.NEWS_STATIC = [
 {
  "id": "jpcert-at260034",
  "date": "2026-10-26",
  "org": "JPCERT/CC",
  "severity": "注意",
  "title": "Brotliの境界外書き込みの脆弱性（CVE-2026-111497）に関する注意喚起",
  "url": "https://www.jpcert.or.jp/at/2026/at260034.html",
  "summary": "HTTP通信などで使われる圧縮ライブラリBrotliのC言語実装に、細工した圧縮データの展開で異常終了・情報漏えい・任意のコード実行につながるおそれがある脆弱性。",
  "points": [
   "影響: v1.2.0〜v1.2.1未満、v1.1.0〜v1.1.1未満、v1.0.3〜v1.0.10未満",
   "修正版: v1.2.1、v1.1.1、v1.0.10（Googleが2026年10月21日に公開）",
   "Node.jsなどBrotliを組み込んだ製品は、各開発者の情報も確認が必要"
  ],
  "terms": [
   "oob-write",
   "patch",
   "vulnerability"
  ],
  "verifiedAt": "2026-10-27"
 },
 {
  "id": "php2shell-2026-10",
  "date": "2026-10-22",
  "org": "JPCERT/CC・IPA",
  "severity": "注意",
  "title": "PHPにおける複数の脆弱性（CVE-2026-109618、CVE-2026-109619：PHP2shell）",
  "url": "https://www.jpcert.or.jp/at/2026/at260033.html",
  "summary": "悪用されるとPHPの実行プロセスの権限で任意のコードを実行されるおそれがあるリモートコード実行の脆弱性。10月26日の更新で、悪用を主張する実証コードの公開や、悪用を試みる通信の観測報告が追記された。",
  "points": [
   "修正版: PHP 8.5.12、8.4.27、8.3.36、8.2.35 以降",
   "PHP 8.1以前には修正版が提供されないため、サポート対象バージョンへの移行が推奨されている",
   "緩和策（session.upload_progress.enabled=0）は特定の攻撃経路への対処で、根本対策は更新"
  ],
  "terms": [
   "rce",
   "patch",
   "vulnerability"
  ],
  "verifiedAt": "2026-10-27"
 },
 {
  "id": "ipa-ms-2026-10",
  "date": "2026-10-14",
  "org": "IPA",
  "severity": "緊急",
  "title": "Microsoft 製品の脆弱性対策について(2026年10月)",
  "url": "https://www.ipa.go.jp/security/security-alert/2026/1014-ms.html",
  "summary": "10月の定例セキュリティ更新。Windows シェルのセキュリティ機能のバイパスの脆弱性（CVE-2026-96951）は、Microsoft社が悪用の事実を確認済みと公表している。",
  "points": [
   "Windows Updateで至急更新を適用する",
   "組織では更新プログラムを早期に展開する"
  ],
  "terms": [
   "patch",
   "zeroday"
  ],
  "verifiedAt": "2026-10-27"
 },
 {
  "id": "jpcert-at260030",
  "date": "2026-10-08",
  "org": "JPCERT/CC",
  "severity": "注意",
  "title": "直近で相次いでいる国内組織における不正アクセスに関する注意喚起（10月23日更新）",
  "url": "https://www.jpcert.or.jp/at/2026/at260030.html",
  "summary": "2026年9月前後から、国内組織で不正アクセスによる個人情報等の漏えいが相次いでいる。既知脆弱性の探索、API経由の不正操作、MetabaseのSQLインジェクション（CVE-2026-72898）、Webシェル設置、AIペンテスト基盤の悪用などの手口が挙げられた。",
  "points": [
   "公開スマホアプリを解析してAPIの接続先やキーを特定する手口が報告されている",
   "APIごとのレート制限、許可された利用者・HTTPメソッドだけを受け付けるアクセス制御を推奨",
   "APIトークンには最小限の権限と有効期限を設定し、漏えい時にすぐ無効化できるようにする",
   "従業員向けシステムやBIツールなど、不特定多数のアクセスを想定していないシステムも点検対象"
  ],
  "terms": [
   "api-abuse",
   "rate-limit",
   "access-control",
   "sqli",
   "webshell"
  ],
  "verifiedAt": "2026-10-27"
 },
 {
  "id": "ipa-10threats-2026",
  "date": "2026-01-29",
  "org": "IPA",
  "severity": "情報",
  "title": "情報セキュリティ10大脅威 2026",
  "url": "https://www.ipa.go.jp/security/10threats/10threats2026.html",
  "summary": "組織向けの1位は「ランサム攻撃による被害」、2位「サプライチェーンや委託先を狙った攻撃」、3位「AIの利用をめぐるサイバーリスク」。個人向けは順位なしで10項目。",
  "points": [
   "個人向けには、フィッシング、サポート詐欺（偽警告）、スマホ決済の不正利用などが含まれる"
  ],
  "terms": [
   "ransomware",
   "supply-chain",
   "ddos",
   "bec",
   "phishing",
   "support-scam"
  ],
  "verifiedAt": "2026-10-27"
 }
];
