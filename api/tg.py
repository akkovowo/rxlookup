from __future__ import annotations

import hmac
import os
import re
import secrets
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException

APP_ORIGIN = os.environ.get("APP_ORIGIN", "https://rx.144.124.248.226.sslip.io").rstrip("/")
BOT_USERNAME = (os.environ.get("TG_BOT_USERNAME") or "").lstrip("@")
BOT_SECRET = os.environ.get("RX_BOT_SECRET", "")
MIRROR_RE = re.compile(r"rxlookup", re.I)

router = APIRouter()


def migrate_telegram(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(users)").fetchall()}
    if "telegram_id" not in cols:
        con.execute("ALTER TABLE users ADD COLUMN telegram_id INTEGER")
    if "telegram_username" not in cols:
        con.execute("ALTER TABLE users ADD COLUMN telegram_username TEXT NOT NULL DEFAULT ''")
    try:
        con.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id ON users (telegram_id) WHERE telegram_id IS NOT NULL"
        )
    except sqlite3.OperationalError:
        pass
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS telegram_links (
          code TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          exp REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS telegram_tickets (
          ticket TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          exp REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS telegram_mirrors (
          id INTEGER PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          owner_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active'
        );
        """
    )
    con.execute("UPDATE users SET telegram = 0 WHERE telegram_id IS NULL AND telegram = 1")


def bot_name() -> str:
    return BOT_USERNAME


def deep_link(code: str) -> str:
    name = bot_name()
    if not name:
        return ""
    return f"https://t.me/{name}?start=link_{code}"


def tg_scheme(code: str) -> str:
    name = bot_name()
    if not name:
        return ""
    return f"tg://resolve?domain={name}&start=link_{code}"


def require_bot(secret: str | None) -> None:
    if not BOT_SECRET or not secret or not hmac.compare_digest(secret, BOT_SECRET):
        raise HTTPException(401, "Bot only")


def start_link(con: sqlite3.Connection, user: sqlite3.Row) -> dict[str, Any]:
    from server import stamp

    con.execute("DELETE FROM telegram_links WHERE user_id = ? OR exp < ?", (user["id"], time.time()))
    code = secrets.token_hex(4).upper()
    con.execute(
        "INSERT INTO telegram_links (code, user_id, exp) VALUES (?, ?, ?)",
        (code, user["id"], time.time() + 15 * 60),
    )
    return {
        "ok": True,
        "telegram": False,
        "code": code,
        "bot": bot_name(),
        "deep_link": deep_link(code),
        "tg_link": tg_scheme(code),
        "expires_in": 900,
        "at": stamp(),
    }


def unlink_telegram(con: sqlite3.Connection, user_id: int) -> None:
    con.execute(
        "UPDATE users SET telegram = 0, telegram_id = NULL, telegram_username = '' WHERE id = ?",
        (user_id,),
    )
    con.execute("DELETE FROM telegram_links WHERE user_id = ?", (user_id,))
    con.execute("DELETE FROM telegram_tickets WHERE user_id = ?", (user_id,))


def bind_telegram(con: sqlite3.Connection, user_id: int, telegram_id: int, username: str) -> sqlite3.Row:
    from server import user_public

    other = con.execute(
        "SELECT id FROM users WHERE telegram_id = ? AND id != ?",
        (telegram_id, user_id),
    ).fetchone()
    if other:
        raise HTTPException(409, "This Telegram is already linked to another desk")
    con.execute(
        "UPDATE users SET telegram = 1, telegram_id = ?, telegram_username = ? WHERE id = ?",
        (telegram_id, (username or "").lstrip("@"), user_id),
    )
    return con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def session_for(con: sqlite3.Connection, user: sqlite3.Row) -> dict[str, Any]:
    from server import make_token, plan_active, settings_map, user_public

    s = settings_map(con)
    return {
        "ok": True,
        "token": make_token(user),
        "user": user_public(user),
        "desk_active": plan_active(user["plan_until"]),
        "api_active": plan_active(user["api_plan_until"]),
        "maintenance": bool(s["maintenance"]),
    }


def issue_ticket(con: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    con.execute("DELETE FROM telegram_tickets WHERE user_id = ? OR exp < ?", (user_id, time.time()))
    ticket = secrets.token_urlsafe(18)
    con.execute(
        "INSERT INTO telegram_tickets (ticket, user_id, exp) VALUES (?, ?, ?)",
        (ticket, user_id, time.time() + 10 * 60),
    )
    return {
        "ok": True,
        "ticket": ticket,
        "url": f"{APP_ORIGIN}/?ticket={ticket}",
        "expires_in": 600,
    }


def user_by_tg(con: sqlite3.Connection, telegram_id: int) -> sqlite3.Row | None:
    return con.execute("SELECT * FROM users WHERE telegram_id = ? AND status = 'active'", (telegram_id,)).fetchone()


def mount(app) -> None:
    app.include_router(router)


@router.get("/v1/telegram/info")
def telegram_info():
    name = bot_name()
    return {
        "ok": True,
        "bot": name,
        "url": f"https://t.me/{name}" if name else "",
        "app": APP_ORIGIN,
    }


@router.post("/v1/me/telegram/start")
def telegram_start(authorization: str | None = Header(None)):
    from server import auth_actor, db

    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        if user["telegram_id"]:
            return {
                "ok": True,
                "telegram": True,
                "bot": bot_name(),
                "username": user["telegram_username"] or "",
            }
        return start_link(con, user)


@router.post("/v1/auth/telegram/ticket")
def consume_ticket(payload: dict[str, Any]):
    from server import db

    ticket = (payload.get("ticket") or "").strip()
    if not ticket:
        raise HTTPException(400, "Missing ticket")
    with db() as con:
        row = con.execute("SELECT * FROM telegram_tickets WHERE ticket = ?", (ticket,)).fetchone()
        if not row or row["exp"] < time.time():
            raise HTTPException(401, "Ticket expired")
        con.execute("DELETE FROM telegram_tickets WHERE ticket = ?", (ticket,))
        user = con.execute("SELECT * FROM users WHERE id = ? AND status = 'active'", (row["user_id"],)).fetchone()
        if not user:
            raise HTTPException(401, "Account disabled")
        return session_for(con, user)


@router.post("/v1/bot/resolve")
def bot_resolve(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db

    require_bot(x_bot_secret)
    tid = int(payload.get("telegram_id") or 0)
    if not tid:
        raise HTTPException(400, "telegram_id required")
    with db() as con:
        user = user_by_tg(con, tid)
        if not user:
            return {"ok": True, "linked": False}
        return {"ok": True, "linked": True, **session_for(con, user)}


@router.post("/v1/bot/link")
def bot_link(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db

    require_bot(x_bot_secret)
    raw = (payload.get("code") or "").strip().upper().replace("LINK_", "")
    tid = int(payload.get("telegram_id") or 0)
    username = (payload.get("username") or "").lstrip("@")
    if not raw or not tid:
        raise HTTPException(400, "code and telegram_id required")
    with db() as con:
        row = con.execute("SELECT * FROM telegram_links WHERE code = ?", (raw,)).fetchone()
        if not row or row["exp"] < time.time():
            raise HTTPException(400, "Code expired. Open Settings and link again.")
        user = bind_telegram(con, row["user_id"], tid, username)
        con.execute("DELETE FROM telegram_links WHERE code = ?", (raw,))
        return {"ok": True, "linked": True, **session_for(con, user)}


@router.post("/v1/bot/login-key")
def bot_login_key(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db, sha

    require_bot(x_bot_secret)
    key = (payload.get("key") or "").strip()
    tid = int(payload.get("telegram_id") or 0)
    username = (payload.get("username") or "").lstrip("@")
    if not key or not tid:
        raise HTTPException(400, "key required")
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE secret_hash = ?", (sha(key),)).fetchone()
        if not user:
            raise HTTPException(401, "Wrong secret key.")
        if user["status"] != "active":
            raise HTTPException(403, "Account is not active.")
        user = bind_telegram(con, user["id"], tid, username)
        return {"ok": True, "linked": True, **session_for(con, user)}


@router.post("/v1/bot/register")
def bot_register(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db, hash_pw, issue_secret, stamp

    require_bot(x_bot_secret)
    login = (payload.get("login") or "").strip().lower().replace(" ", ".")
    password = payload.get("password") or ""
    tid = int(payload.get("telegram_id") or 0)
    username = (payload.get("username") or "").lstrip("@")
    if len(login) < 2 or len(login) > 32 or not re.match(r"^[a-z0-9][a-z0-9._-]*$", login) or len(password) < 8 or not tid:
        raise HTTPException(400, "Choose a name and a password of at least eight characters.")
    if login in {"admin", "estk", "root", "support", "rxlookup", "rx.desk"}:
        raise HTTPException(409, "That name is taken.")
    with db() as con:
        if user_by_tg(con, tid):
            raise HTTPException(409, "This Telegram is already linked")
        if con.execute("SELECT id FROM users WHERE login = ?", (login,)).fetchone():
            raise HTTPException(409, "That name is taken.")
        con.execute(
            """INSERT INTO users (login, email, password, role, status, balance_cents, plan, api_plan, created_at)
               VALUES (?, ?, ?, 'member', 'active', 0, 'none', 'none', ?)""",
            (login, f"{login}@atelier.rx", hash_pw(password), stamp()),
        )
        user = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
        secret = issue_secret(con, user["id"])
        user = bind_telegram(con, user["id"], tid, username)
        out = session_for(con, user)
        out["secret"] = secret
        return out


@router.post("/v1/bot/unlink")
def bot_unlink(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db

    require_bot(x_bot_secret)
    tid = int(payload.get("telegram_id") or 0)
    with db() as con:
        user = user_by_tg(con, tid)
        if not user:
            raise HTTPException(404, "Not linked")
        unlink_telegram(con, user["id"])
        return {"ok": True, "telegram": False}


@router.post("/v1/bot/ticket")
def bot_ticket(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db

    require_bot(x_bot_secret)
    tid = int(payload.get("telegram_id") or 0)
    with db() as con:
        user = user_by_tg(con, tid)
        if not user:
            return {"ok": True, "linked": False, "url": APP_ORIGIN}
        return {"ok": True, "linked": True, **issue_ticket(con, user["id"])}


@router.get("/v1/bot/mirrors")
def bot_mirrors(x_bot_secret: str | None = Header(None), telegram_id: int | None = None):
    from server import db

    require_bot(x_bot_secret)
    with db() as con:
        if telegram_id:
            user = user_by_tg(con, telegram_id)
            if not user:
                return {"ok": True, "mirrors": [], "tokens": []}
            rows = con.execute(
                "SELECT id, username, created_at, status FROM telegram_mirrors WHERE owner_id = ? AND status = 'active'",
                (user["id"],),
            ).fetchall()
            return {"ok": True, "mirrors": [dict(r) for r in rows]}
        rows = con.execute(
            "SELECT token, username FROM telegram_mirrors WHERE status = 'active'"
        ).fetchall()
        return {
            "ok": True,
            "mirrors": [{"username": r["username"]} for r in rows],
            "tokens": [r["token"] for r in rows],
        }


@router.post("/v1/bot/mirrors")
def bot_add_mirror(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db, stamp

    require_bot(x_bot_secret)
    token = (payload.get("token") or "").strip()
    username = (payload.get("username") or "").lstrip("@")
    tid = int(payload.get("telegram_id") or 0)
    if not token or ":" not in token:
        raise HTTPException(400, "Send a BotFather token")
    if not MIRROR_RE.search(username):
        raise HTTPException(400, 'Username must contain "rxlookup"')
    with db() as con:
        user = user_by_tg(con, tid)
        if not user:
            raise HTTPException(401, "Link Telegram first")
        exists = con.execute("SELECT id FROM telegram_mirrors WHERE token = ?", (token,)).fetchone()
        if exists:
            con.execute(
                "UPDATE telegram_mirrors SET username = ?, owner_id = ?, status = 'active' WHERE token = ?",
                (username, user["id"], token),
            )
            mid = exists["id"]
        else:
            con.execute(
                "INSERT INTO telegram_mirrors (token, username, owner_id, created_at, status) VALUES (?, ?, ?, ?, 'active')",
                (token, username, user["id"], stamp()),
            )
            mid = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return {"ok": True, "id": mid, "username": username}


@router.post("/v1/bot/mirrors/drop")
def bot_drop_mirror(payload: dict[str, Any], x_bot_secret: str | None = Header(None)):
    from server import db

    require_bot(x_bot_secret)
    tid = int(payload.get("telegram_id") or 0)
    mid = int(payload.get("id") or 0)
    with db() as con:
        user = user_by_tg(con, tid)
        if not user:
            raise HTTPException(401, "Link Telegram first")
        con.execute(
            "UPDATE telegram_mirrors SET status = 'dropped' WHERE id = ? AND owner_id = ?",
            (mid, user["id"]),
        )
        return {"ok": True}
