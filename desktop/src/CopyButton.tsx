import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  /** The text to copy, or a function that reads it when clicked. */
  text: string | (() => string);
  label?: string;
  className?: string;
}

/** A small button that copies text and shows "Copied" for a moment. */
export function CopyButton({ text, label = "Copy", className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={`copy-btn${copied ? " copied" : ""} ${className}`}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      onClick={async (e) => {
        e.stopPropagation();
        await window.arvo.copyText(typeof text === "function" ? text() : text);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** A markdown code block with a Copy button in the corner. */
export function CodeBlock(props: ComponentPropsWithoutRef<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="code-block">
      <pre ref={ref} {...props} />
      <CopyButton text={() => (ref.current?.innerText ?? "").replace(/\n$/, "")} className="floating" />
    </div>
  );
}
