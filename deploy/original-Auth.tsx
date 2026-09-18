import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button, Field, Input } from "@/components/ui";
import { useApp } from "@/lib/store";

function AuthCard({
  mode,
}: {
  mode: "login" | "register" | "reset";
}) {
  const app = useApp();
  const nav = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (app.user) return <Navigate to="/catalog" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "reset") {
        await new Promise((r) => setTimeout(r, 700));
        nav("/");
        app.showToast("Password updated");
        return;
      }
      if (mode === "register") await app.register(login, password);
      else await app.login(login, password);
      nav("/catalog");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went quiet. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const copy = {
    login: {
      kicker: "Private catalog",
      title: "Return to the desk.",
      submit: "Enter",
      alt: "Need a seat?",
      altTo: "/register",
      altLink: "Request access",
    },
    register: {
      kicker: "By invitation",
      title: "Take a quiet seat.",
      submit: "Create account",
      alt: "Already inside?",
      altTo: "/",
      altLink: "Sign in",
    },
    reset: {
      kicker: "Recovery",
      title: "A new key.",
      submit: "Update password",
      alt: "Back to the door",
      altTo: "/",
      altLink: "Sign in",
    },
  }[mode];

  return (
    <div className="auth">
      <div className="auth__card">
        <Logo large />
        <p className="auth__kicker">{copy.kicker}</p>
        <h1 className="auth__title">{copy.title}</h1>
        <form onSubmit={(e) => void onSubmit(e)}>
          <Field label="Name">
            <Input
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </Field>
          <Field label={mode === "reset" ? "New password" : "Password"}>
            <Input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </Field>
          {error ? <p className="auth__error">{error}</p> : null}
          <Button type="submit" loading={loading}>
            {copy.submit}
          </Button>
        </form>
        <p className="auth__alt">
          {copy.alt} <Link to={copy.altTo}>{copy.altLink}</Link>
          {mode === "login" ? (
            <>
              {" · "}
              <Link to="/reset-password">Forgot</Link>
            </>
          ) : null}
        </p>
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
export function ResetPage() {
  return <AuthCard mode="reset" />;
}
