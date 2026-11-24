import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Folder, FolderOpen, Plus, Settings as SettingsIcon, Square, X } from "lucide-react";
import { ToolCard } from "./ToolCard";
import type { AgentEvent, ApprovalMode, ArvoModel, Item, Settings, Workspace } from "./types";

const arvo = window.arvo;

let nextId = 0;
const uid = () => `item-${++nextId}`;

const SUGGESTIONS = [
  "Explain what this project does and how it's organised",
  "Find bugs in this project and fix them",
  "Add tests for the main code and run them",
  "Create a new Expo app here",
];

const MODES: { id: ApprovalMode; label: string }[] = [
  { id: "ask", label: "Ask before changes" },
  { id: "edits", label: "Auto-approve edits" },
  { id: "auto", label: "Auto-approve everything" },
];

function folderName(folder: string) {
  return folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;
}

function TypingDots() {
  return (
    <div className="typing" role="status" aria-label="Arvo is working">
      <span />
      <span />
      <span />
    </div>
  );
}

function SettingsDialog({ settings, onSave, onClose }: { settings: Settings; onSave: (p: Partial<Settings>) => void; onClose: () => void }) {
  const [email, setEmail] = useState(settings.email);
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="dialog-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="field">
          <span>Your email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          <small>Use the email your Arvo plan is on. Pro and above unlock every model.</small>
        </label>
        <label className="field">
          <span>Server</span>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          <small>
            Leave this as it is unless you run your own Arvo server.{" "}
            <button className="link" onClick={() => setApiUrl(settings.defaultApiUrl)}>
              Reset
            </button>
          </small>
        </label>
        <p className="about">Arvo was made by Kayi Berisa.</p>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onSave({ email, apiUrl })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [models, setModels] = useState<ArvoModel[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadModels = useCallback(async () => {
    const data = await arvo.getModels();
    if (data) setModels(data.models);
  }, []);

  useEffect(() => {
    void arvo.getSettings().then(setSettings);
    void arvo.currentWorkspace().then(setWorkspace);
    void loadModels();
  }, [loadModels]);

  useEffect(
    () =>
      arvo.onEvent((event: AgentEvent) => {
        switch (event.type) {
          case "busy":
            setBusy(event.busy);
            if (!event.busy) setWaiting(0);
            break;
          case "assistant":
            setItems((list) => [...list, { kind: "assistant", id: uid(), text: event.text }]);
            break;
          case "tool_start":
            setItems((list) => [...list, { kind: "tool", id: event.id, name: event.name, args: event.args, status: "running", output: "" }]);
            break;
          case "tool_output":
            setItems((list) =>
              list.map((it) => (it.kind === "tool" && it.id === event.id ? { ...it, output: (it.output + event.chunk).slice(-20000) } : it))
            );
            break;
          case "approval":
            setItems((list) =>
              list.map((it) =>
                it.kind === "tool" && it.id === event.id ? { ...it, status: "awaiting", preview: event.preview, approvalKind: event.kind } : it
              )
            );
            break;
          case "tool_result":
            setItems((list) =>
              list.map((it) =>
                it.kind === "tool" && it.id === event.id
                  ? { ...it, status: event.declined ? "declined" : event.ok ? "ok" : "error", output: event.output }
                  : it
              )
            );
            break;
          case "waiting":
            setWaiting(event.seconds);
            break;
          case "error":
            setItems((list) => [...list, { kind: "error", id: uid(), text: event.message }]);
            break;
          case "stopped":
            setItems((list) =>
              list.map((it) => (it.kind === "tool" && (it.status === "running" || it.status === "awaiting") ? { ...it, status: "declined", output: "Stopped" } : it))
            );
            break;
        }
      }),
    []
  );

  // Count down the rate-limit wait shown to the user.
  useEffect(() => {
    if (waiting <= 0) return;
    const timer = setTimeout(() => setWaiting((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [items, busy]);

  const chooseFolder = async (folder?: string) => {
    const ws = folder ? await arvo.openWorkspace(folder) : await arvo.pickWorkspace();
    if (!ws) return;
    setWorkspace(ws);
    setItems([]);
    setSettings(await arvo.getSettings());
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async (text = input) => {
    const message = text.trim();
    if (!message || busy || !workspace) return;
    setInput("");
    setItems((list) => [...list, { kind: "user", id: uid(), text: message }]);
    const result = await arvo.send(message);
    if (result.error) setItems((list) => [...list, { kind: "error", id: uid(), text: result.error! }]);
  };

  const newChat = async () => {
    await arvo.newChat();
    setItems([]);
    inputRef.current?.focus();
  };

  const updateSettings = async (patch: Partial<Settings>) => {
    const saved = await arvo.setSettings(patch);
    setSettings((s) => (s ? { ...s, ...saved } : s));
    if ("email" in patch || "apiUrl" in patch) void loadModels();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const awaiting = items.some((it) => it.kind === "tool" && it.status === "awaiting");
  const toolRunning = items.some((it) => it.kind === "tool" && it.status === "running");

  if (!settings) return null;

  if (!workspace) {
    return (
      <div className="welcome">
        <div className="welcome-inner">
          <div className="logo">A</div>
          <h1>Arvo Code</h1>
          <p>Pick a project folder and Arvo can read your code, make changes and run commands on this computer. You approve every change.</p>
          <button className="btn primary big" onClick={() => void chooseFolder()}>
            <FolderOpen size={18} /> Choose a project folder
          </button>
          {settings.recentWorkspaces.length > 0 && (
            <div className="recent">
              <h3>Recent</h3>
              {settings.recentWorkspaces.map((f) => (
                <button key={f} className="recent-item" onClick={() => void chooseFolder(f)} title={f}>
                  <Folder size={15} />
                  <span className="recent-name">{folderName(f)}</span>
                  <span className="recent-path">{f}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentModel = models.find((m) => m.id === settings.model);

  return (
    <div className="app">
      <header className="topbar">
        <button className="folder-chip" onClick={() => void chooseFolder()} title={`${workspace.path}\nClick to change folder`}>
          <Folder size={15} />
          <span>{workspace.name}</span>
        </button>
        <button className="icon-btn" onClick={() => void arvo.revealWorkspace()} title="Open folder" aria-label="Open folder">
          <FolderOpen size={16} />
        </button>
        <div className="spacer" />
        <select
          className="select"
          value={settings.model}
          onChange={(e) => void updateSettings({ model: e.target.value })}
          aria-label="Model"
          title={currentModel?.description}
        >
          {models.length === 0 && <option value={settings.model}>{settings.model}</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={m.locked}>
              {m.name}
              {m.locked ? ` · ${m.required_plan}` : ""}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={settings.approvalMode}
          onChange={(e) => void updateSettings({ approvalMode: e.target.value as ApprovalMode })}
          aria-label="Approvals"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button className="icon-btn" onClick={() => void newChat()} title="New chat" aria-label="New chat">
          <Plus size={18} />
        </button>
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
          <SettingsIcon size={17} />
        </button>
      </header>

      <main className="scroll" ref={scrollRef}>
        <div className="thread">
          {items.length === 0 && (
            <div className="empty">
              <h2>What should Arvo work on in {workspace.name}?</h2>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.map((it) => {
            if (it.kind === "user") return <div key={it.id} className="user-msg">{it.text}</div>;
            if (it.kind === "error") return <div key={it.id} className="error-msg">{it.text}</div>;
            if (it.kind === "assistant")
              return (
                <div key={it.id} className="assistant-msg markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}
                  >
                    {it.text}
                  </ReactMarkdown>
                </div>
              );
            return <ToolCard key={it.id} item={it} onDecide={(d) => void arvo.respondApproval(it.id, d)} />;
          })}
          {waiting > 0 && <div className="notice">Arvo hit its per-minute limit. Continuing in {waiting}s…</div>}
          {busy && !awaiting && !toolRunning && waiting === 0 && <TypingDots />}
        </div>
      </main>

      <footer className="composer-wrap">
        <div className="composer">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={busy ? "Arvo is working…" : `Ask Arvo to build, fix or explain something in ${workspace.name}`}
            rows={1}
            autoFocus
          />
          {busy ? (
            <button className="send stop" onClick={() => void arvo.stop()} aria-label="Stop" title="Stop">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button className="send" onClick={() => void send()} disabled={!input.trim()} aria-label="Send" title="Send">
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <div className="hint">
          {settings.approvalMode === "auto"
            ? "Arvo will change files and run commands without asking."
            : settings.approvalMode === "edits"
              ? "Arvo edits files without asking, and asks before running commands."
              : "Arvo asks before changing files or running commands."}
        </div>
      </footer>

      {showSettings && (
        <SettingsDialog
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(patch) => {
            void updateSettings(patch);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
