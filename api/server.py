from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("RX_DB", os.path.join(ROOT, "data.db"))


def load_secret() -> bytes:
    env = os.environ.get("RX_SECRET")
    if env:
        return env.encode()
    path = os.path.join(os.path.dirname(DB) or ".", ".rx_secret")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            val = fh.read().strip()
            if val:
                return val.encode()
    except OSError:
        pass
    val = secrets.token_hex(32)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(val)
        os.chmod(path, 0o600)
    except OSError:
        pass
    return val.encode()


SECRET = load_secret()

LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
RESERVED_LOGINS = {"admin", "estk", "root", "support", "rxlookup", "rx.desk"}
FAILS: dict[str, list[float]] = {}
PLAN_DAYS = {"day": 1, "week": 7, "month": 30}
PLAN_FIELD = {"desk": ("plan", "plan_until"), "api": ("api_plan", "api_plan_until")}

app = FastAPI(title="RX Lookup API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_body(status: int, message: str) -> dict[str, Any]:
    return {"ok": False, "error": {"code": str(status), "message": message}, "charged": 0, "detail": message}


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail)
    return JSONResponse(error_body(exc.status_code, message), status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def valid_error(request: Request, exc: RequestValidationError):
    return JSONResponse(error_body(422, "Incomplete identity"), status_code=422)


def now() -> datetime:
    return datetime.now(timezone.utc)


def stamp() -> str:
    return now().strftime("%Y-%m-%d %H:%M")


def iso(dt: datetime | str | None) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.strftime("%Y-%m-%d %H:%M")


@contextmanager
def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def hash_pw(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def check_pw(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(stored, hash_pw(password, salt))


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def make_secret() -> str:
    return "rx_sk_" + secrets.token_hex(16)


def issue_secret(con: sqlite3.Connection, user_id: int) -> str:
    raw = make_secret()
    con.execute(
        "UPDATE users SET secret_hash = ?, secret_last4 = ? WHERE id = ?",
        (sha(raw), raw[-4:], user_id),
    )
    return raw


def b64(data: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def b64d(text: str) -> bytes:
    import base64

    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def make_token(user: sqlite3.Row) -> str:
    payload = json.dumps({"uid": user["id"], "login": user["login"], "role": user["role"], "exp": time.time() + 14 * 86400})
    raw = b64(payload.encode())
    sig = hmac.new(SECRET, raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def parse_token(token: str) -> dict[str, Any]:
    try:
        raw, sig = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(401, "Invalid token") from exc
    expect = hmac.new(SECRET, raw.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, sig):
        raise HTTPException(401, "Invalid token")
    data = json.loads(b64d(raw))
    if data.get("exp", 0) < time.time():
        raise HTTPException(401, "Session expired")
    return data


def settings_map(con: sqlite3.Connection) -> dict[str, Any]:
    row = con.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    return dict(row) if row else {}


def user_public(row: sqlite3.Row, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    out = {
        "id": row["id"],
        "login": row["login"],
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "balance_cents": row["balance_cents"],
        "plan": row["plan"],
        "plan_until": row["plan_until"],
        "api_plan": row["api_plan"],
        "api_plan_until": row["api_plan_until"],
        "lookups": row["lookups"],
        "referrals": row["referrals"],
        "referral_earned_cents": row["referral_earned_cents"],
        "telegram": bool(row["telegram"]),
        "telegram_username": "",
        "avatar": "",
        "created_at": row["created_at"],
    }
    try:
        out["avatar"] = row["avatar"] or ""
    except (IndexError, KeyError):
        out["avatar"] = ""
    try:
        out["secret_last4"] = row["secret_last4"] or ""
    except (IndexError, KeyError):
        out["secret_last4"] = ""
    try:
        tid = row["telegram_id"]
        tun = row["telegram_username"] or ""
        out["telegram"] = bool(tid) or bool(row["telegram"])
        out["telegram_username"] = tun
    except (IndexError, KeyError):
        pass
    if extra:
        out.update(extra)
    return out


def plan_active(until: str | None) -> bool:
    if not until:
        return False
    try:
        return datetime.strptime(until, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc) > now()
    except ValueError:
        return False


def auth_actor(con: sqlite3.Connection, authorization: str | None):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing API key or session")
    token = authorization.split(" ", 1)[1].strip()
    if token.startswith("rx_live_") or token.startswith("rx_test_"):
        key = con.execute(
            "SELECT k.*, u.login AS user_login FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.hash = ?",
            (sha(token),),
        ).fetchone()
        if not key or key["status"] != "active":
            raise HTTPException(401, "Invalid or revoked key")
        user = con.execute("SELECT * FROM users WHERE id = ?", (key["user_id"],)).fetchone()
        if not user or user["status"] != "active":
            raise HTTPException(401, "Account disabled")
        con.execute(
            "UPDATE api_keys SET requests = requests + 1, last_used = ? WHERE id = ?",
            (stamp(), key["id"]),
        )
        return user, "key", key
    data = parse_token(token)
    user = con.execute("SELECT * FROM users WHERE id = ?", (data["uid"],)).fetchone()
    if not user or user["status"] != "active":
        raise HTTPException(401, "Account disabled")
    return user, "session", None


def throttle(key: str, limit: int = 8, window: int = 300) -> None:
    t = time.time()
    hits = [x for x in FAILS.get(key, []) if t - x < window]
    FAILS[key] = hits
    if len(hits) >= limit:
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")


def note_fail(key: str) -> None:
    FAILS.setdefault(key, []).append(time.time())


def require_admin(user: sqlite3.Row):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")


def need_scope(key: sqlite3.Row | None, scope: str):
    if key is None:
        return
    scopes = json.loads(key["scopes"] or "[]")
    if scope not in scopes:
        raise HTTPException(403, f"Key missing {scope} scope")


def is_test_key(key: sqlite3.Row | None) -> bool:
    return bool(key) and key["env"] == "test"


def add_ledger(con: sqlite3.Connection, user_id: int, cents: int, kind: str, label: str, status: str = "ok"):
    con.execute(
        "INSERT INTO ledger (user_id, cents, kind, label, status, at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, cents, kind, label, status, stamp()),
    )
    if cents:
        con.execute("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?", (cents, user_id))


def charge(con: sqlite3.Connection, user: sqlite3.Row, cents: int, label: str):
    fresh = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    if fresh["balance_cents"] < cents:
        raise HTTPException(402, "Insufficient balance")
    add_ledger(con, user["id"], -cents, "debit", label)
    con.execute("UPDATE users SET lookups = lookups + 1 WHERE id = ?", (user["id"],))


def init_db():
    os.makedirs(os.path.dirname(DB) or ".", exist_ok=True)
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY,
              login TEXT UNIQUE NOT NULL,
              email TEXT,
              password TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'member',
              status TEXT NOT NULL DEFAULT 'active',
              balance_cents INTEGER NOT NULL DEFAULT 0,
              plan TEXT NOT NULL DEFAULT 'none',
              plan_until TEXT,
              api_plan TEXT NOT NULL DEFAULT 'none',
              api_plan_until TEXT,
              lookups INTEGER NOT NULL DEFAULT 0,
              referred_by TEXT,
              referrals INTEGER NOT NULL DEFAULT 0,
              referral_earned_cents INTEGER NOT NULL DEFAULT 0,
              telegram INTEGER NOT NULL DEFAULT 0,
              avatar TEXT NOT NULL DEFAULT '',
              note TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS api_keys (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              prefix TEXT NOT NULL,
              last4 TEXT NOT NULL,
              hash TEXT UNIQUE NOT NULL,
              env TEXT NOT NULL,
              scopes TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              requests INTEGER NOT NULL DEFAULT 0,
              last_used TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ledger (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              cents INTEGER NOT NULL,
              kind TEXT NOT NULL,
              label TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'ok',
              at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lookups (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              kind TEXT NOT NULL,
              query TEXT NOT NULL,
              hits INTEGER NOT NULL,
              cost_cents INTEGER NOT NULL,
              status TEXT NOT NULL,
              at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tickets (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              subject TEXT NOT NULL,
              status TEXT NOT NULL,
              preview TEXT NOT NULL,
              updated TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ticket_replies (
              id INTEGER PRIMARY KEY,
              ticket_id INTEGER NOT NULL,
              sender TEXT NOT NULL,
              text TEXT NOT NULL,
              at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS deposits (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              method TEXT NOT NULL,
              amount_cents INTEGER NOT NULL,
              status TEXT NOT NULL,
              txid TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS news (
              id INTEGER PRIMARY KEY,
              title TEXT NOT NULL,
              body TEXT NOT NULL,
              cta_label TEXT NOT NULL DEFAULT '',
              cta_to TEXT NOT NULL DEFAULT '',
              pinned INTEGER NOT NULL DEFAULT 0,
              at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS codes (
              id INTEGER PRIMARY KEY,
              code TEXT UNIQUE NOT NULL,
              amount_cents INTEGER NOT NULL,
              status TEXT NOT NULL,
              used_by TEXT
            );
            CREATE TABLE IF NOT EXISTS records (
              id INTEGER PRIMARY KEY,
              first_name TEXT,
              middle_name TEXT,
              last_name TEXT,
              address TEXT,
              city TEXT,
              state TEXT,
              zip_code TEXT,
              dob TEXT,
              altdob TEXT,
              ssn TEXT,
              ssn_full TEXT,
              phone TEXT,
              email TEXT,
              akas TEXT,
              addresses TEXT,
              phones TEXT,
              emails TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
              id INTEGER PRIMARY KEY,
              search_cost REAL NOT NULL,
              ssndob_cost REAL NOT NULL,
              cs_cost REAL NOT NULL,
              reveal_cost REAL NOT NULL,
              desk_day REAL NOT NULL,
              desk_week REAL NOT NULL,
              desk_month REAL NOT NULL,
              api_day REAL NOT NULL,
              api_week REAL NOT NULL,
              api_month REAL NOT NULL,
              maintenance INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        if not con.execute("SELECT id FROM settings WHERE id = 1").fetchone():
            con.execute(
                """INSERT INTO settings (id, search_cost, ssndob_cost, cs_cost, reveal_cost,
                   desk_day, desk_week, desk_month, api_day, api_week, api_month, maintenance)
                   VALUES (1, 0, 2.5, 1.0, 1.5, 15, 45, 120, 30, 90, 240, 0)"""
            )
        if not con.execute("SELECT id FROM users WHERE role = 'admin'").fetchone():
            admin_pw = os.environ.get("RX_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
            if not os.environ.get("RX_ADMIN_PASSWORD"):
                print(f"[rxlookup] generated admin password for 'estk': {admin_pw}", flush=True)
            con.execute(
                """INSERT INTO users (login, email, password, role, status, balance_cents, plan, plan_until,
                   api_plan, api_plan_until, lookups, created_at)
                   VALUES ('estk', 'estk@atelier.rx', ?, 'admin', 'active', 50000, 'month', ?,
                   'month', ?, 0, ?)""",
                (hash_pw(admin_pw), (now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M"),
                 (now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M"), stamp()),
            )
        if con.execute("SELECT COUNT(*) AS n FROM records").fetchone()["n"] == 0:
            for rec in SEED_RECORDS:
                con.execute(
                    """INSERT INTO records (first_name, middle_name, last_name, address, city, state, zip_code,
                       dob, altdob, ssn, ssn_full, phone, email, akas, addresses, phones, emails)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    rec,
                )
        if con.execute("SELECT COUNT(*) AS n FROM news").fetchone()["n"] == 0:
            con.execute(
                "INSERT INTO news (title, body, cta_label, cta_to, pinned, at) VALUES (?,?,?,?,1,?)",
                ("Desk is live", "Search needs a desk or API plan. SSN+DOB is $2.50 on a hit. Credit is $1.00 on a score.",
                 "Open docs", "/docs", stamp()),
            )
        cols = {r[1] for r in con.execute("PRAGMA table_info(users)").fetchall()}
        if "avatar" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''")
        if "secret_hash" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN secret_hash TEXT NOT NULL DEFAULT ''")
        if "secret_last4" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN secret_last4 TEXT NOT NULL DEFAULT ''")
        from tg import migrate_telegram

        migrate_telegram(con)
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS notices (
              id INTEGER PRIMARY KEY,
              author TEXT NOT NULL DEFAULT 'rxlookup',
              body TEXT NOT NULL,
              href TEXT NOT NULL DEFAULT '',
              href_label TEXT NOT NULL DEFAULT '',
              at TEXT NOT NULL,
              user_id INTEGER
            );
            CREATE TABLE IF NOT EXISTS notice_reads (
              notice_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              PRIMARY KEY (notice_id, user_id)
            );
            """
        )
        notice_cols = {r[1] for r in con.execute("PRAGMA table_info(notices)").fetchall()}
        if "user_id" not in notice_cols:
            con.execute("ALTER TABLE notices ADD COLUMN user_id INTEGER")


def put_notice(
    con: sqlite3.Connection,
    *,
    author: str,
    body: str,
    href: str = "",
    href_label: str = "",
    user_id: int | None = None,
) -> None:
    con.execute(
        "INSERT INTO notices (author, body, href, href_label, at, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        ((author or "rxlookup")[:40], (body or "")[:4000], href, (href_label or "")[:48], stamp(), user_id),
    )


SEED_RECORDS = [
    ("John", "A", "Smith", "742 Evergreen Terrace", "Springfield", "IL", "62704", "1985", "03/12/1985",
     "***-**-4521", "318-45-4521", "5551234567", "john.smith@example.com",
     "John A Smith|J Smith", "742 Evergreen Terrace, Springfield IL 62704", "(555) 123-4567", "john.smith@example.com"),
    ("Jane", "", "Doe", "1600 Pennsylvania Ave NW", "Washington", "DC", "20500", "1972", "06/01/1972",
     "***-**-8834", "219-88-8834", "2025550147", "jane.doe@example.com",
     "J Doe", "1600 Pennsylvania Ave NW, Washington DC 20500", "(202) 555-0147", "jane.doe@example.com"),
    ("Maria", "L", "Garcia", "118 Hillcrest Ave", "Los Angeles", "CA", "90001", "1991", "11/04/1991",
     "***-**-2209", "561-22-2209", "2135550199", "m.garcia@example.com",
     "Maria Garcia|M L Garcia", "118 Hillcrest Ave, Los Angeles CA 90001", "(213) 555-0199", "m.garcia@example.com"),
    ("Robert", "James", "Johnson", "44 Pine Rd", "Austin", "TX", "78701", "1968", "02/18/1968",
     "***-**-7741", "449-77-7741", "5125550102", "rob.johnson@example.com",
     "Bob Johnson|R J Johnson", "44 Pine Rd, Austin TX 78701", "(512) 555-0102", "rob.johnson@example.com"),
    ("Emily", "", "Chen", "9 Oak Lane", "Seattle", "WA", "98101", "1994", "08/22/1994",
     "***-**-3310", "531-33-3310", "2065550177", "emily.chen@example.com",
     "Em Chen", "9 Oak Lane, Seattle WA 98101", "(206) 555-0177", "emily.chen@example.com"),
    ("David", "M", "Brown", "210 Market St", "Chicago", "IL", "60601", "1979", "04/09/1979",
     "***-**-9088", "318-90-9088", "3125550164", "d.brown@example.com",
     "Dave Brown", "210 Market St, Chicago IL 60601", "(312) 555-0164", "d.brown@example.com"),
    ("Ava", "R", "Patel", "55 King Blvd", "Miami", "FL", "33101", "1988", "12/15/1988",
     "***-**-1144", "261-11-1144", "3055550188", "ava.patel@example.com",
     "A Patel", "55 King Blvd, Miami FL 33101", "(305) 555-0188", "ava.patel@example.com"),
    ("Michael", "", "Williams", "3 Cedar Ct", "Denver", "CO", "80202", "1975", "07/30/1975",
     "***-**-6620", "521-66-6620", "3035550133", "mike.williams@example.com",
     "Mike Williams", "3 Cedar Ct, Denver CO 80202", "(303) 555-0133", "mike.williams@example.com"),
    ("Sofia", "N", "Martinez", "801 River Way", "Phoenix", "AZ", "85001", "1996", "01/19/1996",
     "***-**-4455", "526-44-4455", "6025550121", "sofia.m@example.com",
     "Sofia Martinez", "801 River Way, Phoenix AZ 85001", "(602) 555-0121", "sofia.m@example.com"),
    ("James", "T", "Wilson", "17 Harbor Dr", "Boston", "MA", "02108", "1982", "09/03/1982",
     "***-**-7780", "019-77-7780", "6175550190", "j.wilson@example.com",
     "Jim Wilson", "17 Harbor Dr, Boston MA 02108", "(617) 555-0190", "j.wilson@example.com"),
]


@app.on_event("startup")
def startup():
    init_db()


def body_or_query(request_json: dict[str, Any] | None, query: dict[str, Any]) -> dict[str, Any]:
    data = dict(query)
    if request_json:
        data.update({k: v for k, v in request_json.items() if v not in (None, "")})
    return {k: str(v).strip() for k, v in data.items() if v not in (None, "")}


def record_out(row: sqlite3.Row, full: bool = False) -> dict[str, Any]:
    item = {
        "first_name": row["first_name"] or "",
        "middle_name": row["middle_name"] or "",
        "last_name": row["last_name"] or "",
        "address": row["address"] or "",
        "city": row["city"] or "",
        "state": row["state"] or "",
        "zip_code": row["zip_code"] or "",
        "dob": row["dob"] or "",
        "altdob": row["altdob"] or "",
        "ssn": row["ssn"] or "",
    }
    if full:
        item.update(
            {
                "name": f"{row['first_name']} {row['last_name']}".strip(),
                "ssn": row["ssn_full"] or row["ssn"],
                "dob": row["altdob"] or row["dob"],
                "akas": [p for p in (row["akas"] or "").split("|") if p],
                "addresses": [p for p in (row["addresses"] or "").split("|") if p],
                "phones": [p for p in (row["phones"] or "").split("|") if p],
                "emails": [p for p in (row["emails"] or "").split("|") if p],
            }
        )
    return item


SEARCH_FIELDS = {"first_name", "last_name", "city", "state", "zip_code", "zipcode", "dob", "ssn", "phone", "address"}


def match_rows(con: sqlite3.Connection, q: dict[str, Any], limit: int = 50) -> list[sqlite3.Row]:
    rows = con.execute("SELECT * FROM records").fetchall()
    hits = []
    for row in rows:
        ok = True
        if q.get("first_name") and q["first_name"].lower() not in (row["first_name"] or "").lower():
            ok = False
        if q.get("last_name") and q["last_name"].lower() not in (row["last_name"] or "").lower():
            ok = False
        if q.get("city") and q["city"].lower() not in (row["city"] or "").lower():
            ok = False
        if q.get("state") and q["state"].upper() != (row["state"] or "").upper():
            ok = False
        zipc = q.get("zip_code") or q.get("zipcode") or ""
        if zipc and not (row["zip_code"] or "").startswith(zipc[:5]):
            ok = False
        if q.get("dob"):
            blob = f"{row['dob']} {row['altdob']}"
            if q["dob"].replace("-", "/") not in blob.replace("-", "/"):
                ok = False
        if q.get("ssn"):
            digits = "".join(ch for ch in q["ssn"] if ch.isdigit())
            stored = "".join(ch for ch in (row["ssn_full"] or row["ssn"] or "") if ch.isdigit())
            if digits and digits not in stored and not stored.endswith(digits[-4:]):
                ok = False
        phone = "".join(ch for ch in (q.get("phone") or "") if ch.isdigit())
        if phone:
            stored_p = "".join(ch for ch in (row["phone"] or "") if ch.isdigit())
            if phone[-10:] not in stored_p:
                ok = False
        addr = q.get("address") or ""
        if addr and addr.lower() not in (row["address"] or "").lower():
            ok = False
        if ok:
            hits.append(row)
        if len(hits) >= limit:
            break
    return hits


def credit_score_for(row: sqlite3.Row) -> int:
    seed = int(hashlib.sha256(f"{row['ssn_full']}{row['last_name']}".encode()).hexdigest(), 16)
    return 580 + (seed % 270)


@app.get("/v1/health")
def health():
    return {"ok": True, "service": "rxlookup"}


@app.get("/v1/pricing")
def pricing():
    with db() as con:
        s = settings_map(con)
        return {
            "search": s["search_cost"],
            "ssndob": s["ssndob_cost"],
            "credit": s["cs_cost"],
            "desk": {"day": s["desk_day"], "week": s["desk_week"], "month": s["desk_month"]},
            "api": {"day": s["api_day"], "week": s["api_week"], "month": s["api_month"]},
        }


@app.post("/v1/auth/register")
async def register(payload: dict[str, Any]):
    login = (payload.get("login") or "").strip().lower().replace(" ", ".")
    password = payload.get("password") or ""
    ref = (payload.get("ref") or "").strip().lower()
    if len(login) < 2 or len(login) > 32 or not LOGIN_RE.match(login) or len(password) < 8 or len(password) > 200:
        raise HTTPException(400, "Choose a name (letters, digits, . _ -) and a password of at least eight characters.")
    if login in RESERVED_LOGINS:
        raise HTTPException(409, "That name is taken.")
    with db() as con:
        if con.execute("SELECT id FROM users WHERE login = ?", (login,)).fetchone():
            raise HTTPException(409, "That name is taken.")
        if ref == login:
            ref = ""
        if ref and not con.execute("SELECT id FROM users WHERE login = ?", (ref,)).fetchone():
            ref = ""
        role = "member"
        con.execute(
            """INSERT INTO users (login, email, password, role, status, balance_cents, plan, api_plan,
               referred_by, created_at) VALUES (?, ?, ?, ?, 'active', 0, 'none', 'none', ?, ?)""",
            (login, f"{login}@atelier.rx", hash_pw(password), role, ref or None, stamp()),
        )
        if ref:
            con.execute("UPDATE users SET referrals = referrals + 1 WHERE login = ?", (ref,))
        user = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
        secret = issue_secret(con, user["id"])
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"token": make_token(user), "user": user_public(user), "secret": secret}


@app.post("/v1/auth/login")
async def login(payload: dict[str, Any], request: Request):
    login = (payload.get("login") or "").strip().lower().replace(" ", ".")
    password = payload.get("password") or ""
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "?")
    throttle(f"login:{ip}")
    throttle(f"login:{login}")
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
        if not user or not check_pw(password, user["password"]):
            note_fail(f"login:{ip}")
            note_fail(f"login:{login}")
            raise HTTPException(401, "Wrong name or password.")
        if user["status"] != "active":
            raise HTTPException(403, "Account is not active.")
        return {"token": make_token(user), "user": user_public(user)}


@app.post("/v1/auth/key")
async def login_key(payload: dict[str, Any], request: Request):
    key = (payload.get("key") or "").strip()
    if not key:
        raise HTTPException(400, "Enter your secret key.")
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "?")
    throttle(f"key:{ip}")
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE secret_hash = ?", (sha(key),)).fetchone()
        if not user:
            note_fail(f"key:{ip}")
            raise HTTPException(401, "Wrong secret key.")
        if user["status"] != "active":
            raise HTTPException(403, "Account is not active.")
        return {"token": make_token(user), "user": user_public(user)}


def actor(authorization: str | None):
    with db() as con:
        user, kind, key = auth_actor(con, authorization)
        return user, kind, key


@app.get("/v1/me")
def me(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        s = settings_map(con)
        return {
            "user": user_public(user),
            "desk_active": plan_active(user["plan_until"]),
            "api_active": plan_active(user["api_plan_until"]),
            "maintenance": bool(s["maintenance"]),
        }


@app.get("/v1/balance")
def balance(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {
            "ok": True,
            "balance_cents": user["balance_cents"],
            "balance": round(user["balance_cents"] / 100, 2),
            "currency": "USD",
            "desk_plan": user["plan"],
            "desk_until": user["plan_until"],
            "api_plan": user["api_plan"],
            "api_until": user["api_plan_until"],
        }


@app.post("/v1/me/password")
async def change_password(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        if not check_pw(payload.get("current") or "", user["password"]):
            raise HTTPException(400, "Current password is wrong")
        nxt = payload.get("next") or ""
        if len(nxt) < 8 or len(nxt) > 200:
            raise HTTPException(400, "Use at least eight characters")
        con.execute("UPDATE users SET password = ? WHERE id = ?", (hash_pw(nxt), user["id"]))
        return {"ok": True}


@app.post("/v1/me/secret")
async def rotate_secret(authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        secret = issue_secret(con, user["id"])
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"ok": True, "secret": secret, "secret_last4": user["secret_last4"]}


@app.post("/v1/me/telegram")
async def telegram(payload: dict[str, Any], authorization: str | None = Header(None)):
    from tg import start_link, unlink_telegram

    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        if payload.get("linked"):
            return start_link(con, user)
        unlink_telegram(con, user["id"])
        return {"ok": True, "telegram": False}


AVATAR_PRESETS = {
    "ember", "void", "moss", "wine", "ice", "dusk", "rust", "aurora", "gold", "ink",
}


@app.post("/v1/me/avatar")
async def set_avatar(payload: dict[str, Any], authorization: str | None = Header(None)):
    raw = str(payload.get("avatar") or "").strip()
    if raw:
        if raw.startswith("preset:"):
            mark = raw.split(":", 1)[1]
            if mark not in AVATAR_PRESETS:
                raise HTTPException(400, "Unknown mark")
            raw = f"preset:{mark}"
        elif raw.startswith("data:image/"):
            if len(raw) > 180_000:
                raise HTTPException(400, "Image is too large")
            if not any(raw.startswith(f"data:image/{k}") for k in ("jpeg", "jpg", "png", "webp")):
                raise HTTPException(400, "Use a JPEG, PNG, or WebP")
        else:
            raise HTTPException(400, "Unknown avatar")
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        con.execute("UPDATE users SET avatar = ? WHERE id = ?", (raw, user["id"]))
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"ok": True, "avatar": user["avatar"], "user": user_public(user)}


@app.post("/v1/me/delete")
def delete_me(authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        con.execute("UPDATE users SET status = 'deleted', login = login || '.deleted.' || id WHERE id = ?", (user["id"],))
        return {"ok": True}


@app.post("/v1/search")
async def search(request: Request, authorization: str | None = Header(None)):
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        payload = dict(request.query_params)
    q = {k: str(v).strip() for k, v in (payload or {}).items() if str(v).strip()}
    q = {k: v for k, v in q.items() if k in SEARCH_FIELDS}
    if not q:
        raise HTTPException(400, "Empty query")
    with db() as con:
        user, kind, key = auth_actor(con, authorization)
        need_scope(key, "search")
        s = settings_map(con)
        if s["maintenance"]:
            raise HTTPException(503, "Maintenance")
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        if kind == "key":
            allowed = is_test_key(key) or plan_active(user["api_plan_until"])
        else:
            allowed = plan_active(user["plan_until"]) or plan_active(user["api_plan_until"])
        if not allowed:
            raise HTTPException(402, "Search plan inactive")
        hits = match_rows(con, q)
        con.execute(
            "INSERT INTO lookups (user_id, kind, query, hits, cost_cents, status, at) VALUES (?,?,?,?,?,?,?)",
            (user["id"], "search", json.dumps(q), len(hits), 0, "ok" if hits else "empty", stamp()),
        )
        con.execute("UPDATE users SET lookups = lookups + 1 WHERE id = ?", (user["id"],))
        return {"ok": True, "count": len(hits), "charged": 0, "results": [record_out(r) for r in hits]}


@app.post("/v1/ssndob")
async def ssndob(payload: dict[str, Any], authorization: str | None = Header(None)):
    q = {k: str(v).strip() for k, v in (payload or {}).items() if str(v).strip()}
    has_name = bool(q.get("first_name") and q.get("last_name"))
    phone = "".join(ch for ch in (q.get("phone") or "") if ch.isdigit())
    if not has_name and len(phone) < 10:
        raise HTTPException(400, "Need a name pair or a phone")
    with db() as con:
        user, _, key = auth_actor(con, authorization)
        need_scope(key, "ssndob")
        s = settings_map(con)
        if s["maintenance"]:
            raise HTTPException(503, "Maintenance")
        cost = 0 if is_test_key(key) else int(round(float(s["ssndob_cost"]) * 100))
        hits = match_rows(con, q, 1)
        if not hits:
            con.execute(
                "INSERT INTO lookups (user_id, kind, query, hits, cost_cents, status, at) VALUES (?,?,?,?,0,'empty',?)",
                (user["id"], "ssndob", json.dumps(q), 0, stamp()),
            )
            return JSONResponse(error_body(404, "No match"), status_code=404)
        if cost:
            charge(con, user, cost, "SSN+DOB lookup")
        else:
            con.execute("UPDATE users SET lookups = lookups + 1 WHERE id = ?", (user["id"],))
        con.execute(
            "INSERT INTO lookups (user_id, kind, query, hits, cost_cents, status, at) VALUES (?,?,?,?,?,'ok',?)",
            (user["id"], "ssndob", json.dumps(q), 1, cost, stamp()),
        )
        return {"ok": True, "charged": round(cost / 100, 2), "result": record_out(hits[0], full=True)}


@app.post("/v1/credit")
async def credit_ep(payload: dict[str, Any], authorization: str | None = Header(None)):
    q = {k: str(v).strip() for k, v in (payload or {}).items() if str(v).strip()}
    for field in ("first_name", "last_name", "city", "state"):
        if not q.get(field):
            raise HTTPException(422, "Incomplete identity")
    if not (q.get("zipcode") or q.get("zip_code")):
        raise HTTPException(422, "Incomplete identity")
    with db() as con:
        user, _, key = auth_actor(con, authorization)
        need_scope(key, "cs")
        s = settings_map(con)
        if s["maintenance"]:
            raise HTTPException(503, "Maintenance")
        cost = 0 if is_test_key(key) else int(round(float(s["cs_cost"]) * 100))
        hits = match_rows(con, q, 1)
        if not hits:
            con.execute(
                "INSERT INTO lookups (user_id, kind, query, hits, cost_cents, status, at) VALUES (?,?,?,?,0,'empty',?)",
                (user["id"], "cs", json.dumps(q), 0, stamp()),
            )
            return JSONResponse(error_body(404, "No file"), status_code=404)
        if cost:
            charge(con, user, cost, "Credit score")
        else:
            con.execute("UPDATE users SET lookups = lookups + 1 WHERE id = ?", (user["id"],))
        score = credit_score_for(hits[0])
        con.execute(
            "INSERT INTO lookups (user_id, kind, query, hits, cost_cents, status, at) VALUES (?,?,?,?,?,'ok',?)",
            (user["id"], "cs", json.dumps(q), 1, cost, stamp()),
        )
        return {"ok": True, "charged": round(cost / 100, 2), "score": score, "range": "300-850", "model": "VantageScore 4.0"}


@app.get("/v1/history")
def history(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        rows = con.execute(
            "SELECT * FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 100",
            (user["id"],),
        ).fetchall()
        return {
            "items": [
                {
                    "id": r["id"],
                    "type": r["label"],
                    "amount": round(r["cents"] / 100, 2),
                    "date": r["at"],
                    "status": r["status"],
                }
                for r in rows
            ]
        }


@app.get("/v1/lookups")
def my_lookups(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        rows = con.execute(
            "SELECT * FROM lookups WHERE user_id = ? ORDER BY id DESC LIMIT 100",
            (user["id"],),
        ).fetchall()
        return {"items": [dict(r) for r in rows]}


@app.post("/v1/subscribe")
async def subscribe(payload: dict[str, Any], authorization: str | None = Header(None)):
    kind = payload.get("kind")  # desk | api
    plan = payload.get("plan")  # day week month
    if kind not in PLAN_FIELD or plan not in PLAN_DAYS:
        raise HTTPException(400, "Unknown plan")
    with db() as con:
        user, kind_auth, _ = auth_actor(con, authorization)
        if kind_auth != "session":
            raise HTTPException(403, "Use the desk to buy a plan")
        s = settings_map(con)
        price_key = f"{'desk' if kind == 'desk' else 'api'}_{plan}"
        cents = int(round(float(s[price_key]) * 100))
        charge(con, user, cents, f"{kind} {plan} plan")
        field, until_field = PLAN_FIELD[kind]
        fresh = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        start = now()
        if plan_active(fresh[until_field]):
            try:
                start = datetime.strptime(fresh[until_field], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            except ValueError:
                start = now()
        until = (start + timedelta(days=PLAN_DAYS[plan])).strftime("%Y-%m-%d %H:%M")
        con.execute(f"UPDATE users SET {field} = ?, {until_field} = ? WHERE id = ?", (plan, until, user["id"]))
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"ok": True, "user": user_public(user)}


@app.post("/v1/redeem")
async def redeem(payload: dict[str, Any], authorization: str | None = Header(None)):
    code = (payload.get("code") or "").strip().upper()
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        row = con.execute("SELECT * FROM codes WHERE code = ?", (code,)).fetchone()
        if not row or row["status"] != "open":
            raise HTTPException(400, "Code is not valid")
        con.execute("UPDATE codes SET status = 'used', used_by = ? WHERE id = ?", (user["login"], row["id"]))
        add_ledger(con, user["id"], row["amount_cents"], "credit", f"Gift {code}")
        user = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"ok": True, "credited": round(row["amount_cents"] / 100, 2), "balance_cents": user["balance_cents"]}


@app.post("/v1/deposits")
async def deposits(payload: dict[str, Any], authorization: str | None = Header(None)):
    method = str(payload.get("method") or "BTC").upper()
    if method not in {"BTC", "ETH", "LTC", "SOL", "USDT"}:
        raise HTTPException(400, "Unknown method")
    try:
        cents = int(round(float(payload.get("amount") or 0) * 100))
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid amount")
    if cents < 500 or cents > 10_000_000:
        raise HTTPException(400, "Deposit must be between $5 and $100,000")
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        con.execute(
            "INSERT INTO deposits (user_id, method, amount_cents, status, txid, created_at) VALUES (?,?,?,'pending',?,?)",
            (user["id"], method, cents, str(payload.get("txid") or "")[:200], stamp()),
        )
        dep_id = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return {"ok": True, "id": dep_id, "status": "pending"}


@app.get("/v1/keys")
def list_keys(authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        rows = con.execute("SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        return {
            "keys": [
                {
                    "id": str(r["id"]),
                    "name": r["name"],
                    "prefix": r["prefix"],
                    "last4": r["last4"],
                    "createdAt": r["created_at"][:10],
                    "lastUsed": r["last_used"] or "Never",
                    "requests": r["requests"],
                    "status": r["status"],
                    "scopes": json.loads(r["scopes"]),
                    "env": r["env"],
                }
                for r in rows
            ]
        }


@app.post("/v1/keys")
async def create_key(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        env = "test" if payload.get("env") == "test" else "live"
        scopes = payload.get("scopes") or ["search", "ssndob", "cs"]
        head = "rx_test" if env == "test" else "rx_live"
        body = secrets.token_hex(12)
        secret = f"{head}_{body}"
        prefix = f"{head}_{body[:4]}"
        last4 = body[-4:]
        con.execute(
            """INSERT INTO api_keys (user_id, name, prefix, last4, hash, env, scopes, status, requests, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)""",
            (user["id"], (payload.get("name") or "Untitled key").strip(), prefix, last4, sha(secret), env, json.dumps(scopes), stamp()),
        )
        kid = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return {
            "id": str(kid),
            "secret": secret,
            "prefix": prefix,
            "last4": last4,
            "env": env,
            "scopes": scopes,
            "createdAt": stamp()[:10],
        }


@app.post("/v1/keys/{key_id}/revoke")
def revoke_key(key_id: int, authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        con.execute("UPDATE api_keys SET status = 'revoked' WHERE id = ? AND user_id = ?", (key_id, user["id"]))
        return {"ok": True}


@app.post("/v1/keys/{key_id}/rename")
async def rename_key(key_id: int, payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Name required")
        con.execute("UPDATE api_keys SET name = ? WHERE id = ? AND user_id = ?", (name, key_id, user["id"]))
        return {"ok": True}


@app.delete("/v1/keys/{key_id}")
def drop_key(key_id: int, authorization: str | None = Header(None)):
    with db() as con:
        user, kind, _ = auth_actor(con, authorization)
        if kind != "session":
            raise HTTPException(403, "Use a session token")
        con.execute("DELETE FROM api_keys WHERE id = ? AND user_id = ?", (key_id, user["id"]))
        return {"ok": True}


@app.get("/v1/tickets")
def tickets(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        rows = con.execute("SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        out = []
        for r in rows:
            n = con.execute("SELECT COUNT(*) AS n FROM ticket_replies WHERE ticket_id = ?", (r["id"],)).fetchone()["n"]
            out.append({**dict(r), "replies": n})
        return {"tickets": out}


@app.get("/v1/tickets/{ticket_id}")
def ticket_one(ticket_id: int, authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        t = con.execute("SELECT * FROM tickets WHERE id = ? AND user_id = ?", (ticket_id, user["id"])).fetchone()
        if not t:
            raise HTTPException(404, "Not found")
        replies = con.execute("SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY id", (ticket_id,)).fetchall()
        return {"ticket": dict(t), "thread": [dict(r) for r in replies]}


@app.post("/v1/tickets")
async def open_ticket(payload: dict[str, Any], authorization: str | None = Header(None)):
    subject = (payload.get("subject") or "").strip()
    text = (payload.get("body") or "").strip()
    if not subject or not text:
        raise HTTPException(400, "Subject and body required")
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        con.execute(
            "INSERT INTO tickets (user_id, subject, status, preview, updated) VALUES (?,?,'Open',?,?)",
            (user["id"], subject, text, stamp()),
        )
        tid = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        con.execute(
            "INSERT INTO ticket_replies (ticket_id, sender, text, at) VALUES (?, 'user', ?, ?)",
            (tid, text, stamp()),
        )
        return {"ok": True, "id": tid}


@app.post("/v1/tickets/{ticket_id}/reply")
async def user_ticket_reply(ticket_id: int, payload: dict[str, Any], authorization: str | None = Header(None)):
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Reply required")
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        t = con.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if not t or t["user_id"] != user["id"]:
            raise HTTPException(404, "Ticket not found")
        if t["status"] != "Open":
            raise HTTPException(400, "Ticket is closed")
        con.execute(
            "INSERT INTO ticket_replies (ticket_id, sender, text, at) VALUES (?, 'user', ?, ?)",
            (ticket_id, text, stamp()),
        )
        con.execute(
            "UPDATE tickets SET preview = ?, updated = ?, status = 'Open' WHERE id = ?",
            (text, stamp(), ticket_id),
        )
        return {"ok": True}


@app.post("/v1/tickets/{ticket_id}/close")
async def user_ticket_close(ticket_id: int, authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        t = con.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if not t or t["user_id"] != user["id"]:
            raise HTTPException(404, "Ticket not found")
        con.execute(
            "UPDATE tickets SET status = 'Closed', updated = ? WHERE id = ?",
            (stamp(), ticket_id),
        )
        return {"ok": True}


@app.get("/v1/news")
def news_public():
    with db() as con:
        rows = con.execute("SELECT * FROM news ORDER BY pinned DESC, id DESC").fetchall()
        s = settings_map(con)
        return {
            "maintenance": bool(s["maintenance"]),
            "news": [
                {
                    "id": f"n-{r['id']}",
                    "title": r["title"],
                    "body": r["body"],
                    "ctaLabel": r["cta_label"],
                    "ctaTo": r["cta_to"],
                    "pinned": bool(r["pinned"]),
                    "at": r["at"],
                }
                for r in rows
            ],
        }


def desk_payload(con: sqlite3.Connection) -> dict[str, Any]:
    users = con.execute("SELECT * FROM users WHERE status != 'deleted' ORDER BY id").fetchall()
    tickets = con.execute("SELECT t.*, u.login AS user FROM tickets t JOIN users u ON u.id = t.user_id ORDER BY t.id DESC").fetchall()
    thread = {}
    for r in con.execute("SELECT * FROM ticket_replies ORDER BY id").fetchall():
        thread.setdefault(r["ticket_id"], []).append({"from": r["sender"], "text": r["text"], "at": r["at"]})
    deposits = con.execute("SELECT d.*, u.login AS user FROM deposits d JOIN users u ON u.id = d.user_id ORDER BY d.id DESC").fetchall()
    lookups = con.execute("SELECT l.*, u.login AS user FROM lookups l JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 200").fetchall()
    keys = con.execute("SELECT k.*, u.login AS user FROM api_keys k JOIN users u ON u.id = k.user_id ORDER BY k.id DESC").fetchall()
    news = con.execute("SELECT * FROM news ORDER BY id DESC").fetchall()
    try:
        notices = con.execute(
            "SELECT * FROM notices WHERE user_id IS NULL ORDER BY id DESC LIMIT 80"
        ).fetchall()
    except sqlite3.OperationalError:
        notices = []
    codes = con.execute("SELECT * FROM codes ORDER BY id DESC").fetchall()
    s = settings_map(con)
    return {
        "users": [
            {
                "id": f"u-{u['login']}",
                "login": u["login"],
                "email": u["email"],
                "role": u["role"],
                "status": u["status"],
                "balanceCents": u["balance_cents"],
                "plan": u["plan"],
                "apiPlan": u["api_plan"],
                "planUntil": u["plan_until"],
                "lookups": u["lookups"],
                "lastSeen": "",
                "createdAt": u["created_at"][:10],
                "note": u["note"],
            }
            for u in users
        ],
        "tickets": [
            {
                "id": t["id"],
                "user": t["user"],
                "subject": t["subject"],
                "status": t["status"],
                "updated": t["updated"],
                "preview": t["preview"],
                "replies": thread.get(t["id"], []),
            }
            for t in tickets
        ],
        "deposits": [
            {
                "id": f"d-{d['id']}",
                "user": d["user"],
                "method": d["method"],
                "amountCents": d["amount_cents"],
                "status": d["status"],
                "txid": d["txid"] or "",
                "createdAt": d["created_at"],
            }
            for d in deposits
        ],
        "lookups": [
            {
                "id": f"l-{l['id']}",
                "user": l["user"],
                "kind": l["kind"],
                "query": l["query"],
                "hits": l["hits"],
                "costCents": l["cost_cents"],
                "status": l["status"],
                "at": l["at"],
            }
            for l in lookups
        ],
        "keys": [
            {
                "id": str(k["id"]),
                "user": k["user"],
                "name": k["name"],
                "prefix": k["prefix"],
                "last4": k["last4"],
                "status": k["status"],
                "requests": k["requests"],
                "scopes": json.loads(k["scopes"]),
            }
            for k in keys
        ],
        "news": [
            {
                "id": f"n-{n['id']}",
                "title": n["title"],
                "body": n["body"],
                "at": n["at"],
                "pinned": bool(n["pinned"]),
                "ctaLabel": n["cta_label"],
                "ctaTo": n["cta_to"],
            }
            for n in news
        ],
        "notices": [
            {
                "id": f"nt-{n['id']}",
                "author": n["author"],
                "body": n["body"],
                "href": n["href"],
                "hrefLabel": n["href_label"],
                "at": n["at"],
            }
            for n in notices
        ],
        "codes": [
            {
                "id": f"c-{c['id']}",
                "code": c["code"],
                "amountCents": c["amount_cents"],
                "status": c["status"],
                "usedBy": c["used_by"],
            }
            for c in codes
        ],
        "audit": [],
        "settings": {
            "searchCost": s["search_cost"],
            "ssndobCost": s["ssndob_cost"],
            "csCost": s["cs_cost"],
            "revealCost": s["reveal_cost"],
            "deskDay": s["desk_day"],
            "deskWeek": s["desk_week"],
            "deskMonth": s["desk_month"],
            "apiDay": s["api_day"],
            "apiWeek": s["api_week"],
            "apiMonth": s["api_month"],
            "maintenance": bool(s["maintenance"]),
        },
    }


@app.get("/v1/admin/desk")
def admin_desk(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        require_admin(user)
        return desk_payload(con)


@app.post("/v1/admin/credit")
async def admin_credit(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        login = (payload.get("login") or "").strip().lower()
        try:
            cents = int(payload.get("cents") or 0)
        except (TypeError, ValueError):
            raise HTTPException(400, "Invalid amount")
        user = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
        if not user:
            raise HTTPException(404, "No user with that name.")
        add_ledger(con, user["id"], cents, "credit" if cents >= 0 else "debit", payload.get("reason") or "Manual desk credit")
        return {"ok": True}


@app.post("/v1/admin/deposit")
async def admin_deposit(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        try:
            dep_id = int(str(payload.get("id")).replace("d-", ""))
        except ValueError:
            raise HTTPException(400, "Bad deposit id")
        status = payload.get("status")
        if status not in {"pending", "credited", "rejected", "failed"}:
            raise HTTPException(400, "Bad status")
        dep = con.execute("SELECT * FROM deposits WHERE id = ?", (dep_id,)).fetchone()
        if not dep:
            raise HTTPException(404, "Deposit not found")
        if status == "credited" and dep["status"] != "credited":
            add_ledger(con, dep["user_id"], dep["amount_cents"], "credit", f"{dep['method']} deposit")
            payer = con.execute("SELECT * FROM users WHERE id = ?", (dep["user_id"],)).fetchone()
            if payer and payer["referred_by"]:
                bonus = round(dep["amount_cents"] * 0.05)
                if bonus:
                    ref = con.execute("SELECT id FROM users WHERE login = ?", (payer["referred_by"],)).fetchone()
                    if ref:
                        add_ledger(con, ref["id"], bonus, "credit", "Referral 5%")
                        con.execute(
                            "UPDATE users SET referral_earned_cents = referral_earned_cents + ? WHERE id = ?",
                            (bonus, ref["id"]),
                        )
        con.execute("UPDATE deposits SET status = ? WHERE id = ?", (status, dep_id))
        return {"ok": True}


@app.post("/v1/admin/user")
async def admin_user(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        login = (payload.get("login") or "").strip().lower()
        if "status" in payload:
            con.execute("UPDATE users SET status = ? WHERE login = ?", (payload["status"], login))
        if "role" in payload:
            con.execute("UPDATE users SET role = ? WHERE login = ?", (payload["role"], login))
        if "note" in payload:
            con.execute("UPDATE users SET note = ? WHERE login = ?", (payload["note"], login))
        if "plan" in payload:
            plan = payload["plan"] if payload["plan"] in PLAN_DAYS else "none"
            until = (now() + timedelta(days=PLAN_DAYS[plan])).strftime("%Y-%m-%d %H:%M") if plan in PLAN_DAYS else None
            con.execute("UPDATE users SET plan = ?, plan_until = ? WHERE login = ?", (plan, until, login))
        api_plan = payload.get("apiPlan", payload.get("api_plan"))
        if "apiPlan" in payload or "api_plan" in payload:
            plan = api_plan if api_plan in PLAN_DAYS else "none"
            until = (now() + timedelta(days=PLAN_DAYS[plan])).strftime("%Y-%m-%d %H:%M") if plan in PLAN_DAYS else None
            con.execute("UPDATE users SET api_plan = ?, api_plan_until = ? WHERE login = ?", (plan, until, login))
        return {"ok": True}


@app.post("/v1/admin/ticket/reply")
async def admin_reply(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        tid = int(payload.get("id"))
        text = (payload.get("text") or "").strip()
        ticket = con.execute("SELECT * FROM tickets WHERE id = ?", (tid,)).fetchone()
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        if not text:
            raise HTTPException(400, "Write a reply")
        con.execute("INSERT INTO ticket_replies (ticket_id, sender, text, at) VALUES (?, 'staff', ?, ?)", (tid, text, stamp()))
        con.execute("UPDATE tickets SET preview = ?, updated = ?, status = 'Open' WHERE id = ?", (text, stamp(), tid))
        preview = text if len(text) < 220 else text[:217] + "..."
        put_notice(
            con,
            author="rxlookup",
            body=f"Staff replied to **#{tid} {ticket['subject']}**.\n\n{preview}",
            href="/help",
            href_label="Open ticket",
            user_id=int(ticket["user_id"]),
        )
        return {"ok": True}


@app.post("/v1/admin/ticket/close")
async def admin_close(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        con.execute("UPDATE tickets SET status = 'Closed', updated = ? WHERE id = ?", (stamp(), int(payload.get("id"))))
        return {"ok": True}


@app.post("/v1/admin/key/revoke")
async def admin_revoke(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        con.execute("UPDATE api_keys SET status = 'revoked' WHERE id = ?", (int(payload.get("id")),))
        return {"ok": True}


@app.post("/v1/admin/news")
async def admin_news(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        con.execute(
            "INSERT INTO news (title, body, cta_label, cta_to, pinned, at) VALUES (?,?,?,?,0,?)",
            (payload.get("title") or "", payload.get("body") or "", payload.get("ctaLabel") or "", payload.get("ctaTo") or "", stamp()),
        )
        return {"ok": True}


@app.post("/v1/admin/news/pin")
async def admin_pin(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        nid = int(str(payload.get("id")).replace("n-", ""))
        row = con.execute("SELECT pinned FROM news WHERE id = ?", (nid,)).fetchone()
        if row:
            con.execute("UPDATE news SET pinned = ? WHERE id = ?", (0 if row["pinned"] else 1, nid))
        return {"ok": True}


@app.post("/v1/admin/news/drop")
async def admin_drop_news(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        nid = int(str(payload.get("id")).replace("n-", ""))
        con.execute("DELETE FROM news WHERE id = ?", (nid,))
        return {"ok": True}


@app.post("/v1/admin/news/edit")
async def admin_edit_news(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        nid = int(str(payload.get("id")).replace("n-", ""))
        title = (payload.get("title") or "").strip()
        body = (payload.get("body") or "").strip()
        if not title or not body:
            raise HTTPException(400, "Title and body required")
        con.execute(
            "UPDATE news SET title = ?, body = ?, cta_label = ?, cta_to = ? WHERE id = ?",
            (title, body, payload.get("ctaLabel") or "", payload.get("ctaTo") or "", nid),
        )
        if not con.execute("SELECT id FROM news WHERE id = ?", (nid,)).fetchone():
            raise HTTPException(404, "Note not found")
        return {"ok": True}


def public_href(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("/") and not text.startswith("//") and "://" not in text:
        return text[:400]
    if text.startswith("https://") or text.startswith("http://"):
        return text[:400]
    return ""


@app.get("/v1/notifications")
def list_notices(authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        rows = con.execute(
            "SELECT * FROM notices WHERE user_id IS NULL OR user_id = ? ORDER BY id DESC LIMIT 80",
            (user["id"],),
        ).fetchall()
        reads = {
            r["notice_id"]
            for r in con.execute("SELECT notice_id FROM notice_reads WHERE user_id = ?", (user["id"],)).fetchall()
        }
        return {
            "items": [
                {
                    "id": f"nt-{r['id']}",
                    "author": r["author"] or "rxlookup",
                    "body": r["body"],
                    "href": r["href"],
                    "hrefLabel": r["href_label"],
                    "at": r["at"],
                    "read": r["id"] in reads,
                }
                for r in rows
            ]
        }


@app.post("/v1/notifications/read")
async def read_notices(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        user, _, _ = auth_actor(con, authorization)
        if payload.get("all"):
            ids = [r["id"] for r in con.execute("SELECT id FROM notices").fetchall()]
        else:
            ids = [int(str(payload.get("id") or "").replace("nt-", ""))]
        for nid in ids:
            con.execute(
                "INSERT OR IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)",
                (nid, user["id"]),
            )
        return {"ok": True}


@app.post("/v1/admin/notify")
async def admin_notify(payload: dict[str, Any], authorization: str | None = Header(None)):
    author = (payload.get("author") or "rxlookup").strip()[:40] or "rxlookup"
    body = (payload.get("body") or "").strip()
    href = public_href(str(payload.get("href") or payload.get("ctaTo") or ""))
    label = (payload.get("hrefLabel") or payload.get("ctaLabel") or "").strip()[:48]
    if not body:
        raise HTTPException(400, "Write the message")
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        put_notice(con, author=author, body=body, href=href, href_label=label)
        return {"ok": True}


@app.post("/v1/admin/notify/drop")
async def admin_drop_notice(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        nid = int(str(payload.get("id")).replace("nt-", ""))
        con.execute("DELETE FROM notices WHERE id = ?", (nid,))
        con.execute("DELETE FROM notice_reads WHERE notice_id = ?", (nid,))
        return {"ok": True}


@app.post("/v1/admin/code")
async def admin_code(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        if payload.get("drop"):
            cid = int(str(payload.get("id")).replace("c-", ""))
            con.execute("DELETE FROM codes WHERE id = ?", (cid,))
            return {"ok": True}
        cents = int(payload.get("amountCents") or 0)
        code = f"RX-{secrets.token_hex(3).upper()}"
        con.execute("INSERT INTO codes (code, amount_cents, status) VALUES (?, ?, 'open')", (code, cents))
        return {"ok": True, "code": code}


@app.post("/v1/admin/settings")
async def admin_settings(payload: dict[str, Any], authorization: str | None = Header(None)):
    with db() as con:
        admin, _, _ = auth_actor(con, authorization)
        require_admin(admin)
        mapping = {
            "searchCost": "search_cost",
            "ssndobCost": "ssndob_cost",
            "csCost": "cs_cost",
            "revealCost": "reveal_cost",
            "deskDay": "desk_day",
            "deskWeek": "desk_week",
            "deskMonth": "desk_month",
            "apiDay": "api_day",
            "apiWeek": "api_week",
            "apiMonth": "api_month",
            "maintenance": "maintenance",
        }
        sets = []
        vals = []
        for src, col in mapping.items():
            if src in payload:
                val = payload[src]
                if col == "maintenance":
                    val = 1 if val else 0
                else:
                    try:
                        val = float(val)
                    except (TypeError, ValueError):
                        raise HTTPException(400, f"Bad value for {src}")
                    if val < 0 or val > 100000:
                        raise HTTPException(400, f"Bad value for {src}")
                sets.append(f"{col} = ?")
                vals.append(val)
        if sets:
            con.execute(f"UPDATE settings SET {', '.join(sets)} WHERE id = 1", vals)
        return {"ok": True}


from tg import mount as mount_telegram

mount_telegram(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8787")), reload=False)
