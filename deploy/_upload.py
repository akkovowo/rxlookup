import os
import posixpath
from pathlib import Path
import paramiko

host = os.environ["RX_HOST"]
user = os.environ["RX_USER"]
password = os.environ["RX_PASS"]
remote_root = "/var/www/rxlookup"
local_dist = Path(r"c:\Users\akkov\Desktop\rxlookup\dist")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=password, timeout=40, banner_timeout=60, look_for_keys=False, allow_agent=False)

def run(cmd, check=True):
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out)
    if err.strip():
        print(err)
    if check and code != 0:
        raise SystemExit(f"failed {code}: {cmd}")

run(f"mkdir -p {remote_root}")
run(f"find {remote_root} -mindepth 1 -delete")
sftp = c.open_sftp()

def put_dir(src: Path, dest: str):
    for path in src.rglob("*"):
        rel = path.relative_to(src).as_posix()
        remote = posixpath.join(dest, rel)
        if path.is_dir():
            try:
                sftp.stat(remote)
            except FileNotFoundError:
                sftp.mkdir(remote)
        else:
            parent = posixpath.dirname(remote)
            try:
                sftp.stat(parent)
            except FileNotFoundError:
                run(f"mkdir -p {parent}")
            sftp.put(str(path), remote)

put_dir(local_dist, remote_root)
sftp.close()
run(f"chown -R www-data:www-data {remote_root}")
run("nginx -t && systemctl reload nginx")
c.close()
print("DONE")
