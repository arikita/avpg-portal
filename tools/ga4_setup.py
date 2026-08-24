#!/usr/bin/env python3
"""Tao service account doc so lieu GA4 cho portal — tu dong, KHONG can bam Console.

VI SAO CO FILE NAY: tab "Luot truy cap" cua /admin can doc nguoc so lieu GA4 ve.
Viec do doi mot service account co quyen Viewer tren property GA4. Lam bang tay
la ~15 lan bam qua hai giao dien (Google Cloud Console + Analytics Admin) va rat
de bam sai chuoc — nhat la buoc cap quyen o GA, vi no nam sau ba lop menu.

CHAY:
    1) Nguoi dung chay MOT lan (Google bat buoc phai co nguoi dong y, khong the
       tu dong hoa bang mat khau — xem ghi chu o cuoi file):

         gcloud auth application-default login --no-launch-browser \\
           --scopes=https://www.googleapis.com/auth/cloud-platform,\\
https://www.googleapis.com/auth/analytics.manage.users

    2) Roi chay file nay:

         python3 tools/ga4_setup.py

Ket qua: in ra duong dan file JSON khoa + email service account, va da cap Viewer
tren property GA4. Sau do chi con chep khoa len .136 va dat GA4_SA_JSON.

AN TOAN: file nay KHONG bao gio nhan mat khau. No dung access token cua chinh
nguoi dang nhap (Application Default Credentials), va token do het han sau 1 gio.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

# Property GA4 cua portal — xem memory portal_analytics_ga4_2026-08-18.
PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "550323823")
PROJECT_ID = os.environ.get("GA4_GCP_PROJECT", "avp-portal-analytics")
PROJECT_NAME = "AVP Portal Analytics"
SA_ID = "avp-portal-ga4"
SA_DISPLAY = "AVP Portal - doc so lieu GA4"
KEY_OUT = os.environ.get("GA4_KEY_OUT", os.path.expanduser("~/avp-portal-ga4.json"))
GCLOUD = os.environ.get("GCLOUD", os.path.expanduser("~/google-cloud-sdk/bin/gcloud"))


def die(msg: str, hint: str = "") -> None:
    print(f"\nDUNG LAI: {msg}", file=sys.stderr)
    if hint:
        print(f"  -> {hint}", file=sys.stderr)
    sys.exit(1)


def token() -> str:
    try:
        out = subprocess.run([GCLOUD, "auth", "application-default", "print-access-token"],
                             capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        die(f"khong tim thay gcloud o {GCLOUD}", "dat bien GCLOUD tro dung cho")
    if out.returncode != 0:
        die("chua dang nhap Application Default Credentials",
            "chay lenh `gcloud auth application-default login ...` o dau file nay")
    return out.stdout.strip()


TOKEN = ""


def call(method: str, url: str, body: dict | None = None, ok404: bool = False) -> dict:
    """Goi REST API cua Google. Tra {} khi 404 va ok404=True (kiem 'da co chua')."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + TOKEN,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        if e.code == 404 and ok404:
            return {}
        # 409 = da ton tai. Script phai chay lai duoc nhieu lan ma khong hong.
        if e.code == 409:
            return {"_exists": True}
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{detail[:800]}") from None


def wait_op(op: dict, poll_url: str | None = None) -> dict:
    """Cloud Resource Manager tra ve Operation — phai doi no xong moi dung tiep."""
    if op.get("done") or not op.get("name"):
        return op
    url = poll_url or f"https://cloudresourcemanager.googleapis.com/v1/{op['name']}"
    for _ in range(40):
        time.sleep(3)
        cur = call("GET", url)
        if cur.get("done"):
            if cur.get("error"):
                raise RuntimeError(f"operation loi: {cur['error']}")
            return cur
    raise RuntimeError("operation khong xong sau 2 phut")


def step(n: int, what: str) -> None:
    print(f"\n=== {n}/6  {what}")


def main() -> None:
    global TOKEN
    TOKEN = token()

    # --- 1) Project -------------------------------------------------------
    step(1, "project Google Cloud")
    got = call("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT_ID}",
               ok404=True)
    if got.get("projectId"):
        print(f"  da co: {PROJECT_ID} ({got.get('lifecycleState')})")
    else:
        print(f"  tao moi: {PROJECT_ID}")
        try:
            op = call("POST", "https://cloudresourcemanager.googleapis.com/v1/projects",
                      {"projectId": PROJECT_ID, "name": PROJECT_NAME})
        except RuntimeError as e:
            if "TOS_NOT_ACCEPTED" in str(e) or "Terms of Service" in str(e):
                die("tai khoan Google chua chap nhan dieu khoan Google Cloud",
                    "mo https://console.cloud.google.com/ bang tai khoan do, bam dong y "
                    "dieu khoan mot lan, roi chay lai file nay")
            raise
        if not op.get("_exists"):
            wait_op(op)
        print("  xong")

    # --- 2) Bat API -------------------------------------------------------
    step(2, "bat Google Analytics Data API")
    op = call("POST", f"https://serviceusage.googleapis.com/v1/projects/{PROJECT_ID}"
                      f"/services/analyticsdata.googleapis.com:enable", {})
    if op.get("name") and not op.get("done"):
        wait_op(op, f"https://serviceusage.googleapis.com/v1/{op['name']}")
    print("  analyticsdata.googleapis.com da bat")

    # --- 3) Service account ----------------------------------------------
    step(3, "service account")
    sa_email = f"{SA_ID}@{PROJECT_ID}.iam.gserviceaccount.com"
    got = call("GET", f"https://iam.googleapis.com/v1/projects/{PROJECT_ID}"
                      f"/serviceAccounts/{sa_email}", ok404=True)
    if got.get("email"):
        print(f"  da co: {sa_email}")
    else:
        # KHONG cap role IAM nao trong project: service account nay chi can quyen
        # ben Google Analytics, khong can dong toi tai nguyen Cloud nao ca.
        call("POST", f"https://iam.googleapis.com/v1/projects/{PROJECT_ID}/serviceAccounts",
             {"accountId": SA_ID, "serviceAccount": {"displayName": SA_DISPLAY}})
        print(f"  tao xong: {sa_email}")

    # --- 4) Khoa JSON -----------------------------------------------------
    step(4, "khoa JSON")
    if os.path.exists(KEY_OUT):
        print(f"  da co file {KEY_OUT} — giu nguyen, khong tao khoa moi")
    else:
        key = call("POST", f"https://iam.googleapis.com/v1/projects/{PROJECT_ID}"
                           f"/serviceAccounts/{sa_email}/keys",
                   {"privateKeyType": "TYPE_GOOGLE_CREDENTIALS_FILE",
                    "keyAlgorithm": "KEY_ALG_RSA_2048"})
        import base64
        raw = base64.b64decode(key["privateKeyData"])
        # Ghi voi 600 NGAY TU DAU: khoa nay doc duoc toan bo so lieu GA4.
        fd = os.open(KEY_OUT, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as fh:
            fh.write(raw)
        print(f"  luu: {KEY_OUT} (chmod 600)")

    # --- 5) Cap Viewer tren property GA4 ----------------------------------
    step(5, f"cap Viewer tren property GA4 {PROPERTY_ID}")
    existing = call("GET", f"https://analyticsadmin.googleapis.com/v1beta/properties/"
                           f"{PROPERTY_ID}/accessBindings?pageSize=200", ok404=True)
    have = any(b.get("user") == sa_email for b in existing.get("accessBindings", []))
    if have:
        print("  da co quyen tu truoc")
    else:
        try:
            call("POST", f"https://analyticsadmin.googleapis.com/v1beta/properties/"
                         f"{PROPERTY_ID}/accessBindings",
                 {"user": sa_email, "roles": ["predefinedRoles/viewer"]})
            print("  da cap Viewer")
        except RuntimeError as e:
            msg = str(e)
            if "403" in msg:
                die("tai khoan dang nhap khong co quyen quan ly nguoi dung tren property nay",
                    f"phai dang nhap bang tai khoan la Administrator cua property {PROPERTY_ID}, "
                    f"hoac them tay {sa_email} lam Viewer o Analytics > Admin > "
                    f"Property Access Management")
            raise

    # --- 6) Thu doc that --------------------------------------------------
    step(6, "thu doc so lieu bang chinh khoa vua tao")
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    os.environ["GA4_SA_JSON"] = KEY_OUT
    os.environ["GA4_PROPERTY_ID"] = PROPERTY_ID
    os.environ.setdefault("DATABASE_URL", "")
    from server.app import admin as adm          # noqa: E402
    adm.GA4_SA_JSON = KEY_OUT
    adm.GA4_PROPERTY_ID = PROPERTY_ID
    adm._ga4_token = {"value": "", "exp": 0.0}
    res = adm.ga4(days=7, username="setup")
    if not res.get("ok"):
        print(f"  CHUA DOC DUOC: {res.get('error') or res.get('reason')}")
        print("  (quyen GA4 co the mat vai phut moi hieu luc — thu lai sau 2-3 phut)")
    else:
        t = res["totals"]
        print(f"  DAT — 7 ngay qua: {t['users']} nguoi, {t['sessions']} phien, "
              f"{t['views']} luot xem; dang truy cap: {res['realtimeUsers']}")

    print(f"""
=== XONG
  service account : {sa_email}
  khoa JSON       : {KEY_OUT}
  property GA4    : {PROPERTY_ID}

Buoc cuoi (tren .136):
  install -o www-data -g www-data -m 600 <khoa> /etc/avp-portal-ga4.json
  them  GA4_SA_JSON=/etc/avp-portal-ga4.json  vao /etc/avp-portal-api.env
  systemctl restart avp-portal-api        # RESTART, khong reload: reload chi thay
                                          # worker, master gunicorn giu env cu
""")


# ---------------------------------------------------------------------------
# Vi sao BUOC DANG NHAP khong the tu dong hoa
# ---------------------------------------------------------------------------
# Google da bo hoan toan duong "dang nhap bang email + mat khau" cho moi thu goi
# API (chuong trinh "Less secure app access" dong nam 2022). Moi API cua Google
# gio chi nhan OAuth token, va cap token doi mot lan bam dong y cua NGUOI THAT
# tren trang cua Google. Khong co cach nao doi mat khau thanh token.
#
# Do la thiet ke co chu dich va la thu bao ve tai khoan: neu mat khau doi duoc
# thanh quyen API thi mot lan lo mat khau la mat sach du lieu.
#
# Vi vay file nay chia lam hai: NGUOI dang nhap mot lan (`gcloud auth
# application-default login`), roi MAY lam het phan con lai.
if __name__ == "__main__":
    main()
