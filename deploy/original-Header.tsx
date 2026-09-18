import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LifeBuoy,
  Menu,
  MessageCircle,
  PanelLeft,
  Plus,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./ui";
import { formatUsd } from "@/lib/format";
import { useApp } from "@/lib/store";

export function Header({ onSidebar }: { onSidebar?: () => void }) {
  const app = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const inCatalog = loc.pathname.startsWith("/catalog");
  const inMessages = loc.pathname.startsWith("/messages");
  const support = inMessages && new URLSearchParams(loc.search).get("with") === "support";

  return (
    <header className="header">
      {onSidebar ? (
        <button className="side-btn" type="button" aria-label="Open sidebar" onClick={onSidebar}>
          <PanelLeft size={18} />
        </button>
      ) : null}

      <Logo />

      <nav className="header__tabs" aria-label="Sections">
        <NavLink
          to="/catalog"
          className={() =>
            `tab${inCatalog && app.catalogTab !== "atelier" && loc.search.indexOf("atelier") === -1 ? " tab_active" : ""}`
          }
          onClick={() => app.setCatalogTab("market")}
        >
          <Store size={14} />
          <span className="label">Market</span>
        </NavLink>
        <NavLink
          to="/catalog?tab=atelier"
          className={() => `tab${app.catalogTab === "atelier" ? " tab_active" : ""}`}
          onClick={() => app.setCatalogTab("atelier")}
        >
          <span className="label">Atelier</span>
        </NavLink>
        <NavLink
          to="/messages"
          className={() => `tab${inMessages && !support ? " tab_active" : ""}`}
        >
          <MessageCircle size={14} />
          <span className="label">Chat</span>
          {app.unreadChats > 0 ? <span className="tab__badge">{app.unreadChats}</span> : null}
        </NavLink>
        <NavLink
          to="/messages?with=support"
          className={() => `tab${support ? " tab_active" : ""}`}
        >
          <LifeBuoy size={14} />
          <span className="label">Support</span>
        </NavLink>
        {app.user?.hasShop ? (
          <NavLink
            to="/profile?section=studio"
            className={({ isActive }) => `tab${isActive && loc.search.includes("studio") ? " tab_active" : ""}`}
          >
            <span className="label">Studio</span>
          </NavLink>
        ) : null}
      </nav>

      <div className="header__user">
        <div className="header__actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => {
              app.toggleNotes(true);
              app.markNotesRead();
            }}
          >
            <Bell size={17} />
            {app.unreadNotes > 0 ? <span className="icon-btn__badge">{app.unreadNotes}</span> : null}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Tray"
            onClick={() => app.toggleCart(true)}
          >
            <ShoppingBag size={17} />
            {app.cartCount > 0 ? <span className="icon-btn__badge">{app.cartCount}</span> : null}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Messages"
            onClick={() => nav("/messages")}
          >
            <MessageCircle size={17} />
            {app.unreadChats > 0 ? <span className="icon-btn__badge">{app.unreadChats}</span> : null}
          </button>
        </div>

        <Link to="/profile?section=wallet" className="topup">
          <Plus size={14} />
          Top up
        </Link>

        <Link to="/profile" className="account">
          <Avatar initials={(app.user?.displayName ?? "R").slice(0, 2).toUpperCase()} />
          <span className="account__meta">
            <span className="account__nick">{app.user?.login}</span>
            <span className="account__bal">{formatUsd(app.balanceCents)}</span>
          </span>
        </Link>

        <button
          className="menu-btn"
          type="button"
          aria-label="Open menu"
          onClick={() => app.toggleMenu(true)}
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
