import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Moon, PanelLeftOpen, Sparkles, Sun } from "lucide-react";
import { fetchHealth, fetchModels, type ArvoModel } from "../../lib/api";
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
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSelectedModel = useSettingsStore((s) => s.setSelectedModel);
  const email = useSettingsStore((s) => s.email);
  const [models, setModels] = useState<ArvoModel[]>([]);

  // Reload when the email or plan changes, since that changes which models unlock.
  useEffect(() => {
    let cancelled = false;
    fetchModels(email).then((data) => {
      if (cancelled) return;
      setModels(data.models);
      const current = useSettingsStore.getState().selectedModel;
      const usable = data.models.filter((m) => !m.locked);
      if (usable.length > 0 && !usable.some((m) => m.id === current)) {
        const fallback = usable.find((m) => m.id === data.default) ?? usable[0];
        setSelectedModel(fallback.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [email, effectivePlan, setSelectedModel]);

  const activeModel = models.find((m) => m.id === selectedModel);
  const healthLabel = health === "ok" ? "Online" : health === "down" ? "Backend offline" : "Checking...";

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
        <span
          className={`${styles.statusDot} ${health === "ok" ? styles.dotOk : health === "down" ? styles.dotDown : styles.dotChecking}`}
          title={healthLabel}
          aria-label={healthLabel}
          role="status"
        />
        {models.length > 0 && (
          <select
            className={styles.modelSelect}
            value={activeModel ? activeModel.id : models[0].id}
            onChange={(e) => setSelectedModel(e.target.value)}
            title={(activeModel ?? models[0]).description}
            aria-label="Model"
          >
            {models.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={m.locked}
                title={m.locked ? `${m.description} Included with ${m.required_plan} and above.` : m.description}
              >
                {m.locked ? `${m.name} · ${m.required_plan}` : m.name}
              </option>
            ))}
          </select>
        )}
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
