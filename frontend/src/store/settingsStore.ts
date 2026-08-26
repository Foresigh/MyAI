import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlanId } from "../types/plans";

export type ThemePreference = "dark" | "light" | "system";

interface SettingsState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  email: string;
  localDemoPlan: PlanId;
  grantedPlan: PlanId | null;
  adminKey: string;
  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setEmail: (email: string) => void;
  setLocalDemoPlan: (plan: PlanId) => void;
  setGrantedPlan: (plan: PlanId | null) => void;
  setAdminKey: (key: string) => void;
  effectivePlan: () => PlanId;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sidebarCollapsed: false,
      email: "",
      localDemoPlan: "free",
      grantedPlan: null,
      adminKey: "",

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setEmail: (email) => set({ email }),
      setLocalDemoPlan: (plan) => set({ localDemoPlan: plan }),
      setGrantedPlan: (plan) => set({ grantedPlan: plan }),
      setAdminKey: (key) => set({ adminKey: key }),

      effectivePlan: () => {
        const state = get();
        return state.grantedPlan ?? state.localDemoPlan;
      },
    }),
    { name: "myai-settings" }
  )
);
