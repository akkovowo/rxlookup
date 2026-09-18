export type ApiScope = "search" | "ssndob" | "cs";
export type ApiEnv = "live" | "test";
export type ApiKeyStatus = "active" | "revoked";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsed: string | null;
  requests: number;
  status: ApiKeyStatus;
  scopes: ApiScope[];
  env: ApiEnv;
};

const KEY = "rx.apiKeys";

const SEED: ApiKey[] = [
  {
    id: "k1",
    name: "Production bot",
    prefix: "rx_live_7k2m",
    last4: "9f2a",
    createdAt: "2026-02-12",
    lastUsed: "2 hours ago",
    requests: 12842,
    status: "active",
    scopes: ["search", "ssndob", "cs"],
    env: "live",
  },
  {
    id: "k2",
    name: "Staging tests",
    prefix: "rx_test_p0wq",
    last4: "c31e",
    createdAt: "2026-03-01",
    lastUsed: "Yesterday",
    requests: 340,
    status: "active",
    scopes: ["search"],
    env: "test",
  },
  {
    id: "k3",
    name: "Webhook worker",
    prefix: "rx_live_n8aa",
    last4: "b704",
    createdAt: "2025-11-18",
    lastUsed: "18 days ago",
    requests: 51990,
    status: "revoked",
    scopes: ["search", "ssndob"],
    env: "live",
  },
];

export function loadApiKeys(): ApiKey[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as ApiKey[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

export function saveApiKeys(keys: ApiKey[]) {
  localStorage.setItem(KEY, JSON.stringify(keys));
}

function randChunk(len: number) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function mintSecret(env: ApiEnv) {
  const head = env === "live" ? "rx_live" : "rx_test";
  const body = `${randChunk(8)}${randChunk(8)}${randChunk(8)}`;
  const secret = `${head}_${body}`;
  return {
    secret,
    prefix: `${head}_${body.slice(0, 4)}`,
    last4: body.slice(-4),
  };
}
