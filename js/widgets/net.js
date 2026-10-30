"use strict";
/* Network widgets: encapsulation, DNS, TCP handshake / SYN flood, firewall rule lab. */
(function (ST) {
  const esc = ST.esc;

  /* ---------- Encapsulation ---------- */
  ST.widget("encap", {
    title: "カプセル化：データが包まれていく様子",
    group: "net", name: "カプセル化", desc: "データがヘッダで包まれていく様子", order: 0,
    mount(el) {
      const L = [
        { k: "app", name: "アプリケーション層", proto: "HTTP", color: "var(--c3)", fields: [["メソッド", "GET"], ["パス", "/login"], ["Host", "shop.example"], ["Cookie", "session=8f3a…"]], seen: "WAF・アプリ自身" },
        { k: "tr", name: "トランスポート層", proto: "TCP", color: "var(--c2)", fields: [["送信元ポート", "51514"], ["宛先ポート", "443"], ["シーケンス番号", "1001"]], seen: "ファイアウォール" },
        { k: "net", name: "インターネット層", proto: "IP", color: "var(--c1)", fields: [["送信元IP", "192.0.2.10"], ["宛先IP", "198.51.100.20"], ["TTL", "64"]], seen: "ルーター・ファイアウォール" },
        { k: "link", name: "リンク層", proto: "Ethernet / Wi‑Fi", color: "var(--c5)", fields: [["宛先MAC", "00:00:5e:00:53:01"], ["送信元MAC", "00:00:5e:00:53:af"]], seen: "スイッチ・同じLAN内の機器" }
      ];
      let k = 1, tls = false, side = "send";
      el.innerHTML = `<div class="btns">${ST.segHtml("side", [["send", "送信側（包む）"], ["recv", "受信側（外す）"]], side)}<label class="toggle" style="padding:6px 10px"><input type="checkbox" id="encap-tls"><span>HTTPS（TLSで暗号化）</span></label></div>
        <div class="stage" style="padding:14px"><div data-bar style="display:flex;gap:2px;align-items:stretch;min-height:64px"></div></div>
        <div class="btns"><button class="btn small" type="button" data-a="prev">‹ 戻る</button><button class="btn small primary" type="button" data-a="next">次の層へ ›</button></div>
        <div data-info></div>`;
      const bar = el.querySelector("[data-bar]"), info = el.querySelector("[data-info]");
      const draw = () => {
        const applied = L.slice(0, k); // innermost first
        const outer = applied.slice().reverse();
        const seg = (l, label, grow) => `<div style="flex:${grow};min-width:0;background:${l.color};color:var(--surface);border-radius:6px;padding:6px 6px;font-size:11px;line-height:1.3;display:flex;flex-direction:column;justify-content:center;overflow:hidden"><b style="font-family:var(--f-mono);font-size:10px;white-space:nowrap">${esc(label)}</b></div>`;
        let html = outer.filter(l => l.k !== "app").map(l => seg(l, l.proto + "ヘッダ", 1)).join("");
        const tlsOn = tls && k >= 2;
        html += tlsOn ? `<div style="flex:3;min-width:0;border-radius:6px;padding:6px;background:repeating-linear-gradient(45deg,var(--ink),var(--ink) 6px,var(--muted) 6px,var(--muted) 12px);color:var(--surface);font-size:11px;display:flex;align-items:center;justify-content:center"><b style="background:var(--ink);padding:0 6px;border-radius:4px">TLSで暗号化されたHTTP</b></div>`
          : seg(L[0], "HTTPデータ", 3);
        if (k === 4) html += seg(L[3], "FCS", .6);
        bar.innerHTML = html;
        const cur = L[k - 1];
        const verb = side === "send" ? "付けました" : "読み取って外します";
        info.innerHTML = `<div class="card" style="padding:12px;border-left:4px solid ${cur.color}">
          <div class="eyebrow">${side === "send" ? "送信側" : "受信側"} · ${esc(cur.name)}</div>
          <p><b>${esc(cur.proto)}</b>${cur.k === "app" ? "のデータを作りました。" : "のヘッダを" + verb + "。"}${tlsOn && cur.k !== "app" ? " HTTPSでは、この層から見るとHTTPの中身は暗号化されていて読めません。" : ""}</p>
          <dl class="kv" style="margin-top:8px">${cur.fields.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${tlsOn && cur.k === "app" ? "（暗号化）" : esc(b)}</dd>`).join("")}</dl>
          <p class="cap" style="margin-top:8px">この層の情報を主に見る仕組み：${esc(cur.seen)}</p></div>`;
        el.querySelector('[data-a="prev"]').disabled = side === "send" ? k <= 1 : k >= 4;
        el.querySelector('[data-a="next"]').disabled = side === "send" ? k >= 4 : k <= 1;
        el.querySelector('[data-a="next"]').textContent = side === "send" ? "次の層へ ›" : "1層外す ›";
        if ((side === "send" && k === 4) || (side === "recv" && k === 1)) ST.markLab("encap");
      };
      el.querySelector('[data-a="next"]').onclick = () => { k += side === "send" ? 1 : -1; draw(); };
      el.querySelector('[data-a="prev"]').onclick = () => { k += side === "send" ? -1 : 1; draw(); };
      el.querySelector("#encap-tls").onchange = e => { tls = e.target.checked; draw(); };
      ST.wireSeg(el, "side", v => { side = v; k = v === "send" ? 1 : 4; draw(); });
      draw();
    }
  });

  /* ---------- DNS resolution ---------- */
  ST.widget("dns", {
    title: "DNS：名前からIPアドレスを調べる流れ",
    group: "net", name: "DNSとキャッシュポイズニング", desc: "名前解決の流れと偽の応答", order: 1,
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["first", "初めての問い合わせ"], ["cache", "2回目（キャッシュあり）"], ["poison", "キャッシュポイズニング"]], "first")}</div>
        <label class="toggle" data-dnssec hidden><input type="checkbox" id="dns-sec"><span>DNSSECで応答を検証する<br><span class="d">権威サーバーの署名を確かめ、偽の応答を捨てる</span></span></label><div data-seq></div>`;
      const actors = [{ id: "pc", label: "端末" }, { id: "rs", label: "キャッシュDNS" }, { id: "root", label: "ルート" }, { id: "tld", label: ".com" }, { id: "auth", label: "権威DNS" }];
      const base = [
        { f: "pc", t: "rs", label: "www.example.com?", note: "端末は、まず契約しているプロバイダや社内の**キャッシュDNSサーバー**に「www.example.com のIPアドレスは？」と問い合わせます。" },
        { f: "rs", t: "root", label: "問い合わせ", note: "キャッシュに答えがないので、キャッシュDNSサーバーは**ルートサーバー**から順にたどります。" },
        { f: "root", t: "rs", label: ".comはこちら", dash: 1, kind: "info", note: "ルートサーバーは答えそのものではなく、「.com を管理するサーバーに聞いて」と紹介します。" },
        { f: "rs", t: "tld", label: "問い合わせ", note: ".com（TLD）のサーバーに問い合わせます。" },
        { f: "tld", t: "rs", label: "example.comはこちら", dash: 1, kind: "info", note: "TLDサーバーは、example.com の**権威DNSサーバー**を紹介します。" },
        { f: "rs", t: "auth", label: "問い合わせ", note: "example.com の情報を管理している権威DNSサーバーに問い合わせます。" },
        { f: "auth", t: "rs", label: "192.0.2.80", dash: 1, kind: "ok", note: "権威DNSサーバーが答え（IPアドレス）を返します。キャッシュDNSサーバーは、この答えを決められた時間（TTL）だけ覚えておきます。※IPアドレスは説明用の例です。" },
        { f: "rs", t: "pc", label: "192.0.2.80", dash: 1, kind: "ok", note: "端末に答えが届き、そのIPアドレスに接続します。" }
      ];
      const cache = [base[0], { f: "rs", t: "rs", label: "キャッシュに有り", kind: "info", note: "さっき覚えた答えがまだ有効（TTL内）なので、外に問い合わせずに済みます。" }, Object.assign({}, base[7], { note: "すぐに答えが返ります。キャッシュのおかげでDNSは速く、負荷も小さくなっています。" })];
      const poison = sec => [base[0], base[1], base[2], base[3], base[4], base[5],
        { f: "auth", t: "rs", label: "偽: 203.0.113.66", dash: 1, kind: "attack", block: sec, note: sec ? "攻撃者が本物より先に偽の応答を大量に送り込みますが、**DNSSEC**の検証で署名が合わないため、キャッシュDNSサーバーは偽の応答を捨てます。（図では送信元を権威DNSの位置に描いていますが、実際は攻撃者が送信元を偽装して送っています）" : "攻撃者が、本物の応答より先に**偽の応答**を大量に送り込みます。送信元は権威DNSサーバーに偽装されています。条件がそろうと、キャッシュDNSサーバーは偽の答えを受け入れてしまいます。" },
        sec ? Object.assign({}, base[6], { note: "本物の応答だけが受け入れられます。" }) : { f: "rs", t: "rs", label: "偽の答えを記憶", kind: "attack", note: "偽のIPアドレスがキャッシュされ、TTLの間、同じサーバーを使う**すべての利用者**が偽サイトへ誘導されます。" },
        sec ? base[7] : { f: "rs", t: "pc", label: "203.0.113.66", dash: 1, kind: "attack", note: "利用者は正しいURLを入力したのに、偽サイトに接続してしまいます。URLを見ても気づけないのがこの攻撃の怖いところです。" }];
      const host = el.querySelector("[data-seq]");
      let mode = "first", player;
      const run = () => {
        const sec = el.querySelector("#dns-sec").checked;
        const steps = mode === "first" ? base : mode === "cache" ? cache : poison(sec);
        player && player.stop();
        player = ST.seq(host, { actors, steps, intro: mode === "poison" ? "攻撃者が偽のDNS応答を送り込む流れです。下のDNSSECをオンにすると結果が変わります。" : "端末が www.example.com にアクセスする前に、裏で行われる問い合わせです。",
          outro: mode === "poison" ? (sec ? "DNSSECの検証で偽の応答を拒否できた" : "攻撃成功：正しいURLでも偽サイトへ誘導される") : null, outroKind: mode === "poison" && !sec ? "bad" : "good", onDone: () => ST.markLab("dns") });
      };
      el.querySelector("#dns-sec").onchange = run;
      ST.wireSeg(el, "mode", v => { mode = v; el.querySelector("[data-dnssec]").hidden = v !== "poison"; run(); });
      run();
      return () => player && player.stop();
    }
  });

  /* ---------- TCP handshake & SYN flood ---------- */
  ST.widget("tcp", {
    title: "TCP：3ウェイハンドシェイクとSYNフラッド",
    group: "net", name: "TCPとSYNフラッド", desc: "3ウェイハンドシェイクと接続待ちの枯渇", order: 2,
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["hs", "3ウェイハンドシェイク"], ["flood", "SYNフラッド攻撃"]], "hs")}</div><div data-body></div>`;
      const body = el.querySelector("[data-body]");
      let player = null, timer = null;
      const hs = () => {
        body.innerHTML = `<div data-seq></div>`;
        player = ST.seq(body.querySelector("[data-seq]"), {
          actors: [{ id: "c", label: "クライアント" }, { id: "s", label: "サーバー" }],
          intro: "通信を始める前に、お互いの**初期シーケンス番号**を伝え合って確認します（数値は例）。",
          steps: [
            { f: "c", t: "s", label: "SYN seq=1000", note: "**SYN**：「接続したい。こちらの番号は1000から始めます」" },
            { f: "s", t: "c", label: "SYN-ACK seq=5000 ack=1001", dash: 1, kind: "info", note: "**SYN-ACK**：「1000は受け取った（次は1001をください）。こちらは5000から始めます」。サーバーはこの時点で、接続待ちの情報を記憶します。" },
            { f: "c", t: "s", label: "ACK seq=1001 ack=5001", note: "**ACK**：「5000を受け取った」。これで接続が確立します。" },
            { f: "c", t: "s", label: "データ 100バイト", kind: "ok", note: "以降はシーケンス番号でデータの順番や抜けを管理します。100バイト送ったら、次は1101番から。" },
            { f: "s", t: "c", label: "ACK ack=1101", dash: 1, kind: "ok", note: "受け取った分を確認応答で知らせます。届かなかったデータは再送されます。" }
          ], onDone: () => ST.markLab("tcp")
        });
      };
      const flood = () => {
        const SLOTS = 12;
        let q = [], cookies = false, t = 0, legitOk = 0, legitNg = 0;
        body.innerHTML = `<label class="toggle"><input type="checkbox" id="tcp-cookie"><span>SYN Cookieを有効にする<br><span class="d">接続待ちの情報を記憶せず、番号に埋め込んで返す</span></span></label>
          <div class="stage" style="padding:12px"><div class="eyebrow" style="margin-bottom:6px">サーバーの接続待ちキュー（${SLOTS}枠）</div><div data-q style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px"></div></div>
          <div class="btns"><button class="btn small primary" type="button" data-a="go">▶ 攻撃を開始</button><button class="btn small" type="button" data-a="stop">■ 停止</button></div><div data-v></div>`;
        const qEl = body.querySelector("[data-q]"), vEl = body.querySelector("[data-v]");
        const draw = () => {
          qEl.innerHTML = Array.from({ length: SLOTS }, (_, i) => { const x = q[i]; return `<div style="height:34px;border-radius:5px;display:grid;place-items:center;font-size:10px;font-family:var(--f-mono);${x ? (x.legit ? "background:var(--ok-soft);color:var(--ok)" : "background:var(--attack-soft);color:var(--attack)") : "background:var(--surface);color:var(--muted)"}">${x ? (x.legit ? "正規" : "偽装") : "空き"}</div>`; }).join("");
          vEl.innerHTML = `<dl class="kv"><dt>正規の利用者の接続</dt><dd>成功 ${legitOk} / 失敗 ${legitNg}</dd></dl>
            <p class="cap" style="margin-top:6px">${cookies ? "SYN Cookieでは、SYN-ACKを返すときにキューを使いません。正規の利用者がACKを返した時点で番号を検証して接続を作るため、偽装SYNでキューがあふれません。" : "攻撃者は送信元IPを偽装したSYNを大量に送ります。サーバーはSYN-ACKを返して最後のACKを待ちますが、偽装先からACKは返ってこないため、キューが埋まり、正規の利用者が接続できなくなります。"}</p>`;
        };
        const tick = () => {
          t++;
          q = q.filter(x => t - x.at < (x.legit ? 1 : 30));
          if (!cookies) for (let i = 0; i < 3; i++) if (q.length < SLOTS) q.push({ legit: false, at: t });
          if (t % 3 === 0) { if (cookies || q.length < SLOTS) { legitOk++; if (!cookies) q.push({ legit: true, at: t }); } else legitNg++; }
          draw();
        };
        body.querySelector("#tcp-cookie").onchange = e => { cookies = e.target.checked; q = q.filter(x => !(cookies && !x.legit)); draw(); };
        body.querySelector('[data-a="go"]').onclick = () => { clearInterval(timer); timer = setInterval(tick, ST.reduceMotion ? 300 : 450); ST.markLab("tcp"); };
        body.querySelector('[data-a="stop"]').onclick = () => clearInterval(timer);
        draw();
      };
      ST.wireSeg(el, "mode", v => { clearInterval(timer); player && player.stop(); v === "hs" ? hs() : flood(); });
      hs();
      return () => { clearInterval(timer); player && player.stop(); };
    }
  });

  /* ---------- Firewall rule lab ---------- */
  ST.widget("firewall", {
    title: "ファイアウォール：ルールを直して攻撃を止める",
    group: "net", name: "ファイアウォール演習", desc: "ルールを直して攻撃を止める", order: 3,
    mount(el) {
      // A small company: web server 10.0.0.10 (public HTTPS), DB 10.0.0.20 (internal only).
      let rules = [
        { id: 1, act: "allow", src: "any", dst: "10.0.0.10", port: "443", note: "Webサーバーへの HTTPS" },
        { id: 2, act: "allow", src: "any", dst: "any", port: "any", note: "（以前の担当者が追加）すべて許可" },
        { id: 3, act: "allow", src: "10.0.0.10", dst: "10.0.0.20", port: "5432", note: "WebサーバーからDBへ" },
        { id: 4, act: "deny", src: "any", dst: "any", port: "any", note: "それ以外はすべて拒否" }
      ];
      const pk = [
        { src: "203.0.113.5", dst: "10.0.0.10", port: "443", d: "外部の利用者 → Webサイト閲覧", want: "allow" },
        { src: "203.0.113.77", dst: "10.0.0.20", port: "5432", d: "外部 → データベースに直接接続", want: "deny" },
        { src: "198.51.100.9", dst: "10.0.0.10", port: "22", d: "外部 → SSH（パスワード総当たり）", want: "deny" },
        { src: "10.0.0.10", dst: "10.0.0.20", port: "5432", d: "Webサーバー → DB（正常な処理）", want: "allow" },
        { src: "198.51.100.30", dst: "10.0.0.10", port: "445", d: "外部 → ファイル共有（ワームの探索）", want: "deny" },
        { src: "203.0.113.8", dst: "10.0.0.10", port: "3389", d: "外部 → リモートデスクトップ", want: "deny" }
      ];
      const match = (r, p) => (r.src === "any" || r.src === p.src) && (r.dst === "any" || r.dst === p.dst) && (r.port === "any" || r.port === p.port);
      el.innerHTML = `<p class="cap">ルールは<b>上から順に</b>評価され、最初に一致したルールが適用されます。すべての攻撃を止め、正常な通信だけを通すように直してください。</p>
        <div class="scroll-x"><table class="tbl" data-rules></table></div>
        <div class="btns"><button class="btn small primary" type="button" data-a="run">▶ 通信を流す</button><button class="btn small" type="button" data-a="reset">↺ 初期状態</button></div>
        <div class="scroll-x"><table class="tbl" data-pk></table></div><div data-v></div>`;
      const init = JSON.parse(JSON.stringify(rules));
      let results = [], hi = -1;
      const drawRules = () => {
        el.querySelector("[data-rules]").innerHTML = `<thead><tr><th>#</th><th>動作</th><th>送信元</th><th>宛先</th><th>ポート</th><th>説明</th><th></th></tr></thead><tbody>${rules.map((r, i) => `<tr style="${hi === i ? "background:var(--packet-soft)" : ""}">
          <td class="num">${i + 1}</td>
          <td><button type="button" class="chip ${r.act === "allow" ? "ok" : "attack"}" data-act="${i}" style="border:0;cursor:pointer">${r.act === "allow" ? "許可" : "拒否"}</button></td>
          <td class="num">${esc(r.src)}</td><td class="num">${esc(r.dst)}</td><td class="num">${esc(r.port)}</td><td style="min-width:140px">${esc(r.note)}</td>
          <td style="white-space:nowrap"><button class="btn small" type="button" data-up="${i}" aria-label="上へ" ${i === 0 ? "disabled" : ""}>↑</button> <button class="btn small" type="button" data-del="${i}" aria-label="削除">✕</button></td></tr>`).join("")}</tbody>`;
        ST.$$("[data-act]", el).forEach(b => b.onclick = () => { const r = rules[+b.dataset.act]; r.act = r.act === "allow" ? "deny" : "allow"; results = []; drawAll(); });
        ST.$$("[data-up]", el).forEach(b => b.onclick = () => { const i = +b.dataset.up; [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; results = []; drawAll(); });
        ST.$$("[data-del]", el).forEach(b => b.onclick = () => { rules.splice(+b.dataset.del, 1); results = []; drawAll(); });
      };
      const drawPk = () => {
        el.querySelector("[data-pk]").innerHTML = `<thead><tr><th>通信</th><th>宛先ポート</th><th>結果</th><th>適用ルール</th></tr></thead><tbody>${pk.map((p, i) => { const r = results[i]; return `<tr><td style="min-width:170px">${esc(p.d)}<div class="date">${esc(p.src)} → ${esc(p.dst)}</div></td><td class="num">${esc(p.port)}</td>
          <td>${r ? `<span class="chip ${r.act === "allow" ? (p.want === "allow" ? "ok" : "attack") : (p.want === "deny" ? "ok" : "warn")}">${r.act === "allow" ? "通過" : "遮断"}${r.act !== p.want ? (p.want === "deny" ? "（攻撃が通過）" : "（正常な通信を遮断）") : ""}</span>` : "—"}</td><td class="num">${r ? (r.rule >= 0 ? "#" + (r.rule + 1) : "なし→拒否") : ""}</td></tr>`; }).join("")}</tbody>`;
        const done = results.length === pk.length;
        const bad = results.filter((r, i) => r.act !== pk[i].want).length;
        el.querySelector("[data-v]").innerHTML = done ? (bad === 0 ? `<div class="verdict good">すべて正しく処理できました<p>「すべて許可」のような広いルールが上にあると、その下のルールは意味を持ちません。必要な通信だけを許可し、最後にすべて拒否する形が基本です。</p></div>` : `<div class="verdict bad">${bad}件の通信が意図どおりに処理されていません<p>ヒント：#2の「すべて許可」はどこにあっても、それより下のルールを無効にします。削除するか拒否に変えてみましょう。</p></div>`) : "";
        if (done && bad === 0) ST.markLab("firewall");
      };
      const drawAll = () => { drawRules(); drawPk(); };
      el.querySelector('[data-a="run"]').onclick = async () => {
        results = [];
        for (let i = 0; i < pk.length; i++) {
          const ri = rules.findIndex(r => match(r, pk[i]));
          hi = ri; drawRules();
          results.push({ act: ri >= 0 ? rules[ri].act : "deny", rule: ri });
          drawPk(); await ST.sleep(380);
        }
        hi = -1; drawRules();
      };
      el.querySelector('[data-a="reset"]').onclick = () => { rules = JSON.parse(JSON.stringify(init)); results = []; drawAll(); };
      drawAll();
    }
  });
})(window.ST);
