"""Doc thong tin nhan su tu Workit (SQL Server) — LOP TUY CHON.

Chua cau hinh (thieu mat khau / thieu cau SELECT) thi moi ham o day tra ve
None, trang ho so van chay day du bang du lieu AD + portal. Khong bao gio nem
loi ra ngoai: file server HR sap khong duoc keo sap ca portal.

CACH CAU HINH — chi sua /etc/avp-portal-api.env, KHONG phai sua code:

    WORKIT_DSN=10.10.100.108:14333
    WORKIT_DB=workitapp_avp
    WORKIT_USER=avp_bday_ro
    WORKIT_PASS=<mat khau>
    WORKIT_PROFILE_KEY=username          # username | email | workit_key
    WORKIT_PROFILE_SQL=SELECT TOP 1 chuc_vu AS "Chuc vu|Position", ...
                       FROM nhan_su WHERE tai_khoan = %s

TEN COT TRONG CAU SELECT CHINH LA NHAN HIEN RA MAN HINH. Muon song ngu thi
dat alias dang "Tieng Viet|English". Cot nao khong muon lo thi dung SELECT.
=> Quyet dinh "truong nao duoc hien" nam o cau SQL, khong nam trong code.

Mac dinh du lieu Workit CHI hien tren ho so cua chinh minh. Muon cho dong
nghiep xem nhau thi dat WORKIT_PROFILE_PUBLIC=1.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime
from decimal import Decimal

log = logging.getLogger("avp.workit")

DSN = os.environ.get("WORKIT_DSN", "")
DB = os.environ.get("WORKIT_DB", "")
USER = os.environ.get("WORKIT_USER", "")
PASS = os.environ.get("WORKIT_PASS", "")
SQL = os.environ.get("WORKIT_PROFILE_SQL", "").strip()
KEY = os.environ.get("WORKIT_PROFILE_KEY", "username").strip().lower()
PUBLIC = os.environ.get("WORKIT_PROFILE_PUBLIC", "0").strip() == "1"
TTL = int(os.environ.get("WORKIT_PROFILE_TTL", "900"))

_cache: dict[str, tuple[float, list | None]] = {}
_warned = False


def configured() -> bool:
    """Da du thong tin de hoi Workit chua."""
    return bool(DSN and DB and USER and PASS and SQL)


def _fmt(v) -> str:
    """Doi gia tri SQL thanh chuoi hien duoc; ngay thang theo kieu Viet Nam."""
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%d/%m/%Y")
    if isinstance(v, date):
        return v.strftime("%d/%m/%Y")
    if isinstance(v, Decimal):
        return f"{v:g}"
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace").strip()
    return str(v).strip()


def _label(col: str) -> dict:
    """Ten cot -> nhan song ngu. "Ngay vao lam|Start date" -> {vi, en}."""
    vi, _, en = col.partition("|")
    vi = vi.strip() or col
    return {"vi": vi, "en": (en.strip() or vi)}


def fields(username: str, workit_key: str = "", email: str = "") -> list | None:
    """Cac truong nhan su cua mot nguoi: [{label:{vi,en}, value:str}].

    None = chua cau hinh hoac khong hoi duoc (goi y phia frontend: an han khoi
    hien 'khong co du lieu' gay hieu nham).
    """
    if not configured():
        return None
    param = {"workit_key": workit_key, "email": email}.get(KEY, username)
    if not param:
        return None

    hit = _cache.get(param)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]

    rows = _query(param)
    _cache[param] = (time.time(), rows)
    return rows


def _query(param: str) -> list | None:
    global _warned
    try:
        import pymssql                      # nap muon: chi lop nay moi can
    except ImportError:                     # pragma: no cover
        if not _warned:
            log.warning("workit: thieu pymssql, bo qua lop nhan su")
            _warned = True
        return None

    host, _, port = DSN.partition(":")
    try:
        with pymssql.connect(server=host, port=port or "1433", user=USER,
                             password=PASS, database=DB, timeout=8,
                             login_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute(SQL, (param,))
                row = cur.fetchone()
                cols = [d[0] for d in cur.description] if cur.description else []
    except Exception as exc:                # ket noi hong -> ho so van hien
        log.warning("workit: khong doc duoc nhan su (%s)", type(exc).__name__)
        return None

    if not row:
        return []
    # Bo truong rong cho khoi hien mot dong trong tren giao dien.
    return [{"label": _label(c), "value": s}
            for c, v in zip(cols, row) if (s := _fmt(v))]
