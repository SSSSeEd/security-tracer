"use strict";
/* LAN defense lab: watching the ARP table for spoofed entries, and how switch/host/TLS defenses respond. */
(function (ST) {
  const esc = ST.esc;

  ST.widget("arp", {
    title: "ARPテーブルを監視して、なりすましに気づく",
    mount(el) {
      const MAC = { gw: "00:00:5e:00:53:01", prn: "00:00:5e:00:53:20", sus: "00:00:5e:00:53:66" };
      const N = { pc: { x: 60, y: 180, l: "あなたのPC", ip: ".10", i: "pc" }, sw: { x: 180, y: 100, l: "スイッチ", i: "router" }, gw: { x: 300, y: 180, l: "ルーター", ip: ".1", i: "router" }, sus: { x: 300, y: 36, l: "不審な機器", ip: ".66", i: "attacker" } };
      let table, log, poisoned, done, timer, answered;
      el.innerHTML = `<div class="def">
          <label class="toggle"><input type="checkbox" data-d="dai"><span>スイッチで不正なARPを検査する<br><span class="d">DHCPスヌーピングとDynamic ARP Inspection（ATT&amp;CK M1037）</span></span></label>
          <label class="toggle"><input type="checkbox" data-d="static"><span>ルーターのARPエントリを固定する<br><span class="d">静的ARPエントリ（M1035）。大規模なネットワークでは運用が難しい</span></span></label>
          <label class="toggle"><input type="checkbox" data-d="tls"><span>通信をTLSで暗号化する<br><span class="d">経路を変えられても中身は読めず、証明書で相手を確かめられる（M1041）</span></span></label></div>
        <div class="stage"><svg data-s viewBox="0 0 360 230" role="img" aria-label="LANの構成図"></svg></div>
        <div class="btns"><button class="btn small primary" type="button" data-a="play">▶ LANの様子を再生</button><button class="btn small" type="button" data-a="reset">↺ リセット</button></div>
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
          <div class="card" style="padding:12px"><div class="eyebrow">あなたのPCのARPテーブル</div><div data-t></div><p class="cap" data-q style="margin-top:6px"></p></div>
          <div class="card" style="padding:12px"><div class="eyebrow">イベントログ</div><ol data-log class="cap" style="margin:0;padding-left:18px;display:grid;gap:4px"></ol></div></div>
        <div data-v aria-live="polite"></div>`;
      const $ = q => el.querySelector(q), svg = $("[data-s]"), on = k => $(`[data-d="${k}"]`).checked;
      const draw = () => {
        const via = poisoned && done;
        let s = ["pc", "gw", "sus"].map(k => `<line x1="${N[k].x}" y1="${N[k].y}" x2="${N.sw.x}" y2="${N.sw.y}" class="lnk dash"/>`).join("");
        if (done) {
          const pts = via ? [N.pc, N.sw, N.sus, N.sw, N.gw] : [N.pc, N.sw, N.gw];
          s += `<polyline points="${pts.map(n => n.x + "," + n.y).join(" ")}" fill="none" stroke="${via ? "var(--attack)" : "var(--ok)"}" stroke-width="3" stroke-linejoin="round" opacity=".8"/>`;
        }
        Object.values(N).forEach(n => {
          s += `<g transform="translate(${n.x} ${n.y})"><circle r="22" fill="var(--surface)" stroke="var(--line)"/><use href="#i-${n.i}" x="-13" y="-13" width="26" height="26" class="n-ico${n.i === "attacker" ? " atk" : ""}"/>
            <text class="n-label" y="36" text-anchor="middle">${esc(n.l)}</text>${n.ip ? `<text class="n-label" y="48" text-anchor="middle" style="font-family:var(--f-mono);font-size:9px;fill:var(--muted)">192.168.1${n.ip}</text>` : ""}</g>`;
        });
        svg.innerHTML = s;
        const macCount = {}; table.forEach(r => macCount[r.mac] = (macCount[r.mac] || 0) + 1);
        $("[data-t]").innerHTML = table.length ? `<table class="cap" style="width:100%;border-collapse:collapse;font-family:var(--f-mono)">${table.map((r, i) =>
          `<tr data-row="${i}" style="cursor:${done ? "pointer" : "default"};${r.mark ? "background:var(--attack-soft)" : ""}"><td style="padding:4px">${r.ip}</td><td style="padding:4px;overflow-wrap:anywhere">${r.mac}${r.st ? " (静的)" : ""}</td></tr>`).join("")}</table>` : `<p class="cap">（空）</p>`;
        $("[data-log]").innerHTML = log.map(t => `<li>${t}</li>`).join("");
        $("[data-q]").textContent = done && !answered ? "怪しい行があればタップしてください。なければ下のボタンへ。" : "";
        ST.$$("[data-row]", el).forEach(tr => tr.onclick = () => done && judge(table[+tr.dataset.row], macCount));
      };
      const verdict = (k, h, p) => $("[data-v]").innerHTML = `<div class="verdict ${k}">${h}<p>${p}</p></div>`;
      const judge = (row, macCount) => {
        answered = true;
        if (macCount[row.mac] > 1) { row.mark = true; table.forEach(r => { if (r.mac === row.mac) r.mark = true; }); draw();
          verdict("good", "正解：1つのMACアドレスに2つのIPアドレスが対応しています", `ルーター（.1）の宛先が、不審な機器（.66）と同じMACに書き換わっています。ATT&CKの検知ガイドでも「複数のIPが1つのMACに解決される」ことを注目点に挙げています。${on("tls") ? "TLSを有効にしていたので、通信が経由させられても中身は読まれません。" : "この状態では、暗号化されていない通信は不審な機器を経由し、中身を見られる恐れがあります。"}`);
        } else { draw(); verdict("mid", "この行は正常です", "IPアドレスとMACアドレスの対応が1対1になっているか、ほかの行と見比べてみましょう。"); }
      };
      const reset = () => { clearTimeout(timer); table = []; log = []; poisoned = false; done = false; answered = false; $("[data-v]").innerHTML = ""; draw(); };
      const steps = () => [
        () => { table.push({ ip: "192.168.1.1", mac: MAC.gw, st: on("static") }); log.push("PC「192.168.1.1は誰？」→ ルーターが自分のMACを応答"); },
        () => { table.push({ ip: "192.168.1.66", mac: MAC.sus }); table.push({ ip: "192.168.1.20", mac: MAC.prn }); log.push("同じLANの機器（.66、プリンター .20）とも通信し、表に追加"); },
        () => {
          log.push("頼んでいないARP応答が届く：「192.168.1.1のMACは …:66 です」");
          if (on("dai")) log.push("<b>スイッチが破棄</b>：DHCPの割り当て記録と食い違うため、PCまで届かない");
          else if (on("static")) log.push("<b>PCが無視</b>：ルーターの行は静的エントリなので上書きされない");
          else { table[0].mac = MAC.sus; poisoned = true; log.push("PCは確認する手段がなく、ルーターの行を上書きしてしまう（ARPには認証がない）"); }
        },
        () => { done = true; log.push(poisoned ? `PCがログイン情報を送信 → 不審な機器を経由してルーターへ${on("tls") ? "（TLSで暗号化済み）" : "（平文）"}` : "PCがログイン情報を送信 → 正しくルーターへ届く"); }
      ];
      const play = () => { reset(); const list = steps(); let i = 0;
        const next = () => { list[i++](); draw(); if (i < list.length) timer = setTimeout(next, 900);
          else if (!poisoned) verdict("good", "なりすましは成立しませんでした", on("dai") ? "スイッチが不正なARP応答を止めました。表に怪しい行はありません。" : "静的エントリは上書きされませんでした。ただし、すべての機器で設定し続けるのは大変です。");
          else if (on("tls")) verdict("mid", "経路は変えられたが、中身は守られた", "ARPテーブルは書き換えられましたが、TLSで暗号化しているので内容は読めません。表から怪しい行を探してみましょう。"); };
        next(); };
      el.querySelector('[data-a="play"]').onclick = play;
      el.querySelector('[data-a="reset"]').onclick = reset;
      reset();
      return () => clearTimeout(timer);
    }
  });
})(ST);
