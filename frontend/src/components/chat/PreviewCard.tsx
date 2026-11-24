import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Code2, Copy, Download, Eye, Globe, MoreHorizontal, Smartphone, X } from "lucide-react";
import { expoSnackUrl } from "../../lib/codeRunners";
import styles from "./PreviewCard.module.css";

type Kind = "website" | "app";

interface PreviewCardProps {
  kind: Kind;
  language: string;
  code: string;
  /** Renders the highlighted code, so the card can show it on request. */
  renderCode: () => ReactNode;
}

function titleFor(kind: Kind, code: string): string {
  if (kind === "website") {
    const title = code.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
    const h1 = code.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i)?.[1]?.trim();
    return title || h1 || "Website";
  }
  const name = code.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1];
  if (name && name !== "App") return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return "Expo app";
}

/** Waits for the text to stop changing so a streaming reply doesn't reload the preview on every word. */
function useSettled<T>(value: T, delay = 500): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function downloadHtml(code: string, title: string) {
  const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "website"}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LivePreview({ kind, language, code, className }: { kind: Kind; language: string; code: string; className: string }) {
  // Neither iframe gets access to Arvo's storage: the website runs without
  // allow-same-origin, and Snack runs on its own domain.
  if (kind === "website") {
    return (
      <iframe
        className={className}
        title="Website preview"
        srcDoc={code}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
      />
    );
  }
  return (
    <iframe
      className={className}
      title="App preview"
      src={expoSnackUrl(language, code, true)}
      allow="clipboard-write"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  );
}

function PreviewPanel({
  kind,
  language,
  code,
  title,
  renderCode,
  onClose,
}: PreviewCardProps & { title: string; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            {kind === "website" ? <Globe size={16} /> : <Smartphone size={16} />}
            <span>{title}</span>
          </div>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? styles.tabActive : styles.tab} onClick={() => setTab("preview")}>
              <Eye size={13} /> Preview
            </button>
            <button type="button" role="tab" aria-selected={tab === "code"} className={tab === "code" ? styles.tabActive : styles.tab} onClick={() => setTab("code")}>
              <Code2 size={13} /> Code
            </button>
          </div>
          <div className={styles.panelActions}>
            {kind === "website" ? (
              <button type="button" className={styles.iconButton} onClick={() => downloadHtml(code, title)} title="Download as .html" aria-label="Download as .html">
                <Download size={16} />
              </button>
            ) : (
              <a className={styles.iconButton} href={expoSnackUrl(language, code)} target="_blank" rel="noopener noreferrer" title="Open in Expo Snack" aria-label="Open in Expo Snack">
                <Smartphone size={16} />
              </a>
            )}
            <button type="button" className={styles.iconButton} onClick={copy} title="Copy code" aria-label="Copy code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button type="button" className={styles.iconButton} onClick={onClose} title="Close" aria-label="Close preview">
              <X size={17} />
            </button>
          </div>
        </div>
        <div className={styles.panelBody}>
          {tab === "preview" ? (
            <LivePreview kind={kind} language={language} code={code} className={kind === "app" ? styles.panelFrameApp : styles.panelFrame} />
          ) : (
            <div className={styles.panelCode}>{renderCode()}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PreviewCard(props: PreviewCardProps) {
  const { kind, language, code, renderCode } = props;
  const [open, setOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const settledCode = useSettled(code);
  const title = titleFor(kind, code);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <button type="button" className={styles.thumb} onClick={() => setOpen(true)} aria-label={`Open ${title}`}>
          {kind === "website" ? (
            <iframe
              className={styles.thumbFrame}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              srcDoc={settledCode}
              sandbox="allow-scripts"
              loading="lazy"
            />
          ) : (
            <span className={styles.thumbIcon}>
              <Smartphone size={34} strokeWidth={1.5} />
            </span>
          )}
        </button>
        <div className={styles.footer}>
          <div className={styles.meta}>
            <span className={styles.title}>{title}</span>
            <span className={styles.subtitle}>{kind === "website" ? "Website · HTML" : "App · Expo"}</span>
          </div>
          <button type="button" className={styles.openButton} onClick={() => setOpen(true)}>
            Open
          </button>
          <div className={styles.menuWrap} ref={menuRef}>
            <button type="button" className={styles.moreButton} onClick={() => setMenuOpen((v) => !v)} aria-label="More options" aria-expanded={menuOpen}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className={styles.menu} role="menu">
                <button type="button" role="menuitem" onClick={() => { setShowCode((v) => !v); setMenuOpen(false); }}>
                  <Code2 size={14} /> {showCode ? "Hide code" : "View code"}
                </button>
                <button type="button" role="menuitem" onClick={() => { void copy(); setMenuOpen(false); }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} Copy code
                </button>
                {kind === "website" ? (
                  <button type="button" role="menuitem" onClick={() => { downloadHtml(code, title); setMenuOpen(false); }}>
                    <Download size={14} /> Download .html
                  </button>
                ) : (
                  <a role="menuitem" href={expoSnackUrl(language, code)} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                    <Smartphone size={14} /> Open in Expo Snack
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showCode && <div className={styles.code}>{renderCode()}</div>}
      {open && <PreviewPanel {...props} code={code} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
}
