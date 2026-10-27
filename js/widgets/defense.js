"use strict";
/* Defense widgets: defense in depth, log analysis game, phishing judgment game, kill chain. */
(function (ST) {
  const esc = ST.esc;

  /* ---------- Defense in depth ---------- */
  ST.widget("layers", {
    title: "多層防御：対策を重ねるとリスクが減っていく",
    mount(el) {
      const L = [["mail", "メールフィルタ"], ["web", "危険サイトの遮断"], ["train", "利用者の訓練"], ["upd", "OS・機器の更新"], ["mfa", "多要素認証・パスキー"], ["edr", "EDR（端末監視）"], ["seg", "ネットワーク分割"], ["bk", "オフラインバックアップ"]];
      // Illustrative weights: how much each layer reduces the remaining chance of the attack reaching its goal.
      const ATK = [
        { n: "添付ファイル型マルウェア", w: { mail: .6, train: .4, upd: .5, edr: .6, seg: .2, bk: .3 } },
        { n: "フィッシングでID・パスワード窃取", w: { web: .5, train: .5, mfa: .8, mail: .3 } },
        { n: "VPN機器の既知の脆弱性", w: { upd: .9, mfa: .3, seg: .4, edr: .3, bk: .3 } },
        { n: "ゼロデイ脆弱性（修正前）", w: { edr: .5, seg: .4, web: .2, bk: .3 } },
        { n: "ランサムウェアの横展開", w: { seg: .6, edr: .5, mfa: .3, bk: .6 } }
      ];
      const on = new Set(["upd"]);
      el.innerHTML = `<div class="filters" data-l>${L.map(([k, n]) => `<button type="button" data-k="${k}" aria-pressed="${on.has(k)}">${n}</button>`).join("")}</div>
        <div data-bars style="display:flex;flex-direction:column;gap:10px"></div><div data-v></div>
        <p class="cap">※ 割合は「対策を重ねるほど残るリスクが掛け算で小さくなる」考え方を示すための<b>説明用の仮の値</b>で、実際の製品や対策の効果を表すものではありません。</p>`;
      const draw = () => {
        const bars = ATK.map(a => {
          let r = 1; const steps = [];
          L.forEach(([k, n]) => { if (on.has(k) && a.w[k]) { const cut = r * a.w[k]; steps.push({ n, cut }); r -= cut; } });
          return { a, r, steps };
        });
        el.querySelector("[data-bars]").innerHTML = bars.map(({ a, r, steps }) => `<div><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span>${esc(a.n)}</span><span class="date">残るリスク ${Math.round(r * 100)}%</span></div>
          <div style="display:flex;height:16px;border-radius:4px;overflow:hidden;background:var(--sunken);margin-top:3px">${steps.map((s, i) => `<i title="${esc(s.n)}" style="width:${s.cut * 100}%;background:var(--ok);opacity:${1 - i * .12};border-right:1px solid var(--surface)"></i>`).join("")}<i style="width:${r * 100}%;background:var(--attack)"></i></div>
          <div class="cap" style="font-size:11px">${steps.length ? steps.map(s => esc(s.n)).join(" → ") : "効く対策がありません"}</div></div>`).join("");
        const avg = bars.reduce((s, b) => s + b.r, 0) / bars.length;
        el.querySelector("[data-v]").innerHTML = `<div class="verdict ${avg < .2 ? "good" : avg < .5 ? "mid" : "bad"}">対策 ${on.size} 個 · 平均の残るリスク ${Math.round(avg * 100)}%<p>${on.size <= 1 ? "1つの対策だけでは、効かない攻撃が必ず残ります。" : avg < .2 ? "性質の違う対策を重ねることで、どの攻撃も途中で止まりやすくなりました。それでもゼロにはならないため、侵入された後に気づく仕組み（ログ監視）と復旧の備えも必要です。" : "まだ赤い部分が大きい攻撃があります。その攻撃に効く対策を探して追加してみましょう。"}</p></div>`;
        if (on.size >= 4) ST.markLab("layers");
      };
      ST.$$("[data-l] button", el).forEach(b => b.onclick = () => { const k = b.dataset.k; on.has(k) ? on.delete(k) : on.add(k); b.setAttribute("aria-pressed", on.has(k)); draw(); });
      draw();
    }
  });

  /* ---------- Log analysis (mini SOC) ---------- */
  ST.widget("logs", {
    title: "ログ分析：怪しい記録を見つける",
    mount(el) {
      const LOG = [
        { t: "09:02:11", s: "auth", m: "login success user=sato src=192.0.2.15", bad: 0, e: "社内のいつものIPアドレスからの、勤務時間内のログイン。" },
        { t: "02:13:05", s: "auth", m: "login failed user=admin src=203.0.113.50 (×58, 4秒間)", bad: 1, e: "深夜に同じ送信元から4秒間に58回の失敗。自動ツールによる総当たり攻撃の典型的なパターン。" },
        { t: "02:13:12", s: "auth", m: "login success user=admin src=203.0.113.50", bad: 1, e: "総当たりの直後に同じ送信元から成功。パスワードを破られた可能性が高く、最優先で調べるべき記録。" },
        { t: "09:15:40", s: "web", m: "GET /products?id=12 200", bad: 0, e: "商品ページの通常の閲覧。" },
        { t: "10:20:33", s: "web", m: "GET /search?q=%27%20OR%20%271%27%3D%271 500", bad: 1, e: "URLエンコードを戻すと ' OR '1'='1。SQLインジェクションを試した跡で、500（サーバーエラー）が返っているのも要注意。" },
        { t: "10:21:02", s: "web", m: "GET /download?file=../../etc/passwd 403", bad: 1, e: "ディレクトリ・トラバーサルの試み。403で拒否されているが、攻撃者が弱点を探している証拠。" },
        { t: "11:00:00", s: "sys", m: "backup job completed status=OK", bad: 0, e: "定時のバックアップ完了。" },
        { t: "11:42:17", s: "auth", m: "login success user=tanaka src=192.0.2.31", bad: 0, e: "通常のログイン。" },
        { t: "13:05:09", s: "auth", m: "login failed user=suzuki src=192.0.2.44", bad: 0, e: "1回だけの失敗で、すぐ後に成功している。入力ミスと考えられる。" },
        { t: "13:05:21", s: "auth", m: "login success user=suzuki src=192.0.2.44", bad: 0, e: "通常のログイン。" },
        { t: "15:30:02", s: "api", m: "GET /api/users/1044..1999 200 token=sato (×956)", bad: 1, e: "satoのトークンで他人のIDを連番で大量取得。APIのアクセス制御の不備を突いた情報の列挙で、レート制限や認可の確認があれば防げた。" },
        { t: "16:10:55", s: "auth", m: "role changed user=guest01 role=admin by=admin src=203.0.113.50", bad: 1, e: "乗っ取られた疑いのあるadminが、ゲストアカウントを管理者に昇格。攻撃者が自分用の入口を作った（永続化）可能性。" },
        { t: "03:44:10", s: "net", m: "pc-07 → 198.51.100.200:443 (60秒ごとに継続)", bad: 1, e: "深夜に一定間隔で同じ外部サーバーへ通信。マルウェアがC2サーバーに定期接続する「ビーコン」の特徴。" },
        { t: "17:45:00", s: "auth", m: "logout user=sato", bad: 0, e: "通常のログアウト。" }
      ];
      const pick = new Set(); let checked = false;
      el.innerHTML = `<p class="cap">ある会社の1日のログです（架空）。怪しいと思う行をタップして選び、「答え合わせ」を押してください。</p>
        <div data-list style="display:flex;flex-direction:column;gap:4px"></div>
        <div class="btns"><button class="btn small primary" type="button" data-a="check">答え合わせ</button><button class="btn small" type="button" data-a="reset">↺ やり直す</button></div><div data-v></div>`;
      const draw = () => {
        el.querySelector("[data-list]").innerHTML = LOG.map((l, i) => {
          const sel = pick.has(i), ok = checked && (sel === !!l.bad);
          const bg = checked ? (l.bad ? (sel ? "var(--ok-soft)" : "var(--warn-soft)") : (sel ? "var(--attack-soft)" : "var(--surface)")) : (sel ? "var(--packet-soft)" : "var(--surface)");
          return `<button type="button" data-i="${i}" style="text-align:left;border:1px solid ${sel ? "var(--packet)" : "var(--line)"};background:${bg};border-radius:6px;padding:6px 8px;cursor:pointer;display:block;width:100%">
            <span style="font-family:var(--f-mono);font-size:12px;overflow-wrap:anywhere"><span style="color:var(--muted)">${l.t} [${l.s}]</span> ${esc(l.m)}</span>
            ${checked ? `<div style="font-size:12px;margin-top:3px">${l.bad ? (sel ? "✓ 正解：" : "⚠ 見逃し：") : (sel ? "✕ 問題なし：" : "")}${l.bad || sel ? esc(l.e) : ""}</div>` : ""}</button>`;
        }).join("");
        ST.$$("[data-i]", el).forEach(b => b.onclick = () => { if (checked) return; const i = +b.dataset.i; pick.has(i) ? pick.delete(i) : pick.add(i); draw(); });
      };
      el.querySelector('[data-a="check"]').onclick = () => {
        checked = true; draw();
        const bad = LOG.filter(l => l.bad).length, hit = LOG.filter((l, i) => l.bad && pick.has(i)).length, fp = LOG.filter((l, i) => !l.bad && pick.has(i)).length;
        el.querySelector("[data-v]").innerHTML = `<div class="verdict ${hit === bad && !fp ? "good" : "mid"}">発見 ${hit}/${bad} · 誤検知 ${fp}<p>一つ一つの記録は小さくても、<b>同じ送信元 203.0.113.50</b> を軸に並べると「総当たり → ログイン成功 → 管理者アカウントの作成」という一連の侵入が見えてきます。ログは関連づけて読むことが大切です。</p></div>`;
        ST.markLab("logs");
      };
      el.querySelector('[data-a="reset"]').onclick = () => { pick.clear(); checked = false; el.querySelector("[data-v]").innerHTML = ""; draw(); };
      draw();
    }
  });

  /* ---------- Phishing judgment game (fictional brands only) ---------- */
  ST.widget("phishgame", {
    title: "見破れる？ フィッシング判定トレーニング",
    mount(el) {
      const Q = [
        { ch: "SMS", from: "+81 80-XXXX-XXXX", body: "【ミドリ運輸】お客様宛にお荷物のお届けにあがりましたが不在の為持ち帰りました。配送物は下記よりご確認ください。\nhttps://midori-unyu.delivery-check.top/", bad: 1,
          cues: ["宅配業者を名乗るSMSにURLが付いている（典型的なスミッシング）", "ドメインが delivery-check.top で、ミドリ運輸の公式ドメインではない", "差出人が個人の携帯番号"], act: "リンクを開かず、ミドリ運輸の公式アプリや、自分で検索した公式サイトで追跡番号を確認する。" },
        { ch: "メール", from: "ハナ銀行 <info@hana-bank.secure-verify.com>", body: "【重要】お客様の口座が一時的に利用停止となりました。24時間以内に以下より本人確認を完了しない場合、口座は凍結されます。\n▶ 本人確認はこちら", bad: 1,
          cues: ["「24時間以内」「凍結」と強く急がせている", "差出人ドメインが secure-verify.com で、銀行の名前が前に付いているだけ", "メールのリンクから本人確認をさせようとしている"], act: "メール内のリンクは使わず、ブックマークや公式アプリからログインして、お知らせを確認する。" },
        { ch: "アプリ通知", from: "ハナ銀行アプリ", body: "10月分のご利用明細を更新しました。アプリの「明細」からご確認ください。", bad: 0,
          cues: ["公式アプリ内の通知で、リンクを開かせたり入力を求めたりしていない"], act: "アプリを開いて確認すればよい。ただし、見た目だけで本物と言い切ることはできません。迷ったら、自分で公式アプリを開いて確かめる習慣を。" },
        { ch: "ブラウザ", from: "全画面の警告表示", body: "⚠ 警告！このPCはウイルスに感染しています！\n個人情報が流出しています。今すぐサポートセンターへお電話ください。\n☎ 050-XXXX-XXXX（Windowsサポート）", bad: 1,
          cues: ["Webページが「感染しています」と断定し、電話をかけさせようとしている（サポート詐欺）", "警告音や全画面表示で慌てさせる"], act: "電話はかけない。ブラウザを閉じる（閉じられなければ再起動する）。" },
        { ch: "メール", from: "山田 社長 <ceo.yamada@gmail.example>", body: "至急の案件です。取引先への支払いを本日中に下記口座へ振り込んでください。極秘案件のため、社内の他の人には話さないように。", bad: 1,
          cues: ["社長を名乗るが、会社のドメインではないアドレス", "「至急」「他言無用」で確認させないようにしている（ビジネスメール詐欺）"], act: "メールに返信せず、社長本人に電話や対面など別の方法で確認する。" },
        { ch: "SMS", from: "Kumo ID", body: "Kumo IDのサインインに使う確認コードは 482913 です。このコードを誰にも教えないでください。", bad: 0,
          cues: ["自分でログインしようとしたときに届いたなら、正規のコードの可能性が高い", "URLがなく、コードを他人に教えないよう注意している"], act: "自分がログイン操作をしていないのに届いた場合は、誰かがパスワードを知っている可能性がある。コードは誰にも教えず、パスワードを変更する。" }
      ];
      let i = 0, score = 0, ans = null;
      const draw = () => {
        if (i >= Q.length) {
          el.innerHTML = `<div class="verdict ${score >= 5 ? "good" : "mid"}">${score} / ${Q.length} 問正解<p>大事なのは「見破る力」よりも「<b>メッセージのリンクや電話番号を使わず、自分で公式の窓口を開いて確かめる</b>」習慣です。本物そっくりの偽物は、プロでも見分けられないことがあります。</p></div><div class="btns"><button class="btn small primary" type="button" data-a="again">もう一度</button></div>`;
          el.querySelector('[data-a="again"]').onclick = () => { i = 0; score = 0; ans = null; draw(); };
          ST.markLab("phishgame"); return;
        }
        const q = Q[i];
        el.innerHTML = `<div class="q-meta"><span class="date">${i + 1} / ${Q.length}</span><span class="chip">${esc(q.ch)}</span></div>
          <div class="card" style="padding:14px;background:var(--sunken)"><div class="cap" style="font-size:12px">${esc(q.from)}</div><p style="white-space:pre-line;margin-top:4px;overflow-wrap:anywhere">${esc(q.body)}</p></div>
          <div class="btns">${ans === null ? `<button class="btn primary" type="button" data-j="1">怪しい</button><button class="btn" type="button" data-j="0">問題なさそう</button>` : ""}</div>
          ${ans !== null ? `<div class="verdict ${ans === q.bad ? "good" : "bad"}">${ans === q.bad ? "正解" : "不正解"}：${q.bad ? "フィッシング・詐欺の特徴があります" : "正規のメッセージの可能性が高いです"}<p>${q.cues.map(c => "・" + esc(c)).join("<br>")}</p></div>
            <div class="callout info"><b>取るべき行動：</b>${esc(q.act)}</div><div class="btns"><button class="btn small primary" type="button" data-a="next">次へ ›</button></div>` : ""}
          <p class="cap">※ 会社名・ドメイン・番号はすべて架空です。</p>`;
        ST.$$("[data-j]", el).forEach(b => b.onclick = () => { ans = +b.dataset.j; if (ans === q.bad) score++; draw(); });
        const nx = el.querySelector('[data-a="next"]'); if (nx) nx.onclick = () => { i++; ans = null; draw(); };
      };
      draw();
    }
  });

  /* ---------- Kill chain & ATT&CK ---------- */
  ST.widget("killchain", {
    title: "サイバーキルチェーン：どこで断ち切る？",
    mount(el) {
      const K = [
        { n: "偵察", en: "Reconnaissance", a: "会社のWebサイトやSNSから、社員の名前やメールアドレス、使っている製品を調べる。", d: "公開する情報を必要最小限にする（完全に防ぐのは難しい）", tac: ["TA0043"] },
        { n: "武器化", en: "Weaponization", a: "悪意のあるマクロや脆弱性を突くコードを仕込んだ文書を用意する。", d: "攻撃者の手元で行われるため、防御側からは直接防げない", tac: ["TA0042"], none: 1 },
        { n: "配送", en: "Delivery", a: "取引先を装ったメールに、その文書を添付して送る。", d: "メールフィルタで不審な添付ファイルを止める・訓練で開かない", tac: ["TA0001"] },
        { n: "攻撃", en: "Exploitation", a: "受け取った社員が文書を開くと、脆弱性が悪用されてコードが動く。", d: "OS・アプリを更新して脆弱性をなくす", tac: ["TA0002", "TA0004"] },
        { n: "インストール", en: "Installation", a: "遠隔操作用のマルウェアを端末に常駐させる。", d: "EDRで不審な常駐や振る舞いを検知する", tac: ["TA0003", "TA0005"] },
        { n: "遠隔操作 (C2)", en: "Command & Control", a: "マルウェアが外部のC2サーバーと通信し、攻撃者の指示を受ける。", d: "外部への不審な定期通信を監視・遮断する", tac: ["TA0011"] },
        { n: "目的の実行", en: "Actions on Objectives", a: "社内の他の端末へ広がり、機密情報を集めて外部に持ち出す。", d: "ネットワーク分割、権限の最小化、持ち出しの監視", tac: ["TA0006", "TA0007", "TA0008", "TA0009", "TA0010", "TA0040"] }
      ];
      const TAC = [["TA0043", "偵察"], ["TA0042", "リソース開発"], ["TA0001", "初期アクセス"], ["TA0002", "実行"], ["TA0003", "永続化"], ["TA0004", "権限昇格"], ["TA0005", "ステルス"], ["TA0112", "防御機能の妨害"], ["TA0006", "認証情報アクセス"], ["TA0007", "探索"], ["TA0008", "横展開"], ["TA0009", "収集"], ["TA0011", "C2"], ["TA0010", "持ち出し"], ["TA0040", "影響"]];
      let cut = -1, sel = 0;
      el.innerHTML = `<p class="cap">シナリオ：標的型メールによる情報窃取。段階をタップして内容を確認し、「ここで断つ」で防御を置いてみましょう。</p>
        <div class="scroll-x"><div data-chain style="display:flex;gap:0;align-items:stretch;min-width:620px"></div></div>
        <div class="card" data-d style="padding:12px"></div>
        <div><div class="eyebrow" style="margin-bottom:6px">MITRE ATT&amp;CK エンタープライズの戦術（2026年10月時点の15項目）</div><div data-tac style="display:flex;flex-wrap:wrap;gap:4px"></div></div>`;
      const draw = () => {
        el.querySelector("[data-chain]").innerHTML = K.map((k, i) => {
          const dead = cut >= 0 && i > cut, isCut = i === cut;
          return `<button type="button" data-k="${i}" style="flex:1;min-width:84px;border:0;cursor:pointer;padding:10px 6px;text-align:center;position:relative;background:${isCut ? "var(--ok-soft)" : dead ? "var(--sunken)" : i === sel ? "var(--attack-soft)" : "var(--surface)"};opacity:${dead ? .45 : 1};border-top:3px solid ${isCut ? "var(--ok)" : dead ? "var(--line)" : "var(--attack)"};${i ? "border-left:1px dashed var(--line);" : ""}">
            <div class="date" style="font-size:10px">${i + 1}</div><div style="font-size:12.5px;font-weight:500;line-height:1.35">${esc(k.n)}</div><div class="date" style="font-size:9px">${esc(k.en)}</div>${isCut ? `<div style="font-size:11px;color:var(--ok);font-weight:600">✂ 断つ</div>` : ""}</button>`;
        }).join("");
        const k = K[sel];
        el.querySelector("[data-d]").innerHTML = `<div class="eyebrow">${sel + 1}. ${esc(k.n)} · ${esc(k.en)}</div><p><b>攻撃者の行動：</b>${esc(k.a)}</p><p style="margin-top:6px"><b>防御：</b>${esc(k.d)}</p>
          <div class="btns" style="margin-top:8px">${k.none ? `<span class="chip">この段階では断てない</span>` : `<button class="btn small primary" type="button" data-cut>ここで断つ</button>`}${cut >= 0 ? `<button class="btn small" type="button" data-un>防御を外す</button>` : ""}</div>
          ${cut >= 0 ? `<div class="verdict good" style="margin-top:10px">${cut + 1}.「${esc(K[cut].n)}」で断ち切ったので、それ以降の段階は起こらない<p>${cut <= 2 ? "早い段階で止めるほど被害は小さくなります。" : "侵入は許したものの、目的の達成は防げました。早い段階での防御と、後の段階での検知を組み合わせるのが多層防御です。"}</p></div>` : ""}`;
        const cutBtn = el.querySelector("[data-cut]"); if (cutBtn) cutBtn.onclick = () => { cut = sel; draw(); ST.markLab("killchain"); };
        const un = el.querySelector("[data-un]"); if (un) un.onclick = () => { cut = -1; draw(); };
        ST.$$("[data-k]", el).forEach(b => b.onclick = () => { sel = +b.dataset.k; draw(); });
        el.querySelector("[data-tac]").innerHTML = TAC.map(([id, n]) => `<span class="chip ${k.tac.includes(id) ? "attack" : ""}" title="${id}">${id} ${esc(n)}</span>`).join("");
      };
      draw();
    }
  });
})(window.ST);
