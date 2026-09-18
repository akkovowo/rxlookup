import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FormGroup,
  IconCalendar,
  IconCity,
  IconHome,
  IconPhone,
  IconPin,
  IconShield,
  IconUser,
  IconUsers,
  IconZip,
  InputWrap,
  TextInput,
} from "@/components/FormParts";
import { CardSkeleton } from "@/components/ui";
import { SSNDOB_COST, type SsndobResult } from "@/lib/mock";
import { apiGet, apiPost, ApiError, type LookupItem } from "@/lib/api";
import { useApp } from "@/lib/store";

export function SsndobPage() {
  const app = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<SsndobResult | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const key of ["first_name", "last_name", "zip_code", "city", "state", "phone", "dob", "address"]) {
      const v = String(fd.get(key) || "").trim();
      if (v) payload[key] = v;
    }
    const hasName = Boolean(payload.first_name && payload.last_name);
    const hasPhone = (payload.phone || "").replace(/\D/g, "").length >= 10;
    if (!hasName && !hasPhone) {
      setError("Enter first and last name, or a valid phone number.");
      return;
    }
    setError("");
    setLoading(true);
    setShowResults(false);
    try {
      const data = await apiPost<{ result: SsndobResult }>("/v1/ssndob", payload);
      setResult(data.result);
      setShowResults(true);
      await app.refreshMe();
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
        <div className="card panel-search-card ssndob-form-card">
          <div className="panel-card__head ssndob-form-card__head">
            <div>
              <h2>SSN+DOB Lookup</h2>
              <p className="panel-card__desc">
                Search for SSN and DOB using name and location, or look up by phone number.
              </p>
            </div>
            <Link to="/ssndob/history" className="ssndob-history-link">
              View History
            </Link>
          </div>
          <form
            className="panel-search-form ssndob-search-form"
            onSubmit={(e) => void onSubmit(e)}
            onReset={() => {
              setError("");
              setShowResults(false);
            }}
          >
            <div className="panel-form-row">
              <FormGroup label="First Name" htmlFor="firstName">
                <InputWrap icon={IconUser}>
                  <TextInput id="firstName" name="first_name" placeholder="John" autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="Last Name" htmlFor="lastName">
                <InputWrap icon={IconUsers}>
                  <TextInput id="lastName" name="last_name" placeholder="Smith" autoComplete="off" />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-form-row panel-form-row--compact">
              <FormGroup label="ZIP Code" htmlFor="zipCode">
                <InputWrap icon={IconZip}>
                  <TextInput id="zipCode" name="zip_code" placeholder="90001" maxLength={5} className="mono" autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="DOB" htmlFor="dob" optional="(optional)">
                <InputWrap icon={IconCalendar}>
                  <TextInput id="dob" name="dob" placeholder="MM/DD/YYYY" autoComplete="off" />
                </InputWrap>
              </FormGroup>
            </div>
            <FormGroup label="Phone" htmlFor="phone" optional="(or name search)">
              <InputWrap icon={IconPhone}>
                <TextInput id="phone" name="phone" placeholder="(212) 555-1234" maxLength={20} autoComplete="off" />
              </InputWrap>
            </FormGroup>
            <FormGroup label="Street Address" htmlFor="address" optional="(optional)">
              <InputWrap icon={IconHome}>
                <TextInput id="address" name="address" placeholder="123 Main St" autoComplete="off" />
              </InputWrap>
            </FormGroup>
            <div className="panel-form-row panel-form-row--compact">
              <FormGroup label="City" htmlFor="city">
                <InputWrap icon={IconCity}>
                  <TextInput id="city" name="city" placeholder="Los Angeles" autoComplete="off" />
                </InputWrap>
              </FormGroup>
              <FormGroup label="State" htmlFor="state">
                <InputWrap icon={IconPin}>
                  <TextInput
                    id="state"
                    name="state"
                    placeholder="CA"
                    maxLength={2}
                    style={{ textTransform: "uppercase" }}
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-tip" role="note">
              <div className="panel-tip__icon" aria-hidden="true">
                {IconShield}
              </div>
              <p className="panel-tip__text">
                <strong>${SSNDOB_COST.toFixed(2)} per lookup</strong> when results are found · Use{" "}
                <strong>First + Last Name</strong> or a <strong>10-digit phone</strong> · More fields improve accuracy.
              </p>
            </div>
            <div className="panel-form-actions">
              <button type="reset" className="panel-btn panel-btn--ghost">
                Clear
              </button>
              <button type="submit" className="panel-btn panel-btn--primary cs-submit-btn">
                <span className="cs-submit-btn__text">Lookup</span>
                <span className="cs-submit-btn__price">${SSNDOB_COST.toFixed(2)}</span>
              </button>
            </div>
          </form>
        </div>

        {error ? (
          <div className="notice notice_error" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="card panel-results-card ssndob-results-card">
            <div className="panel-results-card__head">
              <div>
                <h3>Search Results</h3>
                <p className="panel-card__desc">Looking up SSN and DOB…</p>
              </div>
            </div>
            <CardSkeleton />
          </div>
        ) : showResults && result ? (
          <div className="card panel-results-card ssndob-results-card">
            <div className="panel-results-card__head">
              <div>
                <h3>Search Results</h3>
                <p className="panel-card__desc">Matches from the SSN+DOB database</p>
              </div>
              <div className="panel-results-meta">
                <span className="panel-results-pill">
                  Found <strong>1</strong> result
                </span>
              </div>
            </div>
            <div className="panel-results__body">
              <div className="ssndob-results-list">
                <article className="ssndob-result-card">
                  <div className="ssndob-result-card__head">
                    <h4>{result.name}</h4>
                    <span className="ssndob-result-pill ssndob-result-pill--ok">Match</span>
                  </div>
                  <div className="ssndob-result-grid">
                    <div className="ssndob-result-field">
                      <span className="ssndob-result-label">SSN</span>
                      <span className="ssndob-result-value mono">{result.ssn}</span>
                    </div>
                    <div className="ssndob-result-field">
                      <span className="ssndob-result-label">DOB</span>
                      <span className="ssndob-result-value">{result.dob}</span>
                    </div>
                    <div className="ssndob-result-field">
                      <span className="ssndob-result-label">Phones</span>
                      <span className="ssndob-result-value">{result.phones.join(", ")}</span>
                    </div>
                    <div className="ssndob-result-field">
                      <span className="ssndob-result-label">Emails</span>
                      <span className="ssndob-result-value">{result.emails.join(", ")}</span>
                    </div>
                  </div>
                  <div className="ssndob-result-block">
                    <h5>AKAs</h5>
                    <p>{result.akas.join(", ")}</p>
                  </div>
                  <div className="ssndob-result-block">
                    <h5>Addresses</h5>
                    <p>{result.addresses.join("; ")}</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}

export function SsndobHistoryPage() {
  const [rows, setRows] = useState<LookupItem[]>([]);

  useEffect(() => {
    void apiGet<{ items: LookupItem[] }>("/v1/lookups")
      .then((data) => setRows((data.items || []).filter((r) => r.kind === "ssndob")))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
        <div className="card panel-search-card">
          <div className="panel-card__head">
            <h2>SSN+DOB History</h2>
            <p className="panel-card__desc">Recent lookups on your account.</p>
          </div>
          <div className="table-wrap panel-table-wrap">
            <table className="results-table panel-results-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Results</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="name">{row.query}</td>
                      <td>{row.hits}</td>
                      <td>{row.at}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No lookups yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
