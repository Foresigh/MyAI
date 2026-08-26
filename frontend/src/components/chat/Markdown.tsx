import { lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { childrenToText } from "../../lib/markdownHelpers";
import styles from "./Markdown.module.css";

const CodeBlock = lazy(() => import("./CodeBlock"));

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children } = props;
            const match = /language-(\w+)/.exec(className ?? "");
            const text = childrenToText(children);
            if (match) {
              return (
                <Suspense fallback={<pre className={styles.codeFallback}>{text}</pre>}>
                  <CodeBlock language={match[1]} code={text} />
                </Suspense>
              );
            }
            return <code className={styles.inlineCode}>{children}</code>;
          },
          a(props) {
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
