# RX Lookup

Private lookup desk: web UI, API, and Telegram bot.

## Layout

- `src` — Vite + React desk
- `api` — FastAPI backend
- `bot` — Telegram bot
- `deploy` — nginx unit files and upload helpers

## Frontend

```bash
npm install
npm run dev
```

Production build: `npm run build`.

## API

```bash
cd api
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8787
```

## Bot

Secrets live in `.env` on the host (`TG_BOT_TOKEN`, `RX_BOT_SECRET`, `APP_ORIGIN`, `RX_API`). Do not commit them.

```bash
cd bot
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
python run.py
```

Deploy helpers in `deploy/` read `RX_HOST`, `RX_USER`, and `RX_PASS` from the environment.
