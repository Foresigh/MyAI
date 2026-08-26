import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { MODEL_DISPLAY_NAME } from "../lib/brand";
import { createBillingPortalSession, createCheckoutSession, fetchPlanForEmail, ChatApiError } from "../lib/api";
import { useSettingsStore } from "../store/settingsStore";
import { PLAN_DEFINITIONS, PLAN_ORDER, type PlanId } from "../types/plans";
import styles from "./PricingPage.module.css";

export function PricingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const email = useSettingsStore((s) => s.email);
  const setEmail = useSettingsStore((s) => s.setEmail);
  const setGrantedPlan = useSettingsStore((s) => s.setGrantedPlan);
  const localDemoPlan = useSettingsStore((s) => s.localDemoPlan);
  const setLocalDemoPlan = useSettingsStore((s) => s.setLocalDemoPlan);
  const grantedPlan = useSettingsStore((s) => s.grantedPlan);
  const effectivePlan = useSettingsStore((s) => s.effectivePlan());

  const [emailDraft, setEmailDraft] = useState(email);
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    if (!checkoutStatus || !email) return;
    if (checkoutStatus === "success") {
      fetchPlanForEmail(email).then((plan) => setGrantedPlan(plan === "free" ? null : plan));
    }
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutStatus, email]);

  const handleSubscribe = async (plan: PlanId) => {
    setError(null);
    const targetEmail = emailDraft.trim();
    if (!targetEmail) {
      setError("Enter your email above to subscribe.");
      return;
    }
    setEmail(targetEmail);
    setPendingPlan(plan);
    try {
      const url = await createCheckoutSession(targetEmail, plan);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Could not start checkout.");
      setPendingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setError(null);
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setPortalPending(true);
    try {
      const url = await createBillingPortalSession(email);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Could not open the billing portal.");
    } finally {
      setPortalPending(false);
    }
  };

  const hasRealSubscription = grantedPlan && grantedPlan !== "free";

  return (
    <div className={styles.page}>
      <TopBar title="Pricing" />
      <div className={styles.content}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Plans</h1>
          <p className={styles.subheading}>
            {MODEL_DISPLAY_NAME} runs entirely on your own machine — plans control how much headroom and
            priority you get, not cloud usage.
          </p>

          {checkoutStatus === "cancel" && (
            <div className={styles.cancelBanner}>Checkout was canceled — no charge was made.</div>
          )}

          {hasRealSubscription ? (
            <div className={styles.grantBanner}>
              {grantedPlan && PLAN_DEFINITIONS[grantedPlan].name} is active for {email}.{" "}
              <button className={styles.manageLink} onClick={handleManageSubscription} disabled={portalPending}>
                {portalPending ? "Opening..." : "Manage subscription"}
              </button>
            </div>
          ) : (
            <div className={styles.emailRow}>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email for billing"
              />
              <span className={styles.emailHint}>Used for your subscription and receipts.</span>
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.cards}>
            {PLAN_ORDER.map((id) => {
              const plan = PLAN_DEFINITIONS[id];
              const isCurrent = effectivePlan === plan.id;
              const isPaidPlan = plan.id !== "free";

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

                  {isCurrent && hasRealSubscription ? (
                    <button className={styles.selectButton} onClick={handleManageSubscription} disabled={portalPending}>
                      {portalPending ? "Opening..." : "Manage subscription"}
                    </button>
                  ) : isPaidPlan ? (
                    <button
                      className={styles.selectButton}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={pendingPlan !== null || !!hasRealSubscription}
                    >
                      {pendingPlan === plan.id ? "Redirecting..." : `Subscribe — ${plan.price}${plan.priceDetail}`}
                    </button>
                  ) : (
                    <button
                      className={styles.selectButton}
                      disabled={!!hasRealSubscription || localDemoPlan === plan.id}
                      onClick={() => setLocalDemoPlan(plan.id)}
                    >
                      {localDemoPlan === plan.id ? "Selected" : "Switch to Free"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className={styles.footnote}>
            Paid plans are billed securely through Stripe. Higher tiers also request more local compute —{" "}
            {MODEL_DISPLAY_NAME} automatically uses the best model available on this machine and falls back
            gracefully if a larger one isn't installed yet.
          </p>
        </div>
      </div>
    </div>
  );
}
