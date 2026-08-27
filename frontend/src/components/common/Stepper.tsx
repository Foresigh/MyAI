import { Minus, Plus } from "lucide-react";
import styles from "./SettingsPicker.module.css";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={13} />
        </button>
        <span className={styles.stepperValue}>{value}</span>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
