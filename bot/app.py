from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, ErrorEvent, MenuButtonWebApp, Message, WebAppInfo

from client import ApiError, Rx
from ui import (
    M_BOLT,
    M_BOX,
    M_CHAT,
    M_DOC,
    M_GEAR,
    M_HOME,
    M_INFO,
    M_LINK,
    M_MONEY,
    M_NO,
    M_NOTE,
    M_OK,
    M_PC,
    M_PLUS,
    M_SEARCH,
    M_STAR,
    M_USER,
    NO_PREVIEW,
    back,
    btn,
    card,
    h,
    kb,
    url_btn,
    web_btn,
)

APP_ORIGIN = os.environ.get("APP_ORIGIN", "https://rx.144.124.248.226.sslip.io").rstrip("/")
READY_NAMES = [
    "rxlookup",
    "rxlookupbot",
    "rxlookup_bot",
    "rxlookupdesk",
    "rxlookup_desk",
    "rxlookupapi",
    "rxlookup1",
    "rxlookup2",
    "rxlookup3",
]

rx: Rx | None = None
sessions: dict[int, str] = {}
router = Router()


class Form(StatesGroup):
    login_key = State()
    reg_login = State()
    reg_pass = State()
    search = State()
    ssndob = State()
    credit = State()
    redeem = State()
    topup_amount = State()
    topup_coin = State()
    ticket_subject = State()
    ticket_body = State()
    ticket_reply = State()
    key_name = State()
    mirror_token = State()


def usd(cents: int) -> str:
    return f"${(cents or 0) / 100:,.2f}"


def remain(until: str | None) -> str:
    if not until:
        return "Inactive"
    raw = until if "T" in until else until.replace(" ", "T") + "Z"
    try:
        end = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            end = datetime.strptime(until, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        except ValueError:
            return "Inactive"
    ms = (end - datetime.now(timezone.utc)).total_seconds()
    if ms <= 0:
        return "Inactive"
    days = int(ms // 86400)
    hours = int((ms % 86400) // 3600)
    if days > 0:
        return f"{days}d {hours}h"
    minutes = int((ms % 3600) // 60)
    return f"{hours}h {minutes}m"


def tid_of(event: Message | CallbackQuery) -> int:
    user = event.from_user
    return int(user.id) if user else 0


def uname_of(event: Message | CallbackQuery) -> str:
    user = event.from_user
    return (user.username or "") if user else ""


def api() -> Rx:
    if rx is None:
        raise RuntimeError("API client is not ready")
    return rx


async def resolve(tid: int) -> dict[str, Any] | None:
    data = await api().bot("/v1/bot/resolve", {"telegram_id": tid})
    if not data.get("linked"):
        sessions.pop(tid, None)
        return None
    sessions[tid] = data["token"]
    return data


async def token_of(tid: int) -> str | None:
    if tid in sessions:
        return sessions[tid]
    data = await resolve(tid)
    return data["token"] if data else None


async def need_auth(event: Message | CallbackQuery, state: FSMContext) -> str | None:
    tid = tid_of(event)
    token = await token_of(tid)
    if token:
        return token
    await state.clear()
    await show_guest(event)
    return None


async def flash(event: Message | CallbackQuery, text: str) -> None:
    if isinstance(event, CallbackQuery):
        await event.answer(text[:180], show_alert=False)
        return
    await event.answer(text, parse_mode=ParseMode.HTML, link_preview_options=NO_PREVIEW)


async def paint(event: Message | CallbackQuery, text: str, markup=None) -> None:
    async def send(answer, edit=None):
        try:
            if edit:
                await edit(text, reply_markup=markup, link_preview_options=NO_PREVIEW)
            else:
                await answer(text, reply_markup=markup, link_preview_options=NO_PREVIEW)
            return
        except Exception:
            try:
                await answer(text, reply_markup=None, link_preview_options=NO_PREVIEW)
            except Exception:
                await answer("Could not draw this screen. Send /start.")

    if isinstance(event, CallbackQuery):
        await send(event.message.answer, event.message.edit_text)
        try:
            await event.answer()
        except Exception:
            pass
        return
    await send(event.answer)


def parse_fields(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    keyed = False
    for ln in lines:
        if ":" in ln:
            key, val = ln.split(":", 1)
            key = key.strip().lower().replace(" ", "_")
            aliases = {
                "first": "first_name",
                "last": "last_name",
                "zip": "zip_code",
                "zipcode": "zip_code",
            }
            out[aliases.get(key, key)] = val.strip()
            keyed = True
    if keyed:
        return out
    blob = " ".join(lines)
    phone = re.sub(r"\D", "", blob)
    if len(phone) >= 10 and not re.search(r"[A-Za-z]", blob):
        return {"phone": phone}
    parts = blob.replace(",", " ").split()
    if len(parts) >= 2:
        out["first_name"] = parts[0]
        out["last_name"] = parts[1]
        if len(parts) >= 3:
            out["city"] = parts[2]
        if len(parts) >= 4:
            out["state"] = parts[3]
        if len(parts) >= 5:
            out["zip_code"] = parts[4]
    elif parts:
        out["last_name"] = parts[0]
    return out


def err_text(exc: Exception) -> str:
    if isinstance(exc, ApiError):
        return h(exc.message)
    return "Desk is busy. Try again."


async def mini_url(tid: int) -> str:
    try:
        data = await api().bot("/v1/bot/ticket", {"telegram_id": tid})
        return str(data.get("url") or APP_ORIGIN)
    except Exception:
        return APP_ORIGIN


def guest_kb(site: str):
    return kb(
        [
            [btn("Sign in with key", "auth:key", style="primary", icon=M_STAR)],
            [btn("Create account", "auth:reg", icon=M_PLUS)],
            [url_btn("Open desk", site, style="success", icon=M_LINK)],
        ]
    )


async def show_guest(event: Message | CallbackQuery) -> None:
    text = card(
        "RXLookup",
        "Desk for lookups, keys, and balance.",
        "▫️ Link from <b>Settings → Link Telegram</b> on the site\n"
        "▫️ Or sign in here with your secret key\n"
        "▫️ New here — create a desk in one minute",
        emoji_id=M_HOME,
        fallback="⌂",
    )
    await paint(event, text, guest_kb(APP_ORIGIN))


def home_kb(site: str, linked: bool):
    rows = [
        [btn("Search", "go:search", style="primary", icon=M_SEARCH)],
        [
            btn("SSN+DOB", "go:ssndob", icon=M_DOC),
            btn("Credit", "go:cs", icon=M_NOTE),
        ],
        [
            btn("Plans", "go:plans", icon=M_BOX),
            btn("Top up", "go:topup", icon=M_MONEY),
        ],
        [
            btn("History", "go:hist", icon=M_INFO),
            btn("API keys", "go:keys", icon=M_PC),
        ],
        [btn("Help", "go:help", icon=M_CHAT)],
        [web_btn("RXMiniApp", site, style="success", icon=M_BOLT)],
        [btn("Create your bot (Mirrors)", "go:mirrors", icon=M_LINK)],
        [btn("Settings", "go:set", icon=M_GEAR)],
    ]
    if not linked:
        rows[-2] = [url_btn("RXMiniApp", site, style="success", icon=M_BOLT)]
    return kb(rows)


async def show_home(event: Message | CallbackQuery) -> None:
    tid = tid_of(event)
    data = await resolve(tid)
    site = await mini_url(tid)
    if not data:
        await show_guest(event)
        return
    user = data["user"]
    body = (
        f"▫️ Name: <code>{h(user.get('login'))}</code>\n"
        f"▫️ Balance: <code>{usd(user.get('balance_cents') or 0)}</code>\n"
        f"▫️ Search: <code>{h(remain(user.get('plan_until')))}</code>\n"
        f"▫️ Search API: <code>{h(remain(user.get('api_plan_until')))}</code>\n"
        f"▫️ Lookups: <code>{h(user.get('lookups') or 0)}</code>"
    )
    text = card("Desk", "Your RX Lookup cabinet.", body, emoji_id=M_USER, fallback="●")
    await paint(event, text, home_kb(site, True))


@router.message(CommandStart())
async def start(message: Message, state: FSMContext):
    await state.clear()
    payload = (message.text or "").split(maxsplit=1)
    arg = payload[1].strip() if len(payload) > 1 else ""
    if arg.lower().startswith("link_"):
        arg = arg[5:]
    if arg:
        try:
            data = await api().bot(
                "/v1/bot/link",
                {"code": arg, "telegram_id": tid_of(message), "username": uname_of(message)},
            )
            sessions[tid_of(message)] = data["token"]
            await message.answer(
                card("Linked", "Telegram is on this desk.", f"▫️ Signed in as <code>{h(data['user']['login'])}</code>", emoji_id=M_OK, fallback="✓"),
                link_preview_options=NO_PREVIEW,
            )
        except ApiError as exc:
            await message.answer(card("Link", "Could not attach Telegram.", err_text(exc), emoji_id=M_INFO, fallback="!"), link_preview_options=NO_PREVIEW)
    await show_home(message)


@router.message(Command("menu", "desk"))
async def cmd_menu(message: Message, state: FSMContext):
    await state.clear()
    await show_home(message)


@router.callback_query(F.data == "home")
async def cb_home(cb: CallbackQuery, state: FSMContext):
    await state.clear()
    await show_home(cb)


@router.callback_query(F.data == "auth:key")
async def cb_key(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Form.login_key)
    await paint(
        cb,
        card("Sign in", "Paste your secret key.", "▫️ Starts with <code>rx_sk_</code>\n▫️ Issued in Settings on the site", emoji_id=M_STAR, fallback="*"),
        kb([[back()]]),
    )


@router.message(Form.login_key, F.text)
async def msg_key(message: Message, state: FSMContext):
    try:
        data = await api().bot(
            "/v1/bot/login-key",
            {"key": message.text.strip(), "telegram_id": tid_of(message), "username": uname_of(message)},
        )
        sessions[tid_of(message)] = data["token"]
        await state.clear()
        try:
            await message.delete()
        except Exception:
            pass
        await show_home(message)
    except ApiError as exc:
        await message.answer(card("Sign in", "Key was rejected.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "auth:reg")
async def cb_reg(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Form.reg_login)
    await paint(cb, card("Register", "Pick a desk name.", "▫️ At least two characters\n▫️ This becomes your login", emoji_id=M_PLUS, fallback="+"), kb([[back()]]))


@router.message(Form.reg_login, F.text)
async def msg_reg_login(message: Message, state: FSMContext):
    await state.update_data(login=message.text.strip())
    await state.set_state(Form.reg_pass)
    await message.answer(
        card("Register", "Now a password.", "▫️ At least eight characters", emoji_id=M_STAR, fallback="*"),
        reply_markup=kb([[back()]]),
        link_preview_options=NO_PREVIEW,
    )


@router.message(Form.reg_pass, F.text)
async def msg_reg_pass(message: Message, state: FSMContext):
    data = await state.get_data()
    try:
        out = await api().bot(
            "/v1/bot/register",
            {
                "login": data.get("login"),
                "password": message.text.strip(),
                "telegram_id": tid_of(message),
                "username": uname_of(message),
            },
        )
        sessions[tid_of(message)] = out["token"]
        await state.clear()
        try:
            await message.delete()
        except Exception:
            pass
        secret = out.get("secret") or ""
        if secret:
            await message.answer(
                card("Save this key", "Shown once. Sign in with it alone.", f"<code>{h(secret)}</code>", emoji_id=M_STAR, fallback="*"),
                link_preview_options=NO_PREVIEW,
            )
        await show_home(message)
    except ApiError as exc:
        await state.clear()
        await message.answer(card("Register", "Could not create the desk.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:search")
async def cb_search(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.search)
    await paint(
        cb,
        card(
            "Search",
            "People database. Needs an active plan.",
            "Send fields, one per line:\n<code>first_name: Jane</code>\n<code>last_name: Doe</code>\n<code>city: Springfield</code>\n\nOr a short line: <code>Jane Doe Springfield IL</code>",
            emoji_id=M_SEARCH,
            fallback="⌕",
        ),
        kb([[back()]]),
    )


@router.message(Form.search, F.text)
async def msg_search(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    q = parse_fields(message.text or "")
    if not q:
        await message.answer("Send a name or field lines.", reply_markup=kb([[back()]]))
        return
    try:
        data = await api().user(token, "POST", "/v1/search", q)
        rows = data.get("results") or []
        if not rows:
            body = "No people matched."
        else:
            bits = []
            for i, r in enumerate(rows[:8], 1):
                bits.append(
                    f"{i}. <b>{h(r.get('first_name'))} {h(r.get('last_name'))}</b>\n"
                    f"{h(r.get('city'))}, {h(r.get('state'))} {h(r.get('zip_code'))}\n"
                    f"DOB {h(r.get('dob'))} · SSN {h(r.get('ssn'))}"
                )
            body = "\n\n".join(bits)
            if len(rows) > 8:
                body += f"\n\n+{len(rows) - 8} more"
        await state.clear()
        await message.answer(
            card("Search", f"{data.get('count') or 0} hits.", body, emoji_id=M_SEARCH, fallback="⌕"),
            reply_markup=kb([[btn("Search again", "go:search", style="primary", icon=M_SEARCH)], [back()]]),
            link_preview_options=NO_PREVIEW,
        )
    except ApiError as exc:
        await message.answer(card("Search", "Lookup failed.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:plans" if exc.status == 402 else "home")]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:ssndob")
async def cb_ssn(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.ssndob)
    await paint(
        cb,
        card("SSN+DOB", "$2.50 on a hit.", "Name pair or a phone.\n<code>first_name: Jane</code>\n<code>last_name: Doe</code>\n<code>city: Miami</code>", emoji_id=M_DOC, fallback="▣"),
        kb([[back()]]),
    )


@router.message(Form.ssndob, F.text)
async def msg_ssn(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    q = parse_fields(message.text or "")
    try:
        data = await api().user(token, "POST", "/v1/ssndob", q)
        r = data.get("result") or {}
        body = (
            f"▫️ Name: <code>{h(r.get('name') or (str(r.get('first_name') or '') + ' ' + str(r.get('last_name') or '')))}</code>\n"
            f"▫️ SSN: <code>{h(r.get('ssn'))}</code>\n"
            f"▫️ DOB: <code>{h(r.get('dob'))}</code>\n"
            f"▫️ Charged: <code>${h(data.get('charged'))}</code>"
        )
        await state.clear()
        await message.answer(card("SSN+DOB", "Hit.", body, emoji_id=M_OK, fallback="✓"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)
    except ApiError as exc:
        await message.answer(card("SSN+DOB", "No file or charge failed.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:cs")
async def cb_cs(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.credit)
    await paint(
        cb,
        card("Credit", "$1.00 on a score.", "Need first, last, city, state, zip.\n<code>Jane Doe Miami FL 33101</code>", emoji_id=M_NOTE, fallback="≡"),
        kb([[back()]]),
    )


@router.message(Form.credit, F.text)
async def msg_cs(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    q = parse_fields(message.text or "")
    try:
        data = await api().user(token, "POST", "/v1/credit", q)
        body = (
            f"▫️ Score: <code>{h(data.get('score'))}</code>\n"
            f"▫️ Range: <code>{h(data.get('range'))}</code>\n"
            f"▫️ Model: <code>{h(data.get('model'))}</code>\n"
            f"▫️ Charged: <code>${h(data.get('charged'))}</code>"
        )
        await state.clear()
        await message.answer(card("Credit", "VantageScore.", body, emoji_id=M_OK, fallback="✓"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)
    except ApiError as exc:
        await message.answer(card("Credit", "No file or charge failed.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back()]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:plans")
async def cb_plans(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    prices = await api().call("GET", "/v1/pricing")
    desk, api = prices["desk"], prices["api"]
    me = await api().user(token, "GET", "/v1/me")
    user = me["user"]
    body = (
        f"▫️ Desk now: <code>{h(remain(user.get('plan_until')))}</code>\n"
        f"▫️ API now: <code>{h(remain(user.get('api_plan_until')))}</code>\n"
        f"▫️ Balance: <code>{usd(user.get('balance_cents') or 0)}</code>\n\n"
        f"Desk ${h(desk['day'])} / ${h(desk['week'])} / ${h(desk['month'])}\n"
        f"API ${h(api['day'])} / ${h(api['week'])} / ${h(api['month'])}"
    )
    await paint(
        cb,
        card("Subscriptions", "Time stacks on any remaining days.", body, emoji_id=M_BOX, fallback="▣"),
        kb(
            [
                [
                    btn(f"Desk day ${int(desk['day'])}", "buy:desk:day", style="primary"),
                    btn(f"Week ${int(desk['week'])}", "buy:desk:week"),
                ],
                [btn(f"Desk month ${int(desk['month'])}", "buy:desk:month", style="success")],
                [
                    btn(f"API day ${int(api['day'])}", "buy:api:day", style="primary"),
                    btn(f"Week ${int(api['week'])}", "buy:api:week"),
                ],
                [btn(f"API month ${int(api['month'])}", "buy:api:month", style="success")],
                [back()],
            ]
        ),
    )


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    _, kind, plan = cb.data.split(":")
    try:
        await api().user(token, "POST", "/v1/subscribe", {"kind": kind, "plan": plan})
        await flash(cb, "Plan is active")
        await show_home(cb)
    except ApiError as exc:
        extra = [[btn("Top up", "go:topup", style="success", icon=M_MONEY)]] if exc.status == 402 else []
        await paint(cb, card("Plans", "Could not charge.", err_text(exc), emoji_id=M_INFO, fallback="!"), kb([*extra, [back("go:plans")]]))


@router.callback_query(F.data == "go:topup")
async def cb_topup(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.clear()
    await paint(
        cb,
        card("Top up", "Staff credits the desk after the transfer confirms.", "▫️ Invoice from $5\n▫️ Or redeem a gift code", emoji_id=M_MONEY, fallback="$"),
        kb(
            [
                [btn("New invoice", "top:new", style="primary", icon=M_MONEY)],
                [btn("Gift code", "top:code", icon=M_STAR)],
                [back()],
            ]
        ),
    )


@router.callback_query(F.data == "top:new")
async def cb_top_new(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.topup_amount)
    await paint(cb, card("Amount", "USD between 5 and 10,000.", "Send a number, e.g. <code>50</code>", emoji_id=M_MONEY, fallback="$"), kb([[back("go:topup")]]))


@router.message(Form.topup_amount, F.text)
async def msg_top_amt(message: Message, state: FSMContext):
    raw = (message.text or "").replace("$", "").strip()
    try:
        amount = float(raw)
    except ValueError:
        await message.answer("Send a number.")
        return
    if amount < 5 or amount > 10_000:
        await message.answer("Enter an amount between $5 and $10,000.")
        return
    await state.update_data(amount=amount)
    await state.set_state(Form.topup_coin)
    await message.answer(
        card("Coin", f"Invoice for <code>${amount:.2f}</code>.", "Pick a network.", emoji_id=M_MONEY, fallback="$"),
        reply_markup=kb(
            [
                [btn("BTC", "coin:BTC"), btn("ETH", "coin:ETH"), btn("LTC", "coin:LTC")],
                [btn("SOL", "coin:SOL"), btn("USDT", "coin:USDT")],
                [back("go:topup")],
            ]
        ),
        link_preview_options=NO_PREVIEW,
    )


@router.callback_query(F.data.startswith("coin:"), Form.topup_coin)
async def cb_coin(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    coin = cb.data.split(":", 1)[1]
    amount = float((await state.get_data()).get("amount") or 0)
    try:
        data = await api().user(token, "POST", "/v1/deposits", {"method": coin, "amount": amount})
        await state.clear()
        await paint(
            cb,
            card(
                "Invoice",
                f"{coin} · ${amount:.2f}",
                f"▫️ Ticket <code>#{h(data.get('id'))}</code>\n▫️ Status <code>{h(data.get('status'))}</code>\n▫️ Staff credits after the transfer confirms.",
                emoji_id=M_OK,
                fallback="✓",
            ),
            kb([[back()]]),
        )
    except ApiError as exc:
        await paint(cb, card("Invoice", "Could not open.", err_text(exc), emoji_id=M_INFO, fallback="!"), kb([[back("go:topup")]]))


@router.callback_query(F.data == "top:code")
async def cb_code(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.redeem)
    await paint(cb, card("Gift", "Paste the desk code.", "One use. Credits the balance.", emoji_id=M_STAR, fallback="*"), kb([[back("go:topup")]]))


@router.message(Form.redeem, F.text)
async def msg_redeem(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    try:
        data = await api().user(token, "POST", "/v1/redeem", {"code": message.text.strip()})
        await state.clear()
        await message.answer(
            card("Gift", "Credited.", f"▫️ Added <code>${h(data.get('credited'))}</code>\n▫️ Balance <code>{usd(data.get('balance_cents') or 0)}</code>", emoji_id=M_OK, fallback="✓"),
            reply_markup=kb([[back()]]),
            link_preview_options=NO_PREVIEW,
        )
    except ApiError as exc:
        await message.answer(card("Gift", "Code is not valid.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:topup")]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:hist")
async def cb_hist(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    data = await api().user(token, "GET", "/v1/history")
    items = data.get("items") or []
    if not items:
        body = "Ledger is empty."
    else:
        body = "\n".join(
            f"▫️ {h(i.get('date'))} · {h(i.get('type'))} · <code>{'+' if (i.get('amount') or 0) > 0 else ''}{i.get('amount')}</code>"
            for i in items[:12]
        )
    await paint(cb, card("History", "Desk ledger.", body, emoji_id=M_INFO, fallback="≡"), kb([[back()]]))


@router.callback_query(F.data == "go:keys")
async def cb_keys(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    data = await api().user(token, "GET", "/v1/keys")
    keys = data.get("keys") or []
    if not keys:
        body = "No seller keys yet. API plan is required for live keys."
    else:
        body = "\n".join(
            f"▫️ <b>{h(k.get('name'))}</b> · {h(k.get('prefix'))}…{h(k.get('last4'))}\n   {h(k.get('env'))} · {h(k.get('status'))} · {h(k.get('requests'))} req"
            for k in keys[:8]
        )
    rows = [[btn("New live key", "key:new:live", style="primary", icon=M_PLUS), btn("Test", "key:new:test")]]
    for k in keys[:6]:
        if k.get("status") == "active":
            rows.append([btn(f"Revoke {k.get('name')}", f"key:rev:{k.get('id')}", style="danger")])
    rows.append([back()])
    await paint(cb, card("API keys", "Cabinet & usage.", body, emoji_id=M_PC, fallback="⌘"), kb(rows))


@router.callback_query(F.data.startswith("key:new:"))
async def cb_key_new(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.key_name)
    await state.update_data(env="test" if cb.data.endswith("test") else "live")
    await paint(cb, card("New key", "Name this key.", "e.g. <code>seller-1</code>", emoji_id=M_PC, fallback="⌘"), kb([[back("go:keys")]]))


@router.message(Form.key_name, F.text)
async def msg_key_name(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    env = (await state.get_data()).get("env") or "live"
    try:
        data = await api().user(token, "POST", "/v1/keys", {"name": message.text.strip(), "env": env})
        await state.clear()
        await message.answer(
            card("Save this key", "Shown once.", f"<code>{h(data.get('secret'))}</code>", emoji_id=M_STAR, fallback="*"),
            reply_markup=kb([[back("go:keys")]]),
            link_preview_options=NO_PREVIEW,
        )
    except ApiError as exc:
        await message.answer(card("API keys", "Could not issue.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:keys")]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data.startswith("key:rev:"))
async def cb_key_rev(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    kid = cb.data.split(":")[-1]
    try:
        await api().user(token, "POST", f"/v1/keys/{kid}/revoke")
        await flash(cb, "Revoked")
        await cb_keys(cb, state)
    except ApiError as exc:
        await paint(cb, card("API keys", "Could not revoke.", err_text(exc), emoji_id=M_INFO, fallback="!"), kb([[back("go:keys")]]))


@router.callback_query(F.data == "go:help")
async def cb_help(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    data = await api().user(token, "GET", "/v1/tickets")
    tickets = data.get("tickets") or []
    if not tickets:
        body = "No threads yet."
    else:
        body = "\n".join(f"▫️ #{h(t.get('id'))} {h(t.get('subject'))} · {h(t.get('status'))}" for t in tickets[:8])
    rows = [[btn("New ticket", "help:new", style="primary", icon=M_PLUS)]]
    for t in tickets[:5]:
        rows.append([btn(f"#{t.get('id')} {t.get('subject')}", f"help:v:{t.get('id')}")])
    rows.append([back()])
    await paint(cb, card("Help", "Support desk.", body, emoji_id=M_CHAT, fallback="✉"), kb(rows))


@router.callback_query(F.data.startswith("help:v:"))
async def cb_help_view(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    tid = cb.data.split(":")[-1]
    data = await api().user(token, "GET", f"/v1/tickets/{tid}")
    t = data.get("ticket") or {}
    thread = data.get("thread") or []
    bits = [f"<b>{h(t.get('subject'))}</b> · {h(t.get('status'))}", h(t.get("preview") or "")]
    for m in thread[-8:]:
        bits.append(f"{h(m.get('sender'))}: {h(m.get('text'))}")
    await paint(cb, card(f"Ticket {tid}", "Thread.", "\n\n".join(bits), emoji_id=M_CHAT, fallback="✉"), kb([[back("go:help")]]))


@router.callback_query(F.data == "help:new")
async def cb_help_new(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.ticket_subject)
    await paint(cb, card("Help", "Subject first.", "One short line.", emoji_id=M_CHAT, fallback="✉"), kb([[back("go:help")]]))


@router.message(Form.ticket_subject, F.text)
async def msg_subj(message: Message, state: FSMContext):
    await state.update_data(subject=message.text.strip())
    await state.set_state(Form.ticket_body)
    await message.answer(card("Help", "Now the message.", "Write the issue.", emoji_id=M_NOTE, fallback="≡"), reply_markup=kb([[back("go:help")]]), link_preview_options=NO_PREVIEW)


@router.message(Form.ticket_body, F.text)
async def msg_body(message: Message, state: FSMContext):
    token = await need_auth(message, state)
    if not token:
        return
    subject = (await state.get_data()).get("subject") or "Help"
    try:
        data = await api().user(token, "POST", "/v1/tickets", {"subject": subject, "body": message.text.strip()})
        await state.clear()
        await message.answer(
            card("Help", "Ticket opened.", f"▫️ #{h(data.get('id'))} {h(subject)}", emoji_id=M_OK, fallback="✓"),
            reply_markup=kb([[back("go:help")]]),
            link_preview_options=NO_PREVIEW,
        )
    except ApiError as exc:
        await message.answer(card("Help", "Could not open.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:help")]]), link_preview_options=NO_PREVIEW)


@router.callback_query(F.data == "go:set")
async def cb_set(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    me = await api().user(token, "GET", "/v1/me")
    user = me["user"]
    body = (
        f"▫️ Login: <code>{h(user.get('login'))}</code>\n"
        f"▫️ Telegram: <code>@{h(user.get('telegram_username') or 'linked')}</code>\n"
        f"▫️ Secret: <code>••••{h(user.get('secret_last4') or 'none')}</code>\n"
        f"▫️ Referrals: <code>{h(user.get('referrals') or 0)}</code>"
    )
    await paint(
        cb,
        card("Settings", "Account, key, unlink.", body, emoji_id=M_GEAR, fallback="⚙"),
        kb(
            [
                [web_btn("RXMiniApp", await mini_url(tid_of(cb)), style="success", icon=M_BOLT)],
                [btn("Unlink Telegram", "set:unlink", style="danger")],
                [back()],
            ]
        ),
    )


@router.callback_query(F.data == "set:unlink")
async def cb_unlink(cb: CallbackQuery, state: FSMContext):
    try:
        await api().bot("/v1/bot/unlink", {"telegram_id": tid_of(cb)})
        sessions.pop(tid_of(cb), None)
        await state.clear()
        await show_guest(cb)
    except ApiError as exc:
        await paint(cb, card("Settings", "Could not unlink.", err_text(exc), emoji_id=M_INFO, fallback="!"), kb([[back("go:set")]]))


def names_block() -> str:
    return "\n".join(f"▫️ <code>{name}</code>" for name in READY_NAMES)


@router.callback_query(F.data == "go:mirrors")
async def cb_mirrors(cb: CallbackQuery, state: FSMContext):
    token = await need_auth(cb, state)
    if not token:
        return
    await state.clear()
    data = await api().bot("/v1/bot/mirrors", method="GET", telegram_id=tid_of(cb))
    mirrors = data.get("mirrors") or []
    listed = "\n".join(f"▫️ @{h(m.get('username'))}" for m in mirrors) or "No mirrors yet."
    body = (
        f"{listed}\n\n"
        "Create a bot in @BotFather with a ready username, then send the token here.\n\n"
        f"<b>Ready usernames</b>\n{names_block()}\n\n"
        "<i>Username must contain rxlookup.</i>"
    )
    rows = [[btn("Add mirror token", "mir:add", style="primary", icon=M_PLUS)]]
    for m in mirrors[:8]:
        rows.append([btn(f"Drop @{m.get('username')}", f"mir:drop:{m.get('id')}", style="danger")])
    rows.append([back()])
    await paint(cb, card("Mirrors", "Same desk, extra bot.", body, emoji_id=M_LINK, fallback="⛓"), kb(rows))


@router.callback_query(F.data == "mir:add")
async def cb_mir_add(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    await state.set_state(Form.mirror_token)
    await paint(
        cb,
        card(
            "Create your bot",
            "Use a ready rxlookup username.",
            f"{names_block()}\n\n1. Open @BotFather → /newbot\n2. Name it RX Lookup\n3. Pick one of the usernames above\n4. Paste the token here",
            emoji_id=M_LINK,
            fallback="⛓",
        ),
        kb([[back("go:mirrors")]]),
    )


@router.message(Form.mirror_token, F.text)
async def msg_mirror(message: Message, state: FSMContext, bot: Bot):
    if not await need_auth(message, state):
        return
    token = (message.text or "").strip()
    try:
        await message.delete()
    except Exception:
        pass
    probe = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        me = await probe.get_me()
        username = me.username or ""
        if "rxlookup" not in username.lower():
            await message.answer(
                card("Mirrors", "Username rejected.", 'The bot username must contain <code>rxlookup</code>.', emoji_id=M_INFO, fallback="!"),
                reply_markup=kb([[back("go:mirrors")]]),
                link_preview_options=NO_PREVIEW,
            )
            return
        await api().bot(
            "/v1/bot/mirrors",
            {"token": token, "username": username, "telegram_id": tid_of(message)},
        )
        try:
            await probe.set_chat_menu_button(menu_button=MenuButtonWebApp(text="RXMiniApp", web_app=WebAppInfo(url=APP_ORIGIN)))
        except Exception:
            pass
        await state.clear()
        await message.answer(
            card("Mirrors", "Mirror is live.", f"▫️ @{h(username)}\n▫️ Same desk as this bot.", emoji_id=M_OK, fallback="✓"),
            reply_markup=kb([[back("go:mirrors")]]),
            link_preview_options=NO_PREVIEW,
        )
    except ApiError as exc:
        await message.answer(card("Mirrors", "Could not save.", err_text(exc), emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:mirrors")]]), link_preview_options=NO_PREVIEW)
    except Exception:
        await message.answer(card("Mirrors", "Token is not valid.", "Paste the token from @BotFather.", emoji_id=M_INFO, fallback="!"), reply_markup=kb([[back("go:mirrors")]]), link_preview_options=NO_PREVIEW)
    finally:
        await probe.session.close()


@router.callback_query(F.data.startswith("mir:drop:"))
async def cb_mir_drop(cb: CallbackQuery, state: FSMContext):
    if not await need_auth(cb, state):
        return
    mid = int(cb.data.split(":")[-1])
    try:
        await api().bot("/v1/bot/mirrors/drop", {"id": mid, "telegram_id": tid_of(cb)})
        await flash(cb, "Dropped")
        await cb_mirrors(cb, state)
    except ApiError as exc:
        await paint(cb, card("Mirrors", "Could not drop.", err_text(exc), emoji_id=M_INFO, fallback="!"), kb([[back("go:mirrors")]]))


@router.message(StateFilter(None), F.text)
async def fallback_text(message: Message, state: FSMContext):
    if (message.text or "").startswith("/"):
        return
    await show_home(message)


@router.errors()
async def on_error(event: ErrorEvent):
    update = event.update
    try:
        if update.message:
            await update.message.answer("Desk hiccup. Send /start again.")
        elif update.callback_query:
            await update.callback_query.answer("Desk hiccup. Send /start.", show_alert=True)
    except Exception:
        pass


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp
