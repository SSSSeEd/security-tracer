"use strict";
/* Cryptography widgets. All computations use the browser's Web Crypto API (real SHA-256, AES-GCM, RSA-OAEP, ECDSA). */
(function (ST) {
  const esc = ST.esc;
  const bits = hex => hex.split("").map(h => parseInt(h, 16).toString(2).padStart(4, "0")).join("");

  /* ---------- Hash / avalanche / salt ---------- */
  ST.widget("hash", {
    title: "ハッシュ関数：SHA-256 と雪崩効果",
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["ava", "雪崩効果"], ["salt", "パスワードとソルト"]], "ava")}</div><div data-body></div>`;
      const body = el.querySelector("[data-body]");
      const ava = () => {
        body.innerHTML = `<label class="field">入力A<input class="input" id="hash-a" value="SecurityTracer" autocomplete="off" spellcheck="false"></label>
          <label class="field">入力B（1文字だけ変えてみる）<input class="input" id="hash-b" value="SecurityTracer!" autocomplete="off" spellcheck="false"></label>
          <div><div class="eyebrow">SHA-256(A)</div><div class="hexbox" data-ha></div></div>
          <div><div class="eyebrow">SHA-256(B)</div><div class="hexbox" data-hb></div></div>
          <div class="stage" style="padding:10px"><div class="eyebrow" style="margin-bottom:6px">256ビットの比較（違うビットを色付け）</div><div data-grid style="display:grid;grid-template-columns:repeat(32,1fr);gap:1px"></div></div>
          <p data-sum class="cap"></p>`;
        const upd = async () => {
          const a = await ST.sha256(body.querySelector("#hash-a").value), b = await ST.sha256(body.querySelector("#hash-b").value);
          body.querySelector("[data-ha]").textContent = a;
          body.querySelector("[data-hb]").innerHTML = b.split("").map((c, i) => c === a[i] ? c : `<span class="d">${c}</span>`).join("");
          const ba = bits(a), bb = bits(b); let diff = 0;
          body.querySelector("[data-grid]").innerHTML = ba.split("").map((x, i) => { const d = x !== bb[i]; if (d) diff++; return `<i style="display:block;aspect-ratio:1;border-radius:1px;background:${d ? "var(--packet)" : "var(--line)"}"></i>`; }).join("");
          body.querySelector("[data-sum]").innerHTML = a === b ? "入力が同じなので、ハッシュ値も完全に同じです。" : `256ビット中 <b>${diff}ビット</b>（約${Math.round(diff / 2.56)}%）が違います。入力がわずかに違うだけで、出力の約半分のビットが変わるのが良いハッシュ関数の性質です。`;
          ST.markLab("hash");
        };
        body.querySelectorAll("input").forEach(i => i.oninput = upd); upd();
      };
      const salt = () => {
        const users = [{ u: "sato", p: "sakura2024" }, { u: "tanaka", p: "sakura2024" }, { u: "suzuki", p: "M9#kq!x2Lp" }];
        body.innerHTML = `<label class="toggle"><input type="checkbox" id="hash-salt"><span>ユーザーごとにソルトを付ける</span></label>
          <div class="scroll-x"><table class="tbl" data-t></table></div><div data-v></div>`;
        const rnd = () => ST.hex(crypto.getRandomValues(new Uint8Array(8)));
        const salts = users.map(rnd);
        const upd = async () => {
          const on = body.querySelector("#hash-salt").checked;
          const rows = await Promise.all(users.map(async (x, i) => ({ ...x, s: on ? salts[i] : "", h: await ST.sha256((on ? salts[i] : "") + x.p) })));
          body.querySelector("[data-t]").innerHTML = `<thead><tr><th>ユーザー</th><th>ソルト</th><th>保存される値 SHA-256(ソルト+パスワード)</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.u)}<div class="date">pw: ${esc(r.p)}</div></td><td class="num">${r.s || "—"}</td><td class="num" style="white-space:normal;overflow-wrap:anywhere;font-size:11px;${!on && r.p === "sakura2024" ? "color:var(--attack)" : ""}">${r.h}</td></tr>`).join("")}</tbody>`;
          body.querySelector("[data-v]").innerHTML = on ? `<div class="verdict good">同じパスワードでも保存される値が別々になりました<p>攻撃者は事前計算した対応表を使えず、ユーザーごとに計算し直す必要があります。実際のシステムでは、SHA-256を1回ではなく bcrypt・scrypt・Argon2 のような計算に時間がかかる方式を使います。</p></div>`
            : `<div class="verdict bad">satoとtanakaの値が同じです<p>ソルトがないと、同じパスワードは同じ値になります。漏えいした値をよく使われるパスワードのハッシュ値の一覧と照合されると、一気に元のパスワードが分かってしまいます。</p></div>`;
        };
        body.querySelector("#hash-salt").onchange = upd; upd();
      };
      ST.wireSeg(el, "mode", v => v === "ava" ? ava() : salt());
      ava();
    }
  });

  /* ---------- Symmetric / Asymmetric / Signature ---------- */
  ST.widget("crypto", {
    title: "暗号：共通鍵・公開鍵・デジタル署名（実際に計算）",
    mount(el) {
      el.innerHTML = `<div class="btns">${ST.segHtml("mode", [["sym", "共通鍵 (AES)"], ["asym", "公開鍵 (RSA)"], ["sig", "署名 (ECDSA)"]], "sym")}</div><div data-body></div>`;
      const body = el.querySelector("[data-body]");
      const enc = new TextEncoder(), dec = new TextDecoder();
      const actorRow = (l, r, mid) => `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;text-align:center;font-size:13px">
        <div class="card" style="padding:8px">${l}</div><div style="font-family:var(--f-mono);color:var(--packet)">${mid}</div><div class="card" style="padding:8px">${r}</div></div>`;
      const sym = async () => {
        body.innerHTML = actorRow("🔑 アリス<br><span class='cap'>鍵A</span>", "🔑 ボブ<br><span class='cap'>同じ鍵A</span>", "→ 暗号文 →") +
          `<label class="field">送る文章<input class="input" id="c-msg" value="明日10時に会議室Bで" autocomplete="off"></label>
          <div class="btns"><button class="btn small primary" type="button" data-a="enc">暗号化して送る</button><button class="btn small" type="button" data-a="wrong">別の鍵で復号してみる</button></div><div data-out></div>`;
        const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const raw = ST.hex(await crypto.subtle.exportKey("raw", key));
        let last = null;
        const out = body.querySelector("[data-out]");
        body.querySelector('[data-a="enc"]').onclick = async () => {
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(body.querySelector("#c-msg").value));
          const pt = dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
          last = { iv, ct };
          out.innerHTML = `<dl class="kv"><dt>共通鍵（256ビット）</dt><dd>${raw}</dd><dt>暗号文</dt><dd style="color:var(--packet)">${ST.hex(ct)}</dd><dt>ボブが復号</dt><dd style="color:var(--ok)">${esc(pt)}</dd></dl>
            <p class="cap" style="margin-top:8px">途中で盗み見られても、鍵がなければ意味のないバイト列にしか見えません。同じ文章でも毎回ランダムな値（IV）を使うため、暗号文は毎回変わります。課題は、この鍵をどうやって安全にボブへ渡すかです。</p>`;
          ST.markLab("crypto");
        };
        body.querySelector('[data-a="wrong"]').onclick = async () => {
          if (!last) return body.querySelector('[data-a="enc"]').click();
          try { await crypto.subtle.decrypt({ name: "AES-GCM", iv: last.iv }, other, last.ct); out.insertAdjacentHTML("beforeend", "<p>復号できてしまいました</p>"); }
          catch (e) { out.insertAdjacentHTML("beforeend", `<div class="verdict bad" style="margin-top:8px">別の鍵では復号できません<p>AES-GCMは改ざん検知の仕組みも持っているため、鍵が違ったり暗号文が1ビットでも書き換えられたりすると、復号自体が失敗します。</p></div>`); }
        };
      };
      const asym = async () => {
        body.innerHTML = `<p class="cap">鍵ペアを生成しています…</p>`;
        const kp = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
        const spki = ST.hex(await crypto.subtle.exportKey("spki", kp.publicKey));
        body.innerHTML = actorRow("アリス<br><span class='cap'>ボブの公開鍵で暗号化</span>", "ボブ<br><span class='cap'>自分の秘密鍵で復号</span>", "→ 暗号文 →") +
          `<div><div class="eyebrow">ボブの公開鍵（誰に見せてもよい）</div><div class="hexbox" style="max-height:72px;overflow:auto;font-size:11px">${spki}</div></div>
          <label class="field">送る文章<input class="input" id="c-msg2" value="カード番号の下4桁は1234" autocomplete="off"></label>
          <div class="btns"><button class="btn small primary" type="button" data-a="enc">公開鍵で暗号化</button></div><div data-out></div>`;
        body.querySelector('[data-a="enc"]').onclick = async () => {
          const ct = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, kp.publicKey, enc.encode(body.querySelector("#c-msg2").value));
          const pt = dec.decode(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, kp.privateKey, ct));
          body.querySelector("[data-out]").innerHTML = `<dl class="kv"><dt>暗号文</dt><dd style="color:var(--packet);font-size:11px">${ST.hex(ct).slice(0, 160)}…</dd><dt>秘密鍵で復号</dt><dd style="color:var(--ok)">${esc(pt)}</dd></dl>
            <p class="cap" style="margin-top:8px">公開鍵は配っても安全で、暗号化はだれでもできますが、復号できるのは秘密鍵を持つボブだけです。ただし公開鍵暗号は遅いため、TLSなどでは<b>共通鍵を安全に共有する</b>ために使い、データ本体は共通鍵暗号で暗号化します。</p>`;
          ST.markLab("crypto");
        };
      };
      const sig = async () => {
        const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        body.innerHTML = actorRow("発行者<br><span class='cap'>秘密鍵で署名</span>", "受け取った人<br><span class='cap'>公開鍵で検証</span>", "→ 文書＋署名 →") +
          `<label class="field">署名する文書<input class="input" id="c-doc" value="振込先：ミライ銀行 本店 普通 1234567" autocomplete="off"></label>
          <div class="btns"><button class="btn small primary" type="button" data-a="sign">署名する</button></div>
          <label class="field">受け取った文書（書き換えてから検証してみる）<input class="input" id="c-recv" autocomplete="off"></label>
          <div class="btns"><button class="btn small" type="button" data-a="ver">検証する</button></div><div data-out></div>`;
        let signature = null;
        body.querySelector('[data-a="sign"]').onclick = async () => {
          const d = body.querySelector("#c-doc").value;
          signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, enc.encode(d));
          body.querySelector("#c-recv").value = d;
          body.querySelector("[data-out]").innerHTML = `<dl class="kv"><dt>署名</dt><dd style="color:var(--packet);font-size:11px">${ST.hex(signature)}</dd></dl>`;
        };
        body.querySelector('[data-a="ver"]').onclick = async () => {
          if (!signature) return;
          const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, signature, enc.encode(body.querySelector("#c-recv").value));
          body.querySelector("[data-out]").insertAdjacentHTML("beforeend", ok ? `<div class="verdict good" style="margin-top:8px">検証成功：本人が作成し、改ざんされていません</div>` : `<div class="verdict bad" style="margin-top:8px">検証失敗：文書が書き換えられています<p>1文字でも変わるとハッシュ値が変わるため、署名と一致しなくなります。</p></div>`);
          ST.markLab("crypto");
        };
      };
      ST.wireSeg(el, "mode", v => ({ sym, asym, sig })[v]());
      sym();
    }
  });

  /* ---------- TLS 1.3 handshake ---------- */
  ST.widget("tls", {
    title: "TLS 1.3 ハンドシェイク",
    mount(el) {
      el.innerHTML = `<label class="toggle"><input type="checkbox" id="tls-mitm"><span>偽Wi‑Fiの攻撃者が自分の証明書で割り込む</span></label><div data-seq></div>`;
      let player;
      const run = () => {
        const mitm = el.querySelector("#tls-mitm").checked;
        player && player.stop();
        const steps = [
          { f: "c", t: "s", label: "ClientHello + 鍵共有", note: "ブラウザは対応する暗号方式と、鍵交換に使う値（key_share）を送ります。TLS 1.3では最初のメッセージで鍵交換を始めます。" },
          { f: "s", t: "c", label: "ServerHello + 鍵共有", dash: 1, kind: "info", note: "サーバーも鍵交換の値を返します。この時点で双方が同じ秘密を計算でき、以降のハンドシェイクは暗号化されます。" },
          mitm ? { f: "s", t: "c", label: "{Certificate} 偽の証明書", dash: 1, kind: "attack", note: "割り込んだ攻撃者は、本物のサーバーの秘密鍵を持っていないため、自分で作った証明書を出すしかありません。" }
            : { f: "s", t: "c", label: "{Certificate}", dash: 1, kind: "info", note: "サーバーは**証明書**を送ります。認証局が「この公開鍵は shop.example のもの」と署名したものです。" },
          mitm ? { f: "c", t: "c", label: "証明書の検証に失敗", kind: "attack", note: "ブラウザは、信頼する認証局の署名がない、またはドメイン名が一致しないことを検出し、**警告画面**を出して接続を止めます。ここで「続行」を押すと、攻撃者に通信を読まれてしまいます。" }
            : { f: "s", t: "c", label: "{CertificateVerify}", dash: 1, kind: "info", note: "サーバーは証明書の秘密鍵で、ここまでのやり取りに**署名**します。秘密鍵を持つ本物のサーバーにしか作れません。" },
          ...(mitm ? [] : [
            { f: "s", t: "c", label: "{Finished}", dash: 1, kind: "info", note: "ハンドシェイクの内容が改ざんされていないことを確認する値です。" },
            { f: "c", t: "c", label: "証明書と署名を検証", kind: "ok", note: "ブラウザは、証明書が信頼できる認証局の署名つきで、ドメイン名が一致し、有効期限内であることを確認します。" },
            { f: "c", t: "s", label: "{Finished}", kind: "ok", note: "ブラウザ側からも確認値を送り、ハンドシェイクが完了します。" },
            { f: "c", t: "s", label: "[HTTP 暗号化済み]", kind: "ok", note: "以降のHTTPの中身（ログイン情報やCookie）は、共通鍵で暗号化されて流れます。" }])
        ];
        player = ST.seq(el.querySelector("[data-seq]"), {
          actors: [{ id: "c", label: "ブラウザ" }, { id: "s", label: mitm ? "攻撃者(偽装)" : "サーバー", atk: mitm }],
          steps, intro: "{ } で囲んだメッセージは暗号化されて送られます（RFC 8446 の表記にならっています）。EncryptedExtensions など一部のメッセージは省略しています。",
          outro: mitm ? "証明書の警告で割り込みを検出できた。警告を無視しないことが大切" : "暗号化された安全な通信路ができた", outroKind: mitm ? "mid" : "good", onDone: () => ST.markLab("tls")
        });
      };
      el.querySelector("#tls-mitm").onchange = run;
      run();
      return () => player && player.stop();
    }
  });
})(window.ST);
