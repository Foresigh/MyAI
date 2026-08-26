import styles from "./TypingIndicator.module.css";

export function TypingIndicator() {
  return (
    <div className={styles.dots} aria-label="MyAI is generating a response">
      <span />
      <span />
      <span />
    </div>
  );
}
