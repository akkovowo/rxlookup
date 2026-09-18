import { FormEvent, useState } from "react";
import {
  FormGroup,
  IconCalendar,
  IconCity,
  IconInfo,
  IconPin,
  IconSearch,
  IconShield,
  IconUser,
  IconUsers,
  IconZip,
  InputWrap,
  TextInput,
} from "@/components/FormParts";
import { TableSkeleton } from "@/components/ui";
import { apiPost, ApiError } from "@/lib/api";
import type { PanelResult } from "@/lib/mock";
import { useApp } from "@/lib/store";

type FormState = {
  first_name: string;
  last_name: string;
  dob: string;
  ssn: string;
  city: string;
  state: string;
  zip_code: string;
};

const EMPTY: FormState = {
  first_name: "",
  last_name: "",
  dob: "",
  ssn: "",
  city: "",
  state: "",
  zip_code: "",
};

export function PanelPage() {
  const app = useApp();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PanelResult[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState("");

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hasValue = Object.values(form).some((v) => v.trim());
    if (!hasValue) return;
    setLoading(true);
    setError("");
    const start = performance.now();
    try {
      const q = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const data = await apiPost<{ results: PanelResult[] }>("/v1/search", q);
      setResults(data.results || []);
      await app.refreshMe();
    } catch (err) {
      setResults([]);
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setElapsedMs(Math.round(performance.now() - start));
      setSearched(true);
      setLoading(false);
    }
  }

  function onClear() {
    setForm(EMPTY);
    setSearched(false);
    setResults([]);
    setElapsedMs(null);
    setError("");
  }

  return (
    <>
        <div className="card panel-search-card">
          <div className="panel-card__head">
            <h2>People Search</h2>
            <p className="panel-card__desc">Search through the database using any combination of fields below.</p>
          </div>
          <form className="panel-search-form search-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="panel-form-row">
              <FormGroup label="First Name" htmlFor="first_name">
                <InputWrap icon={IconUser}>
                  <TextInput
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    placeholder="Enter first name"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
              <FormGroup label="Last Name" htmlFor="last_name">
                <InputWrap icon={IconUsers}>
                  <TextInput
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                    placeholder="Enter last name"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-form-row panel-form-row--compact">
              <FormGroup label="DOB" htmlFor="dob">
                <InputWrap icon={IconCalendar}>
                  <TextInput
                    id="dob"
                    value={form.dob}
                    onChange={(e) => setField("dob", e.target.value)}
                    placeholder="YYYY"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
              <FormGroup label="SSN" htmlFor="ssn">
                <InputWrap icon={IconShield}>
                  <TextInput
                    id="ssn"
                    className="mono"
                    value={form.ssn}
                    onChange={(e) => setField("ssn", e.target.value)}
                    placeholder="123456789"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-form-row panel-form-row--triple">
              <FormGroup label="City" htmlFor="city">
                <InputWrap icon={IconCity}>
                  <TextInput
                    id="city"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="Enter city"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
              <FormGroup label="State" htmlFor="state">
                <InputWrap icon={IconPin}>
                  <TextInput
                    id="state"
                    value={form.state}
                    onChange={(e) => setField("state", e.target.value.toUpperCase())}
                    placeholder="CA"
                    maxLength={2}
                    style={{ textTransform: "uppercase" }}
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
              <FormGroup label="Zip Code" htmlFor="zip_code">
                <InputWrap icon={IconZip}>
                  <TextInput
                    id="zip_code"
                    value={form.zip_code}
                    onChange={(e) => setField("zip_code", e.target.value)}
                    placeholder="Enter zip"
                    autoComplete="off"
                  />
                </InputWrap>
              </FormGroup>
            </div>
            <div className="panel-tip" role="note">
              <div className="panel-tip__icon" aria-hidden="true">
                {IconInfo}
              </div>
              <p className="panel-tip__text">
                Enter <strong>First Name</strong>, <strong>Last Name</strong> and <strong>DOB</strong> or{" "}
                <strong>State</strong> or <strong>SSN</strong> for best results.
              </p>
            </div>
            {error ? <p className="auth__error">{error}</p> : null}
            <div className="panel-form-actions">
              <button type="button" className="panel-btn panel-btn--ghost" onClick={onClear}>
                Clear
              </button>
              <button type="submit" className="panel-btn panel-btn--primary">
                Search
              </button>
            </div>
          </form>
        </div>

        <div className="card panel-results-card">
          {loading ? (
            <>
              <div className="panel-results-card__head">
                <div>
                  <h3>Search Results</h3>
                  <p className="panel-card__desc">Querying the people database…</p>
                </div>
              </div>
              <TableSkeleton rows={7} cols={8} />
            </>
          ) : searched ? (
            <>
              <div className="panel-results-card__head">
                <div>
                  <h3>Search Results</h3>
                  <p className="panel-card__desc">Matches from the people database</p>
                </div>
                <div className="panel-results-meta">
                  <span className="panel-results-pill">
                    Found <strong>{results.length}</strong> results
                  </span>
                  {elapsedMs != null ? (
                    <span className="panel-results-pill panel-results-pill--time">{elapsedMs} ms</span>
                  ) : null}
                </div>
              </div>
              <div className={`panel-results__body${loading ? " is-loading" : ""}`}>
                {results.length ? (
                  <div className="table-wrap panel-table-wrap">
                    <table className="results-table panel-results-table">
                      <thead>
                        <tr>
                          <th>First Name</th>
                          <th>Middle</th>
                          <th>Last Name</th>
                          <th>Address</th>
                          <th>City</th>
                          <th>State</th>
                          <th>Zip</th>
                          <th>DOB</th>
                          <th>Other DOB</th>
                          <th>SSN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((item, i) => (
                          <tr key={i}>
                            <td className="name">{item.first_name || "-"}</td>
                            <td>{item.middle_name || "-"}</td>
                            <td className="name">{item.last_name || "-"}</td>
                            <td>{item.address || "-"}</td>
                            <td>{item.city || "-"}</td>
                            <td>{item.state || "-"}</td>
                            <td>{item.zip_code || "-"}</td>
                            <td>{item.dob || "-"}</td>
                            <td>{item.altdob || "-"}</td>
                            <td className="mono">{item.ssn || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="panel-empty">
                    <div className="panel-empty__icon" aria-hidden="true">
                      {IconSearch}
                    </div>
                    <h3>No results found</h3>
                    <p>Try adjusting your search criteria or adding more fields.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="panel-results-card__head">
                <div>
                  <h3>Search Results</h3>
                  <p className="panel-card__desc">Your matches will appear here after you run a search</p>
                </div>
              </div>
              <div className="panel-results__body">
                <div className="panel-empty">
                  <div className="panel-empty__icon" aria-hidden="true">
                    {IconSearch}
                  </div>
                  <h3>No search results yet</h3>
                  <p>Fill in the fields above and press Search to query the database.</p>
                </div>
              </div>
            </>
          )}
        </div>
    </>
  );
}
