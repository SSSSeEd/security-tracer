"use strict";
/* SQL lab: a real SQLite (sql.js, WebAssembly) running in memory inside the page. Fictional bookstore data; nothing is sent anywhere.
   sql.js is bundled under vendor/sqljs/ and loaded only when this lab is opened. */
(function (ST) {
  const esc = ST.esc;
  let loading = null;
  const loadSql = () => loading || (loading = new Promise((ok, ng) => {
    const s = document.createElement("script");
    s.src = "vendor/sqljs/sql-wasm.js";
    s.onload = () => window.initSqlJs({ locateFile: f => "vendor/sqljs/" + f }).then(ok, ng);
    s.onerror = () => ng(new Error("sql.js を読み込めませんでした"));
    document.head.appendChild(s);
  }).catch(e => { loading = null; throw e; }));

  const SEED = `CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, category TEXT, price INTEGER, stock INTEGER);
INSERT INTO books VALUES (1,'ネットワークの地図','ネットワーク',2400,5),(2,'暗号のしくみ入門','暗号',2800,3),(3,'ログの読み方','運用',2200,0),(4,'Webの守り方','Web',3000,7),(5,'パスワードの話','認証',1800,12),(6,'鍵と錠前の歴史','暗号',2600,2);
CREATE TABLE orders (order_id INTEGER PRIMARY KEY, book_id INTEGER, qty INTEGER);
INSERT INTO orders VALUES (1,2,1),(2,5,2),(3,2,1),(4,4,1);`;
  const SAMPLES = [
    ["全部見る", "SELECT * FROM books;"],
    ["条件で絞る", "SELECT title, price FROM books WHERE category = '暗号';"],
    ["並べ替え", "SELECT title, price FROM books ORDER BY price DESC;"],
    ["集計", "SELECT category, COUNT(*) AS 冊数, SUM(stock) AS 在庫合計 FROM books GROUP BY category;"],
    ["結合", "SELECT books.title, orders.qty FROM orders JOIN books ON orders.book_id = books.id;"],
    ["追加 INSERT", "INSERT INTO books (title, category, price, stock) VALUES ('メモ用の本', '運用', 1500, 4);"],
    ["更新 UPDATE", "UPDATE books SET stock = stock + 10 WHERE id = 3;"],
    ["削除 DELETE", "DELETE FROM books WHERE stock = 0;"]
  ];
  const table = (cols, rows) => `<div class="scroll-x"><table class="tbl"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td class="num">${v === null ? "NULL" : esc(String(v))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">（0行）</td></tr>`}</tbody></table></div>`;

  ST.widget("sql", {
    title: "SQLを動かす：本物のSQLiteで体験",
    group: "web", name: "SQLを動かす（SQLite）", desc: "SELECT・INSERT・UPDATE・DELETE と、値の安全な渡し方", order: 20,
    mount(el) {
      el.innerHTML = `<p class="callout">ブラウザの中で本物の SQLite（WebAssembly）を動かします。データは架空の本屋で、この端末のメモリの中だけにあり、ページを開き直すと元に戻ります。</p>
        <div class="btns">${ST.segHtml("mode", [["free", "SQLを書く"], ["bind", "値の渡し方"]], "free")}</div><div data-body><p class="cap">SQLite を読み込み中…</p></div>`;
      const body = el.querySelector("[data-body]");
      let SQL, db;
      const reset = () => { if (db) db.close(); db = new SQL.Database(); db.run(SEED); };
      const showErr = (box, e) => { box.innerHTML = `<div class="verdict bad">エラー<p>${esc(e.message || String(e))}</p></div>`; };

      const free = () => {
        body.innerHTML = `<div class="btns">${SAMPLES.map(([l, q], i) => `<button class="btn small" type="button" data-s="${i}">${esc(l)}</button>`).join("")}</div>
          <label class="field">SQL（編集できます）<textarea class="input" id="sql-q" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" style="font-family:var(--f-mono);font-size:13px">${esc(SAMPLES[0][1])}</textarea></label>
          <div class="btns"><button class="btn primary" type="button" data-run>実行</button><button class="btn small" type="button" data-reset>↺ データを最初に戻す</button></div>
          <div data-res aria-live="polite"></div>
          <p class="cap">テーブルは books(id, title, category, price, stock) と orders(order_id, book_id, qty) の2つです。UPDATE や DELETE のあとは、もう一度 SELECT で中身を確かめてください。</p>`;
        const q = body.querySelector("#sql-q"), res = body.querySelector("[data-res]");
        body.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { q.value = SAMPLES[+b.dataset.s][1]; run(); });
        const run = () => {
          try {
            const out = db.exec(q.value), n = db.getRowsModified();
            res.innerHTML = (out.length ? out.map(r => `<div class="cap">${r.values.length}行</div>${table(r.columns, r.values)}`).join("") : `<div class="verdict good">実行しました<p>${/^\s*(insert|update|delete)/i.test(q.value) ? n + "行が変わりました。" : "表示する行はありません。"}</p></div>`);
            ST.markLab("sql");
          } catch (e) { showErr(res, e); }
        };
        body.querySelector("[data-run]").onclick = run;
        body.querySelector("[data-reset]").onclick = () => { reset(); res.innerHTML = `<p class="cap">データを最初の状態に戻しました。</p>`; };
      };

      /* Same search, two ways to pass the user's value: concatenation vs bound parameter (placeholder). */
      const bind = () => {
        body.innerHTML = `<p class="cap">本の題名で検索する画面を想定します。入力欄の値を、SQL文字列に<b>連結</b>する方法と、<b>プレースホルダ</b>で渡す方法を比べます。</p>
          <label class="field">検索する題名<input class="input" id="sql-t" value="パスワードの話" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
          <div class="btns"><button class="btn small" type="button" data-ex="パスワードの話">ふつうの入力</button><button class="btn small" type="button" data-ex="' OR '1'='1">細工した入力（学習用）</button></div>
          <div class="btns">${ST.segHtml("how", [["cat", "連結"], ["ph", "プレースホルダ"]], "cat")}</div>
          <div data-res aria-live="polite"></div>`;
        const inp = body.querySelector("#sql-t"), res = body.querySelector("[data-res]"); let how = "cat";
        const go = () => {
          const v = inp.value;
          try {
            let sql, rows;
            if (how === "cat") { sql = `SELECT title, price FROM books WHERE title = '${v}'`; const o = db.exec(sql); rows = o.length ? o[0].values : []; }
            else { sql = "SELECT title, price FROM books WHERE title = ?"; const st = db.prepare(sql); st.bind([v]); rows = []; while (st.step()) rows.push(st.get()); st.free(); }
            res.innerHTML = `<div class="eyebrow">実行されたSQL${how === "ph" ? "（? の位置に値が別に渡される）" : ""}</div><div class="hexbox">${esc(sql)}</div>
              ${how === "cat" && rows.length > 1 ? `<div class="verdict bad">全部の本が返りました<p>入力の ' がSQLの文字列の終わりとして解釈され、OR '1'='1' という条件が付け足されたためです。入力が「値」ではなく「SQLの一部」になっています。</p></div>` : how === "ph" && /'/.test(v) ? `<div class="verdict good">一致する題名がないので0行です<p>入力は最後まで「ただの値」として扱われ、SQLの構造は変わりません。</p></div>` : ""}
              ${table(["title", "price"], rows)}`;
            ST.markLab("sql");
          } catch (e) { showErr(res, e); }
        };
        inp.oninput = go;
        body.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { inp.value = b.dataset.ex; go(); });
        ST.wireSeg(body, "how", v => { how = v; go(); });
        go();
      };

      loadSql().then(S => { SQL = S; reset(); free(); ST.wireSeg(el, "mode", v => v === "free" ? free() : bind()); })
        .catch(e => { body.innerHTML = `<div class="verdict bad">SQLite を読み込めませんでした<p>${esc(e.message)}。オフラインで初めて開いた場合は、一度オンラインで開いてから試してください。</p></div>`; });
    }
  });
})(window.ST);
