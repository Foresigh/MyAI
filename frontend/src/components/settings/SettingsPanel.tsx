import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Laptop, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { fetchPlanForEmail } from "../../lib/api";
import { PLAN_DEFINITIONS } from "../../types/plans";
import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const navigate = useNavigate();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const email = useSettingsStore((s) => s.email);
  const setEmail = useSettingsStore((s) => s.setEmail);
  const grantedPlan = useSettingsStore((s) => s.grantedPlan);
  const setGrantedPlan = useSettingsStore((s) => s.setGrantedPlan);

  const [emailDraft, setEmailDraft] = useState(email);
  const [checking, setChecking] = useState(false);

  useEffect(() => setEmailDraft(email), [email]);

  const handleCheckGrant = async () => {
    setEmail(emailDraft.trim());
    if (!emailDraft.trim()) {
      setGrantedPlan(null);
      return;
    }
    setChecking(true);
    try {
      const plan = await fetchPlanForEmail(emailDraft.trim());
      setGrantedPlan(plan === "free" ? null : plan);
    } finally {
      setChecking(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <section className={styles.section}>
          <h3>Appearance</h3>
          <div className={styles.themeRow}>
            <button className={theme === "light" ? styles.themeBtnActive : styles.themeBtn} onClick={() => setTheme("light")}>
              <Sun size={14} /> Light
            </button>
            <button className={theme === "dark" ? styles.themeBtnActive : styles.themeBtn} onClick={() => setTheme("dark")}>
              <Moon size={14} /> Dark
            </button>
            <button className={theme === "system" ? styles.themeBtnActive : styles.themeBtn} onClick={() => setTheme("system")}>
              <Laptop size={14} /> System
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3>Identity</h3>
          <p className={styles.hint}>
            Arvo doesn't have accounts yet. Enter your email so an admin-granted plan can be recognized on this
            device.
          </p>
          <div className={styles.emailRow}>
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
            />
            <button onClick={handleCheckGrant} disabled={checking}>
              {checking ? "Checking..." : "Save"}
            </button>
          </div>
          {grantedPlan && (
            <p className={styles.grantNote}>An admin granted you the {PLAN_DEFINITIONS[grantedPlan].name} plan.</p>
          )}
        </section>

        <section className={styles.section}>
          <h3>Your plan</h3>
          <p className={styles.hint}>
            You're on the <strong>{PLAN_DEFINITIONS[grantedPlan ?? "free"].name}</strong> plan. Paid plans are linked to
            the email above, so enter the email you subscribed with.
          </p>
          <button className={styles.pricingLink} onClick={() => { onClose(); navigate("/pricing"); }}>
            View plan details &amp; pricing
          </button>
        </section>

        <section className={styles.section}>
          <button className={styles.adminLink} onClick={() => { onClose(); navigate("/admin"); }}>
            <ShieldCheck size={14} />
            Admin panel
          </button>
        </section>
      </div>
    </div>
  );
}
