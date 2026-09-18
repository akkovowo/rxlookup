import { FormEvent, useState } from "react";
import {
  FormGroup,
  IconCalendar,
  IconCity,
  IconPin,
  IconShield,
  IconUser,
  IconUsers,
  IconWallet,
  IconZip,
  InputWrap,
  LoadingOverlay,
  TextInput,
} from "@/components/FormParts";
import { CS_COST } from "@/lib/mock";
import { apiPost, ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";

export function CsPage() {
  const app = useApp();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const key of ["first_name", "last_name", "city", "state", "zipcode", "dob", "ssn"]) {
      const v = String(fd.get(key) || "").trim();
      if (v) payload[key] = v;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ score: number }>("/v1/credit", payload);
      setScore(data.score);
      setModalOpen(true);
      await app.refreshMe();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Credit check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
        <div className="card panel-search-card cs-form-card">
          <div className="panel-card__head">
            <h2>Credit Score Check</h2>
            <p className="panel-card__desc">
              Enter person details to retrieve a bureau credit score. Results typically arrive in 5–10 seconds.
            </p>
          </div>
          <form className="panel-search-form cs-search-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="panel-form-row">
              <FormGroup label="First Name" htmlFor="csFirstName">
                <InputWrap icon={IconUser}>
                  <TextInput id="csFirstName" name="first_name" placeholder="John" required autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="Last Name" htmlFor="csLastName">
                <InputWrap icon={IconUsers}>
                  <TextInput id="csLastName" name="last_name" placeholder="Smith" required autoComplete="off" />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-form-row panel-form-row--triple">
              <FormGroup label="City" htmlFor="csCity">
                <InputWrap icon={IconCity}>
                  <TextInput id="csCity" name="city" placeholder="Los Angeles" required autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="State" htmlFor="csState">
                <InputWrap icon={IconPin}>
                  <TextInput
                    id="csState"
                    name="state"
                    placeholder="CA"
                    maxLength={2}
                    style={{ textTransform: "uppercase" }}
                    required
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
              <FormGroup label="ZIP Code" htmlFor="csZip">
                <InputWrap icon={IconZip}>
                  <TextInput id="csZip" name="zipcode" placeholder="90001" maxLength={5} className="mono" required autoComplete="off" />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-form-row panel-form-row--compact">
              <FormGroup label="DOB" htmlFor="csDob" optional="(optional)">
                <InputWrap icon={IconCalendar}>
                  <TextInput id="csDob" name="dob" placeholder="MM/DD/YYYY" maxLength={10} autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="SSN" htmlFor="csSsn" optional="(optional)">
                <InputWrap icon={IconShield}>
                  <TextInput id="csSsn" name="ssn" placeholder="123456789" maxLength={11} className="mono" autoComplete="off" />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-tip" role="note">
              <div className="panel-tip__icon" aria-hidden="true">
                {IconWallet}
              </div>
              <p className="panel-tip__text">
                <strong>${CS_COST.toFixed(2)} per check</strong> · Charged only when a score is found · Add{" "}
                <strong>DOB</strong> and <strong>SSN</strong> for better match accuracy.
              </p>
            </div>
            {error ? <p className="auth__error">{error}</p> : null}
            <div className="panel-form-actions">
              <button type="reset" className="panel-btn panel-btn--ghost">
                Clear
              </button>
              <button type="submit" className="panel-btn panel-btn--primary cs-submit-btn">
                <span className="cs-submit-btn__text">Check Credit Score</span>
                <span className="cs-submit-btn__price">${CS_COST.toFixed(2)}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="card cs-features-card">
          <div className="cs-features">
            <div className="cs-feature">
              <div className="cs-feature__icon" aria-hidden="true">
                {IconShield}
              </div>
              <div>
                <h4>Secure process</h4>
                <p>Encrypted connection to the credit bureau pipeline.</p>
              </div>
            </div>
            <div className="cs-feature">
              <div className="cs-feature__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <div>
                <h4>Fast results</h4>
                <p>Automated form fill — usually 5–10 seconds.</p>
              </div>
            </div>
            <div className="cs-feature">
              <div className="cs-feature__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <h4>Pay on success</h4>
                <p>Balance is deducted only when a valid score is returned.</p>
              </div>
            </div>
          </div>
        </div>

      <LoadingOverlay active={loading} title="Checking credit score" sub="Please wait…" />

      <div className={`panel-modal cs-result-modal${modalOpen ? " is-open" : ""}`} aria-hidden={!modalOpen}>
        <div className="panel-modal__dialog cs-result-dialog">
          <div id="csResultBody">
            <h3>Credit score found</h3>
            <p className="panel-card__desc">Charged only when a score is returned.</p>
            <div className="cs-score cs-score--good">{score ?? "—"}</div>
            <div className="panel-modal__actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
