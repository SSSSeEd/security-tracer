"use strict";
/* Packet-level attack simulator in the style of a network simulator's "simulation mode". opts: {id: scenario id} */
(function (ST) {
  const esc = ST.esc;
  ST.widget("packetsim", {
    title: "攻撃シミュレーター",
    lab: false,
    mount(el, opts) {
      const s = ST.SC[opts.id] || ST.SCEN[0];
      const sim = { i: 0, on: new Set(), log: [], playing: false, done: null, t: 0, busy: false, alive: true };
      const N = Object.fromEntries(s.nodes.map(n => [n.id, n]));
      const topo = () => {
        const lines = s.links.map(([a, b, d]) => `<line class="lnk${d ? " dash" : ""}" x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"/>`).join("");
        const nodes = s.nodes.map(n => `<g data-node="${n.id}" transform="translate(${n.x} ${n.y})"><circle r="24" fill="var(--surface)" stroke="var(--line)"/><use href="#i-${n.type}" x="-14" y="-14" width="28" height="28" class="n-ico${n.type === "attacker" ? " atk" : ""}${n.opt && !sim.on.has(n.opt) ? " dim" : ""}"/><text class="n-label" y="40" text-anchor="middle">${esc(n.label)}</text></g>`).join("");
        return `<svg viewBox="0 0 360 260" role="img" aria-label="${esc(s.title)}のネットワーク図">${lines}${nodes}<g data-pkt opacity="0"><rect x="-13" y="-9" width="26" height="18" rx="2.5" fill="var(--packet)"/><path d="M-13 -8 0 2 13 -8" fill="none" stroke="var(--surface)" stroke-width="1.6"/><text data-pl y="-14" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="600" fill="var(--packet)"></text></g><g data-x opacity="0"><circle r="12" fill="var(--ok)"/><path d="M-5 0l3.5 3.5L5.5-4" stroke="var(--surface)" stroke-width="2.4" fill="none"/></g></svg>`;
      };
      el.innerHTML = `<div class="grid2">
        <div class="col"><div class="topo"><span class="mode">SIMULATION</span><span class="clock" data-clock>0.000 s</span>${topo()}</div>
          <div class="btns"><button class="btn" type="button" data-a="reset">↺ リセット</button><button class="btn" type="button" data-a="step">次のイベント ›</button><button class="btn primary" type="button" data-a="play">▶ 自動再生</button></div>
          <div class="card" data-step aria-live="polite"></div></div>
        <div class="col"><div class="card"><div class="section-h"><h2 style="font-size:16px">防御を切り替える</h2></div><p class="cap" style="margin:4px 0 10px">オンにしてから再生すると、どの段階で攻撃が止まるかが分かります。</p>
          <div class="def">${s.defs.map(d => `<label class="toggle"><input type="checkbox" data-def="${d.id}" id="ps-${s.id}-${d.id}"><span><span>${esc(d.label)}</span><br><span class="d">${esc(d.d)} · <a href="#term-${d.term}">${esc(ST.TERM[d.term] ? ST.TERM[d.term].name : d.term)}</a></span></span></label>`).join("")}</div></div>
          <div class="card"><div class="section-h"><h2 style="font-size:16px">イベントリスト</h2></div><div class="scroll-x" data-ev></div></div></div></div>`;
      const $ = q => el.querySelector(q);
      const draw = () => {
        $("[data-clock]").textContent = sim.t.toFixed(3) + " s";
        const card = $("[data-step]");
        if (sim.done) {
          const cls = sim.done === "good" ? "good" : sim.done === "mid" ? "mid" : "bad", last = sim.log[sim.log.length - 1];
          card.innerHTML = `<div class="outcome ${cls}">${esc(sim.done === "good" ? s.good : sim.done === "mid" ? s.mid : s.bad)}<p>${sim.done === "bad" ? "防御をオンにして、もう一度再生してみましょう。" : "どの防御がどの段階で効いたかを、イベントリストで確認できます。"}</p></div>${last && last.note ? `<div class="${sim.done === "good" ? "blocked-note" : "mitig-note"}" style="margin-top:10px">${esc(last.note)}</div>` : ""}`;
        } else if (sim.i === 0) card.innerHTML = `<div class="eyebrow">準備完了</div><h3 style="font-size:16px;margin:4px 0">${s.steps.length}個のイベントがあります</h3><p>${esc(s.intro)}</p>`;
        else { const st = s.steps[sim.i - 1]; card.innerHTML = `<div class="eyebrow">イベント ${sim.i}/${s.steps.length} · ${esc(N[st.f].label)} → ${esc(N[st.t].label)} <span class="chip packet mono">${esc(st.p)}</span></div><h3 style="font-size:16px;margin:4px 0">${esc(st.title)}</h3><p>${esc(st.text)}</p>${st.mitig && sim.on.has(st.mitig) ? `<div class="mitig-note" style="margin-top:10px">${esc(st.mitigText)}</div>` : ""}`; }
        $("[data-ev]").innerHTML = sim.log.length ? `<table class="tbl"><thead><tr><th>時間(秒)</th><th>送信元</th><th>宛先</th><th>種類</th><th>結果</th></tr></thead><tbody>${sim.log.map(e => `<tr><td class="num">${e.time.toFixed(3)}</td><td>${esc(N[e.f].label)}</td><td>${esc(N[e.to].label)}</td><td style="white-space:nowrap"><span class="sq${e.blocked ? " x" : ""}"></span><span class="mono">${esc(e.p)}</span></td><td>${e.blocked ? `<span class="chip ok">遮断</span>` : e.mitig ? `<span class="chip warn">軽減</span>` : `<span class="chip attack">通過</span>`}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">まだイベントはありません。</p>`;
        $('[data-a="step"]').disabled = !!sim.done || sim.busy; $('[data-a="play"]').disabled = !!sim.done || sim.playing;
      };
      const animate = (from, to, label, blocked) => new Promise(res => {
        const p = $("[data-pkt]"), x = $("[data-x]");
        $("[data-pl]").textContent = label; p.setAttribute("opacity", "1"); x.setAttribute("opacity", "0");
        const end = blocked ? .5 : 1, dur = ST.reduceMotion ? 0 : 900 * end, t0 = performance.now();
        const frame = now => {
          if (!sim.alive) return res();
          const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, r = e * end;
          p.setAttribute("transform", `translate(${from.x + (to.x - from.x) * r} ${from.y + (to.y - from.y) * r})`);
          if (k < 1) requestAnimationFrame(frame);
          else { if (blocked) { p.setAttribute("opacity", "0"); x.setAttribute("transform", `translate(${from.x + (to.x - from.x) * .5} ${from.y + (to.y - from.y) * .5})`); x.setAttribute("opacity", "1"); } res(); }
        };
        requestAnimationFrame(frame);
      });
      const step = async () => {
        if (sim.done || sim.busy) return;
        const st = s.steps[sim.i], blocked = !!(st.block && sim.on.has(st.block)), mitig = !!(st.mitig && sim.on.has(st.mitig));
        sim.busy = true; draw();
        await animate(N[st.f], N[st.t], st.p, blocked);
        if (!sim.alive) return;
        sim.busy = false; sim.t += 0.001 + Math.round(Math.random() * 400) / 1000; sim.i++;
        sim.log.push({ time: sim.t, f: st.f, to: st.t, p: st.p, blocked, mitig, note: blocked ? st.blockText : mitig ? st.mitigText : "" });
        if (blocked) sim.done = "good"; else if (sim.i >= s.steps.length) sim.done = sim.log.some(e => e.mitig) ? "mid" : "bad";
        if (sim.done) { sim.playing = false; ST.P.sims[s.id] = { result: sim.done, at: Date.now() }; ST.touchStreak(); ST.save(); }
        draw();
      };
      const reset = () => {
        sim.i = 0; sim.log = []; sim.done = null; sim.t = 0; sim.playing = false;
        $("[data-pkt]").setAttribute("opacity", "0"); $("[data-x]").setAttribute("opacity", "0");
        s.nodes.forEach(n => { if (!n.opt) return; const u = el.querySelector(`[data-node="${n.id}"] use`); if (u) u.classList.toggle("dim", !sim.on.has(n.opt)); });
        draw();
      };
      ST.$$("[data-def]", el).forEach(c => c.onchange = () => { c.checked ? sim.on.add(c.dataset.def) : sim.on.delete(c.dataset.def); reset(); });
      $('[data-a="reset"]').onclick = reset;
      $('[data-a="step"]').onclick = () => { if (!sim.playing) step(); };
      $('[data-a="play"]').onclick = async () => {
        if (sim.playing || sim.done) return; sim.playing = true; draw();
        while (sim.playing && !sim.done && sim.alive) { await step(); if (sim.done || !sim.playing) break; await ST.sleep(700); }
        sim.playing = false; if (sim.alive) draw();
      };
      draw();
      return () => { sim.alive = false; sim.playing = false; };
    }
  });
})(window.ST);
