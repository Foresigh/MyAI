import { useState } from "react";
import {
  Check,
  ChevronRight,
  FilePen,
  FilePlus,
  FileText,
  FolderOpen,
  Search,
  Terminal,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Item, Preview } from "./types";

type ToolItem = Extract<Item, { kind: "tool" }>;

const ICONS: Record<string, LucideIcon> = {
  list_files: FolderOpen,
  read_file: FileText,
  read_files: FileText,
  write_files: FilePlus,
  search_files: Search,
  write_file: FilePlus,
  edit_file: FilePen,
  run_command: Terminal,
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function label(item: ToolItem): { verb: string; target: string; mono: boolean } {
  const { name, args, status } = item;
  const asking = status === "awaiting";
  switch (name) {
    case "list_files":
      return { verb: "Looked in", target: str(args.path, ".") === "." ? "the project" : str(args.path), mono: str(args.path, ".") !== "." };
    case "read_file":
      return { verb: "Read", target: str(args.path), mono: true };
    case "read_files": {
      const paths = Array.isArray(args.paths) ? (args.paths as unknown[]).map(String) : [];
      return { verb: "Read", target: paths.length > 1 ? `${paths.length} files: ${paths.join(", ")}` : paths[0] ?? "", mono: true };
    }
    case "write_files": {
      const files = Array.isArray(args.files) ? (args.files as { path?: string }[]) : [];
      const list = files.map((f) => String(f?.path ?? "")).join(", ");
      return { verb: asking ? "Wants to write" : "Wrote", target: files.length > 1 ? `${files.length} files: ${list}` : list, mono: true };
    }
    case "search_files":
      return { verb: "Searched for", target: `"${str(args.query)}"`, mono: false };
    case "write_file":
      return { verb: asking ? "Wants to write" : "Wrote", target: str(args.path), mono: true };
    case "edit_file":
      return { verb: asking ? "Wants to edit" : "Edited", target: str(args.path), mono: true };
    case "run_command":
      return { verb: asking ? "Wants to run" : "Ran", target: str(args.command), mono: true };
    default:
      return { verb: "Used", target: name, mono: true };
  }
}

function lines(text: string, prefix: string, max = 60) {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const shown = all.slice(0, max).map((l) => `${prefix}${l}`);
  if (all.length > max) shown.push(`  … ${all.length - max} more lines`);
  return shown.join("\n");
}

function PreviewBody({ preview }: { preview: Preview }) {
  if (preview.kind === "command") {
    return (
      <div className="preview">
        <pre className="code command">
          <span className="prompt">{preview.cwd && preview.cwd !== "." ? `${preview.cwd} ` : ""}&gt; </span>
          {preview.command}
        </pre>
      </div>
    );
  }
  if (preview.kind === "edit") {
    return (
      <div className="preview">
        <pre className="code diff">
          <span className="del">{lines(preview.oldText, "- ")}</span>
          {"\n"}
          <span className="add">{lines(preview.newText, "+ ")}</span>
        </pre>
      </div>
    );
  }
  if (preview.kind === "write_many") {
    return (
      <div className="preview">
        {preview.files.map((f) => (
          <div key={f.path}>
            <div className="preview-note">
              <span className="mono">{f.path}</span> {f.exists ? "(replaces the file)" : "(new file)"}
            </div>
            <pre className="code diff">
              <span className="add">{lines(f.content, "+ ", 25)}</span>
            </pre>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="preview">
      <div className="preview-note">{preview.exists ? "Replaces the whole file with:" : "New file:"}</div>
      <pre className="code diff">
        <span className="add">{lines(preview.content, "+ ")}</span>
      </pre>
    </div>
  );
}

interface Props {
  item: ToolItem;
  onDecide: (decision: "allow" | "always" | "deny") => void;
}

export function ToolCard({ item, onDecide }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[item.name] ?? Terminal;
  const { verb, target, mono } = label(item);
  const asking = item.status === "awaiting";
  const isCommand = item.name === "run_command";
  const hasOutput = item.output.trim().length > 0;
  // Command output is worth seeing while it runs.
  const expanded = open || (isCommand && item.status === "running" && hasOutput);

  return (
    <div className={`tool ${item.status}`}>
      <button
        className="tool-row"
        onClick={() => setOpen((v) => !v)}
        disabled={asking || !hasOutput}
        aria-expanded={expanded}
      >
        <Icon size={15} className="tool-icon" />
        <span className="tool-verb">{verb}</span>
        <span className={`tool-target${mono ? " mono" : ""}`} title={target}>
          {target}
        </span>
        <span className="tool-state">
          {item.status === "running" && <span className="spinner" aria-label="Running" />}
          {item.status === "ok" && <Check size={14} className="ok-icon" aria-label="Done" />}
          {item.status === "error" && <X size={14} className="err-icon" aria-label="Failed" />}
          {item.status === "declined" && <span className="declined-text">{item.output || "Declined"}</span>}
          {!asking && hasOutput && item.status !== "declined" && (
            <ChevronRight size={14} className={`chev${expanded ? " open" : ""}`} />
          )}
        </span>
      </button>

      {asking && item.preview && (
        <div className="approval">
          {item.reason && <div className="approval-reason">{item.reason}</div>}
          <PreviewBody preview={item.preview} />
          <div className="approval-actions">
            <button className="btn primary" onClick={() => onDecide("allow")} autoFocus>
              {isCommand ? "Run" : "Allow"}
            </button>
            <button className="btn" onClick={() => onDecide("always")}>
              {isCommand ? "Always run commands" : "Always allow edits"}
            </button>
            <button className="btn ghost" onClick={() => onDecide("deny")}>
              Decline
            </button>
          </div>
        </div>
      )}

      {expanded && hasOutput && item.status !== "declined" && <pre className="code output">{item.output}</pre>}
    </div>
  );
}
