import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowUpRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Drawer } from "./Overlay";
import { Button, Empty } from "./ui";
import { formatUsd } from "@/lib/format";
import { RichText } from "@/lib/richText";
import { findProduct, useApp } from "@/lib/store";

export function CartDrawer() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = app.cart
    .map((c) => ({ ...c, product: findProduct(c.productId) }))
    .filter((c) => c.product);

  return (
    <Drawer
      open={app.cartOpen}
      onClose={() => app.toggleCart(false)}
      title="Tray"
      footer={
        items.length ? (
          <div style={{ padding: "12px 20px 22px", display: "grid", gap: 10 }}>
            <div className="card__row">
              <span className="muted">Due now</span>
              <strong>{formatUsd(app.cartTotal)}</strong>
            </div>
            <Button
              loading={busy}
              onClick={async () => {
                setError("");
                setBusy(true);
                try {
                  await app.checkout();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not complete.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Hold with balance
            </Button>
            {error ? <p className="auth__error">{error}</p> : null}
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <Empty title="Nothing waiting" text="Add a search from the catalog." />
      ) : (
        items.map((item) => (
          <div className="tray-item" key={item.productId}>
            <img src={item.product!.image} alt="" />
            <div>
              <strong>{item.product!.title}</strong>
              <div className="muted">
                ×{item.qty} · {item.product!.sellerLogin}
              </div>
            </div>
            <div>
              <div>{formatUsd(item.product!.priceCents * item.qty)}</div>
              <Button size="sm" variant="ghost" onClick={() => app.removeFromCart(item.productId)}>
                Remove
              </Button>
            </div>
          </div>
        ))
      )}
    </Drawer>
  );
}

export function NotesDrawer() {
  const app = useApp();

  return (
    <AnimatePresence>
      {app.notesOpen ? (
        <>
          <motion.button
            type="button"
            className="notify-backdrop"
            aria-label="Close notifications"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => app.toggleNotes(false)}
          />
          <motion.div
            className="notify-panel"
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="notify-panel__head">
              <h2>Notifications</h2>
            </header>
            {app.notifications.length === 0 ? (
              <div className="notify-panel__empty">
                <Bell size={22} />
                <p>No notifications yet</p>
              </div>
            ) : (
              <ul className="notify-panel__list">
                {app.notifications.map((n) => {
                  const href = (n.href || "").trim();
                  const label = (n.hrefLabel || "Open").trim();
                  return (
                    <li key={n.id}>
                      <article className={n.read ? "notify-item" : "notify-item notify-item_unread"}>
                        <span className="notify-item__icon" aria-hidden="true">
                          <Bell size={15} />
                        </span>
                        <span className="notify-item__body">
                          <strong>{n.author || n.title || "rxlookup"}</strong>
                          <RichText text={n.body} />
                          {href ? (
                            href.startsWith("/") ? (
                              <Link to={href} className="notify-item__go" onClick={() => app.toggleNotes(false)}>
                                {label}
                                <ArrowUpRight size={12} />
                              </Link>
                            ) : (
                              <a className="notify-item__go" href={href} target="_blank" rel="noreferrer">
                                {label}
                                <ArrowUpRight size={12} />
                              </a>
                            )
                          ) : null}
                          <time>{n.time}</time>
                        </span>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}


