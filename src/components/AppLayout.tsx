import { Outlet, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Header } from "./Header";
import { NotesDrawer } from "./Drawers";
import { cx } from "@/lib/format";

const NARROW = new Set(["/history"]);

export function AppLayout() {
  const loc = useLocation();
  const reduce = useReducedMotion();
  const narrow = NARROW.has(loc.pathname);
  const admin = loc.pathname.startsWith("/admin");
  const pageKey = admin ? "/admin" : loc.pathname;

  return (
    <div className="shell">
      <Header />
      <div className="shell__body shell__body_plain">
        <main className="shell__main">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageKey}
              className={cx("page", narrow && "page_narrow", admin && "page_wide", "page-enter")}
              initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <footer className="site-footer">
        <Link to="/" className="site-footer__mark" aria-label="RX Lookup">
          <em>rx</em>
          <span>Lookup</span>
        </Link>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link to="/faq">FAQ</Link>
          <Link to="/help">Help</Link>
          <Link to="/api">API</Link>
          <Link to="/docs">Docs</Link>
          <Link to="/subscriptions">Plans</Link>
        </nav>
        <span className="site-footer__copy">Live API</span>
      </footer>
      <NotesDrawer />
    </div>
  );
}
