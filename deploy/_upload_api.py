import os
import posixpath
from pathlib import Path
import paramiko

host = os.environ["RX_HOST"]
user = os.environ["RX_USER"]
password = os.environ["RX_PASS"]
remote_root = "/opt/rxlookup-api"
local_api = Path(__file__).resolve().parent.parent / "api"
local_unit = Path(__file__).resolve().parent.parent / "deploy" / "rxlookup-api.service"
local_nginx = Path(__file__).resolve().parent.parent / "deploy" / "nginx.rxlookup.conf"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=password, timeout=40, banner_timeout=60, look_for_keys=False, allow_agent=False)

def run(cmd, check=True):
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.encode("utf-8", "replace").decode("ascii", "replace"))
    if err.strip():
        print(err.encode("utf-8", "replace").decode("ascii", "replace"))
    if check and code != 0:
        raise SystemExit(f"failed {code}: {cmd}")
    return code, out

run(f"mkdir -p {remote_root} /var/lib/rxlookup")
sftp = c.open_sftp()

def put_file(src: Path, dest: str):
    parent = posixpath.dirname(dest)
    run(f"mkdir -p {parent}")
    sftp.put(str(src), dest)

for path in local_api.iterdir():
    if path.suffix in {".py", ".txt"}:
        sftp.put(str(path), posixpath.join(remote_root, path.name))

put_file(local_unit, "/etc/systemd/system/rxlookup-api.service")
put_file(local_nginx, "/etc/nginx/sites-available/rxlookup")
sftp.close()

run("test -f /opt/rxlookup-api/.env || python3 -c \"import secrets; open('/opt/rxlookup-api/.env','w').write('RX_SECRET='+secrets.token_hex(32)+'\\n')\"")
run("test -d /opt/rxlookup-api/venv || python3 -m venv /opt/rxlookup-api/venv")
run("/opt/rxlookup-api/venv/bin/pip install -q -r /opt/rxlookup-api/requirements.txt")
run("chown -R www-data:www-data /opt/rxlookup-api /var/lib/rxlookup")
run("ln -sfn /etc/nginx/sites-available/rxlookup /etc/nginx/sites-enabled/rxlookup")
run("systemctl daemon-reload")
run("systemctl enable --now rxlookup-api")
run("systemctl restart rxlookup-api")
run("nginx -t && systemctl reload nginx")
c.close()
print("API DONE")
