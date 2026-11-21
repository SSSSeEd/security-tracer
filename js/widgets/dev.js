"use strict";
/* Dev basics: an API call (fictional, nothing is sent) and container run options (fictional, nothing is run).
   Status code meanings follow MDN; container options follow the Docker CLI reference and the OWASP Docker Security Cheat Sheet. */
(function (ST) {
  const esc = ST.esc;

  /* ---- API: request / response, and object-level authorization ---- */
  const ORDERS = {
    1001: { owner: "A", item: "ノートPC", note: "利用者A（あなた）の注文" },
    1002: { owner: "B", item: "ヘッドホン", note: "利用者B（他人）の注文" }
  };
  const CLASS = { 2: "2xx 成功", 4: "4xx クライアントエラー" };

  ST.widget("api-call", {
    title: "APIを呼ぶ：リクエストとレスポンス",
    group: "dev", name: "APIを呼んでみる", desc: "ステータスコードと、本人確認と権限確認の違い", order: 1,
    mount(el) {
      let token = "none", target = "1001", authz = false;
      el.innerHTML = `<p class="cap">架空の注文API（api.example.com）に、利用者Aとしてリクエストを送る模擬です。実際の通信はしません。データはすべて架空です。</p>
        <div class="eyebrow">利用者Aのトークン（ログインの証明）を付ける？</div>
        <div class="btns">${ST.segHtml("tok", [["none", "付けない"], ["a", "付ける"]], token)}</div>
        <div class="eyebrow" style="margin-top:6px">どの注文を見る？</div>
        <div class="btns">${ST.segHtml("tgt", [["1001", "自分の注文 1001"], ["1002", "他人の注文 1002"]], target)}</div>
        <label class="toggle"><input type="checkbox" id="ac-authz"><span>サーバーが「この注文は、リクエストした本人のものか」を毎回確認する<br><span class="d">オフ＝ログインさえしていれば、番号を変えるだけで他人の注文も返してしまう実装（説明用）</span></span></label>
        <div class="eyebrow">リクエスト</div><div class="hexbox" data-req style="white-space:pre-wrap"></div>
        <div class="eyebrow">レスポンス</div><div class="hexbox" data-res style="white-space:pre-wrap"></div>
        <div data-vd></div>`;
      const upd = () => {
        const o = ORDERS[target];
        let code, msg, body;
        if (token === "none") { code = 401; msg = "Unauthorized"; body = { error: "認証が必要です（有効なトークンがありません）" }; }
        else if (o.owner !== "A" && authz) { code = 403; msg = "Forbidden"; body = { error: "この注文を見る権限がありません" }; }
        else { code = 200; msg = "OK"; body = { id: +target, owner: "利用者" + o.owner, item: o.item }; }
        el.querySelector("[data-req]").textContent = `GET /orders/${target} HTTP/1.1\nHost: api.example.com\n${token === "a" ? "Authorization: （利用者Aのトークン）\n" : ""}Accept: application/json`;
        el.querySelector("[data-res]").innerHTML = `<b style="color:${code === 200 ? "var(--ok)" : "var(--attack)"}">HTTP/1.1 ${code} ${esc(msg)}</b>　<span class="cap">（${CLASS[Math.floor(code / 100)]}）</span>\n${esc(JSON.stringify(body, null, 2))}`;
        let v;
        if (code === 401) v = `<div class="verdict mid">401：まず「誰か」が分からない<p>本人確認（認証）ができていないので断られました。</p></div>`;
        else if (code === 403) { v = `<div class="verdict good">403：本人確認はできたが、権限がない<p>ログイン済みでも、他人のデータは見せない。要求のたびにオブジェクト（注文1件）単位で確かめるのが、OWASP API Security Top 10 の API1（オブジェクト単位の認可の不備）への基本の備えです。</p></div>`; ST.markLab("api-call"); }
        else if (o.owner !== "A") { v = `<div class="verdict bad">他人の注文が見えた（API1：オブジェクト単位の認可の不備）<p>ログインはしていても、「その注文を見てよいか」を確認していないと、番号を変えるだけで他人のデータが返ります。</p></div>`; ST.markLab("api-call"); }
        else v = `<div class="verdict good">200：成功<p>自分の注文なので、返してよいデータです。確認のスイッチをオンにして、他人の注文を見たときの違いを試してください。</p></div>`;
        el.querySelector("[data-vd]").innerHTML = v;
      };
      ST.wireSeg(el, "tok", x => { token = x; upd(); });
      ST.wireSeg(el, "tgt", x => { target = x; upd(); });
      el.querySelector("#ac-authz").onchange = e => { authz = e.target.checked; upd(); };
      upd();
    }
  });

  /* ---- Containers: run options and what a compromised app could reach ---- */
  ST.widget("ct-run", {
    title: "コンテナの起動オプション：乗っ取られたときの被害",
    group: "dev", name: "コンテナの権限", desc: "起動オプションで、侵入後の被害が変わる", order: 2,
    mount(el) {
      const OPT = {
        user: ["root以外のユーザーで実行する", "-u 1000:1000"],
        capdrop: ["capabilities をすべて外す", "--cap-drop all"],
        nonew: ["権限の追加取得を禁止する", "--security-opt=no-new-privileges"],
        ro: ["ファイルシステムを読み取り専用にする", "--read-only"],
        priv: ["--privileged を付ける（避けるべき）", "--privileged"],
        sock: ["docker.sock を渡す（避けるべき）", "-v /var/run/docker.sock:/var/run/docker.sock"]
      };
      const on = { user: true, capdrop: false, nonew: false, ro: false, priv: false, sock: false };
      el.innerHTML = `<p class="cap">架空のWebアプリ（イメージ名 example/webapp）を docker run で起動する模擬です。実際には何も実行しません。オプションを切り替えて、アプリに欠陥があって乗っ取られた場合を考えます。</p>
        ${Object.entries(OPT).map(([k, [l, f]]) => `<label class="toggle"><input type="checkbox" data-o="${k}"${on[k] ? " checked" : ""}><span>${esc(l)}<br><span class="d">${esc(f)}</span></span></label>`).join("")}
        <div class="eyebrow">起動コマンド（例示）</div><div class="hexbox" data-cmd style="white-space:pre-wrap;word-break:break-all"></div>
        <div data-risk style="display:grid;gap:6px"></div><div data-vd></div>`;
      const upd = () => {
        const parts = ["docker run -d --name web -p 8080:80"].concat(Object.keys(OPT).filter(k => on[k]).map(k => OPT[k][1]), ["example/webapp"]);
        el.querySelector("[data-cmd]").textContent = parts.join(" \\\n  ");
        const rows = [
          [on.user ? "ok" : "warn", on.user ? "コンテナ内の権限は一般ユーザー。権限昇格を狙われても、足がかりが小さい" : "コンテナ内で root のまま。OWASPは、非特権ユーザーでの実行が権限昇格を防ぐ最良の方法と述べている"],
          [on.priv ? "bad" : (on.capdrop ? "ok" : "warn"), on.priv ? "--privileged は、すべての Linux capabilities を与える。OWASPは使わないよう求めている" : on.capdrop ? "capabilities を全部外した。必要なものだけ --cap-add で戻す" : "capabilities は既定のまま。必要なものだけ残す形（--cap-drop all ＋ --cap-add）が推奨"],
          [on.sock ? "bad" : "ok", on.sock ? "docker.sock を渡すと、コンテナ内からDockerの操作窓口に届く。読み取り専用でマウントしても、APIが読み取り専用になるわけではない（OWASP）" : "docker.sock は渡していない"],
          [on.nonew ? "ok" : "warn", on.nonew ? "新しい権限の取得を禁止した（no-new-privileges）" : "no-new-privileges は未設定。OWASPは権限昇格の対策として推奨している"],
          [on.ro ? "ok" : "warn", on.ro ? "書き込み先を限定できる。書き換えや置き換えがしにくい" : "ファイルシステムは書き込み可能。書き込みが要らないなら読み取り専用にできる"]
        ];
        el.querySelector("[data-risk]").innerHTML = rows.map(([k, t]) => `<div class="hexbox" style="color:${k === "bad" ? "var(--attack)" : k === "ok" ? "var(--ok)" : "var(--ink)"}">${k === "bad" ? "× " : k === "ok" ? "○ " : "△ "}${esc(t)}</div>`).join("");
        const bad = on.priv || on.sock;
        el.querySelector("[data-vd]").innerHTML = bad
          ? `<div class="verdict bad">コンテナの外まで影響が広がるおそれ<p>${on.sock ? "docker.sock" : "--privileged"} があると、アプリの欠陥ひとつが、ホスト側の操作につながりかねません。コンテナの分離に頼る前提が崩れます。</p></div>`
          : (on.user && on.capdrop && on.nonew) ? `<div class="verdict good">必要最小限の権限<p>アプリが乗っ取られても、できることが狭くなります。ただし、アプリの欠陥そのものは別に直す必要があります。</p></div>`
          : `<div class="verdict mid">まだ余地がある<p>△の項目を整えると、被害をさらに狭められます。最小権限の考え方は、クラウドのIAMと同じです。</p></div>`;
        if (!bad && on.user && on.capdrop) ST.markLab("ct-run");
      };
      el.querySelectorAll("[data-o]").forEach(c => { c.onchange = () => { on[c.dataset.o] = c.checked; upd(); }; });
      upd();
    }
  });
})(ST);
