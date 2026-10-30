"use strict";
/* Diffie-Hellman key exchange: paint-mixing analogy and small-number arithmetic. */
(function (ST) {
  const esc = ST.esc;

  ST.widget("dh", {
    title: "Diffie-Hellman鍵交換：秘密を送らずに同じ鍵を作る",
    group: "crypto", name: "Diffie-Hellman鍵交換", desc: "秘密を送らずに同じ鍵を作る", order: 2,
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["paint", "絵の具で考える"], ["num", "数で計算する"]], "paint")}</div><div data-body></div>`;
      const body = el.querySelector("[data-body]");
      const hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
      const mix = (...cs) => [0, 1, 2].map(i => cs.reduce((s, c) => s + c[i], 0) / cs.length);
      const sw = (c, label) => `<div style="text-align:center;min-width:64px"><div style="width:44px;height:44px;border-radius:50%;margin:0 auto 4px;border:1px solid var(--line);background:${hex(c)}"></div><div class="cap">${esc(label)}</div></div>`;
      const row = items => `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">${items.join("")}</div>`;
      const SECRETS = [["赤", [214, 48, 49]], ["青", [40, 90, 200]], ["緑", [30, 150, 80]], ["紫", [130, 50, 160]], ["茶", [120, 70, 30]]];
      const BASE = [240, 200, 40];

      const paint = () => {
        const pick = (id, def) => `<select class="input" id="${id}">${SECRETS.map(([n], i) => `<option value="${i}"${i === def ? " selected" : ""}>${n}</option>`).join("")}</select>`;
        body.innerHTML = `<p class="cap">共通の色（黄）は誰に見られてもよい公開情報です。混ぜた絵の具から元の色を取り出すのは難しい、という性質がポイントです。</p>
          <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
            <label class="field">アリスの秘密の色${pick("dh-a", 0)}</label><label class="field">ボブの秘密の色${pick("dh-b", 1)}</label></div>
          <div data-out style="display:grid;gap:10px"></div>`;
        const upd = () => {
          const [an, a] = SECRETS[+body.querySelector("#dh-a").value], [bn, b] = SECRETS[+body.querySelector("#dh-b").value];
          const A = mix(BASE, a), B = mix(BASE, b), sA = mix(BASE, a, b), sB = mix(BASE, b, a);
          body.querySelector("[data-out]").innerHTML = `
            <div class="card" style="padding:12px"><div class="eyebrow">① それぞれ「共通の色＋自分の秘密の色」を混ぜて送る</div>${row([sw(BASE, "共通（公開）"), sw(a, "アリス秘密:" + an), sw(A, "アリス→送信"), sw(b, "ボブ秘密:" + bn), sw(B, "ボブ→送信")])}</div>
            <div class="card" style="padding:12px"><div class="eyebrow">② 受け取った色に、自分の秘密の色を混ぜる</div>${row([sw(sA, "アリスが作った色"), sw(sB, "ボブが作った色")])}
              <div class="verdict good" style="margin-top:8px">${hex(sA) === hex(sB) ? "同じ色になりました。これが2人だけの共通鍵です。" : "色が一致しません"}</div></div>
            <div class="card" style="padding:12px"><div class="eyebrow">盗み見る人に見えるもの</div>${row([sw(BASE, "共通"), sw(A, "アリスの送信"), sw(B, "ボブの送信")])}
              <p class="cap" style="margin-top:6px">秘密の色そのものは一度も送られていません。見えた3色から共通鍵の色を作るには、混ぜた色から秘密の色を「分離」する必要があり、それが難しいことが安全性の根拠です。</p></div>`;
        };
        body.querySelectorAll("select").forEach(s => s.onchange = upd); upd();
      };

      const p = 23, g = 5;
      const pow = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = r * b % m; b = b * b % m; e >>= 1; } return r; };
      const num = () => {
        body.innerHTML = `<p class="cap">公開値：素数 p = ${p}、生成元 g = ${g}。秘密の数 a と b をスライダーで選んでください（説明用の小さな数です）。</p>
          <label class="field">アリスの秘密 a = <b data-av></b><input type="range" min="2" max="21" value="6" id="dh-na"></label>
          <label class="field">ボブの秘密 b = <b data-bv></b><input type="range" min="2" max="21" value="15" id="dh-nb"></label>
          <div data-out style="display:grid;gap:10px"></div>`;
        const upd = () => {
          const a = +body.querySelector("#dh-na").value, b = +body.querySelector("#dh-nb").value;
          body.querySelector("[data-av]").textContent = a; body.querySelector("[data-bv]").textContent = b;
          const A = pow(g, a, p), B = pow(g, b, p), sA = pow(B, a, p), sB = pow(A, b, p);
          body.querySelector("[data-out]").innerHTML = `<div class="card" style="padding:12px"><dl class="kv">
              <dt>アリスが送る A</dt><dd>g^a mod p = ${g}^${a} mod ${p} = ${A}</dd>
              <dt>ボブが送る B</dt><dd>g^b mod p = ${g}^${b} mod ${p} = ${B}</dd>
              <dt>アリスの計算</dt><dd>B^a mod p = ${B}^${a} mod ${p} = ${sA}</dd>
              <dt>ボブの計算</dt><dd>A^b mod p = ${A}^${b} mod ${p} = ${sB}</dd></dl>
              <div class="verdict good" style="margin-top:8px">共通鍵 = ${sA}（どちらも (g^a)^b = (g^b)^a になるため一致）</div></div>
            <div class="card" style="padding:12px"><div class="eyebrow">盗み見る人に見えるもの</div><p class="hexbox">p=${p}, g=${g}, A=${A}, B=${B}</p>
              <p class="cap" style="margin-top:6px">A から a を求める問題を「離散対数問題」と呼びます。p=23なら総当たりですぐ解けますが、実際には数千ビットの素数や楕円曲線（X25519など）を使うため、現実的な時間では解けません。</p></div>`;
        };
        body.querySelectorAll("input[type=range]").forEach(s => s.oninput = upd); upd();
      };
      ST.wireSeg(el, "mode", v => v === "num" ? num() : paint());
      paint();
    }
  });
})(ST);
