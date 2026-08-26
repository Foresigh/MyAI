import { Check, Minus } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { MODEL_DISPLAY_NAME } from "../lib/brand";
import { useSettingsStore } from "../store/settingsStore";
import { PLAN_DEFINITIONS, PLAN_ORDER } from "../types/plans";
import styles from "./PricingPage.module.css";

export function PricingPage() {
  const localDemoPlan = useSettingsStore((s) => s.localDemoPlan);
  const setLocalDemoPlan = useSettingsStore((s) => s.setLocalDemoPlan);
  const grantedPlan = useSettingsStore((s) => s.grantedPlan);
  const effectivePlan = useSettingsStore((s) => s.effectivePlan());

  return (
    <div className={styles.page}>
      <TopBar title="Pricing" />
      <div className={styles.content}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Plans</h1>
          <p className={styles.subheading}>
            {MODEL_DISPLAY_NAME} runs entirely on your own machine — plans control how much headroom and priority
            you get, not cloud usage.
          </p>

          {grantedPlan && (
            <div className={styles.grantBanner}>
              An admin has granted this account the {PLAN_DEFINITIONS[grantedPlan].name} plan for free. Your local
              plan switch below is ignored while a grant is active.
            </div>
          )}

          <div className={styles.cards}>
            {PLAN_ORDER.map((id) => {
              const plan = PLAN_DEFINITIONS[id];
              const isCurrent = effectivePlan === plan.id;
              return (
                <div key={plan.id} className={isCurrent ? `${styles.card} ${styles.cardActive}` : styles.card}>
                  {isCurrent && <span className={styles.badge}>Current plan</span>}
                  <h2 className={styles.planName}>{plan.name}</h2>
                  <div className={styles.price}>
                    <span className={styles.priceAmount}>{plan.price}</span>
                    <span className={styles.priceDetail}>{plan.priceDetail}</span>
                  </div>
                  <p className={styles.bestFor}>{plan.bestFor}</p>
                  <p className={styles.tagline}>{plan.tagline}</p>

                  <ul className={styles.features}>
                    {plan.features.map((f) => (
                      <li key={f.label} className={f.included ? styles.featureOn : styles.featureOff}>
                        {f.included ? <Check size={14} /> : <Minus size={14} />}
                        {f.label}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={styles.selectButton}
                    disabled={!!grantedPlan || localDemoPlan === plan.id}
                    onClick={() => setLocalDemoPlan(plan.id)}
                  >
                    {localDemoPlan === plan.id ? "Selected" : `Switch to ${plan.name} (demo)`}
                  </button>
                </div>
              );
            })}
          </div>

          <p className={styles.footnote}>
            Billing isn't connected yet — the switch above simulates a plan locally for testing. Higher tiers
            request more local compute; {MODEL_DISPLAY_NAME} automatically uses the best model available on this
            machine and falls back gracefully if a larger one isn't installed yet.
          </p>
        </div>
      </div>
    </div>
  );
}
