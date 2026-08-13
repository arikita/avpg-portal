"""Ho so ca nhan (Account Profile) — AVP Portal.

Mot trang ho so gop tu BA nguon, moi nguon giu dung vai tro cua no:

  AD       — ho ten, chuc danh, phong ban, email, so may le, ngay tao tai khoan.
             DOC MOI LAN, khong nhan ban sang Postgres => sua tren DC la portal
             theo, khong bao gio lech.
  Postgres — phan NGUOI DUNG TU DAT (anh dai dien, anh bia, gioi thieu, so
             thich, tong mau) + hoat dong tren trang tin (bai, binh luan,
             cam xuc) de dung dong thoi gian & thong ke.
  Workit   — ho so nhan su (app/workit.py). CHUA CAU HINH THI BO QUA, trang
             van day du. Xem huong dan cau hinh trong chinh file do.

QUYEN: ai dang nhap cung XEM duoc ho so nguoi khac (giong danh ba), nhung
SUA thi chi sua duoc cua chinh minh — khong co duong nao ghi ho so nguoi khac,
ke ca thanh vien IS. Danh tinh lay tu header X-Remote-User do Apache dat
(xem main.py: Apache BAT BUOC xoa header nay tu client truoc khi dat lai).

AN TOAN NOI DUNG: gioi thieu / so thich la VAN BAN THUAN — the HTML bi go bo
o server va frontend render bang interpolation cua Angular, khong innerHTML.
Anh tai len duoc GIAI MA VA MA HOA LAI bang Pillow, nen file .jpg giau kem
script/EXIF payload khong con gi sau khi luu.
"""
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, UploadFile

from . import workit
from .ad import get_user, list_directory
from .images import MAX_IMAGE, drop, read_upload, save_jpeg

router = APIRouter(prefix="/api/profile", tags=["profile"])
avatar_router = APIRouter(prefix="/api/avatars", tags=["profile"])

DSN = os.environ.get("DATABASE_URL", "")
MEDIA_DIR = os.environ.get("NEWS_MEDIA_DIR", "/var/www/avp-portal-media")
PROFILE_DIR = os.path.join(MEDIA_DIR, "profile")

_SAFE = re.compile(r"[A-Za-z0-9._-]{1,64}")
PROFILE_URL = "/media/profile"

AVATAR_PX = 512          # vuong, cat giua
COVER_W, COVER_H = 1800, 620

MAX_HEADLINE = 120
MAX_BIO = 1000
MAX_INTERESTS = 12
MAX_INTEREST_LEN = 28

# Tong mau ho so tu chon. Danh sach DONG — khong nhan ma mau tu do tu nguoi
# dung (tranh chen chuoi CSS la vao thuoc tinh style).
ACCENTS = {"brand", "teal", "violet", "coral", "amber", "green", "cyan", "rose"}

COLLEAGUE_LIMIT = 12
ACTIVITY_LIMIT = 20

_TAG = re.compile(r"<[^>]*>")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


def _plain(s: Any, limit: int) -> str:
    """Van ban thuan: go the HTML, bo ky tu dieu khien, cat theo gioi han."""
    text = s if isinstance(s, str) else ""
    text = _CTRL.sub("", _TAG.sub("", text)).replace("\r\n", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:limit]


# ------------------------------------------------------------------ ho so --
EMPTY = {"headline": "", "bio": "", "avatar": "", "cover": "",
         "accent": "", "interests": [], "workitKey": ""}


def _row(conn, username: str) -> dict:
    r = conn.execute(
        "SELECT headline, bio, avatar, cover, accent, interests, workit_key "
        "FROM user_profile WHERE username = %s", (username,)).fetchone()
    if not r:
        return dict(EMPTY)
    return {"headline": r[0], "bio": r[1], "avatar": r[2], "cover": r[3],
            "accent": r[4], "interests": r[5] or [], "workitKey": r[6]}


def _years_since(raw: str) -> float | None:
    """AD whenCreated dang 20230904071233.0Z -> so nam da qua."""
    m = re.match(r"(\d{14})", raw or "")
    if not m:
        return None
    try:
        then = datetime.strptime(m.group(1), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return (datetime.now(timezone.utc) - then).days / 365.25


def _joined_iso(raw: str) -> str:
    m = re.match(r"(\d{14})", raw or "")
    if not m:
        return ""
    try:
        return datetime.strptime(m.group(1), "%Y%m%d%H%M%S").replace(
            tzinfo=timezone.utc).date().isoformat()
    except ValueError:
        return ""


# ---------------------------------------------------------------- thong ke --
STATS_SQL = """
WITH mine AS (
  SELECT id FROM news_post WHERE author = %(u)s AND status = 'published'
)
SELECT (SELECT count(*) FROM mine),
       (SELECT count(*) FROM news_view    WHERE post_id IN (SELECT id FROM mine)),
       (SELECT count(*) FROM news_reaction WHERE post_id IN (SELECT id FROM mine)),
       (SELECT count(*) FROM news_comment WHERE post_id IN (SELECT id FROM mine)
          AND deleted = false AND author <> %(u)s),
       (SELECT count(*) FROM news_comment WHERE author = %(u)s AND deleted = false),
       (SELECT count(*) FROM news_reaction WHERE username = %(u)s)
"""


def _stats(conn, username: str) -> dict:
    posts, views, rx_in, cm_in, comments, rx_out = conn.execute(
        STATS_SQL, {"u": username}).fetchone()
    return {"posts": posts or 0, "viewsReceived": views or 0,
            "reactionsReceived": rx_in or 0, "commentsReceived": cm_in or 0,
            "comments": comments or 0, "reactionsGiven": rx_out or 0}


def _badges(stats: dict, years: float | None) -> list[dict]:
    """Huy hieu suy ra tu du lieu that — khong co bang nao de gan tay."""
    out: list[dict] = []
    if years is not None:
        if years < 0.25:
            out.append({"id": "newcomer", "icon": "sparkles", "tone": "teal",
                        "label": {"vi": "Người mới", "en": "New here"}})
        for mark in (10, 5, 3, 1):
            if years >= mark:
                out.append({"id": f"tenure{mark}", "icon": "award", "tone": "amber",
                            "label": {"vi": f"{mark} năm gắn bó",
                                      "en": f"{mark}-year milestone"}})
                break
    if stats["posts"] >= 10:
        out.append({"id": "writer", "icon": "newspaper", "tone": "violet",
                    "label": {"vi": "Cây bút", "en": "Prolific writer"}})
    elif stats["posts"] >= 1:
        out.append({"id": "author", "icon": "edit", "tone": "brand",
                    "label": {"vi": "Tác giả", "en": "Author"}})
    if stats["reactionsReceived"] >= 50:
        out.append({"id": "loved", "icon": "heart", "tone": "rose",
                    "label": {"vi": "Được yêu thích", "en": "Well loved"}})
    if stats["comments"] >= 20:
        out.append({"id": "talker", "icon": "message", "tone": "cyan",
                    "label": {"vi": "Tích cực thảo luận", "en": "Active voice"}})
    if stats["viewsReceived"] >= 500:
        out.append({"id": "reach", "icon": "eye", "tone": "green",
                    "label": {"vi": "Sức lan toả", "en": "Wide reach"}})
    return out


# ------------------------------------------------------------ dong nghiep --
def _colleagues(department: str, me: str) -> list[dict]:
    """Nguoi cung phong ban, lay tu danh ba AD (da cache 15 phut trong ad.py).

    LUU Y: danh ba chi gom nguoi CO SO MAY LE, nen day khong phai toan bo
    phong ban — dung "so nguoi trong danh ba" chu dung noi "so nhan su".
    """
    if not department:
        return []
    try:
        data = list_directory()
    except Exception:
        return []
    for d in data.get("departments", []):
        if d.get("name") != department:
            continue
        out = [{"username": c.get("username", ""), "name": c.get("name", ""),
                "title": c.get("title", "")}
               for c in d.get("contacts", [])
               if c.get("username") and c.get("username").lower() != me.lower()]
        return out[:COLLEAGUE_LIMIT]
    return []


# --------------------------------------------------------- dong thoi gian --
ACTIVITY_SQL = """
SELECT kind, post_id, title, snippet, emoji, at FROM (
  SELECT 'post'::text AS kind, p.id AS post_id, p.title_vi AS title,
         NULL::text AS snippet, NULL::text AS emoji,
         COALESCE(p.published_at, p.created_at) AS at
    FROM news_post p
   WHERE p.author = %(u)s AND p.status = 'published'
  UNION ALL
  SELECT 'comment', c.post_id, p.title_vi, left(c.body, 180), NULL, c.created_at
    FROM news_comment c JOIN news_post p ON p.id = c.post_id
   WHERE c.author = %(u)s AND c.deleted = false AND p.status = 'published'
  UNION ALL
  SELECT 'reaction', r.post_id, p.title_vi, NULL, r.emoji, r.created_at
    FROM news_reaction r JOIN news_post p ON p.id = r.post_id
   WHERE r.username = %(u)s AND p.status = 'published'
) t
ORDER BY at DESC LIMIT %(lim)s OFFSET %(off)s
"""


def _activity(conn, username: str, offset: int = 0,
              limit: int = ACTIVITY_LIMIT) -> tuple[list[dict], bool]:
    """(cac muc hoat dong, con nua khong) — lay du limit+1 de biet co trang sau."""
    rows = conn.execute(ACTIVITY_SQL,
                        {"u": username, "lim": limit + 1, "off": offset}).fetchall()
    more = len(rows) > limit
    items = [{"kind": k, "postId": pid, "title": title or "",
              "snippet": (snippet or "").strip(), "emoji": emoji or "",
              "at": at.isoformat()}
             for (k, pid, title, snippet, emoji, at) in rows[:limit]]
    return items, more


# ------------------------------------------------------------------- doc --
def _view(username: str, viewer: str) -> dict:
    """Ho so day du cua mot nguoi, nhin tu goc do cua `viewer`."""
    info = get_user(username)
    if info is None:
        raise HTTPException(status_code=404, detail="khong tim thay nguoi dung nay")

    is_me = username.lower() == viewer.lower()
    with _conn() as conn:
        prof = _row(conn, username)
        stats = _stats(conn, username)
        items, more = _activity(conn, username)

    years = _years_since(info.get("whenCreated", ""))
    dept = (info.get("department") or "").strip()
    out = {
        "username": username,
        "isMe": is_me,
        "fullName": info.get("fullName") or username,
        "title": info.get("title", ""),
        "department": dept,
        "mail": info.get("mail", ""),
        "ext": info.get("telephoneNumber", ""),
        "mobile": info.get("mobile", ""),
        "office": info.get("physicalDeliveryOfficeName", ""),
        "joinedAt": _joined_iso(info.get("whenCreated", "")),
        "tenureYears": round(years, 1) if years is not None else None,
        "headline": prof["headline"],
        "bio": prof["bio"],
        "avatar": prof["avatar"],
        "cover": prof["cover"],
        "accent": prof["accent"],
        "interests": prof["interests"],
        "stats": stats,
        "badges": _badges(stats, years),
        "colleagues": _colleagues(dept, username),
        "activity": items,
        "activityMore": more,
    }
    # Nhan su tu Workit: mac dinh chi hien tren ho so cua chinh minh
    # (WORKIT_PROFILE_PUBLIC=1 de mo cho dong nghiep xem nhau).
    if is_me or workit.PUBLIC:
        out["employment"] = workit.fields(username, prof["workitKey"],
                                          info.get("mail", ""))
    else:
        out["employment"] = None
    return out


@router.get("/{username}")
def get_profile(username: str, viewer: str = Depends(current_user)) -> dict:
    if username == "me":
        username = viewer
    if not _SAFE.fullmatch(username):
        raise HTTPException(status_code=404, detail="khong tim thay nguoi dung nay")
    return _view(username, viewer)


@router.get("/{username}/activity")
def get_activity(username: str, offset: int = 0,
                 viewer: str = Depends(current_user)) -> dict:
    """Tai them dong thoi gian (nut 'Xem them')."""
    if username == "me":
        username = viewer
    if not _SAFE.fullmatch(username):
        raise HTTPException(status_code=404, detail="khong tim thay nguoi dung nay")
    with _conn() as conn:
        items, more = _activity(conn, username, max(0, min(offset, 5000)))
    return {"activity": items, "activityMore": more}


# ------------------------------------------------------------------- ghi --
@router.put("")
def save_profile(payload: dict = Body(...),
                 username: str = Depends(current_user)) -> dict:
    """Luu ho so CUA CHINH MINH. Khong co endpoint nao ghi ho so nguoi khac."""
    headline = _plain(payload.get("headline"), MAX_HEADLINE)
    bio = _plain(payload.get("bio"), MAX_BIO)
    accent = (payload.get("accent") or "").strip().lower()
    if accent not in ACCENTS:
        accent = ""
    raw = payload.get("interests")
    interests: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            tag = _plain(item, MAX_INTEREST_LEN).replace("\n", " ").strip()
            if tag and tag.lower() not in {t.lower() for t in interests}:
                interests.append(tag)
            if len(interests) >= MAX_INTERESTS:
                break

    with _conn() as conn:
        conn.execute(
            "INSERT INTO user_profile (username, headline, bio, accent, interests) "
            "VALUES (%s,%s,%s,%s,%s) ON CONFLICT (username) DO UPDATE SET "
            "headline = EXCLUDED.headline, bio = EXCLUDED.bio, "
            "accent = EXCLUDED.accent, interests = EXCLUDED.interests, "
            "updated_at = now()",
            (username, headline, bio, accent,
             json.dumps(interests, ensure_ascii=False)))
        conn.commit()
    return _view(username, username)


# ------------------------------------------------------------------ anh --
@router.post("/photo/{kind}")
def upload_photo(kind: str, file: UploadFile = File(...),
                 username: str = Depends(current_user)) -> dict:
    """Doi anh dai dien / anh bia cua CHINH MINH."""
    if kind not in ("avatar", "cover"):
        raise HTTPException(status_code=404, detail="khong co muc nay")
    data = read_upload(file.file, MAX_IMAGE)
    url = (save_jpeg(data, PROFILE_DIR, PROFILE_URL, square=AVATAR_PX) if kind == "avatar"
           else save_jpeg(data, PROFILE_DIR, PROFILE_URL, box=(COVER_W, COVER_H)))
    col = "avatar" if kind == "avatar" else "cover"
    with _conn() as conn:
        old = conn.execute(f"SELECT {col} FROM user_profile WHERE username = %s",
                           (username,)).fetchone()
        conn.execute(
            f"INSERT INTO user_profile (username, {col}) VALUES (%s,%s) "
            f"ON CONFLICT (username) DO UPDATE SET {col} = EXCLUDED.{col}, "
            "updated_at = now()", (username, url))
        conn.commit()
    if old:
        drop(old[0], PROFILE_DIR, PROFILE_URL)
    _avatars_cache[0] = 0.0          # co anh moi -> lam moi ban do avatar
    return {"url": url, "kind": kind}


@router.delete("/photo/{kind}")
def delete_photo(kind: str, username: str = Depends(current_user)) -> dict:
    if kind not in ("avatar", "cover"):
        raise HTTPException(status_code=404, detail="khong co muc nay")
    col = "avatar" if kind == "avatar" else "cover"
    with _conn() as conn:
        old = conn.execute(f"SELECT {col} FROM user_profile WHERE username = %s",
                           (username,)).fetchone()
        conn.execute(f"UPDATE user_profile SET {col} = '', updated_at = now() "
                     "WHERE username = %s", (username,))
        conn.commit()
    if old:
        drop(old[0], PROFILE_DIR, PROFILE_URL)
    _avatars_cache[0] = 0.0
    return {"ok": True, "kind": kind}


# --------------------------------------------------------- ban do avatar --
# Trang tin hien avatar o rat nhieu cho (tac gia, binh luan, facepile). Thay vi
# hoi tung nguoi mot, tra ve MOT ban do {username: duong dan anh} cho nhung ai
# DA tai anh len — bang thuong chi vai chuc dong nen rat nhe.
_avatars_cache: list = [0.0, {}]
AVATARS_TTL = 120


@avatar_router.get("")
def avatars(username: str = Depends(current_user)) -> dict:
    if time.time() - _avatars_cache[0] < AVATARS_TTL:
        return {"avatars": _avatars_cache[1]}
    with _conn() as conn:
        rows = conn.execute("SELECT username, avatar FROM user_profile "
                            "WHERE avatar <> ''").fetchall()
    data = {u: a for u, a in rows}
    _avatars_cache[0], _avatars_cache[1] = time.time(), data
    return {"avatars": data}
