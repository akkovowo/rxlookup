import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { CopyField } from "@/components/CopyField";
import { Logo } from "@/components/Logo";
import { Button, Field, Input } from "@/components/ui";
import { useApp } from "@/lib/store";
import { useTheme } from "@/lib/theme";

function AuthCard({
  mode,
}: {
  mode: "login" | "register" | "key";
}) {
  const app = useApp();
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (app.user && !secret) return <Navigate to="/" replace />;

  async function finishRegister() {
    await app.refreshMe();
    app.showToast(`Welcome, ${login}`, "welcome");
    nav("/");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "key") {
        await app.loginWithKey(key);
        nav("/");
        return;
      }
      if (mode === "register") {
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        const issued = await app.register(login, password);
        setSecret(issued);
        return;
      }
      await app.login(login, password);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went quiet. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const copy = {
    login: {
      title: "Welcome back",
      sub: "Sign in to the desk.",
      submit: "Enter",
      alt: "No account?",
      altTo: "/register",
      altLink: "Create account",
    },
    register: {
      title: "Create account",
      sub: "By invitation only.",
      submit: "Create account",
      alt: "Already inside?",
      altTo: "/login",
      altLink: "Sign in",
    },
    key: {
      title: "Secret key",
      sub: "Enter the key you saved when the account was created.",
      submit: "Enter",
      alt: "Use name and password?",
      altTo: "/login",
      altLink: "Sign in",
    },
  }[mode];

  return (
    <div className="auth">
      <button
        type="button"
        className="icon-btn theme-toggle auth__theme"
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

      <div className="auth__card">
        <Logo large />
        {secret ? (
          <>
            <h1 className="auth__title">Save this key</h1>
            <p className="auth__sub">Shown once. It signs you in without a name or password.</p>
            <CopyField value={secret} toast="Key copied" />
            <Button type="button" className="auth__go" onClick={() => void finishRegister()}>
              I saved it
            </Button>
          </>
        ) : (
          <>
            <h1 className="auth__title">{copy.title}</h1>
            <p className="auth__sub">{copy.sub}</p>
            <form onSubmit={(e) => void onSubmit(e)}>
              {mode === "key" ? (
                <Field label="Secret key">
                  <Input
                    className="mono"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value.trim())}
                    placeholder="rx_sk_…"
                    required
                  />
                </Field>
              ) : (
                <>
                  <Field label="Name">
                    <Input
                      autoComplete="username"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </Field>
                  {mode === "register" ? (
                    <Field label="Confirm password">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                      />
                    </Field>
                  ) : null}
                </>
              )}
              {error ? <p className="auth__error">{error}</p> : null}
              <Button type="submit" loading={loading} className="auth__go">
                {copy.submit}
              </Button>
            </form>
            <p className="auth__alt">
              {copy.alt} <Link to={copy.altTo}>{copy.altLink}</Link>
              {mode === "login" ? (
                <>
                  {" · "}
                  <Link to="/key">Secret key</Link>
                </>
              ) : null}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function LoginPage() {
  return <AuthCard mode="login" />;
}
export function RegisterPage() {
  return <AuthCard mode="register" />;
}
export function KeyPage() {
  return <AuthCard mode="key" />;
}
