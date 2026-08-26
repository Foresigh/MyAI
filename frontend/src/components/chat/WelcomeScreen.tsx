import { Code2, Database, FileSearch, Hammer, Layers, ScanSearch } from "lucide-react";
import styles from "./WelcomeScreen.module.css";

interface WelcomeScreenProps {
  onPick: (prompt: string) => void;
}

const STARTERS = [
  { icon: Hammer, text: "Build a modern React website for my business." },
  { icon: Code2, text: "Debug this Python code." },
  { icon: Layers, text: "Create a FastAPI backend." },
  { icon: Database, text: "Design a PostgreSQL database." },
  { icon: ScanSearch, text: "Review my application architecture." },
  { icon: FileSearch, text: "Explain this code." },
];

export function WelcomeScreen({ onPick }: WelcomeScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h1 className={styles.title}>MyAI</h1>
        <p className={styles.subtitle}>Build. Code. Create.</p>

        <div className={styles.grid}>
          {STARTERS.map(({ icon: Icon, text }) => (
            <button key={text} className={styles.card} onClick={() => onPick(text)} type="button">
              <Icon size={16} className={styles.cardIcon} />
              <span>{text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
