"use strict";
/* 攻防端末のミッション。実インシデントを下敷きにしたフィクション（組織名・ホスト名・IP・時刻・警報は創作）。
   下敷きにした事案の「事実と出典」は battle.js の ST.INCIDENTS（ref で参照）。ここに書く fiction は脚色した点の説明。
   IP アドレスは社内=10.x、外部=文書用の範囲（192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24）だけを使う。 */
(function (ST) {
  const hms = (h, m, s = 0) => h * 3600 + m * 60 + s;

  /* ---- [GAME] 共通コマンド ---- */
  const isolate = {
    usage: "isolate <ホスト名>", d: "EDR の管理画面から端末をネットワーク隔離（製品操作の抽象化）",
    run(W, h, a) {
      const t = a[0] && W.H(a[0]);
      if (!t) return ["[GAME] 管理対象にそのホストはありません。右のネットワーク一覧の名前で指定します。"];
      if (t.name === W.m.home) return ["[GAME] 自分の端末は隔離できません（調査ができなくなります）。"];
      if (t.iso) return [`[GAME] ${t.name} はすでに隔離されています。`];
      t.iso = true; t.conns = []; t.sessions = [];
      W.flags.add("iso:" + t.name); if (W.m.onIso) W.m.onIso(W, t);
      return [`[GAME] EDR 管理コンソール：${t.name} をネットワーク隔離しました（EDR の管理通信だけ許可）。`];
    }
  };
  const block = {
    usage: "block <IP>", d: "境界ファイアウォールで送信元 IP を遮断（管理画面の操作の抽象化）",
    run(W, h, a) {
      const ip = a[0];
      if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ["[GAME] block <IPアドレス> の形で指定します。"];
      if (/^10\./.test(ip)) return ["[GAME] 社内アドレスは境界では遮断しません。端末の隔離（isolate）や netsh を使います。"];
      W.blocked.add(ip); if (W.m.onBlock) W.m.onBlock(W, ip);
      return [`[GAME] 境界ファイアウォール：送信元 ${ip} を遮断するルールを追加しました。`];
    }
  };
  const report = (choices, judge) => ({
    usage: "report <答え>", d: "判断を報告（引数なしで選択肢を表示）",
    run(W, h, a) {
      if (!a[0]) return ["[GAME] 報告の選択肢：", ...Object.entries(choices).map(([k, v]) => `  report ${k}   … ${v}`)];
      const k = Object.keys(choices).find(x => x.toLowerCase() === a[0].toLowerCase());
      if (!k) return ["[GAME] その選択肢はありません。report だけを打つと一覧が出ます。"];
      return judge(W, k);
    }
  });
  const defReport = (choices, answer) => report(choices, (W, k) => {
    if (W.answered === answer) return ["[GAME] 報告済みです。"];
    if (k === answer) { W.answered = k; return [`[GAME] 報告を受理：${choices[k]}。`]; }
    W.t = Math.min(W.m.limit - 1, W.t + 20);
    return ["[GAME] 証拠と合わない、と差し戻された。確認に 20 秒かかった。"];
  });
  const invReport = (choices, answer, wrong) => report(choices, (W, k) => {
    W.answered = k;
    if (k === answer) W.over = { win: true, msg: `判定：${choices[k]}。証拠と一致した。` };
    else W.over = { win: false, msg: `判定：${choices[k]}。${wrong}` };
    return [`[GAME] 判定を報告：${choices[k]}`];
  });

  /* =========================================================
     防御1：電子カルテを守れ（2022年 病院のランサムウェア被害を下敷き）
     ========================================================= */
  const D1 = (() => {
    const BAD = "198.51.100.23", POOL = "10.10.99.7";
    const alive = W => !W.blocked.has(BAD) && W.acctOn("vendor_maint");
    const comp = W => Object.values(W.hosts).filter(h => h.comp);
    const cut = W => { const f = W.H("FOOD-SV01"); if (!alive(W) || !W.acctOn("food_admin")) { f.conns = f.conns.filter(c => !c.foreign.startsWith(POOL)); f.sessions = (f.sessions || []).filter(s => s.user !== "food_admin"); } };
    return {
      id: "osaka", mode: "def", ref: "osaka", tag: "防御 · 実事案ベース", title: "深夜の保守回線", goal: "電子カルテを守れ",
      story: "みなと市立総合医療センター、午前2時10分。SOCの当直はあなた一人。記録では、この夜の侵入は朝まで誰にも気づかれず、電子カルテが止まり、診療が長く制限された。いま、深夜のVPNログオンの警報が鳴った。未来を変えろ。",
      fiction: "病院名・ホスト名・アカウント名・IPアドレス・時刻・SIEMの警報・ログの形式・攻撃の進む速さは演習用の創作です。「当直がリアルタイムで気づく」という展開そのものも脚色です。",
      loseText: "電子カルテのサーバー（EMR-SV01）が暗号化される。",
      limit: 300, date: "2026-11-10", start: hms(2, 10), domain: "minato.local", me: "soc", home: "SOC-PC",
      banner: ["Windows PowerShell", "Copyright (C) Microsoft Corporation. All rights reserved.", "", "[SIM] みなと市立総合医療センター SOC 端末。ログは C:\\SIEM に集約されています（type C:\\SIEM\\README.txt）。"],
      hosts: [
        { name: "SOC-PC", ip: "10.10.10.50", label: "あなたの端末", osName: "Microsoft Windows 11 Enterprise", osVer: "10.0.22631 N/A Build 22631",
          files: {
            "C:\\SIEM\\README.txt": ["C:\\SIEM 以下は各機器から集めたログ（演習用の簡略形式）。", "  vpn.log            保守用VPN装置のログ", "  security.log       Windows セキュリティログ（4624=ログオン成功 / 4625=失敗 / 4672=特権の割り当て）", "                     LogonType=10 はリモートデスクトップ、3 はネットワーク", "  edr.log            EDR（端末監視）のイベント", "  maint_schedule.txt 委託先の保守作業予定（承認済み）"],
            "C:\\SIEM\\maint_schedule.txt": ["委託先 保守作業予定（承認済み）", "2026-11-09 (月) 14:00-16:00  給食システム 定期保守  接続元 192.0.2.10（委託先 本社）", "2026-11-16 (月) 14:00-16:00  給食システム 定期保守  接続元 192.0.2.10（委託先 本社）", "※ 予定外の接続を見つけたら、SOC が委託先に確認すること"],
            "C:\\SIEM\\vpn.log": ["2026-11-09 13:58:02 VPN-GW user=vendor_maint src=192.0.2.10 assigned=10.10.99.5 result=SUCCESS", "2026-11-09 16:03:40 VPN-GW user=vendor_maint src=192.0.2.10 result=LOGOUT", "2026-11-10 02:09:41 VPN-GW user=vendor_maint src=198.51.100.23 assigned=10.10.99.7 result=SUCCESS"],
            "C:\\SIEM\\security.log": ["2026-11-10 01:00:02 EventID=4624 LogonType=3 Computer=FILE-SV01 TargetUser=MINATO\\svc_backup SourceIp=10.10.40.20", "2026-11-10 01:42:17 EventID=4624 LogonType=3 Computer=EMR-SV01 TargetUser=MINATO\\svc_emr SourceIp=10.10.50.11"],
            "C:\\SIEM\\edr.log": ["2026-11-10 00:00:00 status=OK hosts=5 sensors=online"]
          } },
        { name: "DC01", ip: "10.10.10.10", label: "ドメインコントローラ", role: "dc", ports: [{ port: 53, pid: 2112 }, { port: 88, pid: 640 }, { port: 389, pid: 640 }, { port: 445, pid: 4 }] },
        { name: "VPN-GW", ip: "10.10.0.1", label: "保守用VPN装置", os: "appliance", noWinRM: true, hideMap: false },
        { name: "FOOD-SV01", ip: "10.10.30.5", label: "給食サーバー", osName: "Microsoft Windows Server 2016 Standard", osVer: "10.0.14393 N/A Build 14393", ports: [{ port: 3389, pid: 1044 }, { port: 445, pid: 4 }], procs: [{ name: "FoodMgr.exe", pid: 3320, mem: "88,112 K" }, { name: "AvAgent.exe", pid: 2480, mem: "41,200 K" }] },
        { name: "EMR-SV01", ip: "10.10.50.10", label: "電子カルテ", ports: [{ port: 3389, pid: 1044 }, { port: 443, pid: 2900 }], procs: [{ name: "EmrService.exe", pid: 2900, mem: "512,004 K" }, { name: "AvAgent.exe", pid: 2480, mem: "41,200 K" }] },
        { name: "FILE-SV01", ip: "10.10.50.20", label: "ファイル共有", ports: [{ port: 445, pid: 4 }, { port: 3389, pid: 1044 }], procs: [{ name: "AvAgent.exe", pid: 2480, mem: "41,200 K" }] }
      ],
      accounts: [
        { name: "soc", full: "SOC 当直", groups: "*Domain Users         *SOC", last: "2026/11/10 0:01:12" },
        { name: "vendor_maint", full: "給食システム保守（委託先）", comment: "委託先の保守作業用。VPN 接続に使用", groups: "*Domain Users         *VPN Users", last: "2026/11/10 2:09:41", pwset: "2019/04/01 10:00:00" },
        { name: "food_admin", full: "給食サーバー管理", groups: "*Domain Users         *Food Admins", last: "2026/11/09 14:20:11" },
        { name: "svc_backup", full: "バックアップ", groups: "*Domain Users         *Backup Operators" },
        ...["FOOD-SV01", "EMR-SV01", "FILE-SV01"].map(h => ({ name: "Administrator", host: h, comment: "Built-in account for administering the computer/domain", local: "*Administrators", groups: "*None", pwset: "2018/06/12 11:03:20" }))
      ],
      events: [
        { at: 3, run: W => W.alert("VPN-GW: 深夜帯の VPN ログオン（user=vendor_maint）") },
        { at: 25, run: W => {
          if (!alive(W)) return;
          if (!W.acctOn("food_admin")) { W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4625 LogonType=10 Computer=FOOD-SV01 TargetUser=MINATO\\food_admin SourceIp=${POOL}`); return; }
          W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4624 LogonType=10 Computer=FOOD-SV01 TargetUser=MINATO\\food_admin SourceIp=${POOL}`);
          W.conn("FOOD-SV01", { lport: 3389, foreign: `${POOL}:50112`, pid: 1044 }); W.H("FOOD-SV01").sessions = [{ user: "food_admin", sess: "rdp-tcp#2", id: 2, at: "11/10/2026 2:10 AM" }]; W.H("FOOD-SV01").comp = true;
        } },
        { at: 70, run: W => {
          const f = W.H("FOOD-SV01"); if (!alive(W) || !W.acctOn("food_admin") || !f.comp || f.iso) return;
          W.proc("FOOD-SV01", "rtool.exe", 5120, "6,904 K"); f.procs.find(p => p.pid === 5120).hard = true; W.flags.add("harvest");
          W.log("SOC-PC", "C:\\SIEM\\edr.log", "alert=CredentialAccess host=FOOD-SV01 process=C:\\ProgramData\\rtool.exe pid=5120 severity=high");
          W.alert("EDR: FOOD-SV01 で認証情報の窃取を示す挙動（severity=high）");
        } },
        { at: 120, run: W => {
          const f = W.H("FOOD-SV01"); if (!alive(W) || !W.acctOn("food_admin") || f.iso || !W.flags.has("harvest")) return;
          ["EMR-SV01", "FILE-SV01"].forEach((t, i) => {
            if (W.reach("FOOD-SV01", t, 3389) && W.acctOn("Administrator", t)) {
              W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4624 LogonType=10 Computer=${t} TargetUser=${t}\\Administrator SourceIp=10.10.30.5`, i);
              W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4672 Computer=${t} SubjectUser=${t}\\Administrator Privileges=SeDebugPrivilege,SeBackupPrivilege`, i);
              W.conn(t, { lport: 3389, foreign: `10.10.30.5:5${2201 + i}`, pid: 1044 }); W.H(t).sessions = [{ user: "Administrator", sess: "rdp-tcp#1", id: 1, at: "11/10/2026 2:12 AM" }]; W.H(t).comp = true;
            } else W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4625 LogonType=10 Computer=${t} TargetUser=${t}\\Administrator SourceIp=10.10.30.5`, i);
          });
        } },
        { at: 175, run: W => { ["EMR-SV01", "FILE-SV01"].forEach(t => { const h = W.H(t); if (!h.comp || h.iso) return; h.procs = h.procs.filter(p => p.name !== "AvAgent.exe"); W.log("SOC-PC", "C:\\SIEM\\edr.log", `status=SensorOffline host=${t} reason=AgentUninstalled`); W.alert(`EDR: ${t} のセンサーから応答がない（AgentUninstalled）`); }); } },
        { at: 240, run: W => {
          ["FILE-SV01", "EMR-SV01"].forEach(t => { const h = W.H(t); if (!h.comp || h.iso) return; h.enc = true; W.log("SOC-PC", "C:\\SIEM\\edr.log", `status=Unknown host=${t} note=MassFileModification(最後の報告)`); W.alert(`${t}: 大量のファイル書き換え。業務アプリが応答しない`); });
          if (W.H("EMR-SV01").enc) W.lose("電子カルテのサーバーが暗号化された。記録どおりの朝が来る。");
        } }
      ],
      onAcct: cut, onBlock: cut,
      goals: [
        { text: "侵入経路を特定して報告する（report）", ok: W => W.answered === "vpn" },
        { text: "攻撃者の入口をふさぐ（接続元の遮断 または 保守用アカウントの無効化）", ok: W => !alive(W) },
        { text: "攻撃者が入ったサーバーをすべて隔離する", ok: W => !alive(W) && comp(W).every(h => h.iso) },
        { text: "電子カルテ（EMR-SV01）を暗号化させない", ok: W => !W.H("EMR-SV01").enc }
      ],
      cmds: { isolate, block, report: defReport({ phishing: "メールの添付・リンク", vpn: "委託先の保守用リモート接続（VPN）", web: "公開Webサーバーの脆弱性", usb: "USBメモリなどの持ち込み" }, "vpn") },
      hints: [
        "type C:\\SIEM\\vpn.log と type C:\\SIEM\\maint_schedule.txt を見比べる。承認された保守と、時刻・接続元が合っているか。",
        "net user vendor_maint /domain で状態を確認し、net user vendor_maint /active:no /domain で止める。block 198.51.100.23 でも入口はふさがる。",
        "findstr \"4624\" C:\\SIEM\\security.log で、LogonType=10（リモートデスクトップ）の成功ログオンがどのサーバーに入ったかを見る。",
        "入られたサーバーを isolate <ホスト名> で隔離する。侵入経路の報告は report vpn。"
      ],
      winText: "入口をふさぎ、入られたサーバーを切り離した。電子カルテは朝まで動き続けた。",
      timeoutText: "朝になった。全容がつかめないまま、日勤に引き継ぐことになった。",
      explain: "入口は委託先の保守用VPN。承認された保守予定と違う時刻・接続元からのログオンが最初の手がかりでした。入口をふさいでも、すでに入られたサーバーは隔離しないと横展開が続きます。サーバー間で同じ管理者パスワードを使っていると、一台の侵害が全体に広がります（EMR-SV01 の Administrator を無効にする、netsh で 10.10.30.5 からの受信を止める、も有効な手です）。",
      reality: "実際の事案では、委託先の給食システム側から侵入され、病院の給食サーバーを足場に電子カルテなどの基幹システムまで暗号化されました。診療機能の完全復旧は2023年1月11日。調査報告書は、保守用機器の管理分担、リモート接続の許可基準とログ確認、パスワードの個別化とロックアウト、最小権限、全サーバーへの対策ソフト導入などを再発防止策に挙げています（出典参照）。"
    };
  })();

  /* =========================================================
     防御2：感染の連鎖を止めろ（2017年 WannaCry を下敷き）
     ========================================================= */
  const D2 = (() => {
    const ORDER = ["PC-0413", "FS01", "PC-0415", "MES-SV", "PC-0420"];
    const WPID = { "PC-0412": 4412, "PC-0413": 4413, "PC-0415": 4415, "FS01": 4510, "MES-SV": 4610, "PC-0420": 4420 };
    const running = (W, h) => h.inf != null && W.alive(h.name, WPID[h.name]);
    const block445 = h => h.fw.some(r => r.dir === "in" && r.action === "block" && !r.remoteip && String(r.localport) === "445");
    const infect = (W, name, at) => {
      const h = W.H(name); h.inf = at; h.comp = true;
      W.proc(name, "svcupd.exe", WPID[name], "3,212 K"); h.procs.find(p => p.pid === WPID[name]).hard = true;
      const peers = ["10.20.1.13", "10.20.1.14", "10.20.1.15", "10.20.2.10", "10.20.3.10", "203.0.113.41", "198.51.100.87", "203.0.113.199"];
      peers.filter(ip => ip !== h.ip).forEach((ip, i) => W.conn(name, { lport: 49660 + i, foreign: `${ip}:445`, state: "SYN_SENT", pid: WPID[name] }));
    };
    const win7 = { osName: "Microsoft Windows 7 Professional", osVer: "6.1.7601 Service Pack 1 Build 7601", noSmbCmdlet: true };
    return {
      id: "wanna", mode: "def", ref: "wanna", tag: "防御 · 実事案ベース", title: "朝の連鎖", goal: "感染の連鎖を止めろ",
      story: "北斗精機、午前9時12分。製造課から「ファイルが開けない、英語の要求文が出ている」と電話が入った。記録では、2017年のこのワームは英国の医療機関だけでも少なくとも81のトラストに広がり、予約のキャンセルや救急の受け入れ先変更につながった。工場の生産管理サーバーまで届く前に、連鎖を止めろ。",
      fiction: "北斗精機・ホスト名・IP・感染の速さ・ヘルプデスクの連絡・プロセス名 svcupd.exe はすべて創作です。実際のワームのファイル名や挙動の細部は再現していません。",
      loseText: "共有ファイル（FS01）か生産管理（MES-SV）が暗号化される。",
      limit: 300, date: "2026-11-10", start: hms(9, 12), domain: "hokuto.local", me: "soc", home: "SOC-PC",
      banner: ["Windows PowerShell", "Copyright (C) Microsoft Corporation. All rights reserved.", "", "[SIM] 北斗精機 情報システム課の端末。社内の端末には Enter-PSSession で入れます（WinRM はGPOで有効）。"],
      hosts: [
        { name: "SOC-PC", ip: "10.20.0.50", label: "あなたの端末", osName: "Microsoft Windows 11 Enterprise", osVer: "10.0.22631 N/A Build 22631", files: { "C:\\SIEM\\README.txt": ["ids.log  侵入検知（IDS）の記録", "helpdesk.log  ヘルプデスクの受付記録"], "C:\\SIEM\\ids.log": [], "C:\\SIEM\\helpdesk.log": ["2026-11-10 09:11:48 PC-0412 製造課: ファイルが開けない。画面に英語の要求文と送金の案内が出ている"] } },
        { name: "DC01", ip: "10.20.0.10", label: "ドメインコントローラ", role: "dc", ports: [{ port: 53, pid: 2112 }, { port: 445, pid: 4 }] },
        { name: "PC-0412", ip: "10.20.1.12", label: "製造課PC", smb1: true, ...win7, ports: [{ port: 445, pid: 4 }] },
        { name: "PC-0413", ip: "10.20.1.13", label: "製造課PC", smb1: true, ...win7, ports: [{ port: 445, pid: 4 }] },
        { name: "PC-0415", ip: "10.20.1.15", label: "品質管理PC", smb1: true, ...win7, ports: [{ port: 445, pid: 4 }] },
        { name: "PC-0420", ip: "10.20.1.20", label: "設計PC", smb1: false, patched: true, osName: "Microsoft Windows 10 Enterprise", osVer: "10.0.19045 N/A Build 19045", ports: [{ port: 445, pid: 4 }] },
        { name: "FS01", ip: "10.20.2.10", label: "共有ファイル", smb1: true, osName: "Microsoft Windows Server 2008 R2 Standard", osVer: "6.1.7601 Service Pack 1 Build 7601", noSmbCmdlet: true, ports: [{ port: 445, pid: 4 }] },
        { name: "MES-SV", ip: "10.20.3.10", label: "生産管理（MES）", smb1: true, osName: "Microsoft Windows Server 2012 R2 Standard", osVer: "6.3.9600 N/A Build 9600", ports: [{ port: 445, pid: 4 }, { port: 1433, pid: 1880 }], procs: [{ name: "MesCore.exe", pid: 1880, mem: "402,118 K" }] }
      ],
      accounts: [{ name: "soc", full: "情報システム課", groups: "*Domain Users         *IT" }],
      init: W => infect(W, "PC-0412", -20),
      events: [
        { at: 2, run: W => W.alert("ヘルプデスク: PC-0412 の利用者から「ファイルが開けない、英語の要求文」と連絡") },
        { at: 30, run: W => { W.log("SOC-PC", "C:\\SIEM\\ids.log", "sig=SMB-Scan-Burst src=10.20.1.12 dport=445 count=1834/min"); W.alert("IDS: 社内で 445/tcp への接続試行が急増"); } }
      ],
      tick: W => {
        Object.values(W.hosts).forEach(h => {
          if (!running(W, h)) return;
          if (!h.enc && W.t >= h.inf + 75) { h.enc = true; W.alert(`EDR: ${h.name} で大量のファイル書き換えを検知`); W.log("SOC-PC", "C:\\SIEM\\ids.log", `sig=Ransom-Note-Http host=${h.name}`); if (h.name === "FS01" || h.name === "MES-SV") W.lose(`${h.name} が暗号化された。生産が止まる。`); }
          if (!h.iso && W.t > h.inf && (W.t - h.inf) % 35 === 0) {
            const tgt = ORDER.map(n => W.H(n)).find(x => x.inf == null && x.smb1 && !x.patched && W.reach(h.name, x.name, 445));
            if (tgt) { infect(W, tgt.name, W.t); W.log("SOC-PC", "C:\\SIEM\\ids.log", `sig=SMB-Exploit-Attempt src=${h.ip} dst=${tgt.ip} dport=445`); }
          }
        });
      },
      goals: [
        { text: "最初の感染端末を特定して報告する（report <ホスト名>）", ok: W => W.answered === "PC-0412" },
        { text: "広げている端末をすべて止める（隔離 または 不審プロセスの終了）", ok: W => Object.values(W.hosts).every(h => h.inf == null || h.iso || !running(W, h)) },
        { text: "FS01 を感染できない状態にする（SMBv1 無効化・445 の受信遮断・隔離のいずれか）", ok: W => { const h = W.H("FS01"); return !h.enc && (!h.smb1 || block445(h) || h.iso); } },
        { text: "MES-SV を感染できない状態にする（同上）", ok: W => { const h = W.H("MES-SV"); return !h.enc && (!h.smb1 || block445(h) || h.iso); } }
      ],
      cmds: { isolate, report: defReport(Object.fromEntries(["PC-0412", "PC-0413", "PC-0415", "PC-0420", "FS01", "MES-SV"].map(n => [n, n + " が最初"])), "PC-0412") },
      hints: [
        "Enter-PSSession -ComputerName PC-0412 で入り、netstat -ano | findstr :445 で 445 番へ向かう接続（SYN_SENT）を見る。",
        "tasklist で PID とプロセス名を照らし合わせ、taskkill /PID <番号> /F。または isolate PC-0412。他の端末も同じように調べる。",
        "MES-SV では Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force。FS01（Server 2008 R2）にはこのコマンドレットが無いので、netsh advfirewall firewall add rule name=\"Block SMB\" dir=in action=block protocol=TCP localport=445。",
        "最初の感染端末の報告は report PC-0412。"
      ],
      winText: "感染端末を止め、守るべきサーバーを感染できない状態にした。生産ラインは動き続けた。",
      timeoutText: "連鎖は止まりきらず、復旧の判断は経営に上がった。",
      explain: "自己増殖するワームは、445/tcp（SMB）への大量の接続試行で見つかります。感染端末を止めるのと同時に、守りたいサーバー側でも SMBv1 の無効化や 445 の受信遮断で「感染できない状態」にします。古い OS では使えるコマンドも違います（Get-/Set-SmbServerConfiguration は Windows 8 / Server 2012 以降）。根本対策は更新の適用です。",
      reality: "実際の WannaCry（2017年5月12日）では、更新されていない、またはサポート切れの Windows が影響を受けました。NAO の報告は、インターネット側のファイアウォールを管理していれば感染を防げたという NHS Digital の見解も紹介しています。拡散は、セキュリティ研究者がキルスイッチを作動させたことで止まりました（出典参照）。"
    };
  })();
  /* Windows 7 / Server 2008 R2 には SmbShare モジュールが無い */
  const noCmdlet = (c, W, h) => h.noSmbCmdlet ? [`${c} : The term '${c}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`, `[SIM] ${h.name}（${h.osName}）にはこのコマンドレットがありません（Windows 8 / Server 2012 以降）。netsh で 445 の受信を止める手があります。`] : null;
  D2.cmds["get-smbserverconfiguration"] = { hidden: true, run: (W, h) => noCmdlet("Get-SmbServerConfiguration", W, h) || ST.OPS_WIN["get-smbserverconfiguration"](W, h) };
  D2.cmds["set-smbserverconfiguration"] = { hidden: true, run: (W, h, a) => noCmdlet("Set-SmbServerConfiguration", W, h) || ST.OPS_WIN["set-smbserverconfiguration"](W, h, a) };

  /* =========================================================
     防御3：運用を止めずに守れ（2021年 米国の石油パイプライン事業者の被害を下敷き）
     ========================================================= */
  const D3 = (() => {
    const BAD = "203.0.113.77", POOL = "10.30.99.4";
    const alive = W => !W.blocked.has(BAD) && W.acctOn("legacy_vpn02");
    const persist = W => W.alive("IT-APP01", 6612) && !W.H("IT-APP01").iso;
    const access = W => alive(W) || persist(W);
    const comp = W => Object.values(W.hosts).filter(h => h.comp);
    return {
      id: "colonial", mode: "def", ref: "colonial", tag: "防御 · 実事案ベース", title: "夜明け前のレガシー", goal: "運用を止めずに守れ",
      story: "東湾パイプライン、午前4時58分。記録では、この時刻の少し後に IT 網で身代金要求が見つかり、会社は運用側（OT）への広がりを恐れてパイプラインを止めた。今回は、止めずに済む未来を探せ。",
      fiction: "社名・ホスト名・アカウント名・IP・時刻の細部・常駐プログラム・OT への接続試行・警報はすべて創作です。実際の攻撃者の IT 網内での行動は参照資料に記載がなく、ここでの展開は演習用の想定です。",
      loseText: "IT 側の侵害が OT に届くおそれが残り、運用を止めるしかなくなる。",
      limit: 300, date: "2026-11-10", start: hms(4, 58), domain: "touwan.local", me: "soc", home: "SOC-PC",
      banner: ["Windows PowerShell", "Copyright (C) Microsoft Corporation. All rights reserved.", "", "[SIM] 東湾パイプライン SOC 端末。ログは C:\\SIEM（vpn.log / security.log）。OT 側の機器には直接入れません。"],
      hosts: [
        { name: "SOC-PC", ip: "10.30.0.50", label: "あなたの端末", osName: "Microsoft Windows 11 Enterprise", osVer: "10.0.22631 N/A Build 22631",
          files: {
            "C:\\SIEM\\vpn.log": ["2026-11-10 04:31:05 VPN-GW user=k.sato src=192.0.2.44 profile=standard mfa=ok result=SUCCESS", "2026-11-10 04:44:51 VPN-GW user=t.mori src=192.0.2.80 profile=standard mfa=ok result=SUCCESS", "2026-11-10 04:58:12 VPN-GW user=legacy_vpn02 src=203.0.113.77 profile=legacy mfa=none assigned=10.30.99.4 result=SUCCESS"],
            "C:\\SIEM\\security.log": ["2026-11-10 04:32:10 EventID=4624 LogonType=3 Computer=IT-FS01 TargetUser=TOUWAN\\k.sato SourceIp=10.30.99.2"]
          } },
        { name: "DC01", ip: "10.30.0.10", label: "ドメインコントローラ", role: "dc", ports: [{ port: 53, pid: 2112 }, { port: 445, pid: 4 }] },
        { name: "VPN-GW", ip: "10.30.0.1", label: "VPN 装置", os: "appliance", noWinRM: true },
        { name: "IT-FS01", ip: "10.30.1.20", label: "社内ファイル（IT）", ports: [{ port: 445, pid: 4 }] },
        { name: "IT-APP01", ip: "10.30.1.30", label: "請求システム（IT）", ports: [{ port: 443, pid: 3001 }, { port: 445, pid: 4 }], procs: [{ name: "BillingSvc.exe", pid: 3001, mem: "220,410 K" }] },
        { name: "OT-GW", ip: "10.30.9.1", label: "IT/OT 境界ゲートウェイ", os: "appliance", noWinRM: true },
        { name: "OT-HIST", ip: "10.40.0.20", label: "運用データ（OT）", os: "appliance", noWinRM: true, noPing: true }
      ],
      accounts: [
        { name: "soc", full: "SOC 当直", groups: "*Domain Users         *SOC" },
        { name: "legacy_vpn02", full: "旧委託先 VPN 用", comment: "2019年 契約終了（削除予定）", groups: "*Domain Users         *VPN Users", last: "2026/11/10 4:58:12", pwset: "2018/10/01 9:30:00" },
        { name: "k.sato", full: "佐藤 健", groups: "*Domain Users         *VPN Users", last: "2026/11/10 4:31:05" },
        { name: "t.mori", full: "森 拓", groups: "*Domain Users         *VPN Users", last: "2026/11/10 4:44:51" }
      ],
      events: [
        { at: 6, run: W => W.alert("VPN-GW: 多要素認証なしのログオン（profile=legacy）") },
        { at: 35, run: W => { if (!alive(W)) return; ["IT-FS01", "IT-APP01"].forEach((t, i) => { W.log("SOC-PC", "C:\\SIEM\\security.log", `EventID=4624 LogonType=3 Computer=${t} TargetUser=TOUWAN\\legacy_vpn02 SourceIp=${POOL}`, i); W.conn(t, { lport: 445, foreign: `${POOL}:5${1300 + i}`, pid: 4 }); W.H(t).comp = true; }); } },
        { at: 65, run: W => { const h = W.H("IT-APP01"); if (!alive(W) || !h.comp || h.iso) return; W.proc("IT-APP01", "rsvc.exe", 6612, "4,880 K"); h.procs.find(p => p.pid === 6612).hard = true; W.conn("IT-APP01", { lport: 50211, foreign: "198.51.100.140:443", pid: 6612 }); W.log("SOC-PC", "C:\\SIEM\\security.log", "EventID=7045 Computer=IT-APP01 ServiceName=RemoteSvcHelper ImagePath=C:\\ProgramData\\rsvc.exe StartType=auto"); } },
        { at: 110, run: W => { const h = W.H("IT-APP01"); if (!access(W) || !h.comp || h.iso || W.H("OT-GW").iso) return; [1, 2, 3].forEach(i => W.conn("IT-APP01", { lport: 50300 + i, foreign: "10.40.0.20:502", state: "SYN_SENT", pid: W.alive("IT-APP01", 6612) ? 6612 : 4 })); W.alert("OT-GW: IT 側から OT 機器（502/tcp）への接続試行が増えている"); } },
        { at: 165, run: W => { if (!access(W)) return; comp(W).forEach(h => { if (h.iso) return; h.enc = true; W.file(h.name, "C:\\Users\\Public\\README_RESTORE.txt", ["Your files are encrypted.", "To restore them, contact us. (演習用の架空の文面。連絡先は載せていません)"]); }); if (comp(W).some(h => h.enc)) W.alert("IT-FS01 / IT-APP01: 大量のファイル暗号化。身代金要求の文書が見つかった"); } },
        { at: 225, run: W => { if (access(W) && !W.H("OT-GW").iso && comp(W).some(h => !h.iso)) W.lose("IT 側の侵害が OT に届くおそれが消えず、パイプラインの運用を止めるしかなくなった。"); } }
      ],
      onBlock: () => {}, onAcct: () => {},
      goals: [
        { text: "侵入経路を特定して報告する（report）", ok: W => W.answered === "vpn-account" },
        { text: "使われていないはずのアカウントを無効化する", ok: W => !W.acctOn("legacy_vpn02") },
        { text: "IT と OT の境界を切り、運用側を守る（OT-GW の隔離）", ok: W => W.H("OT-GW").iso },
        { text: "侵害された IT サーバーを封じ込める（隔離）", ok: W => !access(W) && comp(W).every(h => h.iso) }
      ],
      cmds: { isolate, block, report: defReport({ phishing: "メールの添付・リンク", "vpn-account": "使われていない VPN アカウント（パスワードのみ）", web: "公開Webの脆弱性", insider: "内部不正" }, "vpn-account") },
      hints: [
        "findstr \"mfa=none\" C:\\SIEM\\vpn.log で、多要素認証なしのログオンを探す。",
        "net user legacy_vpn02 /domain で Comment と Last logon を確認し、net user legacy_vpn02 /active:no /domain で無効化。",
        "findstr \"7045\" C:\\SIEM\\security.log で、新しく登録されたサービスがないか。IT-APP01 に Enter-PSSession して netstat -ano と tasklist。",
        "isolate OT-GW で IT と OT を切り離し、侵害サーバーも isolate。報告は report vpn-account。"
      ],
      winText: "入口を閉じ、IT と OT を切り離し、侵害サーバーを封じ込めた。パイプラインは止まらなかった。",
      timeoutText: "封じ込めが終わらないまま夜が明け、運用停止の判断が上がってきた。",
      explain: "入口は、使われていないのに残っていた VPN アカウント。多要素認証がなく、パスワードだけで入れました。入口を閉じても、入り込んだ攻撃者が残した常駐プログラム（サービス登録 7045）があると活動は続きます。IT と OT の境界を切っておけば、運用を止めずに守れる可能性が上がります。",
      reality: "報道によると、実際の事案では多要素認証のない旧 VPN アカウントのパスワードで侵入され、IT 網で身代金要求が見つかった後、OT への拡大を防ぐためにパイプラインの運用が止められました。同社は旧 VPN プロファイルを停止したと証言しています。一次資料（CISA）の内容はこの環境から未確認です（出典参照）。"
    };
  })();

  /* =========================================================
     調査：いま攻撃を受けているか（240秒・報告は1回だけ）
     ========================================================= */
  const INV_BASE = { mode: "inv", limit: 240, date: "2026-11-10", me: "soc", home: "SOC-PC", hintPenalty: 20, timeoutText: "判断できないまま時間切れ。見逃しも誤報も、どちらも代償がある。" };
  const banner = name => ["Windows PowerShell", "Copyright (C) Microsoft Corporation. All rights reserved.", "", `[SIM] ${name} の SOC 端末。ログは C:\\SIEM。判定は report で1回だけ。`];
  const invGoal = ans => [{ text: "状況を判定して report で報告する（報告は1回だけ）", ok: W => W.answered === ans }];

  const I1 = Object.assign({}, INV_BASE, {
    id: "inv-backup", tag: "調査", title: "深夜の 180GB", goal: "大量送信の正体を見極めろ", basis: "特定の事案ではありません。誤検知を見分ける練習用の創作です。",
    story: "北杜ロジ、午前3時5分。DLP が「ファイルサーバーから 2 時間で 180GB の送信」を検知した。情報の持ち出しか、それとも――。",
    fiction: "組織・ホスト・IP・ログはすべて創作です。",
    start: hms(3, 5), domain: "hokuto-logi.local", banner: banner("北杜ロジ"),
    hosts: [
      { name: "SOC-PC", ip: "10.60.0.50", label: "あなたの端末", files: {
        "C:\\SIEM\\dlp.log": ["2026-11-10 03:04:51 rule=LargeTransfer src=10.60.1.20 dst=10.60.9.20 dport=443 bytes=193273528320 window=2h"],
        "C:\\SIEM\\change_calendar.txt": ["定例作業（変更管理で承認済み）", "毎日 01:00-04:00  FILE-SV02 → BK-SV01 フルバックアップ（BackupAgent、443/tcp）", "毎月 第2火曜     月例更新の配布"] } },
      { name: "DC01", ip: "10.60.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "FILE-SV02", ip: "10.60.1.20", label: "ファイルサーバー", ports: [{ port: 445, pid: 4 }], procs: [{ name: "BackupAgent.exe", pid: 4410, mem: "96,224 K" }], conns: [{ proto: "TCP", lport: 50544, foreign: "10.60.9.20:443", state: "ESTABLISHED", pid: 4410 }],
        files: { "C:\\ProgramData\\Backup\\job.log": ["2026-11-10 01:00:00 Nightly full backup started. target=bk-sv01.hokuto-logi.local:443", "2026-11-10 02:00:00 Progress 38%", "2026-11-10 03:00:00 Progress 81%"] } },
      { name: "BK-SV01", ip: "10.60.9.20", label: "バックアップサーバー", ports: [{ port: 443, pid: 2200 }] }
    ],
    events: [{ at: 1, run: W => W.alert("DLP: FILE-SV02 から 10.60.9.20:443 へ 2時間で 180GB の送信") }],
    goals: invGoal("none"),
    cmds: { report: invReport({ none: "攻撃ではない（正常な業務）", exfil: "外部への情報持ち出し", ransomware: "ランサムウェアの暗号化", bruteforce: "パスワードの総当たり" }, "none", "宛先は社内のバックアップサーバーで、プロセスも予定も説明がつく。誤報で業務を止めてしまった。") },
    hints: ["nslookup 10.60.9.20 と type C:\\SIEM\\change_calendar.txt で、宛先と予定を確認する。", "Enter-PSSession -ComputerName FILE-SV02 で netstat -ano と tasklist を照合し、type C:\\ProgramData\\Backup\\job.log を見る。"],
    explain: "送信先は社内のバックアップサーバー（nslookup で社内の名前が引ける）。通信しているのは BackupAgent.exe で、変更管理の予定表にも毎晩のフルバックアップがあります。量が多いだけで、宛先・プロセス・予定がすべて説明できます。誤報を見分けるのも調査の仕事です。"
  });

  const I2 = Object.assign({}, INV_BASE, {
    id: "inv-valid", ref: "colonial", tag: "調査 · 実事案ベース", title: "派手な警報、静かな1行", goal: "侵入を許したか見極めろ",
    story: "南港ガス、午前3時20分。VPN 装置が「ログオン失敗の急増」を警告している。総当たりは防げたのか。それとも、もっと静かな何かが起きているのか。",
    fiction: "組織・ホスト・IP・ログはすべて創作です。下敷きにした事案の「使われていないアカウントがパスワードだけで使われた」という要素だけを借りています。",
    start: hms(3, 20), domain: "nanko-gas.local", banner: banner("南港ガス"),
    hosts: [
      { name: "SOC-PC", ip: "10.70.0.50", label: "あなたの端末", files: {
        "C:\\SIEM\\vpn.log": [
          ...Array.from({ length: 14 }, (_, i) => `2026-11-10 03:0${Math.floor(i / 3)}:${String(10 + i * 3).padStart(2, "0")} VPN-GW user=admin src=192.0.2.200 result=FAIL reason=bad_password`),
          "2026-11-10 03:05:01 VPN-GW user=admin src=192.0.2.200 result=FAIL reason=account_locked",
          "2026-11-10 02:47:33 VPN-GW user=y.ito src=192.0.2.31 profile=standard mfa=ok result=SUCCESS",
          "2026-11-10 03:12:40 VPN-GW user=old_partner01 src=203.0.113.150 profile=legacy mfa=none assigned=10.70.99.9 result=SUCCESS",
          "2026-11-10 03:15:02 VPN-GW user=y.ito src=192.0.2.31 result=LOGOUT"],
        "C:\\SIEM\\security.log": ["2026-11-10 02:50:11 EventID=4624 LogonType=3 Computer=FS-NK01 TargetUser=NANKO-GAS\\y.ito SourceIp=10.70.99.4", "2026-11-10 03:13:58 EventID=4624 LogonType=3 Computer=FS-NK01 TargetUser=NANKO-GAS\\old_partner01 SourceIp=10.70.99.9"] } },
      { name: "DC01", ip: "10.70.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "FS-NK01", ip: "10.70.1.20", label: "社内ファイル", ports: [{ port: 445, pid: 4 }], conns: [{ proto: "TCP", lport: 445, foreign: "10.70.99.9:51522", state: "ESTABLISHED", pid: 4 }] }
    ],
    accounts: [
      { name: "admin", full: "（存在しない一般名。攻撃者が試した名前）", comment: "ロック中", groups: "*Domain Users" },
      { name: "y.ito", full: "伊藤 由佳", groups: "*Domain Users         *VPN Users", last: "2026/11/10 2:47:33" },
      { name: "old_partner01", full: "旧委託先", comment: "2020年 委託終了", groups: "*Domain Users         *VPN Users", last: "2026/11/10 3:12:40", pwset: "2019/02/14 15:00:00" }
    ],
    events: [{ at: 1, run: W => W.alert("VPN-GW: 192.0.2.200 からのログオン失敗が急増（user=admin）") }],
    goals: invGoal("valid-account"),
    cmds: { report: invReport({ none: "攻撃は受けていない", bruteforce: "総当たりで突破された", "valid-account": "正規のアカウント情報で入られた", phishing: "メール経由で入られた" }, "valid-account", "警報の総当たりはすべて失敗しロックされていた。本当の侵入は、多要素認証なしで成功した旧委託先アカウントの1行だった。") },
    hints: ["findstr \"SUCCESS\" C:\\SIEM\\vpn.log で、成功したログオンだけを並べる。mfa= の値にも注目。", "net user old_partner01 /domain で Comment と Last logon を見る。"],
    explain: "目立つ警報は総当たりですが、すべて失敗してアカウントはロックされました。本当の問題は静かな1行：委託が終わったのに残っていたアカウントが、多要素認証なしで成功し、ファイルサーバーにもログオンしています。派手な警報の裏にある「成功」を探すのが調査のコツです。",
    reality: "下敷きにした事案では、使われていない旧 VPN アカウントが多要素認証なしのパスワードだけで使われたと証言されています（出典参照）。"
  });

  const I3 = Object.assign({}, INV_BASE, {
    id: "inv-worm", ref: "wanna", tag: "調査 · 実事案ベース", title: "遅いと言われた2台", goal: "どちらが本物の異常か見極めろ",
    story: "西都工業、午後1時40分。2台の PC の利用者から「動作が遅い」と連絡があった。どちらも通信が多い。片方は業務、片方は――。",
    fiction: "組織・ホスト・IP・プロセス名・ログはすべて創作です。",
    start: hms(13, 40), domain: "saito-ind.local", banner: banner("西都工業"),
    dns: { "update.vendor.example": "203.0.113.10" },
    hosts: [
      { name: "SOC-PC", ip: "10.80.0.50", label: "あなたの端末", files: {
        "C:\\SIEM\\helpdesk.log": ["2026-11-10 13:31:02 PC-2207 総務: PC が重い", "2026-11-10 13:35:40 PC-2210 経理: PC が重い"],
        "C:\\SIEM\\change_calendar.txt": ["2026-11-10 (火) 13:00-15:00  月例更新の配布（配布サーバー update.vendor.example → 全端末、443/tcp）"] } },
      { name: "DC01", ip: "10.80.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "PC-2207", ip: "10.80.1.7", label: "総務PC", ports: [{ port: 445, pid: 4 }], procs: [{ name: "svcupd.exe", pid: 6120, mem: "3,140 K" }],
        conns: ["10.80.1.8", "10.80.1.9", "10.80.1.11", "10.80.2.10", "203.0.113.52", "198.51.100.9", "203.0.113.230"].map((ip, i) => ({ proto: "TCP", lport: 49701 + i, foreign: ip + ":445", state: "SYN_SENT", pid: 6120 })),
        files: { "C:\\ProgramData\\svcupd\\svcupd.exe": ["[SIM] 実行ファイル（演習用の架空のもの）"] } },
      { name: "PC-2210", ip: "10.80.1.10", label: "経理PC", procs: [{ name: "UpdateAgent.exe", pid: 3388, mem: "54,020 K" }],
        conns: [1, 2, 3, 4].map(i => ({ proto: "TCP", lport: 50100 + i, foreign: "203.0.113.10:443", state: "ESTABLISHED", pid: 3388 })) },
      { name: "FS-ST01", ip: "10.80.2.10", label: "共有ファイル", ports: [{ port: 445, pid: 4 }] }
    ],
    events: [{ at: 1, run: W => W.alert("IDS: 10.80.1.7 から多数の宛先へ 445/tcp の接続試行") }],
    goals: invGoal("worm"),
    cmds: { report: invReport({ none: "どちらも業務の通信", worm: "社内で自己増殖するワーム", exfil: "外部への情報持ち出し", bruteforce: "パスワードの総当たり" }, "worm", "PC-2207 は 445/tcp へ社内外の多数の宛先に SYN_SENT を出し続けていた。見逃せば、共有サーバーまで広がる。") },
    hints: ["Enter-PSSession -ComputerName PC-2207 で netstat -ano を見る。宛先のポートと状態（SYN_SENT）に注目。", "もう1台は change_calendar.txt の予定と照合する（nslookup update.vendor.example）。"],
    explain: "PC-2210 の通信は予定された月例更新の配布（宛先は配布サーバー、443/tcp、ESTABLISHED）。PC-2207 は見慣れないプロセスが 445/tcp へ社内外の多数の宛先に接続を試みています。宛先が「決まった1か所」か「次々に違う相手」か、が見分けどころです。",
    reality: "下敷きにした WannaCry は、SMBv1 の脆弱性（MS17-010）を悪用し、ポート 445 で自己増殖するネットワークワームでした（出典参照）。"
  });

  const I4 = Object.assign({}, INV_BASE, {
    id: "inv-vendor", ref: "osaka", tag: "調査 · 実事案ベース", title: "警報の鳴らない夜", goal: "静かな侵入に気づけ",
    story: "あおば記念病院、午前1時50分。警報は一つも鳴っていない。定時の確認で、給食サーバーにリモート接続のセッションが残っているのを見つけた。保守作業か、それとも――。",
    fiction: "病院名・ホスト・IP・ログはすべて創作です。下敷きにした事案の「委託先の保守経路から入られた」という要素だけを借りています。",
    start: hms(1, 50), domain: "aoba-mh.local", banner: banner("あおば記念病院"),
    hosts: [
      { name: "SOC-PC", ip: "10.90.0.50", label: "あなたの端末", files: {
        "C:\\SIEM\\maint_schedule.txt": ["委託先 保守作業予定（承認済み）", "2026-11-09 (月) 14:00-16:00  給食システム 定期保守  接続元 192.0.2.10", "2026-11-16 (月) 14:00-16:00  給食システム 定期保守  接続元 192.0.2.10"],
        "C:\\SIEM\\vpn.log": ["2026-11-09 13:57:40 VPN-GW user=food_vendor src=192.0.2.10 assigned=10.90.99.2 result=SUCCESS", "2026-11-09 15:58:22 VPN-GW user=food_vendor src=192.0.2.10 result=LOGOUT", "2026-11-10 01:38:05 VPN-GW user=food_vendor src=198.51.100.61 assigned=10.90.99.3 result=SUCCESS"],
        "C:\\SIEM\\security.log": ["2026-11-10 01:40:12 EventID=4624 LogonType=10 Computer=FOOD-SV TargetUser=AOBA-MH\\food_vendor SourceIp=10.90.99.3"] } },
      { name: "DC01", ip: "10.90.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "FOOD-SV", ip: "10.90.30.5", label: "給食サーバー", ports: [{ port: 3389, pid: 1044 }], conns: [{ proto: "TCP", lport: 3389, foreign: "10.90.99.3:50877", state: "ESTABLISHED", pid: 1044 }],
        sessions: [{ user: "food_vendor", sess: "rdp-tcp#4", id: 3, at: "11/10/2026 1:40 AM" }] },
      { name: "EMR-01", ip: "10.90.50.10", label: "電子カルテ", ports: [{ port: 443, pid: 2900 }] }
    ],
    accounts: [{ name: "food_vendor", full: "給食システム保守（委託先）", comment: "保守作業用", groups: "*Domain Users         *VPN Users", last: "2026/11/10 1:38:05" }],
    goals: invGoal("vendor-path"),
    cmds: { report: invReport({ none: "承認された保守作業", "vendor-path": "委託先の保守経路を使った不正アクセス", phishing: "メール経由の侵入", worm: "ワームの感染" }, "vendor-path", "予定に無い時刻、いつもと違う接続元からの保守アカウントのログオンだった。見逃した侵入は、後で基幹システムまで届くことがある。") },
    hints: ["type C:\\SIEM\\maint_schedule.txt と type C:\\SIEM\\vpn.log を見比べる。", "Enter-PSSession -ComputerName FOOD-SV で quser と netstat -ano。接続元はどこか。"],
    explain: "承認された保守は月曜の昼、接続元は 192.0.2.10。いまのセッションは深夜で、接続元は 198.51.100.61。警報が鳴らなくても、「予定」と「実際」を突き合わせると気づけます。",
    reality: "下敷きにした事案では、委託先の給食システム側から侵入され、警報ではなくシステム障害で被害が表に出ました（出典参照）。"
  });


  ST.OPS = { missions: [D1, D2, D3, I1, I2, I3, I4] };
})(window.ST);
