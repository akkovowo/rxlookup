import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CircleHelp, Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { apiGet, apiPost } from "@/lib/api";
import { useApp } from "@/lib/store";
import { cx } from "@/lib/format";

type Status = "Open" | "Closed";
type Ticket = {
  id: number;
  subject: string;
  status: Status;
  updated: string;
  preview: string;
  replies: number;
};

const SEED: Ticket[] = [];

export function HelpPage() {
  const app = useApp();
  const [tickets, setTickets] = useState<Ticket[]>(SEED);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [modal, setModal] = useState<"new" | "view" | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState<Ticket | null>(null);
  const [thread, setThread] = useState<{ sender: string; text: string; at: string }[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const data = await apiGet<{ tickets: Ticket[] }>("/v1/tickets");
    setTickets(data.tickets || []);
  }

  useEffect(() => {
    void reload().catch(() => setTickets([]));
  }, []);

  const visible = tickets.filter((t) => (filter === "all" ? true : t.status.toLowerCase() === filter));
  const openCount = tickets.filter((t) => t.status === "Open").length;

  async function create() {
    const title = subject.trim();
    const text = body.trim();
    if (!title || !text) return;
    await apiPost("/v1/tickets", { subject: title, body: text });
    await reload();
    setSubject("");
    setBody("");
    setModal(null);
    app.showToast("Ticket opened");
  }

  async function openTicket(t: Ticket) {
    setActive(t);
    setReply("");
    setModal("view");
    try {
      const data = await apiGet<{ ticket: Ticket; thread: { sender: string; text: string; at: string }[] }>(
        `/v1/tickets/${t.id}`,
      );
      setActive({ ...t, ...data.ticket });
      setThread(data.thread || []);
    } catch {
      setThread([]);
    }
  }

  async function sendReply() {
    if (!active || active.status !== "Open") return;
    const text = reply.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await apiPost(`/v1/tickets/${active.id}/reply`, { text });
      setReply("");
      await reload();
      await openTicket(active);
      app.showToast("Reply sent");
    } catch {
      app.showToast("Could not send the reply");
    } finally {
      setBusy(false);
    }
  }

  async function closeTicket() {
    if (!active || active.status !== "Open" || busy) return;
    setBusy(true);
    try {
      await apiPost(`/v1/tickets/${active.id}/close`);
      await reload();
      setActive({ ...active, status: "Closed" });
      app.showToast("Ticket closed");
    } catch {
      app.showToast("Could not close the ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="help-hero">
        <div>
          <h2>Help</h2>
          <p className="panel-card__desc">Billing, keys, and lookup issues — one thread each.</p>
        </div>
        <button
          type="button"
          className="panel-btn panel-btn--primary"
          onClick={() => {
            setSubject("");
            setBody("");
            setModal("new");
          }}
        >
          <Plus size={15} />
          New ticket
        </button>
      </div>

      <Link to="/faq" className="api-docs-cta">
        <span className="api-docs-cta__icon" aria-hidden="true">
          <CircleHelp size={18} />
        </span>
        <span className="api-docs-cta__copy">
          <strong>FAQ</strong>
          <em>Search, scores, keys, and billing — short answers first.</em>
        </span>
        <span className="api-docs-cta__go">
          Open FAQ
          <ArrowUpRight size={16} />
        </span>
      </Link>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Open</div>
            <div className="stat-card__value">{openCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">Closed</div>
            <div className="stat-card__value">{tickets.length - openCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__body">
            <div className="stat-card__label">All threads</div>
            <div className="stat-card__value">{tickets.length}</div>
          </div>
        </div>
      </div>

      <div className="card help-list-card">
        <div className="help-list-card__head">
          <div>
            <h3>Tickets</h3>
            <p className="panel-card__desc">Newest first. Closed threads stay for the record.</p>
          </div>
          <div className="api-filter" role="tablist" aria-label="Ticket status">
            {(["all", "open", "closed"] as const).map((id) => (
              <button key={id} type="button" className={cx("api-filter__btn", filter === id && "is-on")} onClick={() => setFilter(id)}>
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="panel-empty">
            <h3>Nothing here</h3>
            <p>Open a ticket if something is stuck.</p>
          </div>
        ) : (
          <ul className="help-list">
            {visible.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cx("help-ticket-card", t.status === "Closed" && "is-closed")}
                  onClick={() => void openTicket(t)}
                >
                  <span className="help-ticket-card__top">
                    <strong>{t.subject}</strong>
                    <span className={cx("help-dot", t.status === "Closed" && "is-off")} aria-hidden="true" />
                  </span>
                  <em>{t.preview}</em>
                  <span className="help-ticket-card__meta">
                    <span className="mono">#{t.id}</span>
                    <span>{t.replies} messages</span>
                    <span>{t.updated}</span>
                    <span>{t.status}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={modal === "new"} onClose={() => setModal(null)}>
        <div className="topup-modal">
          <h3>New ticket</h3>
          <p className="panel-card__desc">Describe the issue. Staff replies from the admin desk.</p>
          <div className="form-group" style={{ textAlign: "left", marginTop: 16 }}>
            <label htmlFor="ticket-subject">Subject</label>
            <div className="input-wrap">
              <input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Deposit not credited" />
            </div>
          </div>
          <div className="form-group" style={{ textAlign: "left", marginTop: 12 }}>
            <label htmlFor="ticket-body">Message</label>
            <textarea id="ticket-body" className="help-area" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What happened, and what should we check?" />
          </div>
          <div className="panel-modal__actions topup-modal__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="button" className="panel-btn panel-btn--primary" onClick={() => void create()} disabled={!subject.trim() || !body.trim()}>
              Open
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "view" && active !== null} onClose={() => setModal(null)}>
        {active ? (
          <div className="topup-modal help-view">
            <p className="help-view__id mono">#{active.id}</p>
            <h3>{active.subject}</h3>
            <p className="panel-card__desc">{active.preview}</p>
            <div className="help-view__meta">
              <span className={cx("help-dot", active.status === "Closed" && "is-off")} />
              {active.status} · {active.updated}
            </div>
            {thread.length ? (
              <ul className="help-list" style={{ marginTop: 16, textAlign: "left" }}>
                {thread.map((msg, i) => (
                  <li key={i}>
                    <strong>{msg.sender}</strong>
                    <em> · {msg.at}</em>
                    <p>{msg.text}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {active.status === "Open" ? (
              <div className="form-group" style={{ textAlign: "left", marginTop: 16 }}>
                <label htmlFor="ticket-reply">Reply</label>
                <textarea
                  id="ticket-reply"
                  className="help-area"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Add another message. The ticket stays open."
                />
              </div>
            ) : null}
            <div className="panel-modal__actions">
              <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setModal(null)}>
                Back
              </button>
              {active.status === "Open" ? (
                <button type="button" className="panel-btn panel-btn--ghost" onClick={() => void closeTicket()} disabled={busy}>
                  Close ticket
                </button>
              ) : null}
              {active.status === "Open" ? (
                <button
                  type="button"
                  className="panel-btn panel-btn--primary"
                  onClick={() => void sendReply()}
                  disabled={busy || !reply.trim()}
                >
                  Send
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
