import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Banknote,
  Bell,
  Check,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Pencil,
  Pin,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { HScroll } from "@/components/HScroll";
import { Modal } from "@/components/Modal";
import { NewsNotice } from "@/components/NewsNotice";
import { Field, Input, Select, Skeleton, TableSkeleton, Textarea, Toggle } from "@/components/ui";
import { FormatField, RichText } from "@/lib/richText";
import {
  createRemoteDeskApi,
  type DeskApi,
  type DeskDeposit,
  type DeskKey,
  type DeskLookup,
  type DeskNews,
  type DeskNotice,
  type DeskState,
  type DeskTicket,
  type DeskUser,
  type GiftCode,
  type LookupKind,
  type PlanId,
} from "@/lib/admin";
import { cx, formatUsd } from "@/lib/format";
import { normalizeLogin } from "@/lib/roles";
import { useApp } from "@/lib/store";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, kind: "overview" },
  { id: "users", label: "Users", icon: Users, kind: "users" },
  { id: "money", label: "Money", icon: Banknote, kind: "money" },
  { id: "tickets", label: "Tickets", icon: LifeBuoy, kind: "tickets" },
  { id: "lookups", label: "Lookups", icon: Search, kind: "lookups" },
  { id: "keys", label: "Keys", icon: KeyRound, kind: "keys" },
  { id: "news", label: "News", icon: Megaphone, kind: "news" },
  { id: "notify", label: "Notify", icon: Bell, kind: "notify" },
  { id: "desk", label: "Desk", icon: SlidersHorizontal, kind: "desk" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string | undefined): v is TabId {
  return TABS.some((t) => t.id === v);
}

const PLAN_LABEL: Record<PlanId, string> = {
  none: "—",
  day: "1d",
  week: "7d",
  month: "30d",
};

export function AdminPage() {
  const app = useApp();
  const loc = useLocation();
  const reduce = useReducedMotion();
  const tab = loc.pathname.split("/")[2];
  const section: TabId = isTab(tab) ? tab : "overview";
  const [desk, setDesk] = useState<DeskState | null>(null);
  const api = useMemo(() => createRemoteDeskApi(setDesk), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void api.refresh().catch(() => {
      app.showToast("Could not load the desk");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (reduce) {
      setReady(true);
      return;
    }
    setReady(false);
    const t = window.setTimeout(() => setReady(true), 340);
    return () => window.clearTimeout(t);
  }, [section, reduce]);

  if (tab && !isTab(tab)) return <Navigate to="/admin" replace />;

  return (
    <div className="admin">
      <aside className="admin-rail" aria-label="Admin">
        <p className="admin-rail__kicker">Admin</p>
        <HScroll className="admin-rail__scroll" viewClass="admin-rail__tabs">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.id === "overview" ? "/admin" : `/admin/${item.id}`}
                end={item.id === "overview"}
                data-icon={item.kind}
                className={({ isActive }) => cx("admin-rail__btn", isActive && "is-on")}
              >
                <Icon size={14} />
                {item.label}
              </NavLink>
            );
          })}
        </HScroll>
      </aside>

      <div className="admin-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={ready ? section : `${section}-skel`}
            className="admin-pane"
            initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {ready && desk ? (
              <>
                {section === "overview" ? <Overview desk={desk} /> : null}
                {section === "users" ? <UsersPane desk={desk} api={api} /> : null}
                {section === "money" ? <MoneyPane desk={desk} api={api} /> : null}
                {section === "tickets" ? <TicketsPane desk={desk} api={api} /> : null}
                {section === "lookups" ? <LookupsPane desk={desk} /> : null}
                {section === "keys" ? <KeysPane desk={desk} api={api} /> : null}
                {section === "news" ? <NewsPane desk={desk} api={api} /> : null}
                {section === "notify" ? <NotifyPane desk={desk} api={api} /> : null}
                {section === "desk" ? <DeskPane desk={desk} api={api} onToast={app.showToast} /> : null}
              </>
            ) : (
              <AdminSkeleton kind={section} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AdminSkeleton({ kind }: { kind: TabId }) {
  if (kind === "overview") {
    return (
      <>
        <div className="admin-kpis">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-kpi">
              <Skeleton style={{ height: 10, width: 48 }} />
              <Skeleton style={{ height: 22, width: 64, marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="admin-split">
          <div className="card admin-card">
            <Skeleton style={{ height: 16, width: 90, marginBottom: 14 }} />
            <Skeleton style={{ height: 12, marginBottom: 10 }} />
            <Skeleton style={{ height: 12, width: "80%", marginBottom: 10 }} />
            <Skeleton style={{ height: 12, width: "70%" }} />
          </div>
          <div className="card admin-card">
            <Skeleton style={{ height: 16, width: 110, marginBottom: 14 }} />
            <Skeleton style={{ height: 12, marginBottom: 10 }} />
            <Skeleton style={{ height: 12, width: "84%", marginBottom: 10 }} />
            <Skeleton style={{ height: 12, width: "62%" }} />
          </div>
        </div>
        <div className="card admin-card">
          <Skeleton style={{ height: 16, width: 70, marginBottom: 14 }} />
          <TableSkeleton rows={4} cols={2} />
        </div>
      </>
    );
  }

  if (kind === "money" || kind === "news" || kind === "notify") {
    return (
      <div className="admin-split">
        <div className="card admin-card">
          <Skeleton style={{ height: 16, width: 120, marginBottom: 16 }} />
          <Skeleton style={{ height: 38, marginBottom: 10 }} />
          <Skeleton style={{ height: 38, marginBottom: 10 }} />
          <Skeleton style={{ height: 38 }} />
        </div>
        <div className="card admin-card">
          <Skeleton style={{ height: 16, width: 100, marginBottom: 16 }} />
          <Skeleton style={{ height: 120 }} />
        </div>
      </div>
    );
  }

  if (kind === "desk") {
    return (
      <>
        <div className="card admin-card">
          <Skeleton style={{ height: 18, width: 80 }} />
        </div>
        <div className="card admin-card">
          <Skeleton style={{ height: 16, width: 90, marginBottom: 14 }} />
          <div className="admin-prices">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 92, borderRadius: 18 }} />
            ))}
          </div>
        </div>
        <div className="card admin-card">
          <Skeleton style={{ height: 16, width: 110, marginBottom: 14 }} />
          <div className="admin-prices admin-prices--3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 92, borderRadius: 18 }} />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="admin-toolbar">
        <Skeleton style={{ height: 36, width: 220, borderRadius: 999 }} />
        <Skeleton style={{ height: 32, width: 160, borderRadius: 999 }} />
      </div>
      <div className="card admin-card">
        <TableSkeleton rows={7} cols={kind === "lookups" ? 7 : 6} />
      </div>
    </>
  );
}

function Overview({ desk }: { desk: DeskState }) {
  const pending = desk.deposits.filter((d) => d.status === "pending");
  const open = desk.tickets.filter((t) => t.status === "Open");
  const online = desk.users.filter((u) => u.lastSeen === "now" || u.lastSeen.endsWith("m")).length;
  const dayLookups = desk.lookups.filter((l) => l.at.startsWith("2026-09-09")).length;
  const dayRev = desk.lookups.filter((l) => l.at.startsWith("2026-09-09")).reduce((s, l) => s + l.costCents, 0);

  return (
    <>
      <div className="admin-kpis">
        <Kpi label="Users" value={String(desk.users.length)} />
        <Kpi label="Online" value={String(online)} />
        <Kpi label="Lookups" value={String(dayLookups)} hint="today" />
        <Kpi label="Revenue" value={formatUsd(dayRev)} hint="today" />
        <Kpi label="Tickets" value={String(open.length)} hint="open" />
        <Kpi label="Deposits" value={String(pending.length)} hint="pending" />
      </div>

      <div className="admin-split">
        <div className="card admin-card">
          <div className="admin-card__head">
            <h3>Needs you</h3>
            <p>Deposits and open threads.</p>
          </div>
          {pending.length === 0 && open.length === 0 ? (
            <p className="admin-empty">Queue is clear.</p>
          ) : (
            <ul className="admin-feed">
              {pending.map((d) => (
                <li key={d.id}>
                  <strong>{d.user}</strong>
                  <span>
                    {d.method} {formatUsd(d.amountCents)}
                  </span>
                  <em>pending</em>
                </li>
              ))}
              {open.map((t) => (
                <li key={t.id}>
                  <strong>#{t.id}</strong>
                  <span>{t.subject}</span>
                  <em>{t.user}</em>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card admin-card">
          <div className="admin-card__head">
            <h3>Latest lookups</h3>
            <p>Live desk traffic.</p>
          </div>
          <ul className="admin-feed">
            {desk.lookups.slice(0, 6).map((l) => (
              <li key={l.id}>
                <strong>{l.user}</strong>
                <span>
                  {l.kind} · {l.query}
                </span>
                <em>{l.status}</em>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-card__head">
          <h3>Audit</h3>
          <p>Staff actions on this desk.</p>
        </div>
        <ul className="admin-feed">
          {desk.audit.slice(0, 8).map((a) => (
            <li key={a.id}>
              <span>{a.text}</span>
              <em>{a.at}</em>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function UsersPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | MemberFilter>("all");
  const [open, setOpen] = useState<DeskUser | null>(null);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return desk.users.filter((u) => {
      if (filter === "admin" && u.role !== "admin") return false;
      if (filter === "banned" && u.status !== "banned") return false;
      if (filter === "plan" && u.plan === "none") return false;
      if (!query) return true;
      return u.login.includes(query) || u.email.includes(query);
    });
  }, [desk.users, filter, q]);

  const live = open ? desk.users.find((u) => u.login === open.login) ?? open : null;

  return (
    <>
      <div className="admin-toolbar">
        <input
          className="admin-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find user"
        />
        <div className="api-filter" role="tablist" aria-label="User filter">
          {(["all", "plan", "admin", "banned"] as const).map((id) => (
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

      <div className="card admin-card admin-card--table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Balance</th>
              <th>Plan</th>
              <th>API</th>
              <th>Lookups</th>
              <th>Seen</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setOpen(u)}>
                <td>
                  <strong>{u.login}</strong>
                  {u.role === "admin" ? <span className="admin-chip">admin</span> : null}
                </td>
                <td className="mono">{formatUsd(u.balanceCents)}</td>
                <td>{PLAN_LABEL[u.plan]}</td>
                <td>{PLAN_LABEL[u.apiPlan]}</td>
                <td className="mono">{u.lookups}</td>
                <td>{u.lastSeen}</td>
                <td>
                  <span className={cx("admin-dot", u.status !== "active" && "is-off")}>{u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserModal
        user={live}
        onClose={() => setOpen(null)}
        onCredit={(login, cents) => api.credit(login, cents)}
        onPatch={(login, patch) => api.setUser(login, patch)}
      />
    </>
  );
}

type MemberFilter = "admin" | "banned" | "plan";

function UserModal({
  user,
  onClose,
  onCredit,
  onPatch,
}: {
  user: DeskUser | null;
  onClose: () => void;
  onCredit: (login: string, cents: number) => void;
  onPatch: (login: string, patch: Partial<DeskUser>) => void;
}) {
  const [amount, setAmount] = useState("25");
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(user?.note ?? "");
    setAmount("25");
  }, [user?.login, user?.note]);

  return (
    <Modal open={Boolean(user)} onClose={onClose} wide>
      <div className="admin-modal">
        {user ? (
        <>
        <div className="admin-modal__top">
          <div>
            <h3>{user.login}</h3>
            <p>
              {user.email} · {user.createdAt}
            </p>
          </div>
          <span className={cx("admin-dot", user.status !== "active" && "is-off")}>{user.status}</span>
        </div>

        <div className="admin-modal__bal">
          <strong>{formatUsd(user.balanceCents)}</strong>
          <div className="admin-quick">
            {[10, 25, 50, 100].map((n) => (
              <button key={n} type="button" onClick={() => onCredit(user.login, n * 100)}>
                +${n}
              </button>
            ))}
          </div>
        </div>

        <form
          className="admin-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = Math.round(Number(amount) * 100);
            if (!cents) return;
            onCredit(user.login, cents);
            setAmount("");
          }}
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom"
          />
          <button type="submit" className="panel-btn panel-btn--primary">
            Credit
          </button>
          <button
            type="button"
            className="panel-btn panel-btn--ghost"
            onClick={() => {
              const cents = Math.round(Number(amount) * 100);
              if (!cents) return;
              onCredit(user.login, -cents);
            }}
          >
            Debit
          </button>
        </form>

        <div className="admin-grid2">
          <Field label="Desk plan">
            <Select value={user.plan} onChange={(e) => onPatch(user.login, { plan: e.target.value as PlanId })}>
              <option value="none">None</option>
              <option value="day">1 Day</option>
              <option value="week">7 Days</option>
              <option value="month">30 Days</option>
            </Select>
          </Field>
          <Field label="API plan">
            <Select
              value={user.apiPlan}
              onChange={(e) => onPatch(user.login, { apiPlan: e.target.value as PlanId })}
            >
              <option value="none">None</option>
              <option value="day">1 Day</option>
              <option value="week">7 Days</option>
              <option value="month">30 Days</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={user.status}
              onChange={(e) => onPatch(user.login, { status: e.target.value as DeskUser["status"] })}
            >
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="banned">Banned</option>
            </Select>
          </Field>
          <Field label="Role">
            <Select
              value={user.role}
              onChange={(e) => onPatch(user.login, { role: e.target.value as DeskUser["role"] })}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>

        <Field label="Note">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onPatch(user.login, { note })}
          />
        </Field>
        </>
        ) : null}
      </div>
    </Modal>
  );
}

function MoneyPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const [nick, setNick] = useState("");
  const [amount, setAmount] = useState("50");
  const [error, setError] = useState("");
  const pending = desk.deposits.filter((d) => d.status === "pending");
  const match = desk.users.find((u) => u.login === normalizeLogin(nick));

  function creditManual(e: FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    const login = normalizeLogin(nick);
    if (!login || !cents) return;
    if (!match) {
      setError("No user with that name.");
      return;
    }
    api.credit(login, cents, "Manual desk credit");
    setAmount("");
    setError("");
  }

  return (
    <>
      <div className="admin-split">
        <div className="card admin-card">
          <div className="admin-card__head">
            <h3>Pending deposits</h3>
            <p>{pending.length} waiting.</p>
          </div>
          <div className="admin-table-wrap">
            <DepositTable rows={pending.length ? pending : desk.deposits.slice(0, 4)} api={api} />
          </div>
        </div>
        <div className="card admin-card">
          <div className="admin-card__head">
            <h3>Manual credit</h3>
            <p>Adjust a wallet now.</p>
          </div>
          <form className="admin-stack" onSubmit={creditManual}>
            <Field label="Nickname">
              <Input
                value={nick}
                onChange={(e) => {
                  setNick(e.target.value);
                  setError("");
                }}
                placeholder="alex"
                autoComplete="off"
                list="admin-nicks"
              />
            </Field>
            <datalist id="admin-nicks">
              {desk.users.map((u) => (
                <option key={u.id} value={u.login} />
              ))}
            </datalist>
            {nick.trim() ? (
              <p className={cx("admin-hint", !match && "is-bad")}>
                {match ? `${match.login} · ${formatUsd(match.balanceCents)}` : "No user with that name."}
              </p>
            ) : null}
            {error ? <p className="admin-hint is-bad">{error}</p> : null}
            <Field label="Amount">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <button type="submit" className="panel-btn panel-btn--primary">
              Credit wallet
            </button>
          </form>
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-card__head admin-card__head--row">
          <div>
            <h3>Gift codes</h3>
            <p>One-time desk credits.</p>
          </div>
          <div className="admin-quick">
            {[25, 50, 100].map((n) => (
              <button key={n} type="button" onClick={() => api.mintCode(n * 100)}>
                +${n}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-table-wrap">
          <CodesTable rows={desk.codes} onDrop={api.dropCode} />
        </div>
      </div>
    </>
  );
}

function DepositTable({
  rows,
  api,
}: {
  rows: DeskDeposit[];
  api: DeskApi;
}) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Amount</th>
          <th>Via</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id}>
            <td className="name">{d.user}</td>
            <td className="mono">{formatUsd(d.amountCents)}</td>
            <td>
              {d.method} · {d.txid}
            </td>
            <td>
              <span className={cx("admin-dot", d.status !== "credited" && "is-off")}>{d.status}</span>
            </td>
            <td>
              {d.status === "pending" ? (
                <span className="admin-row-actions">
                  <button type="button" onClick={() => api.setDeposit(d.id, "credited")}>
                    Credit
                  </button>
                  <button type="button" onClick={() => api.setDeposit(d.id, "rejected")}>
                    Reject
                  </button>
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CodesTable({ rows, onDrop }: { rows: GiftCode[]; onDrop: (id: string) => void }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Value</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="mono">{c.code}</td>
            <td>{formatUsd(c.amountCents)}</td>
            <td>
              {c.status}
              {c.usedBy ? ` · ${c.usedBy}` : ""}
            </td>
            <td>
              {c.status === "open" ? (
                <button type="button" className="admin-text-btn" onClick={() => onDrop(c.id)}>
                  Drop
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TicketsPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [active, setActive] = useState<DeskTicket | null>(null);
  const [reply, setReply] = useState("");
  const rows = desk.tickets.filter((t) => (filter === "all" ? true : t.status.toLowerCase() === filter));
  const live = active ? desk.tickets.find((t) => t.id === active.id) ?? active : null;

  return (
    <>
      <div className="admin-toolbar">
        <div className="api-filter">
          {(["all", "open", "closed"] as const).map((id) => (
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
      <div className="card admin-card admin-card--table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Subject</th>
              <th>Updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => setActive(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActive(t);
                  }
                }}
              >
                <td className="mono">{t.id}</td>
                <td>{t.user}</td>
                <td className="name">{t.subject}</td>
                <td>{t.updated}</td>
                <td>
                  <span className={cx("admin-dot", t.status === "Closed" && "is-off")}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(live)} onClose={() => setActive(null)} wide>
        {live ? (
          <div className="admin-modal">
            <div className="admin-modal__top">
              <div>
                <h3>
                  #{live.id} {live.subject}
                </h3>
                <p>
                  {live.user} · {live.status}
                </p>
              </div>
              <span className={cx("admin-dot", live.status === "Closed" && "is-off")}>{live.status}</span>
            </div>
            <ul className="admin-thread">
              {live.replies.map((r, i) => (
                <li key={i} className={cx(r.from === "staff" && "is-staff")}>
                  <strong>{r.from === "staff" ? "Staff" : live.user}</strong>
                  <span>{r.text}</span>
                  <em>{r.at}</em>
                </li>
              ))}
            </ul>
            <Field label="Reply">
              <Textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={live.status === "Open" ? "Write a reply. Ticket stays open." : "Reply to reopen this ticket."}
              />
            </Field>
            <div className="admin-inline">
              <button
                type="button"
                className="panel-btn panel-btn--primary"
                onClick={() => {
                  const text = reply.trim();
                  if (!text) return;
                  void api.replyTicket(live.id, text);
                  setReply("");
                }}
              >
                Reply
              </button>
              {live.status === "Open" ? (
                <button type="button" className="panel-btn panel-btn--ghost" onClick={() => void api.closeTicket(live.id)}>
                  Close ticket
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function LookupsPane({ desk }: { desk: DeskState }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | LookupKind>("all");
  const rows = desk.lookups.filter((l) => {
    if (kind !== "all" && l.kind !== kind) return false;
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return l.user.includes(query) || l.query.toLowerCase().includes(query);
  });

  return (
    <>
      <div className="admin-toolbar">
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="User or query" />
        <div className="api-filter">
          {(["all", "search", "ssndob", "cs"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={cx("api-filter__btn", kind === id && "is-on")}
              onClick={() => setKind(id)}
            >
              {id === "ssndob" ? "SSN+DOB" : id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="card admin-card admin-card--table">
        <LookupTable rows={rows} />
      </div>
    </>
  );
}

function LookupTable({ rows }: { rows: DeskLookup[] }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>When</th>
          <th>User</th>
          <th>Kind</th>
          <th>Query</th>
          <th>Hits</th>
          <th>Cost</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id}>
            <td>{l.at}</td>
            <td>{l.user}</td>
            <td>{l.kind}</td>
            <td className="name">{l.query}</td>
            <td className="mono">{l.hits}</td>
            <td className="mono">{l.costCents ? formatUsd(l.costCents) : "—"}</td>
            <td>
              <span className={cx("admin-dot", l.status !== "ok" && "is-off")}>{l.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KeysPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "revoked">("all");
  const rows = desk.keys.filter((k) => (filter === "all" ? true : k.status === filter));

  return (
    <>
      <div className="admin-toolbar">
        <div className="api-filter">
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
      <div className="card admin-card admin-card--table">
        <KeyTable rows={rows} onRevoke={api.revokeKey} />
      </div>
    </>
  );
}

function KeyTable({ rows, onRevoke }: { rows: DeskKey[]; onRevoke: (id: string) => void }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Name</th>
          <th>Key</th>
          <th>Reqs</th>
          <th>Scopes</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((k) => (
          <tr key={k.id}>
            <td>{k.user}</td>
            <td className="name">{k.name}</td>
            <td className="mono">
              {k.prefix}…{k.last4}
            </td>
            <td className="mono">{k.requests.toLocaleString()}</td>
            <td>{k.scopes.join(" · ")}</td>
            <td>
              {k.status === "active" ? (
                <button type="button" className="admin-text-btn" onClick={() => onRevoke(k.id)}>
                  Revoke
                </button>
              ) : (
                <span className="admin-dot is-off">revoked</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NewsPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const app = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [withButton, setWithButton] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaTo, setCtaTo] = useState("");
  const [preview, setPreview] = useState(false);
  const [edit, setEdit] = useState<DeskNews | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editButton, setEditButton] = useState(false);
  const [editCtaLabel, setEditCtaLabel] = useState("");
  const [editCtaTo, setEditCtaTo] = useState("");

  const draft = {
    title: title.trim(),
    body: body.trim(),
    ctaLabel: withButton ? ctaLabel.trim() : "",
    ctaTo: withButton ? ctaTo.trim() : "",
  };
  const ready = Boolean(draft.title && draft.body && (!withButton || (draft.ctaLabel && draft.ctaTo)));

  function resetDraft() {
    setTitle("");
    setBody("");
    setWithButton(false);
    setCtaLabel("");
    setCtaTo("");
    setPreview(false);
  }

  function publish() {
    if (!ready) return;
    api.addNews(draft.title, draft.body, draft.ctaLabel, draft.ctaTo);
    app.showToast("Note published", "saved");
    resetDraft();
  }

  const editDraft = {
    title: editTitle.trim(),
    body: editBody.trim(),
    ctaLabel: editButton ? editCtaLabel.trim() : "",
    ctaTo: editButton ? editCtaTo.trim() : "",
  };
  const editReady = Boolean(editDraft.title && editDraft.body && (!editButton || (editDraft.ctaLabel && editDraft.ctaTo)));

  function openEdit(note: DeskNews) {
    setEdit(note);
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditButton(Boolean(note.ctaLabel && note.ctaTo));
    setEditCtaLabel(note.ctaLabel || "");
    setEditCtaTo(note.ctaTo || "");
  }

  function saveEdit() {
    if (!edit || !editReady) return;
    api.editNews(edit.id, editDraft.title, editDraft.body, editDraft.ctaLabel, editDraft.ctaTo);
    app.showToast("Note updated", "saved");
    setEdit(null);
  }

  return (
    <div className="admin-split">
      <div className="card admin-card">
        <div className="admin-card__head">
          <h3>Post</h3>
          <p>Shows on Home when pinned.</p>
        </div>
        <form
          className="admin-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            setPreview(true);
          }}
        >
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Desk is live" />
          </Field>
          <div className="field">
            <span>Body</span>
            <FormatField
              rows={5}
              value={body}
              onChange={setBody}
              placeholder="**Bold**, *italic*, or [Plans](/subscriptions)"
            />
          </div>
          <label className={cx("admin-check", withButton && "is-on")}>
            <input
              type="checkbox"
              checked={withButton}
              onChange={(e) => setWithButton(e.target.checked)}
            />
            <i aria-hidden="true">{withButton ? <Check size={12} strokeWidth={2.6} /> : null}</i>
            <span>Add button</span>
          </label>
          {withButton ? (
            <div className="admin-grid2">
              <Field label="Button">
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Open plans"
                />
              </Field>
              <Field label="Button link">
                <Input
                  value={ctaTo}
                  onChange={(e) => setCtaTo(e.target.value)}
                  placeholder="/subscriptions"
                />
              </Field>
            </div>
          ) : null}
          <button type="submit" className="panel-btn panel-btn--primary" disabled={!ready}>
            Preview
          </button>
        </form>
      </div>
      <div className="card admin-card">
        <div className="admin-card__head">
          <h3>Live</h3>
          <p>
            {desk.news.length} {desk.news.length === 1 ? "note" : "notes"}.
          </p>
        </div>
        <NewsList rows={desk.news} onPin={api.togglePin} onDrop={api.dropNews} onEdit={openEdit} />
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} wide>
        <div className="admin-preview">
          <div className="admin-preview__head">
            <h3>Preview</h3>
            <p>This is how the note will look on Home.</p>
          </div>
          <NewsNotice
            title={draft.title}
            body={draft.body}
            ctaLabel={draft.ctaLabel}
            ctaTo={draft.ctaTo}
            preview
          />
          <div className="admin-preview__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setPreview(false)}>
              Back
            </button>
            <button type="button" className="panel-btn panel-btn--primary" onClick={publish}>
              Publish
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} wide>
        <div className="admin-preview">
          <div className="admin-preview__head">
            <h3>Edit note</h3>
            <p>Updates the live Home note.</p>
          </div>
          <div className="admin-stack">
            <Field label="Title">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </Field>
            <div className="field">
              <span>Body</span>
              <FormatField rows={5} value={editBody} onChange={setEditBody} />
            </div>
            <label className={cx("admin-check", editButton && "is-on")}>
              <input type="checkbox" checked={editButton} onChange={(e) => setEditButton(e.target.checked)} />
              <i aria-hidden="true">{editButton ? <Check size={12} strokeWidth={2.6} /> : null}</i>
              <span>Add button</span>
            </label>
            {editButton ? (
              <div className="admin-grid2">
                <Field label="Button">
                  <Input value={editCtaLabel} onChange={(e) => setEditCtaLabel(e.target.value)} />
                </Field>
                <Field label="Button link">
                  <Input value={editCtaTo} onChange={(e) => setEditCtaTo(e.target.value)} />
                </Field>
              </div>
            ) : null}
          </div>
          <NewsNotice
            title={editDraft.title}
            body={editDraft.body}
            ctaLabel={editDraft.ctaLabel}
            ctaTo={editDraft.ctaTo}
            preview
          />
          <div className="admin-preview__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setEdit(null)}>
              Back
            </button>
            <button type="button" className="panel-btn panel-btn--primary" disabled={!editReady} onClick={saveEdit}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NotifyPane({
  desk,
  api,
}: {
  desk: DeskState;
  api: DeskApi;
}) {
  const app = useApp();
  const [author, setAuthor] = useState("rxlookup");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [hrefLabel, setHrefLabel] = useState("");
  const [preview, setPreview] = useState(false);
  const rows = desk.notices || [];

  const draft = {
    author: author.trim() || "rxlookup",
    body: body.trim(),
    href: href.trim(),
    hrefLabel: hrefLabel.trim(),
  };
  const ready = Boolean(draft.body);

  function resetDraft() {
    setAuthor("rxlookup");
    setBody("");
    setHref("");
    setHrefLabel("");
    setPreview(false);
  }

  function send() {
    if (!ready) return;
    api.sendNotice(draft.author, draft.body, draft.href, draft.hrefLabel);
    app.showToast("Notice sent", "saved");
    resetDraft();
  }

  return (
    <div className="admin-split">
      <div className="card admin-card">
        <div className="admin-card__head">
          <h3>Broadcast</h3>
          <p>Pushes to every desk bell.</p>
        </div>
        <form
          className="admin-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            setPreview(true);
          }}
        >
          <Field label="Author">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="rxlookup" />
          </Field>
          <div className="field">
            <span>Text</span>
            <FormatField
              rows={5}
              value={body}
              onChange={setBody}
              placeholder="**Update** — tap [plans](/subscriptions)"
            />
          </div>
          <div className="admin-grid2">
            <Field label="Link label">
              <Input value={hrefLabel} onChange={(e) => setHrefLabel(e.target.value)} placeholder="Open" />
            </Field>
            <Field label="Hyperlink">
              <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/subscriptions" />
            </Field>
          </div>
          <button type="submit" className="panel-btn panel-btn--primary" disabled={!ready}>
            Preview
          </button>
        </form>
      </div>
      <div className="card admin-card">
        <div className="admin-card__head">
          <h3>Sent</h3>
          <p>
            {rows.length} {rows.length === 1 ? "notice" : "notices"}.
          </p>
        </div>
        <NoticeList rows={rows} onDrop={api.dropNotice} />
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} wide>
        <div className="admin-preview">
          <div className="admin-preview__head">
            <h3>Preview</h3>
            <p>This is how it lands in Notifications.</p>
          </div>
          <article className="notify-item notify-item_unread admin-notice-preview">
            <span className="notify-item__icon" aria-hidden="true">
              <Bell size={15} />
            </span>
            <span className="notify-item__body">
              <strong>{draft.author}</strong>
              <RichText text={draft.body || "Write the notice."} />
              {draft.href ? (
                <span className="notify-item__go">
                  {draft.hrefLabel || "Open"}
                </span>
              ) : null}
            </span>
          </article>
          <div className="admin-preview__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setPreview(false)}>
              Back
            </button>
            <button type="button" className="panel-btn panel-btn--primary" onClick={send}>
              Send to all
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NoticeList({
  rows,
  onDrop,
}: {
  rows: DeskNotice[];
  onDrop: (id: string) => void;
}) {
  if (!rows.length) return <p className="admin-empty">No broadcasts yet.</p>;
  return (
    <ul className="admin-news">
      {rows.map((n) => (
        <li key={n.id} className="admin-note">
          <div className="admin-note__top">
            <span className="admin-note__pin is-off">{n.author}</span>
            <time>{n.at}</time>
          </div>
          <div className="admin-notice-preview">
            <RichText text={n.body} />
            {n.href ? (
              <p className="admin-note__link">
                {n.hrefLabel || "Open"} → {n.href}
              </p>
            ) : null}
          </div>
          <div className="admin-note__bar">
            <button type="button" className="panel-btn panel-btn--ghost admin-note__btn" onClick={() => onDrop(n.id)}>
              <Trash2 size={13} />
              Drop
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function NewsList({
  rows,
  onPin,
  onDrop,
  onEdit,
}: {
  rows: DeskNews[];
  onPin: (id: string) => void;
  onDrop: (id: string) => void;
  onEdit: (note: DeskNews) => void;
}) {
  if (!rows.length) return <p className="admin-empty">Nothing posted.</p>;
  return (
    <ul className="admin-news">
      {rows.map((n) => (
        <li key={n.id} className={cx("admin-note", n.pinned && "is-pinned")}>
          <div className="admin-note__top">
            {n.pinned ? <span className="admin-note__pin">Pinned</span> : <span className="admin-note__pin is-off">Live</span>}
            <time>{n.at}</time>
          </div>
          <NewsNotice title={n.title} body={n.body} ctaLabel={n.ctaLabel} ctaTo={n.ctaTo} preview />
          <div className="admin-note__bar">
            <button type="button" className="panel-btn panel-btn--ghost admin-note__btn" onClick={() => onEdit(n)}>
              <Pencil size={13} />
              Edit
            </button>
            <button type="button" className="panel-btn panel-btn--ghost admin-note__btn" onClick={() => onPin(n.id)}>
              <Pin size={13} />
              {n.pinned ? "Unpin" : "Pin"}
            </button>
            <button type="button" className="panel-btn panel-btn--ghost admin-note__btn" onClick={() => onDrop(n.id)}>
              <Trash2 size={13} />
              Drop
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

const LOOKUP_PRICES = [
  { key: "searchCost", label: "Search", hint: "per result" },
  { key: "ssndobCost", label: "SSN+DOB", hint: "per hit" },
  { key: "csCost", label: "Credit", hint: "on success" },
  { key: "revealCost", label: "Reveal", hint: "per reveal" },
] as const;

const DESK_PRICES = [
  { key: "deskDay", label: "1 Day", hint: "desk" },
  { key: "deskWeek", label: "7 Days", hint: "desk" },
  { key: "deskMonth", label: "30 Days", hint: "desk" },
] as const;

const API_PRICES = [
  { key: "apiDay", label: "1 Day", hint: "API" },
  { key: "apiWeek", label: "7 Days", hint: "API" },
  { key: "apiMonth", label: "30 Days", hint: "API" },
] as const;

type PriceKey = (typeof LOOKUP_PRICES | typeof DESK_PRICES | typeof API_PRICES)[number]["key"];

function DeskPane({
  desk,
  api,
  onToast,
}: {
  desk: DeskState;
  api: DeskApi;
  onToast: (text: string, icon?: string) => void;
}) {
  const [prices, setPrices] = useState<Record<PriceKey, string>>({
    searchCost: String(desk.settings.searchCost),
    ssndobCost: String(desk.settings.ssndobCost),
    csCost: String(desk.settings.csCost),
    revealCost: String(desk.settings.revealCost ?? 1.5),
    deskDay: String(desk.settings.deskDay ?? 15),
    deskWeek: String(desk.settings.deskWeek ?? 45),
    deskMonth: String(desk.settings.deskMonth ?? 120),
    apiDay: String(desk.settings.apiDay ?? 30),
    apiWeek: String(desk.settings.apiWeek ?? 90),
    apiMonth: String(desk.settings.apiMonth ?? 240),
  });

  function set(key: PriceKey, value: string) {
    setPrices((prev) => ({ ...prev, [key]: value }));
  }

  function savePrices() {
    const next = Object.fromEntries(
      Object.entries(prices).map(([k, v]) => [k, Number(v) || 0]),
    ) as Record<PriceKey, number>;
    onToast("Prices saved", "saved");
    api.saveSettings(next);
  }

  return (
    <form
      className="admin-stack"
      onSubmit={(e) => {
        e.preventDefault();
        savePrices();
      }}
    >
      <div className="card admin-card">
        <div className="admin-card__head admin-card__head--desk">
          <div>
            <h3>Desk</h3>
            <p>Pricing and maintenance.</p>
          </div>
          <div className="admin-desk-tools">
            <label className="admin-switch">
              <span>Maintenance</span>
              <Toggle
                on={desk.settings.maintenance}
                onChange={(v) => {
                  onToast(v ? "Maintenance on" : "Maintenance off");
                  api.saveSettings({ maintenance: v });
                }}
                label="Maintenance"
              />
            </label>
          </div>
        </div>
      </div>

      <PriceGroup title="Lookups" hint="Charged per request" cols={4} items={LOOKUP_PRICES} prices={prices} onChange={set} />
      <PriceGroup title="Desk plans" hint="Unlimited search" cols={3} items={DESK_PRICES} prices={prices} onChange={set} />
      <PriceGroup title="API plans" hint="2× desk" cols={3} items={API_PRICES} prices={prices} onChange={set} />

      <button type="submit" className="panel-btn panel-btn--primary">
        Save prices
      </button>
    </form>
  );
}

function PriceGroup({
  title,
  hint,
  cols,
  items,
  prices,
  onChange,
}: {
  title: string;
  hint: string;
  cols: 3 | 4;
  items: readonly { key: PriceKey; label: string; hint: string }[];
  prices: Record<PriceKey, string>;
  onChange: (key: PriceKey, value: string) => void;
}) {
  return (
    <div className="card admin-card">
      <div className="admin-card__head">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      <div className={cx("admin-prices", cols === 3 && "admin-prices--3")}>
        {items.map((item) => (
          <label key={item.key} className="admin-price">
            <span>{item.label}</span>
            <em>{item.hint}</em>
            <span className="admin-price__in">
              $
              <input
                inputMode="decimal"
                value={prices[item.key]}
                onChange={(e) => onChange(item.key, e.target.value)}
              />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-kpi">
      <span>
        {label}
        {hint ? <em> {hint}</em> : null}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
