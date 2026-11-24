import { useEffect, useRef, useState } from "react";
import { History, Trash2 } from "lucide-react";
import type { ChatSummary } from "./types";

function when(time: number) {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(time).toLocaleDateString();
}

interface Props {
  currentId: string | null;
  onOpen: (id: string) => void;
}

/** Earlier chats in this folder, newest first. */
export function HistoryMenu({ currentId, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void window.arvo.listChats().then(setChats);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="history-wrap" ref={wrapRef}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} title="Chat history" aria-label="Chat history" aria-expanded={open}>
        <History size={17} />
      </button>
      {open && (
        <div className="history-menu" role="menu" aria-label="Chat history">
          <div className="mode-title">Chats in this folder</div>
          {chats.length === 0 && <div className="history-empty">No saved chats yet.</div>}
          {chats.map((c) => (
            <div key={c.id} className={`history-item${c.id === currentId ? " current" : ""}`}>
              <button
                className="history-open"
                role="menuitem"
                onClick={() => {
                  onOpen(c.id);
                  setOpen(false);
                }}
              >
                <span className="history-title">{c.title}</span>
                <span className="history-time">{when(c.updatedAt)}</span>
              </button>
              <button
                className="history-delete"
                title="Delete chat"
                aria-label={`Delete ${c.title}`}
                onClick={async () => {
                  await window.arvo.deleteChat(c.id);
                  setChats((list) => list.filter((x) => x.id !== c.id));
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
