"use strict";
/* Shared building blocks for widgets: sequence diagrams, step players, small charts. */
(function (ST) {
  const esc = ST.esc;
  const KIND = { normal: "var(--ink)", attack: "var(--attack)", ok: "var(--ok)", info: "var(--info)", packet: "var(--packet)", muted: "var(--muted)" };

  /* Fly a packet icon along a polyline inside an SVG. pts: [{x,y},...]; opts: {label, color, ms (per segment, default 700), blockAt (0..1 of the path: stop there and show a block mark), alive: () => bool}.
     Resolves when finished. With motion "off" it resolves at once (the caller still shows the result). */
  ST.flyPacket = (svg, pts, opts) => new Promise(res => {
    opts = opts || {};
    const k = ST.motionScale();
    if (!k || !svg.isConnected) return res();
    const color = opts.color || "var(--packet)", NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("pointer-events", "none");
    g.innerHTML = `<rect x="-11" y="-8" width="22" height="16" rx="2.5" fill="${color}"/><path d="M-11 -7 0 2 11 -7" fill="none" stroke="var(--surface)" stroke-width="1.5"/>${opts.label ? `<text y="-13" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600" fill="${color}">${esc(opts.label)}</text>` : ""}`;
    svg.appendChild(g);
    const seg = [], total = pts.slice(1).reduce((a, p, i) => { const d = Math.hypot(p.x - pts[i].x, p.y - pts[i].y); seg.push(d); return a + d; }, 0) || 1;
    const stop = opts.blockAt == null ? 1 : opts.blockAt, dur = (opts.ms || 700) * (pts.length - 1) * k * stop, t0 = performance.now();
    const at = f => { let d = f * total; for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const r = seg[i] ? Math.min(1, d / seg[i]) : 1; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r }; } d -= seg[i]; } return pts[pts.length - 1]; };
    const frame = now => {
      if (!g.isConnected || (opts.alive && !opts.alive())) { g.remove(); return res(); }
      const t = Math.min(1, (now - t0) / dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, p = at(e * stop);
      g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      if (t < 1) return requestAnimationFrame(frame);
      if (opts.blockAt != null) {
        g.innerHTML = `<circle r="11" fill="var(--ok)"/><path d="M-4.5 -4.5l9 9M4.5 -4.5l-9 9" stroke="var(--surface)" stroke-width="2.4"/>`;
        setTimeout(() => { g.remove(); res(); }, 450 * k);
      } else { g.remove(); res(); }
    };
    requestAnimationFrame(frame);
  });

  /* Sequence diagram with a step player.
     cfg: {actors:[{id,label,atk}], steps:[{f,t,label,note,kind,dash,block?}], height?, onDone?}
     Steps are revealed one at a time; the note of the latest step is shown under the diagram. */
  ST.seq = (el, cfg) => {
    const W = 360, top = 46, rowH = 38;
    const A = cfg.actors, n = A.length;
    const colX = i => Math.round(W / n * (i + 0.5));
    const xi = Object.fromEntries(A.map((a, i) => [a.id, colX(i)]));
    let shown = 1, timer = null, fly = false; /* 開いた時点で1コマ目を描く（空白をなくす） */
    el.innerHTML = `${cfg.intro ? `<p class="cap" style="margin:0">${ST.md(cfg.intro)}</p>` : ""}<div class="stage scroll-x"><svg viewBox="0 0 ${W} ${top + rowH * cfg.steps.length + 16}" role="img" aria-label="シーケンス図"></svg></div>
      <button class="btn primary big" type="button" data-a="next">次へ ›</button>
      <div class="btns two"><button class="btn" type="button" data-a="reset">↺ 最初から</button><button class="btn" type="button" data-a="all">▶ 自動再生</button></div>
      <div class="card" aria-live="polite" data-note style="padding:12px"></div>`;
    const svg = el.querySelector("svg"), note = el.querySelector("[data-note]");
    const draw = () => {
      const H = top + rowH * cfg.steps.length + 16;
      let s = A.map((a, i) => {
        const x = colX(i), w = Math.min(W / n - 6, 84);
        return `<line x1="${x}" y1="${top - 8}" x2="${x}" y2="${H - 4}" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="3 3"/>
          <rect x="${x - w / 2}" y="6" width="${w}" height="28" rx="6" fill="var(--surface)" stroke="${a.atk ? "var(--attack)" : "var(--ink)"}" stroke-width="1.2"/>
          <text x="${x}" y="24" text-anchor="middle" class="svg-t" style="font-size:${a.label.length > 6 ? 9.5 : 11}px" fill="${a.atk ? "var(--attack)" : "var(--ink)"}">${esc(a.label)}</text>`;
      }).join("");
      cfg.steps.slice(0, shown).forEach((st, i) => {
        const y = top + rowH * i + 24, x1 = xi[st.f], x2 = xi[st.t], c = KIND[st.kind || "normal"];
        const cur = i === shown - 1 ? 1 : 0.75;
        if (x1 === x2) {
          s += `<rect x="${x1 - 46}" y="${y - 15}" width="92" height="20" rx="4" fill="var(--surface)" stroke="${c}" opacity="${cur}"/><text x="${x1}" y="${y - 1}" text-anchor="middle" class="svg-t" style="font-size:9.5px" fill="${c}" opacity="${cur}">${esc(st.label)}</text>`;
        } else {
          const dir = x2 > x1 ? 1 : -1, end = st.block ? x1 + (x2 - x1) * 0.55 : x2 - dir * 3;
          s += `<line x1="${x1}" y1="${y}" x2="${end}" y2="${y}" stroke="${c}" stroke-width="${i === shown - 1 ? 2.2 : 1.6}" ${st.dash ? 'stroke-dasharray="5 3"' : ""} opacity="${cur}"/>`;
          if (st.block) s += `<g transform="translate(${end} ${y})"><circle r="8" fill="var(--ok)"/><path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" stroke="var(--surface)" stroke-width="2"/></g>`;
          else s += `<path d="M${end} ${y} l${-dir * 7} -4 v8z" fill="${c}" opacity="${cur}"/>`;
          const lx = (x1 + (st.block ? end : x2)) / 2;
          s += `<text x="${lx}" y="${y - 6}" text-anchor="middle" class="svg-t" style="font-size:9.5px;font-family:var(--f-mono)" fill="${c}" opacity="${cur}">${esc(st.label)}</text>`;
        }
        s += `<text x="4" y="${y + 3}" class="svg-m" style="font-size:9px">${i + 1}</text>`;
      });
      svg.innerHTML = s;
      const st = cfg.steps[shown - 1];
      note.innerHTML = shown === 0 ? `<div class="eyebrow">${cfg.steps.length} ステップ</div><p>${ST.md(cfg.intro || "「次へ」で1つずつ進みます。")}</p>`
        : `<div class="eyebrow"><span class="chip ok">ステップ ${shown} / ${cfg.steps.length}</span></div><p>${ST.md(st.note || st.label)}</p>${shown === cfg.steps.length && cfg.outro ? `<div class="verdict ${cfg.outroKind || "good"}" style="margin-top:10px">${ST.md(cfg.outro)}</div>` : ""}`;
      el.querySelector('[data-a="next"]').disabled = shown >= cfg.steps.length;
      el.querySelector('[data-a="all"]').disabled = shown >= cfg.steps.length;
      if (shown === cfg.steps.length && cfg.onDone) cfg.onDone();
      if (fly && shown > 0) {
        const st = cfg.steps[shown - 1], y = top + rowH * (shown - 1) + 24, x1 = xi[st.f], x2 = xi[st.t], my = shown;
        if (x1 !== x2) ST.flyPacket(svg, [{ x: x1, y }, { x: x2, y }], { ms: 600, color: st.kind && st.kind !== "normal" ? KIND[st.kind] : KIND.packet, blockAt: st.block ? 0.55 : null, alive: () => my === shown });
      }
      fly = false;
    };
    el.querySelector('[data-a="reset"]').onclick = () => { clearInterval(timer); shown = 1; draw(); };
    el.querySelector('[data-a="next"]').onclick = () => { clearInterval(timer); if (shown < cfg.steps.length) { shown++; fly = true; draw(); } };
    el.querySelector('[data-a="all"]').onclick = () => {
      clearInterval(timer);
      timer = setInterval(() => { if (shown >= cfg.steps.length) return clearInterval(timer); shown++; fly = true; draw(); }, ST.motion === "off" ? 150 : 1100 * Math.max(1, ST.motionScale() * .8));
    };
    draw();
    return { stop: () => clearInterval(timer), redraw: draw, setSteps: steps => { cfg.steps = steps; shown = 1; draw(); } };
  };

  /* Segmented control: returns html; wire with ST.wireSeg(el, name, fn). */
  ST.segHtml = (name, options, value) => `<div class="seg" role="group" data-seg="${name}">${options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${esc(l)}</button>`).join("")}</div>`;
  ST.wireSeg = (root, name, fn) => ST.$$(`[data-seg="${name}"] button`, root).forEach(b => b.onclick = () => {
    ST.$$(`[data-seg="${name}"] button`, root).forEach(x => x.setAttribute("aria-pressed", x === b));
    fn(b.dataset.v);
  });

  /* Small line chart (inline SVG). series: [{values:[...], color, label}] */
  ST.lineChart = (series, opts) => {
    const W = 340, H = 140, pl = 30, pr = 8, pt = 10, pb = 22;
    const n = Math.max(...series.map(s => s.values.length), 2), max = opts.max || Math.max(1, ...series.flatMap(s => s.values));
    const x = i => pl + (W - pl - pr) * i / (n - 1), y = v => pt + (H - pt - pb) * (1 - v / max);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "グラフ")}">`;
    [0, .5, 1].forEach(f => { const v = max * f; s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 4}" y="${y(v) + 3}" text-anchor="end" class="svg-m" style="font-size:9px">${Math.round(v)}${opts.unit || ""}</text>`; });
    s += `<text x="${W - pr}" y="${H - 6}" text-anchor="end" class="svg-m" style="font-size:9px">${esc(opts.xLabel || "")}</text>`;
    series.forEach(se => {
      if (!se.values.length) return;
      const pts = se.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      if (se.fill) s += `<polygon points="${x(0)},${y(0)} ${pts} ${x(se.values.length - 1)},${y(0)}" fill="${se.color}" opacity=".15"/>`;
      s += `<polyline points="${pts}" fill="none" stroke="${se.color}" stroke-width="2"/>`;
      const li = se.values.length - 1; s += `<circle cx="${x(li)}" cy="${y(se.values[li])}" r="3" fill="${se.color}"/>`;
    });
    return s + "</svg>";
  };

  /* Hex helpers */
  ST.hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  ST.sha256 = async text => ST.hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
})(window.ST);
