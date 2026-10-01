import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Copy,
  Gift,
  KeyRound,
  Link2,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Modal, originFromEvent, type ModalOrigin } from "@/components/Modal";
import { CopyField } from "@/components/CopyField";
import { AvatarStudio } from "@/components/AvatarStudio";
import { Field, Input } from "@/components/ui";
import { copyText } from "@/lib/copy";
import { formatUsd } from "@/lib/format";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";

export function SettingsPage() {
  const app = useApp();
  const nav = useNavigate();
  const nick = app.user?.login ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://rxlookup.com";
  const refLink = `${origin}/register?ref=${encodeURIComponent(nick)}`;

  const lookups = app.lookups;
  const referrals = app.referrals;
  const earned = app.referralEarnedCents;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [telegram, setTelegram] = useState(app.telegram);
  const [tgName, setTgName] = useState(app.telegramUsername);
  const [tgOpen, setTgOpen] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgOrigin, setTgOrigin] = useState<ModalOrigin | null>(null);
  const [tgLink, setTgLink] = useState<{ code: string; bot: string; deep_link: string; tg_link: string } | null>(null);
  const [wipe, setWipe] = useState(false);
  const [freshSecret, setFreshSecret] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretOrigin, setSecretOrigin] = useState<ModalOrigin | null>(null);

  async function copyLink() {
    const ok = await copyText(refLink);
    app.showToast(ok ? "Referral link copied" : "Could not copy", ok ? "copy" : undefined);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (current.length < 4 || next.length < 8) {
      app.showToast("Use at least eight characters");
      return;
    }
    if (next !== again) {
      app.showToast("Passwords do not match");
      return;
    }
    try {
      await app.changePassword(current, next);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Could not update password");
    }
  }

  async function issueSecret(e: { currentTarget: EventTarget }) {
    setSecretOrigin(originFromEvent(e));
    setSecretBusy(true);
    try {
      const issued = await app.rotateSecret();
      setFreshSecret(issued);
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Could not issue a key");
    } finally {
      setSecretBusy(false);
    }
  }

  async function openTelegram(e: { currentTarget: EventTarget }) {
    if (telegram) {
      try {
        await app.setTelegram(false);
        setTelegram(false);
        setTgName("");
        setTgLink(null);
      } catch (err) {
        app.showToast(err instanceof ApiError ? err.message : "Could not unlink Telegram");
      }
      return;
    }
    setTgOrigin(originFromEvent(e));
    setTgOpen(true);
    setTgBusy(true);
    try {
      const data = await app.startTelegramLink();
      if (data.telegram) {
        setTelegram(true);
        setTgOpen(false);
        return;
      }
      if (data.deep_link || data.code) setTgLink(data);
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Could not start Telegram link");
      setTgOpen(false);
    } finally {
      setTgBusy(false);
    }
  }

  useEffect(() => {
    setTelegram(app.telegram);
    setTgName(app.telegramUsername);
  }, [app.telegram, app.telegramUsername]);

  useEffect(() => {
    if (!tgOpen || telegram) return;
    const id = window.setInterval(() => {
      void app.refreshMe();
    }, 2000);
    return () => window.clearInterval(id);
  }, [tgOpen, telegram, app.refreshMe]);

  useEffect(() => {
    if (tgOpen && app.telegram) {
      setTelegram(true);
      setTgName(app.telegramUsername);
      setTgOpen(false);
      app.showToast("Telegram linked", "saved");
    }
  }, [app.telegram, app.telegramUsername, app.showToast, tgOpen]);

  async function deleteAccount() {
    setWipe(false);
    try {
      await app.deleteAccount();
      nav("/login");
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Could not delete account");
    }
  }

  return (
    <>
      <div className="help-hero">
        <div>
          <h2>Settings</h2>
          <p className="panel-card__desc">Account, referrals, and access.</p>
        </div>
      </div>

      <div className="card set-card" id="account">
        <div className="set-account">
          <AvatarStudio size="lg" />
          <div className="set-account__meta">
            <strong>{nick}</strong>
            <span>{app.user?.email}</span>
            <em>{app.user?.role === "admin" ? "Admin" : "Member"}</em>
          </div>
          <Link to="/api" className="panel-btn panel-btn--ghost">
            API cabinet
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Lookups</div>
            <div className="stat-card__value">{lookups}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Referrals</div>
            <div className="stat-card__value">{referrals}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Referral earned</div>
            <div className="stat-card__value stat-card__value--sm">{formatUsd(earned)}</div>
          </div>
        </div>
      </div>

      <div className="card set-card">
        <div className="set-card__head">
          <div>
            <h3>Referral program</h3>
            <p>Earn 5% of your friends' deposits!</p>
          </div>
          <span className="set-card__icon" aria-hidden="true">
            <Gift size={16} />
          </span>
        </div>

        <div className="set-ref-grid">
          <div className="set-ref">
            <Users size={15} />
            <span>Total Referrals</span>
            <strong>{referrals}</strong>
          </div>
          <div className="set-ref">
            <Wallet size={15} />
            <span>Total Earnings</span>
            <strong>{formatUsd(earned)}</strong>
          </div>
          <div className="set-ref">
            <Gift size={15} />
            <span>Reward Rate</span>
            <strong>5%</strong>
          </div>
        </div>

        <div className="set-link">
          <Field label="Share your referral link">
            <Input readOnly value={refLink} />
          </Field>
          <button type="button" className="panel-btn panel-btn--primary" onClick={copyLink}>
            <Copy size={15} />
            Copy
          </button>
        </div>

        <div className="set-steps">
          <p>How it works</p>
          <ol>
            <li>Share your referral link with friends</li>
            <li>They register and make deposits</li>
            <li>You earn 5% of their deposits!</li>
          </ol>
        </div>
      </div>

      <div className="card set-card">
        <div className="set-card__head">
          <div>
            <h3>Change password</h3>
            <p>Choose a key of at least eight characters.</p>
          </div>
          <span className="set-card__icon" aria-hidden="true">
            <KeyRound size={16} />
          </span>
        </div>
        <form className="set-form" onSubmit={changePassword}>
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <div className="set-form__row">
            <Field label="New password">
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={4} />
            </Field>
            <Field label="Confirm">
              <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} minLength={4} />
            </Field>
          </div>
          <button type="submit" className="panel-btn panel-btn--primary">
            Update password
          </button>
        </form>
      </div>

      <div className="card set-card">
        <div className="set-card__head">
          <div>
            <h3>Secret key</h3>
            <p>Sign in with the key alone — no name or password.</p>
          </div>
          <span className="set-card__icon" aria-hidden="true">
            <KeyRound size={16} />
          </span>
        </div>
        <div className="set-row">
          <div>
            <strong>{app.user?.secretLast4 ? `••••${app.user.secretLast4}` : "No key yet"}</strong>
            <p>The full key is shown once. Issuing a new one replaces the old.</p>
          </div>
          <button
            type="button"
            className="panel-btn panel-btn--primary"
            onClick={(e) => void issueSecret(e)}
            disabled={secretBusy}
          >
            {app.user?.secretLast4 ? "Replace key" : "Issue key"}
          </button>
        </div>
      </div>

      <div className="card set-card">
        <div className="set-row">
          <span className="set-card__icon" aria-hidden="true">
            <Send size={16} />
          </span>
          <div>
            <h3>Telegram</h3>
            <p>Link your Telegram account for seamless authentication and notifications.</p>
          </div>
            <button type="button" className="panel-btn panel-btn--primary" onClick={(e) => void openTelegram(e)}>
            <Link2 size={15} />
            {telegram ? "Unlink" : "Link Telegram"}
          </button>
        </div>
        <p className="set-tg">{telegram ? `Linked as @${tgName || nick}` : "Not linked"}</p>
      </div>

      <div className="card set-card set-card--danger">
        <div className="set-card__head">
          <div>
            <h3>Danger zone</h3>
            <p>Permanent account actions.</p>
          </div>
          <span className="set-card__icon" aria-hidden="true">
            <ShieldAlert size={16} />
          </span>
        </div>
        <div className="set-row">
          <div>
            <strong>Delete account</strong>
            <p>
              Permanently delete your account. This action cannot be undone. Your order history will be preserved but
              you will lose access to your account.
            </p>
          </div>
          <button type="button" className="panel-btn panel-btn--ghost set-danger-btn" onClick={() => setWipe(true)}>
            <Trash2 size={15} />
            Delete account
          </button>
        </div>
      </div>

      <Modal open={tgOpen} onClose={() => setTgOpen(false)} origin={tgOrigin}>
        <div className="tg-link">
          <span className="tg-link__icon" aria-hidden="true">
            <Send size={18} />
          </span>
          <h3>Link Telegram</h3>
          <p>
            Open the RX bot in Telegram. If <code>t.me</code> is blocked, copy the link or the start code and paste it
            in the bot.
          </p>
          {tgBusy && !tgLink ? <p className="tg-link__wait">Preparing a one-time code…</p> : null}
          {tgLink ? (
            <>
              <div className="tg-link__bot">{tgLink.bot ? `@${tgLink.bot}` : "RX Lookup bot"}</div>
              <CopyField value={tgLink.deep_link || `https://t.me/${tgLink.bot}`} toast="Telegram link copied" />
              <div className="tg-link__code">
                <span>Start code</span>
                <CopyField value={`/start link_${tgLink.code}`} toast="Code copied" />
              </div>
              <p className="tg-link__hint">
                Search the bot, tap Start, or send the code. This window waits for the link.
              </p>
              <div className="set-wipe__actions">
                {tgLink.deep_link ? (
                  <a className="panel-btn panel-btn--primary" href={tgLink.deep_link} target="_blank" rel="noreferrer">
                    Open Telegram
                  </a>
                ) : null}
                {tgLink.tg_link ? (
                  <a className="panel-btn panel-btn--ghost" href={tgLink.tg_link}>
                    Open app
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(freshSecret)} onClose={() => setFreshSecret("")} origin={secretOrigin}>
        <div className="sub-confirm">
          <span className="sub-confirm__icon" aria-hidden="true">
            <KeyRound size={18} />
          </span>
          <h3>Save this key</h3>
          <p>Shown once. Use it on the Secret key door — no name or password.</p>
          <CopyField value={freshSecret} toast="Key copied" />
          <div className="set-wipe__actions">
            <button type="button" className="panel-btn panel-btn--primary" onClick={() => setFreshSecret("")}>
              I saved it
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={wipe} onClose={() => setWipe(false)}>
        <div className="set-wipe">
          <span className="set-wipe__icon" aria-hidden="true">
            <Trash2 size={18} />
          </span>
          <h3>Delete account</h3>
          <p>
            This cannot be undone. History stays on the desk, but {nick} loses access.
          </p>
          <div className="set-wipe__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setWipe(false)}>
              Keep account
            </button>
            <button type="button" className="panel-btn panel-btn--primary set-danger-btn" onClick={() => void deleteAccount()}>
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
