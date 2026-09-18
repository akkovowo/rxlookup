import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clock,
  Copy,
  Handshake,
  Info,
  KeyRound,
  RefreshCw,
  ShoppingBag,
  Shield,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/store";

const LAST_ACTIVE = "rx.lastActive";
const WELCOME_AT = "rx.welcomeAt";
const HIDDEN_MS = 15_000;
const AWAY_MS = 3 * 60_000;
const COOLDOWN_MS = 12_000;

function toastIcon(text: string, icon?: string) {
  const kind = icon ?? inferIcon(text);
  const props = { size: 15, strokeWidth: 1.75 };
  switch (kind) {
    case "welcome":
      return <Handshake {...props} />;
    case "copy":
      return <Copy {...props} />;
    case "deposit":
      return <Wallet {...props} />;
    case "key":
      return <KeyRound {...props} />;
    case "refresh":
      return <RefreshCw {...props} />;
    case "soon":
      return <Clock {...props} />;
    case "cart":
      return <ShoppingBag {...props} />;
    case "escrow":
      return <Shield {...props} />;
    case "saved":
      return <Check {...props} />;
    default:
      return <Info {...props} />;
  }
}

function inferIcon(text: string) {
  const t = text.toLowerCase();
  if (t.startsWith("welcome")) return "welcome";
  if (t.includes("copied")) return "copy";
  if (t.includes("deposit") || t.includes("balance")) return "deposit";
  if (t.includes("password")) return "key";
  if (t.includes("regenerate")) return "refresh";
  if (t.includes("coming soon") || t.includes("demo:")) return "soon";
  if (t.includes("tray") || t.includes("cart")) return "cart";
  if (t.includes("escrow")) return "escrow";
  if (t.includes("saved") || t.includes("updated")) return "saved";
  return "info";
}

function markActive() {
  try {
    localStorage.setItem(LAST_ACTIVE, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function WelcomeWatcher() {
  const app = useApp();
  const hiddenAt = useRef<number | null>(null);
  const userRef = useRef(app.user);
  const greetRef = useRef(app.showToast);

  userRef.current = app.user;
  greetRef.current = app.showToast;

  useEffect(() => {
    function greet(nick: string) {
      try {
        const last = Number(sessionStorage.getItem(WELCOME_AT) || 0);
        if (Date.now() - last < COOLDOWN_MS) return;
        sessionStorage.setItem(WELCOME_AT, String(Date.now()));
      } catch {
        /* ignore */
      }
      greetRef.current(`Welcome back, ${nick}`, "welcome");
    }

    const user = userRef.current;
    if (user) {
      try {
        const last = Number(localStorage.getItem(LAST_ACTIVE) || 0);
        if (last && Date.now() - last >= AWAY_MS) greet(user.login);
      } catch {
        /* ignore */
      }
    }
    markActive();

    function onVisibility() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        markActive();
        return;
      }
      const nick = userRef.current?.login;
      const started = hiddenAt.current;
      hiddenAt.current = null;
      markActive();
      if (!nick || started == null) return;
      if (Date.now() - started >= HIDDEN_MS) greet(nick);
    }

    function onFocus() {
      const nick = userRef.current?.login;
      if (!nick || document.hidden) return;
      try {
        const last = Number(localStorage.getItem(LAST_ACTIVE) || 0);
        if (last && Date.now() - last >= AWAY_MS) greet(nick);
      } catch {
        /* ignore */
      }
      markActive();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", markActive);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", markActive);
      markActive();
    };
  }, []);

  return null;
}

export function Toast() {
  const app = useApp();
  const toast = app.toast;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          className="app-toast"
          initial={{ x: "-50%", y: -24, opacity: 0 }}
          animate={{ x: "-50%", y: 0, opacity: 1 }}
          exit={{ x: "-50%", y: -16, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="status"
        >
          <span className="app-toast__icon" aria-hidden="true">
            {toastIcon(toast.text, toast.icon)}
          </span>
          <span className="app-toast__text">{toast.text}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function ToastHost() {
  return (
    <>
      <WelcomeWatcher />
      <Toast />
    </>
  );
}
