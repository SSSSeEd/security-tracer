"use strict";
/* Pages: home, courses, course, lesson, lab, lab-item, sim, terms, term, quiz, news. */
(function (ST) {
  const esc = ST.esc, md = ST.md;

  /* Lab catalog: every interactive widget, grouped. */
  ST.LABS = [
    { g: "ネットワーク", color: "var(--c1)", items: [["encap", "カプセル化", "データがヘッダで包まれていく様子"], ["dns", "DNSとキャッシュポイズニング", "名前解決の流れと偽の応答"], ["tcp", "TCPとSYNフラッド", "3ウェイハンドシェイクと接続待ちの枯渇"], ["firewall", "ファイアウォール演習", "ルールを直して攻撃を止める"]] },
    { g: "暗号", color: "var(--c3)", items: [["hash", "ハッシュと雪崩効果", "本物のSHA-256で1文字の違いを見る"], ["crypto", "共通鍵・公開鍵・署名", "AES・RSA・ECDSAを実際に計算"], ["dh", "Diffie-Hellman鍵交換", "秘密を送らずに同じ鍵を作る"], ["tls", "TLS 1.3 ハンドシェイク", "鍵マークの裏側と、割り込みの検出"]] },
    { g: "認証", color: "var(--c2)", items: [["password", "パスワード強度", "長さと種類で破られるまでの目安"], ["auth", "認証方式 vs フィッシング", "SMSコードとパスキーの違い"], ["phishgame", "フィッシング判定", "怪しいメッセージを見破る練習"]] },
    { g: "Web", color: "var(--c6)", items: [["sqli", "SQLインジェクション", "入力がSQLの命令に変わる瞬間"], ["xss", "XSS", "入力がHTMLとして解釈される"], ["csrf", "CSRF", "罠サイトから勝手に送金"]] },
    { g: "マルウェア", color: "var(--c4)", items: [["malwaredex", "マルウェア図鑑", "種類ごとの特徴を比較"], ["worm", "ワームの拡散", "パッチ率と分割で広がりが変わる"], ["ransom", "ランサムウェア", "暗号化とバックアップの明暗"], ["botnet", "ボットネットとDDoS", "IoT機器が攻撃に加担する"]] },
    { g: "脆弱性", color: "var(--c5)", items: [["cvss", "CVSS計算機", "深刻度スコアを自分で計算"], ["overflow", "バッファオーバーフロー", "スタックのメモリを見る"]] },
    { g: "防御と運用", color: "var(--c7)", items: [["layers", "多層防御", "対策を重ねてリスクを減らす"], ["killchain", "キルチェーンとATT&CK", "攻撃をどこで断ち切るか"], ["logs", "ログ分析", "怪しい記録を見つける"]] }
  ];
  ST.LAB = {}; ST.LABS.forEach(g => g.items.forEach(([id, n, d]) => ST.LAB[id] = { id, n, d, g: g.g, color: g.color }));
  const lessonsUsing = w => Object.values(ST.LESSON).filter(l => l.blocks.some(b => b.w === w));
  const allLessons = () => ST.COURSES.flatMap(c => c.lessons);
  const nextLesson = () => allLessons().find(l => !ST.P.lessons[l.id]) || allLessons()[0];
  const sevChip = s => s === "緊急" ? `<span class="chip attack">緊急</span>` : s === "注意" ? `<span class="chip warn">注意</span>` : `<span class="chip">${esc(s || "情報")}</span>`;

  /* ---------- News source: static snapshot, replaced by the artifact DB when available ---------- */
  ST.NEWS = (ST.NEWS_STATIC || []).slice();
  ST.newsRow = (n, full) => `<div class="row newsitem"><div class="sev">${sevChip(n.severity)}</div><div class="body"><div class="date">${esc(n.date)} · ${esc(n.org || "")}</div><a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>${n.summary ? `<div class="s">${esc(n.summary)}</div>` : ""}
    ${full && (n.points || []).length ? `<ul class="pts">${n.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    ${full ? `<div class="tags">${(n.terms || []).filter(id => ST.TERM[id]).map(id => `<a class="tag" href="#term-${id}">${esc(ST.TERM[id].name)}</a>`).join("")}${n.verifiedAt ? `<span class="date">確認 ${esc(n.verifiedAt)}</span>` : ""}</div>` : ""}</div></div>`;

  /* ---------- Home ---------- */
  ST.view("home", v => {
    const L = allLessons(), done = L.filter(l => ST.P.lessons[l.id]).length;
    const labs = Object.keys(ST.LAB).filter(k => ST.P.labs[k]).length;
    const acc = ST.P.quiz.answered ? Math.round(ST.P.quiz.correct / ST.P.quiz.answered * 100) : 0;
    const nx = nextLesson(), c = ST.COURSE[nx.course];
    const today = ST.TERMS[Math.floor(Date.now() / 86400000) % ST.TERMS.length];
    const featured = ["sqli", "ransom", "worm", "crypto"];
    v.innerHTML = `
    <section class="hero" style="display:grid;gap:14px">
      <div><div class="eyebrow">Security Tracer · 情報セキュリティを動かして学ぶ</div>
      <h1>攻撃と防御を、目で見て、手で動かして理解する</h1>
      <p class="lead">8つのコースと${Object.keys(ST.LAB).length}個の図解ラボ、${ST.SCEN.length}本の攻撃シミュレーター。解説には必ず公的機関や一次情報へのリンクを付けています。</p></div>
      <div class="stats">
        <div class="stat"><b>${done}<span>/${L.length}</span></b><span>完了したレッスン</span></div>
        <div class="stat"><b>${labs}<span>/${Object.keys(ST.LAB).length}</span></b><span>触ったラボ</span></div>
        <div class="stat"><b>${acc}<span>%</span></b><span>クイズ正答率</span></div>
        <div class="stat"><b>${(ST.P.streak && ST.P.streak.days) || 0}<span>日</span></b><span>連続学習</span></div>
      </div>
    </section>
    <a class="card" href="#l-${nx.id}" style="text-decoration:none;color:inherit;display:flex;gap:14px;align-items:center;border-left:4px solid ${c.color}">
      <div style="flex:1;min-width:0"><div class="eyebrow">${done ? "続きから" : "最初のレッスン"} · ${esc(c.title)}</div><div style="font-size:18px;font-weight:700">${esc(nx.title)}</div><div class="cap">約${nx.min}分</div></div><span class="btn primary">開く ›</span></a>
    <section class="col">
      <div class="section-h"><h2>コース</h2><a href="#courses">すべて</a></div>
      <div class="course-grid">${ST.COURSES.map(courseCard).join("")}</div>
    </section>
    <section class="grid2">
      <div class="card"><div class="section-h"><h2>注目のラボ</h2><a href="#lab">すべて</a></div>
        <div class="list">${featured.map(id => { const l = ST.LAB[id]; return `<a class="row" href="#lab-${id}"><div class="body"><div class="t">${esc(l.n)}</div><div class="s">${esc(l.d)}</div></div><span class="chip" style="color:${l.color}">${esc(l.g)}</span></a>`; }).join("")}</div></div>
      <div class="col">
        <div class="card"><div class="section-h"><h2>最新の注意喚起</h2><a href="#news">ニュース</a></div><div class="list" data-home-news>${ST.NEWS.slice(0, 3).map(n => ST.newsRow(n)).join("") || `<p class="empty">ニュースはまだありません。</p>`}</div></div>
        <div class="card"><div class="eyebrow">今日の用語</div><a class="row" href="#term-${today.id}" style="border:0"><div class="body"><div class="term-name"><span class="t">${esc(today.name)}</span><span class="en">${esc(today.en)}</span></div><div class="s">${md(today.summary)}</div></div></a></div>
      </div>
    </section>
    <p class="notice">解説はClaudeが公的機関などの一次情報をもとに作成し、${ST.CHECKED} に出典を確認しました。誤りがありえるため、大事な判断の前には必ず出典を開いて確認してください。</p>`;
  });
  const courseCard = c => {
    const n = c.lessons.length, d = c.lessons.filter(l => ST.P.lessons[l.id]).length;
    return `<a class="card course" href="#course-${c.id}" style="--cc:${c.color}"><span class="bar"></span><div class="num">COURSE ${c.n} · ${d}/${n}</div><h3>${esc(c.title)}</h3><div class="s">${esc(c.desc)}</div>
      <div class="stations">${c.lessons.map((l, i) => `${i ? "<b></b>" : ""}<i class="${ST.P.lessons[l.id] ? "on" : ""}" title="${esc(l.title)}"></i>`).join("")}</div></a>`;
  };

  /* ---------- Courses ---------- */
  ST.view("courses", v => {
    v.innerHTML = `<div class="page-h"><div class="eyebrow">Courses</div><h1>コース</h1><p class="lead">上から順に進めると、ネットワークの基礎からニュースの読み解きまでつながります。どこから始めても大丈夫です。</p></div>
      <div class="course-grid">${ST.COURSES.map(courseCard).join("")}</div>`;
  });
  ST.view("course", (v, id) => {
    const c = ST.COURSE[id] || ST.COURSES[0];
    v.innerHTML = `<a href="#courses" style="font-size:14px">‹ コース一覧</a>
      <div class="page-h" style="--cc:${c.color}"><div class="eyebrow" style="color:${c.color}">COURSE ${c.n}</div><h1>${esc(c.title)}</h1><p class="lead">${esc(c.desc)}</p></div>
      <div class="card reading" style="--cc:${c.color}"><div class="line-list">${c.lessons.map((l, i) => `<a href="#l-${l.id}"><span class="dot ${ST.P.lessons[l.id] ? "on" : ""}"></span><div><div class="t">${i + 1}. ${esc(l.title)}</div><div class="s">約${l.min}分${l.blocks.filter(b => b.w).length ? " · 図解 " + l.blocks.filter(b => b.w).length + "つ" : ""}${ST.P.lessons[l.id] ? " · 完了" : ""}</div></div></a>`).join("")}</div></div>`;
  });

  /* ---------- Lesson ---------- */
  ST.view("lesson", (v, id) => {
    const l = ST.LESSON[id]; if (!l) return ST.views.courses(v);
    const c = ST.COURSE[l.course], prev = c.lessons[l.idx - 1], next = c.lessons[l.idx + 1] || (ST.COURSES[ST.COURSES.indexOf(c) + 1] || {}).lessons?.[0];
    const block = b => b.p ? `<p>${md(b.p)}</p>` : b.h ? `<h2>${esc(b.h)}</h2>` : b.list ? `<ul>${b.list.map(x => `<li>${md(x)}</li>`).join("")}</ul>`
      : b.w ? `<div data-widget="${b.w}" data-opts='${esc(JSON.stringify(b.o || {}))}'></div>` : b.callout ? `<div class="callout ${b.kind || "info"}">${md(b.callout)}</div>`
      : b.key ? `<div class="keypoints"><div class="eyebrow">このレッスンのポイント</div><ul>${b.key.map(x => `<li>${md(x)}</li>`).join("")}</ul></div>` : "";
    // Group consecutive prose blocks into reading columns; widgets span the full width.
    let html = "", buf = "";
    l.blocks.forEach(b => { if (b.w) { if (buf) { html += `<div class="prose">${buf}</div>`; buf = ""; } html += block(b); } else buf += block(b); });
    if (buf) html += `<div class="prose">${buf}</div>`;
    v.innerHTML = `<article class="lesson" style="--cc:${c.color}">
      <a href="#course-${c.id}" style="font-size:14px">‹ ${esc(c.title)}</a>
      <header><div class="eyebrow" style="color:${c.color}">COURSE ${c.n} · LESSON ${l.idx + 1}/${c.lessons.length} · 約${l.min}分</div><h1>${esc(l.title)}</h1></header>
      ${html}
      <div class="card"><div class="eyebrow">関連する用語</div><div class="filters" style="margin-top:8px">${l.terms.filter(t => ST.TERM[t]).map(t => `<a class="tag" href="#term-${t}">${esc(ST.TERM[t].name)}</a>`).join("")}</div>
        <div class="eyebrow" style="margin-top:14px;margin-bottom:6px">出典</div>${ST.srcList(l.src)}
        <p class="verify" style="margin-top:12px">出典確認日 ${ST.CHECKED}。本文はClaudeが出典をもとに作成した解説です。</p></div>
      <div class="lesson-nav">${prev ? `<a class="btn" href="#l-${prev.id}">‹ ${esc(prev.title)}</a>` : "<span></span>"}<button class="btn primary" type="button" data-done>${ST.P.lessons[l.id] ? "完了済み ✓" : "このレッスンを完了"}</button>${next ? `<a class="btn" href="#l-${next.id}">${esc(next.title)} ›</a>` : ""}</div>
    </article>`;
    v.querySelector("[data-done]").onclick = () => { ST.markLesson(l.id); next ? (location.hash = "l-" + next.id) : (location.hash = "course-" + c.id); };
  });

  /* ---------- Lab ---------- */
  ST.view("lab", v => {
    v.innerHTML = `<div class="page-h"><div class="eyebrow">Lab</div><h1>図解ラボ</h1><p class="lead">それぞれ単独で触れる実験台です。レッスンの中にも組み込まれています。</p></div>
      <section class="col"><div class="section-h"><h2>攻撃シミュレーター</h2><a href="#sim">開く</a></div>
        <div class="lab-grid">${ST.SCEN.map(s => `<a class="card lab-card" href="#sim-${s.id}" style="--cc:var(--packet)"><div class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="7" r="2.5"/><path d="M7.3 16 16.8 8.2"/><rect x="10" y="10" width="4.5" height="3.2" rx=".6" fill="currentColor"/></svg></div><b>${esc(s.title)}</b><span class="cap">${esc(s.tag)}${ST.P.sims[s.id] ? " · 済" : ""}</span></a>`).join("")}</div></section>
      ${ST.LABS.map(g => `<section class="col"><div class="section-h"><h2>${esc(g.g)}</h2></div><div class="lab-grid">${g.items.map(([id, n, d]) => `<a class="card lab-card" href="#lab-${id}" style="--cc:${g.color}"><div class="ico" style="color:${g.color}"><b class="mono" style="font-size:12px">${id.slice(0, 3).toUpperCase()}</b></div><b>${esc(n)}</b><span class="cap">${esc(d)}${ST.P.labs[id] ? " · 済" : ""}</span></a>`).join("")}</div></section>`).join("")}`;
  });
  ST.view("labitem", (v, id) => {
    const l = ST.LAB[id]; if (!l) return ST.views.lab(v);
    const ls = lessonsUsing(id), ts = ST.TERMS.filter(t => t.lab === id);
    v.innerHTML = `<a href="#lab" style="font-size:14px">‹ 図解ラボ</a><div class="page-h"><div class="eyebrow" style="color:${l.color}">${esc(l.g)}</div><h1>${esc(l.n)}</h1><p class="lead">${esc(l.d)}</p></div>
      <div data-widget="${id}"></div>
      <div class="grid2">${ls.length ? `<div class="card"><div class="eyebrow">このラボを使うレッスン</div><div class="list">${ls.map(x => `<a class="row" href="#l-${x.id}"><div class="body"><div class="t">${esc(x.title)}</div><div class="s">${esc(ST.COURSE[x.course].title)}</div></div></a>`).join("")}</div></div>` : ""}
      ${ts.length ? `<div class="card"><div class="eyebrow">関連する用語</div><div class="list">${ts.map(t => `<a class="row" href="#term-${t.id}"><div class="body"><div class="t">${esc(t.name)}</div><div class="s">${md(t.summary)}</div></div></a>`).join("")}</div></div>` : ""}</div>`;
  });

  /* ---------- Simulator ---------- */
  ST.view("sim", (v, id) => {
    const s = ST.SC[id] || ST.SCEN[0];
    v.innerHTML = `<div class="page-h"><div class="eyebrow">Simulation mode</div><h1>${esc(s.title)}</h1><p class="lead">${esc(s.intro)}</p></div>
      <div class="pills" role="group" aria-label="シナリオ">${ST.SCEN.map(x => `<button type="button" data-sc="${x.id}" aria-pressed="${x.id === s.id}">${esc(x.title)}</button>`).join("")}</div>
      <div data-widget="packetsim" data-opts='${esc(JSON.stringify({ id: s.id, title: "攻撃シミュレーター · " + s.title }))}'></div>
      <div class="card"><div class="eyebrow">関連する用語</div><div class="list">${s.terms.map(t => `<a class="row" href="#term-${t}"><div class="body"><div class="t">${esc(ST.TERM[t].name)}</div><div class="s">${md(ST.TERM[t].summary)}</div></div></a>`).join("")}</div></div>`;
    ST.$$("[data-sc]", v).forEach(b => b.onclick = () => { location.hash = "sim-" + b.dataset.sc; });
  });

  /* ---------- Terms ---------- */
  let termFilter = { q: "", cat: "すべて" };
  ST.view("terms", v => {
    v.innerHTML = `<div class="page-h"><div class="eyebrow">Glossary</div><h1>用語と仕組み</h1><p class="lead">${ST.TERMS.length}語。それぞれに仕組み・危険性・対策と、確認した出典を付けています。</p></div>
      <input class="search" id="term-q" type="search" placeholder="用語を検索（例: パスキー、CVE、ワーム）" value="${esc(termFilter.q)}" autocomplete="off">
      <div class="filters" role="group" aria-label="分類">${ST.TERM_CATS.map(c => `<button type="button" data-cat="${c}" aria-pressed="${c === termFilter.cat}">${c}</button>`).join("")}</div>
      <div class="card"><div class="list" data-tl></div></div>`;
    const draw = () => {
      const q = termFilter.q.trim().toLowerCase();
      const items = ST.TERMS.filter(t => (termFilter.cat === "すべて" || t.cat === termFilter.cat) && (!q || (t.name + t.en + t.summary).toLowerCase().includes(q)));
      v.querySelector("[data-tl]").innerHTML = items.length ? items.map(t => `<a class="row" href="#term-${t.id}"><div class="body"><div class="term-name"><span class="t">${esc(t.name)}</span><span class="en">${esc(t.en)}</span></div><div class="s">${esc(t.summary)}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="chip">${t.cat}</span>${ST.masteryDots(t.id)}</div></a>`).join("") : `<p class="empty">「${esc(termFilter.q)}」に一致する用語はありません。</p>`;
    };
    v.querySelector("#term-q").oninput = e => { termFilter.q = e.target.value; draw(); };
    ST.$$("[data-cat]", v).forEach(b => b.onclick = () => { termFilter.cat = b.dataset.cat; ST.$$("[data-cat]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
    draw();
  });
  ST.view("term", (v, id) => {
    const t = ST.TERM[id]; if (!t) return ST.views.terms(v);
    const st = ST.termStat(t.id); st.seen = (st.seen || 0) + 1; ST.P.terms[t.id] = st; ST.save();
    const rel = ST.NEWS.filter(n => (n.terms || []).includes(t.id));
    const ls = Object.values(ST.LESSON).filter(l => l.terms.includes(t.id));
    v.innerHTML = `<a href="#terms" style="font-size:14px">‹ 用語一覧</a>
      <article class="card detail">
        <div><div class="eyebrow">${esc(t.cat)} · ${esc(t.en)}</div><h1>${esc(t.name)}</h1><p class="lead" style="color:var(--ink);font-size:16px">${md(t.summary)}</p></div>
        <section><h2>仕組み</h2><p>${md(t.how)}</p></section>
        <section><h2>危険性</h2><p>${md(t.risk)}</p></section>
        <section><h2>対策</h2><ul>${t.defense.map(d => `<li>${md(d)}</li>`).join("")}</ul></section>
        ${t.lab && ST.LAB[t.lab] ? `<section><h2>図解で確かめる</h2><div data-widget="${t.lab}"></div></section>` : ""}
        ${t.sim ? `<section><h2>シミュレーション</h2><p><a class="btn" href="#sim-${t.sim}">「${esc(ST.SC[t.sim].title)}」を再生する ›</a></p></section>` : ""}
        ${ls.length ? `<section><h2>この用語が出てくるレッスン</h2><div class="list">${ls.map(l => `<a class="row" href="#l-${l.id}"><div class="body"><div class="t">${esc(l.title)}</div><div class="s">${esc(ST.COURSE[l.course].title)}</div></div></a>`).join("")}</div></section>` : ""}
        ${rel.length ? `<section><h2>関連ニュース</h2><div class="list">${rel.map(n => ST.newsRow(n)).join("")}</div></section>` : ""}
        <section><h2>出典</h2>${ST.srcList(t.src)}</section>
        <p class="verify">出典確認日 ${ST.CHECKED}。解説はClaudeが出典をもとに作成した要約です。正確な内容は出典で確認してください。</p>
      </article>`;
  });

  /* ---------- Quiz ---------- */
  let quiz = null;
  const buildQuiz = () => {
    const auto = ST.TERMS.map(t => {
      const pool = ST.shuffle(ST.TERMS.filter(o => o.id !== t.id && o.cat === t.cat));
      const others = pool.slice(0, 3); for (const o of ST.shuffle(ST.TERMS)) { if (others.length >= 3) break; if (o.id !== t.id && !others.includes(o)) others.push(o); }
      return { q: `次の説明に当てはまる用語は？\n「${t.summary.replace(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g, (m, i) => ST.TERM[i] ? ST.TERM[i].name : i)}」`, a: [t.name, ...others.map(o => o.name)], term: t.id, exp: t.how.replace(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g, (m, i) => ST.TERM[i] ? ST.TERM[i].name : i) };
    });
    const all = [...ST.QUIZ, ...auto].map(x => ({ ...x, w: ST.mastery(x.term) + Math.random() * 1.5 }));
    all.sort((a, b) => a.w - b.w);
    return all.slice(0, 10).map(x => ({ ...x, order: ST.shuffle(x.a.map((_, i) => i)) }));
  };
  ST.view("quiz", v => {
    if (!quiz || quiz.finished) quiz = { items: buildQuiz(), i: 0, score: 0, picked: null, finished: false };
    const draw = () => {
      if (quiz.finished) {
        v.innerHTML = `<div class="page-h"><div class="eyebrow">Quiz</div><h1>結果</h1></div><div class="card"><div class="stat" style="border:0;padding:0"><b>${quiz.score}<span> / ${quiz.items.length}</span></b><span>正解</span></div>
          <p class="lead">間違えた用語ほど、次回のクイズで先に出題されます。</p><div class="list">${[...new Set(quiz.items.map(x => x.term))].map(id => `<a class="row" href="#term-${id}"><div class="body"><div class="t">${esc(ST.TERM[id].name)}</div></div>${ST.masteryDots(id)}</a>`).join("")}</div>
          <div class="btns" style="margin-top:12px"><button class="btn primary" type="button" data-again>もう一度</button></div></div>`;
        v.querySelector("[data-again]").onclick = () => { quiz = null; ST.refresh(); };
        return;
      }
      const it = quiz.items[quiz.i], t = ST.TERM[it.term];
      v.innerHTML = `<div class="page-h"><div class="eyebrow">Quiz</div><h1>理解度チェック</h1></div>
        <div class="card reading" style="width:100%"><div class="q-meta"><span class="date">Q${quiz.i + 1} / ${quiz.items.length}</span><span class="chip">${esc(t.name)}</span></div>
        <p class="q-text">${esc(it.q)}</p><div class="q-opts">${it.order.map(i => `<button type="button" data-i="${i}">${esc(it.a[i])}</button>`).join("")}</div><div data-exp></div></div>`;
      ST.$$("[data-i]", v).forEach(b => b.onclick = () => answer(+b.dataset.i));
      if (quiz.picked !== null) show();
    };
    const answer = i => {
      if (quiz.picked !== null) return;
      const it = quiz.items[quiz.i]; quiz.picked = i; const ok = i === 0; if (ok) quiz.score++;
      const st = ST.termStat(it.term); ok ? st.c = (st.c || 0) + 1 : st.w = (st.w || 0) + 1; ST.P.terms[it.term] = st;
      ST.P.quiz.answered++; if (ok) ST.P.quiz.correct++; ST.touchStreak(); ST.save(); show();
    };
    const show = () => {
      const it = quiz.items[quiz.i], ok = quiz.picked === 0;
      ST.$$("[data-i]", v).forEach(b => { const i = +b.dataset.i; if (i === 0) b.classList.add("right"); else if (i === quiz.picked) b.classList.add("wrong"); b.disabled = true; });
      v.querySelector("[data-exp]").innerHTML = `<div style="margin-top:12px;font-size:14px"><span class="chip ${ok ? "ok" : "attack"}">${ok ? "正解" : "不正解"}</span> 正解は「${esc(it.a[0])}」<p style="margin:8px 0">${esc(it.exp)}</p><a href="#term-${it.term}">用語を確認する</a> · 出典: ${ST.TERM[it.term].src.map(k => `<a href="${esc(ST.SRC[k].url)}" target="_blank" rel="noopener">${esc(ST.SRC[k].org)}</a>`).join("、")}</div>
        <div class="btns" style="margin-top:12px"><button class="btn primary" type="button" data-next>${quiz.i + 1 < quiz.items.length ? "次の問題 ›" : "結果を見る"}</button></div>`;
      v.querySelector("[data-next]").onclick = () => { quiz.picked = null; quiz.i++; if (quiz.i >= quiz.items.length) quiz.finished = true; draw(); window.scrollTo(0, 0); };
    };
    draw();
  });

  /* ---------- News ---------- */
  const OFFICIAL = [["JPCERT/CC", "注意喚起", "https://www.jpcert.or.jp/at/"], ["IPA", "重要なセキュリティ情報", "https://www.ipa.go.jp/security/security-alert/index.html"], ["JVN", "脆弱性対策情報ポータル", "https://jvn.jp/"], ["CISA", "Known Exploited Vulnerabilities", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"], ["フィッシング対策協議会", "緊急情報・ニュース", "https://www.antiphishing.jp/"], ["IPA", "情報セキュリティ10大脅威", "https://www.ipa.go.jp/security/10threats/index.html"]];
  ST.view("news", v => {
    v.innerHTML = `<div class="page-h"><div class="eyebrow">News tracker</div><h1>注意喚起と脆弱性ニュース</h1><p class="lead">JPCERT/CC・IPAなどの一次情報だけを取り上げ、要点と関連用語を付けています。タイトルから原文を開けます。毎週更新します。</p></div>
      <div class="card"><div class="list">${ST.NEWS.map(n => ST.newsRow(n, true)).join("") || `<p class="empty">ニュースはまだありません。</p>`}</div></div>
      <div class="card"><div class="section-h"><h2>公式の情報源</h2></div><ul class="sources" style="margin-top:8px">${OFFICIAL.map(([o, l, u]) => `<li><span class="org">${esc(o)}</span><a href="${u}" target="_blank" rel="noopener">${esc(l)}</a></li>`).join("")}</ul></div>
      <p class="notice">ニュースは一次情報を開いて内容を確認したうえで登録しています。要約は原文の一部で、状況は更新されることがあります。対応の判断は必ず原文で行ってください。</p>`;
  });

  /* ---------- Routes ---------- */
  ST.route("home", "home", "home");
  ST.route("courses", "courses", "courses");
  ST.route("course-", "course", "courses");
  ST.route("l-", "lesson", "courses");
  ST.route("lab", "lab", "lab");
  ST.route("lab-", "labitem", "lab");
  ST.route("sim", "sim", "lab");
  ST.route("sim-", "sim", "lab");
  ST.route("terms", "terms", "terms");
  ST.route("term-", "term", "terms");
  ST.route("quiz", "quiz", "quiz");
  ST.route("news", "news", "news");
})(window.ST);
