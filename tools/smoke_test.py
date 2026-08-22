#!/usr/bin/env python3
"""Kiem tra nhanh portal con song va con dung.

Chay hai che do:
  - Sau moi lan deploy (tools/deploy.sh goi) — that bai thi deploy TU ROLLBACK.
  - Theo systemd timer moi 10 phut — that bai thi ghi mot su kien `critical`
    vao app_error, tu do Zabbix + Web Push bao ra ngoai.

KHONG can ve Kerberos: goi thang 127.0.0.1:8000 kem header X-Remote-User.
Apache moi la cho chan gia mao header do, nen tu tren may thi di duoc.

  python3 tools/smoke_test.py            # kiem, in ket qua
  python3 tools/smoke_test.py --report   # kiem, va ghi app_error neu hong
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

LIVE = os.environ.get("LIVE", "/var/www/avp-portal")
API = os.environ.get("API", "http://127.0.0.1:8000")
# Tai khoan chi dung de goc nhin "mot nguoi dung binh thuong". Khong can mat khau
# vi goi thang backend; quyen that do Apache + Kerberos quyet dinh.
AS_USER = os.environ.get("SMOKE_USER", "smoke-test")
TIMEOUT = 10

fails: list[str] = []
notes: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    """`detail` la loi giai thich KHI HONG — dat thi khong in, khong thi dong
    log se noi nguoc su that (vd: "[OK] telemetry dang BAT — TELEMETRY_ENABLED=0")."""
    print(f"  [{'OK ' if ok else 'LOI'}] {name}{('' if ok else (' — ' + detail) if detail else '')}")
    if not ok:
        fails.append(f"{name}: {detail}" if detail else name)


def get(path: str) -> tuple[int, bytes]:
    req = urllib.request.Request(API + path, headers={"X-Remote-User": AS_USER})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()


# 1) index.html tro toi chunk CO THAT tren dia -----------------------------
# Day chinh la loi da lam trang site 13/08: index.html moi + chunk cu, hoac
# nguoc lai. Trinh duyet khong bao gi ca, chi hien trang trang.
index_path = os.path.join(LIVE, "index.html")
if not os.path.isfile(index_path):
    check("index.html ton tai", False, index_path)
else:
    html = open(index_path, encoding="utf-8", errors="replace").read()
    refs = set(re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', html))
    missing = [r for r in refs
               if not r.startswith(("http", "//"))
               and not os.path.isfile(os.path.join(LIVE, r.lstrip("/")))]
    check(f"index.html tro toi {len(refs)} chunk co that", not missing, ", ".join(missing[:5]))

# 2) khong con file bam rac ------------------------------------------------
HASHED = re.compile(r"^(chunk|main|polyfills|styles|scripts)-[A-Z0-9]{8}\.(js|css)(\.map)?$")
if os.path.isdir(LIVE):
    live_files = set(os.listdir(LIVE))
    referenced = set()
    if os.path.isfile(index_path):
        html = open(index_path, encoding="utf-8", errors="replace").read()
        referenced = {r.lstrip("/") for r in re.findall(r'(?:src|href)="([^"]+)"', html)}
    # Chunk lazy khong nam trong index.html nen KHONG the coi moi file khong
    # duoc tham chieu la rac — chi canh bao khi so luong bat thuong.
    hashed = [f for f in live_files if HASHED.fullmatch(f)]
    notes.append(f"{len(hashed)} file bam trong {LIVE}")
    check("khong co file .map lot ra web", not [f for f in hashed if f.endswith(".map")],
          "sourcemap phai nam o /opt/avp-portal-maps")

# 3) /api/health ------------------------------------------------------------
st, body = get("/api/health")
if st != 200:
    check("/api/health = 200", False, f"HTTP {st}")
else:
    try:
        h = json.loads(body)
        bad = [k for k, v in h.items() if k != "build" and v != "ok"]
        check("/api/health moi muc deu ok", not bad, ", ".join(f"{k}={h[k]}" for k in bad))
        notes.append(f"build={h.get('build') or '(rong)'}")
    except Exception as e:  # noqa: BLE001
        check("/api/health tra JSON", False, str(e))

# 4) cac endpoint GET chinh --------------------------------------------------
for path, want in [("/api/me", 200), ("/api/content", 200), ("/api/directory", 200),
                   ("/api/rail", 200), ("/api/news", 200),
                   ("/api/telemetry/metrics", 200)]:
    st, body = get(path)
    ok = st == want
    detail = f"HTTP {st}"
    if ok and body[:1] not in (b"{", b"["):
        ok, detail = False, "khong phai JSON"
    check(f"GET {path}", ok, "" if ok else detail)

# 5) duong ong telemetry con song -------------------------------------------
st, body = get("/api/telemetry/metrics")
if st == 200:
    try:
        m = json.loads(body)
        check("telemetry dang BAT", m.get("enabled") == 1,
              "TELEMETRY_ENABLED=0 — /admin/errors se trong ma khong phai vi het loi")
        check("telemetry noi duoc DB", m.get("db_ok") == 1)
    except Exception as e:  # noqa: BLE001
        check("metrics tra JSON", False, str(e))

print()
for n in notes:
    print(f"  ghi chu: {n}")

if not fails:
    print("\nTAT CA DAT.")
    sys.exit(0)

print(f"\nTHAT BAI {len(fails)} muc:")
for f in fails:
    print(f"  - {f}")

if "--report" in sys.argv:
    # Ban chay theo timer: bien that bai thanh mot su kien critical de Zabbix
    # va Web Push bao ra ngoai, thay vi chi nam trong log cua timer.
    try:
        sys.path.insert(0, "/opt/avp-portal-api")
        from app.telemetry import record  # type: ignore
        record("server", "SmokeTestFailed", "; ".join(fails)[:1000],
               severity="critical", context={"fails": fails})
        print("  (da ghi mot su kien critical vao app_error)")
    except Exception as e:  # noqa: BLE001
        print(f"  (khong ghi duoc app_error: {e})")

sys.exit(1)
