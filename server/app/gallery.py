"""Thu vien anh — doc va QUAN LY album.

ANH GOC NAM O FILE SERVER, KHONG COPY VE. Share cua hcm-datasvr duoc mount
read-only tai /mnt/avp-share bang Kerberos (keytab cua chinh portal, khong luu
mat khau) — xem /usr/local/sbin/avp-share-mount.sh.

  thumb (480px)  : nam o /var/www/avp-portal-media/gallery/<slug>/thumb/,
                   Apache serve qua /media (da bat GSSAPI => phai dang nhap).
                   Sinh hang loat boi viec nen khi tao album; anh nao chua co
                   thi tao tai cho luc co nguoi xem.
  full (1600px)  : KHONG luu san. Doc anh goc tu share, thu nho, cache o
                   /var/cache/avp-portal-gallery/.
  goc            : chi doc thang tu share khi nguoi dung bam tai ve.

Danh sach anh lay tu chinh thu muc tren share => ai bo them anh vao share la
portal co ngay, khong can chay lai gi.

VI SAO CO PHAN "MANAGE" (25/08/2026): truoc day them mot album la ba buoc tay
tren HAI may (chay tools/pull_gallery.py o clasvr, rsync sang .136, mv vao
dung cho) va can mat khau SMB. Marketing khong tu lam duoc, nen sau nhieu
thang thu vien van dung MOT album. Thiet ke lai giao dien khong cuu duoc dieu
do — nut that nam o cho ai duoc them anh.

QUYEN: dung LAI dung nhom cua quyen dang tin (HR/Marketing/IS, `is_news_author`).
Du an co y tach ba loai quyen; them loai thu tu chi lam roi them.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import FileResponse

from .ad import is_news_author

log = logging.getLogger("avp.gallery")

router = APIRouter(prefix="/api/gallery", tags=["gallery"])

GALLERY_DIR = os.environ.get("GALLERY_DIR", "/var/www/avp-portal-media/gallery")
GALLERY_SRC_ROOT = os.environ.get("GALLERY_SRC_ROOT", "/mnt/avp-share")
GALLERY_CACHE = os.environ.get("GALLERY_CACHE", "/var/cache/avp-portal-gallery")
GALLERY_TTL = int(os.environ.get("GALLERY_TTL", "900"))

FULL_MAX, FULL_Q = 1600, 80
THUMB_MAX, THUMB_Q = 480, 75
#: So luong chay song song khi sinh thumb. Giu it: viec nay dap thang vao
#: file server, va no hay chay dung gio lam viec.
THUMB_WORKERS = int(os.environ.get("THUMB_WORKERS", "6"))
_IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")

# `manage` la duong dan cua khu quan ly, KHONG duoc la ten album — neu khong
# `/api/gallery/manage` se roi vao route `/{slug}`.
RESERVED = {"manage"}

_SLUG = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")
_STEM = re.compile(r"[a-z0-9][a-z0-9._-]{0,120}")

_index_cache: dict[str, tuple[float, list[tuple[str, str]]]] = {}

#: Tien do viec sinh thumb, theo slug. Chi nam trong bo nho: mat khi restart
#: la chap nhan duoc — thumb da sinh van con tren dia, chay lai chi bo qua.
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()

#: Nhan album. Co y de o MUC ALBUM chu khong gan tag tung anh: album 1687 anh
#: thi khong ai ngoi gan tag cho tung tam.
LABELS = ["su-kien", "the-thao", "dao-tao", "nha-may", "khac"]

#: Co cua the album tren trang danh sach. Marketing tu chon cho TUNG album —
#: mot su kien lon dang duoc chiem ca hang, mot buoi dao tao thi khong. Day la
#: quyen bien tap "bo mat" cua trang, khong phai thiet lap ky thuat.
#:   noibat = chiem ca hang, bia lon   thuong = the thuong   gon = nho, xep day
SIZES = ["noibat", "thuong", "gon"]


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    """Apache da xac thuc va dat X-Remote-User (xem <Location /api>)."""
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="chua dang nhap")
    return x_remote_user


def require_editor(username: str = Depends(current_user)) -> str:
    if not is_news_author(username):
        raise HTTPException(status_code=403, detail="ban khong co quyen quan ly thu vien anh")
    return username


# ----------------------------------------------------------------- doc ----
def _meta_path(slug: str) -> str:
    return os.path.join(GALLERY_DIR, slug, "album.json")


def _album_meta(slug: str) -> dict | None:
    try:
        with open(_meta_path(slug), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as exc:
        log.warning("gallery: khong doc duoc album.json cua %s (%s: %s)",
                    slug, type(exc).__name__, exc)
        return None


def _save_meta(slug: str, meta: dict) -> None:
    """Ghi tam roi doi ten: khong bao gio de API doc phai file dang viet do."""
    path = _meta_path(slug)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def _stem_of(name: str) -> str:
    return os.path.splitext(name)[0].lower().replace(" ", "-")


def _thumb_dir(slug: str) -> str:
    return os.path.join(GALLERY_DIR, slug, "thumb")


def _thumbs(slug: str) -> set[str]:
    try:
        return {f[:-4] for f in os.listdir(_thumb_dir(slug)) if f.endswith(".jpg")}
    except OSError:
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


def _thumb_url(slug: str, stem: str, have: set[str]) -> str:
    # Thumb co san thi de Apache serve thang cho nhanh; anh moi thi nho API
    # tao (lan dau cham, sau do da co cache).
    return (f"/media/gallery/{slug}/thumb/{stem}.jpg" if stem in have
            else f"/api/gallery/{slug}/img/{stem}.jpg?s=t")


def _album_card(slug: str, meta: dict, count: int | None = None) -> dict:
    """The album cho trang danh sach.

    `covers` la 4 anh de ghep mosaic. Mot album 1687 anh ma dai dien bang dung
    MOT tam thi phi — nhung van giu `cover` rieng cho cho nao chi co mot o.
    """
    have = _thumbs(slug)
    cover = meta.get("cover") or ""
    picks = [c for c in (meta.get("covers") or []) if c] or ([cover] if cover else [])
    if len(picks) < 4:
        extra = [s for s in sorted(have) if s not in picks]
        picks = picks + extra[: 4 - len(picks)]
    return {
        "slug": slug,
        "title": meta.get("title") or {"vi": slug, "en": slug},
        "desc": meta.get("desc") or {"vi": "", "en": ""},
        "date": meta.get("date") or "",
        "label": meta.get("label") or "khac",
        "size": meta.get("size") if meta.get("size") in SIZES else "thuong",
        "status": meta.get("status") or "public",
        "order": int(meta.get("order") or 0),
        "count": count if count is not None else (meta.get("count") or 0),
        "cover": f"/media/gallery/{slug}/thumb/{cover}.jpg" if cover else "",
        "covers": [_thumb_url(slug, s, have) for s in picks[:4]],
        "featured": [_thumb_url(slug, s, have) for s in (meta.get("featured") or [])[:12]],
    }


def _all_slugs() -> list[str]:
    try:
        return sorted(d for d in os.listdir(GALLERY_DIR)
                      if _SLUG.fullmatch(d) and d not in RESERVED)
    except FileNotFoundError:
        return []


@router.get("")
def gallery_index(username: str = Depends(current_user)) -> dict:
    """Danh sach album, moi nhat truoc.

    Album `draft`/`hidden` chi nguoi co quyen quan ly moi thay — de Marketing
    chuan bi truoc roi mo sau, giong hen gio cua tin tuc.
    """
    can_manage = is_news_author(username)
    albums = []
    for s in _all_slugs():
        m = _album_meta(s)
        if m is None:
            continue
        card = _album_card(s, m, len(_index(s, m)))
        if card["status"] != "public" and not can_manage:
            continue
        albums.append(card)
    albums.sort(key=lambda a: (-a["order"], a["date"], a["slug"]), reverse=True)
    return {"albums": albums, "canManage": can_manage, "labels": LABELS, "sizes": SIZES}


@router.get("/{slug}")
def gallery_album(slug: str, username: str = Depends(current_user)) -> dict:
    """Toan bo anh cua mot album (danh sach lay tu share).

    Tra ca `w`/`h` de luoi masonry giu duoc CHO TRUOC khi anh ve toi — thieu
    no thi bo cuc nhay lien tuc trong luc cuon. Kich thuoc nam trong
    album.json, do viec sinh thumb ghi vao.
    """
    if not _SLUG.fullmatch(slug) or slug in RESERVED:
        raise HTTPException(status_code=404, detail="khong co album nay")
    meta = _album_meta(slug)
    if meta is None:
        raise HTTPException(status_code=404, detail="khong co album nay")
    if (meta.get("status") or "public") != "public" and not is_news_author(username):
        raise HTTPException(status_code=404, detail="khong co album nay")

    have = _thumbs(slug)
    dims: dict[str, dict] = {p["file"]: p for p in meta.get("photos", []) if p.get("file")}
    featured = set(meta.get("featured") or [])

    # Sap theo NGAY CHUP roi moi den ten file. Ten file KHONG di theo ngay:
    # do that tren AVP Cup 2026 — sap theo ten thi ngay 25/05 xen giua 09/05,
    # va mot ngay vo thanh nhieu nhom roi rac khi cuon. Anh khong co EXIF xep
    # xuong cuoi ('' -> 'zzzz') thay vi lan vao giua.
    rows = sorted(_index(slug, meta),
                  key=lambda r: (dims.get(r[0], {}).get("day") or "zzzz", r[0]))

    photos = []
    for stem, orig in rows:
        d = dims.get(stem) or {}
        photos.append({
            "id": stem,
            "thumb": _thumb_url(slug, stem, have),
            "full": f"/api/gallery/{slug}/img/{stem}.jpg",
            "orig": f"/api/gallery/{slug}/orig/{stem}" if orig else "",
            "w": int(d.get("w") or 0),
            "h": int(d.get("h") or 0),
            # Ngay chup (EXIF) hoac ngay sua file, dang YYYY-MM-DD. Rong thi
            # client gom vao nhom "khong ro ngay".
            "day": d.get("day") or "",
            "star": stem in featured,
        })
    return {**_album_card(slug, meta, len(photos)), "photos": photos}


# ------------------------------------------------------------ anh -------
def _render(src_path: str, out_path: str, box: int, quality: int) -> tuple[int, int]:
    """Thu nho anh goc roi ghi vao cache. Tra ve kich thuoc ANH GOC."""
    from PIL import Image, ImageOps          # nap muon: chi gallery moi can
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = f"{out_path}.{os.getpid()}.{threading.get_ident()}.tmp"
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        im.thumbnail((box, box), Image.LANCZOS)
        im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
    os.replace(tmp, out_path)
    return w, h


@router.get("/{slug}/img/{name}")
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


@router.get("/{slug}/orig/{name}")
def gallery_orig(slug: str, name: str,
                 username: str = Depends(current_user)) -> FileResponse:
    """Tai ANH GOC tu share.

    Nguoi ta vao thu vien chu yeu de lay anh cua chinh minh — khong tai duoc
    thi ho xem mot lan roi thoi. Doc thang tu share, KHONG cache: anh goc vai
    MB, dia .136 chi ~19GB.
    """
    stem = name[:-4] if name.lower().endswith(".jpg") else name
    if not _SLUG.fullmatch(slug) or not _STEM.fullmatch(stem) or ".." in stem:
        raise HTTPException(status_code=404, detail="khong co anh nay")
    meta = _album_meta(slug)
    if meta is None:
        raise HTTPException(status_code=404, detail="khong co album nay")
    orig = next((o for st, o in _index(slug, meta) if st == stem and o), None)
    if not orig:
        raise HTTPException(status_code=404, detail="khong co anh goc")
    path = os.path.join(GALLERY_SRC_ROOT, meta.get("src") or "", orig)
    if not os.path.isfile(path):
        raise HTTPException(status_code=503, detail="file server dang khong truy cap duoc")
    return FileResponse(path, filename=orig, media_type="application/octet-stream")


# ======================================================== QUAN LY ALBUM ====
# Router RIENG, va trong main.py phai `include_router(manage_router)` TRUOC
# `include_router(router)`: FastAPI khop route theo thu tu dang ky, de sau thi
# `/api/gallery/manage` roi vao `/{slug}` cua router doc.
manage_router = APIRouter(prefix="/api/gallery/manage", tags=["gallery-manage"])


def _job(slug: str) -> dict:
    with _jobs_lock:
        return dict(_jobs.get(slug) or {"state": "idle"})


def _set_job(slug: str, **kw: Any) -> None:
    with _jobs_lock:
        _jobs.setdefault(slug, {})
        _jobs[slug].update(kw)


def _exif_day(im: Any) -> str:
    """Ngay chup dang YYYY-MM-DD, '' neu anh khong ghi.

    Dung de gom anh theo ngay: mot giai bong da 1687 anh keo dai nhieu ngay,
    khong chia ra thi khong ai tim duoc tran cua minh.
    """
    try:
        ex = im.getexif()
        raw = ex.get(36867) or ex.get(306)     # DateTimeOriginal, DateTime
        if raw and len(str(raw)) >= 10:
            return str(raw)[:10].replace(":", "-")
    except Exception:                          # anh hong exif -> bo qua, khong chet
        pass
    return ""


def _build_thumbs(slug: str) -> None:
    """Sinh thumb cho ca album va ghi kich thuoc + ngay chup vao album.json.

    Chay trong luong nen. Ghi album.json theo tung dot (khong phai tung anh)
    de album 1687 tam khong bien thanh 1687 lan ghi dia.
    """
    from PIL import Image, ImageOps

    meta = _album_meta(slug)
    if meta is None:
        _set_job(slug, state="error", detail="khong co album.json")
        return
    src_dir = os.path.join(GALLERY_SRC_ROOT, meta.get("src") or "")
    if not os.path.isdir(src_dir):
        _set_job(slug, state="error", detail="file server dang khong truy cap duoc")
        return

    _index_cache.pop(slug, None)
    rows = _index(slug, meta)
    out_dir = _thumb_dir(slug)
    os.makedirs(out_dir, exist_ok=True)
    total = len(rows)
    _set_job(slug, state="running", done=0, total=total, detail="", started=time.time())

    def one(item: tuple[str, str]) -> dict | None:
        stem, orig = item
        if not orig:
            return None
        dst = os.path.join(out_dir, f"{stem}.jpg")
        src = os.path.join(src_dir, orig)
        try:
            if os.path.exists(dst):
                # Da co thumb: chi can doc kich thuoc anh GOC + ngay chup.
                # PIL doc LAZY — `.size`/`.getexif()` chi cham phan dau file,
                # khong tai het anh vai MB qua SMB.
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im)
                    w, h = im.size
                    day = _exif_day(im)
            else:
                with Image.open(src) as im:
                    day = _exif_day(im)
                    im = ImageOps.exif_transpose(im).convert("RGB")
                    w, h = im.size
                    im.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
                    tmp = f"{dst}.{os.getpid()}.{threading.get_ident()}.tmp"
                    im.save(tmp, "JPEG", quality=THUMB_Q, optimize=True, progressive=True)
                os.replace(tmp, dst)
            return {"file": stem, "w": w, "h": h, "day": day}
        except Exception as exc:               # mot anh hong khong duoc lam chet ca album
            log.warning("gallery: bo qua %s/%s (%s: %s)", slug, orig, type(exc).__name__, exc)
            return None

    # Chay song song: phan lon thoi gian la CHO SMB tra loi (do that: 1 anh/giay
    # khi chay tuan tu => album 1000 anh mat 17 phut, Marketing khong doi noi).
    # PIL nha GIL luc giai ma JPEG nen luong cung giup ca phan CPU.
    # Giu it luong thoi: nhieu qua thi dap vao file server dung gio lam viec.
    photos: list[dict] = []
    done = 0
    with ThreadPoolExecutor(max_workers=THUMB_WORKERS) as pool:
        # `map` giu DUNG THU TU dau vao — anh trong album.json van theo thu tu
        # ten file, khong phu thuoc luong nao xong truoc.
        for got in pool.map(one, rows):
            if got:
                photos.append(got)
            done += 1
            if done % 25 == 0:
                _set_job(slug, done=done)
            if done % 200 == 0:
                m = _album_meta(slug) or meta
                m["photos"] = photos
                _save_meta(slug, m)

    m = _album_meta(slug) or meta
    m["photos"] = photos
    m["count"] = len(photos)
    if not m.get("cover") and photos:
        m["cover"] = photos[0]["file"]
    _save_meta(slug, m)
    _index_cache.pop(slug, None)
    _set_job(slug, state="done", done=done, total=total)


def _start_job(slug: str) -> None:
    if _job(slug).get("state") == "running":
        raise HTTPException(status_code=409, detail="album nay dang duoc xu ly")
    _set_job(slug, state="running", done=0, total=0)
    threading.Thread(target=_build_thumbs, args=(slug,), daemon=True, name=f"thumb-{slug}").start()


@manage_router.get("/sources")
def manage_sources(path: str = "", username: str = Depends(require_editor)) -> dict:
    """Duyet thu muc tren share de CHON, khong phai go duong dan bang tay.

    Tra ve thu muc con + so anh trong tung cai, va thu muc nao da thanh album.
    """
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="duong dan khong hop le")
    base = os.path.join(GALLERY_SRC_ROOT, path)
    if not os.path.isdir(base):
        raise HTTPException(status_code=503, detail="file server dang khong truy cap duoc")

    taken = {}
    for s in _all_slugs():
        m = _album_meta(s)
        if m and m.get("src"):
            taken[m["src"]] = s

    dirs, images = [], 0
    try:
        with os.scandir(base) as it:
            for e in it:
                if e.name.startswith("."):
                    continue
                if e.is_dir():
                    dirs.append(e.name)
                elif e.name.lower().endswith(_IMG_EXT):
                    images += 1
    except OSError as exc:
        raise HTTPException(status_code=503,
                            detail=f"khong doc duoc share: {type(exc).__name__}") from exc

    out = []
    for name in sorted(dirs):
        rel = f"{path}/{name}" if path else name
        n = 0
        try:
            with os.scandir(os.path.join(base, name)) as it2:
                n = sum(1 for e in it2 if e.is_file() and e.name.lower().endswith(_IMG_EXT))
        except OSError:
            n = -1                              # khong doc duoc, van cho hien de biet co thu muc
        out.append({"name": name, "path": rel, "images": n, "album": taken.get(rel, "")})
    return {"path": path, "images": images, "album": taken.get(path, ""), "dirs": out}


@manage_router.get("/albums")
def manage_list(username: str = Depends(require_editor)) -> dict:
    """Danh sach album kem trang thai viec sinh thumb."""
    out = []
    for s in _all_slugs():
        m = _album_meta(s)
        if m is None:
            continue
        card = _album_card(s, m, len(_index(s, m)))
        card["src"] = m.get("src") or ""
        card["job"] = _job(s)
        card["thumbs"] = len(_thumbs(s))
        out.append(card)
    out.sort(key=lambda a: (-a["order"], a["date"], a["slug"]), reverse=True)
    return {"albums": out, "labels": LABELS, "sizes": SIZES}


@manage_router.post("/albums")
def manage_create(payload: dict = Body(...), username: str = Depends(require_editor)) -> dict:
    """Tao album tu mot thu muc tren share roi sinh thumb o luong nen."""
    slug = (payload.get("slug") or "").strip().lower()
    src = (payload.get("src") or "").strip()
    if not _SLUG.fullmatch(slug) or slug in RESERVED:
        raise HTTPException(status_code=400, detail="slug chi gom chu thuong, so va dau -")
    if not src or ".." in src or src.startswith("/"):
        raise HTTPException(status_code=400, detail="duong dan nguon khong hop le")
    if os.path.exists(_meta_path(slug)):
        raise HTTPException(status_code=409, detail="da co album voi slug nay")
    if not os.path.isdir(os.path.join(GALLERY_SRC_ROOT, src)):
        raise HTTPException(status_code=400, detail="thu muc nguon khong ton tai tren share")

    meta = {
        "slug": slug,
        "title": payload.get("title") or {"vi": slug, "en": slug},
        "desc": payload.get("desc") or {"vi": "", "en": ""},
        "date": str(payload.get("date") or ""),
        "label": payload.get("label") if payload.get("label") in LABELS else "khac",
        "size": payload.get("size") if payload.get("size") in SIZES else "thuong",
        # Tao ra la NHAP: Marketing chuan bi xong moi mo, giong hen gio tin tuc.
        "status": "draft",
        "order": 0,
        "cover": "",
        "covers": [],
        "featured": [],
        "count": 0,
        "src": src,
        "createdBy": username,
    }
    _save_meta(slug, meta)
    _start_job(slug)
    return {"ok": True, "slug": slug}


@manage_router.put("/albums/{slug}")
def manage_update(slug: str, payload: dict = Body(...),
                  username: str = Depends(require_editor)) -> dict:
    """Sua ten/mo ta/nam/nhan/bia/trang thai/thu tu — khong dong vao anh."""
    if not _SLUG.fullmatch(slug) or slug in RESERVED:
        raise HTTPException(status_code=404, detail="khong co album nay")
    meta = _album_meta(slug)
    if meta is None:
        raise HTTPException(status_code=404, detail="khong co album nay")

    have = _thumbs(slug) | {p.get("file") for p in meta.get("photos", [])}
    for k in ("title", "desc"):
        if isinstance(payload.get(k), dict):
            meta[k] = {"vi": str(payload[k].get("vi") or ""), "en": str(payload[k].get("en") or "")}
    if "date" in payload:
        meta["date"] = str(payload["date"] or "")
    if payload.get("label") in LABELS:
        meta["label"] = payload["label"]
    if payload.get("size") in SIZES:
        meta["size"] = payload["size"]
    if payload.get("status") in ("public", "draft", "hidden"):
        meta["status"] = payload["status"]
    if "order" in payload:
        try:
            meta["order"] = int(payload["order"])
        except (TypeError, ValueError):
            pass
    # Anh bia / anh noi bat: chi nhan ten anh CO THAT trong album — chuoi tu
    # client di thang vao duong dan file nen phai loc.
    if "cover" in payload:
        c = str(payload["cover"] or "")
        meta["cover"] = c if c in have else ""
    for k in ("covers", "featured"):
        if isinstance(payload.get(k), list):
            meta[k] = [str(x) for x in payload[k] if str(x) in have][:12]
    _save_meta(slug, meta)
    return {"ok": True, **_album_card(slug, meta)}


@manage_router.post("/albums/{slug}/reindex")
def manage_reindex(slug: str, username: str = Depends(require_editor)) -> dict:
    """Quet lai share: sinh thumb cho anh moi, cap nhat kich thuoc + ngay chup."""
    if not _SLUG.fullmatch(slug) or _album_meta(slug) is None:
        raise HTTPException(status_code=404, detail="khong co album nay")
    _start_job(slug)
    return {"ok": True}


@manage_router.get("/albums/{slug}/job")
def manage_job(slug: str, username: str = Depends(require_editor)) -> dict:
    if not _SLUG.fullmatch(slug):
        raise HTTPException(status_code=404, detail="khong co album nay")
    return _job(slug)


@manage_router.delete("/albums/{slug}")
def manage_delete(slug: str, username: str = Depends(require_editor)) -> dict:
    """Xoa album khoi portal.

    CHI xoa thumb + album.json + cache cua portal. ANH GOC TREN SHARE KHONG BI
    DONG TOI — share mount read-only, va do la kho anh that cua cong ty.
    """
    if not _SLUG.fullmatch(slug) or slug in RESERVED:
        raise HTTPException(status_code=404, detail="khong co album nay")
    d = os.path.join(GALLERY_DIR, slug)
    if not os.path.isdir(d):
        raise HTTPException(status_code=404, detail="khong co album nay")
    shutil.rmtree(d, ignore_errors=True)
    shutil.rmtree(os.path.join(GALLERY_CACHE, slug), ignore_errors=True)
    _index_cache.pop(slug, None)
    with _jobs_lock:
        _jobs.pop(slug, None)
    return {"ok": True}


# =================================================== ANH CHO COT BEN /feed ==
#: So anh tren o mosaic cua /feed.
RAIL_COUNT = 5


def public_albums() -> list[tuple[str, dict]]:
    """Cac album CONG KHAI, moi nhat truoc.

    BAT BUOC loc theo `status`: album nhap la thu Marketing dang chuan bi, lot
    ra cot ben cua /feed thi ca cong ty thay truoc khi ho kip mo.
    """
    out = []
    for slug in _all_slugs():
        m = _album_meta(slug)
        if m is None or (m.get("status") or "public") != "public":
            continue
        out.append((slug, m))
    out.sort(key=lambda x: (str(x[1].get("date") or ""), x[0]), reverse=True)
    return out


def rail_photos(count: int = RAIL_COUNT) -> dict:
    """Anh cho o mosaic cua /feed.

    Uu tien ANH NOI BAT do Marketing ghim (`featured`) — do la nhung tam ho
    chon de dai dien cho tap doan. Chua ghim tam nao thi lui ve lay ngau nhien
    trong album moi nhat, moi lan mo trang mot bo khac.

    Ham nay o gallery.py chu khong o rail.py de MOT cho quyet dinh album nao
    la cong khai — va de test khong phai keo theo ca news/htmlclean.
    """
    import random

    albums = public_albums()
    if not albums:
        return {"slug": "", "title": {"vi": "", "en": ""}, "count": 0, "photos": []}

    def url(sl: str, st: str) -> dict:
        return {"thumb": f"/media/gallery/{sl}/thumb/{st}.jpg",
                "full": f"/api/gallery/{sl}/img/{st}.jpg"}

    starred: list[tuple[str, str]] = []
    for slug, meta in albums:
        have = _thumbs(slug)
        starred += [(slug, s) for s in (meta.get("featured") or []) if s in have]

    slug, meta = albums[0]
    stems = sorted(_thumbs(slug))
    title = meta.get("title") or {"vi": slug, "en": slug}

    if starred:
        pick = random.sample(starred, min(count, len(starred)))
        return {"slug": slug, "title": title, "count": len(stems),
                "photos": [url(sl, st) for sl, st in pick]}

    pick2 = random.sample(stems, min(count, len(stems))) if stems else []
    return {"slug": slug, "title": title, "count": len(stems),
            "photos": [url(slug, s) for s in pick2]}
