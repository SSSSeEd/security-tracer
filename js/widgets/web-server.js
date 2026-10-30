"use strict";
/* More web vulnerabilities: OS command injection and SSRF. Everything is simulated; nothing is executed or fetched. */
(function (ST) {
  const esc = ST.esc;

  ST.widget("cmdi", {
    title: "OSコマンド・インジェクション：入力が命令になる",
    group: "web", name: "OSコマンド・インジェクション", desc: "入力がサーバーの命令になる", order: 3,
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["shell", "シェル経由（脆弱）"], ["args", "シェルを使わない（安全）"], ["allow", "許可リストで検査"]], "shell")}</div>
        <div class="card" style="padding:12px;display:grid;gap:8px">
          <div class="eyebrow">通信確認ツール（架空の管理画面）</div>
          <label class="field">確認したいホスト名<input class="input" id="ci-h" value="example.com" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
          <div class="btns"><span class="cap">入力例：</span><button class="btn small" type="button" data-ex="example.com">example.com</button><button class="btn small" type="button" data-ex="example.com; cat /etc/passwd">; でつなぐ</button><button class="btn small" type="button" data-ex="example.com &amp;&amp; rm -rf /tmp/data">&amp;&amp; でつなぐ</button></div></div>
        <div><div class="eyebrow">サーバー側で起きること</div><div class="hexbox" data-q style="white-space:pre-wrap"></div></div>
        <div data-res></div>`;
      let mode = "shell";
      const h = el.querySelector("#ci-h");
      const SEP = /(;|&&|\|\||\||`|\$\(|\n)/;
      const upd = () => {
        const v = h.value, q = el.querySelector("[data-q]"), res = el.querySelector("[data-res]");
        const verdict = (k, a, b) => res.innerHTML = `<div class="verdict ${k}">${a}<p>${b}</p></div>`;
        if (mode === "args") {
          q.innerHTML = `execFile("ping", ["-c", "1", <span style="color:var(--info)">${esc(JSON.stringify(v))}</span>])\n<span style="color:var(--muted)">// シェルを起動せず、入力全体を1つの引数として渡す</span>`;
          return SEP.test(v) ? verdict("good", "命令は1つだけ", "; や && はシェルが解釈する記号です。シェルを通さないので、入力全体がただの「ホスト名」として扱われ、そんな名前のホストはない、というエラーで終わります。")
            : verdict("good", "通常どおり動作", "ping が1回だけ実行されます。");
        }
        if (mode === "allow") {
          const ok = /^[A-Za-z0-9.-]{1,253}$/.test(v);
          q.innerHTML = `if (!/^[A-Za-z0-9.-]+$/.test(host)) reject()\n<span style="color:var(--muted)">// 英数字・ドット・ハイフン以外を含む入力は受け付けない</span>\n${ok ? "→ 許可" : `<span style="color:var(--attack)">→ 拒否</span>`}`;
          return ok ? verdict("good", "許可された文字だけなので実行", "保険的な対策として有効ですが、根本的にはシェルを使わない実装にするのが望ましいとされています。")
            : verdict("good", "実行前に拒否", "命令をつなぐ記号が含まれていたため、処理を止めました。");
        }
        const cmd = "ping -c 1 " + v, parts = v.split(SEP);
        q.innerHTML = `system("ping -c 1 " + host)\n→ sh -c "<span>ping -c 1 </span>${parts.map(p => SEP.test(p) ? `<b style="color:var(--attack)">${esc(p)}</b>` : `<span style="background:var(--packet-soft)">${esc(p)}</span>`).join("")}"`;
        const cmds = cmd.split(SEP).filter((p, i) => i % 2 === 0).map(s => s.trim()).filter(Boolean);
        if (cmds.length > 1) verdict("bad", `${cmds.length}つの命令が実行されてしまう`, `シェルが記号を「命令の区切り」と解釈し、入力の後半が独立した命令になります（シミュレーションです）：<br>${cmds.map((c, i) => `<code>${i + 1}. ${esc(c)}</code>`).join("<br>")}<br>ファイルの閲覧・削除、不正なプログラムのダウンロード、他のシステムへの踏み台などにつながります。`);
        else verdict("good", "命令は1つだけ", "この入力は問題ありません。入力例のボタンで、記号を含む入力を試してみてください。");
      };
      ST.wireSeg(el, "mode", v => { mode = v; upd(); });
      ST.$$("[data-ex]", el).forEach(b => b.onclick = () => { h.value = b.dataset.ex; upd(); });
      h.oninput = upd; upd();
    }
  });

  ST.widget("ssrf", {
    title: "SSRF：サーバーに内部へアクセスさせる",
    group: "web", name: "SSRF", desc: "サーバーに社内システムを見に行かせる", order: 4,
    mount(el) {
      const HOSTS = {
        "news.example": { ip: "203.0.113.10", internal: false, l: "外部のニュースサイト" },
        "intranet.example": { ip: "10.0.0.5", internal: true, l: "社内の管理画面" },
        "10.0.0.8": { ip: "10.0.0.8", internal: true, l: "社内のファイルサーバー" },
        "trick.example": { ip: "10.0.0.5", internal: true, l: "名前は外部風だが、名前解決すると社内のアドレス" }
      };
      el.innerHTML = `<p class="cap">架空のSNSの「URLを貼るとプレビューを表示する」機能です。プレビューを取りに行くのは、利用者のスマホではなく<b>サーバー</b>です。</p>
        <div class="def">
          <label class="toggle"><input type="checkbox" data-d="allow"><span>取得先を許可リストに限る<br><span class="d">あらかじめ決めたドメインだけにアクセスする</span></span></label>
          <label class="toggle"><input type="checkbox" data-d="ip"><span>名前解決したIPアドレスが社内向けなら拒否<br><span class="d">文字列ではなく、実際の接続先で判断する</span></span></label></div>
        <div class="btns">${Object.keys(HOSTS).map(k => `<button class="btn small" type="button" data-u="${k}">http://${k}/</button>`).join("")}</div>
        <div class="stage"><svg data-s viewBox="0 0 360 200" role="img" aria-label="SSRFの経路図"></svg></div>
        <div data-res aria-live="polite"></div>`;
      const svg = el.querySelector("[data-s]"), res = el.querySelector("[data-res]"), on = k => el.querySelector(`[data-d="${k}"]`).checked;
      const N = { u: { x: 40, y: 100, l: "利用者", i: "phone" }, fw: { x: 130, y: 100, l: "FW", i: "router" }, s: { x: 210, y: 100, l: "Webサーバー", i: "server" }, ext: { x: 320, y: 28, l: "外部サイト", i: "web" }, int: { x: 320, y: 160, l: "社内システム", i: "db" } };
      const draw = (path, color) => {
        let s = `<rect x="168" y="66" width="186" height="128" rx="10" fill="none" stroke="var(--line)" stroke-dasharray="5 4"/><text x="348" y="190" text-anchor="end" class="n-label" style="fill:var(--muted)">社内ネットワーク</text>`;
        s += [["u", "fw"], ["fw", "s"], ["s", "ext"], ["s", "int"]].map(([a, b]) => `<line x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}" class="lnk dash"/>`).join("");
        if (path) s += `<polyline points="${path.map(k => N[k].x + "," + N[k].y).join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
        Object.values(N).forEach(n => s += `<g transform="translate(${n.x} ${n.y})"><circle r="20" fill="var(--surface)" stroke="var(--line)"/><use href="#i-${n.i}" x="-12" y="-12" width="24" height="24" class="n-ico"/><text class="n-label" y="33" text-anchor="middle">${esc(n.l)}</text></g>`);
        svg.innerHTML = s;
      };
      const go = k => {
        const t = HOSTS[k], v = (c, a, b) => res.innerHTML = `<div class="verdict ${c}">${a}<p>${b}</p></div>`;
        const info = `<code>${esc(k)}</code> → ${t.ip}（${esc(t.l)}）`;
        if (on("allow") && k !== "news.example") { draw(["u", "fw", "s"], "var(--ok)"); return v("good", "許可リストにないので取得しない", info); }
        if (on("ip") && t.internal) { draw(["u", "fw", "s"], "var(--ok)"); return v("good", "接続先が社内向けアドレスなので拒否", info + "。名前解決した後のアドレスで判断しているので、外部風の名前でもだまされません。"); }
        if (!t.internal) { draw(["u", "fw", "s", "ext"], "var(--ok)"); return v("good", "通常のプレビュー", info); }
        draw(["u", "fw", "s", "int"], "var(--attack)");
        v("bad", "サーバーが社内システムにアクセスしてしまった", info + "。ファイアウォールは外からの直接アクセスを止めていますが、リクエストを送ったのは内側のWebサーバーなので通ってしまいます。内部の情報が読まれたり、内部ネットワークの調査に使われたりする恐れがあります。");
      };
      ST.$$("[data-u]", el).forEach(b => b.onclick = () => go(b.dataset.u));
      draw(null);
    }
  });
})(ST);
