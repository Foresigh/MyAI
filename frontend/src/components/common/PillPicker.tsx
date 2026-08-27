import styles from "./SettingsPicker.module.css";

interface PillPickerProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function PillPicker<T extends string>({ label, options, value, onChange }: PillPickerProps<T>) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.pillRow}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={value === opt.value ? `${styles.pill} ${styles.pillActive}` : styles.pill}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
