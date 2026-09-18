import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { CATEGORIES, BANNERS } from "@/lib/data";
import { cx, formatUsd } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { Product } from "@/lib/types";
import { Avatar, Button, Empty, Select, Skeleton } from "./ui";
import { Modal } from "./Overlay";
import { useState } from "react";

export function CatalogSidebar() {
  const app = useApp();
  return (
    <aside className={cx("sidebar", app.sidebarOpen && "sidebar_open")}>
      <button
        type="button"
        className="sidebar__cat"
        onClick={() => {
          app.setCategory(null);
          app.toggleSidebar(false);
        }}
      >
        <span className="sidebar__mark">All</span>
        All searches
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={cx("sidebar__cat", app.category === cat.id && "sidebar__cat_active")}
          onClick={() => {
            app.setCategory(app.category === cat.id ? null : cat.id);
            app.toggleSidebar(false);
          }}
        >
          <span className="sidebar__mark">{cat.label[0]}</span>
          {cat.label}
        </button>
      ))}
    </aside>
  );
}

export function Rightbar({ studio }: { studio?: boolean }) {
  return (
    <aside className="rightbar">
      <div className="shop-card">
        <h3>{studio ? "Your studio" : "Open a studio"}</h3>
        <p>
          {studio
            ? "Publish a search package. Escrow holds until delivery is confirmed."
            : "Verified providers publish searches. Apply once; the catalog stays small on purpose."}
        </p>
        <Button size="sm" variant="ghost">
          {studio ? "Studio desk" : "Request a desk"}
        </Button>
      </div>
      {BANNERS.map((b) => (
        <article className="promo" key={b.id}>
          <small>{b.kicker}</small>
          <h3>{b.title}</h3>
          <p>{b.text}</p>
        </article>
      ))}
    </aside>
  );
}

export function CatalogToolbar({ count }: { count: number }) {
  const app = useApp();
  return (
    <div className="toolbar">
      <label className="toolbar__search">
        <Search size={16} />
        <input
          value={app.search}
          onChange={(e) => app.setSearch(e.target.value)}
          placeholder="Search searches"
        />
        {app.search ? (
          <button type="button" className="icon-btn" aria-label="Clear" onClick={() => app.setSearch("")}>
            <X size={14} />
          </button>
        ) : null}
      </label>
      <Select
        value={app.sort}
        onChange={(e) => app.setSort(e.target.value as typeof app.sort)}
        aria-label="Sort"
      >
        <option value="default">Default</option>
        <option value="newest">Newest</option>
        <option value="price_asc">Low price</option>
        <option value="price_desc">High price</option>
      </Select>
      <span className="toolbar__count">{count} listed</span>
    </div>
  );
}

function Row({ product }: { product: Product }) {
  const app = useApp();
  const nav = useNavigate();
  const inCart = app.cart.some((c) => c.productId === product.id);
  const fav = app.favorites.includes(product.id);
  return (
    <article className="row" onClick={() => app.openProduct(product)}>
      <img className="row__thumb" src={product.image} alt="" loading="lazy" />
      <div>
        <h3 className="row__title">{product.title}</h3>
        <p className="row__desc">{product.description}</p>
      </div>
      <span className="row__stock">{product.stock} in stock</span>
      <div className="row__actions" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          onClick={() => void app.buyNow(product.id)}
          disabled={product.isSoldOut}
        >
          Buy now
        </Button>
        <Button
          size="icon"
          variant={inCart ? "solid" : "quiet"}
          aria-label="Add to tray"
          onClick={() => void app.addToCart(product.id)}
        >
          <ShoppingBag size={15} />
        </Button>
        <Button
          size="icon"
          variant="quiet"
          aria-label="Message provider"
          onClick={() => nav("/messages")}
        >
          <MessageCircle size={15} />
        </Button>
        <Button
          size="icon"
          variant="quiet"
          aria-label="Favorite"
          onClick={() => void app.toggleFavorite(product.id)}
        >
          <Heart size={15} fill={fav ? "currentColor" : "none"} />
        </Button>
      </div>
      <div className="row__price">{formatUsd(product.priceCents)}</div>
      <Link
        to={`/user/${product.sellerLogin}`}
        className="row__seller"
        onClick={(e) => e.stopPropagation()}
      >
        <Avatar initials={product.sellerInitials} online={product.sellerOnline} size="sm" />
        <span>{product.sellerLogin}</span>
      </Link>
    </article>
  );
}

export function ProductRows({ products }: { products: Product[] }) {
  return (
    <div className="list">
      {products.map((p) => (
        <Row key={p.id} product={p} />
      ))}
    </div>
  );
}

export function CatalogList({ loading }: { loading: boolean }) {
  const app = useApp();
  if (loading) {
    return (
      <div className="list">
        {Array.from({ length: 7 }).map((_, i) => (
          <div className="sk-row" key={i}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </div>
    );
  }
  if (app.filtered.length === 0) {
    return (
      <Empty
        title="Nothing in this drawer"
        text="Clear the filter or try a different query. The catalog is kept small on purpose."
      />
    );
  }
  return <ProductRows products={app.filtered} />;
}

export function ProductModal() {
  const app = useApp();
  const p = app.selectedProduct;
  const [buying, setBuying] = useState(false);
  return (
    <Modal open={!!p} onClose={() => app.openProduct(null)} wide>
      {p ? (
        <div className="detail">
          <img src={p.image} alt={p.title} />
          <div className="detail__copy">
            <small className="muted">
              Searches · {p.origin}
            </small>
            <h2>{p.title}</h2>
            <p className="muted">{p.description}</p>
            <div className="meta-grid">
              <div>
                <span>Condition</span>
                <div>{p.condition}</div>
              </div>
              <div>
                <span>Year</span>
                <div>{p.year}</div>
              </div>
              <div>
                <span>Stock</span>
                <div>{p.stock}</div>
              </div>
              <div>
                <span>Provider</span>
                <div>{p.sellerLogin}</div>
              </div>
            </div>
            <strong style={{ fontSize: 22, letterSpacing: "-0.03em" }}>{formatUsd(p.priceCents)}</strong>
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <Button
                loading={buying}
                onClick={async () => {
                  setBuying(true);
                  try {
                    await app.buyNow(p.id);
                    app.openProduct(null);
                  } finally {
                    setBuying(false);
                  }
                }}
              >
                Hold with balance
              </Button>
              <Button variant="ghost" onClick={() => void app.addToCart(p.id)}>
                Add to tray
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

