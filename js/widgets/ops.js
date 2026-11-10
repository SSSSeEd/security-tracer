"use strict";
/* 攻防端末（リアルタイム）：架空の組織ネットワークの中だけで動く、擬似ターミナルの演習。
   - 実在の機器・ネットワークには何もしない。すべてブラウザ内の模擬。
   - 調査・診断・防御で現場が実際に打つコマンドは、本物の構文と出力形式に合わせる（ping, nslookup, netstat, tasklist, taskkill,
     net user, quser, findstr, netsh advfirewall, Get/Set-SmbServerConfiguration, Enter-PSSession など）。
   - プレイヤーは防御・調査の側だけ。攻撃側の動きは裏で進む筋書きで、攻撃の手順やコードは載せない。
   - 製品固有の操作（EDR の隔離、境界FWの遮断）や報告は [GAME] コマンドとして抽象化する。
   - シナリオは実インシデントを下敷きにしたフィクション。事実と脚色の区別と出典は各ミッションのデータに持つ。 */
(function (ST) {
  const esc = ST.esc;
  const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
  const two = n => String(n).padStart(2, "0");
  const clone = o => JSON.parse(JSON.stringify(o));
  const wpath = p => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();

  /* ---------- World ---------- */
  const mkWorld = m => {
    const W = { m, t: 0, hosts: {}, byIp: {}, acct: {}, blocked: new Set(), flags: new Set(), stack: [], q: [], out: [], over: null, hintI: 0, answered: null };
    for (const h0 of m.hosts) {
      const h = Object.assign({ procs: [], conns: [], ports: [], files: {}, fw: [], iso: false, smb1: false, enc: false, comp: false, os: "win", cwd: null }, clone(h0));
      if (!h.cwd) h.cwd = "C:\\Users\\" + (m.me || "soc") + (h.name === m.home ? "" : "\\Documents");
      const files = {}; for (const k in h.files) files[h.os === "linux" ? k : wpath(k)] = { name: k, lines: h.files[k] };
      h.files = files;
      W.hosts[h.name.toUpperCase()] = h; W.byIp[h.ip] = h;
    }
    for (const a of m.accounts || []) W.acct[(a.host ? a.host.toUpperCase() + "\\" : "") + a.name.toLowerCase()] = Object.assign({ active: true }, clone(a));
    W.H = n => W.hosts[String(n).toUpperCase()] || W.byIp[n] || W.hosts[String(n).toUpperCase().split(".")[0]];
    W.cur = () => W.H(W.stack.length ? W.stack[W.stack.length - 1] : m.home);
    W.clock = (add = 0) => { const s = m.start + W.t + add; return `${two(Math.floor(s / 3600) % 24)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`; };
    W.ts = (add = 0) => `${m.date} ${W.clock(add)}`;
    W.file = (host, path, lines) => { const h = W.H(host), k = h.os === "linux" ? path : wpath(path); h.files[k] = { name: path, lines: lines.slice() }; };
    W.log = (host, path, msg, add = 0) => { const h = W.H(host), k = h.os === "linux" ? path : wpath(path); (h.files[k] || (h.files[k] = { name: path, lines: [] })).lines.push(`${W.ts(add)} ${msg}`); };
    W.say = (text, cls = "sim") => W.out.push({ text, cls });
    W.alert = text => W.say(`[SIEM ALERT ${W.clock()}] ${text}`, "alert");
    W.later = (sec, fn) => W.q.push({ at: W.t + sec, fn });
    W.acctOn = (name, host) => { const a = W.acct[(host ? host.toUpperCase() + "\\" : "") + name.toLowerCase()]; return !!(a && a.active); };
    W.reach = (from, to, port) => {
      const a = W.H(from), b = W.H(to);
      if (!a || !b || a.iso || b.iso) return false;
      return !b.fw.some(r => r.dir === "in" && r.action === "block" && (!r.remoteip || r.remoteip === "any" || r.remoteip === a.ip) && (!r.localport || String(r.localport) === String(port)));
    };
    W.proc = (host, name, pid, mem = "12,480 K") => { const h = W.H(host); if (!h.procs.some(p => p.pid === pid)) h.procs.push({ name, pid, mem, sess: "Services", sn: 0 }); };
    W.alive = (host, pid) => W.H(host).procs.some(p => p.pid === pid);
    W.conn = (host, c) => W.H(host).conns.push(Object.assign({ proto: "TCP", state: "ESTABLISHED" }, c));
    W.lose = msg => { if (!W.over) W.over = { win: false, msg }; };
    (m.events || []).forEach(e => W.q.push({ at: e.at, fn: e.run }));
    if (m.init) m.init(W);
    return W;
  };

  /* ---------- Text utilities (Windows) ---------- */
  const tokenize = s => {
    const out = []; let cur = "", q = false, any = false;
    for (const ch of s) {
      if (ch === '"') { q = !q; any = true; continue; }
      if (!q && /\s/.test(ch)) { if (any || cur) out.push(cur); cur = ""; any = false; continue; }
      cur += ch; any = true;
    }
    if (any || cur) out.push(cur);
    return out;
  };
  const splitPipe = s => { const r = []; let cur = "", q = false; for (const ch of s) { if (ch === '"' || ch === "'") q = !q; if (ch === "|" && !q) { r.push(cur); cur = ""; } else cur += ch; } r.push(cur); return r.map(x => x.trim()); };
  const PS_NOT = c => [`${c} : The term '${c}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`];
  const resolveWin = (h, p) => { if (!p) return h.cwd; let x = p.replace(/\//g, "\\"); if (!/^[a-z]:/i.test(x)) x = h.cwd.replace(/\\$/, "") + "\\" + x; const parts = []; for (const seg of x.split("\\")) { if (seg === "..") { if (parts.length > 1) parts.pop(); } else if (seg && seg !== ".") parts.push(seg); } return parts.join("\\") + (parts.length === 1 ? "\\" : ""); };
  const resolveLx = (h, p) => { if (!p || p === "~") return h.home || "/"; let x = p.startsWith("/") ? p : (h.cwd.replace(/\/$/, "") + "/" + p); const parts = []; for (const seg of x.split("/")) { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); } return "/" + parts.join("/"); };
  const isDir = (h, p) => { const k = h.os === "linux" ? p.replace(/\/$/, "") : wpath(p); if (k === "/" || /^[a-z]:$/.test(k)) return true; const sep = h.os === "linux" ? "/" : "\\"; return Object.keys(h.files).some(f => f.startsWith(k + sep)); };
  const getFile = (h, p) => h.files[h.os === "linux" ? p : wpath(p)];

  /* findstr: 既定は大文字小文字を区別。スペース区切りの語はいずれか一致（OR）。/C:"..." は文字列そのもの。/I /V /N /B 対応 */
  const findstr = (args, input, h) => {
    let ci = false, inv = false, num = false, beg = false; const lits = []; const rest = [];
    for (const a of args) {
      const u = a.toUpperCase();
      if (u === "/I") ci = true; else if (u === "/V") inv = true; else if (u === "/N") num = true; else if (u === "/B") beg = true;
      else if (u.startsWith("/C:")) lits.push(a.slice(3));
      else if (a.startsWith("/")) return { err: [`FINDSTR: /${a.slice(1)} ignored`] };
      else rest.push(a);
    }
    let pats = lits.slice(); if (!lits.length) { if (!rest.length) return { err: ["FINDSTR: Bad command line"] }; pats = rest.shift().split(/\s+/).filter(Boolean); }
    const test = line => { const L = ci ? line.toLowerCase() : line; const hit = pats.some(p => { const P = ci ? p.toLowerCase() : p; return beg ? L.startsWith(P) : L.includes(P); }); return inv ? !hit : hit; };
    if (rest.length) {
      const out = []; const multi = rest.length > 1;
      for (const f of rest) { const fp = resolveWin(h, f), F = getFile(h, fp); if (!F) { out.push(`FINDSTR: Cannot open ${f}`); continue; } F.lines.forEach((l, i) => { if (test(l)) out.push((multi ? F.name + ":" : "") + (num ? (i + 1) + ":" : "") + l); }); }
      return { out };
    }
    return { out: input.map((l, i) => test(l) ? (num ? (i + 1) + ":" + l : l) : null).filter(x => x !== null) };
  };
  const findCmd = (args, input, h) => {
    let ci = false, inv = false, cnt = false, pat = null; const files = [];
    for (const a of args) { const u = a.toUpperCase(); if (u === "/I") ci = true; else if (u === "/V") inv = true; else if (u === "/C") cnt = true; else if (pat === null) pat = a; else files.push(a); }
    if (pat === null) return { err: ["FIND: Parameter format not correct"] };
    const test = l => { const hit = ci ? l.toLowerCase().includes(pat.toLowerCase()) : l.includes(pat); return inv ? !hit : hit; };
    if (files.length) { const out = []; for (const f of files) { const F = getFile(h, resolveWin(h, f)); if (!F) { out.push(`File not found - ${f.toUpperCase()}`); continue; } const m = F.lines.filter(test); out.push("", `---------- ${resolveWin(h, f).toUpperCase()}${cnt ? ": " + m.length : ""}`); if (!cnt) out.push(...m); } return { out }; }
    const m = input.filter(test); return { out: cnt ? [String(m.length)] : m };
  };

  /* ---------- Windows (PowerShell console) commands ---------- */
  const fqdn = (W, h) => `${h.name.toLowerCase()}.${W.m.domain}`;
  const resolveName = (W, x) => { const s = String(x).toLowerCase(); return W.byIp[x] || Object.values(W.hosts).find(h => h.name.toLowerCase() === s || fqdn(W, h) === s) || (W.m.dns || {})[s] && { ip: W.m.dns[s], name: s, ext: true }; };
  const netstat = (W, h, args) => {
    const f = (args[0] || "").toLowerCase().replace(/^-/, "");
    const all = f.includes("a"), pid = f.includes("o");
    const rows = [...h.ports.map(p => ({ proto: "TCP", local: `0.0.0.0:${p.port}`, foreign: "0.0.0.0:0", state: "LISTENING", pid: p.pid })), ...h.conns.map(c => Object.assign({ local: `${h.ip}:${c.lport}` }, c))];
    const out = ["", "Active Connections", "", "  Proto  Local Address          Foreign Address        State" + (pid ? "           PID" : "")];
    for (const r of rows) { if (!all && r.state === "LISTENING") continue; out.push("  " + pad(r.proto, 7) + pad(r.local, 23) + pad(r.foreign, 23) + (pid ? pad(r.state, 16) + r.pid : r.state)); }
    return out;
  };
  const tasklist = (W, h) => ["", "Image Name                     PID Session Name        Session#    Mem Usage", "========================= ======== ================ =========== ============",
    ...[{ name: "System Idle Process", pid: 0, sess: "Services", sn: 0, mem: "8 K" }, { name: "System", pid: 4, sess: "Services", sn: 0, mem: "144 K" }, { name: "svchost.exe", pid: 812, sess: "Services", sn: 0, mem: "24,512 K" }, { name: "lsass.exe", pid: 640, sess: "Services", sn: 0, mem: "18,220 K" }, ...h.procs]
      .map(p => pad(p.name, 25) + " " + lpad(p.pid, 8) + " " + pad(p.sess || "Services", 16) + " " + lpad(p.sn || 0, 11) + " " + lpad(p.mem || "9,876 K", 12))];
  const pingOut = (W, h, args) => {
    let n = 4, tgt = null; for (let i = 0; i < args.length; i++) { if (/^[-/]n$/i.test(args[i])) n = Math.min(10, +args[++i] || 4); else tgt = args[i]; }
    if (!tgt) return ["", "Usage: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]", "            [-r count] [-s count] [[-j host-list] | [-k host-list]]", "            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]", "            [-4] [-6] target_name"];
    const t = resolveName(W, tgt);
    if (!t) return [`Ping request could not find host ${tgt}. Please check the name and try again.`];
    const ok = t.ext ? !h.iso : (t === h || W.reach(h.name, t.name, 0) && !t.noPing), ip = t.ip;
    const head = /^\d+\.\d+\.\d+\.\d+$/.test(tgt) ? `Pinging ${ip} with 32 bytes of data:` : `Pinging ${t.ext ? tgt : fqdn(W, t)} [${ip}] with 32 bytes of data:`;
    const lines = ["", head]; for (let i = 0; i < n; i++) lines.push(ok ? `Reply from ${ip}: bytes=32 time${t.ext ? "=" + (12 + i) + "ms" : "<1ms"} TTL=${t.ext ? 54 : (t.os === "linux" ? 64 : 128)}` : "Request timed out.");
    lines.push("", `Ping statistics for ${ip}:`, `    Packets: Sent = ${n}, Received = ${ok ? n : 0}, Lost = ${ok ? 0 : n} (${ok ? 0 : 100}% loss),`);
    if (ok) lines.push("Approximate round trip times in milli-seconds:", t.ext ? "    Minimum = 12ms, Maximum = 15ms, Average = 13ms" : "    Minimum = 0ms, Maximum = 0ms, Average = 0ms");
    return lines;
  };
  const nslookup = (W, h, args) => {
    const dc = Object.values(W.hosts).find(x => x.role === "dc") || h;
    const head = ["Server:  " + fqdn(W, dc), "Address:  " + dc.ip, ""];
    if (!args[0]) return ["[SIM] 対話モードは未対応です。nslookup <名前 または IP> の形で入力してください。"];
    const q = args[0], t = resolveName(W, q);
    if (!t) return [...head, `*** ${fqdn(W, dc)} can't find ${q}: Non-existent domain`];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(q)) return t.ext ? [...head, `*** ${fqdn(W, dc)} can't find ${q}: Non-existent domain`] : [...head, "Name:    " + fqdn(W, t), "Address:  " + t.ip];
    return [...head, "Name:    " + (t.ext ? t.name : fqdn(W, t)), "Address:  " + t.ip];
  };
  const netUser = (W, h, args) => {
    const dom = args.some(a => a.toLowerCase() === "/domain");
    const act = args.find(a => /^\/active:(yes|no)$/i.test(a));
    const bad = args.find(a => a.startsWith("/") && a.toLowerCase() !== "/domain" && !/^\/active:(yes|no)$/i.test(a));
    if (bad) return ["The syntax of this command is:", "", "NET USER", "[username [password | *] [options]] [/DOMAIN]", "         username {password | *} /ADD [options] [/DOMAIN]", "         username [/DELETE] [/DOMAIN]", "         username [/TIMES:{times | ALL}]", "         username [/ACTIVE: {YES | NO}]"];
    const name = args.find(a => !a.startsWith("/"));
    const pre = dom ? [`The request will be processed at a domain controller for domain ${W.m.domain}.`, ""] : [];
    const key = name && (dom ? name.toLowerCase() : h.name.toUpperCase() + "\\" + name.toLowerCase());
    if (!name) {
      const names = Object.entries(W.acct).filter(([k]) => dom ? !k.includes("\\") : k.startsWith(h.name.toUpperCase() + "\\")).map(([, a]) => a.name);
      if (!dom) names.unshift("Guest"); if (!dom && !names.includes("Administrator")) names.unshift("Administrator");
      const rows = []; for (let i = 0; i < names.length; i += 3) rows.push(names.slice(i, i + 3).map(x => pad(x, 25)).join("").trimEnd());
      return [...pre, "", `User accounts for \\\\${dom ? Object.values(W.hosts).find(x => x.role === "dc").name : h.name}`, "", "-------------------------------------------------------------------------------", ...rows, "The command completed successfully.", ""];
    }
    const a = W.acct[key];
    if (!a) return [...pre, "The user name could not be found.", "", "More help is available by typing NET HELPMSG 2221.", "", ...(dom ? [] : ["[SIM] ドメインのアカウントは /domain を付けて問い合わせます。"])];
    if (act) { a.active = /yes$/i.test(act); W.flags.add(`acct:${key}:${a.active ? "on" : "off"}`); if (W.m.onAcct) W.m.onAcct(W, key, a.active); return [...pre, "The command completed successfully.", ""]; }
    return [...pre, pad("User name", 29) + a.name, pad("Full Name", 29) + (a.full || ""), pad("Comment", 29) + (a.comment || ""), pad("Account active", 29) + (a.active ? "Yes" : "No"), pad("Account expires", 29) + "Never", "",
      pad("Password last set", 29) + (a.pwset || "2024/04/01 9:00:00"), "", pad("Workstations allowed", 29) + "All", pad("Last logon", 29) + (a.last || "Never"), "",
      pad("Local Group Memberships", 29) + (a.local || ""), pad("Global Group memberships", 29) + (a.groups || "*Domain Users"), "The command completed successfully.", ""];
  };
  const netsh = (W, h, args) => {
    const low = args.map(a => a.toLowerCase());
    if (low.slice(0, 4).join(" ") !== "advfirewall firewall add rule") {
      if (low.slice(0, 4).join(" ") === "advfirewall firewall show rule") return ["", ...h.fw.flatMap(r => [pad("Rule Name:", 38) + r.name, "----------------------------------------------------------------------", pad("Enabled:", 38) + "Yes", pad("Direction:", 38) + (r.dir === "in" ? "In" : "Out"), pad("RemoteIP:", 38) + (r.remoteip || "Any"), pad("Protocol:", 38) + (r.protocol || "Any"), pad("LocalPort:", 38) + (r.localport || "Any"), pad("Action:", 38) + (r.action === "block" ? "Block" : "Allow"), ""]), h.fw.length ? "Ok." : "No rules match the specified criteria."];
      return ["[SIM] この演習で使える netsh は次の形です：", 'netsh advfirewall firewall add rule name="名前" dir=in action=block remoteip=<IP>', 'netsh advfirewall firewall add rule name="名前" dir=in action=block protocol=TCP localport=445', "netsh advfirewall firewall show rule name=all"];
    }
    const kv = {}; for (const a of args.slice(4)) { const i = a.indexOf("="); if (i > 0) kv[a.slice(0, i).toLowerCase()] = a.slice(i + 1); }
    if (!kv.name || !kv.dir || !kv.action) return ["[SIM] name= / dir= / action= の3つは必須です（例: name=\"Block X\" dir=in action=block）。"];
    if (!/^(in|out)$/i.test(kv.dir) || !/^(allow|block|bypass)$/i.test(kv.action)) return ["[SIM] dir は in か out、action は allow / block / bypass のいずれかです。"];
    if ((kv.localport || kv.remoteport) && !kv.protocol) return ["[SIM] ポートを指定するときは protocol=TCP（または UDP）も指定します。"];
    const r = { name: kv.name, dir: kv.dir.toLowerCase(), action: kv.action.toLowerCase(), remoteip: kv.remoteip && kv.remoteip.toLowerCase() !== "any" ? kv.remoteip : null, protocol: kv.protocol ? kv.protocol.toUpperCase() : null, localport: kv.localport || null };
    h.fw.push(r); W.flags.add(`fw:${h.name}:${r.dir}:${r.remoteip || "any"}:${r.localport || "any"}`);
    return ["Ok.", ""];
  };
  const dirList = (W, h, p) => {
    const d = resolveWin(h, p); if (!isDir(h, d)) return [`Get-ChildItem : Cannot find path '${d}' because it does not exist.`];
    const k = wpath(d), kids = new Map();
    for (const [f, F] of Object.entries(h.files)) { if (!f.startsWith(k + "\\")) continue; const rest = F.name.replace(/\//g, "\\").split("\\").slice(k.split("\\").length); kids.set(rest[0], rest.length > 1 ? null : F); }
    const date = W.m.date.replace(/-/g, "/");
    return ["", `    Directory: ${d}`, "", "Mode                 LastWriteTime         Length Name", "----                 -------------         ------ ----",
      ...[...kids].sort().map(([n, F]) => F ? `-a----        ${date}     ${W.clock().slice(0, 5)}   ${lpad(F.lines.join("\r\n").length, 12)} ${n}` : `d-----        ${date}     ${W.m.clockDir || "01:00"}                ${n}`), ""];
  };
  const typeFile = (W, h, p) => { if (!p) return ["[SIM] type <ファイル名> の形で入力してください。"]; const d = resolveWin(h, p), F = getFile(h, d); if (!F) return [`Get-Content : Cannot find path '${d}' because it does not exist.`]; return F.lines.slice(); };

  const WIN = {
    hostname: (W, h) => [h.name],
    whoami: (W, h) => [`${W.m.domain.split(".")[0]}\\${W.m.me || "soc"}`],
    ipconfig: (W, h) => ["", "Windows IP Configuration", "", "", "Ethernet adapter Ethernet0:", "", `   Connection-specific DNS Suffix  . : ${W.m.domain}`, `   IPv4 Address. . . . . . . . . . . : ${h.ip}`, `   Subnet Mask . . . . . . . . . . . : 255.255.255.0`, `   Default Gateway . . . . . . . . . : ${h.ip.replace(/\.\d+$/, ".1")}`, ""],
    ping: pingOut, nslookup, netstat: (W, h, a) => netstat(W, h, a), tasklist,
    taskkill: (W, h, args) => {
      const i = args.findIndex(a => /^\/pid$/i.test(a)); const pid = i >= 0 ? +args[i + 1] : NaN;
      if (i < 0) return ["ERROR: Invalid syntax. Neither /FI nor /PID nor /IM were specified.", 'Type "TASKKILL /?" for usage.'];
      const p = h.procs.find(x => x.pid === pid);
      if (!p) return [`ERROR: The process "${args[i + 1]}" not found.`];
      if (!args.some(a => /^\/f$/i.test(a)) && p.hard) return [`ERROR: The process with PID ${pid} could not be terminated.`, "Reason: This process can only be terminated forcefully (with /F option)."];
      h.procs = h.procs.filter(x => x !== p); h.conns = h.conns.filter(c => c.pid !== pid); h.ports = h.ports.filter(c => c.pid !== pid);
      W.flags.add(`kill:${h.name}:${p.name.toLowerCase()}`);
      return [`SUCCESS: The process with PID ${pid} has been terminated.`];
    },
    net: (W, h, args) => (args[0] || "").toLowerCase() === "user" ? netUser(W, h, args.slice(1)) : ["[SIM] この演習で使える net コマンドは net user です（例: net user <名前> /domain）。"],
    quser: (W, h) => { const s = h.sessions || []; return s.length ? [" USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME", ...s.map(x => " " + pad(x.user, 22) + pad(x.sess, 19) + lpad(x.id, 2) + "  " + pad("Active", 8) + lpad(".", 9) + "  " + x.at)] : ["No User exists for *"]; },
    query: (W, h, a) => (a[0] || "").toLowerCase() === "user" ? WIN.quser(W, h) : ["[SIM] この演習で使えるのは query user です。"],
    arp: (W, h, a) => { if (!/^-a$/i.test(a[0] || "")) return ["[SIM] arp -a の形で入力してください。"]; const peers = Object.values(W.hosts).filter(x => x !== h && x.ip.split(".").slice(0, 3).join(".") === h.ip.split(".").slice(0, 3).join(".") && !x.iso); return ["", `Interface: ${h.ip} --- 0xb`, "  Internet Address      Physical Address      Type", "  " + pad(h.ip.replace(/\.\d+$/, ".1"), 22) + pad("00-50-56-c0-00-01", 22) + "dynamic", ...peers.map((x, i) => "  " + pad(x.ip, 22) + pad("00-50-56-a1-" + two(10 + i) + "-" + two(30 + i), 22) + "dynamic"), ""]; },
    type: (W, h, a) => typeFile(W, h, a[0]), cat: (W, h, a) => typeFile(W, h, a[0]), "get-content": (W, h, a) => typeFile(W, h, a.filter(x => !/^-path$/i.test(x))[0]), gc: (W, h, a) => typeFile(W, h, a[0]),
    dir: (W, h, a) => dirList(W, h, a[0]), ls: (W, h, a) => dirList(W, h, a[0]), "get-childitem": (W, h, a) => dirList(W, h, a.filter(x => !/^-path$/i.test(x))[0]), gci: (W, h, a) => dirList(W, h, a[0]),
    cd: (W, h, a) => { if (!a[0]) return [h.cwd]; const d = resolveWin(h, a[0]); if (!isDir(h, d)) return [`Set-Location : Cannot find path '${d}' because it does not exist.`]; h.cwd = d; return []; },
    pwd: (W, h) => ["", "Path", "----", h.cwd, ""],
    systeminfo: (W, h) => ["", pad("Host Name:", 27) + h.name, pad("OS Name:", 27) + (h.osName || "Microsoft Windows Server 2019 Standard"), pad("OS Version:", 27) + (h.osVer || "10.0.17763 N/A Build 17763"), pad("System Type:", 27) + "x64-based PC", pad("Domain:", 27) + W.m.domain, pad("Logon Server:", 27) + "\\\\" + (Object.values(W.hosts).find(x => x.role === "dc") || h).name],
    findstr: (W, h, a) => { const r = findstr(a, [], h); return r.err || r.out; },
    find: (W, h, a) => { const r = findCmd(a, [], h); return r.err || r.out; },
    "get-smbserverconfiguration": (W, h) => ["", "AnnounceComment                 :", "EnableSMB1Protocol              : " + (h.smb1 ? "True" : "False"), "EnableSMB2Protocol              : True", "EncryptData                     : False", "RequireSecuritySignature        : False", ""],
    "set-smbserverconfiguration": (W, h, a) => {
      const i = a.findIndex(x => /^-enablesmb1protocol$/i.test(x)); if (i < 0) return ["[SIM] この演習では -EnableSMB1Protocol $false を扱います。"];
      const v = (a[i + 1] || "").toLowerCase(); if (v !== "$false" && v !== "$true") return ["Set-SmbServerConfiguration : Cannot process argument transformation on parameter 'EnableSMB1Protocol'. Cannot convert value \"" + (a[i + 1] || "") + "\" to type \"System.Boolean\"."];
      if (!a.some(x => /^-force$/i.test(x))) return ["", "Confirm", "Are you sure you want to perform this action?", "Performing operation 'Modify' on Target 'SMB Server Configuration'.", "[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is \"Y\"):", "[SIM] 確認の入力は省略します。-Force を付けると確認なしで実行されます。"];
      h.smb1 = v === "$true"; W.flags.add(`smb1:${h.name}:${h.smb1 ? "on" : "off"}`); return [];
    },
    netsh,
    "enter-pssession": (W, h, a) => {
      const i = a.findIndex(x => /^-computername$|^-cn$/i.test(x)); const name = i >= 0 ? a[i + 1] : a[0];
      if (!name) return ["[SIM] Enter-PSSession -ComputerName <ホスト名> の形で入力してください。"];
      if (W.stack.length) return ["Enter-PSSession : You are currently in a Windows PowerShell PSSession and cannot use the Enter-PSSession cmdlet to enter another PSSession."];
      const t = W.H(name);
      if (!t || t.os !== "win" || t.noWinRM) return [`Enter-PSSession : Connecting to remote server ${name} failed with the following error message : WinRM cannot complete the operation. Verify that the specified computer name is valid, that the computer is accessible over the network, and that a firewall exception for the WinRM service is enabled and allows access from this computer.`];
      if (t === h) return ["[SIM] いまの端末そのものです。"];
      W.stack.push(t.name); return t.iso ? ["[SIM] 隔離中の端末です。EDR のリモート応答経由でつなぎます（ネットワークは遮断されたまま）。"] : [];
    },
    "exit-pssession": W => { if (W.stack.length) W.stack.pop(); return []; },
    exit: W => { if (W.stack.length) { W.stack.pop(); return []; } return ["[SIM] これ以上戻れません。ミッションをやめるときは右の「やめる」を押します。"]; }
  };
  const WIN_PIPE = {
    findstr: (a, inp, h) => findstr(a, inp, h), find: (a, inp, h) => findCmd(a, inp, h), more: (a, inp) => ({ out: inp }),
    "select-string": (a, inp) => { const p = a.filter(x => !/^-pattern$/i.test(x))[0]; if (!p) return { err: ["[SIM] Select-String -Pattern <文字列>"] }; return { out: inp.filter(l => l.toLowerCase().includes(p.toLowerCase())) }; },
    sls: (a, inp) => WIN_PIPE["select-string"](a, inp),
    "select-object": (a, inp) => { const p = (a.filter(x => !/^-property$/i.test(x))[0] || "").toLowerCase(); const row = inp.find(l => l.toLowerCase().startsWith(p)); if (!row) return { out: inp }; const v = row.split(":").slice(1).join(":").trim(); const name = row.split(":")[0].trim(); return { out: ["", name, "-".repeat(name.length), lpad(v, name.length), ""] }; },
    select: (a, inp) => WIN_PIPE["select-object"](a, inp)
  };

  /* ---------- 共通（ゲーム側）コマンド ---------- */
  const GAME_HELP = {
    mission: "ミッションとクリア条件をもう一度表示", status: "残り時間と達成状況を表示", hint: "ヒント（本番では使うと相手が先に進む）", clear: "画面を消す（cls も可）", help: "コマンドの一覧"
  };

  ST.OPS_WIN = WIN;

  ST.widget("ops", {
    title: "攻防端末 · リアルタイム",
    mount(el) {
      const TUT = ST.OPS_TUT || [];
      TUT.forEach(t => { if (!t.goals) t.goals = t.steps.map((st, i) => ({ text: st.task, ok: W => W.tut && W.step > i })); });
      const D = { missions: [...TUT, ...ST.OPS.missions] };
      /* 本番は基礎訓練が必須：調査は 1〜3、防御は 1〜4 を終えると開く */
      const reqs = m => m.mode === "def" ? TUT.map(t => t.id) : m.mode === "inv" ? TUT.slice(0, 3).map(t => t.id) : [];
      const done = id => !!(ST.P && ST.P.labs && ST.P.labs[id]);
      const missing = m => reqs(m).filter(id => !done(id));
      const tutName = id => { const t = TUT.find(x => x.id === id); return t ? `${t.tag}「${t.title}」` : id; };
      let W = null, timer = null, alive = true, screen = "menu", sel = null, hist = [], hi = 0;
      const stop = () => { if (timer) clearInterval(timer); timer = null; };
      const gone = () => { if (!el.isConnected) { alive = false; stop(); document.removeEventListener("keydown", onKey); return true; } return false; };
      const fmt = s => `${two(Math.floor(Math.max(0, s) / 60))}:${two(Math.max(0, s) % 60)}`;
      const goalsHtml = m => `<ul class="ops-chk">${m.goals.map(g => `<li class="${W && g.ok(W) ? "ok" : ""}">${W && g.ok(W) ? "☑" : "☐"} ${esc(g.text)}</li>`).join("")}</ul>`;
      const refOf = m => m.ref ? (ST.INCIDENTS || {})[m.ref] : null;

      const srcBlock = m => {
        const r = refOf(m);
        const fic = `<p class="cap"><b>脚色（フィクション）：</b>${esc(m.fiction)}</p>`;
        if (!r) return `<details class="bt-src"><summary>この物語について</summary>${fic}${m.basis ? `<p class="cap">${esc(m.basis)}</p>` : ""}</details>`;
        return `<details class="bt-src"><summary>下敷きにした実際の事案と出典（確認日 ${esc(ST.INCIDENT_CHECKED || "")}）</summary>
          <p><b>${esc(r.title)}</b></p><p class="cap"><b>出典に書かれている事実：</b></p><ul>${r.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
          ${fic}<p class="cap"><b>未確認・抽象化：</b></p><ul>${r.unk.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
          <p class="cap"><b>出典：</b></p><ul>${r.sources.map(s => `<li>${esc(s.t)} <span class="cap">［${esc(s.k)}］</span><br><a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${esc(s.u)}</a></li>`).join("")}</ul>
          <p class="cap">登場する組織・人物・IPアドレス・ホスト名・時刻はすべて架空です。実在の組織を評価・非難するものではありません。</p></details>`;
      };

      const menu = () => {
        const key = m => { const i = D.missions.indexOf(m) + 1; return i <= 9 ? `[${i}]` : ""; };
        const sec = (mode, title, lead) => { const ms = D.missions.filter(m => m.mode === mode); return `<div class="ops-sec${mode === "tut" ? " tut" : ""}"><h3>${title}</h3><p class="cap">${lead}</p>${ms.map(m => { const lk = missing(m); return `<button type="button" class="rl-hand${lk.length ? " locked" : ""}" data-m="${m.id}"><span class="bt-key">${key(m)}</span> ${lk.length ? "🔒 " : ""}<b>${esc(m.mode === "tut" ? m.title : m.goal)}</b> <span class="chip">${esc(m.tag)}</span>${m.mode === "tut" && done(m.id) ? ' <span class="chip ok">済</span>' : ""}<br><span class="cap">${m.mode === "tut" ? esc(m.goal) + " · 時間制限なし · " + m.steps.length + "手順" : esc(m.title) + " · 制限 " + fmt(m.limit)}${lk.length ? " · 🔒 基礎訓練 " + lk.map(id => TUT.findIndex(t => t.id === id) + 1).join("・") + " を終えると開く" : ""}</span></button>`; }).join("")}</div>`; };
        el.innerHTML = `<div class="ops-menu"><div class="rl-card"><h2>攻防端末 <span class="cap">// 相手は待ってくれない</span></h2>
          <p>架空の組織の端末に入り、コマンドを打って状況を読み解きます。時計は止まりません。あなたが操作するのは防御・調査の側だけ。コマンドは<b>本物の構文</b>のままで、攻撃側の動きは裏で進む筋書きです。製品固有の操作（EDR の隔離など）と報告だけ <code>[GAME]</code> コマンドにしています。<b>実在の機器には何もしません。</b></p>
          <p class="cap">キーボード前提（PC・iPad＋キーボード）。番号キーでミッションを選べます。ターン制の対戦は「ターン制対戦」タブに残しています。</p></div>
          ${sec("tut", "基礎訓練（必須）", "本番の前に、ここで手を動かして覚えます。1手順ずつ説明があり、時間制限はありません。調査は訓練1〜3、防御は訓練1〜4を終えると開きます。")}
          <div class="ops-secs">${sec("def", "防御：未来を変えろ", "実際の事案を下敷きにした夜。記録どおりの結末を、あなたの手で変える。")}
          ${sec("inv", "調査：いま攻撃を受けているか", "警報やログは鳴っているが、本当に攻撃か？ 気づかない侵害もあれば、正常な業務もある。")}</div></div>`;
        ST.$$("[data-m]", el).forEach(b => b.onclick = () => brief(D.missions.find(m => m.id === b.dataset.m)));
      };

      const lessonLinks = m => m.lessons && m.lessons.length ? `<h3>関連する授業</h3><ul class="ops-lessons">${m.lessons.map(([id, t]) => `<li><a href="#l-${esc(id)}">${esc(t)}</a>${ST.P && ST.P.lessons && ST.P.lessons[id] ? ' <span class="cap">· 読了</span>' : ""}</li>`).join("")}</ul>` : "";
      const brief = m => {
        screen = "brief"; sel = m; W = null;
        const lk = missing(m);
        if (lk.length) {
          el.innerHTML = `<div class="rl-card ops-brief"><div class="rl-cap">${esc(m.tag)} · ${esc(m.title)}</div><div class="rl-big">🔒 ${esc(m.goal)}</div>
            <p>このミッションは、基礎訓練を終えると開きます。本番は時計が止まらず、説明もありません。先に訓練で手を動かしておきましょう。</p>
            <div class="ops-req">${lk.map(id => `<button type="button" class="rl-hand" data-t="${esc(id)}"><b>${esc(tutName(id))}</b><br><span class="cap">${esc((TUT.find(t => t.id === id) || {}).goal || "")}</span></button>`).join("")}</div>
            <div class="btns two"><button class="btn primary" type="button" data-t="${esc(lk[0])}">[Enter] ${esc(tutName(lk[0]))} へ</button><button class="btn" type="button" data-back>[B] 一覧へ戻る</button></div></div>`;
          ST.$$("[data-t]", el).forEach(b => b.onclick = () => brief(TUT.find(t => t.id === b.dataset.t)));
          el.querySelector("[data-back]").onclick = () => { screen = "menu"; menu(); };
          sel = TUT.find(t => t.id === lk[0]); screen = "locked";
          return;
        }
        if (m.mode === "tut") {
          el.innerHTML = `<div class="rl-card ops-brief"><div class="rl-cap">${esc(m.tag)}${done(m.id) ? " · 済" : ""}</div><div class="rl-big">${esc(m.title)}</div>
            <p class="ops-story">${esc(m.story)}</p><h3>この訓練でやること</h3><ol class="ops-steps">${m.steps.map(st => `<li>${esc(st.task)}</li>`).join("")}</ol>
            <p class="cap">時間制限なし。相手も動きません。1手順ずつ画面に説明が出ます。分からなければ <code>hint</code>（無料）で打つべきコマンドが出ます。</p>
            ${lessonLinks(m)}
            <div class="btns two"><button class="btn primary big" type="button" data-go>[Enter] 訓練を始める</button><button class="btn" type="button" data-back>[B] 一覧へ戻る</button></div></div>`;
          el.querySelector("[data-go]").onclick = () => start(m);
          el.querySelector("[data-back]").onclick = () => { screen = "menu"; menu(); };
          return;
        }
        el.innerHTML = `<div class="rl-card ops-brief"><div class="rl-cap">${esc(m.tag)} · ${esc(m.title)}</div><div class="rl-big">${esc(m.goal)}</div>
          <p class="ops-story">${esc(m.story)}</p><h3>クリア条件</h3>${goalsHtml(m)}
          ${m.loseText ? `<p class="cap"><b>失敗：</b>${esc(m.loseText)}</p>` : ""}<p class="cap">制限時間 ${fmt(m.limit)}。開始すると時計が進み、相手も動き出します。迷ったら <code>help</code>、手詰まりなら <code>hint</code>（ただし相手が先に進む）。</p>
          <div class="btns three"><button class="btn primary big" type="button" data-go>[Enter] 本番</button><button class="btn big" type="button" data-pr>[P] 練習</button><button class="btn" type="button" data-back>[B] 一覧へ戻る</button></div>
          <p class="cap"><b>練習</b>：時計の進みが半分になり、hint を使っても時間が進みません。慣れたら本番へ。</p>${srcBlock(m)}</div>`;
        el.querySelector("[data-go]").onclick = () => start(m);
        el.querySelector("[data-pr]").onclick = () => start(m, true);
        el.querySelector("[data-back]").onclick = () => { screen = "menu"; menu(); };
      };

      const prompt = () => { const h = W.cur(); return (W.stack.length ? `[${h.name}]: ` : "") + `PS ${h.cwd}> `; };
      const outEl = () => el.querySelector(".ops-out");
      const print = (text, cls = "") => { const o = outEl(); if (!o) return; const d = document.createElement("div"); d.className = "ops-l " + cls; d.textContent = text; o.appendChild(d); while (o.childNodes.length > 800) o.removeChild(o.firstChild); o.scrollTop = o.scrollHeight; };
      const flush = () => { while (W.out.length) { const x = W.out.shift(); print(x.text, x.cls); } };

      const side = () => {
        const m = W.m, s = el.querySelector(".ops-side"); if (!s) return;
        const left = m.limit - W.t, tut = m.mode === "tut";
        const hosts = Object.values(W.hosts).filter(h => !h.hideMap);
        s.innerHTML = `<div class="ops-timer${!tut && left <= 60 ? " hot" : ""}"><span>${tut ? "経過" : "残り"}</span><b>${fmt(tut ? W.t : left)}</b>${W.practice ? '<span class="chip">練習</span>' : ""}<span class="cap">${esc(m.date)} ${W.clock()}</span></div>
          <div class="ops-goal"><div class="rl-cap">${tut ? "TRAINING · " + esc(m.tag) : "MISSION"}</div><div class="ops-g">${esc(tut ? m.title : m.goal)}</div>${goalsHtml(m)}</div>
          <div class="ops-hosts"><div class="rl-cap">ネットワーク</div><table>${hosts.map(h => `<tr class="${W.cur() === h ? "cur" : ""}"><td>${esc(h.name)}</td><td>${esc(h.ip)}</td><td>${esc(h.label || "")}</td><td>${h.iso ? '<span class="tag iso">隔離</span>' : ""}</td></tr>`).join("")}</table></div>
          <button type="button" class="btn" data-quit>やめる</button>`;
        s.querySelector("[data-quit]").onclick = () => { stop(); screen = "menu"; menu(); };
      };

      const finish = () => {
        stop(); flush(); screen = "end";
        const m = W.m, o = W.over;
        const r = refOf(m);
        if (m.mode === "tut") {
          const i = TUT.indexOf(m), next = TUT[i + 1];
          const opened = D.missions.filter(x => x.mode !== "tut" && reqs(x).includes(m.id) && !missing(x).length);
          el.innerHTML = `<div class="rl-card ops-end"><div class="rl-cap">${esc(m.tag)} · CLEAR · 経過 ${fmt(W.t)}</div><div class="rl-big">訓練完了</div>
            <p>${esc(m.explain)}</p>${opened.length ? `<p class="ops-g">🔓 開いたミッション：${opened.map(x => esc(x.goal)).join("、")}</p>` : ""}
            ${lessonLinks(m)}
            <div class="btns two">${next ? `<button class="btn primary" type="button" data-next>[Enter] 次の訓練：${esc(next.title)}</button>` : `<button class="btn primary" type="button" data-back2>[Enter] 本番のミッションへ</button>`}<button class="btn" type="button" data-back>[B] 一覧へ戻る</button></div></div>`;
          sel = next || null; screen = "tutend";
          const nx = el.querySelector("[data-next]"); if (nx) nx.onclick = () => brief(next);
          const b2 = el.querySelector("[data-back2]"); if (b2) b2.onclick = () => { screen = "menu"; menu(); };
          el.querySelector("[data-back]").onclick = () => { screen = "menu"; menu(); };
          return;
        }
        el.innerHTML = `<div class="rl-card ops-end"><div class="rl-cap">${esc(m.goal)} · ${o.win ? "CLEAR" : "FAILED"} · 経過 ${fmt(W.t)}</div>
          <div class="rl-big">${o.win ? (m.mode === "def" ? "未来は変わった" : "正解") : (m.mode === "def" ? "記録どおりの結末" : "見誤った")}</div>
          <p>${esc(o.msg)}</p>
          <h3>解説</h3><p>${esc(m.explain)}</p>
          ${r && m.reality ? `<h3>現実では</h3><p>${esc(m.reality)}</p>` : ""}
          <p class="cap">⛔ 隔離・アカウント停止・通信遮断は、自分が管理を任された環境でだけ行う操作です。他人の機器に手を出せば犯罪になりえます（<a href="#course-law">法律と倫理コース</a>）。</p>
          <div class="btns two"><button class="btn primary" type="button" data-again>[Enter] もう一度</button><button class="btn" type="button" data-back>[B] 一覧へ戻る</button></div>${srcBlock(m)}</div>`;
        el.querySelector("[data-again]").onclick = () => start(m, W.practice);
        el.querySelector("[data-back]").onclick = () => { screen = "menu"; menu(); };
      };

      const check = () => {
        if (!W.over && W.m.mode === "def" && W.m.goals.every(g => g.ok(W))) W.over = { win: true, msg: W.m.winText };
        if (!W.over && W.m.limit > 0 && W.t >= W.m.limit) W.over = { win: false, msg: W.m.timeoutText || "時間切れ。" };
        if (W.over) { setTimeout(() => { if (alive && W && W.over && screen === "game") finish(); }, 900); }
      };

      const tick = () => {
        if (gone() || !W || W.over) return;
        W.real = (W.real || 0) + 1;
        if (W.practice && W.real % 2) return;
        W.t++;
        const due = W.q.filter(x => x.at <= W.t); W.q = W.q.filter(x => x.at > W.t);
        for (const x of due) { try { x.fn(W); } catch (e) { console.error(e); } }
        if (W.m.tick) W.m.tick(W);
        flush(); side(); check();
      };

      const lessonOut = () => { const st = W.m.steps[W.step]; if (!st) return; print(""); print(`── 手順 ${W.step + 1} / ${W.m.steps.length} ──`, "mis"); st.lesson.forEach(l => print(l, "lesson")); print("▶ やること：" + st.task, "task"); };
      const start = (m, practice) => {
        stop(); W = mkWorld(m); W.practice = !!practice && m.mode !== "tut"; W.tut = m.mode === "tut"; W.step = 0; sel = m; screen = "game"; hist = []; hi = 0;
        el.innerHTML = `<div class="ops"><div class="ops-term" title="クリックで入力"><div class="ops-out" role="log" aria-live="polite"></div>
          <form class="ops-in" autocomplete="off"><span class="ops-ps"></span><input type="text" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-label="コマンド入力"></form></div><aside class="ops-side"></aside></div>`;
        const inp = el.querySelector(".ops-in input");
        el.querySelector(".ops-term").onclick = e => { if (!e.target.closest("a")) inp.focus(); };
        try { el.scrollIntoView({ block: "start" }); } catch (e) {}
        el.querySelector(".ops-in").onsubmit = e => { e.preventDefault(); run(inp.value); inp.value = ""; };
        inp.onkeydown = e => {
          if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) hi--; inp.value = hist[hi] || ""; }
          else if (e.key === "ArrowDown") { e.preventDefault(); if (hi < hist.length) hi++; inp.value = hist[hi] || ""; }
          else if (e.key === "Tab") { e.preventDefault(); const v = inp.value; if (!/\s/.test(v)) { const names = cmdNames().filter(n => n.startsWith(v.toLowerCase())); if (names.length === 1) inp.value = names[0] + " "; else if (names.length) print(names.join("  "), "dim"); } }
        };
        (m.banner || []).forEach(l => print(l, "dim"));
        if (W.tut) { print(`[TRAINING] ${m.tag}「${m.title}」：${m.goal}`, "mis"); lessonOut(); }
        else { print(`[MISSION] ${m.goal}`, "mis"); m.goals.forEach(g => print("  ☐ " + g.text, "mis")); print(W.practice ? "練習モード：時計の進みは半分、hint に時間のペナルティなし。" : "help でコマンド一覧。時計はもう動いています。", "sim"); }
        el.querySelector(".ops-ps").textContent = prompt(); side(); flush(); inp.focus();
        timer = setInterval(tick, 1000);
      };

      const cmdNames = () => { return [...Object.keys(WIN), ...Object.keys(GAME_HELP), "cls", ...Object.keys(W.m.cmds || {})].map(s => s.toLowerCase()).sort(); };

      const helpLines = () => {
        const real = ["ipconfig / hostname / whoami", "ping <名前|IP> [-n 回数]   /   nslookup <名前|IP>", "netstat -ano  [| findstr <文字列>]   ※findstr は大文字小文字を区別。/I で区別しない", "tasklist   /   taskkill /PID <番号> /F", "net user [<名前>] [/domain]   /   net user <名前> /active:no /domain", "quser（query user）   /   arp -a   /   systeminfo", "dir / cd / type <ファイル>   /   findstr [/I] [/C:\"語句\"] <語> <ファイル>", "Enter-PSSession -ComputerName <ホスト>   /   exit", "Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol", "Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force", "netsh advfirewall firewall add rule name=\"名前\" dir=in action=block remoteip=<IP>", "netsh advfirewall firewall add rule name=\"名前\" dir=in action=block protocol=TCP localport=<番号>"];
        return ["── 実在のコマンド（本物の構文） ──", ...real.map(x => "  " + x), "── [GAME] この演習専用（現実の製品操作や犯罪部分を抽象化） ──", ...Object.entries(W.m.cmds || {}).filter(([, c]) => !c.hidden).map(([k, c]) => "  " + pad(c.usage || k, 34) + c.d), ...Object.entries(GAME_HELP).map(([k, d]) => "  " + pad(k, 34) + d)];
      };

      const run = raw => {
        if (!W || W.over) return;
        const line = raw.trim();
        print(prompt() + raw, "cmd");
        if (line) { hist.push(line); if (hist.length > 100) hist.shift(); }
        hi = hist.length;
        if (!line) return;
        const h = W.cur();
        const segs = splitPipe(line);
        const toks = tokenize(segs[0]); const c = (toks[0] || "").toLowerCase(), args = toks.slice(1);
        let out;
        if (c === "help" || c === "?" || c === "get-help") out = helpLines();
        else if (c === "clear" || c === "cls" || c === "clear-host") { const o = outEl(); if (o) o.innerHTML = ""; out = []; }
        else if (c === "mission" && W.tut) { out = []; lessonOut(); }
        else if (c === "mission") out = [`[MISSION] ${W.m.goal}`, ...W.m.goals.map(g => (g.ok(W) ? "  ☑ " : "  ☐ ") + g.text)];
        else if (c === "status") out = [W.tut ? `経過 ${fmt(W.t)}` : `残り ${fmt(W.m.limit - W.t)}`, ...W.m.goals.map(g => (g.ok(W) ? "  ☑ " : "  ☐ ") + g.text)];
        else if (c === "hint" && W.tut) { const st = W.m.steps[W.step]; out = st ? [`[HINT] ${st.hint}`] : []; }
        else if (c === "hint") {
          const hs = W.m.hints; const x = hs[Math.min(W.hintI, hs.length - 1)]; W.hintI++;
          const pen = W.practice ? 0 : (W.m.hintPenalty || 15); W.t = Math.min(W.m.limit - 1, W.t + pen);
          out = [`[HINT] ${x}`, pen ? `[SIM] ヒントを見ている間に ${pen} 秒進んだ。相手は待ってくれない。` : "[SIM] 練習モードなので時間は進みません。"];
          const due = W.q.filter(q => q.at <= W.t); W.q = W.q.filter(q => q.at > W.t); for (const q of due) { try { q.fn(W); } catch (e) { console.error(e); } }
        }
        else if (W.m.cmds && W.m.cmds[c]) out = W.m.cmds[c].run(W, h, args);
        else if (WIN[c]) out = WIN[c](W, h, args);
        else out = [...PS_NOT(toks[0]), "[SIM] この演習で未対応のコマンドかもしれません。help で一覧を確認できます。"];
        for (const s of segs.slice(1)) {
          const t2 = tokenize(s), c2 = (t2[0] || "").toLowerCase(), P = WIN_PIPE;
          if (!P[c2]) { out = PS_NOT(t2[0] || ""); break; }
          const r = P[c2](t2.slice(1), out, h); if (r.err) { out = r.err; break; } out = r.out;
        }
        for (const l of out) print(l, /^\[SIM\]/.test(l) ? "sim" : /^\[GAME\]/.test(l) ? "game" : /^\[HINT\]/.test(l) ? "hint" : /^\[/.test(l) && /ALERT/.test(l) ? "alert" : "");
        if (W.tut && !W.over) {
          const st = W.m.steps[W.step]; let ok = false;
          try { ok = !!st && st.ok(W, c, args, out, h, line); } catch (e) { console.error(e); }
          if (ok) { print("✓ できた：" + st.task, "ok"); W.step++; if (W.step >= W.m.steps.length) { W.over = { win: true, msg: "" }; ST.markLab(W.m.id); } else lessonOut(); }
        }
        const ps = el.querySelector(".ops-ps"); if (ps) ps.textContent = prompt();
        flush(); side(); check();
      };

      const onKey = ev => {
        if (gone()) return;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const t = ev.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (!el.getBoundingClientRect().height) return;
        const k = ev.key.toLowerCase();
        if (screen === "menu" && /^[1-9]$/.test(k)) { const m = D.missions[+k - 1]; if (m) { ev.preventDefault(); brief(m); } }
        else if (screen === "locked" && k === "enter") { ev.preventDefault(); brief(sel); }
        else if (screen === "tutend" && k === "enter") { ev.preventDefault(); if (sel) brief(sel); else { screen = "menu"; menu(); } }
        else if (screen === "brief" && k === "p" && sel && sel.mode !== "tut") { ev.preventDefault(); start(sel, true); }
        else if (screen === "brief" && k === "enter") { ev.preventDefault(); start(sel); }
        else if (screen === "end" && k === "enter") { ev.preventDefault(); start(W.m, W.practice); }
        else if (["brief", "end", "locked", "tutend"].includes(screen) && k === "b") { ev.preventDefault(); screen = "menu"; menu(); }
        else if (screen === "game" && k.length === 1) { const i = el.querySelector(".ops-in input"); if (i) i.focus(); }
      };
      document.addEventListener("keydown", onKey);
      menu();
      return () => { alive = false; stop(); document.removeEventListener("keydown", onKey); };
    }
  });
})(window.ST);
