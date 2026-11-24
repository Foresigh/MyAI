import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ApprovalMode } from "./types";

export const MODES: { id: Exclude<ApprovalMode, "bypass">; label: string; description: string }[] = [
  { id: "auto", label: "Auto", description: "Arvo handles permission decisions" },
  { id: "manual", label: "Manual", description: "Always ask before making changes" },
  { id: "edits", label: "Accept edits", description: "Automatically accept all file edits" },
  { id: "plan", label: "Plan", description: "Create a plan before making changes" },
];

export const MODE_LABELS: Record<ApprovalMode, string> = {
  auto: "Auto",
  manual: "Manual",
  edits: "Accept edits",
  plan: "Plan",
  bypass: "Bypass permissions",
};

/** Modes in the order Shift+Tab cycles through them. */
export function cycleModes(bypassEnabled: boolean): ApprovalMode[] {
  return [...MODES.map((m) => m.id), ...(bypassEnabled ? (["bypass"] as const) : [])];
}

interface Props {
  mode: ApprovalMode;
  bypassEnabled: boolean;
  onChange: (mode: ApprovalMode) => void;
  onEnableBypass: () => void;
}

export function ModeMenu({ mode, bypassEnabled, onChange, onEnableBypass }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const choose = (next: ApprovalMode) => {
    onChange(next);
    setOpen(false);
    setConfirming(false);
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setConfirming(false);
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= MODES.length) {
      e.preventDefault();
      choose(MODES[n - 1].id);
    } else if (n === 5 && bypassEnabled) {
      e.preventDefault();
      choose("bypass");
    }
  };

  return (
    <div className="mode-wrap" ref={wrapRef}>
      <button
        className={`mode-button${mode === "bypass" ? " danger" : ""}${mode === "plan" ? " plan" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Permission mode (Shift+Tab to switch)"
      >
        {MODE_LABELS[mode]}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="mode-menu" role="menu" aria-label="Mode" tabIndex={-1} ref={menuRef} onKeyDown={onKeyDown}>
          <div className="mode-title">Mode</div>
          {MODES.map((m, i) => (
            <button
              key={m.id}
              className={`mode-item${mode === m.id ? " selected" : ""}`}
              role="menuitemradio"
              aria-checked={mode === m.id}
              onClick={() => choose(m.id)}
            >
              <span className="mode-text">
                <span className="mode-label">{m.label}</span>
                <span className="mode-desc">{m.description}</span>
              </span>
              {mode === m.id && <Check size={18} className="mode-check" />}
              <span className="mode-key">{i + 1}</span>
            </button>
          ))}

          {bypassEnabled ? (
            <button
              className={`mode-item bypass${mode === "bypass" ? " selected" : ""}`}
              role="menuitemradio"
              aria-checked={mode === "bypass"}
              onClick={() => choose("bypass")}
            >
              <span className="mode-text">
                <span className="mode-label">Bypass permissions</span>
                <span className="mode-desc">Never ask, even for risky commands</span>
              </span>
              {mode === "bypass" && <Check size={18} className="mode-check" />}
              <span className="mode-key">5</span>
            </button>
          ) : confirming ? (
            <div className="bypass-confirm">
              <p>Arvo will change files and run any command without asking, including deleting files. Only use this in folders you can afford to lose.</p>
              <div className="bypass-actions">
                <button className="btn ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    onEnableBypass();
                    choose("bypass");
                  }}
                >
                  Enable
                </button>
              </div>
            </div>
          ) : (
            <div className="mode-item bypass-row">
              <span className="mode-label">Bypass permissions</span>
              <button className="enable-btn" onClick={() => setConfirming(true)}>
                Enable
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
