from __future__ import annotations

from typing import Any

import aiohttp


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Rx:
    def __init__(self, base: str, secret: str):
        self.base = base.rstrip("/")
        self.secret = secret
        self._http: aiohttp.ClientSession | None = None

    async def start(self) -> None:
        if not self._http:
            self._http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=40))

    async def close(self) -> None:
        if self._http:
            await self._http.close()
            self._http = None

    def _headers(self, token: str | None = None, bot: bool = False) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if bot:
            headers["X-Bot-Secret"] = self.secret
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def call(
        self,
        method: str,
        path: str,
        json: dict[str, Any] | None = None,
        token: str | None = None,
        bot: bool = False,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        assert self._http
        async with self._http.request(
            method,
            f"{self.base}{path}",
            json=json,
            params=params,
            headers=self._headers(token, bot),
        ) as res:
            try:
                data = await res.json()
            except Exception:
                data = {"detail": await res.text()}
            if res.status >= 400:
                err = data.get("error") if isinstance(data, dict) else None
                message = ""
                if isinstance(err, dict):
                    message = str(err.get("message") or "")
                if not message:
                    message = str(data.get("detail") or data.get("message") or f"HTTP {res.status}")
                raise ApiError(res.status, message)
            return data if isinstance(data, dict) else {"ok": True}

    async def bot(self, path: str, json: dict[str, Any] | None = None, method: str = "POST", **params: Any):
        return await self.call(method, path, json=json, bot=True, params=params or None)

    async def user(self, token: str, method: str, path: str, json: dict[str, Any] | None = None):
        return await self.call(method, path, json=json, token=token)
