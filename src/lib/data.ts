import type {
  CategoryId,
  ChatMessage,
  Conversation,
  FaqItem,
  NotificationItem,
  Product,
  Purchase,
  Seller,
  WalletTx,
} from "./types";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "searches", label: "Searches" },
];

export const SELLERS: Seller[] = [
  {
    login: "rx.desk",
    name: "RX Desk",
    initials: "RX",
    bio: "Verified search listings with clear scope and delivery notes.",
    city: "Remote",
    rating: 4.97,
    sales: 128,
    online: true,
    trusted: true,
    joined: "2024",
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    title: "Search test",
    description: "Demo listing for a single search package. Scope and fields are defined in the listing note.",
    priceCents: 1200,
    sellerLogin: "rx.desk",
    sellerInitials: "RX",
    sellerOnline: true,
    sellerTrusted: true,
    category: "searches",
    stock: 1,
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    condition: "Live",
    year: "2026",
    origin: "Global",
    isHot: true,
  },
];

export const EDITIONS: Product[] = [];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "support",
    title: "RX Support",
    preview: "Your search test order is ready to review.",
    time: "12:14",
    unread: 1,
    kind: "support",
    initials: "RX",
    online: true,
  },
  {
    id: "c-desk",
    title: "rx.desk",
    preview: "The search test listing is still active.",
    time: "11:02",
    unread: 0,
    kind: "direct",
    initials: "RX",
    online: true,
  },
];

export const MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    conversationId: "support",
    from: "them",
    text: "Welcome to RX. Purchases sit in escrow until you confirm the search result arrived as described.",
    time: "09:10",
  },
  {
    id: "m2",
    conversationId: "support",
    from: "me",
    text: "Could you confirm the fields included in Search test?",
    time: "11:40",
  },
  {
    id: "m3",
    conversationId: "support",
    from: "them",
    text: "Your search test order is ready to review.",
    time: "12:14",
  },
  {
    id: "m4",
    conversationId: "c-desk",
    from: "them",
    text: "The search test listing is still active. Write if you need a hold.",
    time: "11:02",
  },
];

export const NOTIFICATIONS: NotificationItem[] = [];

export const STARTER_PURCHASES: Purchase[] = [
  {
    id: "o1",
    productId: "p1",
    title: "Search test",
    sellerLogin: "rx.desk",
    priceCents: 1200,
    date: "2 Sep 2026",
    status: "delivered",
  },
];

export const STARTER_WALLET: WalletTx[] = [
  {
    id: "w1",
    label: "Opening balance",
    amountCents: 428000,
    date: "1 Sep 2026",
    kind: "credit",
  },
  {
    id: "w2",
    label: "Search test",
    amountCents: -1200,
    date: "2 Sep 2026",
    kind: "debit",
  },
];

export const FAQ: FaqItem[] = [
  {
    id: "what",
    question: "What is listed on RX?",
    hint: "Verified searches",
    answer: [
      "The Searches tab holds search packages from named providers.",
      "Every listing names the provider, the scope, and the delivery format in plain language.",
    ],
  },
  {
    id: "trust",
    question: "How are providers verified?",
    hint: "Trusted mark and sales history",
    answer: [
      "Trusted providers complete review and keep a return rate below our threshold.",
      "High-value searches may require a delivery note before escrow releases.",
    ],
  },
  {
    id: "wallet",
    question: "How does the wallet work?",
    hint: "Balance, escrow, top up",
    answer: [
      "Purchases debit your RX balance. Funds sit in escrow until you confirm delivery or the inspection window closes.",
      "Top up from Profile → Wallet. This demo credits instantly so you can feel the interface.",
    ],
  },
  {
    id: "escrow",
    question: "What if a search is not as described?",
    hint: "Inspection window",
    answer: [
      "Open a note with Support within 48 hours of delivery. If the listing was materially wrong, escrow returns to your wallet.",
      "Scope notes already in the listing are not grounds for return.",
    ],
  },
  {
    id: "chat",
    question: "Can I write to a provider before buying?",
    hint: "Chat from any listing",
    answer: [
      "Yes. Use the message action on a row, or open Chat in the header.",
      "Support is a separate tab and always reachable.",
    ],
  },
  {
    id: "ship",
    question: "How is delivery handled?",
    hint: "Provider delivers, RX tracks",
    answer: [
      "Providers deliver through the order thread. Status appears in My purchases once delivery starts.",
    ],
  },
];

export const BANNERS = [
  {
    id: "b1",
    title: "Search test",
    kicker: "RX Desk",
    text: "One live listing in the catalog for interface testing.",
  },
];
