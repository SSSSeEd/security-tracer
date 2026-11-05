"use strict";
/* Password storage lab: the same leaked "user table" stored four ways (plaintext, SHA-256, salted SHA-256, PBKDF2),
   attacked with a tiny dictionary. All hashing is the browser's real Web Crypto; the data is fictional and nothing is sent anywhere. */
(function (ST) {
  const esc = ST.esc;
  const DICT = ["123456", "password", "qwerty", "letmein", "sakura2024", "iloveyou", "dragon", "monkey", "welcome", "admin"]; // 説明用の小さな辞書（実際の攻撃者はもっと大きい）
  const USERS = [{ u: "sato", p: "sakura2024" }, { u: "tanaka", p: "sakura2024" }, { u: "suzuki", p: "welcome" }];
  const ITERS = [["1000", "1,000"], ["10000", "1万"], ["100000", "10万"], ["600000", "60万"]];
  const bytes = hex => Uint8Array.from(hex.match(/../g).map(h => parseInt(h, 16)));
  const pbkdf2 = async (pw, saltHex, iter) => {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    return ST.hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bytes(saltHex), iterations: iter }, k, 256));
  };

  ST.widget("pwstore", {
    title: "パスワードの保存：平文からPBKDF2まで",
    group: "crypto", name: "パスワードの保存方式", desc: "ソルトと反復回数で、漏えい後の解析がどう変わるか", order: 1,
    mount(el) {
      el.innerHTML = `<p class="callout warn">データベースが漏えいした場面を想定した実験です。ユーザーとパスワードはすべて架空で、計算はこの端末の中だけで行います。</p>
        <div class="btns">${ST.segHtml("mode", [["plain", "平文"], ["sha", "SHA-256"], ["salt", "ソルト付き"], ["pbkdf2", "PBKDF2"]], "plain")}</div>
        <div data-iters hidden><div class="eyebrow" style="margin-top:8px">反復回数</div>${ST.segHtml("iter", ITERS, "100000")}</div>
        <div class="scroll-x"><table class="tbl" data-t></table></div>
        <div class="btns"><button class="btn primary" type="button" data-atk>漏えいしたDBを解析してみる</button></div>
        <div data-out aria-live="polite"></div>`;
      let mode = "plain", iter = 100000, run = 0;
      const t = el.querySelector("[data-t]"), out = el.querySelector("[data-out]"), btn = el.querySelector("[data-atk]");
      const salts = USERS.map(() => ST.hex(crypto.getRandomValues(new Uint8Array(16))));
      const stored = async () => Promise.all(USERS.map(async (x, i) => {
        if (mode === "plain") return x.p;
        if (mode === "sha") return await ST.sha256(x.p);
        if (mode === "salt") return salts[i] + "$" + await ST.sha256(salts[i] + x.p);
        return `${iter}$${salts[i]}$${await pbkdf2(x.p, salts[i], iter)}`;
      }));
      const draw = async () => {
        const my = ++run; out.innerHTML = ""; btn.disabled = false;
        el.querySelector("[data-iters]").hidden = mode !== "pbkdf2";
        const rows = await stored(); if (my !== run) return;
        t.innerHTML = `<thead><tr><th>ユーザー</th><th>保存される値</th></tr></thead><tbody>${USERS.map((x, i) => `<tr><td>${esc(x.u)}</td><td class="num" style="white-space:normal;overflow-wrap:anywhere;font-size:11px">${esc(rows[i])}</td></tr>`).join("")}</tbody>`;
      };
      /* The attacker only sees the stored values; passwords are recovered by guessing from DICT. */
      const attack = async () => {
        const my = ++run; btn.disabled = true; out.innerHTML = `<p class="cap">解析中…</p>`;
        const rows = await stored(); if (my !== run) return;
        const t0 = performance.now(); let hashes = 0; const found = [];
        if (mode === "plain") rows.forEach(r => found.push(r));
        else if (mode === "sha") { // one lookup table works for every user
          const table = {}; for (const w of DICT) { table[await ST.sha256(w)] = w; hashes++; }
          rows.forEach(r => found.push(table[r] || null));
        } else {
          for (let i = 0; i < USERS.length; i++) {
            const parts = rows[i].split("$"); let hit = null;
            for (const w of DICT) {
              if (my !== run) return;
              hashes++;
              const h = mode === "salt" ? await ST.sha256(parts[0] + w) : await pbkdf2(w, parts[1], iter);
              if (h === parts[parts.length - 1]) { hit = w; break; }
            }
            found.push(hit);
          }
        }
        if (my !== run) return;
        const ms = performance.now() - t0, n = found.filter(Boolean).length;
        const why = { plain: "保存された値がそのままパスワードです。計算は不要でした。", sha: "辞書の単語を1回ずつハッシュして作った対応表を、全ユーザーに使い回せました。satoとtanakaは同じ値なので、同時に分かります。", salt: "ソルトが違うので対応表は使えず、ユーザーごとに辞書を計算し直す必要があります。ただしSHA-256は1回の計算が非常に軽いため、まだ短時間で破られます。", pbkdf2: "ユーザーごとに、辞書の単語1つにつき反復回数ぶんの計算が必要です。回数を増やすと、解析にかかる時間もほぼ比例して伸びます。" }[mode];
        out.innerHTML = `<div class="verdict bad">${USERS.length}人中 ${n}人のパスワードを特定（辞書${DICT.length}語）<p>${esc(why)}</p></div>
          <dl class="kv"><dt>ハッシュ計算の回数</dt><dd>${hashes}回</dd><dt>この端末での所要時間（実測）</dt><dd>${ms < 1 ? "1ミリ秒未満" : ms < 1000 ? Math.round(ms) + "ミリ秒" : (ms / 1000).toFixed(1) + "秒"}</dd></dl>
          <ul class="cap" style="padding-left:1.2em">${USERS.map((x, i) => `<li>${esc(x.u)}：${found[i] ? "特定（" + esc(found[i]) + "）" : "辞書では特定できず"}</li>`).join("")}</ul>
          <p class="cap">※ 実測はこの端末1台での値で、辞書も10語だけの説明用です。専用の機材を使う実際の攻撃者はこれよりはるかに速く、辞書も大きいため、時間は端末や条件で大きく変わります。比較するのは「回数と時間の増え方」です。</p>
          ${mode === "pbkdf2" ? `<p class="cap">OWASP の Password Storage Cheat Sheet は、PBKDF2-HMAC-SHA256 の反復回数として <b>60万回</b>を挙げています。新しく選べるなら Argon2id が第一の推奨です（確認日は出典欄）。回数は、辞書が増えたぶんも含めて「正しいパスワードを確認する側が許せる時間」とのバランスで決めます。</p>` : ""}`;
        btn.disabled = false; ST.markLab("pwstore");
      };
      ST.wireSeg(el, "mode", v => { mode = v; draw(); });
      ST.wireSeg(el, "iter", v => { iter = +v; draw(); });
      btn.onclick = attack;
      draw();
    }
  });
})(window.ST);
