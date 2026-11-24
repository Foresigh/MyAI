import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { isExpoApp, isHtmlPreviewable } from "../../lib/codeRunners";
import { PreviewCard } from "./PreviewCard";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  language: string;
  code: string;
}

function PlainCodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const isLight = theme === "light";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.language}>{language || "text"}</span>
        <button className={styles.copyButton} onClick={handleCopy} type="button">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
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
    </div>
  );
}

/** Websites and Expo apps show as a preview card; everything else as highlighted code. */
export default function CodeBlock({ language, code }: CodeBlockProps) {
  const kind = isHtmlPreviewable(language, code) ? "website" : isExpoApp(language, code) ? "app" : null;
  if (!kind) return <PlainCodeBlock language={language} code={code} />;
  return (
    <PreviewCard
      kind={kind}
      language={language}
      code={code}
      renderCode={() => <PlainCodeBlock language={language} code={code} />}
    />
  );
}
