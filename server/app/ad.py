"""Tra cuu Active Directory bang SASL/GSSAPI voi keytab cua service account.
Khong luu mat khau bind o bat ky dau."""
from __future__ import annotations
import os, re, subprocess, time

BASE = os.environ.get("AD_BASE_DN", "DC=anvietphatgroup,DC=com")
URI = os.environ.get("AD_URI", "ldap://hcm-dcsvr.anvietphatgroup.com")
KEYTAB = os.environ.get("AD_KEYTAB", "/etc/krb5.keytab.portal")
CCACHE = os.environ.get("AD_CCACHE", "FILE:/var/cache/avp-portal/krb5cc")
TTL = int(os.environ.get("AD_CACHE_TTL", "300"))

# whenCreated dung de tinh tham nien tren trang ho so ca nhan (profile.py).
USER_ATTRS = ["displayName", "givenName", "sn", "mail", "title", "department",
              "telephoneNumber", "physicalDeliveryOfficeName", "mobile",
              "whenCreated"]
_SAFE = re.compile(r"[A-Za-z0-9._-]{1,64}")
_cache: dict[str, tuple[float, dict]] = {}


def _env() -> dict:
    e = dict(os.environ)
    e["KRB5_CLIENT_KTNAME"] = KEYTAB
    e["KRB5CCNAME"] = CCACHE
    return e


def _search(ldap_filter: str, attrs: list[str]) -> list[dict]:
    """Chay ldapsearch va parse LDIF thanh list dict."""
    proc = subprocess.run(
        ["ldapsearch", "-LLL", "-o", "ldif-wrap=no", "-Y", "GSSAPI", "-H", URI,
         "-b", BASE, ldap_filter] + attrs,
        capture_output=True, text=True, timeout=15, env=_env())
    entries: list[dict] = []
    cur: dict = {}
    for line in proc.stdout.splitlines():
        if not line.strip():
            if cur:
                entries.append(cur)
                cur = {}
            continue
        if line.startswith("#"):
            continue
        key, _, val = line.partition(":")
        val = val.lstrip(": ").strip()
        if key == "dn":
            if cur:
                entries.append(cur)
            cur = {"dn": val}
        elif val:
            cur[key[0].lower() + key[1:]] = val
    if cur:
        entries.append(cur)
    return [e for e in entries if "dn" in e]


def get_user(username: str) -> dict | None:
    """Thong tin mot user; None neu khong tim thay hoac ten khong hop le."""
    username = (username or "").split("@")[0].split("\\")[-1].strip()
    if not username or not _SAFE.fullmatch(username):
        return None

    hit = _cache.get(username)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]

    rows = _search(f"(sAMAccountName={username})", USER_ATTRS)
    if not rows:
        return None
    row = rows[0]
    row["username"] = username
    row["fullName"] = (row.get("displayName")
                       or " ".join(x for x in [row.get("sn"), row.get("givenName")] if x)
                       or username)
    _cache[username] = (time.time(), row)
    return row


# ----------------------------------------------------------------- danh ba --
DIR_ATTRS = ["displayName", "sAMAccountName", "mail", "telephoneNumber",
             "department", "title"]
# Loc: la nguoi that, dang bat (bit 2 cua userAccountControl = disabled), co ten
DIR_FILTER = ("(&(objectCategory=person)(objectClass=user)"
              "(!(userAccountControl:1.2.840.113556.1.4.803:=2))"
              "(displayName=*)(telephoneNumber=*))")
# Bo tai khoan dich vu / may chu ra khoi danh ba
DIR_EXCLUDE_OU = ("ou=servers",)
DIR_EXCLUDE_PREFIX = ("svc-", "zabbix", "monitor-", "claude-")
_dir_cache: tuple[float, dict] | None = None
DIR_TTL = int(os.environ.get("AD_DIR_TTL", "900"))


def _keep(row: dict) -> bool:
    dn = row.get("dn", "").lower()
    if any(x in dn for x in DIR_EXCLUDE_OU):
        return False
    sam = (row.get("sAMAccountName") or row.get("samAccountName") or "").lower()
    return not any(sam.startswith(p) for p in DIR_EXCLUDE_PREFIX)


def list_directory() -> dict:
    """Danh ba lay truc tiep tu AD, gom theo phong ban."""
    global _dir_cache
    if _dir_cache and time.time() - _dir_cache[0] < DIR_TTL:
        return _dir_cache[1]

    rows = [r for r in _search(DIR_FILTER, DIR_ATTRS) if _keep(r)]
    groups: dict[str, list[dict]] = {}
    with_ext = 0
    for r in rows:
        ext = (r.get("telephoneNumber") or "").strip()
        if ext:
            with_ext += 1
        groups.setdefault((r.get("department") or "").strip() or "__none__", []).append({
            "name": r.get("displayName", ""),
            "username": r.get("sAMAccountName") or r.get("samAccountName") or "",
            "ext": ext,
            "email": r.get("mail", ""),
            "title": r.get("title", ""),
        })

    def sort_key(p: dict):
        return (0, int(p["ext"])) if p["ext"].isdigit() else (1, 0)

    departments = []
    for dept, people in groups.items():
        people.sort(key=lambda p: (sort_key(p), p["name"]))
        departments.append({"name": dept, "count": len(people), "contacts": people})
    # phong ban co ten xep truoc, nhom chua phan loai xuong cuoi
    departments.sort(key=lambda d: (d["name"] == "__none__", d["name"]))

    data = {"departments": departments, "total": len(rows), "withExt": with_ext,
            "updatedAt": int(time.time())}
    _dir_cache = (time.time(), data)
    return data


# ------------------------------------------------------- toan bo nhan vien --
# Danh sach nguoi de CHAT — khac danh ba o cho KHONG doi phai co so may le:
# nhan tin thi ai cung nhan duoc, khong lien quan may ban. Van loc tai khoan
# dung chung / dich vu bang `sn` (nguoi that thi AD luon tach ho + ten), giong
# cach o "Chao thanh vien moi".
PEOPLE_ATTRS = ["displayName", "sAMAccountName", "sn", "title", "department"]
PEOPLE_FILTER = ("(&(objectCategory=person)(objectClass=user)"
                 "(!(userAccountControl:1.2.840.113556.1.4.803:=2))"
                 "(displayName=*)(sn=*))")
_people_cache: tuple[float, list[dict]] | None = None


def list_people() -> list[dict]:
    """Moi nhan vien that dang bat trong AD, xep theo ten."""
    global _people_cache
    if _people_cache and time.time() - _people_cache[0] < DIR_TTL:
        return _people_cache[1]

    rows = [r for r in _search(PEOPLE_FILTER, PEOPLE_ATTRS) if _keep(r)]
    out = [{"username": r.get("sAMAccountName") or r.get("samAccountName") or "",
            "name": r.get("displayName", ""),
            "title": (r.get("title") or "").strip(),
            "dept": (r.get("department") or "").strip()}
           for r in rows]
    out = [p for p in out if p["username"]]
    out.sort(key=lambda p: p["name"].lower())
    _people_cache = (time.time(), out)
    return out


# --------------------------------------------------------- thanh vien moi --
# O "Chao thanh vien moi" tren trang Doi song. Lay theo whenCreated cua tai
# khoan AD — DUNG ngay vao lam, chi la "co tai khoan tu bao gio"; du de chao
# nhau, khong dung de tinh tham nien chinh thuc.
NEW_ATTRS = ["displayName", "sAMAccountName", "sn", "title", "department", "whenCreated"]
_new_cache: tuple[float, list[dict]] | None = None
NEW_TTL = int(os.environ.get("AD_NEW_TTL", "900"))


def recent_accounts(days: int = 60, limit: int = 6) -> list[dict]:
    """Tai khoan AD tao trong `days` ngay gan day, moi nhat truoc."""
    global _new_cache
    if _new_cache and time.time() - _new_cache[0] < NEW_TTL:
        return _new_cache[1][:limit]

    since = time.strftime("%Y%m%d%H%M%S", time.gmtime(time.time() - days * 86400))
    flt = ("(&(objectCategory=person)(objectClass=user)"
           "(!(userAccountControl:1.2.840.113556.1.4.803:=2))"
           f"(displayName=*)(whenCreated>={since}.0Z))")
    # Tai khoan dung chung (IT Dai Viet, IT Dai Duong...) chi co givenName ma
    # KHONG co sn — nguoi that thi AD luon tach ho/ten. Dung do de loc.
    rows = [r for r in _search(flt, NEW_ATTRS) if _keep(r) and r.get("sn")]
    rows.sort(key=lambda r: r.get("whenCreated", ""), reverse=True)
    out = [{"username": r.get("sAMAccountName") or r.get("samAccountName") or "",
            "name": r.get("displayName", ""),
            "title": r.get("title", ""),
            "department": (r.get("department") or "").strip(),
            "joinedAt": _iso_day(r.get("whenCreated", ""))}
           for r in rows]
    out = [p for p in out if p["username"]]
    _new_cache = (time.time(), out)
    return out[:limit]


def _iso_day(raw: str) -> str:
    """AD whenCreated 20230904071233.0Z -> 2023-09-04."""
    m = re.match(r"(\d{4})(\d{2})(\d{2})", raw or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


# ------------------------------------------------------------ quyen sua --
EDITOR_GROUP_DN = os.environ.get(
    "EDITOR_GROUP_DN",
    "CN=Information System,OU=Information System,OU=An Viet Phat Group,DC=anvietphatgroup,DC=com")
_editor_cache: dict[str, tuple[float, bool]] = {}


def is_editor(username: str) -> bool:
    """User co thuoc group duoc sua noi dung khong.

    Dung LDAP_MATCHING_RULE_IN_CHAIN (1.2.840.113556.1.4.1941) nen bat duoc ca
    thanh vien gian tiep qua group long nhau.
    """
    username = (username or "").split("@")[0].split("\\")[-1].strip()
    if not username or not _SAFE.fullmatch(username):
        return False
    hit = _editor_cache.get(username)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    flt = (f"(&(sAMAccountName={username})"
           f"(memberOf:1.2.840.113556.1.4.1941:={EDITOR_GROUP_DN}))")
    ok = bool(_search(flt, ["sAMAccountName"]))
    _editor_cache[username] = (time.time(), ok)
    return ok


# ------------------------------------------- quyen vao trang quan tri --
# Nut "Quan tri noi dung" chi mo cho danh sach user liet ke o day (env
# CONTENT_ADMIN_USERS, phan cach bang dau phay). DE TRONG = KHONG AI VAO DUOC,
# ke ca thanh vien group IS. Danh sach nay la nguon quyet dinh duy nhat: user
# duoc liet ke thi vao duoc, khong can thuoc group bien tap.
# Khong anh huong quyen kiem duyet tin tuc (van theo is_editor / group IS).
CONTENT_ADMIN_USERS = {u.strip().lower() for u in
                       os.environ.get("CONTENT_ADMIN_USERS", "").split(",") if u.strip()}


def can_admin_content(username: str) -> bool:
    username = (username or "").split("@")[0].split("\\")[-1].strip().lower()
    if not username or not _SAFE.fullmatch(username):
        return False
    return username in CONTENT_ADMIN_USERS


# ------------------------------------------------------ quyen dang tin --
# Tac gia tin tuc = thanh vien group HR / Marketing (cau hinh qua env, phan
# cach bang ';'), hoac thanh vien group bien tap IS (EDITOR_GROUP_DN).
NEWS_AUTHOR_GROUP_DNS = [d.strip() for d in
                         os.environ.get("NEWS_AUTHOR_GROUP_DNS", "").split(";") if d.strip()]
_author_cache: dict[str, tuple[float, bool]] = {}


def _in_group(username: str, group_dn: str) -> bool:
    """User co thuoc group_dn khong (ke ca gian tiep qua group long nhau)."""
    flt = (f"(&(sAMAccountName={username})"
           f"(memberOf:1.2.840.113556.1.4.1941:={group_dn}))")
    return bool(_search(flt, ["sAMAccountName"]))


def is_news_author(username: str) -> bool:
    username = (username or "").split("@")[0].split("\\")[-1].strip()
    if not username or not _SAFE.fullmatch(username):
        return False
    hit = _author_cache.get(username)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    ok = is_editor(username) or any(_in_group(username, dn) for dn in NEWS_AUTHOR_GROUP_DNS)
    _author_cache[username] = (time.time(), ok)
    return ok
