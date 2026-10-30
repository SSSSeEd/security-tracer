"use strict";
/* Smartphone threats: malicious apps / configuration profiles, and SIM swap. Everything is simulated with fictional names. */
(function (ST) {
  const esc = ST.esc;

  /* Permissions the IPA report lists for the fake delivery app (2018-08-08). */
  const PERMS = [
    ["SMSの送受信・読み取り", "あなたの端末から、知らない宛先へ同じ偽SMSを大量に送れる。届いた認証コードも読める。"],
    ["連絡先の読み取り", "電話帳を外部に送れる。知人が次の標的になる。"],
    ["録音", "マイクで周囲の音を録れる。"],
    ["画面ロックの無効化", "端末のロックを外して、不正な操作をしやすくする。"]
  ];

  ST.widget("app-perm", {
    title: "不正アプリと構成プロファイル：SMSのリンクから入り込む",
    group: "mobile", name: "不正アプリの入り口", desc: "偽SMSから不正アプリ・構成プロファイルへ", order: 1,
    mount(el, o) {
      let os = o.os === "iphone" ? "iphone" : "android";
      el.innerHTML = `<div class="btns">${ST.segHtml("os", [["android", "Android"], ["iphone", "iPhone"]], os)}</div>
        <div class="card" style="padding:12px;display:grid;gap:6px">
          <div class="eyebrow">SMS（架空の例）</div>
          <div>お荷物をお届けに上がりましたが不在のため持ち帰りました。こちらからご確認ください。<span style="color:var(--info);text-decoration:underline">https://example-delivery.invalid/</span></div>
        </div>
        <div data-body style="display:grid;gap:10px"></div>`;
      const body = el.querySelector("[data-body]");
      const verdict = (k, a, b) => `<div class="verdict ${k}">${a}<p>${b}</p></div>`;
      const android = () => {
        body.innerHTML = `<label class="toggle"><input type="checkbox" id="ap-unk"><span>「提供元不明のアプリ」のインストールを許可している<br><span class="d">初期状態はオフ。IPAはオフのままにすることを勧めている</span></span></label>
          <button class="btn primary" type="button" data-go>リンク先で「アプリをダウンロード」をタップ</button><div data-res style="display:grid;gap:10px"></div>`;
        const res = body.querySelector("[data-res]");
        body.querySelector("#ap-unk").onchange = () => res.innerHTML = "";
        body.querySelector("[data-go]").onclick = () => {
          if (!body.querySelector("#ap-unk").checked) {
            res.innerHTML = verdict("good", "インストールがブロックされた", "公式ストア以外のアプリなので警告が出ました。ここで先へ進まずキャンセルすれば、被害は起きません。");
            return ST.markLab("app-perm");
          }
          res.innerHTML = `<div class="card" style="padding:12px;display:grid;gap:8px"><div class="eyebrow">インストール画面：「配送のお知らせ」（架空）が求める権限</div>
            ${PERMS.map(([n, d]) => `<details><summary>${esc(n)}</summary><p class="cap" style="margin-top:4px">${esc(d)}</p></details>`).join("")}</div>
            <div class="btns"><button class="btn" type="button" data-a="cancel">キャンセル</button><button class="btn" type="button" data-a="install" style="color:var(--attack)">インストール</button></div><div data-v></div>`;
          const v = res.querySelector("[data-v]");
          res.querySelector('[data-a="cancel"]').onclick = () => { v.innerHTML = verdict("good", "思いとどまった", "荷物の確認に、アプリを入れる必要はありません。配送状況は公式アプリや公式サイトで確かめます。"); ST.markLab("app-perm"); };
          res.querySelector('[data-a="install"]').onclick = () => { v.innerHTML = verdict("bad", "不正アプリが動き始めた", "IPAに寄せられた事例では、端末から知らない宛先へ同じSMSがばらまかれ、身に覚えのないキャリア決済の請求も報告されています。すぐ機内モードにしてアプリを消し、初期化とパスワード変更を検討します。"); ST.markLab("app-perm"); };
        };
      };
      const iphone = () => {
        body.innerHTML = `<div class="callout info">iPhoneは原則として App Store 以外からアプリを入れられません。そこで攻撃者は、設定をまとめて変える<b>構成プロファイル</b>のインストールに誘導することがあります。</div>
          <div class="card" style="padding:12px;display:grid;gap:8px;text-align:center"><div class="eyebrow">リンク先で表示される確認画面（例示）</div>
            <div style="font-weight:700">このWebサイトは構成プロファイルをダウンロードしようとしています。許可しますか？</div>
            <div class="btns" style="justify-content:center"><button class="btn" type="button" data-a="ignore">無視</button><button class="btn" type="button" data-a="allow" style="color:var(--attack)">許可してインストール</button></div></div>
          <div data-v></div>`;
        const v = body.querySelector("[data-v]");
        body.querySelector('[data-a="ignore"]').onclick = () => { v.innerHTML = verdict("good", "閉じて終わり", "IPAは、インストール画面が出たら「無視」や「キャンセル」で閉じるよう勧めています。"); ST.markLab("app-perm"); };
        body.querySelector('[data-a="allow"]').onclick = () => { v.innerHTML = verdict("bad", "端末の設定が書き換えられたおそれ", "IPAの事例では、インストール後に Apple ID を入力させるフィッシングサイトへ誘導されました。設定の変更や、端末の固有情報が外部へ送られる可能性も指摘されています。IPAは、機内モードにしてから初期化し、プロファイルを入れた後のバックアップは使わないよう勧めています。"); ST.markLab("app-perm"); };
      };
      const draw = () => os === "iphone" ? iphone() : android();
      ST.wireSeg(el, "os", x => { os = x; draw(); });
      draw();
    }
  });

  ST.widget("simswap", {
    title: "SIMスワップ：電話番号ごと乗っ取られる流れ",
    group: "mobile", name: "SIMスワップ", desc: "認証コードを聞き出して電話番号を奪う", order: 2,
    mount(el) {
      el.innerHTML = `<label class="toggle"><input type="checkbox" id="ss-def"><span>電話で聞かれても、SMSのワンタイムパスワードを教えない</span></label><div data-seq></div>`;
      let player;
      const run = () => {
        const def = el.querySelector("#ss-def").checked;
        player && player.stop();
        const steps = [
          { f: "a", t: "u", label: "偽メール→ID・パスワード", kind: "attack", dash: 1, note: "まずフィッシングメールで、携帯会社のサイトのIDとパスワードを盗みます。" },
          { f: "a", t: "u", label: "「携帯会社の者です」", kind: "attack", note: "携帯会社を名乗って電話をかけ、SMSに届いた**ワンタイムパスワード**を読み上げさせようとします。" },
          ...(def ? [
            { f: "u", t: "a", label: "教えない", block: 1, kind: "ok", note: "ワンタイムパスワードは、本人がその場で入力するためのものです。電話で人に伝える場面はありません。" },
            { f: "u", t: "m", label: "公式窓口に直接確認", kind: "ok", note: "不審な電話やSMSは、自分で調べた公式の番号やサイトで携帯会社に確かめます。" }
          ] : [
            { f: "u", t: "a", label: "コードを読み上げる", kind: "attack", note: "聞き出したコードと盗んだパスワードで、攻撃者は携帯会社のサイトにログインします。" },
            { f: "a", t: "m", label: "SIMの再発行を申し込む", kind: "attack", note: "本人になりすまして再発行の手続きを進めます。別のワンタイムパスワードも同じように聞き出します。" },
            { f: "m", t: "a", label: "新しいSIM（あなたの番号）", kind: "attack", dash: 1, note: "電話番号が攻撃者のSIMに移ります。" },
            { f: "u", t: "u", label: "圏外・SIMを認識しない", kind: "attack", note: "利用者のスマホは急に圏外になり、電話もモバイル通信も使えなくなります。気づくきっかけになりやすい変化です。" },
            { f: "a", t: "b", label: "SMS認証を受け取って侵入", kind: "attack", note: "以後、SMSで届く認証コードは攻撃者に届きます。パスワードの再設定や二要素認証を通り抜け、銀行口座などが悪用されます。" }
          ])
        ];
        player = ST.seq(el.querySelector("[data-seq]"), {
          actors: [{ id: "a", label: "攻撃者", atk: 1 }, { id: "u", label: "利用者" }, { id: "m", label: "携帯会社" }, { id: "b", label: "銀行など" }],
          steps, intro: "警察や銀行が注意を呼びかけている手口を、架空の登場人物で再現しています。",
          outro: def ? "コードを渡さなければ、電話番号は移せない" : "電話番号を奪われると、SMSに頼る認証はまとめて破られる", outroKind: def ? "good" : "mid", onDone: () => ST.markLab("simswap")
        });
      };
      el.querySelector("#ss-def").onchange = run;
      run();
      return () => player && player.stop();
    }
  });
})(ST);
