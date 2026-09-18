import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CircleHelp,
  Code2,
  CreditCard,
  Gauge,
  History,
  House,
  IdCard,
  LifeBuoy,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HScroll } from "./HScroll";
import { Logo } from "./Logo";
import { Avatar } from "./ui";
import { CountUsd } from "@/components/CountUp";
import { cx, formatUsd, initials } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useTheme } from "@/lib/theme";

const NAV: { to: string; label: string; icon: LucideIcon; kind: string; match: (p: string) => boolean }[] = [
  { to: "/", label: "Home", icon: House, kind: "home", match: (p) => p === "/" || p === "/history" || p === "/settings" },
  { to: "/search", label: "Search", icon: Search, kind: "search", match: (p) => p.startsWith("/search") || p.startsWith("/panel") },
  { to: "/ssndob", label: "SSN+DOB", icon: IdCard, kind: "id", match: (p) => p.startsWith("/ssndob") },
  { to: "/cs", label: "CS", icon: Gauge, kind: "cs", match: (p) => p.startsWith("/cs") },
  { to: "/api", label: "API", icon: Code2, kind: "api", match: (p) => p === "/api" || p.startsWith("/api/") },
  { to: "/subscriptions", label: "Subscriptions", icon: CreditCard, kind: "subs", match: (p) => p.startsWith("/subscriptions") },
  { to: "/help", label: "Help", icon: LifeBuoy, kind: "help", match: (p) => p.startsWith("/help") },
];

export function Header() {
  const app = useApp();
  const loc = useLocation();
  const { theme, toggle } = useTheme();
  const path = loc.pathname;

  return (
    <header className="header">
      <Logo />

      <TabStrip path={path} />

      <div className="header__user">
        <div className="header__actions">
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
                initial={{ rotate: -80, scale: 0.45, opacity: 0, y: -8 }}
                animate={{ rotate: 0, scale: 1, opacity: 1, y: 0 }}
                exit={{ rotate: 80, scale: 0.45, opacity: 0, y: 8 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
          {app.user ? (
            <button
              type="button"
              className="icon-btn icon-btn_bell"
              aria-label="Notifications"
              title="Notifications"
              aria-expanded={app.notesOpen}
              onClick={() => {
                const next = !app.notesOpen;
                app.toggleNotes(next);
                if (next) app.markNotesRead();
              }}
            >
              <Bell size={17} />
              {app.unreadNotes > 0 ? <span className="icon-btn__badge">{app.unreadNotes}</span> : null}
            </button>
          ) : null}
        </div>

        {app.user ? (
          <>
            {app.user.role === "admin" ? (
              <Link to="/admin" className={cx("topup", path.startsWith("/admin") && "is-on")}>
                <Shield className="topup__mark" size={14} />
                Admin
              </Link>
            ) : null}
            <Link to="/topup" className="topup">
              <Plus className="topup__plus" size={14} />
              Top up
            </Link>
            <AccountMenu />
          </>
        ) : (
          <Link to="/login" className="topup">
            <UserRound size={14} />
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function TabStrip({ path }: { path: string }) {
  return (
    <HScroll className="header__tabs-wrap" viewClass="header__tabs">
      <nav className="header__tabs-nav" aria-label="Sections">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(path);
          return (
            <Link
              key={item.to}
              to={item.to}
              data-icon={item.kind}
              className={cx("tab", active && "tab_active")}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <motion.span
                  className="tab__pill"
                  layoutId="nav-pill"
                  transition={{ type: "spring", stiffness: 460, damping: 36 }}
                />
              ) : null}
              <Icon size={14} />
              <span className="label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </HScroll>
  );
}

function AccountMenu() {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  function show() {
    window.clearTimeout(timer.current);
    setOpen(true);
    app.toggleNotes(false);
  }

  function hideSoon() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 320);
  }

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    function onDoc(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.clearTimeout(timer.current);
    };
  }, []);

  function go(to: string) {
    setOpen(false);
    nav(to);
  }

  const nick = app.user?.login ?? "";
  const letters = initials(nick) || "?";
  const mark = app.user?.avatar;

  return (
    <div
      className={cx("account-wrap", open && "is-open")}
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        type="button"
        className={cx("account", open && "is-open")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <Avatar initials={letters} mark={mark} />
        <span className="account__meta">
          <span className="account__nick">{nick}</span>
          <span className="account__bal">
            <CountUsd cents={app.balanceCents} />
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="account-menu"
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, pointerEvents: "none" }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="account-menu__card">
              <div className="account-menu__head">
                <Avatar initials={letters} mark={mark} />
                <span>
                  <strong>{nick}</strong>
                  <span>{formatUsd(app.balanceCents)}</span>
                </span>
              </div>
              <button type="button" role="menuitem" onClick={() => go("/")}>
                <UserRound size={15} /> Profile
              </button>
              {app.user?.role === "admin" ? (
                <button type="button" role="menuitem" onClick={() => go("/admin")}>
                  <Shield size={15} /> Admin
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => go("/settings")}>
                <Settings size={15} /> Settings
              </button>
              <button type="button" role="menuitem" onClick={() => go("/topup")}>
                <Wallet size={15} /> Wallet
              </button>
              <button type="button" role="menuitem" onClick={() => go("/history")}>
                <History size={15} /> History
              </button>
              <button type="button" role="menuitem" onClick={() => go("/faq")}>
                <CircleHelp size={15} /> FAQ
              </button>
              <div className="account-menu__rule" />
              <button
                type="button"
                role="menuitem"
                className="account-menu__logout"
                onClick={() => {
                  setOpen(false);
                  app.logout();
                  nav("/login");
                }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
