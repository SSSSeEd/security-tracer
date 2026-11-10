"use strict";
/* RED LINE: 「どこからが違法か」の注意枠 (ST.legalBox) と、アウトの線を体感する練習場ページ (#redline)。
   ここで動くものはすべてブラウザ内の模擬で、実在の機器には何もしない。攻撃の手順やコードは載せない。 */
(function (ST) {
  const L = ST.LEGAL, esc = ST.esc, md = ST.md;
  const LABEL = { safe: "セーフ", out: "アウト", gray: "グレー" };

  const lawLine = k => { const x = L.laws[k]; return x ? `<li><b>${esc(x.name)}</b><span class="lg-art">${esc(x.art)}${x.unconfirmed ? " ・要確認" : ""}</span><br>${esc(x.pt)}</li>` : ""; };

  /* 各ページに差し込む注意枠。area は ST.LEGAL.areas のキー */
  ST.legalBox = area => {
    const a = L.areas[area]; if (!a) return "";
    const srcs = [...new Set(a.laws.flatMap(k => L.laws[k].src))];
    return `<details class="legal"><summary><span class="lg-tag">RED LINE</span><span class="lg-sum">どこからが違法？</span><small>タップで開く</small></summary>
      <div class="lg-body"><p class="lg-line">${esc(a.line)}</p>
        <div class="lg-cols"><div class="lg-out"><h3>⛔ アウトになりうる</h3><ul>${a.out.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="lg-ok"><h3>✅ 合法に試すなら</h3><ul>${a.ok.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
        ${a.note ? `<p class="lg-note">${esc(a.note)}</p>` : ""}
        <h3>関係する法律</h3><ul class="lg-laws">${a.laws.map(lawLine).join("")}</ul>
        ${srcs.length ? ST.srcList(srcs) : ""}
        <p><a class="btn rl-btn" href="#redline">RED LINE 練習場へ ›</a></p>
        <p class="lg-disc">${esc(L.disclaimer)}</p></div></details>`;
  };
  ST.legalAreaOf = { course: id => L.byCourse[id], group: id => L.byGroup[id], cat: c => L.byCat[c], sim: id => L.bySim[id] };

  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const btns3 = attr => ["safe", "gray", "out"].map(k => `<button type="button" class="rl-pick ${k}" ${attr}="${k}">${LABEL[k]}</button>`).join("");

  let tab = "judge";
  ST.view("redline", v => {
    const TABS = [["judge", "判定ゲーム"], ["battle", "対戦"], ["ops", "攻防端末"], ["sim", "ターン制対戦"], ["dojo", "合法の練習場"], ["laws", "法律ミニ辞典"]];
    /* judge game state */
    let J = null, B = null;
    const startJ = () => { J = { items: shuffle(L.cases), i: 0, score: 0, picked: null }; };
    const startB = () => { B = { r: 0, total: 6, used: new Set(), score: [0, 0], phase: "pick", hand: [], card: null, guess: null }; deal(); };
    const deal = () => { const pool = shuffle(L.cases.map((c, i) => i).filter(i => !B.used.has(i))); B.hand = pool.slice(0, 3); B.card = null; B.guess = null; B.phase = "pick"; };

    const judgeHtml = () => {
      if (J.i >= J.items.length) return `<div class="rl-card"><div class="rl-big">${J.score} / ${J.items.length}</div><p>線引きの感覚は、数を重ねると身につきます。迷ったら「やらない・許可を取る」が基本です。</p><button class="btn rl-btn" type="button" data-again>もう一度</button></div>`;
      const c = J.items[J.i], done = J.picked !== null, ok = J.picked === c.a;
      return `<div class="rl-card"><div class="rl-cap">CASE ${J.i + 1} / ${J.items.length}</div><p class="rl-q">${esc(c.q)}</p>
        ${done ? `<div class="rl-res ${c.a}"><b>${ok ? "正解" : "ざんねん"}：${LABEL[c.a]}</b><p>${esc(c.why)}</p></div><button class="btn rl-btn" type="button" data-next>${J.i + 1 < J.items.length ? "次へ ›" : "結果を見る"}</button>` : `<div class="rl-picks">${btns3("data-j")}</div>`}</div>`;
    };

    const battleHtml = () => {
      const a = B.r % 2, d = 1 - a, nm = i => `P${i + 1}`;
      const board = `<div class="rl-score"><span>P1 <b>${B.score[0]}</b></span><span class="rl-cap">ROUND ${Math.min(B.r + 1, B.total)}/${B.total}</span><span>P2 <b>${B.score[1]}</b></span></div>`;
      if (B.r >= B.total) { const w = B.score[0] === B.score[1] ? "引き分け" : B.score[0] > B.score[1] ? "P1 の勝ち" : "P2 の勝ち"; return `${board}<div class="rl-card"><div class="rl-big">${w}</div><p>だます側は「ほんとはアウトなのに、セーフに見える」場面を選ぶのがコツ。見抜く側は理由まで考えると強くなります。</p><button class="btn rl-btn" type="button" data-again>もう一度</button></div>`; }
      if (B.phase === "pick") return `${board}<div class="rl-card"><div class="rl-cap">${nm(a)}（出す側）の番 · ${nm(d)}は画面を見ないでください</div><p>どれか1つ選ぶと、相手がセーフ／アウトを当てます。相手が外せば、あなたの得点です。</p>
        ${B.hand.map(i => `<button type="button" class="rl-hand" data-h="${i}">${esc(L.cases[i].q)}</button>`).join("")}</div>`;
      if (B.phase === "pass") return `${board}<div class="rl-card"><p class="rl-q">端末を ${nm(d)} に渡してください</p><button class="btn rl-btn" type="button" data-show>${nm(d)}：準備できた ›</button></div>`;
      const c = L.cases[B.card];
      if (B.phase === "guess") return `${board}<div class="rl-card"><div class="rl-cap">${nm(d)}（当てる側）の番</div><p class="rl-q">${esc(c.q)}</p><div class="rl-picks">${btns3("data-g")}</div></div>`;
      const hit = B.guess === c.a;
      return `${board}<div class="rl-card"><p class="rl-q">${esc(c.q)}</p><div class="rl-res ${c.a}"><b>答え：${LABEL[c.a]}</b>（${nm(d)}の予想：${LABEL[B.guess]} → ${hit ? nm(d) + " の得点" : nm(a) + " の得点"}）<p>${esc(c.why)}</p></div><button class="btn rl-btn" type="button" data-bnext>${B.r + 1 < B.total ? "次のラウンド ›" : "結果を見る"}</button></div>`;
    };

    const dojoHtml = () => `<div class="rl-card"><h2>始める前の3つ</h2><ol class="rl-steps"><li><b>誰のものか</b>：自分の機器、または書面などで明確に許可をもらった相手だけ。</li><li><b>どこまでか</b>：許された範囲（対象と時間）から出ない。迷ったらやらない。</li><li><b>外とつなげない</b>：練習用の穴だらけのアプリは、仮想マシンの中だけで動かし、インターネットに公開しない。</li></ol></div>
      ${L.practice.map(p => `<div class="rl-card"><h3>${esc(p.name)}</h3><p>${esc(p.d)}</p>${p.src.length ? ST.srcList(p.src) : ""}</div>`).join("")}
      <p class="cap">具体的な操作手順は載せていません。各サイトの公式の説明とルールを読んでから始めてください。</p>`;
    const lawsHtml = () => `<ul class="lg-laws rl-laws">${Object.keys(L.laws).map(lawLine).join("")}</ul>${ST.srcList([...new Set(Object.values(L.laws).flatMap(x => x.src))])}<p class="cap">このサイトの「法律と倫理」コースも合わせて読んでください：<a href="#course-law">コースを開く</a></p>`;

    const draw = () => {
      const body = tab === "judge" ? judgeHtml() : tab === "battle" ? battleHtml() : tab === "sim" ? `<div class="rl-sim" style="padding:0"><div data-widget="battle"></div></div>` : tab === "ops" ? `<div class="rl-sim" style="padding:0"><div data-widget="ops"></div></div>` : tab === "dojo" ? dojoHtml() : lawsHtml();
      v.innerHTML = `<div class="redline"><div class="rl-tape" aria-hidden="true"></div>
        <div class="rl-head"><div class="rl-eyebrow">// RED LINE</div><h1 class="rl-glitch" data-t="RED LINE">RED LINE</h1>
          <p class="rl-lead">アウトの線を、先に踏んで知る場所。ここの中身はぜんぶブラウザ内の模擬。<b>実在の機器には何もしません。</b></p></div>
        <div class="rl-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${n}</button>`).join("")}</div>
        <div class="rl-body">${body}</div>
        <p class="lg-disc">${esc(L.disclaimer)}</p><div class="rl-tape" aria-hidden="true"></div></div>`;
      if (tab === "sim" || tab === "ops") ST.mountAll(v);
      ST.$$("[data-tab]", v).forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === "judge" && J.i >= J.items.length) startJ(); draw(); });
      const on = (sel, fn) => ST.$$(sel, v).forEach(b => b.onclick = () => fn(b));
      on("[data-j]", b => { J.picked = b.dataset.j; if (J.picked === J.items[J.i].a) J.score++; draw(); });
      on("[data-next]", () => { J.i++; J.picked = null; draw(); });
      on("[data-again]", () => { tab === "battle" ? startB() : startJ(); draw(); });
      on("[data-h]", b => { B.card = +b.dataset.h; B.used.add(B.card); B.phase = "pass"; draw(); });
      on("[data-show]", () => { B.phase = "guess"; draw(); });
      on("[data-g]", b => { B.guess = b.dataset.g; const hit = B.guess === L.cases[B.card].a; B.score[hit ? 1 - B.r % 2 : B.r % 2]++; B.phase = "result"; draw(); });
      on("[data-bnext]", () => { B.r++; if (B.r < B.total) deal(); draw(); window.scrollTo(0, 0); });
    };
    startJ(); startB(); draw();
  });
  ST.route("redline", "redline", "lab");
})(window.ST);
