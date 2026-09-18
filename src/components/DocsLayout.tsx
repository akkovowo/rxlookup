import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Moon, Sun } from "lucide-react";
import { API_BASE, APP_ORIGIN, DOCS_HOST } from "@/lib/apiDocs";
import { useApp } from "@/lib/store";
import { useTheme } from "@/lib/theme";

function isDocsHost() {
  return window.location.hostname.startsWith("docs.");
}

export function DocsLayout({ children }: { children: ReactNode }) {
  const app = useApp();
  const { theme, toggle } = useTheme();
  const cabinetHref = isDocsHost() ? `${APP_ORIGIN}/api` : app.user ? "/api" : "/login";

  return (
    <div className="docs-shell">
      <header className="docs-top">
        <Link to="/docs" className="docs-brand" aria-label={DOCS_HOST}>
          <em>rx</em>
          <span>Lookup</span>
          <i>{DOCS_HOST}</i>
        </Link>
        <div className="docs-top__actions">
          <span className="docs-base" title="Placeholder until the live API is connected">
            {API_BASE}
          </span>
          <button
            type="button"
            className="icon-btn theme-toggle"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggle}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                className="theme-toggle__icon"
                initial={{ rotate: -80, scale: 0.45, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 80, scale: 0.45, opacity: 0 }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
          {isDocsHost() ? (
            <a href={cabinetHref} className="panel-btn panel-btn--primary docs-top__go">
              <KeyRound size={15} />
              API keys
            </a>
          ) : (
            <Link to={cabinetHref} className="panel-btn panel-btn--primary docs-top__go">
              <KeyRound size={15} />
              API keys
            </Link>
          )}
        </div>
      </header>
      {children}
      <footer className="site-footer docs-footer">
        <Link to="/docs" className="site-footer__mark" aria-label="RX Lookup">
          <em>rx</em>
          <span>Lookup</span>
        </Link>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link to="/docs">Docs</Link>
          {isDocsHost() ? (
            <a href={`${APP_ORIGIN}/api`}>API</a>
          ) : (
            <Link to="/api">API</Link>
          )}
          {isDocsHost() ? (
            <a href={`${APP_ORIGIN}/help`}>Help</a>
          ) : (
            <Link to="/help">Help</Link>
          )}
        </nav>
        <span className="site-footer__copy">Pre-release build</span>
      </footer>
    </div>
  );
}
