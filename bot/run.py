from __future__ import annotations

import asyncio
import os
import sys

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import APP_ORIGIN, build_dispatcher
from client import Rx

MAIN = os.environ.get("TG_BOT_TOKEN", "").strip()
API = os.environ.get("RX_API", "http://127.0.0.1:8787")
SECRET = os.environ.get("RX_BOT_SECRET", "")

_dp = None


def dispatcher():
    global _dp
    if _dp is None:
        _dp = build_dispatcher()
    return _dp


async def configure(bot: Bot) -> None:
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="RXMiniApp", web_app=WebAppInfo(url=APP_ORIGIN))
        )
    except Exception:
        pass
    try:
        await bot.set_my_description("RX Lookup desk — search, keys, balance, plans.")
        await bot.set_my_short_description("RX Lookup")
    except Exception:
        pass


async def wanted_tokens(api: Rx) -> list[str]:
    tokens = [MAIN] if MAIN else []
    try:
        data = await api.bot("/v1/bot/mirrors", method="GET")
        for token in data.get("tokens") or []:
            if token and token not in tokens:
                tokens.append(token)
    except Exception:
        pass
    return tokens


async def poll_all(tokens: list[str]) -> None:
    dp = dispatcher()
    bots = [
        Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML, link_preview_is_disabled=True))
        for token in tokens
    ]
    try:
        for bot in bots:
            await configure(bot)
        await dp.start_polling(*bots, allowed_updates=dp.resolve_used_update_types())
    finally:
        await dp.stop_polling()
        for bot in bots:
            await bot.session.close()


async def supervisor() -> None:
    api = Rx(API, SECRET)
    await api.start()
    import app as appmod

    appmod.rx = api
    last: list[str] = []
    task: asyncio.Task | None = None
    try:
        while True:
            wanted = await wanted_tokens(api)
            if wanted and wanted != last:
                if task:
                    dispatcher().stop_polling()
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass
                last = wanted
                task = asyncio.create_task(poll_all(wanted), name="rxbot-poll")
            await asyncio.sleep(8)
    finally:
        if task:
            dispatcher().stop_polling()
            task.cancel()
        await api.close()


def main() -> None:
    if not MAIN:
        raise SystemExit("TG_BOT_TOKEN is missing")
    if not SECRET:
        raise SystemExit("RX_BOT_SECRET is missing")
    asyncio.run(supervisor())


if __name__ == "__main__":
    main()
