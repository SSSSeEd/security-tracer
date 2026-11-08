"use strict";
/* 攻防対戦：架空の会社ネットワークの中だけで動く、ターン制の擬似対戦（CPU相手）。
   実在の機器には何もしない。手の名前は概念レベルで、攻撃の手順やコードは含まない。
   「アウト」の手は、現実では他人に向けると犯罪になりうる行為を、模擬の中だけで再現したもの。 */
(function (ST) {
  const esc = ST.esc;
  const NODES = [
    { id: "net", label: "インターネット", x: 36, y: 60, i: "attacker" },
    { id: "gate", label: "入口（メール・公開Web）", lines: ["入口", "メール・公開Web"], x: 120, y: 60, i: "server" },
    { id: "pc", label: "社員PC", x: 204, y: 60, i: "pc" },
    { id: "lan", label: "社内LAN", x: 288, y: 60, i: "router" },
    { id: "data", label: "重要データ", x: 324, y: 150, i: "server" }
  ];
  /* 攻撃の手：stage は「次に進む段階」。out:true は現実では違法になりうる行為。counter はそれを止められる防御 */
  const ATK = [
    { id: "phish", stage: 1, name: "偽メールで誘導する", out: true, counter: ["mail", "train"] },
    { id: "guess", stage: 1, name: "パスワードを次々に試す", out: true, counter: ["mfa"] },
    { id: "old", stage: 1, name: "公開サーバーの古い弱点を突く", out: true, counter: ["patch"] },
    { id: "run", stage: 2, name: "不正なアプリを実行させる", out: true, counter: ["edr", "train"] },
    { id: "cred", stage: 2, name: "盗んだ認証情報で入る", out: true, counter: ["mfa"] },
    { id: "lat", stage: 3, name: "同じ認証情報で社内の他の機器へ", out: true, counter: ["seg", "mfa"] },
    { id: "adm", stage: 3, name: "管理者の権限を奪う", out: true, counter: ["priv", "edr"] },
    { id: "leak", stage: 4, name: "データをまとめて外へ送る", out: true, counter: ["mon", "seg"] },
    { id: "ransom", stage: 4, name: "データを暗号化して身代金を要求する", out: true, counter: ["backup", "mon"] }
  ];
  const DEF = [
    { id: "mail", name: "メールフィルタ", d: "怪しいメールを入口で止める" },
    { id: "train", name: "社員の訓練", d: "怪しいメールや添付に気づけるようにする" },
    { id: "mfa", name: "多要素認証", d: "パスワードが漏れても入れないようにする" },
    { id: "patch", name: "パッチ適用", d: "公開機器の古い弱点をふさぐ" },
    { id: "edr", name: "端末の監視（EDR）", d: "PC上の怪しい動きを検知する" },
    { id: "seg", name: "ネットワーク分離", d: "社内LANの中の行き来を制限する" },
    { id: "priv", name: "最小権限", d: "管理者権限を持つ人と場面を絞る" },
    { id: "mon", name: "ログ監視", d: "外への大量通信などに気づく" },
    { id: "backup", name: "バックアップ", d: "暗号化されても元に戻せるようにする" }
  ];
  const D = Object.fromEntries(DEF.map(d => [d.id, d]));
  const A = Object.fromEntries(ATK.map(a => [a.id, a]));
  const ROUNDS = 6;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  ST.widget("battle", {
    title: "攻防対戦 · 架空の会社ネットワーク",
    motion: true,
    mount(el) {
      let S, alive = true;
      const reset = role => { S = { role, pos: 0, round: 1, def: new Set(), log: [], know: false, tip: false, caught: 0, busy: false, end: null, last: null }; };
      reset(null);
      const $ = q => el.querySelector(q);
      const avail = () => ATK.filter(a => a.stage === S.pos + 1);

      const svgHtml = () => {
        const N = Object.fromEntries(NODES.map(n => [n.id, n]));
        const path = [["net", "gate"], ["gate", "pc"], ["pc", "lan"], ["lan", "data"]];
        let s = path.map(([a, b], i) => `<line class="lnk${i >= S.pos ? " dash" : ""}" x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"${i < S.pos ? ' style="stroke:var(--attack);stroke-width:3"' : ""}/>`).join("");
        s += NODES.map((n, i) => `<g transform="translate(${n.x} ${n.y})"><circle r="22" fill="var(--surface)" stroke="${i === S.pos ? "var(--attack)" : "var(--line)"}" stroke-width="${i === S.pos ? 3 : 1.5}"/><use href="#i-${n.i}" x="-13" y="-13" width="26" height="26" class="n-ico${n.i === "attacker" ? " atk" : ""}"/><text class="n-label" text-anchor="middle" style="font-size:9px">${(n.lines || [n.label]).map((t, k) => `<tspan x="0" y="${38 + k * 11}">${esc(t)}</tspan>`).join("")}</text></g>`).join("");
        return `<svg data-s viewBox="0 0 360 200" role="img" aria-label="会社ネットワークの図。攻撃側は${esc(NODES[S.pos].label)}まで進んでいる">${s}<text x="8" y="20" class="svg-m" style="font-size:10px">${S.def.size ? "配備中の防御：" + S.def.size + "個" : "防御はまだありません"}</text></svg>`;
      };

      const head = () => `<div class="rl-score"><span>ROUND <b>${Math.min(S.round, ROUNDS)}</b>/${ROUNDS}</span><span class="rl-cap">${S.role === "atk" ? "あなた：攻撃側（CPUが防御）" : "あなた：防御側（CPUが攻撃）"}</span></div>`;

      const logHtml = () => S.log.length ? `<ol class="cap" style="margin:0;padding-left:18px;display:grid;gap:4px">${S.log.map(t => `<li>${t}</li>`).join("")}</ol>` : `<p class="cap">まだ何も起きていません。</p>`;

      const draw = () => {
        if (!alive) return;
        if (!S.role) {
          el.innerHTML = `<div class="rl-card"><h3>役を選ぶ</h3><p>架空の会社を舞台に、攻撃側と防御側が交互に手を選びます。相手はCPUです。<b>実在の機器には何もしません。</b></p>
            <div class="btns two"><button class="btn primary big" type="button" data-role="atk">攻撃側で遊ぶ</button><button class="btn big" type="button" data-role="def">防御側で遊ぶ</button></div>
            <p class="cap" style="margin-top:10px">攻撃側が重要データまで届けば攻撃側の勝ち。${ROUNDS}ラウンド守り切れば防御側の勝ち。</p></div>`;
          ST.$$("[data-role]", el).forEach(b => b.onclick = () => { reset(b.dataset.role); draw(); });
          return;
        }
        const e = S.end;
        let panel = "";
        if (e) {
          panel = `<div class="rl-card"><div class="rl-big">${e.win ? "あなたの勝ち" : "あなたの負け"}</div><p>${esc(e.msg)}</p><p><b>学べること：</b>${esc(e.lesson)}</p>
            <p class="cap">⛔ ゲームの中だから成り立つ手です。現実では、許可のない相手に同じことをすれば犯罪になりえます（<a href="#course-law">法律と倫理コース</a>）。</p>
            <div class="btns two"><button class="btn primary" type="button" data-again>もう一度（同じ役）</button><button class="btn" type="button" data-swap>役を替える</button></div></div>`;
        } else if (S.role === "atk") {
          panel = `<div class="rl-card"><div class="rl-cap">あなたの手を選ぶ</div>
            ${avail().map(a => `<button type="button" class="rl-hand" data-atk="${a.id}"><span class="chip" style="background:var(--rl-red,#ff3b47);color:#fff">⛔ アウト</span> ${esc(a.name)}<br><span class="cap">${S.know ? "現在の防御：" + (S.def.size ? [...S.def].map(x => esc(D[x].name)).join("、") : "なし") : ""}</span></button>`).join("")}
            <button type="button" class="rl-hand" data-recon style="border-color:var(--ok)"><span class="chip" style="background:var(--ok);color:#0b0607">✅ 合法</span> 許可を得た演習で、相手の防御を調べる<br><span class="cap">自分の検証環境（許可あり）で調べる手。1ラウンド使うが、いま配備されている防御が見える。</span></button></div>`;
        } else {
          panel = `<div class="rl-card"><div class="rl-cap">配備する防御を選ぶ（✅ すべて合法）</div>
            ${DEF.filter(d => !S.def.has(d.id)).map(d => `<button type="button" class="rl-hand" data-def="${d.id}"><b>${esc(d.name)}</b><br><span class="cap">${esc(d.d)}</span></button>`).join("")}
            <button type="button" class="rl-hand" data-recon style="border-color:var(--ok)"><b>脆弱性診断を依頼する</b><br><span class="cap">許可を得た診断。1ラウンド使うが、攻撃側の次の手の候補と、それを止める防御が分かる。</span></button>
            ${S.tip ? `<div class="rl-res safe"><b>診断結果</b><p>${avail().map(a => `${esc(a.name)} → 止められる防御：${a.counter.map(c => esc(D[c].name)).join("／")}`).join("<br>")}</p></div>` : ""}</div>`;
        }
        el.innerHTML = `${head()}<div class="bt"><div class="bt-field"><div class="stage">${svgHtml()}</div><div class="bt-msg" aria-live="polite"><div class="eyebrow">ログ</div>${logHtml()}</div></div><div class="bt-cmd">${panel}</div></div>`;
        ST.$$("[data-atk]", el).forEach(b => b.onclick = () => turn(b.dataset.atk, null));
        ST.$$("[data-def]", el).forEach(b => b.onclick = () => turn(null, b.dataset.def));
        ST.$$("[data-recon]", el).forEach(b => b.onclick = () => S.role === "atk" ? turn("recon", null) : turn(null, "recon"));
        const ag = $("[data-again]"); if (ag) ag.onclick = () => { reset(S.role); draw(); };
        const sw = $("[data-swap]"); if (sw) sw.onclick = () => { reset(null); draw(); };
      };

      /* CPU の手：攻撃側は候補からランダム（ときどき偵察はしない）。防御側は段階に近い防御を優先しつつランダム */
      const cpuAtk = () => pick(avail());
      const cpuDef = () => {
        const left = DEF.filter(d => !S.def.has(d.id));
        const near = left.filter(d => ATK.some(a => a.stage <= S.pos + 2 && a.counter.includes(d.id)));
        return pick(Math.random() < 0.7 && near.length ? near : left).id;
      };

      const turn = async (atkId, defId) => {
        if (S.busy || S.end) return;
        S.busy = true;
        const atk = S.role === "atk" ? atkId : cpuAtk().id;
        const df = S.role === "def" ? defId : cpuDef();
        const note = [];
        if (S.role === "def" && df === "recon") { S.tip = true; note.push("診断を依頼した。次の候補が分かった。"); }
        else if (S.role === "atk" && atk === "recon") { S.know = true; note.push("許可を得た演習で防御を確認した。"); }
        if (df !== "recon" && S.role === "def") { S.def.add(df); S.tip = false; note.push(`防御を配備：${esc(D[df].name)}`); }
        if (S.role === "atk" && df !== "recon" && atk !== "recon") { S.def.add(df); note.push(`CPUが防御を配備：${esc(D[df].name)}`); }
        else if (S.role === "atk" && atk === "recon") { /* 偵察ラウンドでもCPUは防御を足す */ S.def.add(df); S.know = true; note.push(`CPUが防御を配備：${esc(D[df].name)}`); }
        let from = S.pos, blocked = false, a = null;
        if (atk && atk !== "recon") {
          a = A[atk];
          const stop = a.counter.find(c => S.def.has(c));
          blocked = !!stop;
          if (blocked) { S.caught++; note.push(`⛔ 攻撃「${esc(a.name)}」は <b>${esc(D[stop].name)}</b> で止まった。`); }
          else { S.pos = a.stage; note.push(`⛔ 攻撃「${esc(a.name)}」が通り、「${esc(NODES[S.pos].label)}」まで進まれた。`); }
        } else if (S.role === "def" && !atk) { note.push("攻撃側はこのラウンド様子を見ていた。"); }
        draw();
        if (a) {
          const svg = $("[data-s]");
          if (svg) { const n0 = NODES[from], n1 = NODES[from + 1]; await ST.flyPacket(svg, [{ x: n0.x, y: n0.y }, { x: n1.x, y: n1.y }], { label: a.name.slice(0, 7), color: "var(--packet)", ms: 700, blockAt: blocked ? 0.6 : null, alive: () => alive }); }
        }
        if (!alive) return;
        S.log.unshift(`R${S.round}: ${note.join(" ")}`);
        if (S.pos >= 4) S.end = { win: S.role === "atk", msg: S.role === "atk" ? "重要データまで届いた。" : "重要データまで届かれてしまった。", lesson: "入口・端末・社内・外への持ち出しの4段階のどこかで止まる仕組みを、重ねて置いておく（多層防御）。" };
        else if (S.round >= ROUNDS) S.end = { win: S.role === "def", msg: S.role === "def" ? `${ROUNDS}ラウンド守り切った。止めた攻撃は${S.caught}回。` : `${ROUNDS}ラウンド以内に届かなかった。`, lesson: "一つの対策で全部は防げないが、段階ごとに別の対策を置くと進行を止められる。" };
        else S.round++;
        S.busy = false; draw();
      };
      draw();
      return () => { alive = false; };
    }
  });
})(window.ST);
