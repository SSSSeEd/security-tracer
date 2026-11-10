"use strict";
/* 攻防端末の基礎訓練（必須ラボ）。時間制限なし・攻撃側は動かない・ヒントは無料。
   1つの手順ごとに「授業」（短い説明）→「やること」→ 正しく打てたら次へ、の順に進む。
   クリアすると ST.markLab("ops-tut-N") で記録し、本番ミッションの鍵が開く。組織・ホスト・IP はすべて架空。 */
(function (ST) {
  const lc = s => String(s || "").toLowerCase();
  const has = (out, s) => out.some(l => l.includes(s));
  const base = (id, n) => ({ id, mode: "tut", tag: `基礎訓練 ${n}`, limit: 0, date: "2026-11-10", start: 10 * 3600, domain: "kunren.local", me: "trainee", home: "SOC-PC", fiction: "訓練用の架空のネットワークです。組織・ホスト・IP・ログはすべて創作です。",
    banner: ["Windows PowerShell", "Copyright (C) Microsoft Corporation. All rights reserved.", "", "[SIM] 訓練用ネットワーク（kunren.local）。時間制限なし。困ったら hint（無料）。"] });
  const pick = (choices, answer, wrongMsg) => ({ usage: "report <答え>", d: "判断を報告（引数なしで選択肢を表示）", run(W, h, a) {
    if (!a[0]) return ["[GAME] 報告の選択肢：", ...Object.entries(choices).map(([k, v]) => `  report ${k}   … ${v}`)];
    const k = Object.keys(choices).find(x => lc(x) === lc(a[0]));
    if (!k) return ["[GAME] その選択肢はありません。report だけを打つと一覧が出ます。"];
    if (k !== answer) return [`[GAME] ${wrongMsg}`];
    W.answered = k; return [`[GAME] 報告を受理：${choices[k]}`];
  } });

  /* ---------- 1. 端末に慣れる ---------- */
  const T1 = Object.assign(base("ops-tut-1", 1), {
    title: "端末に慣れる", goal: "コマンドの打ち方を覚えろ",
    story: "攻防端末の最初の訓練です。PowerShell の画面にコマンドを打ち、Enter で実行します。ここでは自分の端末の情報と、ネットワークの相手を確かめる基本の5つを覚えます。",
    lessons: [["net-layers", "層とカプセル化"], ["net-dns", "DNSのしくみと攻撃"], ["net-tcp", "TCPと通信の始まり"]],
    hosts: [
      { name: "SOC-PC", ip: "10.0.0.50", label: "あなたの端末", osName: "Microsoft Windows 11 Enterprise", osVer: "10.0.22631 N/A Build 22631" },
      { name: "DC01", ip: "10.0.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "WEB01", ip: "10.0.1.20", label: "社内Webサーバー", ports: [{ port: 443, pid: 2210 }] },
      { name: "OLD-NAS", ip: "10.0.1.99", label: "古いNAS（応答なし）", os: "appliance", noWinRM: true, noPing: true }
    ],
    steps: [
      { lesson: ["ここは PowerShell の画面です。下の行にコマンドを打って Enter で実行します。", "まずは、いま使っている端末の名前を確かめます。"], task: "hostname を打つ", hint: "hostname", ok: (W, c) => c === "hostname" },
      { lesson: ["whoami は「いまだれとしてログオンしているか」を表示します。", "表示は ドメイン名\\ユーザー名 の形です。調査では、自分の権限を最初に確かめる習慣をつけます。"], task: "whoami を打つ", hint: "whoami", ok: (W, c) => c === "whoami" },
      { lesson: ["ipconfig は自分の IP アドレスなどを表示します。", "10.x.x.x は社内だけで使うプライベートアドレスです。"], task: "ipconfig を打って、自分の IPv4 Address を確かめる", hint: "ipconfig", ok: (W, c) => c === "ipconfig" },
      { lesson: ["nslookup は、名前から IP アドレスを DNS サーバーに問い合わせます。", "ログに名前しかないとき、IP しかないときに、両方を結び付けるのに使います。"], task: "nslookup web01 で WEB01 の IP を調べる", hint: "nslookup web01", ok: (W, c, a, out) => c === "nslookup" && has(out, "10.0.1.20") },
      { lesson: ["ping は相手が応答するかを確かめます。Reply from … が返れば届いています。", "Request timed out は「届かない」か「応答しない設定」。それだけで止まっているとは言い切れません。"], task: "ping web01 を打つ", hint: "ping web01", ok: (W, c, a, out) => c === "ping" && has(out, "Reply from 10.0.1.20") },
      { lesson: ["応答しない相手も見ておきます。OLD-NAS は ping に応答しない設定です。", "↑キーで前に打ったコマンドを呼び出せます。打ち直すより速く、打ち間違いも減ります。"], task: "ping old-nas を打って、応答しない結果を見る", hint: "ping old-nas", ok: (W, c, a, out) => c === "ping" && has(out, "Request timed out") },
      { lesson: ["help でこの演習で使えるコマンドの一覧が出ます。本番で迷ったら、まず help。", "Tab キーで、コマンド名の続きを補完できます（例: ipc → Tab → ipconfig）。cls で画面を消せます。"], task: "help を打つ", hint: "help", ok: (W, c) => c === "help" }
    ],
    explain: "hostname・whoami・ipconfig で「自分」を、nslookup・ping で「相手」を確かめました。本番でもまずここから始めます。"
  });

  /* ---------- 2. ログを読む ---------- */
  const T2 = Object.assign(base("ops-tut-2", 2), {
    title: "ログを読む", goal: "ログから事実を拾え",
    story: "警報が鳴ったとき、最初に見るのはログです。ここでは、ファイルを開く・語で絞る・数える・つなぐ、の4つを練習し、最後に「総当たりは成功したか」を判断します。",
    lessons: [["de-logs", "ログから攻撃を見つける"], ["au-pw", "強いパスワードとは"], ["au-mfa", "多要素認証とパスキー"]],
    hosts: [
      { name: "SOC-PC", ip: "10.0.0.50", label: "あなたの端末", files: {
        "C:\\SIEM\\README.txt": ["auth.log  … VPN 装置の認証ログ（訓練用の簡略形式）"],
        "C:\\SIEM\\auth.log": [
          "2026-11-10 08:58:12 VPN-GW user=m.kato src=192.0.2.31 result=SUCCESS mfa=ok",
          ...Array.from({ length: 7 }, (_, i) => `2026-11-10 09:0${i}:1${i} VPN-GW user=Admin src=192.0.2.200 result=FAIL reason=bad password`),
          "2026-11-10 09:07:40 VPN-GW user=admin src=192.0.2.200 result=FAIL reason=bad password",
          "2026-11-10 09:07:58 VPN-GW user=Admin src=192.0.2.200 result=FAIL reason=account locked",
          "2026-11-10 09:12:03 VPN-GW user=s.ono src=192.0.2.44 result=SUCCESS mfa=ok",
          "2026-11-10 09:20:47 VPN-GW user=m.kato src=192.0.2.31 result=LOGOUT"] } },
      { name: "DC01", ip: "10.0.0.10", label: "ドメインコントローラ", role: "dc" }
    ],
    steps: [
      { lesson: ["ログはファイルです。まずフォルダの中身を一覧します。", "dir（PowerShell では Get-ChildItem の別名）を使います。"], task: "dir C:\\SIEM を打つ", hint: "dir C:\\SIEM", ok: (W, c, a) => ["dir", "ls", "gci", "get-childitem"].includes(c) && a.some(x => lc(x).includes("siem")) },
      { lesson: ["type はファイルの中身を全部表示します（PowerShell では Get-Content の別名）。"], task: "type C:\\SIEM\\auth.log を打つ", hint: "type C:\\SIEM\\auth.log", ok: (W, c, a) => ["type", "cat", "gc", "get-content"].includes(c) && a.some(x => lc(x).includes("auth.log")) },
      { lesson: ["行が多いときは findstr で、ある語を含む行だけに絞ります。", "形: findstr <語> <ファイル>"], task: "findstr FAIL C:\\SIEM\\auth.log で、失敗だけを並べる", hint: "findstr FAIL C:\\SIEM\\auth.log", ok: (W, c, a, out) => c === "findstr" && has(out, "result=FAIL") && !has(out, "SUCCESS") },
      { lesson: ["注意：findstr は既定で大文字と小文字を区別します。", "findstr admin では user=Admin の行が出ません。/I を付けると区別しなくなります。"], task: "findstr /I admin C:\\SIEM\\auth.log で、Admin と admin の両方を出す", hint: "findstr /I admin C:\\SIEM\\auth.log", ok: (W, c, a, out) => c === "findstr" && a.some(x => lc(x) === "/i") && has(out, "user=Admin") && has(out, "user=admin") },
      { lesson: ["スペースを含む語句をそのまま探すときは /C:\"…\" を使います。", "/C なしで findstr bad password と打つと、「bad」か「password」のどちらかを含む行、という意味になります。"], task: "findstr /C:\"account locked\" C:\\SIEM\\auth.log でロックされた行を探す", hint: "findstr /C:\"account locked\" C:\\SIEM\\auth.log", ok: (W, c, a, out) => c === "findstr" && a.some(x => /^\/c:/i.test(x)) && has(out, "account locked") },
      { lesson: ["数を知りたいときは find /C。形: find /C \"語\" <ファイル>", "find は語を \" \" で囲みます（findstr とは書き方が違います）。"], task: "find /C \"FAIL\" C:\\SIEM\\auth.log で失敗の回数を数える", hint: "find /C \"FAIL\" C:\\SIEM\\auth.log", ok: (W, c, a) => c === "find" && a.some(x => lc(x) === "/c") },
      { lesson: ["| （パイプ）は、左のコマンドの出力を右のコマンドに渡します。", "本番では netstat -ano | findstr :445 のように、長い出力を絞るのによく使います。"], task: "type C:\\SIEM\\auth.log | findstr SUCCESS を打つ", hint: "type C:\\SIEM\\auth.log | findstr SUCCESS", ok: (W, c, a, out, h, line) => line.includes("|") && /findstr/i.test(line.split("|")[1] || "") && has(out, "SUCCESS") },
      { lesson: ["ここまでの結果で判断します。192.0.2.200 からの失敗が続いたあと、同じ送信元から SUCCESS はありましたか？", "総当たりが成功していれば report yes、成功していなければ report no。"], task: "report で判断を報告する", hint: "findstr 192.0.2.200 C:\\SIEM\\auth.log で、その送信元の行だけを見てから report", ok: W => W.answered === "no" }
    ],
    cmds: { report: pick({ yes: "総当たりが成功している", no: "総当たりは成功していない（ロックで止まった）" }, "no", "もう一度、192.0.2.200 の行だけを見てみよう（findstr 192.0.2.200 C:\\SIEM\\auth.log）。") },
    explain: "派手に失敗が並んでも、大事なのは「成功があるか」です。findstr で絞る、/I で大文字小文字をそろえる、/C で語句ごと探す、find /C で数える、| でつなぐ。この5つで本番のログはほとんど読めます。"
  });

  /* ---------- 3. 端末を調べる ---------- */
  const T3 = Object.assign(base("ops-tut-3", 3), {
    title: "端末を調べる", goal: "怪しいプロセスを特定しろ",
    story: "利用者から「PC-101 の様子がおかしい」と連絡がありました。遠隔で端末に入り、通信とプロセスを照らし合わせて、怪しいものを特定します。",
    lessons: [["net-tcp", "TCPと通信の始まり"], ["mw-types", "マルウェアの種類"], ["de-chain", "キルチェーンとATT&CK"]],
    hosts: [
      { name: "SOC-PC", ip: "10.0.0.50", label: "あなたの端末" },
      { name: "DC01", ip: "10.0.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "PC-101", ip: "10.0.2.101", label: "営業PC", osName: "Microsoft Windows 11 Pro", osVer: "10.0.22631 N/A Build 22631",
        ports: [{ port: 135, pid: 812 }, { port: 445, pid: 4 }],
        procs: [{ name: "explorer.exe", pid: 3020, mem: "98,120 K", sess: "Console", sn: 1 }, { name: "msedge.exe", pid: 3100, mem: "210,334 K", sess: "Console", sn: 1 }, { name: "OUTLOOK.EXE", pid: 3388, mem: "180,002 K", sess: "Console", sn: 1 }, { name: "updater32.exe", pid: 4242, mem: "5,128 K", sess: "Console", sn: 1 }],
        conns: [
          { proto: "TCP", lport: 50110, foreign: "10.0.1.20:443", state: "ESTABLISHED", pid: 3100 },
          { proto: "TCP", lport: 50121, foreign: "10.0.0.25:443", state: "ESTABLISHED", pid: 3388 },
          { proto: "TCP", lport: 50177, foreign: "203.0.113.66:443", state: "ESTABLISHED", pid: 4242 },
          { proto: "TCP", lport: 50180, foreign: "10.0.0.10:389", state: "TIME_WAIT", pid: 0 }],
        sessions: [{ user: "k.yamada", sess: "console", id: 1, at: "11/10/2026 8:51 AM" }] }
    ],
    dns: { "mail.kunren.local": "10.0.0.25" },
    steps: [
      { lesson: ["Enter-PSSession は、別の Windows 端末に遠隔でつなぐ PowerShell のコマンドです。", "つながるとプロンプトが [PC-101]: PS … に変わり、以後のコマンドは PC-101 の上で動きます。"], task: "Enter-PSSession -ComputerName PC-101 を打つ", hint: "Enter-PSSession -ComputerName PC-101", ok: W => W.stack[W.stack.length - 1] === "PC-101" },
      { lesson: ["netstat -ano は通信の一覧です。-a=すべて、-n=数字で表示、-o=PID も表示。", "State の意味：LISTENING=待ち受け中 / ESTABLISHED=接続中 / SYN_SENT=接続しようとしている / TIME_WAIT=終わったばかり。", "最後の列 PID は「どのプロセスの通信か」を表す番号です。"], task: "netstat -ano を打つ", hint: "netstat -ano", ok: (W, c, a, out, h) => h.name === "PC-101" && c === "netstat" && a.some(x => /o/i.test(x)) },
      { lesson: ["接続中だけに絞ります。宛先（Foreign Address）が社内 10.x か、外部かに注目します。", "203.0.113.x のような社外の相手に、見慣れないプロセスがつないでいたら要注意です。"], task: "netstat -ano | findstr ESTABLISHED を打つ", hint: "netstat -ano | findstr ESTABLISHED", ok: (W, c, a, out, h) => h.name === "PC-101" && c === "netstat" && has(out, "ESTABLISHED") && !has(out, "LISTENING") },
      { lesson: ["外部につないでいる行の PID をプロセス名に変えます。tasklist はプロセスの一覧です。", "形: tasklist | findstr <PID>"], task: "外部 203.0.113.66 とつないでいる PID を tasklist | findstr で調べる", hint: "tasklist | findstr 4242", ok: (W, c, a, out, h) => h.name === "PC-101" && c === "tasklist" && has(out, "updater32.exe") },
      { lesson: ["quser（query user）で、いまだれがログオンしているかを見ます。", "利用者に連絡するとき、だれの端末かを確かめておきます。"], task: "quser を打つ", hint: "quser", ok: (W, c, a, out, h) => h.name === "PC-101" && (c === "quser" || c === "query") },
      { lesson: ["exit で遠隔の接続を閉じ、自分の端末に戻ります。"], task: "exit を打つ", hint: "exit", ok: W => W.stack.length === 0 },
      { lesson: ["判断します。社外とつないでいた見慣れないプロセスはどれでしたか？", "report だけを打つと選択肢が出ます。"], task: "report で怪しいプロセスを報告する", hint: "report updater32.exe", ok: W => W.answered === "updater32.exe" }
    ],
    cmds: { report: pick({ "msedge.exe": "msedge.exe", "OUTLOOK.EXE": "OUTLOOK.EXE", "updater32.exe": "updater32.exe" }, "updater32.exe", "その PID の宛先は社内でした。社外（203.0.113.66）につないでいる行の PID を見直そう。") },
    explain: "netstat の PID と tasklist の PID を照らし合わせると、「どのプロセスが、どこと話しているか」が分かります。社外の見慣れない相手 × 見慣れないプロセス名、が典型的な手がかりです。"
  });

  /* ---------- 4. 封じ込める ---------- */
  const T4 = Object.assign(base("ops-tut-4", 4), {
    title: "封じ込める", goal: "広がる前に止めろ",
    story: "調べた次は、止める番です。アカウントを止める・プロセスを止める・古い通信方式を止める・受信を止める・端末を切り離す。本番で使う封じ込めの手を、順番に1回ずつ打ちます。",
    lessons: [["net-fw", "ファイアウォールのルール"], ["mw-worm", "ワームが広がる速さ"], ["de-zt", "ゼロトラストと最小権限"]],
    hosts: [
      { name: "SOC-PC", ip: "10.0.0.50", label: "あなたの端末" },
      { name: "DC01", ip: "10.0.0.10", label: "ドメインコントローラ", role: "dc" },
      { name: "PC-205", ip: "10.0.2.205", label: "感染した端末", procs: [{ name: "badtool.exe", pid: 5150, mem: "2,048 K", hard: true }], conns: [{ proto: "TCP", lport: 49801, foreign: "10.0.3.10:445", state: "SYN_SENT", pid: 5150 }] },
      { name: "SV-01", ip: "10.0.3.10", label: "共有サーバー", smb1: true, osName: "Microsoft Windows Server 2019 Standard", ports: [{ port: 445, pid: 4 }] }
    ],
    accounts: [{ name: "temp_vendor", full: "臨時の委託先アカウント", comment: "作業終了済み", groups: "*Domain Users         *VPN Users", last: "2026/11/10 9:41:20" }],
    steps: [
      { lesson: ["ドメインのアカウントは net user <名前> /domain で状態を見ます。", "/domain を付けないと、いま居る端末のローカルアカウントを探してしまいます。"], task: "net user temp_vendor /domain を打つ", hint: "net user temp_vendor /domain", ok: (W, c, a, out) => c === "net" && a.some(x => lc(x) === "/domain") && has(out, "temp_vendor") },
      { lesson: ["使い終わったのに残っているアカウントは、侵入口になります。", "無効化：net user <名前> /active:no /domain（削除ではなく停止なので、あとで戻せます）"], task: "temp_vendor を無効にする", hint: "net user temp_vendor /active:no /domain", ok: W => !W.acctOn("temp_vendor") },
      { lesson: ["次はプロセス。感染した PC-205 に入ります。"], task: "Enter-PSSession -ComputerName PC-205 を打つ", hint: "Enter-PSSession -ComputerName PC-205", ok: W => W.stack[W.stack.length - 1] === "PC-205" },
      { lesson: ["taskkill /PID <番号> /F でプロセスを止めます。PID は tasklist で確かめます。", "/F（強制）がないと止まらないプロセスもあります。試してみると分かります。"], task: "badtool.exe を止める", hint: "tasklist | findstr badtool → taskkill /PID 5150 /F", ok: W => W.flags.has("kill:PC-205:badtool.exe") },
      { lesson: ["exit で戻り、次は守る側のサーバー SV-01 に入ります。"], task: "exit してから Enter-PSSession -ComputerName SV-01", hint: "exit → Enter-PSSession -ComputerName SV-01", ok: W => W.stack[W.stack.length - 1] === "SV-01" },
      { lesson: ["SMBv1 は古いファイル共有の方式で、ワームに悪用された歴史があります。まず有効かどうかを確かめます。", "Get-SmbServerConfiguration は Windows 8 / Server 2012 以降のコマンドです。"], task: "Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol を打つ", hint: "Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol", ok: (W, c, a, out, h) => h.name === "SV-01" && c === "get-smbserverconfiguration" },
      { lesson: ["無効化します。-Force を付けると確認の質問なしで実行されます。", "$false は PowerShell の「偽」。綴りを間違えるとエラーになります。"], task: "Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force", hint: "Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force", ok: W => !W.H("SV-01").smb1 },
      { lesson: ["感染端末からの受信をファイアウォールで止めます。netsh advfirewall のルール追加です。", "必須は name=（名前）・dir=（in/out）・action=（block など）。送信元の指定は remoteip=。"], task: "SV-01 で PC-205（10.0.2.205）からの受信を止めるルールを追加する", hint: "netsh advfirewall firewall add rule name=\"Block PC-205\" dir=in action=block remoteip=10.0.2.205", ok: W => W.H("SV-01").fw.some(r => r.dir === "in" && r.action === "block" && r.remoteip === "10.0.2.205") },
      { lesson: ["最後に、感染端末そのものをネットワークから切り離します。", "現場では EDR 製品の管理画面で行う操作なので、この演習では [GAME] コマンド isolate に置き換えています。"], task: "exit してから isolate PC-205", hint: "exit → isolate PC-205", ok: W => W.H("PC-205").iso },
      { lesson: ["本番では、判断を report で報告するとミッションの条件が満たされます。", "この訓練では report done で完了です。"], task: "report done を打つ", hint: "report done", ok: W => W.answered === "done" }
    ],
    cmds: { isolate: { usage: "isolate <ホスト名>", d: "EDR の管理画面から端末をネットワーク隔離（製品操作の抽象化）", run(W, h, a) { const t = a[0] && W.H(a[0]); if (!t) return ["[GAME] 管理対象にそのホストはありません。"]; if (t.name === W.m.home) return ["[GAME] 自分の端末は隔離できません。"]; t.iso = true; t.conns = []; return [`[GAME] EDR 管理コンソール：${t.name} をネットワーク隔離しました。`]; } },
      report: pick({ done: "封じ込めの手順を完了した" }, "done", "") },
    explain: "アカウント停止・プロセス停止・SMBv1 無効化・受信の遮断・隔離。本番の3つの防御ミッションは、この組み合わせで解けます。どれも、自分が管理を任された環境でだけ使う操作です。"
  });

  ST.OPS_TUT = [T1, T2, T3, T4];
})(window.ST);
