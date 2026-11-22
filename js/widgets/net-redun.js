"use strict";
/* Redundancy labs (all values are fictional; nothing is sent).
   Availability formulas follow the AWS Well-Architected Reliability Pillar; VRRP timers follow RFC 5798 section 6.1;
   the load balancer lab is a simplified model of the behavior described in the AWS Elastic Load Balancing user guide. */
(function (ST) {
  const esc = ST.esc;
  const pct = x => (x * 100).toFixed(x > 0.99999 ? 5 : 4).replace(/0+$/, "").replace(/\.$/, "");
  const dur = min => {
    if (min < 1 / 60) return "1秒未満";
    if (min < 1) return Math.round(min * 60) + "秒";
    if (min < 60) return Math.round(min) + "分";
    const h = Math.floor(min / 60), m = Math.round(min - h * 60);
    if (h < 24) return h + "時間" + (m ? m + "分" : "");
    const d = Math.floor(h / 24);
    return d + "日" + (h - d * 24 ? (h - d * 24) + "時間" : "");
  };

  /* ---- Availability: serial dependencies and parallel (redundant) copies ---- */
  ST.widget("red-avail", {
    title: "可用性の計算：冗長化で止まる時間はどう変わるか",
    group: "net", name: "冗長化と止まる時間", desc: "予備を足すと、1年に止まる時間が変わる（独立に故障する前提の単純化）", order: 20,
    mount(el) {
      let a = 0.999, n = 1, dep = 0;
      el.innerHTML = `<p class="cap">説明用の計算機です。部品どうしが<b>独立して</b>故障する前提の単純なモデルで、実際の機器の数字ではありません。</p>
        <div class="eyebrow">1台あたりの可用性</div>
        <div class="btns">${ST.segHtml("av", [["0.99", "99%"], ["0.999", "99.9%"], ["0.9999", "99.99%"]], String(a))}</div>
        <div class="eyebrow" style="margin-top:6px">同じ役割の機器の台数（並列。1台でも動けば全体は動く）</div>
        <div class="btns">${ST.segHtml("nn", [["1", "1台"], ["2", "2台"], ["3", "3台"]], String(n))}</div>
        <div class="eyebrow" style="margin-top:6px">その手前に必須の機器（直列。1つでも止まれば全体が止まる）</div>
        <div class="btns">${ST.segHtml("dp", [["0", "なし"], ["1", "1つ（冗長化なし）"]], String(dep))}</div>
        <div data-out></div>`;
      const upd = () => {
        const par = 1 - Math.pow(1 - a, n);
        const total = par * (dep ? a : 1);
        const down = (1 - total) * 365 * 24 * 60;
        let note = "";
        if (dep && n > 1) note = `<p>手前の必須機器（1台）が${pct(a)}%なので、後ろを冗長化しても全体はそれ以上に上がりません。直列の部品は、可用性を掛け合わせます。</p>`;
        else if (n === 1 && !dep) note = `<p>台数を増やすと、並列の計算式で止まる時間が短くなります。</p>`;
        el.querySelector("[data-out]").innerHTML = `<div class="hexbox" style="white-space:pre-wrap">並列部分：1 − (1 − ${pct(a)}%)^${n} ＝ ${pct(par)}%${dep ? `\n全体（直列：× ${pct(a)}%）＝ ${pct(total)}%` : ""}</div>
          <div class="verdict ${dep && n > 1 ? "mid" : "good"}">全体の可用性 ${pct(total)}%<p>1年（365日）で止まる時間の目安：<b>${dur(down)}</b></p>${note}</div>`;
        if (n > 1 && dep) ST.markLab("red-avail");
      };
      ST.wireSeg(el, "av", x => { a = +x; upd(); });
      ST.wireSeg(el, "nn", x => { n = +x; upd(); });
      ST.wireSeg(el, "dp", x => { dep = +x; upd(); });
      upd();
    }
  });

  /* ---- VRRP failover: Master_Down_Interval = 3 * Advertisement_Interval + Skew_Time (RFC 5798 6.1) ---- */
  ST.widget("red-vrrp", {
    title: "ゲートウェイの切り替え：VRRPで予備のルーターが引き継ぐ",
    group: "net", name: "ゲートウェイの冗長化（VRRP）", desc: "Masterが止まってからBackupが引き継ぐまでの時間を見る", order: 21,
    mount(el) {
      let adv = 1, prio = 100, running = false, t = 0, failed = false, timer = null;
      const mdi = () => 3 * adv + ((256 - prio) * adv) / 256;
      el.innerHTML = `<p class="cap">架空のLANです（仮想IP 192.0.2.1、ルーターR1・R2。192.0.2.0/24 は文書用のアドレス帯）。PCの標準ゲートウェイは仮想IPだけです。実際の通信はしません。</p>
        <div class="eyebrow">Advertisement_Interval（Masterが生存を知らせる間隔）</div>
        <div class="btns">${ST.segHtml("adv", [["1", "1秒（既定）"], ["0.5", "0.5秒"], ["0.2", "0.2秒"]], String(adv))}</div>
        <div class="eyebrow" style="margin-top:6px">Backup（R2）の優先度</div>
        <div class="btns">${ST.segHtml("pr", [["100", "100（既定）"], ["200", "200"], ["20", "20"]], String(prio))}</div>
        <div data-fig></div>
        <div class="btns"><button type="button" class="btn" data-go>R1（Master）を止める</button><button type="button" class="btn" data-reset>元に戻す</button></div>
        <div class="hexbox" data-calc style="white-space:pre-wrap"></div>
        <div data-vd></div>
        <p class="cap">優先度が高いBackupは、早く引き継ぎます（Skew_Time が小さいため）。時間の計算は RFC 5798 の式どおりで、動きは説明用の単純化です。</p>`;
      const draw = () => {
        const need = mdi(), done = failed && t >= need;
        const master = !failed ? "R1" : (done ? "R2" : "なし");
        const col = (cond, c) => cond ? c : "var(--muted, #888)";
        const svg = `<svg viewBox="0 0 320 130" role="img" aria-label="PC、スイッチ、ルーターR1とR2、インターネットの図" style="width:100%;max-width:420px;display:block;margin:8px auto">
          <g font-size="11" text-anchor="middle" fill="currentColor">
          <rect x="6" y="50" width="50" height="28" rx="6" fill="none" stroke="currentColor"/><text x="31" y="68">PC</text>
          <rect x="84" y="50" width="50" height="28" rx="6" fill="none" stroke="currentColor"/><text x="109" y="68">スイッチ</text>
          <rect x="170" y="8" width="56" height="34" rx="6" fill="none" stroke="${failed && master !== "R1" ? "var(--attack)" : col(master === "R1", "var(--ok)")}" stroke-width="2"/><text x="198" y="22">R1</text><text x="198" y="36" font-size="9">${failed ? "停止" : "Master"}</text>
          <rect x="170" y="86" width="56" height="34" rx="6" fill="none" stroke="${col(master === "R2", "var(--ok)")}" stroke-width="2"/><text x="198" y="100">R2</text><text x="198" y="114" font-size="9">${master === "R2" ? "Master" : "Backup"}</text>
          <rect x="262" y="50" width="52" height="28" rx="14" fill="none" stroke="currentColor"/><text x="288" y="68">外部</text></g>
          <g stroke="currentColor" fill="none"><path d="M56 64H84"/><path d="M134 64L170 25" stroke="${col(master === "R1", "var(--ok)")}"/><path d="M134 64L170 103" stroke="${col(master === "R2", "var(--ok)")}"/><path d="M226 25L262 64" stroke="${col(master === "R1", "var(--ok)")}"/><path d="M226 103L262 64" stroke="${col(master === "R2", "var(--ok)")}"/></g></svg>`;
        el.querySelector("[data-fig]").innerHTML = svg;
        el.querySelector("[data-calc]").textContent = `Skew_Time ＝ (256 − ${prio}) × ${adv}秒 ÷ 256 ＝ ${(((256 - prio) * adv) / 256).toFixed(3)}秒\nMaster_Down_Interval ＝ 3 × ${adv}秒 ＋ Skew_Time ＝ ${need.toFixed(3)}秒${failed ? `\n経過 ${Math.min(t, need).toFixed(1)}秒` : ""}`;
        let v = `<div class="verdict good">正常：R1がMasterとして転送中<p>PCは仮想IPあてに送り続けます。</p></div>`;
        if (failed && !done) v = `<div class="verdict bad">通信が途切れている（${t.toFixed(1)}秒）<p>Backupは、Masterからのお知らせが ${need.toFixed(2)}秒 なくなるまで、Masterの故障と判断しません。</p></div>`;
        if (done) { v = `<div class="verdict good">R2がMasterを引き継いだ（約${need.toFixed(2)}秒の断）<p>PCのゲートウェイ設定は仮想IPのままで変更不要です。間隔を短くすると断の時間は短くなりますが、その分お知らせが増えます。</p></div>`; ST.markLab("red-vrrp"); }
        el.querySelector("[data-vd]").innerHTML = v;
      };
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      const go = () => {
        if (failed) return;
        failed = true; t = 0;
        if (ST.motion === "off") { t = mdi(); draw(); return; }
        draw();
        timer = setInterval(() => { t += 0.1; if (t >= mdi()) { t = mdi(); stop(); } draw(); }, 100);
      };
      const reset = () => { stop(); failed = false; t = 0; draw(); };
      ST.wireSeg(el, "adv", x => { adv = +x; reset(); });
      ST.wireSeg(el, "pr", x => { prio = +x; reset(); });
      el.querySelector("[data-go]").onclick = go;
      el.querySelector("[data-reset]").onclick = reset;
      draw();
    }
  });

  /* ---- Load balancer with health checks (simplified model) ---- */
  ST.widget("red-lb", {
    title: "ロードバランサーとヘルスチェック",
    group: "net", name: "負荷分散とヘルスチェック", desc: "故障したサーバーに振り分けない仕組みを確かめる", order: 22,
    mount(el) {
      const up = [true, true, true];
      let hc = false, rr = 0, log = [], ok = 0, ng = 0;
      el.innerHTML = `<p class="cap">架空の3台のサーバー（Web1〜3）に、リクエストを順番に振り分ける説明用の模擬です。実際の通信はしません。</p>
        <label class="toggle"><input type="checkbox" id="rl-hc"><span>ヘルスチェックを有効にする<br><span class="d">オフ＝故障しているサーバーにも振り分けてしまう（説明用）</span></span></label>
        <div class="eyebrow">サーバーの状態（押すと故障／復旧）</div>
        <div class="btns" data-srv></div>
        <div class="btns"><button type="button" class="btn" data-send>リクエストを10回送る</button><button type="button" class="btn" data-reset>やり直す</button></div>
        <div class="hexbox" data-log style="white-space:pre-wrap;min-height:2.5em"></div><div data-vd></div>`;
      const srv = el.querySelector("[data-srv]");
      const draw = () => {
        srv.innerHTML = up.map((u, i) => `<button type="button" class="btn" data-i="${i}" style="${u ? "" : "border-color:var(--attack);color:var(--attack)"}">Web${i + 1}：${u ? "正常" : "故障"}</button>`).join("");
        srv.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { up[+b.dataset.i] = !up[+b.dataset.i]; draw(); });
        el.querySelector("[data-log]").textContent = log.join("\n");
        let v = "";
        if (ok + ng) {
          if (!up.every(Boolean) && !hc && ng) v = `<div class="verdict bad">失敗したリクエスト ${ng} / ${ok + ng}<p>ヘルスチェックがないと、故障したサーバーにも振り分けられ、利用者にエラーが出ます。</p></div>`;
          else if (hc && !up.every(Boolean) && !ng) { v = `<div class="verdict good">失敗 0 / ${ok + ng}<p>ロードバランサーが正常なサーバーだけに振り分けました。AWSの説明でも、ヘルスチェックで正常な対象だけにリクエストを送ります。</p></div>`; ST.markLab("red-lb"); }
          else if (hc && ng) v = `<div class="verdict bad">全サーバーが故障<p>振り分け先が残っていません。台数の冗長化も、同時に全部が止まれば役に立ちません。</p></div>`;
          else v = `<div class="verdict mid">全サーバー正常：どれも成功<p>サーバーを故障にして、もう一度送ってみてください。</p></div>`;
        }
        el.querySelector("[data-vd]").innerHTML = v;
      };
      el.querySelector("#rl-hc").onchange = e => { hc = e.target.checked; draw(); };
      el.querySelector("[data-send]").onclick = () => {
        log = []; ok = 0; ng = 0;
        for (let k = 1; k <= 10; k++) {
          const pool = hc ? [0, 1, 2].filter(i => up[i]) : [0, 1, 2];
          if (!pool.length) { ng++; log.push(`#${k} → 振り分け先なし ×`); continue; }
          const i = pool[rr++ % pool.length];
          if (up[i]) { ok++; log.push(`#${k} → Web${i + 1} ○`); } else { ng++; log.push(`#${k} → Web${i + 1} ×（故障）`); }
        }
        draw();
      };
      el.querySelector("[data-reset]").onclick = () => { up.fill(true); log = []; ok = 0; ng = 0; rr = 0; draw(); };
      draw();
    }
  });
})(ST);
