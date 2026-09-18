import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Ban, BookOpen, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { CopyField } from "@/components/CopyField";
import { Modal } from "@/components/Modal";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { ApiEnv, ApiKey, ApiScope } from "@/lib/apiKeys";
import { copyText } from "@/lib/copy";
import { useApp } from "@/lib/store";
import { cx } from "@/lib/format";

const QUOTA = 100_000;
const SCOPE_LABEL: Record<ApiScope, string> = {
  search: "Search",
  ssndob: "SSN+DOB",
  cs: "Credit",
};

type ApiModal = "create" | "secret" | "rename" | "revoke" | null;

export function ApiCabinetPage() {
  const app = useApp();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "revoked">("all");
  const [modal, setModal] = useState<ApiModal>(null);
  const [draftName, setDraftName] = useState("New integration");
  const [draftEnv, setDraftEnv] = useState<ApiEnv>("live");
  const [draftScopes, setDraftScopes] = useState<ApiScope[]>(["search", "ssndob", "cs"]);
  const [freshSecret, setFreshSecret] = useState("");
  const [target, setTarget] = useState<ApiKey | null>(null);
  const [rename, setRename] = useState("");

  async function reload() {
    const data = await apiGet<{ keys: ApiKey[] }>("/v1/keys");
    setKeys(data.keys || []);
  }

  useEffect(() => {
    void reload().catch(() => setKeys([]));
  }, []);

  const visible = keys.filter((k) => (filter === "all" ? true : k.status === filter));
  const active = keys.filter((k) => k.status === "active");
  const requests = keys.reduce((n, k) => n + k.requests, 0);

  const usagePct = useMemo(() => Math.min(100, Math.round((requests / QUOTA) * 100)), [requests]);

  function toggleScope(scope: ApiScope) {
    setDraftScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function openCreate() {
    setDraftName("New integration");
    setDraftEnv("live");
    setDraftScopes(["search", "ssndob", "cs"]);
    setModal("create");
  }

  async function createKey() {
    const name = draftName.trim() || "Untitled key";
    const minted = await apiPost<{
      id: string;
      secret: string;
      prefix: string;
      last4: string;
      env: ApiEnv;
      scopes: ApiScope[];
      createdAt: string;
    }>("/v1/keys", { name, env: draftEnv, scopes: draftScopes.length ? draftScopes : ["search", "ssndob", "cs"] });
    setFreshSecret(minted.secret);
    setTarget({
      id: minted.id,
      name,
      prefix: minted.prefix,
      last4: minted.last4,
      createdAt: minted.createdAt,
      lastUsed: "Never",
      requests: 0,
      status: "active",
      scopes: minted.scopes,
      env: minted.env,
    });
    await reload();
    setModal("secret");
    app.showToast("API key created", "key");
  }

  async function copy(text: string, label = "API key copied") {
    const ok = await copyText(text);
    app.showToast(ok ? label : "Could not copy", ok ? "copy" : undefined);
  }

  async function saveRename() {
    if (!target) return;
    const name = rename.trim();
    if (!name) return;
    await apiPost(`/v1/keys/${target.id}/rename`, { name });
    await reload();
    setModal(null);
    app.showToast("Key renamed", "saved");
  }

  async function revoke() {
    if (!target) return;
    await apiPost(`/v1/keys/${target.id}/revoke`);
    await reload();
    setModal(null);
    app.showToast("Key revoked", "key");
  }

  async function remove(id: string) {
    await apiDelete(`/v1/keys/${id}`);
    await reload();
    app.showToast("Key removed");
  }

  return (
    <>
      <div className="api-hero">
        <div>
          <h2>API</h2>
          <p className="panel-card__desc">Issue keys, watch usage, and keep each integration named.</p>
        </div>
        <button type="button" className="panel-btn panel-btn--primary" onClick={openCreate}>
          <Plus size={15} />
          New key
        </button>
      </div>

      <Link to="/docs" className="api-docs-cta">
        <span className="api-docs-cta__icon" aria-hidden="true">
          <BookOpen size={18} />
        </span>
        <span className="api-docs-cta__copy">
          <strong>Documentation</strong>
          <em>Auth, search, SSN+DOB, credit score — endpoints and examples.</em>
        </span>
        <span className="api-docs-cta__go">
          Open docs
          <ArrowUpRight size={16} />
        </span>
      </Link>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Active keys</div>
            <div className="stat-card__value">{active.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Requests</div>
            <div className="stat-card__value">{requests.toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Monthly quota</div>
            <div className="stat-card__value stat-card__value--sm">{usagePct}%</div>
            <div className="api-quota" aria-hidden="true">
              <i style={{ width: `${usagePct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card api-keys-card">
        <div className="api-keys-card__head">
          <div>
            <h3>Keys</h3>
            <p className="panel-card__desc">Secrets are shown once. Store them on your side.</p>
          </div>
          <div className="api-filter" role="tablist" aria-label="Key status">
            {(["all", "active", "revoked"] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={cx("api-filter__btn", filter === id && "is-on")}
                onClick={() => setFilter(id)}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="panel-empty">
            <h3>No keys here</h3>
            <p>Create a live or test key to start calling the API.</p>
          </div>
        ) : (
          <ul className="api-key-list">
            {visible.map((k) => (
              <li key={k.id} className={cx("api-key", k.status === "revoked" && "is-revoked")}>
                <div className="api-key__top">
                  <strong>{k.name}</strong>
                  <span
                    className={cx("api-dot", k.status === "revoked" && "is-off")}
                    title={k.status === "active" ? "Active" : "Revoked"}
                    aria-label={k.status === "active" ? "Active" : "Revoked"}
                    role="img"
                  />
                </div>
                <div className="api-key__secret mono">
                  {k.prefix}••••{k.last4}
                </div>
                <div className="api-key__foot">
                  <span>{k.requests.toLocaleString()} requests</span>
                  <span>Created {k.createdAt}</span>
                  <span>Last used {k.lastUsed ?? "Never"}</span>
                </div>
                <div className="api-key__toolbar">
                  <div
                    className="api-key__bar-wrap"
                    aria-label={`${k.requests.toLocaleString()} of ${QUOTA.toLocaleString()} requests · ${Math.min(100, Math.round((k.requests / QUOTA) * 100))}%`}
                  >
                    <div className="api-key__bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, (k.requests / QUOTA) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="api-key__actions">
                    <button
                      type="button"
                      className="api-icon-btn"
                      aria-label="Copy"
                      onClick={() => copy(`${k.prefix}••••${k.last4}`, "Key prefix copied")}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      className="api-icon-btn"
                      aria-label="Rename"
                      onClick={() => {
                        setTarget(k);
                        setRename(k.name);
                        setModal("rename");
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    {k.status === "active" ? (
                      <button
                        type="button"
                        className="api-icon-btn"
                        aria-label="Revoke"
                        onClick={() => {
                          setTarget(k);
                          setModal("revoke");
                        }}
                      >
                        <Ban size={15} />
                      </button>
                    ) : (
                      <button type="button" className="api-icon-btn" aria-label="Delete" onClick={() => void remove(k.id)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        <div className="topup-modal">
          {modal === "create" ? (
            <>
              <h3>New API key</h3>
              <p className="panel-card__desc">Name it for the app that will use it.</p>
              <div className="form-group" style={{ textAlign: "left", marginTop: 16 }}>
                <label htmlFor="api-key-name">Name</label>
                <div className="input-wrap">
                  <input id="api-key-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                </div>
              </div>
              <div className="api-env" role="group" aria-label="Environment">
                <button type="button" className={cx("api-filter__btn", draftEnv === "live" && "is-on")} onClick={() => setDraftEnv("live")}>
                  Live
                </button>
                <button type="button" className={cx("api-filter__btn", draftEnv === "test" && "is-on")} onClick={() => setDraftEnv("test")}>
                  Test
                </button>
              </div>
              <div className="api-scopes">
                {(Object.keys(SCOPE_LABEL) as ApiScope[]).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    className={cx("api-scope", draftScopes.includes(scope) && "is-on")}
                    onClick={() => toggleScope(scope)}
                  >
                    {SCOPE_LABEL[scope]}
                  </button>
                ))}
              </div>
              <div className="panel-modal__actions topup-modal__actions">
                <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="button" className="panel-btn panel-btn--primary" onClick={() => void createKey()}>
                  Generate
                </button>
              </div>
            </>
          ) : null}

          {modal === "secret" ? (
            <>
              <h3>Copy this now</h3>
              <p className="panel-card__desc">The full secret is shown once. We only keep a prefix after this.</p>
              <CopyField value={freshSecret} toast="API key copied" />
              <div className="panel-modal__actions">
                <button type="button" className="panel-btn panel-btn--primary" onClick={() => setModal(null)}>
                  I saved it
                </button>
              </div>
            </>
          ) : null}

          {modal === "rename" && target ? (
            <>
              <h3>Rename key</h3>
              <div className="form-group" style={{ textAlign: "left", marginTop: 16 }}>
                <label htmlFor="api-rename">Name</label>
                <div className="input-wrap">
                  <input id="api-rename" value={rename} onChange={(e) => setRename(e.target.value)} />
                </div>
              </div>
              <div className="panel-modal__actions topup-modal__actions">
                <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="button" className="panel-btn panel-btn--primary" onClick={() => void saveRename()}>
                  Save
                </button>
              </div>
            </>
          ) : null}

          {modal === "revoke" && target ? (
            <>
              <h3>Revoke key</h3>
              <p className="panel-card__desc">
                {target.name} will stop working immediately. You can delete it later.
              </p>
              <div className="panel-modal__actions topup-modal__actions">
                <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setModal(null)}>
                  Keep
                </button>
                <button type="button" className="panel-btn panel-btn--primary" onClick={() => void revoke()}>
                  Revoke
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
