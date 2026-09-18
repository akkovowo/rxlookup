export type CategoryId = "searches";

export type Product = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  sellerLogin: string;
  sellerInitials: string;
  sellerOnline: boolean;
  sellerTrusted: boolean;
  category: CategoryId;
  stock: number;
  image: string;
  condition: string;
  year: string;
  origin: string;
  isHot?: boolean;
  isSoldOut?: boolean;
  edition?: boolean;
};

export type Seller = {
  login: string;
  name: string;
  initials: string;
  bio: string;
  city: string;
  rating: number;
  sales: number;
  online: boolean;
  trusted: boolean;
  joined: string;
};

export type Conversation = {
  id: string;
  title: string;
  preview: string;
  time: string;
  unread: number;
  kind: "direct" | "group" | "support";
  initials: string;
  online?: boolean;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  from: "me" | "them";
  text: string;
  time: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  author: string;
  body: string;
  href: string;
  hrefLabel: string;
  time: string;
  read: boolean;
};

export type Purchase = {
  id: string;
  productId: string;
  title: string;
  sellerLogin: string;
  priceCents: number;
  date: string;
  status: "delivered" | "in-transit" | "escrow";
};

export type CartItem = {
  productId: string;
  qty: number;
};

export type WalletTx = {
  id: string;
  label: string;
  amountCents: number;
  date: string;
  kind: "credit" | "debit";
};

export type FaqItem = {
  id: string;
  question: string;
  hint: string;
  answer: string[];
};
