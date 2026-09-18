import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Modal, originFromEvent, type ModalOrigin } from "@/components/Modal";
import { API_SUBSCRIPTION_PLANS, SUBSCRIPTION_PLANS } from "@/lib/mock";
import { ApiError } from "@/lib/api";
import { CountDollars } from "@/components/CountUp";
import { formatUsd, remainLabel } from "@/lib/format";
import { useApp } from "@/lib/store";

const PLAN_DAYS = { day: 1, week: 7, month: 30 } as const;

function stackedUntil(current: string | null, days: number) {
  const now = Date.now();
  let base = now;
  if (current) {
    const raw = current.includes("T") ? current : current.replace(" ", "T") + "Z";
    const end = Date.parse(raw);
    if (Number.isFinite(end) && end > now) base = end;
  }
  return new Date(base + days * 86_400_000).toISOString();
}

type Draft = {
  kind: "desk" | "api";
  plan: "day" | "week" | "month";
  label: string;
  price: number;
};

export function SubscriptionsPage() {
  const app = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [origin, setOrigin] = useState<ModalOrigin | null>(null);
  const [busy, setBusy] = useState(false);

  function open(
    kind: "desk" | "api",
    plan: "day" | "week" | "month",
    label: string,
    price: number,
    e: { currentTarget: EventTarget },
  ) {
    setOrigin(originFromEvent(e));
    setDraft({ kind, plan, label, price });
  }

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    try {
      await app.subscribe(draft.kind, draft.plan);
      setDraft(null);
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : `Could not buy ${draft.label}`);
    } finally {
      setBusy(false);
    }
  }

  const cents = draft ? Math.round(draft.price * 100) : 0;
  const short = Boolean(draft) && app.balanceCents < cents;
  const days = draft ? PLAN_DAYS[draft.plan] : 0;
  const until = draft
    ? stackedUntil(draft.kind === "desk" ? app.planUntil : app.apiPlanUntil, days)
    : null;

  return (
    <>
      <div className="card sub-plans" id="subscription-plans">
        <div className="sub-plans__head">
          <h2>Subscriptions</h2>
          <p className="sub-plans__desc">Desk plan unlocks website search. API plan is required for seller keys.</p>
        </div>
        <p className="panel-card__desc" style={{ marginBottom: 16 }}>
          Desk {app.deskActive ? remainLabel(app.planUntil) : "inactive"} · API{" "}
          {app.apiActive ? remainLabel(app.apiPlanUntil) : "inactive"}
        </p>
        <div className="sub-plans__grid">
          {SUBSCRIPTION_PLANS.map((plan, i) => (
            <button
              key={plan.id}
              type="button"
              className="sub-plan-card"
              onClick={(e) => open("desk", plan.id, plan.label, app.pricing.desk[plan.id], e)}
            >
              <div className="sub-plan-card__body">
                <div className="sub-plan-card__label">{plan.label}</div>
                <div className="sub-plan-card__price">
                  <CountDollars amount={app.pricing.desk[plan.id]} delay={i * 55} />
                </div>
              </div>
              <div className="sub-plan-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
        <div className="sub-plans__divider">
          <span className="sub-plans__divider-label">API Access</span>
          <span className="sub-plans__divider-hint">Required for Search over the API · 2x desk price</span>
        </div>
        <div className="sub-plans__grid">
          {API_SUBSCRIPTION_PLANS.map((plan, i) => (
            <button
              key={plan.id}
              type="button"
              className="sub-plan-card sub-plan-card--api"
              onClick={(e) => open("api", plan.id, `API · ${plan.label}`, app.pricing.api[plan.id], e)}
            >
              <div className="sub-plan-card__body">
                <div className="sub-plan-card__label">API · {plan.label}</div>
                <div className="sub-plan-card__price">
                  <CountDollars amount={app.pricing.api[plan.id]} delay={(i + 3) * 55} />
                </div>
              </div>
              <div className="sub-plan-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Modal open={Boolean(draft)} onClose={() => !busy && setDraft(null)} origin={origin}>
        {draft ? (
          <div className="sub-confirm">
            <span className="sub-confirm__icon" aria-hidden="true">
              <CreditCard size={18} />
            </span>
            <h3>Are you sure?</h3>
            <p>
              Charge <strong>{formatUsd(cents)}</strong> for <strong>{draft.label}</strong>. Time stacks on any
              plan you already have.
            </p>
            <div className="sub-confirm__bill">
              <span>
                Adds
                <strong>
                  {days} {days === 1 ? "day" : "days"}
                </strong>
              </span>
              <span>
                Then
                <strong>{remainLabel(until)}</strong>
              </span>
            </div>
            {short ? <p className="auth__error">Not enough balance. Top up first.</p> : null}
            <div className="set-wipe__actions">
              <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </button>
              {short ? (
                <Link to="/topup" className="panel-btn panel-btn--primary">
                  Top up
                </Link>
              ) : (
                <button
                  type="button"
                  className="panel-btn panel-btn--primary"
                  onClick={() => void confirm()}
                  disabled={busy}
                >
                  {busy ? "Charging…" : "Confirm"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
