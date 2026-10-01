export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = "rx.token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function apiUrl(path: string) {
  return path.startsWith("http") ? path : `${import.meta.env.VITE_API_BASE || ""}${path}`;
}

async function readBody(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { detail: text };
  }
}

function messageOf(body: Record<string, unknown>, fallback: string) {
  const err = body.error as { message?: string } | undefined;
  const detail = body.detail;
  if (typeof err?.message === "string" && err.message) return err.message;
  if (typeof detail === "string" && detail) return detail;
  return fallback;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { ...init, headers });
  const body = await readBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, messageOf(body, res.statusText || "Request failed"), body);
  }
  return body as T;
}

export function apiGet<T = unknown>(path: string) {
  return apiFetch<T>(path);
}

export function apiPost<T = unknown>(path: string, json?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: json === undefined ? undefined : JSON.stringify(json) });
}

export function apiDelete<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

export type ApiUser = {
  id: number;
  login: string;
  email: string;
  role: "member" | "admin";
  status: string;
  balance_cents: number;
  plan: string;
  plan_until: string | null;
  api_plan: string;
  api_plan_until: string | null;
  lookups: number;
  referrals: number;
  referral_earned_cents: number;
  telegram: boolean;
  telegram_username?: string;
  avatar?: string;
  secret_last4?: string;
  created_at: string;
};

export type Pricing = {
  search: number;
  ssndob: number;
  credit: number;
  desk: { day: number; week: number; month: number };
  api: { day: number; week: number; month: number };
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  pinned: boolean;
  at: string;
};

export type HistoryItem = {
  id: number;
  type: string;
  amount: number;
  date: string;
  status: string;
};

export type LookupItem = {
  id: number;
  kind: string;
  query: string;
  hits: number;
  cost_cents: number;
  status: string;
  at: string;
};
