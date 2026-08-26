import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Moon, PanelLeftOpen, Sparkles, Sun } from "lucide-react";
import { fetchHealth } from "../../lib/api";
import { MODEL_DISPLAY_NAME } from "../../lib/brand";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { PLAN_DEFINITIONS } from "../../types/plans";
import { IconButton } from "../common/IconButton";
import styles from "./TopBar.module.css";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const effectivePlan = useSettingsStore((s) => s.effectivePlan());
  const openMobileSidebar = useUiStore((s) => s.openMobileSidebar);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const data = await fetchHealth();
        if (!cancelled) setHealth(data.status === "ok" ? "ok" : "down");
      } catch {
        if (!cancelled) setHealth("down");
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <IconButton label="Open menu" onClick={openMobileSidebar} className={styles.mobileMenuButton}>
          <Menu size={17} />
        </IconButton>
        {collapsed && (
          <IconButton label="Expand sidebar" onClick={toggleSidebar} className={styles.desktopExpandButton}>
            <PanelLeftOpen size={17} />
          </IconButton>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        <span className={`${styles.statusDot} ${health === "ok" ? styles.dotOk : health === "down" ? styles.dotDown : styles.dotChecking}`} />
        <span className={styles.statusLabel}>
          {health === "ok"
            ? `${MODEL_DISPLAY_NAME} online`
            : health === "down"
              ? "backend offline"
              : "checking..."}
        </span>
        {effectivePlan === "free" ? (
          <button className={styles.upgradePill} onClick={() => navigate("/pricing")}>
            <Sparkles size={12} />
            Upgrade
          </button>
        ) : (
          <span className={styles.planPill}>{PLAN_DEFINITIONS[effectivePlan].name}</span>
        )}
        <IconButton label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
      </div>
    </header>
  );
}
