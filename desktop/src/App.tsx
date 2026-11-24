import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Download, Folder, FolderOpen, ListChecks, Plus, Settings as SettingsIcon, Square, X } from "lucide-react";
import { ModeMenu, cycleModes } from "./ModeMenu";
import { HistoryMenu } from "./HistoryMenu";
import { ToolCard } from "./ToolCard";
import { CodeBlock } from "./CopyButton";
import type { AgentEvent, ApprovalMode, ArvoModel, Item, Settings, UpdateState, Workspace } from "./types";

const arvo = window.arvo;

const uid = () => crypto.randomUUID();

const SUGGESTIONS = [
  "Explain what this project does and how it's organised",
  "Find bugs in this project and fix them",
  "Add tests for the main code and run them",
  "Create a new Expo app here",
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

function UpdateButton({ update }: { update: UpdateState }) {
  if (update.status === "ready")
    return (
      <button className="update-btn" onClick={() => void arvo.installUpdate()} title={`Restart Arvo to install version ${update.version}`}>
        <Download size={14} /> Update
      </button>
    );
  if (update.status === "downloading")
    return (
      <span className="update-progress" title={`Downloading Arvo ${update.version}`}>
        Downloading update… {update.percent}%
      </span>
    );
  return null;
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
  const [update, setUpdate] = useState<UpdateState>({ status: "none" });
  const [chatId, setChatId] = useState<string | null>(null);
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
    void arvo.getUpdate().then(setUpdate);
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
                it.kind === "tool" && it.id === event.id
                  ? { ...it, status: "awaiting", preview: event.preview, approvalKind: event.kind, reason: event.reason }
                  : it
              )
            );
            break;
          case "tool_running":
            setItems((list) => list.map((it) => (it.kind === "tool" && it.id === event.id ? { ...it, status: "running" } : it)));
            break;
          case "plan_ready":
            setItems((list) => [...list, { kind: "plan", id: uid(), decided: false }]);
            break;
          case "update":
            setUpdate(event.state);
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

  // Save the chat whenever Arvo finishes, so New chat never loses it.
  useEffect(() => {
    if (!busy && items.some((it) => it.kind === "user")) void arvo.saveChat(items);
  }, [busy, items]);

  const newChat = async () => {
    await arvo.newChat();
    setItems([]);
    setChatId(null);
    inputRef.current?.focus();
  };

  const openChat = async (id: string) => {
    const chat = await arvo.openChat(id);
    if (!chat) return;
    setItems(chat.items);
    setChatId(chat.id);
    inputRef.current?.focus();
  };

  const updateSettings = async (patch: Partial<Settings>) => {
    const saved = await arvo.setSettings(patch);
    setSettings((s) => (s ? { ...s, ...saved } : s));
    if ("email" in patch || "apiUrl" in patch) void loadModels();
  };

  const setMode = (mode: ApprovalMode) => void updateSettings({ approvalMode: mode });

  const decide = (id: string, decision: "allow" | "always" | "deny") => {
    // Show the result of the click straight away; the command may take a while.
    setItems((list) =>
      list.map((it) =>
        it.kind === "tool" && it.id === id
          ? { ...it, status: decision === "deny" ? "declined" : "running", output: decision === "deny" ? "Declined" : it.output }
          : it
      )
    );
    void arvo.respondApproval(id, decision);
  };

  const approvePlan = (id: string) => {
    setItems((list) => list.map((it) => (it.kind === "plan" && it.id === id ? { ...it, decided: true } : it)));
    setMode("auto");
    void send("The plan is approved. Go ahead and carry it out.");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && e.shiftKey && settings) {
      e.preventDefault();
      const order = cycleModes(settings.bypassEnabled);
      setMode(order[(order.indexOf(settings.approvalMode) + 1) % order.length]);
      return;
    }
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
        <div className="welcome-update">
          <UpdateButton update={update} />
        </div>
        <div className="welcome-inner">
          <img className="logo" src="./logo.svg" alt="" />
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
        <UpdateButton update={update} />
        <HistoryMenu currentId={chatId} onOpen={(id) => void openChat(id)} />
        <button className="new-chat-btn" onClick={() => void newChat()} title="Start a new chat. This one is saved in History.">
          <Plus size={16} /> New chat
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
                    components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>, pre: ({ node: _node, ...rest }) => <CodeBlock {...rest} /> }}
                  >
                    {it.text}
                  </ReactMarkdown>
                </div>
              );
            if (it.kind === "plan")
              return (
                <div key={it.id} className="plan-card">
                  <ListChecks size={18} className="plan-icon" />
                  <span className="plan-text">{it.decided ? "Plan approved." : "Ready to go with this plan?"}</span>
                  {!it.decided && !busy && (
                    <>
                      <button className="btn ghost" onClick={() => inputRef.current?.focus()}>
                        Keep planning
                      </button>
                      <button className="btn primary" onClick={() => approvePlan(it.id)}>
                        Approve plan
                      </button>
                    </>
                  )}
                </div>
              );
            return <ToolCard key={it.id} item={it} onDecide={(d) => decide(it.id, d)} />;
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
        <div className="composer-bar">
          <span className="hint">
            {settings.approvalMode === "plan"
              ? "Plan mode: Arvo only looks around, then proposes a plan."
              : settings.approvalMode === "bypass"
                ? "Bypass: Arvo never asks, even for risky commands."
                : "Shift+Tab to switch modes"}
          </span>
          <select
            className="model-select"
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
          <ModeMenu
            mode={settings.approvalMode}
            bypassEnabled={settings.bypassEnabled}
            onChange={setMode}
            onEnableBypass={() => void updateSettings({ bypassEnabled: true })}
          />
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
