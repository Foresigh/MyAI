import { useEffect } from "react";
import { fetchPlanForEmail } from "../lib/api";
import { useSettingsStore } from "../store/settingsStore";

export function useGrantSync() {
  const email = useSettingsStore((s) => s.email);
  const setGrantedPlan = useSettingsStore((s) => s.setGrantedPlan);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetchPlanForEmail(email).then((plan) => {
      if (!cancelled) setGrantedPlan(plan === "free" ? null : plan);
    });
    return () => {
      cancelled = true;
    };
  }, [email, setGrantedPlan]);
}
