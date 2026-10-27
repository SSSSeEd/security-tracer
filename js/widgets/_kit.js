"use strict";
/* Shared building blocks for widgets: sequence diagrams, step players, small charts. */
(function (ST) {
  const esc = ST.esc;
  const KIND = { normal: "var(--ink)", attack: "var(--attack)", ok: "var(--ok)", info: "var(--info)", packet: "var(--packet)", muted: "var(--muted)" };

  /* Sequence diagram with a step player.
     cfg: {actors:[{id,label,atk}], steps:[{f,t,label,note,kind,dash,block?}], height?, onDone?}
     Steps are revealed one at a time; the note of the latest step is shown under the diagram. */
  ST.seq = (el, cfg) => {
    const W = 360, top = 46, rowH = 38;
    const A = cfg.actors, n = A.length;
    const colX = i => Math.round(W / n * (i + 0.5));
    const xi = Object.fromEntries(A.map((a, i) => [a.id, colX(i)]));
    let shown = 0, timer = null;
    el.innerHTML = `<div class="stage scroll-x"><svg viewBox="0 0 ${W} ${top + rowH * cfg.steps.length + 16}" role="img" aria-label="シーケンス図"></svg></div>
      <div class="btns"><button class="btn small" type="button" data-a="reset">↺ 最初から</button><button class="btn small" type="button" data-a="next">次へ ›</button><button class="btn small primary" type="button" data-a="all">▶ 再生</button></div>
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
        : `<div class="eyebrow">ステップ ${shown}/${cfg.steps.length}</div><p>${ST.md(st.note || st.label)}</p>${shown === cfg.steps.length && cfg.outro ? `<div class="verdict ${cfg.outroKind || "good"}" style="margin-top:10px">${ST.md(cfg.outro)}</div>` : ""}`;
      el.querySelector('[data-a="next"]').disabled = shown >= cfg.steps.length;
      el.querySelector('[data-a="all"]').disabled = shown >= cfg.steps.length;
      if (shown === cfg.steps.length && cfg.onDone) cfg.onDone();
    };
    el.querySelector('[data-a="reset"]').onclick = () => { clearInterval(timer); shown = 0; draw(); };
    el.querySelector('[data-a="next"]').onclick = () => { clearInterval(timer); if (shown < cfg.steps.length) { shown++; draw(); } };
    el.querySelector('[data-a="all"]').onclick = () => {
      clearInterval(timer);
      timer = setInterval(() => { if (shown >= cfg.steps.length) return clearInterval(timer); shown++; draw(); }, ST.reduceMotion ? 150 : 1100);
    };
    draw();
    return { stop: () => clearInterval(timer), redraw: draw, setSteps: steps => { cfg.steps = steps; shown = 0; draw(); } };
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
