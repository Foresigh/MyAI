import { APP_NAME } from "../../lib/brand";
import styles from "./TypingIndicator.module.css";

export function TypingIndicator() {
  return (
    <div className={styles.dots} aria-label={`${APP_NAME} is generating a response`}>
      <span />
      <span />
      <span />
    </div>
  );
}
