"use strict";
/* Cloud: public storage by misconfiguration, and how permission size decides the damage of a leaked key.
   Fictional bucket and resource names; nothing is fetched. */
(function (ST) {
  const esc = ST.esc;

  ST.widget("bucket", {
    title: "ストレージの公開設定：誰がファイルを読めるか",
    group: "cloud", name: "ストレージの公開設定", desc: "設定ひとつで全世界に公開される", order: 1,
    mount(el) {
      const FILES = [["customers.csv", "顧客名簿"], ["invoice-2026-10.pdf", "請求書"], ["logo.png", "ロゴ画像"]];
      el.innerHTML = `<div class="card" style="padding:12px;display:grid;gap:6px"><div class="eyebrow">バケット（架空）：example-corp-share</div>
          ${FILES.map(([f, d]) => `<div class="hexbox" style="display:flex;justify-content:space-between;gap:8px"><span>${esc(f)}</span><span class="cap">${esc(d)}</span></div>`).join("")}</div>
        <label class="toggle"><input type="checkbox" id="bk-pol"><span>バケットポリシーに「誰でも読み取り可（Principal: *）」を書いた<br><span class="d">共有を急いだ担当者が付けた、という想定</span></span></label>
        <label class="toggle"><input type="checkbox" id="bk-bpa" checked><span>ブロックパブリックアクセス（4つの設定すべて）をオン<br><span class="d">2023年4月以降に作られたバケットでは、最初からオン</span></span></label>
        <div><div class="eyebrow">インターネット上の第三者がURLを開くと</div><div data-res style="display:grid;gap:6px;margin-top:6px"></div></div>
        <div data-v></div>`;
      const upd = () => {
        const pol = el.querySelector("#bk-pol").checked, bpa = el.querySelector("#bk-bpa").checked, open = pol && !bpa;
        el.querySelector("[data-res]").innerHTML = FILES.map(([f]) => `<div class="hexbox">GET /${esc(f)} → ${open ? `<span style="color:var(--attack)">200 OK（読める）</span>` : `<span style="color:var(--ok)">403 Access Denied</span>`}</div>`).join("");
        el.querySelector("[data-v]").innerHTML = open
          ? `<div class="verdict bad">全世界に公開された<p>URLを知っている人、探し回る人の誰でも顧客名簿を読めます。公開する必要があるのはロゴのような一部のファイルだけでした。</p></div>`
          : pol ? `<div class="verdict good">ポリシーの書き間違いを打ち消した<p>ブロックパブリックアクセスは、公開につながるポリシーやACLより優先されます。設定ミスに備える安全装置です。</p></div>`
          : `<div class="verdict good">非公開のまま<p>公開の設定がなければ、許可された人だけが読めます。${bpa ? "" : "ただし安全装置がオフなので、次の設定ミスがそのまま公開につながります。"}</p></div>`;
        if (pol) ST.markLab("bucket");
      };
      el.querySelector("#bk-pol").onchange = upd;
      el.querySelector("#bk-bpa").onchange = upd;
      upd();
    }
  });

  /* Fictional account: an app that only needs to read one bucket. */
  const RES = [
    ["app-bucket の読み取り", "app"],
    ["他のバケット（顧客データ）の読み書き", "s3"],
    ["サーバーの作成・削除", "all"],
    ["利用者アカウントと権限の変更", "all"]
  ];
  const POL = {
    all: { label: "全権限（Action: *）", reach: ["app", "s3", "all"] },
    s3: { label: "ストレージ全部（s3:*）", reach: ["app", "s3"] },
    app: { label: "必要な分だけ（app-bucket の読み取り）", reach: ["app"] }
  };

  ST.widget("iam-key", {
    title: "IAMとアクセスキー：漏れたときの被害は権限で決まる",
    group: "cloud", name: "権限とキー漏えい", desc: "最小権限なら被害が小さく済む", order: 2,
    mount(el) {
      let pol = "all";
      el.innerHTML = `<p class="cap">架空のアプリは、app-bucket のファイルを読むだけです。このアプリ用のアクセスキーに、どこまで許可しますか。</p>
        <div class="btns">${ST.segHtml("pol", Object.entries(POL).map(([k, p]) => [k, p.label]), pol)}</div>
        <label class="toggle"><input type="checkbox" id="ik-leak"><span>アクセスキーをソースコードに書いたまま、公開リポジトリに push してしまった</span></label>
        <div data-r style="display:grid;gap:6px"></div><div data-out></div>`;
      const upd = () => {
        const leak = el.querySelector("#ik-leak").checked, reach = POL[pol].reach;
        el.querySelector("[data-r]").innerHTML = `<div class="eyebrow">${leak ? "キーを拾った攻撃者にできること" : "このキーでできること"}</div>` + RES.map(([n, k]) => {
          const can = reach.includes(k);
          return `<div class="hexbox" style="display:flex;justify-content:space-between;gap:8px"><span>${esc(n)}</span><span style="color:${can ? (leak ? "var(--attack)" : "var(--ink)") : "var(--muted)"}">${can ? "できる" : "拒否"}</span></div>`;
        }).join("");
        const v = el.querySelector("[data-out]");
        if (!leak) { v.innerHTML = pol === "app" ? `<div class="verdict good">最小権限<p>アプリに必要な操作だけを許可しています。</p></div>` : `<div class="verdict mid">権限が大きすぎる<p>アプリは使わない操作まで許可されています。漏れたときに何が起きるか、チェックを入れて確かめてください。</p></div>`; return; }
        ST.markLab("iam-key");
        v.innerHTML = (pol === "app" ? `<div class="verdict mid">被害は app-bucket の読み取りに限られる<p>それでも漏えいは漏えいです。</p></div>` : `<div class="verdict bad">${pol === "all" ? "アカウント全体を乗っ取られうる" : "顧客データまで読み書きされうる"}<p>キーの権限がそのまま攻撃者の権限になります。</p></div>`)
          + `<div class="callout warn" style="margin-top:8px">漏れたと気づいたら：まずキーを<b>無効化</b>し、そのキーで作られた一時的な認証情報も止め、ログ（CloudTrail など）で何をされたかを確かめます（AWSの手順）。無効化するまで、悪用されるおそれは残ります。</div>`;
      };
      ST.wireSeg(el, "pol", x => { pol = x; upd(); });
      el.querySelector("#ik-leak").onchange = upd;
      upd();
    }
  });
})(ST);
