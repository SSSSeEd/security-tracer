# sql.js（同梱）
- 由来: npm パッケージ `sql.js` 1.15.2 の `dist/sql-wasm.js` と `dist/sql-wasm.wasm`（無改変）
- ライセンス: sql.js は MIT（LICENSE を参照）。中身の SQLite はパブリックドメイン（https://www.sqlite.org/copyright.html）
- 用途: SQLラボ（js/widgets/web-sql.js）が、開いたときだけ読み込む。外部サーバーとは通信しない。
- 更新するときは、ファイルを差し替えて sw.js のキャッシュ名を上げる。
