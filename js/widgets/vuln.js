"use strict";
/* Vulnerability widgets: CVSS v3.1 base score calculator, stack buffer overflow visualizer. */
(function (ST) {
  const esc = ST.esc;

  /* ---------- CVSS v3.1 (FIRST specification, section 7) ---------- */
  const M = {
    AV: { name: "攻撃元区分", opts: [["N", "ネットワーク", .85], ["A", "隣接", .62], ["L", "ローカル", .55], ["P", "物理", .2]], help: "どこから攻撃できるか。ネットワーク越しに攻撃できるほど深刻。" },
    AC: { name: "攻撃条件の複雑さ", opts: [["L", "低", .77], ["H", "高", .44]], help: "攻撃者の努力だけでは整えられない条件が必要か。" },
    PR: { name: "必要な特権レベル", opts: [["N", "不要", .85], ["L", "低", .62], ["H", "高", .27]], help: "攻撃の前にどの程度の権限が必要か。" },
    UI: { name: "ユーザー関与", opts: [["N", "不要", .85], ["R", "要", .62]], help: "利用者がリンクを開くなどの操作をする必要があるか。" },
    S: { name: "スコープ", opts: [["U", "変更なし", 0], ["C", "変更あり", 1]], help: "影響が脆弱なコンポーネントの外（他のシステム）に及ぶか。" },
    C: { name: "機密性への影響", opts: [["H", "高", .56], ["L", "低", .22], ["N", "なし", 0]], help: "情報が漏れるか。" },
    I: { name: "完全性への影響", opts: [["H", "高", .56], ["L", "低", .22], ["N", "なし", 0]], help: "情報が改ざんされるか。" },
    A: { name: "可用性への影響", opts: [["H", "高", .56], ["L", "低", .22], ["N", "なし", 0]], help: "サービスが止まるか。" }
  };
  const roundup = x => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
  ST.cvss31 = v => {
    const w = k => M[k].opts.find(o => o[0] === v[k])[2];
    const changed = v.S === "C";
    const pr = v.PR === "N" ? .85 : v.PR === "L" ? (changed ? .68 : .62) : (changed ? .5 : .27);
    const iss = 1 - (1 - w("C")) * (1 - w("I")) * (1 - w("A"));
    const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
    const expl = 8.22 * w("AV") * w("AC") * pr * w("UI");
    const base = impact <= 0 ? 0 : changed ? roundup(Math.min(1.08 * (impact + expl), 10)) : roundup(Math.min(impact + expl, 10));
    return { base, impact, expl };
  };
  const sev = s => s === 0 ? ["なし", "var(--muted)"] : s < 4 ? ["注意 (Low)", "var(--info)"] : s < 7 ? ["警告 (Medium)", "var(--warn)"] : s < 9 ? ["重要 (High)", "var(--packet)"] : ["緊急 (Critical)", "var(--attack)"];
  ST.widget("cvss", {
    title: "CVSS v3.1 基本値の計算機",
    group: "vuln", name: "CVSS計算機", desc: "深刻度スコアを自分で計算", order: 0,
    mount(el) {
      const PRESETS = [
        ["遠隔から認証なしで乗っ取り", "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H"],
        ["典型的な反射型XSS", "AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"],
        ["ローカルでの権限昇格", "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H"],
        ["サービス停止のみ", "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"]
      ];
      let v = { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "H", I: "H", A: "H" };
      el.innerHTML = `<div class="btns">${PRESETS.map((p, i) => `<button class="btn small" type="button" data-p="${i}">${esc(p[0])}</button>`).join("")}</div>
        <div data-ms style="display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))"></div>
        <div class="card" data-out style="padding:14px"></div>
        <p class="cap">計算式は FIRST の CVSS v3.1 仕様書（第7章）に従っています。CVSSの最新版は v4.0 ですが、v3.1 の値も現在広く使われています。スコアは脆弱性の性質を表すもので、実際に悪用されているかは表しません。</p>`;
      const ms = el.querySelector("[data-ms]");
      const draw = () => {
        ms.innerHTML = Object.entries(M).map(([k, m]) => `<div><div style="font-size:13px;font-weight:500">${m.name} <span class="date">${k}</span></div><div class="cap" style="font-size:12px">${m.help}</div>
          <div class="seg" style="margin-top:4px">${m.opts.map(o => `<button type="button" data-k="${k}" data-v="${o[0]}" aria-pressed="${v[k] === o[0]}">${o[1]}</button>`).join("")}</div></div>`).join("");
        ST.$$("[data-k]", ms).forEach(b => b.onclick = () => { v[b.dataset.k] = b.dataset.v; draw(); });
        const r = ST.cvss31(v), [label, color] = sev(r.base);
        const vec = "CVSS:3.1/" + Object.keys(M).map(k => `${k}:${v[k]}`).join("/");
        el.querySelector("[data-out]").innerHTML = `<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><b style="font-family:var(--f-mono);font-size:40px;color:${color};line-height:1">${r.base.toFixed(1)}</b><span class="chip" style="background:var(--sunken);color:${color};font-weight:600">${label}</span></div>
          <div class="meter" style="margin:10px 0"><i style="width:${r.base * 10}%;background:${color}"></i></div>
          <dl class="kv"><dt>ベクトル</dt><dd>${vec}</dd><dt>影響度（Impact）</dt><dd>${Math.max(0, r.impact).toFixed(2)}</dd><dt>攻撃容易性（Exploitability）</dt><dd>${r.expl.toFixed(2)}</dd></dl>`;
        ST.markLab("cvss");
      };
      ST.$$("[data-p]", el).forEach(b => b.onclick = () => { PRESETS[+b.dataset.p][1].split("/").forEach(x => { const [k, val] = x.split(":"); v[k] = val; }); draw(); });
      draw();
    }
  });

  /* ---------- Stack buffer overflow ---------- */
  ST.widget("overflow", {
    title: "バッファオーバーフロー：スタックのメモリを見る",
    group: "vuln", name: "バッファオーバーフロー", desc: "スタックのメモリを見る", order: 1,
    mount(el) {
      el.innerHTML = `<pre class="hexbox" style="margin:0;white-space:pre-wrap">void greet(const char *input) {
    char name[8];          <span style="color:var(--muted)">// 8バイトのバッファ</span>
    <span data-fn>strcpy(name, input);</span>   <span style="color:var(--muted)" data-fnc>// 長さを確認せずにコピー</span>
    printf("こんにちは %s\\n", name);
}                          <span style="color:var(--muted)">// ここで「戻り先アドレス」に戻る</span></pre>
        <div class="def"><label class="toggle"><input type="checkbox" id="ov-safe"><span>長さを制限してコピーする（snprintf 等）</span></label>
        <label class="toggle"><input type="checkbox" id="ov-can"><span>スタック保護（カナリア）を有効にする</span></label></div>
        <label class="field">入力<input class="input" id="ov-in" value="Taro" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
        <div class="btns"><button class="btn small" type="button" data-ex="Taro">Taro</button><button class="btn small" type="button" data-ex="Alexandra">9文字</button><button class="btn small" type="button" data-ex="AAAAAAAAAAAAAAAAAAAAAAAA">Aを24個</button></div>
        <div class="scroll-x"><div data-mem style="min-width:560px"></div></div><div data-v></div>`;
      const inp = el.querySelector("#ov-in");
      const upd = () => {
        const safe = el.querySelector("#ov-safe").checked, can = el.querySelector("#ov-can").checked;
        el.querySelector("[data-fn]").textContent = safe ? "snprintf(name, sizeof name, \"%s\", input);" : "strcpy(name, input);";
        el.querySelector("[data-fnc]").textContent = safe ? "// 最大7文字＋終端" : "// 長さを確認せずにコピー";
        const bytes = [...new TextEncoder().encode(inp.value)];
        let data = safe ? bytes.slice(0, 7).concat([0]) : bytes.concat([0]);
        const regions = [{ n: "name[8]", len: 8, c: "var(--c2)" }];
        if (can) regions.push({ n: "カナリア", len: 8, c: "var(--c5)", init: [0x00, 0x7e, 0x3a, 0x91, 0x5c, 0xd2, 0x08, 0xf1] });
        regions.push({ n: "保存されたフレームポインタ", len: 8, c: "var(--c8)", init: [0x40, 0xe1, 0xff, 0xff, 0xfe, 0x7f, 0, 0] });
        regions.push({ n: "戻り先アドレス", len: 8, c: "var(--c4)", init: [0x6c, 0x11, 0x40, 0, 0, 0, 0, 0] });
        let off = 0, html = "", hit = {};
        regions.forEach(r => {
          html += `<div style="display:inline-block;vertical-align:top;margin-right:6px"><div class="date" style="font-size:10px;color:${r.c}">${esc(r.n)}</div><div style="display:flex;gap:2px">`;
          for (let i = 0; i < r.len; i++) {
            const b = data[off + i], orig = r.init ? r.init[i] : 0, w = b !== undefined;
            if (w && r.n !== "name[8]") hit[r.n] = true;
            const val = w ? b : orig;
            html += `<div style="width:30px;text-align:center;border-radius:4px;padding:3px 0;font-family:var(--f-mono);font-size:10px;line-height:1.3;border:1.5px solid ${r.c};background:${w ? (r.n === "name[8]" ? "var(--link-soft)" : "var(--attack-soft)") : "var(--surface)"}"><div>${val.toString(16).padStart(2, "0")}</div><div style="color:var(--muted)">${w && val >= 32 && val < 127 ? esc(String.fromCharCode(val)) : "·"}</div></div>`;
          }
          html += `</div></div>`; off += r.len;
        });
        el.querySelector("[data-mem]").innerHTML = `<div class="cap" style="font-size:11px;margin-bottom:4px">低いアドレス → 高いアドレス（スタック上の並びを単純化して表示）</div>` + html;
        let msg;
        if (safe && bytes.length > 7) msg = `<div class="verdict good">入力は7文字で切り詰められ、バッファの外には書き込まれない</div>`;
        else if (hit["戻り先アドレス"] && can) msg = `<div class="verdict mid">カナリアの値が変わったことを検知し、プログラムを強制終了<p>関数から戻る前にカナリアを確認するため、戻り先アドレスへのジャンプは防げます。ただしプログラムは停止するので、サービス停止（DoS）にはなりえます。</p></div>`;
        else if (hit["戻り先アドレス"]) msg = `<div class="verdict bad">戻り先アドレスが入力で上書きされた<p>関数が終わると、書き換えられたアドレス（攻撃者が入力で指定した値）へ処理が移ります。入力を工夫すれば、攻撃者のコードを実行させられる危険があります（任意コード実行）。現代のOSにはASLRやDEPなどの対策もありますが、組み合わせて突破されることがあります。</p></div>`;
        else if (Object.keys(hit).length) msg = `<div class="verdict mid">バッファの外（${Object.keys(hit).join("、")}）まで書き込まれた<p>まだ戻り先アドレスには届いていませんが、隣のデータが壊れています。プログラムが異常終了するおそれがあります。</p></div>`;
        else msg = `<div class="verdict good">バッファの中に収まっている（終端の 00 を含めて8バイト以内）</div>`;
        el.querySelector("[data-v]").innerHTML = msg;
        if (Object.keys(hit).length) ST.markLab("overflow");
      };
      inp.oninput = upd; el.querySelector("#ov-safe").onchange = upd; el.querySelector("#ov-can").onchange = upd;
      ST.$$("[data-ex]", el).forEach(b => b.onclick = () => { inp.value = b.dataset.ex; upd(); });
      upd();
    }
  });
})(window.ST);
