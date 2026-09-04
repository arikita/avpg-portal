"""Backend portal noi bo AVP.

Xac thuc do Apache + mod_auth_gssapi lo o vong ngoai; backend chi TIN header
X-Remote-User ma Apache dat. Apache BAT BUOC phai xoa header nay tu client
truoc khi dat lai, neu khong ai cung gia mao duoc danh tinh."""
from __future__ import annotations
import asyncio
import contextlib
import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
import psycopg

# Nuot loi de trang khong sap la CO CHU DICH, nhung nuot IM LANG thi
# share NAS chet ma portal van xanh - khong ai biet. Ghi mot dong canh bao
# truoc khi nuot, hanh vi lui-ve giu NGUYEN. (Quy uoc ten: xem chat.py)
log = logging.getLogger("avp.main")

from .ad import can_admin_content, get_user, is_editor, is_news_author, list_directory
from .admin import router as admin_router
from .gallery import GALLERY_DIR, manage_router as gallery_manage_router, router as gallery_router
from .news import router as news_router, notif_router, push_router
from .profile import avatar_router, router as profile_router
from .quiz import router as quiz_router
from .rail import router as rail_router
from .telemetry import install as telemetry_install, router as telemetry_router
from .wall import feed_router, router as wall_router
from . import chat as chat_mod
from .chat import router as chat_router, ws_router

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Moi worker giu MOT ket noi nghe kenh NOTIFY cua chat suot doi tien trinh
    (xem giai thich trong app/chat.py: 2 worker nen can duong truyen chung)."""
    task = asyncio.create_task(chat_mod.listener())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="AVP Portal API", docs_url=None, redoc_url=None,
              lifespan=lifespan)
DSN = os.environ.get("DATABASE_URL", "")
app.include_router(news_router)
app.include_router(notif_router)
app.include_router(push_router)
app.include_router(profile_router)
app.include_router(avatar_router)
app.include_router(wall_router)
app.include_router(rail_router)
app.include_router(feed_router)
app.include_router(chat_router)
app.include_router(ws_router)
app.include_router(telemetry_router)
# gallery_manage_router PHAI dang ky TRUOC gallery_router: FastAPI khop route
# theo thu tu, de sau thi /api/gallery/manage roi vao route /{slug}.
app.include_router(gallery_manage_router)
app.include_router(gallery_router)
app.include_router(admin_router)
app.include_router(quiz_router)
# Gan middleware do thoi gian + bat exception toan cuc. Dat SAU cung de
# no boc het cac router o tren. Tat bang env TELEMETRY_ENABLED=0.
telemetry_install(app)


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user


@app.get("/api/health")
def health() -> JSONResponse:
    checks = {"api": "ok"}
    try:
        with psycopg.connect(DSN, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"loi: {type(exc).__name__}"
    try:
        checks["ad"] = "ok" if get_user("krbtgt") is not None else "khong tra duoc"
    except Exception as exc:
        checks["ad"] = f"loi: {type(exc).__name__}"
    # Kho anh: hong thi anh bien mat ma trang van xanh — dung loai loi im lang
    # ma ca he thong telemetry sinh ra de bat.
    try:
        checks["media"] = "ok" if os.path.isdir(GALLERY_DIR) else "khong doc duoc"
    except Exception as exc:
        checks["media"] = f"loi: {type(exc).__name__}"
    healthy = all(v == "ok" for v in checks.values())
    # `build` KHONG nam trong `checks`: no la thong tin, khong phai phep thu.
    # Nhet vao checks thi gia tri khac "ok" se lam /api/health tra 503 va bat
    # canh bao Zabbix gia. JSONPath $.api / $.db / $.ad van khong doi.
    body = dict(checks)
    try:
        from .telemetry import _build_id
        body["build"] = _build_id()
    except Exception:
        body["build"] = ""
    return JSONResponse(body, status_code=200 if healthy else 503)


@app.get("/api/me")
def me(request: Request, username: str = Depends(current_user)) -> dict:
    info = get_user(username)
    base = {"username": username, "fullName": username} if info is None else \
        {k: v for k, v in info.items() if k != "dn"}
    # canEdit = vao duoc trang /admin (allowlist CONTENT_ADMIN_USERS), KHAC voi
    # canModerateNews (kiem duyet tin tuc, van theo group IS).
    base["canEdit"] = can_admin_content(username)
    # Cong tac tat nhanh (TELEMETRY_ENABLED=0): client doc co nay de tu im.
    # Khong co no thi tat phia server xong trinh duyet van ban POST /client
    # deu deu, server tra 204 rong — ton bang thong va che mat viec da tat.
    from .telemetry import ENABLED as _telemetry_on
    base["telemetry"] = bool(_telemetry_on)
    base["canPostNews"] = is_news_author(username)
    base["canModerateNews"] = is_editor(username)
    # Vao bang SSO Kerberos hay bang form dang nhap?
    #
    # Nut "Dang xuat" tren portal CHI that su ket thuc phien voi nguoi dang
    # nhap bang form: Apache xoa cookie avpsess la xong. May join domain thi
    # bam xong se vao lai ngay bang ve Kerberos — ranh gioi that cua ho la
    # phien Windows, khong phai portal. Giao dien phai noi thang dieu do thay
    # vi de mot cai nut bam khong co tac dung.
    #
    # Cach nhan biet: Apache re nhanh xac thuc bang DUNG dieu kien nay
    # (`<If "%{HTTP:Cookie} =~ /avpsess=/">` trong avp-portal.conf), va no
    # chuyen tiep nguyen header Cookie sang day. Cookie la HttpOnly nen chi
    # doc duoc o server — day la ly do co truong nay thay vi de client tu doan.
    base["sso"] = "avpsess" not in request.cookies
    # Anh dai dien: de navbar ve duoc nut ho so ngay, khong phai doi ban do
    # avatar. Ho so chua co thi tra chuoi rong (navbar lui ve chu cai dau).
    try:
        with psycopg.connect(DSN, connect_timeout=3) as conn:
            row = conn.execute("SELECT avatar FROM user_profile WHERE username = %s",
                               (base["username"],)).fetchone()
        base["avatar"] = row[0] if row else ""
    except Exception as exc:
        log.warning("me: khong doc duoc avatar cua %s (%s: %s)",
                    base["username"], type(exc).__name__, exc)
        base["avatar"] = ""
    return base


@app.get("/api/directory")
def directory(username: str = Depends(current_user)) -> dict:
    """Danh ba toan cong ty, lay truc tiep tu AD (cache 15 phut)."""
    return list_directory()


@app.get("/api/hero-images")
def hero_images(username: str = Depends(current_user)) -> dict:
    """Anh slideshow hero trang chu (thu muc media/hero)."""
    d = os.environ.get("HERO_DIR", "/var/www/avp-portal-media/hero")
    try:
        files = sorted(f for f in os.listdir(d)
                       if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    except FileNotFoundError:
        files = []
    return {"images": [f"/media/hero/{f}" for f in files]}


# --------------------------------------------------------------- noi dung --
def _fetch(sql: str, args: tuple = ()) -> list:
    with psycopg.connect(DSN, connect_timeout=5) as conn:
        return conn.execute(sql, args).fetchall()


@app.get("/api/content")
def content_all(username: str = Depends(current_user)) -> dict:
    """Toan bo noi dung, gom theo module - giu dung hinh dang cu cua content/*.ts."""
    out: dict = {}
    for module, key, value in _fetch("SELECT module, key, value FROM content"):
        out.setdefault(module, {})[key] = value
    return out


@app.get("/api/content/{module}")
def content_module(module: str, username: str = Depends(current_user)) -> dict:
    rows = _fetch("SELECT key, value FROM content WHERE module = %s", (module,))
    if not rows:
        raise HTTPException(status_code=404, detail="khong co module nay")
    return {k: v for k, v in rows}


def require_editor(username: str = Depends(current_user)) -> str:
    """Chi user trong allowlist CONTENT_ADMIN_USERS moi duoc ghi noi dung."""
    if not can_admin_content(username):
        raise HTTPException(status_code=403, detail="ban khong co quyen sua noi dung")
    return username


@app.put("/api/content/{module}/{key}")
def content_save(module: str, key: str, value: Any = Body(...),
                 username: str = Depends(require_editor)) -> dict:
    """Ghi de mot muc noi dung; ban cu luon duoc luu vao content_history."""
    with psycopg.connect(DSN, connect_timeout=5) as conn:
        row = conn.execute("SELECT value FROM content WHERE module = %s AND key = %s",
                           (module, key)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="khong co muc noi dung nay")
        conn.execute("INSERT INTO content_history (module, key, value, changed_by)"
                     " VALUES (%s, %s, %s, %s)",
                     (module, key, json.dumps(row[0], ensure_ascii=False), username))
        conn.execute("UPDATE content SET value = %s, updated_at = now(), updated_by = %s"
                     " WHERE module = %s AND key = %s",
                     (json.dumps(value, ensure_ascii=False), username, module, key))
        conn.commit()
    return {"ok": True, "module": module, "key": key, "by": username}


@app.get("/api/content/{module}/{key}/history")
def content_history(module: str, key: str,
                    username: str = Depends(require_editor)) -> list:
    rows = _fetch("SELECT changed_at, changed_by, value FROM content_history"
                  " WHERE module = %s AND key = %s ORDER BY changed_at DESC LIMIT 20",
                  (module, key))
    return [{"changedAt": a.isoformat(), "changedBy": b, "value": v} for a, b, v in rows]
