import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Code2, Copy, Eye, Smartphone } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { expoSnackUrl, isExpoApp, isHtmlPreviewable } from "../../lib/codeRunners";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const isLight = theme === "light";
  const canPreview = isHtmlPreviewable(language, code);
  const isExpo = isExpoApp(language, code);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.language}>{language || "text"}</span>
        <div className={styles.actions}>
          {canPreview && (
            <button className={styles.copyButton} onClick={() => setShowPreview((v) => !v)} type="button">
              {showPreview ? <Code2 size={13} /> : <Eye size={13} />}
              {showPreview ? "Code" : "Preview"}
            </button>
          )}
          {isExpo && (
            <a
              className={styles.copyButton}
              href={expoSnackUrl(language, code)}
              target="_blank"
              rel="noopener noreferrer"
              title="Run this app in Expo Snack (in the browser or on your phone with Expo Go)"
            >
              <Smartphone size={13} />
              Open in Expo Snack
            </a>
          )}
          <button className={styles.copyButton} onClick={handleCopy} type="button">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {showPreview ? (
        // No allow-same-origin: the page runs isolated from Arvo and can't read its storage.
        <iframe
          className={styles.preview}
          title="Website preview"
          srcDoc={code}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
      ) : (
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          customStyle={{
            margin: 0,
            background: isLight ? "#f6f7f9" : "#0d0f12",
            padding: "14px 16px",
            fontSize: "13px",
            borderRadius: "0 0 var(--radius-md) var(--radius-md)",
          }}
          wrapLongLines
        >
          {code.replace(/\n$/, "")}
        </SyntaxHighlighter>
      )}
    </div>
  );
}
