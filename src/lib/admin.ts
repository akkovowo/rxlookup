import { apiGet, apiPost } from "./api";
import { API_SUBSCRIPTION_PLANS, CS_COST, REVEAL_COST, SEARCH_COST, SSNDOB_COST, SUBSCRIPTION_PLANS } from "./mock";
import { isAdminLogin, normalizeLogin } from "./roles";
import type { User } from "./store";

const KEY = "rx.admin";

export type MemberStatus = "active" | "banned" | "frozen";
export type PlanId = "none" | "day" | "week" | "month";
export type DepositStatus = "pending" | "credited" | "rejected";
export type LookupKind = "search" | "ssndob" | "cs";
export type KeyStatus = "active" | "revoked";

export type DeskUser = {
  id: string;
  login: string;
  email: string;
  role: "member" | "admin";
  status: MemberStatus;
  balanceCents: number;
  plan: PlanId;
  apiPlan: PlanId;
  planUntil: string | null;
  lookups: number;
  lastSeen: string;
  createdAt: string;
  note: string;
};

export type DeskTicket = {
  id: number;
  user: string;
  subject: string;
  status: "Open" | "Closed";
  updated: string;
  preview: string;
  replies: { from: "user" | "staff"; text: string; at: string }[];
};

export type DeskDeposit = {
  id: string;
  user: string;
  method: string;
  amountCents: number;
  status: DepositStatus;
  txid: string;
  createdAt: string;
};

export type DeskLookup = {
  id: string;
  user: string;
  kind: LookupKind;
  query: string;
  hits: number;
  costCents: number;
  status: "ok" | "empty" | "error";
  at: string;
};

export type DeskKey = {
  id: string;
  user: string;
  name: string;
  prefix: string;
  last4: string;
  status: KeyStatus;
  requests: number;
  scopes: string[];
};

export type DeskNews = {
  id: string;
  title: string;
  body: string;
  at: string;
  pinned: boolean;
  ctaLabel: string;
  ctaTo: string;
};

export type DeskNotice = {
  id: string;
  author: string;
  body: string;
  href: string;
  hrefLabel: string;
  at: string;
};

export type GiftCode = {
  id: string;
  code: string;
  amountCents: number;
  status: "open" | "used";
  usedBy: string | null;
};

export type AuditItem = {
  id: string;
  text: string;
  at: string;
};

export type DeskSettings = {
  searchCost: number;
  ssndobCost: number;
  csCost: number;
  revealCost: number;
  deskDay: number;
  deskWeek: number;
  deskMonth: number;
  apiDay: number;
  apiWeek: number;
  apiMonth: number;
  maintenance: boolean;
};

export type DeskState = {
  users: DeskUser[];
  tickets: DeskTicket[];
  deposits: DeskDeposit[];
  lookups: DeskLookup[];
  keys: DeskKey[];
  news: DeskNews[];
  notices: DeskNotice[];
  codes: GiftCode[];
  audit: AuditItem[];
  settings: DeskSettings;
};

function stamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function seed(): DeskState {
  return {
    users: [
      {
        id: "u-estk",
        login: "estk",
        email: "estk@atelier.rx",
        role: "admin",
        status: "active",
        balanceCents: 428000,
        plan: "month",
        apiPlan: "month",
        planUntil: "2026-10-10",
        lookups: 184,
        lastSeen: "now",
        createdAt: "2025-11-02",
        note: "Owner desk.",
      },
      {
        id: "u-alex",
        login: "alex",
        email: "alex@atelier.rx",
        role: "member",
        status: "active",
        balanceCents: 428000,
        plan: "none",
        apiPlan: "none",
        planUntil: null,
        lookups: 12,
        lastSeen: "4m",
        createdAt: "2026-01-14",
        note: "",
      },
      {
        id: "u-nova",
        login: "nova",
        email: "nova@atelier.rx",
        role: "member",
        status: "active",
        balanceCents: 18650,
        plan: "week",
        apiPlan: "none",
        planUntil: "2026-09-16",
        lookups: 41,
        lastSeen: "12m",
        createdAt: "2026-02-20",
        note: "High volume search.",
      },
      {
        id: "u-mira",
        login: "mira",
        email: "mira@atelier.rx",
        role: "member",
        status: "active",
        balanceCents: 0,
        plan: "none",
        apiPlan: "none",
        planUntil: null,
        lookups: 3,
        lastSeen: "1h",
        createdAt: "2026-03-01",
        note: "Waiting on BTC credit.",
      },
      {
        id: "u-jules",
        login: "jules",
        email: "jules@atelier.rx",
        role: "member",
        status: "active",
        balanceCents: 9200,
        plan: "day",
        apiPlan: "month",
        planUntil: "2026-09-11",
        lookups: 268,
        lastSeen: "2h",
        createdAt: "2025-12-08",
        note: "API shop.",
      },
      {
        id: "u-kai",
        login: "kai",
        email: "kai@atelier.rx",
        role: "member",
        status: "banned",
        balanceCents: 1400,
        plan: "none",
        apiPlan: "none",
        planUntil: null,
        lookups: 7,
        lastSeen: "3d",
        createdAt: "2026-02-11",
        note: "Chargeback dispute.",
      },
      {
        id: "u-rio",
        login: "rio",
        email: "rio@atelier.rx",
        role: "member",
        status: "frozen",
        balanceCents: 6100,
        plan: "month",
        apiPlan: "none",
        planUntil: "2026-09-28",
        lookups: 19,
        lastSeen: "6h",
        createdAt: "2026-01-30",
        note: "KYC hold.",
      },
      {
        id: "u-sage",
        login: "sage",
        email: "sage@atelier.rx",
        role: "member",
        status: "active",
        balanceCents: 2500,
        plan: "none",
        apiPlan: "none",
        planUntil: null,
        lookups: 0,
        lastSeen: "1d",
        createdAt: "2026-09-08",
        note: "",
      },
    ],
    tickets: [
      {
        id: 101,
        user: "mira",
        subject: "Deposit not credited",
        status: "Open",
        updated: "2 hours ago",
        preview: "BTC sent, wallet still waiting on the credit.",
        replies: [
          { from: "user", text: "BTC sent, wallet still waiting on the credit.", at: "2026-09-09 22:10" },
        ],
      },
      {
        id: 99,
        user: "jules",
        subject: "Key revoked by mistake",
        status: "Open",
        updated: "Yesterday",
        preview: "Need the production bot restored for staging.",
        replies: [
          { from: "user", text: "Need the production bot restored for staging.", at: "2026-09-08 19:40" },
        ],
      },
      {
        id: 98,
        user: "alex",
        subject: "Subscription question",
        status: "Closed",
        updated: "2026-03-05",
        preview: "Plan is active after the invoice clears.",
        replies: [
          { from: "user", text: "When does the week plan start?", at: "2026-03-04 11:02" },
          { from: "staff", text: "It starts the moment the invoice clears.", at: "2026-03-05 09:18" },
        ],
      },
    ],
    deposits: [
      {
        id: "d-441",
        user: "mira",
        method: "BTC",
        amountCents: 5000,
        status: "pending",
        txid: "3a91…c4e2",
        createdAt: "2026-09-09 21:55",
      },
      {
        id: "d-440",
        user: "nova",
        method: "LTC",
        amountCents: 10000,
        status: "pending",
        txid: "9f12…aa01",
        createdAt: "2026-09-09 18:12",
      },
      {
        id: "d-438",
        user: "alex",
        method: "BTC",
        amountCents: 5000,
        status: "credited",
        txid: "7c20…bb88",
        createdAt: "2026-03-07 11:40",
      },
      {
        id: "d-437",
        user: "kai",
        method: "XMR",
        amountCents: 2500,
        status: "rejected",
        txid: "underpay",
        createdAt: "2026-02-11 16:04",
      },
    ],
    lookups: [
      { id: "l-1", user: "nova", kind: "search", query: "John Smith / IL", hits: 2, costCents: 0, status: "ok", at: "2026-09-09 23:12" },
      { id: "l-2", user: "jules", kind: "ssndob", query: "•••-••-4521", hits: 1, costCents: 250, status: "ok", at: "2026-09-09 22:48" },
      { id: "l-3", user: "alex", kind: "cs", query: "Jane Doe", hits: 1, costCents: 350, status: "ok", at: "2026-09-09 21:03" },
      { id: "l-4", user: "nova", kind: "ssndob", query: "•••-••-8834", hits: 0, costCents: 250, status: "empty", at: "2026-09-09 20:16" },
      { id: "l-5", user: "jules", kind: "search", query: "Rio Hale / TX", hits: 0, costCents: 0, status: "empty", at: "2026-09-09 17:40" },
      { id: "l-6", user: "estk", kind: "cs", query: "smoke test", hits: 1, costCents: 0, status: "ok", at: "2026-09-08 14:22" },
      { id: "l-7", user: "rio", kind: "search", query: "bad payload", hits: 0, costCents: 0, status: "error", at: "2026-09-08 09:11" },
    ],
    keys: [
      { id: "k-1", user: "jules", name: "Production bot", prefix: "rx_live", last4: "9k2m", status: "active", requests: 18420, scopes: ["search", "ssndob"] },
      { id: "k-2", user: "jules", name: "Staging", prefix: "rx_test", last4: "a1c4", status: "active", requests: 640, scopes: ["search"] },
      { id: "k-3", user: "estk", name: "Owner live", prefix: "rx_live", last4: "e7st", status: "active", requests: 220, scopes: ["search", "ssndob", "cs"] },
      { id: "k-4", user: "nova", name: "Webhook worker", prefix: "rx_live", last4: "0q9p", status: "revoked", requests: 88, scopes: ["cs"] },
    ],
    news: [
      {
        id: "n-1",
        title: "Desk is live",
        body: "Search, SSN+DOB, and credit are on mock data until the live API lands.",
        at: "2026-09-08 10:00",
        pinned: true,
        ctaLabel: "Open docs",
        ctaTo: "/docs",
      },
    ],
    notices: [],
    codes: [
      { id: "c-1", code: "RX-WELCOME", amountCents: 2500, status: "open", usedBy: null },
      { id: "c-2", code: "RX-NOVA50", amountCents: 5000, status: "used", usedBy: "nova" },
    ],
    audit: [
      { id: "a-1", text: "estk opened the desk", at: "2026-09-09 23:40" },
      { id: "a-2", text: "jules generated a live key", at: "2026-09-09 16:12" },
    ],
    settings: {
      searchCost: SEARCH_COST,
      ssndobCost: SSNDOB_COST,
      csCost: CS_COST,
      revealCost: REVEAL_COST,
      deskDay: SUBSCRIPTION_PLANS[0].price,
      deskWeek: SUBSCRIPTION_PLANS[1].price,
      deskMonth: SUBSCRIPTION_PLANS[2].price,
      apiDay: API_SUBSCRIPTION_PLANS[0].price,
      apiWeek: API_SUBSCRIPTION_PLANS[1].price,
      apiMonth: API_SUBSCRIPTION_PLANS[2].price,
      maintenance: false,
    },
  };
}

function load(): DeskState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as DeskState;
    return {
      ...seed(),
      ...parsed,
      settings: { ...seed().settings, ...parsed.settings },
    };
  } catch {
    return seed();
  }
}

function save(state: DeskState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function peekAdmin(): DeskState {
  return load();
}

function syncSession(state: DeskState, session: User | null, balanceCents: number): DeskState {
  if (!session) return state;
  const login = normalizeLogin(session.login);
  const role = isAdminLogin(login) || session.role === "admin" ? "admin" : session.role;
  const idx = state.users.findIndex((u) => u.login === login);
  if (idx >= 0) {
    const next = [...state.users];
    next[idx] = {
      ...next[idx],
      role,
      email: session.email || next[idx].email,
      balanceCents,
      lastSeen: "now",
    };
    return { ...state, users: next };
  }
  return {
    ...state,
    users: [
      {
        id: `u-${login}`,
        login,
        email: session.email,
        role,
        status: "active",
        balanceCents,
        plan: "none",
        apiPlan: "none",
        planUntil: null,
        lookups: 0,
        lastSeen: "now",
        createdAt: stamp().slice(0, 10),
        note: "",
      },
      ...state.users,
    ],
  };
}

export type DeskApi = {
  refresh: () => Promise<void>;
  credit: (login: string, cents: number, reason?: string) => void | Promise<void>;
  setUser: (login: string, patch: Partial<DeskUser>) => void | Promise<void>;
  setDeposit: (id: string, status: DepositStatus) => void | Promise<void>;
  replyTicket: (id: number, text: string) => void | Promise<void>;
  closeTicket: (id: number) => void | Promise<void>;
  revokeKey: (id: string) => void | Promise<void>;
  addNews: (title: string, body: string, ctaLabel?: string, ctaTo?: string) => void | Promise<void>;
  editNews: (id: string, title: string, body: string, ctaLabel?: string, ctaTo?: string) => void | Promise<void>;
  togglePin: (id: string) => void | Promise<void>;
  dropNews: (id: string) => void | Promise<void>;
  sendNotice: (author: string, body: string, href?: string, hrefLabel?: string) => void | Promise<void>;
  dropNotice: (id: string) => void | Promise<void>;
  mintCode: (amountCents: number) => void | Promise<void>;
  dropCode: (id: string) => void | Promise<void>;
  saveSettings: (patch: Partial<DeskSettings>) => void | Promise<void>;
};

export function createRemoteDeskApi(onState: (state: DeskState) => void): DeskApi {
  async function refresh() {
    const data = await apiGet<DeskState>("/v1/admin/desk");
    onState(data);
  }
  return {
    refresh,
    async credit(login, cents, reason) {
      await apiPost("/v1/admin/credit", { login, cents, reason });
      await refresh();
    },
    async setUser(login, patch) {
      await apiPost("/v1/admin/user", { login, ...patch });
      await refresh();
    },
    async setDeposit(id, status) {
      await apiPost("/v1/admin/deposit", { id, status });
      await refresh();
    },
    async replyTicket(id, text) {
      await apiPost("/v1/admin/ticket/reply", { id, text });
      await refresh();
    },
    async closeTicket(id) {
      await apiPost("/v1/admin/ticket/close", { id });
      await refresh();
    },
    async revokeKey(id) {
      await apiPost("/v1/admin/key/revoke", { id });
      await refresh();
    },
    async addNews(title, body, ctaLabel = "", ctaTo = "") {
      await apiPost("/v1/admin/news", { title, body, ctaLabel, ctaTo });
      await refresh();
    },
    async editNews(id, title, body, ctaLabel = "", ctaTo = "") {
      await apiPost("/v1/admin/news/edit", { id, title, body, ctaLabel, ctaTo });
      await refresh();
    },
    async togglePin(id) {
      await apiPost("/v1/admin/news/pin", { id });
      await refresh();
    },
    async dropNews(id) {
      await apiPost("/v1/admin/news/drop", { id });
      await refresh();
    },
    async sendNotice(author, body, href = "", hrefLabel = "") {
      await apiPost("/v1/admin/notify", { author, body, href, hrefLabel });
      await refresh();
    },
    async dropNotice(id) {
      await apiPost("/v1/admin/notify/drop", { id });
      await refresh();
    },
    async mintCode(amountCents) {
      await apiPost("/v1/admin/code", { amountCents });
      await refresh();
    },
    async dropCode(id) {
      await apiPost("/v1/admin/code", { id, drop: true });
      await refresh();
    },
    async saveSettings(patch) {
      await apiPost("/v1/admin/settings", patch);
      await refresh();
    },
  };
}

export function createDeskApi(
  session: User | null,
  balanceCents: number,
  onState: (state: DeskState) => void,
  actor: string,
  onSessionBalance?: (cents: number, label: string) => void,
): { initial: DeskState } & DeskApi {
  let current = syncSession(load(), session, balanceCents);
  save(current);

  function commit(next: DeskState, audit?: string) {
    const stamped = audit
      ? { ...next, audit: [{ id: `a-${Date.now()}`, text: audit, at: stamp() }, ...next.audit].slice(0, 40) }
      : next;
    current = stamped;
    save(stamped);
    onState(stamped);
  }

  return {
    initial: current,
    async refresh() {
      current = load();
      onState(current);
    },
    credit(login, cents, reason) {
      const user = current.users.find((u) => u.login === login);
      if (!user) return;
      const nextUsers = current.users.map((u) =>
        u.login === login ? { ...u, balanceCents: u.balanceCents + cents } : u,
      );
      const label = reason || (cents >= 0 ? "Manual credit" : "Manual debit");
      commit({ ...current, users: nextUsers }, `${actor} ${cents >= 0 ? "credited" : "debited"} ${login} ${label}`);
      if (session && normalizeLogin(session.login) === login) onSessionBalance?.(cents, label);
    },
    setUser(login, patch) {
      commit(
        {
          ...current,
          users: current.users.map((u) => (u.login === login ? { ...u, ...patch, login: u.login } : u)),
        },
        `${actor} updated ${login}`,
      );
    },
    setDeposit(id, status) {
      const dep = current.deposits.find((d) => d.id === id);
      if (!dep) return;
      let users = current.users;
      if (status === "credited" && dep.status !== "credited") {
        users = users.map((u) =>
          u.login === dep.user ? { ...u, balanceCents: u.balanceCents + dep.amountCents } : u,
        );
        if (session && normalizeLogin(session.login) === dep.user) {
          onSessionBalance?.(dep.amountCents, `${dep.method} deposit`);
        }
      }
      commit(
        {
          ...current,
          users,
          deposits: current.deposits.map((d) => (d.id === id ? { ...d, status } : d)),
        },
        `${actor} ${status} deposit ${id} for ${dep.user}`,
      );
    },
    replyTicket(id, text) {
      commit({
        ...current,
        tickets: current.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "Open",
                updated: "Just now",
                preview: text,
                replies: [...t.replies, { from: "staff", text, at: stamp() }],
              }
            : t,
        ),
      }, `${actor} replied to #${id}`);
    },
    closeTicket(id) {
      commit({
        ...current,
        tickets: current.tickets.map((t) =>
          t.id === id ? { ...t, status: "Closed", updated: "Just now" } : t,
        ),
      }, `${actor} closed #${id}`);
    },
    revokeKey(id) {
      const key = current.keys.find((k) => k.id === id);
      commit({
        ...current,
        keys: current.keys.map((k) => (k.id === id ? { ...k, status: "revoked" } : k)),
      }, `${actor} revoked key ${key?.name ?? id}`);
    },
    addNews(title, body, ctaLabel = "", ctaTo = "") {
      commit({
        ...current,
        news: [
          { id: `n-${Date.now()}`, title, body, at: stamp(), pinned: false, ctaLabel, ctaTo },
          ...current.news,
        ],
      }, `${actor} posted news`);
    },
    editNews(id, title, body, ctaLabel = "", ctaTo = "") {
      commit({
        ...current,
        news: current.news.map((n) => (n.id === id ? { ...n, title, body, ctaLabel, ctaTo } : n)),
      }, `${actor} edited news`);
    },
    togglePin(id) {
      commit({
        ...current,
        news: current.news.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
      });
    },
    dropNews(id) {
      commit({ ...current, news: current.news.filter((n) => n.id !== id) }, `${actor} removed news`);
    },
    sendNotice(author, body, href = "", hrefLabel = "") {
      commit({
        ...current,
        notices: [
          { id: `nt-${Date.now()}`, author: author || "rxlookup", body, href, hrefLabel, at: stamp() },
          ...current.notices,
        ],
      }, `${actor} sent a notice`);
    },
    dropNotice(id) {
      commit({ ...current, notices: current.notices.filter((n) => n.id !== id) }, `${actor} dropped a notice`);
    },
    mintCode(amountCents) {
      const code = `RX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      commit({
        ...current,
        codes: [{ id: `c-${Date.now()}`, code, amountCents, status: "open", usedBy: null }, ...current.codes],
      }, `${actor} minted ${code}`);
    },
    dropCode(id) {
      commit({ ...current, codes: current.codes.filter((c) => c.id !== id) }, `${actor} dropped a code`);
    },
    saveSettings(patch) {
      commit({ ...current, settings: { ...current.settings, ...patch } }, `${actor} saved desk settings`);
    },
  };
}
