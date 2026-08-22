"""Thu thap va gop nhom loi cho AVP Portal.

Nguyen tac: du lieu O LAI mang noi bo (cung ly do da loai Microsoft Clarity).
Doi lai phai tu lam phan gop nhom — xem schema_telemetry.sql.

BA nguon su kien:
  - client : loi Javascript tren trinh duyet (ErrorHandler cua Angular)
  - server : exception + HTTP 5xx bat o middleware ngay trong file nay
  - user   : nguoi dung tu bam nut "Bao loi"

LUAT CUNG:
  1. Fingerprint TINH O SERVER. Client co the gui rac, khong duoc tin.
  2. Endpoint thu loi KHONG BAO GIO tra loi cho client (luon 204) — neu no
     tra 500 thi client se bao cao chinh cai loi do, thanh vong lap chet.
  3. Moi cap nhat dem/chong-spam phai la INSERT ... ON CONFLICT DO UPDATE.
     API chay 2 uvicorn worker; doc-roi-ghi se lam ca hai worker cung gui push
     va lam mat so dem.
  4. route/url phai qua _safe_path() truoc khi luu. Khong bao gio ghi noi dung
     chat/tin nhan vao context.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .ad import can_admin_content, get_user

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

DSN = os.environ.get("DATABASE_URL", "")
# Cong tac tat nhanh: bao request hoac phinh DB thi dat 0 + restart, khong
# phai build lai frontend. Cung mau voi GA_ID rong = tat do luong cua GA4.
ENABLED = os.environ.get("TELEMETRY_ENABLED", "1").strip() not in ("0", "false", "no")
BUILD_FILE = os.environ.get("BUILD_FILE", "/var/www/avp-portal/build.json")

MAX_EVENTS_PER_BATCH = 20
MAX_EVENT_BYTES = 8192
MAX_SAMPLES_PER_ERROR = 20      # so mau tho giu lai moi fingerprint
SLOW_MS = 3000                  # tren nguong nay tinh la "cham"
RATE_PER_MIN = 30               # moi user moi worker; 2 worker => thuc te ~60


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


# ------------------------------------------------------------- loc PII --
_PROFILE_RE = re.compile(r"^/profile/[^/]+")
_WALL_RE = re.compile(r"^/wall/[^/]+")


def _safe_path(path: str) -> str:
    """Bo ten nguoi dung khoi duong dan truoc khi luu.

    Giong safePath() ben analytics.service.ts — hai ben PHAI cung luat, neu
    khong thi so lieu hai noi khong doi chieu duoc.
    """
    path = (path or "").split("?")[0].split("#")[0]
    path = _PROFILE_RE.sub("/profile/*", path)
    path = _WALL_RE.sub("/wall/*", path)
    return path[:300]


_SEG_NUM = re.compile(r"/\d+")
_SEG_UUID = re.compile(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


def _group_endpoint(path: str) -> str:
    """/api/news/42 -> /api/news/{id}. Khong gom thi moi bai viet thanh mot
    dong rieng trong app_request_stat, bang phinh vo ich."""
    p = _safe_path(path)
    p = _SEG_UUID.sub("/{uuid}", p)
    p = _SEG_NUM.sub("/{id}", p)
    return p[:200]


# --------------------------------------------------- chuan hoa + van tay --
_NUM = re.compile(r"\d+")
_HEX = re.compile(r"\b[0-9a-f]{8,}\b", re.I)
_QUOTED = re.compile(r"'[^']{0,80}'")


def _norm_message(msg: str) -> str:
    """Bo phan bien thien de cung mot loi gop lai mot dong.

    'Cannot read x of undefined at post 42' va '... at post 77' phai ra CUNG
    mot fingerprint, neu khong thi moi bai viet de ra mot "loi" khac nhau.
    """
    m = (msg or "").strip()[:500]
    m = _HEX.sub("<hex>", m)
    m = _QUOTED.sub("'<v>'", m)
    m = _NUM.sub("<n>", m)
    return re.sub(r"\s+", " ", m).strip()


def _first_frame(stack: str) -> str:
    for line in (stack or "").splitlines():
        line = line.strip()
        if line and not line.startswith(("Error", "Traceback")):
            return _NUM.sub("<n>", line)[:200]
    return ""


def _fingerprint(source: str, kind: str, message: str, stack: str) -> str:
    raw = "|".join([source, kind, _norm_message(message), _first_frame(stack)])
    return hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()


# ------------------------------------------------------------ muc do --
def _severity(source: str, kind: str, message: str, http_status: int | None) -> str:
    """Bang phan loai — NGUON DUY NHAT, dung sua rai rac o cho khac."""
    k = (kind or "").lower()
    m = (message or "").lower()
    # Chunk hong = deploy loi hoac chunk rac. Xep critical CO CHU DICH: day dung
    # la cai bay da dinh ngay 13/08 (browser chay code cu ma khong bao gi).
    if "chunkload" in k or "dynamically imported module" in m:
        return "critical"
    if k == "bootstrap" or "failed to bootstrap" in m:
        return "critical"
    if source == "user":
        return "info"
    if http_status and http_status >= 500:
        return "error"
    if http_status and 400 <= http_status < 500:
        return "warning"
    if k in ("slow", "perf"):
        return "warning"
    return "error"


def _build_id() -> str:
    try:
        with open(BUILD_FILE, encoding="utf-8") as f:
            return str(json.load(f).get("build", ""))[:40]
    except Exception:
        return ""


# ------------------------------------------------------- chong bao lut --
_rate: dict[str, tuple[int, int]] = {}      # username -> (phut, so su kien)
_rate_lock = threading.Lock()


def _rate_ok(username: str) -> bool:
    """Dem trong RAM tung worker. 2 worker => thuc te gap doi nguong; chap nhan
    sai so de KHONG phai ghi DB moi request."""
    minute = int(time.time() // 60)
    with _rate_lock:
        cur_min, n = _rate.get(username, (minute, 0))
        if cur_min != minute:
            cur_min, n = minute, 0
        n += 1
        _rate[username] = (cur_min, n)
        if len(_rate) > 5000:
            _rate.clear()
        return n <= RATE_PER_MIN


# ------------------------------------------------------------- ghi nhan --
def record(source: str, kind: str, message: str, *, username: str = "",
           route: str = "", endpoint: str = "", http_status: int | None = None,
           stack: str = "", user_agent: str = "", url: str = "",
           request_id: str = "", context: dict | None = None,
           severity: str | None = None) -> str | None:
    """Ghi mot su kien loi. Tra ve fingerprint, hoac None neu bo qua.

    KHONG BAO GIO nem exception ra ngoai — day la duong ghi loi, no ma hong
    thi khong duoc keo theo request that.
    """
    if not ENABLED or not DSN:
        return None
    try:
        sev = severity or _severity(source, kind, message, http_status)
        fp = _fingerprint(source, kind, message, stack)
        route = _safe_path(route)
        endpoint = _group_endpoint(endpoint) if endpoint else ""
        msg = (message or "")[:1000]
        with _conn() as conn:
            row = conn.execute(
                """INSERT INTO app_error
                     (fingerprint, source, severity, kind, message, route, endpoint,
                      http_status, build_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (fingerprint) DO UPDATE
                     SET count = app_error.count + 1,
                         last_seen = now(),
                         -- loi da 'resolved' ma quay lai thi mo lai
                         status = CASE WHEN app_error.status = 'resolved'
                                       THEN 'new' ELSE app_error.status END
                   RETURNING id, count""",
                (fp, source, sev, kind[:80], msg, route, endpoint, http_status, _build_id()),
            ).fetchone()
            eid = row[0]

            if username:
                conn.execute("INSERT INTO app_error_user (error_id, username) "
                             "VALUES (%s,%s) ON CONFLICT DO NOTHING", (eid, username))
                conn.execute("UPDATE app_error SET users_hit = "
                             "(SELECT count(*) FROM app_error_user WHERE error_id = %s) "
                             "WHERE id = %s", (eid, eid))

            conn.execute(
                """INSERT INTO app_error_event
                     (error_id, username, user_agent, url, stack, request_id, context)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (eid, username[:80], (user_agent or "")[:300], _safe_path(url),
                 (stack or "")[:6000], request_id[:60],
                 json.dumps(context or {}, ensure_ascii=False)[:4000]),
            )
            # Giu toi da MAX_SAMPLES_PER_ERROR mau moi fingerprint.
            conn.execute(
                """DELETE FROM app_error_event
                    WHERE error_id = %s AND id NOT IN (
                      SELECT id FROM app_error_event WHERE error_id = %s
                      ORDER BY created_at DESC LIMIT %s)""",
                (eid, eid, MAX_SAMPLES_PER_ERROR))
            conn.commit()
        _maybe_alert(fp, sev, kind, msg, eid)
        return fp
    except Exception:
        return None


# Nguong chong spam theo muc do (giay).
_ALERT_GAP = {"critical": 0, "error": 900, "info": 3600, "warning": None}


def _maybe_alert(fp: str, sev: str, kind: str, msg: str, eid: int) -> None:
    gap = _ALERT_GAP.get(sev)
    if gap is None:
        return
    try:
        with _conn() as conn:
            # Nguyen tu: chi UPDATE khi da qua han => dung MOT worker thang.
            row = conn.execute(
                """INSERT INTO app_alert_sent (fingerprint, last_sent)
                   VALUES (%s, now())
                   ON CONFLICT (fingerprint) DO UPDATE SET last_sent = now()
                     WHERE app_alert_sent.last_sent < now() - (%s || ' seconds')::interval
                   RETURNING fingerprint""", (fp, str(gap))).fetchone()
            conn.commit()
        if not row:
            return
    except Exception:
        return
    # Import muon: tranh vong import voi news.py (news khong import telemetry).
    try:
        from .news import _queue_push
    except Exception:
        return
    admins = [u.strip() for u in os.environ.get("CONTENT_ADMIN_USERS", "").split(",") if u.strip()]
    for adm in admins:
        _queue_push(adm, f"[{sev.upper()}] {kind}", msg[:120],
                    f"/admin/errors?id={eid}", f"err-{fp[:12]}")


# ------------------------------------------------------------ endpoints --
@router.post("/client", status_code=204)
def ingest_client(payload: dict = Body(...), username: str = Depends(current_user),
                  user_agent: str | None = Header(default=None)):
    """Nhan LO su kien tu trinh duyet. LUON tra 204, ke ca khi bo qua."""
    if not ENABLED or not _rate_ok(username):
        return JSONResponse(status_code=204, content=None)
    events = payload.get("events")
    if not isinstance(events, list):
        return JSONResponse(status_code=204, content=None)
    for ev in events[:MAX_EVENTS_PER_BATCH]:
        if not isinstance(ev, dict):
            continue
        if len(json.dumps(ev, ensure_ascii=False)) > MAX_EVENT_BYTES:
            continue
        record("client", str(ev.get("kind") or "Error")[:80],
               str(ev.get("message") or "")[:1000],
               username=username, route=str(ev.get("route") or ""),
               stack=str(ev.get("stack") or ""), user_agent=user_agent or "",
               url=str(ev.get("url") or ""), request_id=str(ev.get("requestId") or ""),
               context={"breadcrumbs": ev.get("breadcrumbs") or [],
                        "build": ev.get("build") or ""},
               http_status=ev.get("status") if isinstance(ev.get("status"), int) else None)
    # Luot xem trang di GHEP vao cung lo su kien loi, khong tao request rieng:
    # portal la SPA nen server khong thay viec doi trang, ma them mot request
    # moi lan dieu huong thi dat gap doi so request cua ca portal.
    pvs = payload.get("pageviews")
    if isinstance(pvs, list):
        info = get_user(username) or {}
        dept = str(info.get("department") or "")
        for r in pvs[:MAX_EVENTS_PER_BATCH]:
            if isinstance(r, str) and r:
                bump_page_view(r, username, dept)
    return JSONResponse(status_code=204, content=None)


@router.post("/report")
def user_report(payload: dict = Body(...), username: str = Depends(current_user),
                user_agent: str | None = Header(default=None)) -> dict:
    """Nut 'Bao loi'. Tra ve ma tra cuu de nguoi dung nhan cho IT."""
    desc = str(payload.get("description") or "").strip()[:1000]
    if not desc:
        raise HTTPException(status_code=400, detail="chua nhap mo ta")
    fp = record("user", "UserReport", desc, username=username,
                route=str(payload.get("route") or ""), user_agent=user_agent or "",
                url=str(payload.get("url") or ""),
                request_id=str(payload.get("requestId") or ""),
                context={"breadcrumbs": payload.get("breadcrumbs") or [],
                         "screen": payload.get("screen") or "",
                         "build": payload.get("build") or ""})
    return {"ok": True, "code": (fp or "")[:6].upper()}


def _require_admin(username: str) -> None:
    if not can_admin_content(username):
        raise HTTPException(status_code=403, detail="ban khong co quyen xem loi")


@router.get("/errors")
def list_errors(severity: str = "", status: str = "", since_hours: int = 168,
                limit: int = 100, offset: int = 0,
                username: str = Depends(current_user)) -> dict:
    _require_admin(username)
    where, args = ["last_seen > now() - (%s || ' hours')::interval"], [str(max(1, since_hours))]
    if severity:
        where.append("severity = %s"); args.append(severity)
    if status:
        where.append("status = %s"); args.append(status)
    args += [min(500, max(1, limit)), max(0, offset)]
    with _conn() as conn:
        rows = conn.execute(
            f"""SELECT id, fingerprint, source, severity, kind, message, route, endpoint,
                       http_status, count, users_hit, first_seen, last_seen, status, build_id
                  FROM app_error WHERE {' AND '.join(where)}
                 ORDER BY last_seen DESC LIMIT %s OFFSET %s""", args).fetchall()
        counts = conn.execute("SELECT severity, count(*) FROM app_error "
                              "WHERE status = 'new' GROUP BY severity").fetchall()
    keys = ["id", "fingerprint", "source", "severity", "kind", "message", "route",
            "endpoint", "httpStatus", "count", "usersHit", "firstSeen", "lastSeen",
            "status", "buildId"]
    return {"items": [dict(zip(keys, r)) for r in rows],
            "newBySeverity": {s: n for s, n in counts}}


@router.get("/errors/{eid}")
def error_detail(eid: int, username: str = Depends(current_user)) -> dict:
    _require_admin(username)
    with _conn() as conn:
        head = conn.execute(
            "SELECT id, fingerprint, source, severity, kind, message, route, endpoint, "
            "http_status, count, users_hit, first_seen, last_seen, status, build_id "
            "FROM app_error WHERE id = %s", (eid,)).fetchone()
        if not head:
            raise HTTPException(status_code=404, detail="khong co loi nay")
        evs = conn.execute(
            "SELECT username, user_agent, url, stack, request_id, context, created_at "
            "FROM app_error_event WHERE error_id = %s ORDER BY created_at DESC LIMIT %s",
            (eid, MAX_SAMPLES_PER_ERROR)).fetchall()
    keys = ["id", "fingerprint", "source", "severity", "kind", "message", "route",
            "endpoint", "httpStatus", "count", "usersHit", "firstSeen", "lastSeen",
            "status", "buildId"]
    ekeys = ["username", "userAgent", "url", "stack", "requestId", "context", "createdAt"]
    return {"error": dict(zip(keys, head)),
            "samples": [dict(zip(ekeys, e)) for e in evs]}


@router.post("/errors/{eid}/status")
def set_status(eid: int, payload: dict = Body(...),
               username: str = Depends(current_user)) -> dict:
    _require_admin(username)
    st = str(payload.get("status") or "")
    if st not in ("new", "ack", "resolved"):
        raise HTTPException(status_code=400, detail="trang thai khong hop le")
    with _conn() as conn:
        conn.execute("UPDATE app_error SET status = %s, resolved_by = %s, "
                     "resolved_at = CASE WHEN %s = 'resolved' THEN now() ELSE NULL END "
                     "WHERE id = %s", (st, username, st, eid))
        conn.commit()
    return {"ok": True, "status": st}


@router.get("/metrics")
def metrics() -> dict:
    """JSON PHANG cho Zabbix boc bang JSONPath.

    KHONG doi xac thuc — Apache gioi han bang `Require ip` (10.255.99.51 +
    10.10.100.128 + 127.0.0.1). Chi tra so dem, KHONG co du lieu nguoi dung.
    """
    out = {"errors_critical_5m": 0, "errors_error_1h": 0, "errors_new_total": 0,
           "http_5xx_5m": 0, "req_5m": 0, "slow_5m": 0, "ms_avg_5m": 0,
           "db_ok": 0, "build_id": _build_id(), "enabled": 1 if ENABLED else 0}
    try:
        with _conn() as conn:
            out["db_ok"] = 1
            out["errors_critical_5m"] = conn.execute(
                "SELECT count(*) FROM app_error WHERE severity='critical' "
                "AND last_seen > now() - interval '5 minutes'").fetchone()[0]
            out["errors_error_1h"] = conn.execute(
                "SELECT count(*) FROM app_error WHERE severity='error' "
                "AND last_seen > now() - interval '1 hour'").fetchone()[0]
            out["errors_new_total"] = conn.execute(
                "SELECT count(*) FROM app_error WHERE status='new'").fetchone()[0]
            r = conn.execute(
                "SELECT coalesce(sum(n),0), coalesce(sum(n_5xx),0), coalesce(sum(n_slow),0), "
                "       coalesce(sum(ms_sum),0) FROM app_request_stat "
                " WHERE minute > now() - interval '5 minutes'").fetchone()
            out["req_5m"], out["http_5xx_5m"], out["slow_5m"] = int(r[0]), int(r[1]), int(r[2])
            out["ms_avg_5m"] = int(r[3] // r[0]) if r[0] else 0
    except Exception:
        pass
    return out


# ============================================================================
# Middleware + bo gom so lieu
# ============================================================================
# KHONG ghi DB moi request: 3.000+ request/ngay hien tai va se tang manh khi mo
# cho ~1700 nguoi. Gom trong RAM roi xa moi FLUSH_SEC giay bang MOT lenh UPSERT.
_stat_buf: dict[tuple[int, str], list[int]] = defaultdict(lambda: [0, 0, 0, 0, 0, 0])
_stat_lock = threading.Lock()
_metric_buf: dict[tuple[int, str], int] = defaultdict(int)
_pv_buf: dict[tuple[int, str, str], list] = {}
FLUSH_SEC = 30


def bump_metric(name: str, n: int = 1) -> None:
    """Dem mot su kien NGHIEP VU (bai dang, tin nhan, dang nhap...).

    Day la tang bat loai bug khong nem exception: neu 'bai dang/gio' tut sau
    mot ban deploy thi co gi do hong ma khong ai bao.
    """
    if not ENABLED:
        return
    hour = int(time.time() // 3600) * 3600
    with _stat_lock:
        _metric_buf[(hour, name[:40])] += n


def bump_page_view(route: str, username: str, department: str = "") -> None:
    if not ENABLED or not username:
        return
    hour = int(time.time() // 3600) * 3600
    key = (hour, _safe_path(route), username[:80])
    with _stat_lock:
        cur = _pv_buf.get(key)
        if cur:
            cur[1] += 1
        else:
            _pv_buf[key] = [department[:80], 1]


def _flush() -> None:
    with _stat_lock:
        stats = {k: v[:] for k, v in _stat_buf.items()}; _stat_buf.clear()
        mets = dict(_metric_buf); _metric_buf.clear()
        pvs = dict(_pv_buf); _pv_buf.clear()
    if not (stats or mets or pvs):
        return
    try:
        with _conn() as conn:
            for (minute, endpoint), v in stats.items():
                conn.execute(
                    """INSERT INTO app_request_stat
                         (minute, endpoint, n, n_4xx, n_5xx, n_slow, ms_sum, ms_max)
                       VALUES (to_timestamp(%s),%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (minute, endpoint) DO UPDATE SET
                         n = app_request_stat.n + EXCLUDED.n,
                         n_4xx = app_request_stat.n_4xx + EXCLUDED.n_4xx,
                         n_5xx = app_request_stat.n_5xx + EXCLUDED.n_5xx,
                         n_slow = app_request_stat.n_slow + EXCLUDED.n_slow,
                         ms_sum = app_request_stat.ms_sum + EXCLUDED.ms_sum,
                         ms_max = greatest(app_request_stat.ms_max, EXCLUDED.ms_max)""",
                    (minute, endpoint, v[0], v[1], v[2], v[3], v[4], v[5]))
            for (hour, name), n in mets.items():
                conn.execute(
                    """INSERT INTO app_metric (hour, name, n) VALUES (to_timestamp(%s),%s,%s)
                       ON CONFLICT (hour, name) DO UPDATE
                         SET n = app_metric.n + EXCLUDED.n""", (hour, name, n))
            for (hour, route, user), (dept, n) in pvs.items():
                conn.execute(
                    """INSERT INTO app_page_view (hour, route, username, department, n)
                       VALUES (to_timestamp(%s),%s,%s,%s,%s)
                       ON CONFLICT (hour, route, username) DO UPDATE
                         SET n = app_page_view.n + EXCLUDED.n""", (hour, route, user, dept, n))
            conn.commit()
    except Exception:
        # Mat mot lo so lieu con hon lam sap request. Khong tu bao cao loi o day
        # vi day CHINH LA duong ghi bao cao — se thanh vong lap chet.
        pass


# ---------------------------------------------------------- do bat thuong --
# Loai bug TE NHAT khong nem exception nao: form gui xong mat du lieu, feed tra
# rong, chat bao "da gui" ma khong ai nhan. Khong co exception thi ca duong ong
# o tren KHONG THAY GI, va /admin/errors hien "0 loi" trong khi nguoi dung dang
# chui. Cach duy nhat bat duoc la nhin SO DEM NGHIEP VU tut bat thuong.
#
# So voi TRUNG VI cua 4 tuan truoc CUNG THU CUNG GIO, khong phai gio truoc do:
# 9h sang thu Hai va 21h Chu nhat khac han nhau, so ngang la bao dong gia suot.

#: Lech qua nguong nay (theo ti le) thi bao.
ANOMALY_DROP = 0.5
#: Duoi nguong dem nay thi bo qua — vai bai mot gio thi 1 bai chenh da la 50%,
#: bao ca nhung luc do la day nguoi ta tat canh bao.
ANOMALY_MIN_BASE = 8


def _check_anomaly() -> None:
    """So gio VUA XONG voi trung vi 4 tuan cung khung gio. Chay 1 lan/gio."""
    if not ENABLED or not DSN:
        return
    try:
        with _conn() as conn:
            rows = conn.execute(
                """WITH last_hour AS (
                     SELECT name, n FROM app_metric
                      WHERE hour = date_trunc('hour', now()) - interval '1 hour'),
                   base AS (
                     SELECT name,
                            percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS med
                       FROM app_metric
                      WHERE hour IN (
                              date_trunc('hour', now()) - interval '1 hour' - interval '7 days',
                              date_trunc('hour', now()) - interval '1 hour' - interval '14 days',
                              date_trunc('hour', now()) - interval '1 hour' - interval '21 days',
                              date_trunc('hour', now()) - interval '1 hour' - interval '28 days')
                      GROUP BY name)
                   SELECT base.name, coalesce(last_hour.n, 0), base.med
                     FROM base LEFT JOIN last_hour USING (name)
                    WHERE base.med >= %s""", (ANOMALY_MIN_BASE,)).fetchall()
        for name, now_n, med in rows:
            med = float(med or 0)
            if med <= 0:
                continue
            drop = (med - now_n) / med
            if drop < ANOMALY_DROP:
                continue
            # Fingerprint chi gom `name` (khong gom con so) => mot dong duy nhat
            # cho moi chi so, khong de moi gio de ra mot dong moi.
            record("server", "MetricAnomaly",
                   f"chi so nghiep vu '{name}' tut bat thuong",
                   route="", severity="warning",
                   context={"metric": name, "gio_vua_roi": int(now_n),
                            "trung_vi_4_tuan": round(med, 1),
                            "tut": f"{drop * 100:.0f}%"})
    except Exception:
        # Duong ghi bao cao khong duoc tu lam sap minh.
        pass


def _flusher() -> None:
    last_anomaly = 0
    while True:
        time.sleep(FLUSH_SEC)
        _flush()
        # Moi tien trinh worker deu chay vong nay; `record()` gop theo
        # fingerprint nen 2 worker cung bao thi van chi MOT dong, va
        # _maybe_alert() chong spam bang UPSERT co dieu kien.
        now = time.time()
        if now - last_anomaly >= 3600:
            last_anomaly = now
            _check_anomaly()


def install(app) -> None:
    """Gan middleware + bat exception toan cuc. Goi tu main.py."""
    if not ENABLED:
        return
    threading.Thread(target=_flusher, daemon=True).start()

    import asyncio
    import uuid as _uuid

    @app.middleware("http")
    async def _track(request: Request, call_next):
        rid = _uuid.uuid4().hex[:16]
        path = request.url.path
        # Khong tu theo doi chinh duong thu telemetry => tranh vong lap.
        skip = path.startswith("/api/telemetry") or path == "/api/health"
        t0 = time.perf_counter()
        try:
            resp = await call_next(request)
        except Exception as exc:
            ms = int((time.perf_counter() - t0) * 1000)
            if not skip:
                # record() lam viec DB DONG BO => PHAI to_thread, khong thi chan
                # ca vong lap su kien (cung bay da vap voi _publish trong chat.py).
                await asyncio.to_thread(
                    record, "server", type(exc).__name__, f"{exc}",
                    username=request.headers.get("x-remote-user", ""),
                    endpoint=path, http_status=500, request_id=rid,
                    stack=__import__("traceback").format_exc())
                _count(path, 500, ms)
            # Tra ma tra cuu de IT lan nguoc ra dung traceback.
            return JSONResponse(status_code=500,
                                content={"detail": "loi he thong", "requestId": rid},
                                headers={"X-Request-Id": rid})
        ms = int((time.perf_counter() - t0) * 1000)
        resp.headers["X-Request-Id"] = rid
        if not skip:
            _count(path, resp.status_code, ms)
            if resp.status_code >= 500:
                await asyncio.to_thread(
                    record, "server", f"HTTP{resp.status_code}",
                    f"{request.method} {_group_endpoint(path)} -> {resp.status_code}",
                    username=request.headers.get("x-remote-user", ""),
                    endpoint=path, http_status=resp.status_code, request_id=rid)
        return resp


def _count(path: str, status: int, ms: int) -> None:
    minute = int(time.time() // 60) * 60
    ep = _group_endpoint(path)
    with _stat_lock:
        v = _stat_buf[(minute, ep)]
        v[0] += 1
        if 400 <= status < 500:
            v[1] += 1
        elif status >= 500:
            v[2] += 1
        if ms > SLOW_MS:
            v[3] += 1
        v[4] += ms
        v[5] = max(v[5], ms)
