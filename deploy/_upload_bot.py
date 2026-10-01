import os
import posixpath
from pathlib import Path
import paramiko

host = os.environ["RX_HOST"]
user = os.environ["RX_USER"]
password = os.environ["RX_PASS"]
token = os.environ.get("TG_BOT_TOKEN", "").strip()
remote_root = "/opt/rxlookup-bot"
local_bot = Path(__file__).resolve().parent.parent / "bot"
local_unit = Path(__file__).resolve().parent.parent / "deploy" / "rxlookup-bot.service"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=password, timeout=40, banner_timeout=60, look_for_keys=False, allow_agent=False)


def run(cmd, check=True):
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip() and "SECRET" not in out and "TOKEN" not in out:
        print(out.encode("ascii", "replace").decode("ascii"))
    if err.strip():
        print(err.encode("ascii", "replace").decode("ascii"))
    if check and code != 0:
        raise SystemExit(f"failed {code}: {cmd}")
    return code, out


run(f"mkdir -p {remote_root}")
sftp = c.open_sftp()
for path in local_bot.iterdir():
    if path.suffix in {".py", ".txt"}:
        sftp.put(str(path), posixpath.join(remote_root, path.name))
sftp.put(str(local_unit), "/etc/systemd/system/rxlookup-bot.service")
sftp.close()

run("test -d /opt/rxlookup-bot/venv || python3 -m venv /opt/rxlookup-bot/venv")
run("/opt/rxlookup-bot/venv/bin/pip install -q -r /opt/rxlookup-bot/requirements.txt")

_, raw_env = run("cat /opt/rxlookup-api/.env 2>/dev/null; echo; cat /opt/rxlookup-bot/.env 2>/dev/null", check=False)
# parsed locally — never print env contents
vals = {}
for line in raw_env.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        key, value = line.split("=", 1)
        if key.strip() in {"RX_SECRET", "RX_BOT_SECRET", "TG_BOT_TOKEN", "TG_BOT_USERNAME", "APP_ORIGIN", "RX_API", "RX_DB"}:
            vals[key.strip()] = value.strip()
if token:
    vals["TG_BOT_TOKEN"] = token
vals.setdefault("RX_BOT_SECRET", __import__("secrets").token_hex(24))
vals.setdefault("APP_ORIGIN", "https://rx.144.124.248.226.sslip.io")
vals.setdefault("RX_API", "http://127.0.0.1:8787")
if token:
    import json
    import urllib.request
    try:
        with urllib.request.urlopen("https://api.telegram.org/bot" + token + "/getMe", timeout=20) as resp:
            uname = ((json.loads(resp.read().decode()).get("result") or {}).get("username") or "")
            if uname:
                vals["TG_BOT_USERNAME"] = uname
    except Exception as exc:
        print("getMe skipped", type(exc).__name__)
vals.setdefault("TG_BOT_USERNAME", "")
text = "".join(f"{k}={v}\n" for k, v in vals.items())
sftp = c.open_sftp()
for dest in ("/opt/rxlookup-api/.env", "/opt/rxlookup-bot/.env"):
    with sftp.file(dest, "w") as fh:
        fh.write(text)
sftp.close()
print("bot_user=" + vals.get("TG_BOT_USERNAME", ""))
print("secret_ready=1")

run("chown -R www-data:www-data /opt/rxlookup-bot /opt/rxlookup-api/.env /opt/rxlookup-bot/.env")
run("systemctl daemon-reload")
run("systemctl enable --now rxlookup-bot")
run("systemctl restart rxlookup-api")
run("systemctl restart rxlookup-bot")
run("systemctl is-active rxlookup-bot")
c.close()
print("BOT DONE")
