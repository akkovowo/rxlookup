import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CONVERSATIONS,
  EDITIONS,
  MESSAGES,
  PRODUCTS,
  STARTER_PURCHASES,
  STARTER_WALLET,
} from "./data";
import { apiGet, apiPost, getToken, setToken, type ApiUser, type NewsItem, type Pricing } from "./api";
import { nowLabel, sleep } from "./format";
import { CS_COST, SSNDOB_COST } from "./mock";
import type {
  CartItem,
  CategoryId,
  ChatMessage,
  Conversation,
  NotificationItem,
  Product,
  Purchase,
  WalletTx,
} from "./types";

const AUTH_KEY = "rx.auth";
const STATE_KEY = "rx.state";

export type User = {
  login: string;
  displayName: string;
  email: string;
  role: "member" | "admin";
  hasShop: boolean;
  city: string;
  avatar: string;
  secretLast4: string;
  telegramUsername: string;
};

type Persisted = {
  user: User | null;
  balanceCents: number;
  cart: CartItem[];
  favorites: string[];
  purchases: Purchase[];
  wallet: WalletTx[];
  notifications: NotificationItem[];
  conversations: Conversation[];
  messages: ChatMessage[];
};

type CatalogTab = "market" | "atelier";

type AppState = {
  hydrating: boolean;
  user: User | null;
  balanceCents: number;
  cart: CartItem[];
  favorites: string[];
  purchases: Purchase[];
  wallet: WalletTx[];
  notifications: NotificationItem[];
  conversations: Conversation[];
  messages: ChatMessage[];
  catalogTab: CatalogTab;
  search: string;
  sort: "default" | "price_asc" | "price_desc" | "newest";
  category: CategoryId | null;
  selectedProduct: Product | null;
  cartOpen: boolean;
  notesOpen: boolean;
  menuOpen: boolean;
  sidebarOpen: boolean;
  toast: { text: string; icon?: string } | null;
  deskActive: boolean;
  apiActive: boolean;
  planUntil: string | null;
  apiPlanUntil: string | null;
  lookups: number;
  referrals: number;
  referralEarnedCents: number;
  telegram: boolean;
  telegramUsername: string;
  startTelegramLink: () => Promise<{
    code: string;
    bot: string;
    deep_link: string;
    tg_link: string;
    telegram?: boolean;
    username?: string;
  }>;
  maintenance: boolean;
  news: NewsItem[];
  pricing: Pricing;
  refreshMe: () => Promise<void>;
  subscribe: (kind: "desk" | "api", plan: "day" | "week" | "month") => Promise<void>;
  createDeposit: (method: string, amount: number) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  setTelegram: (linked: boolean) => Promise<void>;
  setAvatar: (avatar: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  loginWithKey: (key: string) => Promise<void>;
  register: (login: string, password: string) => Promise<string>;
  rotateSecret: () => Promise<string>;
  logout: () => void;
  setSearch: (v: string) => void;
  setSort: (v: AppState["sort"]) => void;
  setCategory: (v: CategoryId | null) => void;
  setCatalogTab: (v: CatalogTab) => void;
  openProduct: (p: Product | null) => void;
  addToCart: (id: string) => Promise<void>;
  removeFromCart: (id: string) => void;
  toggleCart: (open?: boolean) => void;
  toggleFavorite: (id: string) => Promise<void>;
  buyNow: (id: string) => Promise<void>;
  checkout: () => Promise<void>;
  topUp: (cents: number) => Promise<void>;
  adjustBalance: (cents: number, label: string) => void;
  toggleNotes: (open?: boolean) => void;
  markNotesRead: () => void;
  toggleMenu: (open?: boolean) => void;
  toggleSidebar: (open?: boolean) => void;
  sendMessage: (conversationId: string, text: string) => void;
  openConversation: (id: string) => void;
  showToast: (text: string, icon?: string) => void;
  updateProfile: (patch: Partial<User>) => void;
  products: Product[];
  editions: Product[];
  filtered: Product[];
  cartCount: number;
  cartTotal: number;
  unreadNotes: number;
  unreadChats: number;
};

const Ctx = createContext<AppState | null>(null);

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const user = raw ? (JSON.parse(raw) as User) : null;
    if (!user) return null;
    return { ...user, avatar: user.avatar || "", secretLast4: user.secretLast4 || "", telegramUsername: user.telegramUsername || "" };
  } catch {
    return null;
  }
}

const DEFAULT_PRICING: Pricing = {
  search: 0,
  ssndob: SSNDOB_COST,
  credit: CS_COST,
  desk: { day: 15, week: 45, month: 120 },
  api: { day: 30, week: 90, month: 240 },
};

function mapUser(row: ApiUser): User {
  return {
    login: row.login,
    displayName: row.login,
    email: row.email,
    role: row.role === "admin" ? "admin" : "member",
    hasShop: true,
    city: "",
    avatar: row.avatar || "",
    secretLast4: row.secret_last4 || "",
    telegramUsername: row.telegram_username || "",
  };
}

type ApiNotice = {
  id: string;
  author?: string;
  body: string;
  href?: string;
  hrefLabel?: string;
  at: string;
  read?: boolean;
};

function mapNotice(row: ApiNotice): NotificationItem {
  return {
    id: row.id,
    title: row.author || "rxlookup",
    author: row.author || "rxlookup",
    body: row.body,
    href: row.href || "",
    hrefLabel: row.hrefLabel || "",
    time: row.at,
    read: Boolean(row.read),
  };
}

async function loadNotices() {
  const data = await apiGet<{ items: ApiNotice[] }>("/v1/notifications");
  return (data.items || []).map(mapNotice);
}

function pendingTicket() {
  try {
    return new URLSearchParams(window.location.search).get("ticket") || "";
  } catch {
    return "";
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted();
  const [hydrating, setHydrating] = useState(() => Boolean(getToken() || loadUser() || pendingTicket()));
  const [user, setUser] = useState<User | null>(loadUser);
  const [balanceCents, setBalance] = useState(persisted.balanceCents ?? 0);
  const [deskActive, setDeskActive] = useState(false);
  const [apiActive, setApiActive] = useState(false);
  const [planUntil, setPlanUntil] = useState<string | null>(null);
  const [apiPlanUntil, setApiPlanUntil] = useState<string | null>(null);
  const [lookups, setLookups] = useState(0);
  const [referrals, setReferrals] = useState(0);
  const [referralEarnedCents, setReferralEarned] = useState(0);
  const [telegram, setTelegramState] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [cart, setCart] = useState<CartItem[]>(persisted.cart ?? []);
  const [favorites, setFavorites] = useState<string[]>(persisted.favorites ?? ["p1"]);
  const [purchases, setPurchases] = useState<Purchase[]>(persisted.purchases ?? STARTER_PURCHASES);
  const [wallet, setWallet] = useState<WalletTx[]>(persisted.wallet ?? STARTER_WALLET);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(
    persisted.conversations ?? CONVERSATIONS,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(persisted.messages ?? MESSAGES);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "atelier"
      ? "atelier"
      : "market",
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AppState["sort"]>("default");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; icon?: string } | null>(null);

  const persist = useCallback(
    (next: Partial<Persisted> & { user?: User | null }) => {
      const snapshot: Persisted = {
        user: next.user === undefined ? user : next.user,
        balanceCents: next.balanceCents ?? balanceCents,
        cart: next.cart ?? cart,
        favorites: next.favorites ?? favorites,
        purchases: next.purchases ?? purchases,
        wallet: next.wallet ?? wallet,
        notifications: next.notifications ?? notifications,
        conversations: next.conversations ?? conversations,
        messages: next.messages ?? messages,
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(snapshot));
      if (next.user !== undefined) {
        if (next.user) localStorage.setItem(AUTH_KEY, JSON.stringify(next.user));
        else localStorage.removeItem(AUTH_KEY);
      }
    },
    [user, balanceCents, cart, favorites, purchases, wallet, notifications, conversations, messages],
  );

  const applyUser = useCallback(
    (row: ApiUser, extras?: { desk_active?: boolean; api_active?: boolean; maintenance?: boolean }) => {
      const next = mapUser(row);
      setUser(next);
      setBalance(row.balance_cents);
      setDeskActive(Boolean(extras?.desk_active));
      setApiActive(Boolean(extras?.api_active));
      setPlanUntil(row.plan_until);
      setApiPlanUntil(row.api_plan_until);
      setLookups(row.lookups);
      setReferrals(row.referrals);
      setReferralEarned(row.referral_earned_cents);
      setTelegramState(Boolean(row.telegram));
      setTelegramUsername(row.telegram_username || "");
      if (extras?.maintenance !== undefined) setMaintenance(Boolean(extras.maintenance));
      persist({ user: next, balanceCents: row.balance_cents });
    },
    [persist],
  );

  const refreshMe = useCallback(async () => {
    if (!getToken()) return;
    const me = await apiGet<{
      user: ApiUser;
      desk_active: boolean;
      api_active: boolean;
      maintenance: boolean;
    }>("/v1/me");
    applyUser(me.user, me);
    try {
      const feed = await apiGet<{ news: NewsItem[]; maintenance: boolean }>("/v1/news");
      setNews(feed.news);
      setMaintenance(Boolean(feed.maintenance));
    } catch {
      /* ignore */
    }
    try {
      setNotifications(await loadNotices());
    } catch {
      /* ignore */
    }
  }, [applyUser]);

  const showToast = useCallback((text: string, icon?: string) => {
    setToast({ text, icon });
    window.setTimeout(() => setToast((cur) => (cur?.text === text ? null : cur)), 2800);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const ticket = pendingTicket();
      if (ticket) {
        try {
          const data = await apiPost<{ token: string; user: ApiUser }>("/v1/auth/telegram/ticket", { ticket });
          setToken(data.token);
          const url = new URL(window.location.href);
          url.searchParams.delete("ticket");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch {
          /* expired ticket — fall through to guest */
        }
      }
      try {
        const prices = await apiGet<Pricing>("/v1/pricing");
        if (!cancelled) setPricing(prices);
      } catch {
        /* keep defaults */
      }
      try {
        const feed = await apiGet<{ news: NewsItem[]; maintenance: boolean }>("/v1/news");
        if (!cancelled) {
          setNews(feed.news);
          setMaintenance(Boolean(feed.maintenance));
        }
      } catch {
        /* ignore */
      }
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          persist({ user: null });
          setHydrating(false);
        }
        return;
      }
      try {
        const me = await apiGet<{
          user: ApiUser;
          desk_active: boolean;
          api_active: boolean;
          maintenance: boolean;
        }>("/v1/me");
        if (cancelled) return;
        applyUser(me.user, me);
        try {
          const notes = await loadNotices();
          if (!cancelled) setNotifications(notes);
        } catch {
          /* ignore */
        }
      } catch {
        setToken(null);
        if (!cancelled) {
          setUser(null);
          persist({ user: null });
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      void loadNotices().then(setNotifications).catch(() => undefined);
    }, 40_000);
    return () => window.clearInterval(id);
  }, [user]);

  const login = useCallback(
    async (loginName: string, password: string) => {
      const data = await apiPost<{ token: string; user: ApiUser }>("/v1/auth/login", {
        login: loginName,
        password,
      });
      setToken(data.token);
      applyUser(data.user);
      try {
        localStorage.setItem("rx.lastActive", String(Date.now()));
        sessionStorage.setItem("rx.welcomeAt", String(Date.now()));
      } catch {
        /* ignore */
      }
      await refreshMe();
      showToast(`Welcome back, ${data.user.login}`, "welcome");
    },
    [applyUser, refreshMe, showToast],
  );

  const register = useCallback(
    async (loginName: string, password: string) => {
      const ref = new URLSearchParams(window.location.search).get("ref") || "";
      const data = await apiPost<{ token: string; user: ApiUser; secret: string }>("/v1/auth/register", {
        login: loginName,
        password,
        ref,
      });
      setToken(data.token);
      try {
        localStorage.setItem("rx.lastActive", String(Date.now()));
        sessionStorage.setItem("rx.welcomeAt", String(Date.now()));
      } catch {
        /* ignore */
      }
      return data.secret;
    },
    [],
  );

  const loginWithKey = useCallback(
    async (key: string) => {
      const data = await apiPost<{ token: string; user: ApiUser }>("/v1/auth/key", { key });
      setToken(data.token);
      applyUser(data.user);
      try {
        localStorage.setItem("rx.lastActive", String(Date.now()));
        sessionStorage.setItem("rx.welcomeAt", String(Date.now()));
      } catch {
        /* ignore */
      }
      await refreshMe();
      showToast(`Welcome back, ${data.user.login}`, "welcome");
    },
    [applyUser, refreshMe, showToast],
  );

  const rotateSecret = useCallback(async () => {
    const data = await apiPost<{ secret: string; secret_last4: string }>("/v1/me/secret");
    setUser((cur) => (cur ? { ...cur, secretLast4: data.secret_last4 || "" } : cur));
    await refreshMe();
    return data.secret;
  }, [refreshMe]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setDeskActive(false);
    setApiActive(false);
    persist({ user: null });
  }, [persist]);

  const subscribe = useCallback(
    async (kind: "desk" | "api", plan: "day" | "week" | "month") => {
      const data = await apiPost<{ user: ApiUser }>("/v1/subscribe", { kind, plan });
      applyUser(data.user, {
        desk_active: kind === "desk" ? true : deskActive,
        api_active: kind === "api" ? true : apiActive,
      });
      await refreshMe();
      showToast(`${kind === "api" ? "API" : "Desk"} plan is active`, "saved");
    },
    [apiActive, applyUser, deskActive, refreshMe, showToast],
  );

  const createDeposit = useCallback(async (method: string, amount: number) => {
    await apiPost("/v1/deposits", { method, amount });
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    await apiPost("/v1/me/password", { current, next });
    showToast("Password updated", "key");
  }, [showToast]);

  const startTelegramLink = useCallback(async () => {
    const data = await apiPost<{
      code: string;
      bot: string;
      deep_link: string;
      tg_link: string;
      telegram?: boolean;
      username?: string;
    }>("/v1/me/telegram/start");
    if (data.telegram) {
      setTelegramState(true);
      setTelegramUsername(data.username || telegramUsername);
    }
    return data;
  }, [telegramUsername]);

  const setTelegram = useCallback(async (linked: boolean) => {
    if (linked) {
      await startTelegramLink();
      return;
    }
    await apiPost("/v1/me/telegram", { linked: false });
    setTelegramState(false);
    setTelegramUsername("");
    showToast("Telegram unlinked");
  }, [showToast, startTelegramLink]);

  const setAvatar = useCallback(
    async (avatar: string) => {
      const data = await apiPost<{ avatar: string; user: ApiUser }>("/v1/me/avatar", { avatar });
      if (user) {
        const next = { ...user, avatar: data.avatar || data.user.avatar || avatar };
        setUser(next);
        persist({ user: next });
      } else {
        applyUser(data.user);
      }
      showToast("Avatar saved", "saved");
    },
    [applyUser, persist, showToast, user],
  );

  const deleteAccount = useCallback(async () => {
    await apiPost("/v1/me/delete");
    setToken(null);
    setUser(null);
    persist({ user: null });
    showToast("Account deleted");
  }, [persist, showToast]);

  const addToCart = useCallback(
    async (id: string) => {
      await sleep(280);
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === id);
        const next = existing
          ? prev.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i))
          : [...prev, { productId: id, qty: 1 }];
        persist({ cart: next });
        return next;
      });
      showToast("Added to tray");
    },
    [persist, showToast],
  );

  const removeFromCart = useCallback(
    (id: string) => {
      setCart((prev) => {
        const next = prev.filter((i) => i.productId !== id);
        persist({ cart: next });
        return next;
      });
    },
    [persist],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      await sleep(180);
      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
        persist({ favorites: next });
        return next;
      });
    },
    [persist],
  );

  const completeBuy = useCallback(
    (product: Product) => {
      if (balanceCents < product.priceCents) {
        throw new Error("Insufficient balance. Top up from Wallet.");
      }
      const nextBalance = balanceCents - product.priceCents;
      const purchase: Purchase = {
        id: `o-${Date.now()}`,
        productId: product.id,
        title: product.title,
        sellerLogin: product.sellerLogin,
        priceCents: product.priceCents,
        date: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        status: "escrow",
      };
      const tx: WalletTx = {
        id: `w-${Date.now()}`,
        label: product.title,
        amountCents: -product.priceCents,
        date: purchase.date,
        kind: "debit",
      };
      setBalance(nextBalance);
      setPurchases((p) => [purchase, ...p]);
      setWallet((w) => [tx, ...w]);
      persist({
        balanceCents: nextBalance,
        purchases: [purchase, ...purchases],
        wallet: [tx, ...wallet],
      });
      showToast("Held in escrow");
    },
    [balanceCents, persist, purchases, showToast, wallet],
  );

  const buyNow = useCallback(
    async (id: string) => {
      await sleep(640);
      const product = [...PRODUCTS, ...EDITIONS].find((p) => p.id === id);
      if (!product || product.isSoldOut) throw new Error("This listing is no longer available.");
      completeBuy(product);
    },
    [completeBuy],
  );

  const checkout = useCallback(async () => {
    await sleep(780);
    const items = cart
      .map((c) => ({ ...c, product: [...PRODUCTS, ...EDITIONS].find((p) => p.id === c.productId) }))
      .filter((c): c is typeof c & { product: Product } => Boolean(c.product));
    const total = items.reduce((s, i) => s + i.product.priceCents * i.qty, 0);
    if (balanceCents < total) throw new Error("Insufficient balance. Top up from Wallet.");
    const date = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const newPurchases: Purchase[] = items.map((item, index) => ({
      id: `o-${Date.now()}-${index}`,
      productId: item.product.id,
      title: item.product.title,
      sellerLogin: item.product.sellerLogin,
      priceCents: item.product.priceCents * item.qty,
      date,
      status: "escrow",
    }));
    const txs: WalletTx[] = items.map((item, index) => ({
      id: `w-${Date.now()}-${index}`,
      label: item.product.title,
      amountCents: -(item.product.priceCents * item.qty),
      date,
      kind: "debit",
    }));
    const nextBalance = balanceCents - total;
    setBalance(nextBalance);
    setPurchases((p) => [...newPurchases, ...p]);
    setWallet((w) => [...txs, ...w]);
    setCart([]);
    persist({
      balanceCents: nextBalance,
      purchases: [...newPurchases, ...purchases],
      wallet: [...txs, ...wallet],
      cart: [],
    });
    setCartOpen(false);
    showToast("Held in escrow");
  }, [balanceCents, cart, persist, purchases, showToast, wallet]);

  const adjustBalance = useCallback(
    (cents: number, label: string) => {
      const next = balanceCents + cents;
      const tx: WalletTx = {
        id: `w-${Date.now()}`,
        label,
        amountCents: cents,
        date: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        kind: cents >= 0 ? "credit" : "debit",
      };
      setBalance(next);
      setWallet((w) => [tx, ...w]);
      persist({ balanceCents: next, wallet: [tx, ...wallet] });
    },
    [balanceCents, persist, wallet],
  );

  const topUp = useCallback(
    async (cents: number) => {
      await createDeposit("BTC", cents / 100);
      showToast("Invoice opened — waiting on credit");
    },
    [createDeposit, showToast],
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        conversationId,
        from: "me",
        text,
        time: nowLabel(),
      };
      const nextMessages = [...messages, msg];
      const nextConvos = conversations.map((c) =>
        c.id === conversationId ? { ...c, preview: text, time: msg.time, unread: 0 } : c,
      );
      setMessages(nextMessages);
      setConversations(nextConvos);
      persist({ messages: nextMessages, conversations: nextConvos });
    },
    [conversations, messages, persist],
  );

  const openConversation = useCallback(
    (id: string) => {
      const next = conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
      setConversations(next);
      persist({ conversations: next });
    },
    [conversations, persist],
  );

  const updateProfile = useCallback(
    (patch: Partial<User>) => {
      if (!user) return;
      const next = { ...user, ...patch };
      setUser(next);
      persist({ user: next });
      showToast("Profile saved");
    },
    [persist, showToast, user],
  );

  const catalog = catalogTab === "atelier" ? EDITIONS : PRODUCTS;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = catalog.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sellerLogin.toLowerCase().includes(q)
      );
    });
    if (sort === "price_asc") list = [...list].sort((a, b) => a.priceCents - b.priceCents);
    if (sort === "price_desc") list = [...list].sort((a, b) => b.priceCents - a.priceCents);
    if (sort === "newest") list = [...list].reverse();
    return list;
  }, [catalog, category, search, sort]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => {
    const p = [...PRODUCTS, ...EDITIONS].find((x) => x.id === i.productId);
    return s + (p ? p.priceCents * i.qty : 0);
  }, 0);
  const unreadNotes = notifications.filter((n) => !n.read).length;
  const unreadChats = conversations.reduce((s, c) => s + c.unread, 0);

  const value: AppState = {
    hydrating,
    user,
    balanceCents,
    cart,
    favorites,
    purchases,
    wallet,
    notifications,
    conversations,
    messages,
    catalogTab,
    search,
    sort,
    category,
    selectedProduct,
    cartOpen,
    notesOpen,
    menuOpen,
    sidebarOpen,
    toast,
    deskActive,
    apiActive,
    planUntil,
    apiPlanUntil,
    lookups,
    referrals,
    referralEarnedCents,
    telegram,
    telegramUsername,
    startTelegramLink,
    maintenance,
    news,
    pricing,
    refreshMe,
    subscribe,
    createDeposit,
    changePassword,
    setTelegram,
    setAvatar,
    deleteAccount,
    login,
    loginWithKey,
    register,
    rotateSecret,
    logout,
    setSearch,
    setSort,
    setCategory,
    setCatalogTab,
    openProduct: setSelectedProduct,
    addToCart,
    removeFromCart,
    toggleCart: (open) => setCartOpen(open ?? ((v) => !v)),
    toggleFavorite,
    buyNow,
    checkout,
    topUp,
    adjustBalance,
    toggleNotes: (open) => setNotesOpen(open ?? ((v) => !v)),
    markNotesRead: () => {
      const next = notifications.map((n) => ({ ...n, read: true }));
      setNotifications(next);
      persist({ notifications: next });
      if (getToken()) {
        void apiPost("/v1/notifications/read", { all: true }).catch(() => undefined);
      }
    },
    toggleMenu: (open) => setMenuOpen(open ?? ((v) => !v)),
    toggleSidebar: (open) => setSidebarOpen(open ?? ((v) => !v)),
    sendMessage,
    openConversation,
    showToast,
    updateProfile,
    products: PRODUCTS,
    editions: EDITIONS,
    filtered,
    cartCount,
    cartTotal,
    unreadNotes,
    unreadChats,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function findProduct(id: string) {
  return [...PRODUCTS, ...EDITIONS].find((p) => p.id === id);
}
