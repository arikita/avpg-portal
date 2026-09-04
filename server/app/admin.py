"""Bang dieu khien quan tri (/admin) — GOP MOI THU VE MOT CHO.

Truoc 24/08/2026 co hai trang roi rac: /admin (sua noi dung) va /admin/errors
(loi ung dung). Nguoi quan tri muon biet "portal dang the nao" phai mo them
Zabbix, GA4, va psql. File nay gom cac cau tra loi do vao 7 endpoint doc.

LUAT CUNG:
  1. MOI endpoint o day deu di qua _require_admin(). Bang app_page_view ghi kem
     username => co tinh chat giam sat nhan vien; pham vi nguoi xem PHAI trung
     voi ghi chu minh bach trong trang /help va trong schema_telemetry.sql.
  2. CHI DOC. Khong co endpoint ghi nao trong file nay — sua noi dung van di
     qua PUT /api/content/{module}/{key} (co ghi content_history), doi trang
     thai loi van qua /api/telemetry/errors/{id}/status, ghim/xoa tin van qua
     /api/news/*. Mot duong ghi cho moi thu, khong nhan ban luat kiem tra.
  3. Moi truy van deu chan bang LIMIT + khoang thoi gian. Mot cau `SELECT ...
     GROUP BY username` khong chan tren 180 ngay du lieu se treo request.
  4. Gio hien thi la +07. DB luu timestamptz (UTC ben trong) nen moi phep gom
     theo NGAY deu phai `AT TIME ZONE 'Asia/Ho_Chi_Minh'` truoc khi ::date —
     thieu buoc nay thi "hom nay" cua bao cao bat dau luc 7h sang.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
from typing import Any

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException

from .ad import (CONTENT_ADMIN_USERS, can_admin_content, can_manage_post,
                 get_user, is_editor, recent_accounts)
from .quiz import DRAW as QUIZ_DRAW, PASS as QUIZ_PASS, POOL as QUIZ_POOL
from .telemetry import ENABLED as TELEMETRY_ENABLED, _build_id

router = APIRouter(prefix="/api/admin", tags=["admin"])

DSN = os.environ.get("DATABASE_URL", "")
TZ = "Asia/Ho_Chi_Minh"
MEDIA_DIR = os.environ.get("MEDIA_DIR", "/var/www/avp-portal-media")

# Timer/service cua rieng portal — tab "He thong" hoi trang thai tung cai.
# Ten co dinh trong ma nguon: KHONG nhan ten unit tu query string, neu khong
# thi endpoint nay thanh cong cu do trang thai moi unit cua may chu.
UNITS = [
    ("avp-portal-api.service", "API FastAPI"),
    ("apache2.service", "Apache (SPA + Kerberos)"),
    ("postgresql.service", "PostgreSQL"),
    ("avp-news-publish.timer", "Phat hanh tin hen gio (moi phut)"),
    ("avp-smoke-test.timer", "Smoke test (10 phut)"),
    ("avp-telemetry-prune.timer", "Don telemetry (03:30)"),
    ("avp-birthday-sync.timer", "Dong bo sinh nhat (06:30)"),
    ("avp-share-renew.timer", "Gia han ve Kerberos cho share NAS"),
    ("avp-gallery-cache-clean.timer", "Don cache anh gallery"),
]


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _require_admin(username: str = Depends(current_user)) -> str:
    if not can_admin_content(username):
        raise HTTPException(status_code=403, detail="ban khong co quyen vao trang quan tri")
    return username


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


def _rows(conn, sql: str, args: tuple = ()) -> list:
    """Mot truy van hong KHONG duoc lam sap ca bang dieu khien.

    12 o so lieu doc tu 12 bang; neu bang telemetry chua duoc tao tren mot may
    nao do thi phan con lai van phai hien. Tra list rong va di tiep.
    """
    try:
        return conn.execute(sql, args).fetchall()
    except Exception:
        conn.rollback()
        return []


def _one(conn, sql: str, args: tuple = (), default: Any = 0) -> Any:
    r = _rows(conn, sql, args)
    return r[0][0] if r and r[0][0] is not None else default


# ===========================================================================
# 1) Tong quan
# ===========================================================================
@router.get("/overview")
def overview(username: str = Depends(_require_admin)) -> dict:
    """Man hinh dau tien: hom nay ra sao, 14 ngay qua ra sao, can lam gi."""
    out: dict[str, Any] = {"buildId": _build_id(), "telemetry": bool(TELEMETRY_ENABLED)}
    day = f"(hour AT TIME ZONE '{TZ}')::date"
    today = f"(now() AT TIME ZONE '{TZ}')::date"

    with _conn() as conn:
        out["dbOk"] = True

        # --- hom nay / hom qua: dat canh nhau de ra duoc muc tang giam ------
        for label, expr in (("today", f"{day} = {today}"),
                            ("yesterday", f"{day} = {today} - 1")):
            r = _rows(conn, f"SELECT coalesce(sum(n),0), count(DISTINCT username) "
                            f"FROM app_page_view WHERE {expr}")
            views, users = (r[0] if r else (0, 0))
            out[label] = {"views": int(views or 0), "users": int(users or 0)}

        # --- chuoi 14 ngay ------------------------------------------------
        # generate_series de ngay khong ai vao van co diem 0; thieu no thi
        # duong xu huong noi lien hai dau cuoi tuan va trong nhu khong tut.
        out["series"] = [
            {"date": d.isoformat(), "views": int(v), "users": int(u)}
            for d, v, u in _rows(conn, f"""
                SELECT g::date,
                       coalesce(sum(p.n), 0),
                       count(DISTINCT p.username)
                  FROM generate_series({today} - 13, {today}, interval '1 day') g
                  LEFT JOIN app_page_view p ON {day} = g::date
                 GROUP BY g ORDER BY g""")
        ]

        # --- loi ------------------------------------------------------------
        out["errors"] = {s: int(n) for s, n in _rows(
            conn, "SELECT severity, count(*) FROM app_error "
                  "WHERE status = 'new' GROUP BY severity")}
        out["errors24h"] = int(_one(
            conn, "SELECT count(*) FROM app_error "
                  "WHERE last_seen > now() - interval '24 hours'"))

        # --- suc khoe request (5 phut gan nhat) -------------------------------
        r = _rows(conn, "SELECT coalesce(sum(n),0), coalesce(sum(n_5xx),0), "
                        "coalesce(sum(n_slow),0), coalesce(sum(ms_sum),0) "
                        "FROM app_request_stat WHERE minute > now() - interval '5 minutes'")
        n, n5, slow, ms = (r[0] if r else (0, 0, 0, 0))
        out["req5m"] = {"n": int(n), "err5xx": int(n5), "slow": int(slow),
                        "msAvg": int(ms // n) if n else 0}

        # --- noi dung / cong dong --------------------------------------------
        out["counts"] = {
            "newsPublished": int(_one(conn, "SELECT count(*) FROM news_post WHERE status='published'")),
            "newsDraft": int(_one(conn, "SELECT count(*) FROM news_post WHERE status='draft'")),
            "newsScheduled": int(_one(conn, "SELECT count(*) FROM news_post WHERE status='scheduled'")),
            "newsHidden": int(_one(conn, "SELECT count(*) FROM news_post WHERE status='hidden'")),
            "wall7d": int(_one(conn, "SELECT count(*) FROM wall_post "
                                     "WHERE NOT deleted AND created_at > now() - interval '7 days'")),
            "chat24h": int(_one(conn, "SELECT count(*) FROM chat_message "
                                      "WHERE NOT deleted AND created_at > now() - interval '24 hours'")),
            "profiles": int(_one(conn, "SELECT count(*) FROM user_profile")),
            "pushSubs": int(_one(conn, "SELECT count(DISTINCT username) FROM push_subscription")),
            "online": int(_one(conn, "SELECT count(*) FROM chat_presence "
                                     "WHERE last_seen > now() - interval '2 minutes'")),
            "contentItems": int(_one(conn, "SELECT count(*) FROM content")),
        }

        # --- viec can lam: chi nhung thu THUC SU can nguoi cham vao ----------
        todo = []
        crit = int(out["errors"].get("critical", 0))
        errs = int(out["errors"].get("error", 0))
        if crit:
            todo.append({"level": "critical", "key": "errors_critical", "n": crit, "tab": "errors"})
        if errs:
            todo.append({"level": "warning", "key": "errors_error", "n": errs, "tab": "errors"})
        due = int(_one(conn, "SELECT count(*) FROM news_post "
                             "WHERE status='scheduled' AND scheduled_at <= now()"))
        if due:
            todo.append({"level": "warning", "key": "news_overdue", "n": due, "tab": "news"})
        soon = int(_one(conn, "SELECT count(*) FROM news_post WHERE status='scheduled' "
                              "AND scheduled_at > now() AND scheduled_at < now() + interval '24 hours'"))
        if soon:
            todo.append({"level": "info", "key": "news_soon", "n": soon, "tab": "news"})
        if not TELEMETRY_ENABLED:
            todo.append({"level": "warning", "key": "telemetry_off", "n": 0, "tab": "system"})
        # Im lang KHONG phai la khoe: khong co request nao trong 5 phut giua gio
        # lam viec thi hoac khong ai dung, hoac duong ong do dem da chet.
        if out["req5m"]["n"] == 0:
            todo.append({"level": "info", "key": "no_traffic", "n": 0, "tab": "system"})
        out["todo"] = todo

        # --- sua noi dung gan day --------------------------------------------
        out["recentContent"] = [
            {"module": m, "key": k, "at": a.isoformat(), "by": b or ""}
            for m, k, a, b in _rows(conn, "SELECT module, key, changed_at, changed_by "
                                          "FROM content_history ORDER BY changed_at DESC LIMIT 6")
        ]
    return out


# ===========================================================================
# 2) Luot truy cap tu host
# ===========================================================================
@router.get("/analytics")
def analytics(days: int = 30, username: str = Depends(_require_admin)) -> dict:
    """So lieu O LAI mang noi bo — tra loi duoc cau GA4 khong tra loi duoc:
    AI va PHONG BAN NAO thuc su dung portal. Dieu khoan GA cam gui PII nen ben
    do /profile/<user> da bi boi thanh /profile/*."""
    days = min(180, max(1, days))
    day = f"(hour AT TIME ZONE '{TZ}')::date"
    today = f"(now() AT TIME ZONE '{TZ}')::date"
    span = f"{day} > {today} - {days}"

    with _conn() as conn:
        series = [
            {"date": d.isoformat(), "views": int(v), "users": int(u)}
            for d, v, u in _rows(conn, f"""
                SELECT g::date, coalesce(sum(p.n), 0), count(DISTINCT p.username)
                  FROM generate_series({today} - {days - 1}, {today}, interval '1 day') g
                  LEFT JOIN app_page_view p ON {day} = g::date
                 GROUP BY g ORDER BY g""")
        ]
        routes = [{"route": r, "views": int(v), "users": int(u)} for r, v, u in _rows(
            conn, f"SELECT route, sum(n), count(DISTINCT username) FROM app_page_view "
                  f"WHERE {span} GROUP BY route ORDER BY sum(n) DESC LIMIT 20")]
        depts = [{"department": d or "—", "views": int(v), "users": int(u)} for d, v, u in _rows(
            conn, f"SELECT department, sum(n), count(DISTINCT username) FROM app_page_view "
                  f"WHERE {span} GROUP BY department ORDER BY count(DISTINCT username) DESC LIMIT 15")]
        people = [{"username": p, "views": int(v), "days": int(d), "last": l.isoformat()}
                  for p, v, d, l in _rows(
            conn, f"SELECT username, sum(n), count(DISTINCT {day}), max(hour) "
                  f"FROM app_page_view WHERE {span} "
                  f"GROUP BY username ORDER BY sum(n) DESC LIMIT 25")]
        hours = [{"h": int(h), "views": int(v)} for h, v in _rows(
            conn, f"SELECT extract(hour FROM hour AT TIME ZONE '{TZ}')::int, sum(n) "
                  f"FROM app_page_view WHERE {span} GROUP BY 1 ORDER BY 1")]
        totals = _rows(conn, f"SELECT coalesce(sum(n),0), count(DISTINCT username) "
                             f"FROM app_page_view WHERE {span}")
        tv, tu = (totals[0] if totals else (0, 0))
        # DAU/WAU/MAU deu tinh tren cung bang nen doi chieu duoc voi nhau.
        active = {
            k: int(_one(conn, f"SELECT count(DISTINCT username) FROM app_page_view "
                              f"WHERE hour > now() - interval '{n} days'"))
            for k, n in (("d1", 1), ("d7", 7), ("d30", 30))
        }
    return {"days": days, "series": series, "routes": routes, "departments": depts,
            "people": people, "hours": hours, "active": active,
            "totals": {"views": int(tv or 0), "users": int(tu or 0)}}


# ===========================================================================
# 3) GA4 — so lieu ben Google
# ===========================================================================
# Vi sao tu ky JWT thay vi cai google-analytics-data: venv tren .136 da co
# `cryptography` + `requests`, con thu vien Google keo theo ~15 goi phu thuoc
# phai cap nhat cho mot endpoint duy nhat. Luong OAuth service-account chi la
# ky mot JWT RS256 roi doi lay access token — 40 dong, khong co gi bi mat.
GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "550323823").strip()
GA4_SA_JSON = os.environ.get("GA4_SA_JSON", "").strip()
_ga4_token: dict[str, Any] = {"value": "", "exp": 0.0}

# Nho ket qua GA4 trong 2 phut.
#
# Mot lan tra loi day du la 5 luot goi NOI TIEP sang Google => do duoc 3,0 giay
# (24/08/2026). Nguoi quan tri bam qua lai 7/30/90 ngay la moi lan cho lai tung
# ay. So lieu GA4 von tre vai phut nen nho 2 phut khong lam sai gi ca.
# Moi worker gunicorn giu bo nho rieng — chap nhan duoc, chi la 2 ban sao.
GA4_CACHE_SEC = 120
_ga4_cache: dict[int, tuple[float, dict]] = {}

SETUP_STEPS = [
    "Google Cloud Console → tao project (hoac dung project san co) → APIs & "
    "Services → bat 'Google Analytics Data API'.",
    "IAM & Admin → Service Accounts → CREATE → khong can cap role nao trong "
    "project → Keys → ADD KEY → Create new key → JSON → tai file ve.",
    "analytics.google.com → Admin → Property Access Management → them email "
    "cua service account (dang ...@....iam.gserviceaccount.com) voi vai tro "
    "Viewer tren property 550323823.",
    "Chep file JSON len .136 (vi du /etc/avp-portal-ga4.json, chown www-data, "
    "chmod 600), them GA4_SA_JSON=/etc/avp-portal-ga4.json vao "
    "/etc/avp-portal-api.env roi `systemctl restart avp-portal-api`.",
]


def _ga4_access_token() -> str:
    """Doi khoa service account lay access token (cache den truoc han 60s)."""
    if _ga4_token["value"] and _ga4_token["exp"] > time.time() + 60:
        return _ga4_token["value"]

    import base64
    import requests
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    with open(GA4_SA_JSON, "r", encoding="utf-8") as fh:
        sa = json.load(fh)

    def b64(raw: bytes) -> bytes:
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    now = int(time.time())
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claim = b64(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/analytics.readonly",
        "aud": sa.get("token_uri", "https://oauth2.googleapis.com/token"),
        "iat": now, "exp": now + 3600,
    }).encode())
    signing_input = header + b"." + claim
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = b64(key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256()))

    res = requests.post(sa.get("token_uri", "https://oauth2.googleapis.com/token"),
                        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                              "assertion": (signing_input + b"." + sig).decode()},
                        timeout=10)
    res.raise_for_status()
    tok = res.json()
    _ga4_token["value"] = tok["access_token"]
    _ga4_token["exp"] = time.time() + int(tok.get("expires_in", 3600))
    return _ga4_token["value"]


def _ga4_run(body: dict, endpoint: str = "runReport") -> dict:
    import requests
    res = requests.post(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:{endpoint}",
        headers={"Authorization": "Bearer " + _ga4_access_token()},
        json=body, timeout=15)
    res.raise_for_status()
    return res.json()


def _ga4_rows(rep: dict) -> list[list[str]]:
    return [[d["value"] for d in r.get("dimensionValues", [])] +
            [m["value"] for m in r.get("metricValues", [])]
            for r in rep.get("rows", [])]


@router.get("/ga4")
def ga4(days: int = 28, username: str = Depends(_require_admin)) -> dict:
    """So lieu GA4. CHUA CO KHOA => tra huong dan, KHONG phai loi 500.

    Tab nay van dung duoc khi chua cau hinh: phan tu host o tren luon co so."""
    if not GA4_SA_JSON:
        return {"configured": False, "reason": "no_key", "property": GA4_PROPERTY_ID,
                "measurementId": "G-0D97GKKZ6W", "setup": SETUP_STEPS}
    if not os.path.exists(GA4_SA_JSON):
        return {"configured": False, "reason": "key_missing",
                "detail": f"khong doc duoc {GA4_SA_JSON}", "property": GA4_PROPERTY_ID,
                "measurementId": "G-0D97GKKZ6W", "setup": SETUP_STEPS}

    days = min(365, max(1, days))
    hit = _ga4_cache.get(days)
    if hit and time.time() - hit[0] < GA4_CACHE_SEC:
        return dict(hit[1], cached=True)

    rng = [{"startDate": f"{days - 1}daysAgo", "endDate": "today"}]
    try:
        totals = _ga4_run({
            "dateRanges": rng,
            "metrics": [{"name": m} for m in
                        ("activeUsers", "sessions", "screenPageViews",
                         "userEngagementDuration", "engagementRate")],
        })
        daily = _ga4_run({
            "dateRanges": rng,
            "dimensions": [{"name": "date"}],
            "metrics": [{"name": "activeUsers"}, {"name": "screenPageViews"}],
            "orderBys": [{"dimension": {"dimensionName": "date"}}],
            "limit": 400,
        })
        pages = _ga4_run({
            "dateRanges": rng,
            "dimensions": [{"name": "pageTitle"}, {"name": "pagePath"}],
            "metrics": [{"name": "screenPageViews"}, {"name": "activeUsers"}],
            "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
            "limit": 20,
        })
        tech = _ga4_run({
            "dateRanges": rng,
            "dimensions": [{"name": "deviceCategory"}],
            "metrics": [{"name": "activeUsers"}],
            "orderBys": [{"metric": {"metricName": "activeUsers"}, "desc": True}],
            "limit": 10,
        })
        live = _ga4_run({"metrics": [{"name": "activeUsers"}],
                         "minuteRanges": [{"startMinutesAgo": 29, "endMinutesAgo": 0}]},
                        endpoint="runRealtimeReport")
    except Exception as exc:                                  # noqa: BLE001
        # Khoa sai / mat mang / chua cap Viewer deu roi vao day. KHONG nem 500:
        # ca tab se trang trong khi phan tu host van con dung duoc.
        return {"configured": True, "ok": False, "property": GA4_PROPERTY_ID,
                "measurementId": "G-0D97GKKZ6W",
                "error": f"{type(exc).__name__}: {exc}"[:300], "setup": SETUP_STEPS}

    t = (_ga4_rows(totals) or [["0"] * 5])[0]
    live_rows = _ga4_rows(live)
    out = {
        "configured": True, "ok": True, "days": days, "property": GA4_PROPERTY_ID,
        "measurementId": "G-0D97GKKZ6W",
        "totals": {"users": int(float(t[0] or 0)), "sessions": int(float(t[1] or 0)),
                   "views": int(float(t[2] or 0)),
                   "engagedSec": int(float(t[3] or 0)),
                   "engagementRate": round(float(t[4] or 0) * 100, 1)},
        "series": [{"date": f"{r[0][:4]}-{r[0][4:6]}-{r[0][6:]}",
                    "users": int(float(r[1] or 0)), "views": int(float(r[2] or 0))}
                   for r in _ga4_rows(daily)],
        "pages": [{"title": r[0], "path": r[1], "views": int(float(r[2] or 0)),
                   "users": int(float(r[3] or 0))} for r in _ga4_rows(pages)],
        "devices": [{"device": r[0], "users": int(float(r[1] or 0))} for r in _ga4_rows(tech)],
        "realtimeUsers": int(float(live_rows[0][0])) if live_rows else 0,
    }
    # CHI nho lan thanh cong. Nho ca loi thi mot su co mang chop se khoa tab
    # trong 2 phut du Google da tra loi lai binh thuong.
    _ga4_cache[days] = (time.time(), out)
    return out


# ===========================================================================
# 4) Tin tuc — danh sach quan tri (KE CA nhap/an/hen gio cua nguoi khac)
# ===========================================================================
@router.get("/news")
def news_list(status: str = "", q: str = "", limit: int = 100,
              username: str = Depends(_require_admin)) -> dict:
    """/api/news chi tra bai nhap cua CHINH nguoi goi. Quan tri can thay tat ca
    de biet co bai nao ket o trang thai nao khong."""
    where, args = ["TRUE"], []
    if status in ("published", "draft", "scheduled", "hidden"):
        where.append("status = %s")
        args.append(status)
    term = (q or "").strip()
    if term:
        where.append("unaccent(coalesce(title_vi,'') || ' ' || coalesce(title_en,'') "
                     "|| ' ' || author) ILIKE unaccent(%s)")
        args.append(f"%{term}%")
    args.append(min(300, max(1, limit)))

    with _conn() as conn:
        rows = _rows(conn, f"""
            SELECT p.id, p.title_vi, p.category, p.status, p.pinned, p.author,
                   p.author_name, p.created_at, p.published_at, p.scheduled_at,
                   p.cover <> '' AS has_cover, p.author_dept,
                   (SELECT count(*) FROM news_view v WHERE v.post_id = p.id),
                   (SELECT count(*) FROM news_comment c WHERE c.post_id = p.id AND NOT c.deleted),
                   (SELECT count(*) FROM news_reaction r WHERE r.post_id = p.id),
                   (SELECT count(*) FROM news_poll l WHERE l.post_id = p.id)
              FROM news_post p
             WHERE {' AND '.join(where)}
             ORDER BY p.pinned DESC,
                      COALESCE(p.published_at, p.scheduled_at, p.created_at) DESC
             LIMIT %s""", tuple(args))
        counts = {s: int(n) for s, n in _rows(
            conn, "SELECT status, count(*) FROM news_post GROUP BY status")}

    keys = ["id", "title", "category", "status", "pinned", "author", "authorName",
            "createdAt", "publishedAt", "scheduledAt", "hasCover", "authorDept",
            "views", "comments", "reactions", "polls"]
    items = []
    for r in rows:
        d = dict(zip(keys, r))
        for k in ("createdAt", "publishedAt", "scheduledAt"):
            d[k] = d[k].isoformat() if d[k] else ""
        # Quyen tinh theo TUNG bai: HR sua duoc bai HR, MKT sua duoc bai MKT,
        # IT sua duoc tat ca. Truoc day bang nay dung mot co chung
        # `canModerateNews` nen HR/MKT khong thao tac duoc bai cua chinh phong.
        d["canManage"] = can_manage_post(username, d["author"], d["authorDept"] or "")
        items.append(d)
    return {"items": items, "counts": counts}


# ===========================================================================
# 5) Nguoi dung & quyen
# ===========================================================================
@router.get("/users")
def users(days: int = 30, username: str = Depends(_require_admin)) -> dict:
    """Ai co quyen gi, va ai that su dang dung portal.

    Quyen doc tu HAI nguon khac nhau va CO Y de nguyen nhu vay:
      - vao trang quan tri  = allowlist env CONTENT_ADMIN_USERS
      - kiem duyet tin tuc  = group AD 'Information System'
    Tron hai nguon lai lam mot se lam mat kha nang cap quyen doc mot trang."""
    day = f"(hour AT TIME ZONE '{TZ}')::date"
    today = f"(now() AT TIME ZONE '{TZ}')::date"
    days = min(180, max(1, days))

    admins = []
    for u in sorted(CONTENT_ADMIN_USERS):
        info = get_user(u) or {}
        admins.append({"username": u,
                       "fullName": info.get("fullName") or info.get("displayName") or u,
                       "department": info.get("department", ""),
                       "title": info.get("title", ""),
                       "mail": info.get("mail", ""),
                       # Thanh vien group IS => con kiem duyet duoc tin tuc.
                       "moderator": bool(is_editor(u))})

    with _conn() as conn:
        online = [r[0] for r in _rows(
            conn, "SELECT username FROM chat_presence "
                  "WHERE last_seen > now() - interval '2 minutes' ORDER BY username LIMIT 200")]
        active = [{"username": u, "views": int(v), "days": int(d), "last": l.isoformat()}
                  for u, v, d, l in _rows(
            conn, f"SELECT username, sum(n), count(DISTINCT {day}), max(hour) "
                  f"FROM app_page_view WHERE {day} > {today} - {days} "
                  f"GROUP BY username ORDER BY max(hour) DESC LIMIT 100")]
        contributors = [{"username": u, "name": nm, "posts": int(n)} for u, nm, n in _rows(
            conn, "SELECT author, max(author_name), count(*) FROM news_post "
                  "GROUP BY author ORDER BY count(*) DESC LIMIT 15")]
        push = int(_one(conn, "SELECT count(DISTINCT username) FROM push_subscription"))
        profiles = int(_one(conn, "SELECT count(*) FROM user_profile WHERE avatar <> ''"))
    return {"admins": admins, "online": online, "active": active,
            "contributors": contributors, "days": days,
            "pushUsers": push, "profilesWithAvatar": profiles}


# ===========================================================================
# 6) He thong
# ===========================================================================
def _unit_state(unit: str) -> dict:
    """Trang thai mot unit systemd. Doc thoi — khong start/stop tu web bao gio.

    `systemctl show` chay duoc duoi www-data (khong can sudo), nhung van boc
    try/except + timeout: mot request quan tri khong duoc treo vi D-Bus ban.
    """
    out = {"unit": unit, "state": "unknown", "result": "", "since": "", "next": ""}
    try:
        p = subprocess.run(
            ["systemctl", "show", unit, "--property=ActiveState,Result,"
             "ActiveEnterTimestamp,NextElapseUSecRealtime"],
            capture_output=True, text=True, timeout=4)
        for line in p.stdout.splitlines():
            k, _, v = line.partition("=")
            if k == "ActiveState":
                out["state"] = v
            elif k == "Result":
                out["result"] = v
            elif k == "ActiveEnterTimestamp":
                out["since"] = v
            elif k == "NextElapseUSecRealtime":
                out["next"] = v
    except Exception:                                          # noqa: BLE001
        pass
    return out


@router.get("/system")
def system(username: str = Depends(_require_admin)) -> dict:
    out: dict[str, Any] = {
        "buildId": _build_id(),
        "telemetry": bool(TELEMETRY_ENABLED),
        "ga4": {"measurementId": "G-0D97GKKZ6W", "property": GA4_PROPERTY_ID,
                "keyConfigured": bool(GA4_SA_JSON and os.path.exists(GA4_SA_JSON))},
        "units": [dict(_unit_state(u), label=lbl) for u, lbl in UNITS],
    }

    # Dia: het cho ghi la loi kieu "moi thu cung hong mot luc" — .136 chi ~19 GB.
    try:
        st = os.statvfs("/")
        total = st.f_blocks * st.f_frsize
        free = st.f_bavail * st.f_frsize
        out["disk"] = {"totalGb": round(total / 1e9, 1), "freeGb": round(free / 1e9, 1),
                       "usedPct": round(100 * (1 - free / total), 1) if total else 0}
    except Exception:                                          # noqa: BLE001
        out["disk"] = None

    try:
        out["media"] = {"path": MEDIA_DIR, "exists": os.path.isdir(MEDIA_DIR)}
    except Exception:                                          # noqa: BLE001
        out["media"] = None

    with _conn() as conn:
        out["dbOk"] = True
        out["dbSize"] = _one(conn, "SELECT pg_size_pretty(pg_database_size(current_database()))",
                             default="?")
        # pg_stat_user_tables dat khoa chinh o cot `relid`, KHONG phai `oid` —
        # dung nham thi cau lenh loi va _rows() nuot mat, bang hien ra rong tron.
        out["tables"] = [{"name": n, "size": s, "rows": int(r or 0)} for n, s, r in _rows(
            conn, """SELECT relname, pg_size_pretty(pg_total_relation_size(relid)),
                            greatest(n_live_tup, 0)
                       FROM pg_stat_user_tables
                      ORDER BY pg_total_relation_size(relid) DESC LIMIT 15""")]
        # Duong ong telemetry con song khong: khong co dong nao trong 10 phut
        # nghia la khong ai dung HOAC bo dem da chet — hai chuyen rat khac nhau.
        out["lastStat"] = (lambda v: v.isoformat() if v else "")(
            _one(conn, "SELECT max(minute) FROM app_request_stat", default=None))
        out["lastPageView"] = (lambda v: v.isoformat() if v else "")(
            _one(conn, "SELECT max(hour) FROM app_page_view", default=None))
        out["retention"] = [
            {"table": "app_error_event", "keep": "30 ngày",
             "rows": int(_one(conn, "SELECT count(*) FROM app_error_event"))},
            {"table": "app_error", "keep": "resolved > 90 ngày",
             "rows": int(_one(conn, "SELECT count(*) FROM app_error"))},
            {"table": "app_request_stat", "keep": "30 ngày",
             "rows": int(_one(conn, "SELECT count(*) FROM app_request_stat"))},
            {"table": "app_metric", "keep": "≥ 1 năm",
             "rows": int(_one(conn, "SELECT count(*) FROM app_metric"))},
            {"table": "app_page_view", "keep": "180 ngày",
             "rows": int(_one(conn, "SELECT count(*) FROM app_page_view"))},
        ]
        # Chi so nghiep vu 7 ngay: bat duoc loai bug KHONG nem exception.
        out["metrics"] = [{"name": nm, "n": int(n)} for nm, n in _rows(
            conn, "SELECT name, sum(n) FROM app_metric "
                  "WHERE hour > now() - interval '7 days' GROUP BY name ORDER BY name")]
    return out


@router.get("/quiz")
def quiz(days: int = 180, username: str = Depends(_require_admin)) -> dict:
    """Ket qua bai kiem tra hoi nhap IT — xem server/app/quiz.py.

    Trang nay tra loi HAI cau hoi khac nhau, dung dan chung:
      - "AI da nam duoc?"  -> bang `people`, moi nguoi mot dong.
      - "CAI GI chua vao dau ai?" -> `weakest`, gom theo cau hoi.
    Cau thu hai moi la cau dat gia: mot cau ma 70% nguoi lam sai KHONG phai
    loi cua 70% nhan vien, do la mot cho trong trong buoi training.

    `weakest` tra ve CA `asked` lan `wrong` cho tung cau. Kho 50 cau, moi luot
    boc 10, nen chi dem `wrong` la doc sai hoan toan — mot cau moi them vao
    hom qua se luon "it loi nhat" don gian vi no hiem khi duoc hoi.

    `weakest` chi tra ve ID cau hoi. Noi dung cau nam o quiz.content.ts phia
    frontend va CHI o do — chep sang day la co hai ban de lech nhau.
    """
    days = min(365, max(1, days))
    span = f"created_at > now() - interval '{days} days'"

    with _conn() as conn:
        people = [
            {"username": u, "fullName": fn or u, "department": dept,
             "attempts": int(n), "best": int(best), "passed": bool(ok),
             "lastAt": last.isoformat() if last else "",
             "seconds": int(secs or 0)}
            for u, fn, dept, n, best, ok, last, secs in _rows(conn, f"""
                SELECT username, max(full_name), max(department), count(*),
                       max(score), bool_or(passed), max(created_at),
                       min(seconds) FILTER (WHERE passed)
                  FROM quiz_attempt WHERE {span}
                 GROUP BY username ORDER BY max(created_at) DESC LIMIT 300""")
        ]

        graded = _one(conn, f"SELECT count(*) FROM quiz_attempt WHERE {span}")

        # MAU SO la so lan cau do DUOC HOI, khong phai tong so luot lam bai.
        # Kho co 50 cau ma moi luot chi boc 10, nen "cau X sai 9 lan" tu no
        # khong noi len gi: 9/12 lan duoc hoi la mot van de, 9/200 thi khong.
        # Dem tu `drawn` (10 cau cua luot do) roi doi chieu voi `wrong`.
        weakest = [{"id": q, "asked": int(asked), "wrong": int(n)}
                   for q, asked, n in _rows(conn, f"""
            SELECT d,
                   count(*),
                   count(*) FILTER (WHERE d = ANY(a.wrong))
              FROM quiz_attempt a, unnest(a.drawn) AS d
             WHERE {span}
             GROUP BY d
             ORDER BY count(*) FILTER (WHERE d = ANY(a.wrong))::float
                      / greatest(count(*), 1) DESC, d
             LIMIT 60""")]

        # Dong dau tien: bat dau tu bao gio thi con so moi doc duoc.
        since = _one(conn, f"SELECT min(created_at) FROM quiz_attempt WHERE {span}",
                     default=None)

    done = {p["username"].lower() for p in people}
    # Nguoi moi vao ma chua lam bai — dung danh sach nay chu khong phai ca
    # 850 nhan vien: bai kiem tra nay danh cho NGUOI VUA duoc training, ke ten
    # ca cong ty ra chi lam bang bao cao thanh mot bien nhieu khong ai doc.
    try:
        newcomers = [p for p in recent_accounts(days=90, limit=60)
                     if p["username"].lower() not in done]
    except Exception:                                          # noqa: BLE001
        newcomers = []                                         # AD khong tra loi -> bo o nay

    passed = sum(1 for p in people if p["passed"])
    return {
        "days": days,
        "total": QUIZ_DRAW,
        "pool": QUIZ_POOL,
        "pass": QUIZ_PASS,
        "attempts": int(graded),
        "people": people,
        "passedPeople": passed,
        "firstAt": since.isoformat() if since else "",
        "weakest": weakest,
        "newcomers": newcomers[:30],
    }

