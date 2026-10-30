"use strict";
/* Authentication widgets: password strength, MFA methods against real-time phishing. */
(function (ST) {
  const esc = ST.esc;
  const COMMON = ["123456", "password", "123456789", "12345678", "12345", "qwerty", "abc123", "111111", "1234567", "password1", "iloveyou", "admin", "welcome", "letmein", "monkey", "dragon", "sunshine", "princess", "000000", "qwerty123", "1q2w3e4r", "sakura", "pokemon", "doraemon", "asdfgh", "zaq12wsx", "p@ssw0rd", "passw0rd", "test", "guest"];

  const fmt = sec => {
    if (!isFinite(sec) || sec > 3.15e7 * 1e9) return "10億年以上";
    const u = [[3.15e7 * 1e6, "百万年"], [3.15e7 * 1e4, "万年"], [3.15e7, "年"], [86400 * 30, "か月"], [86400, "日"], [3600, "時間"], [60, "分"], [1, "秒"]];
    for (const [s, l] of u) if (sec >= s) return `約${Math.round(sec / s).toLocaleString("ja-JP")}${l}`;
    return "一瞬（1秒未満）";
  };

  ST.widget("password", {
    title: "パスワードの強さを見積もる",
    group: "auth", name: "パスワード強度", desc: "長さと種類で破られるまでの目安", order: 0,
    mount(el) {
      el.innerHTML = `<p class="callout warn">実際に使っているパスワードは入力しないでください。計算はこの端末の中だけで行い、どこにも送信しません。</p>
        <label class="field">試すパスワード<input class="input" id="pw-in" type="text" value="sakura2024" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
        <div class="btns"><button class="btn small" type="button" data-ex="Tr0ub4dor&3">Tr0ub4dor&3</button><button class="btn small" type="button" data-ex="correct horse battery staple">英単語4つ</button><button class="btn small" type="button" data-ex="ねこ と こたつ と みかん の ふゆ">日本語の文</button><button class="btn small" type="button" data-ex="password1">password1</button></div>
        <div class="meter"><i data-m></i></div>
        <div data-out></div>`;
      const inp = el.querySelector("#pw-in"), out = el.querySelector("[data-out]"), m = el.querySelector("[data-m]");
      const upd = () => {
        const p = inp.value, len = [...p].length;
        let pool = 0;
        if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/[0-9]/.test(p)) pool += 10;
        if (/[^A-Za-z0-9\s぀-ヿ一-鿿]/.test(p)) pool += 33; if (/\s/.test(p)) pool += 1;
        if (/[぀-ヿ一-鿿]/.test(p)) pool += 100;
        const common = COMMON.includes(p.toLowerCase()) || COMMON.some(c => c.length >= 5 && p.toLowerCase().replace(/[0-9!@#$%^&*]+$/, "") === c);
        let bitsv = len && pool ? len * Math.log2(pool) : 0;
        if (common) bitsv = Math.min(bitsv, 10);
        if (/^(.)\1+$/.test(p)) bitsv = Math.min(bitsv, 8);
        const guesses = Math.pow(2, Math.max(0, bitsv - 1));
        const rows = [["オンライン攻撃（1秒に10回、ロックなしと仮定）", guesses / 10], ["漏えいした高速ハッシュをGPUで解析（1秒に100億回と仮定）", guesses / 1e10], ["漏えいした低速ハッシュ（bcrypt等、1秒に1万回と仮定）", guesses / 1e4]];
        const pct = Math.min(100, bitsv / 100 * 100);
        m.style.width = pct + "%"; m.style.background = bitsv < 40 ? "var(--attack)" : bitsv < 70 ? "var(--warn)" : "var(--ok)";
        out.innerHTML = `<dl class="kv"><dt>文字数</dt><dd>${len}</dd><dt>文字の種類の数（推定）</dt><dd>${pool}</dd><dt>推定エントロピー</dt><dd>${bitsv.toFixed(0)} ビット</dd></dl>
          <table class="tbl" style="margin-top:8px"><thead><tr><th>攻撃の条件</th><th>破られるまでの目安</th></tr></thead><tbody>${rows.map(([a, s]) => `<tr><td>${a}</td><td class="num">${fmt(s)}</td></tr>`).join("")}</tbody></table>
          <ul style="margin:10px 0 0;padding-left:1.2em;font-size:14px">
            <li>${common ? "❌ よく使われるパスワードの一覧に含まれています。辞書攻撃で最初に試されます。" : "✓ 代表的な「よく使われるパスワード」一覧には含まれていません（このツールの一覧は30件程度の簡易版です）。"}</li>
            <li>${len >= 15 ? "✓" : "△"} NIST SP 800-63B-4 は、パスワードだけで認証する場合 15文字以上を求めています（多要素認証の一部なら8文字以上）。</li>
            <li>記号を混ぜるより、<b>長くする</b>ほうが効果的です。「英単語4つ」や「日本語の文」と比べてみてください。</li>
            <li>どんなに強くても、<b>使い回すと</b>パスワードリスト攻撃で破られます。</li></ul>
          <p class="cap" style="margin-top:8px">※ 文字の種類と長さだけを使った単純なモデルです。単語の組み合わせや個人情報（名前・誕生日）を使ったパスワードは、実際にはこの見積もりより早く破られます。</p>`;
        ST.markLab("password");
      };
      inp.oninput = upd;
      ST.$$("[data-ex]", el).forEach(b => b.onclick = () => { inp.value = b.dataset.ex; upd(); });
      upd();
    }
  });

  ST.widget("auth", {
    title: "認証方式 vs リアルタイムフィッシング",
    group: "auth", name: "認証方式 vs フィッシング", desc: "SMSコードとパスキーの違い", order: 1,
    mount(el) {
      el.innerHTML = `<p class="cap">偽サイトに誘導されたとき、それぞれの認証方式は攻撃者に突破されるでしょうか。</p>
        <div class="pills" role="group" data-m>${[["pw", "パスワードのみ"], ["sms", "＋SMSコード"], ["totp", "＋認証アプリ"], ["pk", "パスキー"]].map(([v, l], i) => `<button type="button" data-v="${v}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div><div data-seq></div>`;
      const A = [{ id: "u", label: "あなた" }, { id: "f", label: "偽サイト", atk: true }, { id: "r", label: "本物のサイト" }];
      const S = {
        pw: [{ f: "u", t: "f", label: "ID・パスワード", note: "偽サイトでID・パスワードを入力してしまいます。" }, { f: "f", t: "r", label: "ID・パスワード", kind: "attack", note: "攻撃者はそれを本物のサイトに入力します。" }, { f: "r", t: "f", label: "ログイン成功", dash: 1, kind: "attack", note: "パスワードだけなら、そのまま乗っ取られます。" }],
        sms: [{ f: "u", t: "f", label: "ID・パスワード", note: "偽サイトでID・パスワードを入力します。" }, { f: "f", t: "r", label: "ID・パスワード", kind: "attack", note: "攻撃者はすぐに本物のサイトへ中継します。" }, { f: "r", t: "u", label: "SMSで確認コード", dash: 1, kind: "info", note: "本物のサイトが、あなたのスマホに確認コードを送ります。あなたからは「いつもどおり」に見えます。" }, { f: "u", t: "f", label: "確認コード", note: "偽サイトの画面に従って、届いたコードを入力してしまいます。" }, { f: "f", t: "r", label: "確認コード", kind: "attack", note: "有効期限内にコードを中継されます。" }, { f: "r", t: "f", label: "ログイン成功", dash: 1, kind: "attack", note: "**手で入力するコードは中継できる**ため、リアルタイムフィッシングでは突破されます。それでもパスワードだけより、攻撃の手間は大きく増えます。" }],
        totp: [{ f: "u", t: "f", label: "ID・パスワード", note: "偽サイトでID・パスワードを入力します。" }, { f: "f", t: "r", label: "ID・パスワード", kind: "attack", note: "攻撃者は本物のサイトへ中継します。" }, { f: "u", t: "f", label: "アプリの6桁コード", note: "認証アプリに表示された6桁のコードも、偽サイトに入力してしまいます。" }, { f: "f", t: "r", label: "6桁コード", kind: "attack", note: "コードは30秒ほど有効なので、その間に中継されます。" }, { f: "r", t: "f", label: "ログイン成功", dash: 1, kind: "attack", note: "SMSと同じく、**手で入力するコードはフィッシングに耐性がありません**（NIST SP 800-63B-4）。" }],
        pk: [{ f: "u", t: "f", label: "ログイン開始", note: "偽サイトでログインしようとします。" }, { f: "f", t: "u", label: "パスキーを要求", dash: 1, kind: "attack", note: "偽サイトがパスキーでの認証を求めます。" }, { f: "u", t: "u", label: "該当なし", kind: "ok", note: "ブラウザ（OS）は、**今いるサイトのドメイン**に登録されたパスキーだけを使います。偽サイトのドメイン用のパスキーは存在しないため、本物のサイト用の鍵で署名することはありません。" }, { f: "f", t: "r", label: "中継できる情報がない", kind: "attack", block: true, note: "攻撃者の手元には、本物のサイトで使える情報が何も残りません。パスワードも入力していないので盗まれません。" }]
      };
      let player;
      const run = v => { player && player.stop(); player = ST.seq(el.querySelector("[data-seq]"), { actors: A, steps: S[v], outro: v === "pk" ? "フィッシング耐性あり：偽サイトでは認証情報が使われない" : "突破される：入力した情報はそのまま中継できる", outroKind: v === "pk" ? "good" : "bad", onDone: () => ST.markLab("auth") }); };
      ST.$$("[data-m] button", el).forEach(b => b.onclick = () => { ST.$$("[data-m] button", el).forEach(x => x.setAttribute("aria-pressed", x === b)); run(b.dataset.v); });
      run("pw");
      return () => player && player.stop();
    }
  });
})(window.ST);
