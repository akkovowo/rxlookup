import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Code2,
  CreditCard,
  Gauge,
  History,
  IdCard,
  Search,
  Ticket,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { NewsNotice } from "@/components/NewsNotice";
import { apiGet, type HistoryItem } from "@/lib/api";
import { CountRemain, CountUsd } from "@/components/CountUp";
import { useApp } from "@/lib/store";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function ProfilePage() {
  const app = useApp();
  const nick = app.user?.login ?? "there";
  const pin = app.news.find((n) => n.pinned);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openTicket, setOpenTicket] = useState<{ id: number; subject: string } | null>(null);

  useEffect(() => {
    void apiGet<{ items: HistoryItem[] }>("/v1/history")
      .then((data) => setHistory((data.items || []).slice(0, 5)))
      .catch(() => setHistory([]));
    void apiGet<{ tickets: { id: number; subject: string; status: string }[] }>("/v1/tickets")
      .then((data) => {
        const open = (data.tickets || []).find((t) => t.status === "Open");
        setOpenTicket(open ? { id: open.id, subject: open.subject } : null);
      })
      .catch(() => setOpenTicket(null));
  }, []);

  const actions = [
    { to: "/search", label: "Search", hint: "People database", icon: Search },
    { to: "/ssndob", label: "SSN+DOB", hint: `$${app.pricing.ssndob.toFixed(2)} per hit`, icon: IdCard },
    { to: "/cs", label: "Credit", hint: `$${app.pricing.credit.toFixed(2)} on success`, icon: Gauge },
    { to: "/topup", label: "Top up", hint: "Add crypto funds", icon: Wallet },
    { to: "/api", label: "API keys", hint: "Cabinet & usage", icon: Code2 },
    { to: "/subscriptions", label: "Plans", hint: "Unlock search", icon: CreditCard },
  ];

  return (
    <>
      <div className="home-hero">
        <div>
          <p className="home-hero__kicker">{greeting()}</p>
          <h2>{nick}</h2>
          <p className="panel-card__desc">Your desk for lookups, keys, and balance.</p>
        </div>
        <Link to="/topup" className="panel-btn panel-btn--primary">
          <Wallet size={15} />
          Top up
        </Link>
      </div>

      {app.maintenance ? (
        <div className="notice notice_warn" role="alert">
          <span className="notice__icon" aria-hidden="true">
            <TriangleAlert size={18} strokeWidth={1.75} />
          </span>
          <div className="notice__copy">
            <div className="notice__title">Maintenance</div>
            <p>Lookups are paused while the desk is being serviced.</p>
          </div>
        </div>
      ) : null}

      {pin ? (
        <NewsNotice title={pin.title} body={pin.body} ctaLabel={pin.ctaLabel} ctaTo={pin.ctaTo} />
      ) : null}

      {!app.deskActive && !app.apiActive ? (
        <div className="notice notice_warn" role="alert">
          <span className="notice__icon" aria-hidden="true">
            <TriangleAlert size={18} strokeWidth={1.75} />
          </span>
          <div className="notice__copy">
            <div className="notice__title">Subscription required</div>
            <p>Search stays locked until a plan is active.</p>
          </div>
          <Link to="/subscriptions" className="notice__go">
            Open plans
            <ArrowUpRight size={14} />
          </Link>
        </div>
      ) : null}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Balance</div>
            <div className="stat-card__value">
              <CountUsd cents={app.balanceCents} />
            </div>
          </div>
          <div className="stat-card__icon stat-card__icon--balance" aria-hidden="true">
            <Wallet size={16} strokeWidth={1.75} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Search</div>
            <div className={`stat-card__value stat-card__value--sm ${app.deskActive ? "is-active" : "is-inactive"}`}>
              <CountRemain until={app.planUntil} active={app.deskActive} />
            </div>
          </div>
          <div className={`stat-card__icon ${app.deskActive ? "is-active" : "is-inactive"}`} aria-hidden="true">
            <span className="stat-card__dot" />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Search API</div>
            <div className={`stat-card__value stat-card__value--sm ${app.apiActive ? "is-active" : "is-inactive"}`}>
              <CountRemain until={app.apiPlanUntil} active={app.apiActive} />
            </div>
          </div>
          <div className={`stat-card__icon ${app.apiActive ? "is-active" : "is-inactive"}`} aria-hidden="true">
            <span className="stat-card__dot" />
          </div>
        </div>
      </div>

      <div className="home-actions">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="home-action">
              <span className="home-action__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <em>{item.hint}</em>
              </span>
              <ArrowUpRight size={14} className="home-action__go" />
            </Link>
          );
        })}
      </div>

      <div className="home-split">
        <div className="card">
          <div className="home-card__head">
            <div>
              <h3>Recent activity</h3>
              <p className="panel-card__desc">Latest charges and lookups</p>
            </div>
            <Link to="/history" className="home-card__more">
              <History size={14} />
              All
            </Link>
          </div>
          <ul className="home-feed">
            {history.length ? (
              history.map((row) => (
                <li key={row.id}>
                  <span>
                    <strong>{row.type}</strong>
                    <em>{row.date}</em>
                  </span>
                  <span className="home-feed__amt">
                    {row.amount === 0 ? row.status : row.amount > 0 ? `+$${row.amount.toFixed(2)}` : `-$${Math.abs(row.amount).toFixed(2)}`}
                  </span>
                </li>
              ))
            ) : (
              <li>
                <span>
                  <strong>No activity yet</strong>
                  <em>Lookups and credits will show here</em>
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="card">
          <div className="home-card__head">
            <div>
              <h3>Desk</h3>
              <p className="panel-card__desc">Pricing and open items</p>
            </div>
          </div>
          <div className="home-desk">
            <div className="home-desk__row">
              <span>SSN+DOB</span>
              <strong>${app.pricing.ssndob.toFixed(2)}</strong>
            </div>
            <div className="home-desk__row">
              <span>Credit score</span>
              <strong>${app.pricing.credit.toFixed(2)}</strong>
            </div>
            <div className="home-desk__row">
              <span>Search</span>
              <strong>Plan</strong>
            </div>
            {openTicket ? (
              <Link to="/help" className="home-ticket">
                <Ticket size={15} />
                <span>
                  <strong>#{openTicket.id}</strong>
                  <em>{openTicket.subject}</em>
                </span>
                <ArrowUpRight size={14} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
