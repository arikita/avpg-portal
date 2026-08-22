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

from fastapi import Body, Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import psycopg

# Nuot loi de trang khong sap la CO CHU DICH, nhung nuot IM LANG thi
# share NAS chet ma portal van xanh - khong ai biet. Ghi mot dong canh bao
# truoc khi nuot, hanh vi lui-ve giu NGUYEN. (Quy uoc ten: xem chat.py)
log = logging.getLogger("avp.main")

from .ad import can_admin_content, get_user, is_editor, is_news_author, list_directory
from .news import router as news_router, notif_router, push_router
from .profile import avatar_router, router as profile_router
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
def me(username: str = Depends(current_user)) -> dict:
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


# -------------------------------------------------------------- thu vien --
# ANH GOC NAM O FILE SERVER, KHONG COPY VE. Share cua hcm-datasvr duoc mount
# read-only tai /mnt/avp-share bang Kerberos (keytab cua chinh portal, khong
# luu mat khau) - xem /usr/local/sbin/avp-share-mount.sh.
#
#   thumb (480px)  : tao san bang tools/pull_gallery.py, nam o
#                    /var/www/avp-portal-media/gallery/<slug>/thumb/, Apache
#                    serve qua /media (da bat GSSAPI => phai dang nhap).
#                    Anh moi HR bo vao share ma chua co thumb thi tao tai cho.
#   full (1600px)  : KHONG luu san. Ai bam xem lon thi doc anh goc tu share,
#                    thu nho roi cache o /var/cache/avp-portal-gallery/.
#
# Danh sach anh lay tu chinh thu muc tren share => HR them anh la portal co
# ngay, khong can chay lai script hay build lai.
GALLERY_DIR = os.environ.get("GALLERY_DIR", "/var/www/avp-portal-media/gallery")
GALLERY_SRC_ROOT = os.environ.get("GALLERY_SRC_ROOT", "/mnt/avp-share")
GALLERY_CACHE = os.environ.get("GALLERY_CACHE", "/var/cache/avp-portal-gallery")
GALLERY_TTL = int(os.environ.get("GALLERY_TTL", "900"))
FULL_MAX, FULL_Q = 1600, 80
THUMB_MAX, THUMB_Q = 480, 75
_IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")

_SLUG = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")
_STEM = re.compile(r"[a-z0-9][a-z0-9._-]{0,120}")
_index_cache: dict[str, tuple[float, list[tuple[str, str]]]] = {}


def _album_meta(slug: str) -> dict | None:
    try:
        with open(os.path.join(GALLERY_DIR, slug, "album.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as exc:
        log.warning("gallery: khong doc duoc album.json cua %s (%s: %s)",
                    slug, type(exc).__name__, exc)
        return None


def _stem_of(name: str) -> str:
    return os.path.splitext(name)[0].lower().replace(" ", "-")


def _thumbs(slug: str) -> set[str]:
    """Ten cac anh da co thumb san tren dia."""
    try:
        return {f[:-4] for f in os.listdir(os.path.join(GALLERY_DIR, slug, "thumb"))
                if f.endswith(".jpg")}
    except OSError as exc:
        log.warning("gallery: khong liet ke duoc thumb cua %s (%s: %s)",
                    slug, type(exc).__name__, exc)
        return set()


def _index(slug: str, meta: dict) -> list[tuple[str, str]]:
    """[(ten rut gon, ten file goc)] doc thang tu share, cache GALLERY_TTL giay.

    Doc that bai (share chua mount / file server sap) thi lui ve danh sach
    thumb co san tren dia: luoi anh van hien binh thuong, chi rieng xem lon
    anh chua cache la bao loi.
    """
    hit = _index_cache.get(slug)
    if hit and time.time() - hit[0] < GALLERY_TTL:
        return hit[1]
    src = meta.get("src") or ""
    rows: list[tuple[str, str]] = []
    if src:
        d = os.path.join(GALLERY_SRC_ROOT, src)
        try:
            rows = sorted((_stem_of(n), n) for n in os.listdir(d)
                          if n.lower().endswith(_IMG_EXT)
                          and os.path.isfile(os.path.join(d, n)))
        except OSError as exc:
            log.warning("gallery: khong doc duoc share nguon %s (%s: %s) - lui ve thumb co san",
                        d, type(exc).__name__, exc)
            rows = []
    if not rows:
        rows = sorted((t, "") for t in _thumbs(slug))
    _index_cache[slug] = (time.time(), rows)
    return rows


def _album_card(slug: str, meta: dict, count: int | None = None) -> dict:
    cover = meta.get("cover") or ""
    return {
        "slug": slug,
        "title": meta.get("title") or {"vi": slug, "en": slug},
        "desc": meta.get("desc") or {"vi": "", "en": ""},
        "date": meta.get("date") or "",
        "count": count if count is not None else (meta.get("count") or 0),
        "cover": f"/media/gallery/{slug}/thumb/{cover}.jpg" if cover else "",
    }


@app.get("/api/gallery")
def gallery(username: str = Depends(current_user)) -> dict:
    """Danh sach album anh, moi nhat truoc."""
    try:
        slugs = sorted(d for d in os.listdir(GALLERY_DIR) if _SLUG.fullmatch(d))
    except FileNotFoundError:
        return {"albums": []}
    albums = [_album_card(s, m, len(_index(s, m))) for s in slugs if (m := _album_meta(s))]
    albums.sort(key=lambda a: (a["date"], a["slug"]), reverse=True)
    return {"albums": albums}


@app.get("/api/gallery/{slug}")
def gallery_album(slug: str, username: str = Depends(current_user)) -> dict:
    """Toan bo anh cua mot album (danh sach lay tu share)."""
    if not _SLUG.fullmatch(slug):          # chan ../ di lac ra ngoai thu muc
        raise HTTPException(status_code=404, detail="khong co album nay")
    meta = _album_meta(slug)
    if meta is None:
        raise HTTPException(status_code=404, detail="khong co album nay")
    have_thumb = _thumbs(slug)
    rows = _index(slug, meta)
    dims = {p["file"]: (p.get("w", 0), p.get("h", 0)) for p in meta.get("photos", [])}
    photos = []
    for stem, _orig in rows:
        w, h = dims.get(stem, (0, 0))
        photos.append({
            # thumb co san thi de Apache serve thang cho nhanh; anh moi thi
            # nho API tao (lan dau cham, sau do da co cache).
            "thumb": (f"/media/gallery/{slug}/thumb/{stem}.jpg" if stem in have_thumb
                      else f"/api/gallery/{slug}/img/{stem}.jpg?s=t"),
            "full": f"/api/gallery/{slug}/img/{stem}.jpg",
            "w": w, "h": h,
        })
    return {**_album_card(slug, meta, len(photos)), "photos": photos}


def _render(src_path: str, out_path: str, box: int, quality: int) -> None:
    """Thu nho anh goc tu share roi ghi vao cache (ghi tam roi doi ten cho
    khong bao gio serve phai file dang viet do)."""
    from PIL import Image, ImageOps          # nap muon: chi gallery moi can
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = f"{out_path}.{os.getpid()}.tmp"
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((box, box), Image.LANCZOS)
        im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
    os.replace(tmp, out_path)


@app.get("/api/gallery/{slug}/img/{name}")
def gallery_img(slug: str, name: str, s: str = "f",
                username: str = Depends(current_user)) -> FileResponse:
    """Anh da thu nho: lay tu cache, chua co thi doc anh goc tu share tao ra."""
    stem = name[:-4] if name.lower().endswith(".jpg") else name
    if not _SLUG.fullmatch(slug) or not _STEM.fullmatch(stem) or ".." in stem:
        raise HTTPException(status_code=404, detail="khong co anh nay")
    meta = _album_meta(slug)
    if meta is None:
        raise HTTPException(status_code=404, detail="khong co album nay")
    thumb = s == "t"
    box, quality, sub = (THUMB_MAX, THUMB_Q, "t") if thumb else (FULL_MAX, FULL_Q, "f")
    out = os.path.join(GALLERY_CACHE, slug, sub, f"{stem}.jpg")
    if not os.path.exists(out):
        orig = next((o for st, o in _index(slug, meta) if st == stem and o), None)
        if orig is None:
            # Phan biet ro: khong co anh that, hay share dang khong doc duoc.
            src_dir = os.path.join(GALLERY_SRC_ROOT, meta.get("src") or "")
            if not os.path.isdir(src_dir):
                raise HTTPException(status_code=503,
                                    detail="file server dang khong truy cap duoc")
            raise HTTPException(status_code=404, detail="khong co anh nay")
        try:
            _render(os.path.join(GALLERY_SRC_ROOT, meta["src"], orig), out, box, quality)
        except OSError as exc:
            raise HTTPException(status_code=503,
                                detail=f"khong doc duoc anh goc: {type(exc).__name__}") from exc
    return FileResponse(out, media_type="image/jpeg",
                        headers={"Cache-Control": "private, max-age=604800"})


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
