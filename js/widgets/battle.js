"use strict";
/* 攻防対戦：架空の会社ネットワークの中だけで動く、ターン制の擬似対戦（CPU相手）。
   実在の機器には何もしない。手の名前は概念レベルで、攻撃の手順やコードは含まない。
   「アウト」の手は、現実では他人に向けると犯罪になりうる行為を、模擬の中だけで再現したもの。 */
(function (ST) {
  const esc = ST.esc;
  const BASE_NODES = [
    { id: "net", label: "インターネット", x: 36, y: 60, i: "attacker" },
    { id: "gate", label: "入口（メール・公開Web）", lines: ["入口", "メール・公開Web"], x: 120, y: 60, i: "server" },
    { id: "pc", label: "社員PC", x: 204, y: 60, i: "pc" },
    { id: "lan", label: "社内LAN", x: 288, y: 60, i: "router" },
    { id: "data", label: "重要データ", x: 324, y: 150, i: "server" }
  ];
  /* 攻撃の手：stage は「次に進む段階」。out:true は現実では違法になりうる行為。counter はそれを止められる防御 */
  const BASE_ATK = [
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
  const BASE_DEF = [
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
  const CHECKED = "2026-11-08";
  /* 実インシデント由来のシナリオ。段階は学習用に抽象化したもので、事案の経過そのものではない。
     facts は出典に書かれていることだけ。確認できなかった点は unk に「未確認」として残す。特定の組織を評価・非難する意図はない。 */
  const SCN = [
    { id: "base", title: "基本：架空の会社", tag: "架空", intro: "特定の事案によらない、練習用の架空の会社ネットワーク。", nodes: BASE_NODES, atk: BASE_ATK, def: BASE_DEF, win: "入口・端末・社内・外への持ち出しの4段階のどこかで止まる仕組みを、重ねて置いておく（多層防御）。", facts: [], sources: [] },
    { id: "osaka", title: "2022年 病院のランサムウェア被害", tag: "実インシデント · 日本", date: "2022-10-31",
      intro: "委託先の給食システム経由で病院内に入られ、電子カルテなどが暗号化された事案を、段階に抽象化したシナリオ。",
      nodes: [
        { id: "net", label: "インターネット", x: 36, y: 60, i: "attacker" },
        { id: "gate", label: "委託先の給食システム", lines: ["委託先の", "給食システム"], x: 120, y: 60, i: "server" },
        { id: "pc", label: "病院の給食サーバー", lines: ["病院の", "給食サーバー"], x: 204, y: 60, i: "server" },
        { id: "lan", label: "院内ネットワーク", lines: ["院内", "ネットワーク"], x: 288, y: 60, i: "router" },
        { id: "data", label: "電子カルテなどの基幹システム", lines: ["電子カルテ等", "基幹システム"], x: 324, y: 150, i: "server" }],
      atk: [
        { id: "o1", stage: 1, name: "保守用VPN機器の弱点や漏れたIDを使う", out: true, counter: ["vpn", "mfa"] },
        { id: "o2", stage: 1, name: "委託先側の弱いID・パスワードで入る", out: true, counter: ["pw", "mfa"] },
        { id: "o3", stage: 2, name: "委託先の端末から病院側の認証情報を得る", out: true, counter: ["rdp", "mfa"] },
        { id: "o4", stage: 2, name: "得た認証情報でリモート接続して病院サーバーに入る", out: true, counter: ["rdp", "seg"] },
        { id: "o5", stage: 3, name: "足場のサーバーから他サーバーの認証情報を集める", out: true, counter: ["pw", "seg"] },
        { id: "o6", stage: 3, name: "管理者権限で対策ソフトを外す", out: true, counter: ["priv", "edr"] },
        { id: "o7", stage: 4, name: "基幹システムのサーバーを暗号化する", out: true, counter: ["edr", "mon", "backup"] }],
      def: [
        { id: "vpn", name: "保守用機器の管理", d: "VPN機器の保守範囲と脆弱性対応の担当を文書で決める", ref: true },
        { id: "rdp", name: "リモート接続の許可基準とログ確認", d: "接続元の条件を決め、利用状況と通信ログを確認する", ref: true },
        { id: "pw", name: "パスワードの個別化とロックアウト", d: "機器ごとに別のパスワード。失敗が続くアカウントは止める", ref: true },
        { id: "priv", name: "標準ユーザー化（最小権限）", d: "管理者権限を持つ人と場面を絞る", ref: true },
        { id: "edr", name: "対策ソフトの全サーバー導入", d: "重要サーバーにもウイルス対策・端末監視を入れる", ref: true },
        { id: "mfa", name: "多要素認証", d: "パスワードが漏れても入れないようにする" },
        { id: "seg", name: "ネットワーク分離", d: "給食系と診療系など、系統間の行き来を制限する" },
        { id: "mon", name: "ログ監視", d: "不審な通信や操作に気づく" },
        { id: "backup", name: "バックアップ", d: "暗号化されても元に戻せるようにする" }],
      refLabel: "報告書の再発防止策に挙がっている項目",
      win: "委託先や保守用の接続口も守る範囲に入る。権限・パスワード・接続元を整理しておくと、一か所の侵入が全体に広がりにくい。",
      facts: ["2022年10月31日に大規模なシステム障害が発生。", "侵入口は、給食事業者が運営する給食システム側で、リモート保守用VPN機器の脆弱性とされる（漏れたID・パスワードを使った可能性にも言及）。", "給食事業者の端末から病院サーバーの認証情報が窃取され、RDP通信で病院の給食サーバーに入られた。", "全ユーザーに管理者権限があり、ウイルス対策ソフトが外された。サーバーと端末でパスワードが共通、アカウントロックアウトは未設定。電子カルテサーバーには対策ソフトが未導入。", "電子カルテを含む基幹システムの大部分が暗号化された。診療機能の完全復旧は2023年1月11日。"],
      unk: ["バックアップの状況：概要報告書に記載なし（未確認）。ゲーム内のバックアップは一般的な対策として加えたもの。", "各段階の細かな順序：ゲーム用に抽象化している。"],
      sources: [{ t: "地方独立行政法人 大阪府立病院機構 大阪急性期・総合医療センター 情報セキュリティインシデント 調査報告書（概要版, 2023-03-28）", u: "https://www.gh.opho.jp/pdf/reportgaiyo_v01.pdf", k: "一次（当事者の公表資料）" }] },
    { id: "wanna", title: "2017年 WannaCry の世界的な拡散", tag: "実インシデント · 世界", date: "2017-05-12",
      intro: "未修正のWindowsの弱点を使って自己増殖したランサムウェアが、英国の医療機関などに広がった事案を段階に抽象化したシナリオ。",
      nodes: [
        { id: "net", label: "インターネット", x: 36, y: 60, i: "attacker" },
        { id: "gate", label: "外部に開いたSMB通信（445）", lines: ["外に開いた", "SMB通信（445）"], x: 120, y: 60, i: "router" },
        { id: "pc", label: "更新されていないWindows", lines: ["更新されて", "いないWindows"], x: 204, y: 60, i: "pc" },
        { id: "lan", label: "組織内ネットワーク", lines: ["組織内", "ネットワーク"], x: 288, y: 60, i: "router" },
        { id: "data", label: "診療・予約などの業務データ", lines: ["診療・予約など", "業務データ"], x: 324, y: 150, i: "server" }],
      atk: [
        { id: "w1", stage: 1, name: "外から届くSMB通信（445）に接続する", out: true, counter: ["fw", "smb"] },
        { id: "w2", stage: 1, name: "ネットワーク上のアドレスを次々に探す", out: true, counter: ["fw", "seg"] },
        { id: "w3", stage: 2, name: "未修正のSMBv1の弱点で端末に入る", out: true, counter: ["patch", "smb"] },
        { id: "w4", stage: 3, name: "同じネットワークの他の端末へ自己増殖する", out: true, counter: ["seg", "smb", "patch"] },
        { id: "w5", stage: 4, name: "ファイルを暗号化して身代金を要求する", out: true, counter: ["backup", "edr"] }],
      def: [
        { id: "patch", name: "セキュリティ更新の適用", d: "MS17-010などの更新を当てる。サポート切れOSの置き換えも含む", ref: true },
        { id: "fw", name: "インターネット側の通信制限", d: "外部からのSMB（445）などを遮断し、ファイアウォールを管理する", ref: true },
        { id: "smb", name: "SMBv1の無効化", d: "使わない古い通信方式を止める" },
        { id: "seg", name: "ネットワーク分離", d: "部署や機器の種類ごとに行き来を制限する" },
        { id: "edr", name: "端末の監視・セキュリティソフト", d: "不審な動きを検知して止める" },
        { id: "backup", name: "オフラインのバックアップ", d: "暗号化されても元に戻せるようにする" }],
      refLabel: "NAOの報告が「実施されていなかった」と指摘する対策",
      win: "弱点が公表されたら、更新と通信の遮断を早く済ませる。更新できない機器は、ネットワークで切り離す。",
      facts: ["2017年5月12日（金）に世界的に拡散。英国では236のトラストのうち少なくとも81が影響を受けた（NAO）。", "感染した組織は、更新されていない、またはサポート切れのWindowsを使っていた。NHS Digitalは3月・4月に注意喚起していた（NAO）。", "インターネット側のファイアウォールを管理していれば、更新の有無にかかわらず感染を防げたとNHS Digitalは述べている（NAO）。", "WindowsのSMBv1の脆弱性（MS17-010）を悪用するネットワークワームで、ポート445を使う。更新・SMBv1無効化・445遮断・オフラインのバックアップが対策（日立 HIRT）。", "研究者がキルスイッチを作動させ、拡散が止まった（NAO）。"],
      unk: ["最初の感染経路：参照した資料では確認できていない（未確認）。ゲームでは外部から届く通信として抽象化。", "段階の分け方はゲーム用の抽象化。"],
      sources: [{ t: "National Audit Office: Investigation: WannaCry cyber attack and the NHS（2017-10-27）", u: "https://www.nao.org.uk/reports/investigation-wannacry-cyber-attack-and-the-nhs/", k: "一次（公的機関の調査報告）" },
        { t: "日立 HIRT: WannaCry（HIRT-PUB17008）", u: "https://www.hitachi.com/ja-jp/hirt/publications/hirt-pub/hirt-pub17008/", k: "民間のセキュリティチームの解説（技術面の補足）" }] },
    { id: "colonial", title: "2021年 米国の石油パイプライン事業者の被害", tag: "実インシデント · 米国", date: "2021-05-07",
      intro: "古いVPNアカウントから入られ、被害が運用の停止判断にまで及んだ事案を段階に抽象化したシナリオ。",
      nodes: [
        { id: "net", label: "インターネット", x: 36, y: 60, i: "attacker" },
        { id: "gate", label: "使われていないVPNアカウント", lines: ["古いVPN", "アカウント"], x: 120, y: 60, i: "server" },
        { id: "pc", label: "社内ITネットワーク", lines: ["社内IT", "ネットワーク"], x: 204, y: 60, i: "pc" },
        { id: "lan", label: "IT／OTの境界", lines: ["IT／OTの", "境界"], x: 288, y: 60, i: "router" },
        { id: "data", label: "パイプラインの運用", lines: ["パイプライン", "の運用"], x: 324, y: 150, i: "server" }],
      atk: [
        { id: "c1", stage: 1, name: "古いVPNアカウントのパスワードで接続する", out: true, counter: ["mfa", "acct"] },
        { id: "c2", stage: 2, name: "社内ITネットワークで活動範囲を広げる", out: true, counter: ["edr", "mon"] },
        { id: "c3", stage: 3, name: "ITから運用側のOTへ広げようとする", out: true, counter: ["seg"] },
        { id: "c4", stage: 4, name: "データを暗号化して身代金を要求する", out: true, counter: ["backup", "seg"] }],
      def: [
        { id: "mfa", name: "多要素認証", d: "パスワードが漏れても入れないようにする", ref: true },
        { id: "acct", name: "使わないアカウントの棚卸し", d: "古いVPNアカウントなど、使われないものを止める", ref: true },
        { id: "seg", name: "IT／OTの分離", d: "事務側と運用側の行き来を制限する" },
        { id: "edr", name: "端末の監視（EDR）", d: "社内の怪しい動きを検知する" },
        { id: "mon", name: "ログ監視", d: "不審なログインや通信に気づく" },
        { id: "backup", name: "バックアップ", d: "暗号化されても元に戻せるようにする" }],
      refLabel: "報道で述べられた、事後に取られた対策",
      win: "使われていない入口は閉じ、すべての入口に多要素認証を。事務側と運用側を分けておくと、止める範囲を小さくできる。",
      facts: ["2021年5月7日の午前5時（米東部時間）、IT網で身代金要求のメッセージが見つかった（CEOの議会証言を伝える報道）。", "侵入には、古い（レガシーな）VPNアカウントのパスワードが使われた。多要素認証は設定されておらず、パスワードの入手経路は不明と証言された。", "同社は運用側のネットワークへの拡大を避けるため、パイプラインの運用を止めた。報道は運用側（OT）が感染したとは述べていない。", "同社は旧VPNプロファイルを停止し、全社の防御を追加したと証言された。"],
      unk: ["米CISAの注意喚起（AA21-131A）など一次資料は、この環境から取得できず内容を未確認。ここでの記述は報道（Dark Reading）による。", "ITネットワーク内での具体的な行動：参照資料に記載なし（未確認）。第2段階はゲーム用の抽象化。"],
      sources: [{ t: "Dark Reading: Colonial Pipeline CEO: Ransomware Attack Started via Pilfered 'Legacy' VPN Account（2021-06-09）", u: "https://www.darkreading.com/cyberattacks-data-breaches/colonial-pipeline-ceo-ransomware-attack-started-via-pilfered-legacy-vpn-account", k: "二次（報道。議会証言を伝える）" }] }
  ];
  ST.INCIDENTS = Object.fromEntries(SCN.filter(c => c.id !== "base").map(c => [c.id, c]));
  ST.INCIDENT_CHECKED = CHECKED;
  let NODES, ATK, DEF, D, A;
  const use = c => { NODES = c.nodes; ATK = c.atk; DEF = c.def; D = Object.fromEntries(DEF.map(d => [d.id, d])); A = Object.fromEntries(ATK.map(x => [x.id, x])); };
  use(SCN[0]);
  const ROUNDS = 6;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  ST.widget("battle", {
    title: "攻防対戦 · 架空の会社ネットワーク",
    motion: true,
    mount(el) {
      let S, alive = true;
      const reset = (role, scn) => { if (scn) use(scn); S = { scn, role, pos: 0, round: 1, def: new Set(), log: [], know: false, tip: false, caught: 0, busy: false, end: null, last: null }; };
      reset(null, null);
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

      const sleep = ms => new Promise(r => setTimeout(r, ST.motion === "off" ? 0 : ms));
      const showLive = () => { const b = $(".bt-msg"); if (b) b.innerHTML = `<div class="eyebrow">結果</div><ol class="cap" style="margin:0;padding-left:18px;display:grid;gap:4px">${S.live.map(t => `<li>${t}</li>`).join("")}</ol>`; };
      const logHtml = () => S.busy ? "" : S.log.length ? `<ol class="cap" style="margin:0;padding-left:18px;display:grid;gap:4px">${S.log.map(t => `<li>${t}</li>`).join("")}</ol>` : `<p class="cap">まだ何も起きていません。</p>`;

      const srcHtml = c => c.id === "base" ? "" : `<details class="bt-src" open><summary>事実と出典（確認日 ${CHECKED}）</summary>
        <ul>${c.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        ${c.unk.length ? `<p class="cap"><b>未確認・抽象化：</b></p><ul>${c.unk.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        <p class="cap"><b>出典：</b></p><ul>${c.sources.map(r => `<li>${esc(r.t)} <span class="cap">［${esc(r.k)}］</span><br><a href="${esc(r.u)}" target="_blank" rel="noopener noreferrer">${esc(r.u)}</a></li>`).join("")}</ul>
        <p class="cap">事実と出典に基づく学習用の抽象化で、特定の組織を評価・非難するものではありません。</p></details>`;
      const draw = () => {
        if (!alive) return;
        if (!S.scn) {
          el.innerHTML = `<div class="rl-card"><h3>シナリオを選ぶ <span class="cap">キー 1〜${SCN.length}</span></h3>
            <div class="bt-scn">${SCN.map((c, i) => `<button type="button" class="rl-hand" data-scn="${i}"><span class="bt-key">[${i + 1}]</span> <b>${esc(c.title)}</b> <span class="chip">${esc(c.tag)}</span>${c.date ? ` <span class="cap">${c.date}</span>` : ""}<br><span class="cap">${esc(c.intro)}</span></button>`).join("")}</div></div>`;
          ST.$$("[data-scn]", el).forEach(b => b.onclick = () => { reset(null, SCN[+b.dataset.scn]); draw(); });
          return;
        }
        if (!S.role) {
          el.innerHTML = `<div class="rl-card"><h3>${esc(S.scn.title)}</h3><p>${esc(S.scn.intro)} 双方が同時に手を選び、結果が1行ずつ出ます。相手はCPU。<b>実在の機器には何もしません。</b></p>
            <div class="btns two"><button class="btn primary big" type="button" data-role="atk">[A] 攻撃側で遊ぶ</button><button class="btn big" type="button" data-role="def">[D] 防御側で遊ぶ</button></div><p><button class="btn" type="button" data-back>[B] シナリオ選択へ</button></p>${srcHtml(S.scn)}
            <p class="cap" style="margin-top:10px">攻撃側が重要データまで届けば攻撃側の勝ち。${ROUNDS}ラウンド守り切れば防御側の勝ち。</p></div>`;
          ST.$$("[data-role]", el).forEach(b => b.onclick = () => { reset(b.dataset.role, S.scn); draw(); });
          $("[data-back]").onclick = () => { reset(null, null); draw(); };
          return;
        }
        const e = S.end;
        let panel = "";
        if (S.busy) {
          panel = `<div class="rl-card"><div class="rl-cap">ターン進行中…</div><p class="cap">防御の配備 → 攻撃 → 結果の順に表示します。</p></div>`;
        } else if (e) {
          panel = `<div class="rl-card"><div class="rl-big">${e.win ? "あなたの勝ち" : "あなたの負け"}</div><p>${esc(e.msg)}</p><p><b>学べること：</b>${esc(e.lesson)}</p>${srcHtml(S.scn)}
            <p class="cap">⛔ ゲームの中だから成り立つ手です。現実では、許可のない相手に同じことをすれば犯罪になりえます（<a href="#course-law">法律と倫理コース</a>）。</p>
            <div class="btns two"><button class="btn primary" type="button" data-again>もう一度（同じ役）</button><button class="btn" type="button" data-swap>シナリオ・役を替える</button></div></div>`;
        } else if (S.role === "atk") {
          panel = `<div class="rl-card"><div class="rl-cap">あなたの手を選ぶ</div>
            ${avail().map((a, i) => `<button type="button" class="rl-hand" data-atk="${a.id}"><span class="bt-key">[${i + 1}]</span> <span class="chip" style="background:var(--rl-red,#ff3b47);color:#fff">⛔ アウト</span> ${esc(a.name)}<br><span class="cap">${S.know ? "現在の防御：" + (S.def.size ? [...S.def].map(x => esc(D[x].name)).join("、") : "なし") : ""}</span></button>`).join("")}
            <button type="button" class="rl-hand" data-recon style="border-color:var(--ok)"><span class="bt-key">[R]</span> <span class="chip" style="background:var(--ok);color:#0b0607">✅ 合法</span> 許可を得た演習で、相手の防御を調べる<br><span class="cap">自分の検証環境（許可あり）で調べる手。1ラウンド使うが、いま配備されている防御が見える。</span></button></div>`;
        } else {
          panel = `<div class="rl-card"><div class="rl-cap">配備する防御を選ぶ（✅ すべて合法）${S.scn.refLabel ? " ／ 「出典あり」＝" + esc(S.scn.refLabel) : ""}</div>
            ${DEF.filter(d => !S.def.has(d.id)).map((d, i) => `<button type="button" class="rl-hand" data-def="${d.id}"><span class="bt-key">[${i + 1}]</span> <b>${esc(d.name)}</b>${d.ref ? ' <span class="chip bt-ref" title="' + esc(S.scn.refLabel) + '">出典あり</span>' : ""}<br><span class="cap">${esc(d.d)}</span></button>`).join("")}
            <button type="button" class="rl-hand" data-recon style="border-color:var(--ok)"><span class="bt-key">[R]</span> <b>脆弱性診断を依頼する</b><br><span class="cap">許可を得た診断。1ラウンド使うが、攻撃側の次の手の候補と、それを止める防御が分かる。</span></button>
            ${S.tip ? `<div class="rl-res safe"><b>診断結果</b><p>${avail().map(a => `${esc(a.name)} → 止められる防御：${a.counter.map(c => esc(D[c].name)).join("／")}`).join("<br>")}</p></div>` : ""}</div>`;
        }
        el.innerHTML = `${head()}<div class="bt"><div class="bt-field"><div class="stage">${svgHtml()}</div><div class="bt-msg" aria-live="polite"><div class="eyebrow">${S.busy ? "結果" : "ログ"}</div>${logHtml()}</div></div><div class="bt-cmd">${panel}</div></div>`;
        ST.$$("[data-atk]", el).forEach(b => b.onclick = () => turn(b.dataset.atk, null));
        ST.$$("[data-def]", el).forEach(b => b.onclick = () => turn(null, b.dataset.def));
        ST.$$("[data-recon]", el).forEach(b => b.onclick = () => S.role === "atk" ? turn("recon", null) : turn(null, "recon"));
        const ag = $("[data-again]"); if (ag) ag.onclick = () => { reset(S.role, S.scn); draw(); };
        const sw = $("[data-swap]"); if (sw) sw.onclick = () => { reset(null, null); draw(); };
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
        const preLen = note.length;
        let from = S.pos, blocked = false, a = null;
        if (atk && atk !== "recon") {
          a = A[atk];
          const stop = a.counter.find(c => S.def.has(c));
          blocked = !!stop;
          if (blocked) { S.caught++; note.push(`⛔ 攻撃「${esc(a.name)}」は <b>${esc(D[stop].name)}</b> で止まった。`); }
          else { S.pos = a.stage; note.push(`⛔ 攻撃「${esc(a.name)}」が通り、「${esc(NODES[S.pos].label)}」まで進まれた。`); }
        } else if (S.role === "def" && !atk) { note.push("攻撃側はこのラウンド様子を見ていた。"); }
        S.live = []; draw();
        for (const m of note.slice(0, preLen)) { S.live.push(m); showLive(); await sleep(650); if (!alive) return; }
        if (a) {
          const svg = $("[data-s]");
          if (svg) { const n0 = NODES[from], n1 = NODES[from + 1]; await ST.flyPacket(svg, [{ x: n0.x, y: n0.y }, { x: n1.x, y: n1.y }], { label: a.name.slice(0, 7), color: "var(--packet)", ms: 700, blockAt: blocked ? 0.6 : null, alive: () => alive }); }
        }
        if (!alive) return;
        for (const m of note.slice(preLen)) { S.live.push(m); showLive(); await sleep(650); if (!alive) return; }
        S.log.unshift(`R${S.round}: ${note.join(" ")}`);
        if (S.pos >= 4) S.end = { win: S.role === "atk", msg: S.role === "atk" ? "重要データまで届いた。" : "重要データまで届かれてしまった。", lesson: S.scn.win };
        else if (S.round >= ROUNDS) S.end = { win: S.role === "def", msg: S.role === "def" ? `${ROUNDS}ラウンド守り切った。止めた攻撃は${S.caught}回。` : `${ROUNDS}ラウンド以内に届かなかった。`, lesson: S.scn.win };
        else S.round++;
        S.busy = false; draw();
      };
      /* キーボード：数字で手、R で診断/偵察、A/D で役、B で戻る、Enter で再戦 */
      const onKey = ev => {
        if (!alive || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const t = ev.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (!el.isConnected || el.getBoundingClientRect().height === 0) return;
        const k = ev.key.toLowerCase();
        if (/^[1-9]$/.test(k)) {
          const q = !S.scn ? "[data-scn]" : S.busy || S.end ? null : S.role === "atk" ? "[data-atk]" : S.role === "def" ? "[data-def]" : null;
          const b = q && el.querySelectorAll(q)[+k - 1]; if (b) { ev.preventDefault(); b.click(); }
        } else {
          const q = k === "r" ? "[data-recon]" : k === "a" ? "[data-role=atk]" : k === "d" ? "[data-role=def]" : k === "b" ? "[data-back]" : k === "enter" ? "[data-again]" : null;
          const b = q && $(q); if (b) { ev.preventDefault(); b.click(); }
        }
      };
      document.addEventListener("keydown", onKey);
      draw();
      return () => { alive = false; document.removeEventListener("keydown", onKey); };
    }
  });
})(window.ST);
