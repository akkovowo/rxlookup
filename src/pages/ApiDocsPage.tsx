import { useEffect, useState } from "react";
import { API_BASE, ENDPOINTS, ERRORS, NAV } from "@/lib/apiDocs";
import { CodeBlock, ExampleTabs } from "@/components/CodeBlock";
import { cx } from "@/lib/format";

export function ApiDocsPage() {
  const [active, setActive] = useState(() => window.location.hash.slice(1) || "intro");

  useEffect(() => {
    const ids = NAV.map((n) => n.id);

    function sync() {
      const mark = 120;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= mark) current = id;
      }
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 64) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="docs">
      <aside className="docs-nav" aria-label="On this page">
        <p className="docs-nav__kicker">Reference</p>
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cx(active === item.id && "is-on")}
            onClick={(e) => {
              e.preventDefault();
              go(item.id);
            }}
          >
            {item.label}
          </a>
        ))}
      </aside>

      <article className="docs-body">
        <section className="docs-hero" id="intro">
          <h1>API reference</h1>
          <p className="docs-lead">
            Issue a key, call the endpoints, spend only on hits. Base URL is the live desk host. Mint keys in the API cabinet.
          </p>
          <div className="docs-pills">
            <span>
              Base <code>{API_BASE}</code>
            </span>
            <span>JSON in, JSON out</span>
            <span>Live JSON</span>
          </div>
        </section>

        <section id="auth">
          <h2>Authentication</h2>
          <p>
            Every request sends the secret as a Bearer token. Keys are minted in the cabinet and shown once. Live keys
            start with <code>rx_live_</code>, test keys with <code>rx_test_</code>.
          </p>
          <CodeBlock code={`Authorization: Bearer rx_live_••••`} label="Header" />
          <div className="docs-callout">
            Keep the secret on your server. Browser calls expose the key and will be rejected later.
          </div>
        </section>

        {ENDPOINTS.map((ep) => (
          <section key={ep.id} id={ep.id} className="docs-ep">
            <div className="docs-ep__head">
              <h2>{ep.title}</h2>
              <div className="docs-ep__route">
                <span className={cx("docs-method", `docs-method--${ep.method.toLowerCase()}`)}>{ep.method}</span>
                <code>
                  {API_BASE}
                  {ep.path}
                </code>
              </div>
              <p>{ep.summary}</p>
              <em>{ep.auth}</em>
            </div>

            <h3>Parameters</h3>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Need</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ep.params.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <code>{p.name}</code>
                      </td>
                      <td>{p.type}</td>
                      <td>{p.required ? "Required" : "Optional"}</td>
                      <td>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Request</h3>
            <ExampleTabs {...ep.example} />

            <h3>Response</h3>
            <CodeBlock code={ep.response} label="200 JSON" />

            <div className="docs-status">
              {ep.status.map((s) => (
                <span key={s.code}>
                  <b>{s.code}</b>
                  {s.note}
                </span>
              ))}
            </div>
          </section>
        ))}

        <section id="errors">
          <h2>Errors</h2>
          <p>Failures share one envelope. <code>charged</code> is always <code>0</code> on an error.</p>
          <CodeBlock
            code={`{
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid API key"
  },
  "charged": 0
}`}
            label="Error envelope"
          />
          <div className="docs-err-grid">
            {ERRORS.map((e) => (
              <div key={e.code} className="docs-err">
                <b>{e.code}</b>
                <strong>{e.title}</strong>
                <p>{e.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="limits" className="docs-limits">
          <h2>Limits</h2>
          <ul className="docs-list">
            <li>120 requests / minute per key. Burst of 20.</li>
            <li>Search needs an active Search API plan (live keys). Test keys skip billing.</li>
            <li>SSN+DOB is $2.50 on a hit. Credit is $1.00 on a score.</li>
            <li>Test keys return seed records and never debit the wallet.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
