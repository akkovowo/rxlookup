from __future__ import annotations

import html
from typing import Any

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, LinkPreviewOptions, WebAppInfo

M_OK = "5260726538302660868"
M_NO = "5258226313285607065"
M_PLUS = "5258108352008823107"
M_USER = "5258362837411045098"
M_CHAT = "5258215846450305872"
M_BOX = "5258134813302332906"
M_NOTE = "5257965174979042426"
M_GEAR = "5258096772776991776"
M_LEFT = "5258236805890710909"
M_RIGHT = "5260450573768990626"
M_STAR = "5258185631355378853"
M_SEARCH = "5429571366384842791"
M_HOME = "5257963315258204021"
M_DOC = "5258477770735885832"
M_LINK = "5260730055880876557"
M_PC = "5258423306255604960"
M_MONEY = "5258204546391351475"
M_INFO = "5258503720928288433"
M_KEY = "5258096772776991776"
M_BOLT = "5258152182150077732"

NO_PREVIEW = LinkPreviewOptions(is_disabled=True)


def h(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def pe(emoji_id: str, fallback: str) -> str:
    return fallback


def tab(emoji_id: str, fallback: str, hashtag: str, subtitle: str) -> str:
    return f"{fallback} <b>#{hashtag}</b>\n<i>{subtitle}</i>"


def kb(rows) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _make_button(**kwargs) -> InlineKeyboardButton:
    try:
        return InlineKeyboardButton(**kwargs)
    except TypeError:
        kwargs.pop("style", None)
        kwargs.pop("icon_custom_emoji_id", None)
        try:
            return InlineKeyboardButton(**kwargs)
        except TypeError:
            kwargs.pop("web_app", None)
            return InlineKeyboardButton(**kwargs)


def btn(text: str, data: str, *, style: str | None = None, icon: str | None = None) -> InlineKeyboardButton:
    kwargs: dict[str, Any] = {"text": text, "callback_data": data}
    if style:
        kwargs["style"] = style
    if icon:
        kwargs["icon_custom_emoji_id"] = icon
    return _make_button(**kwargs)


def url_btn(text: str, url: str, *, style: str | None = None, icon: str | None = None) -> InlineKeyboardButton:
    kwargs: dict[str, Any] = {"text": text, "url": url}
    if style:
        kwargs["style"] = style
    if icon:
        kwargs["icon_custom_emoji_id"] = icon
    return _make_button(**kwargs)


def web_btn(text: str, url: str, *, style: str | None = None, icon: str | None = None) -> InlineKeyboardButton:
    kwargs: dict[str, Any] = {"text": text, "web_app": WebAppInfo(url=url)}
    if style:
        kwargs["style"] = style
    if icon:
        kwargs["icon_custom_emoji_id"] = icon
    return _make_button(**kwargs)


def back(data: str = "home", text: str = "Back") -> InlineKeyboardButton:
    return btn(text, data, icon=M_LEFT)


def card(hashtag: str, subtitle: str, body: str, *, emoji_id: str = M_STAR, fallback: str = "✦") -> str:
    return f"{tab(emoji_id, fallback, hashtag, subtitle)}\n\n<blockquote>{body}</blockquote>"
