import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SettingsPanel } from "../settings/SettingsPanel";
import styles from "./AppShell.module.css";

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
