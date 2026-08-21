"""Cot ben cua trang Doi song (/feed).

MOT endpoint tra ve du do cho ca hai ranh: the ca nhan, anh su kien, ai dang
online, tin moi, binh chon dang mo, thanh vien moi. Gop lai de trang chi ban
MOT request thay vi sau, va de moi phan tu tu bao ve minh: mot nguon chet
(share NAS chua mount, AD cham, Workit chua co login) chi lam MOT o trong,
khong keo sap ca cot.

Khong co bang moi nao: tat ca doc tu nguon dang chay san.
"""
from __future__ import annotations

import os
import random
import time
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException

from . import ad, news, profile as prof

router = APIRouter(prefix="/api/rail", tags=["rail"])

DSN = os.environ.get("DATABASE_URL", "")
GALLERY_DIR = os.environ.get("GALLERY_DIR", "/var/www/avp-portal-media/gallery")
PRESENCE_TTL = 75          # giong chat.py: thay trong 75s = dang mo portal
PHOTO_COUNT = 5            # so anh tren o mosaic
ONLINE_LIMIT = 14
NEWS_LIMIT = 3
NEWCOMER_DAYS = 60
_photo_cache: dict[str, tuple[float, str, list[str]]] = {}
PHOTO_TTL = 900


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


# ------------------------------------------------------------------ anh --
def _album_slug() -> str:
    """Album moi nhat (thu muc co album.json, ten thu muc = slug)."""
    try:
        slugs = sorted(d for d in os.listdir(GALLERY_DIR)
                       if os.path.isfile(os.path.join(GALLERY_DIR, d, "album.json")))
    except OSError:
        return ""
    return slugs[-1] if slugs else ""


def _thumb_stems(slug: str) -> list[str]:
    """Ten anh DA co thumb tren dia — khong dung toi share NAS nen luon nhanh."""
    hit = _photo_cache.get(slug)
    if hit and time.time() - hit[0] < PHOTO_TTL:
        return hit[2]
    try:
        stems = sorted(f[:-4] for f in os.listdir(os.path.join(GALLERY_DIR, slug, "thumb"))
                       if f.endswith(".jpg"))
    except OSError:
        stems = []
    _photo_cache[slug] = (time.time(), slug, stems)
    return stems


def _album_title(slug: str) -> dict:
    import json
    try:
        with open(os.path.join(GALLERY_DIR, slug, "album.json"), encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, ValueError):
        return {"vi": slug, "en": slug}
    return meta.get("title") or {"vi": slug, "en": slug}


def _photos() -> dict:
    """Vai anh NGAU NHIEN trong album moi nhat — moi lan mo trang mot bo khac."""
    slug = _album_slug()
    if not slug:
        return {"slug": "", "title": {"vi": "", "en": ""}, "count": 0, "photos": []}
    stems = _thumb_stems(slug)
    pick = random.sample(stems, min(PHOTO_COUNT, len(stems))) if stems else []
    return {
        "slug": slug,
        "title": _album_title(slug),
        "count": len(stems),
        "photos": [{"thumb": f"/media/gallery/{slug}/thumb/{s}.jpg",
                    "full": f"/api/gallery/{slug}/img/{s}.jpg"} for s in pick],
    }


# --------------------------------------------------------------- online --
def _online(conn, me: str) -> list[dict]:
    rows = conn.execute(
        "SELECT p.username, COALESCE(u.avatar, '') FROM chat_presence p "
        "LEFT JOIN user_profile u ON u.username = p.username "
        f"WHERE p.last_seen > now() - interval '{PRESENCE_TTL} seconds' "
        "AND p.username <> %s ORDER BY p.last_seen DESC LIMIT %s",
        (me, ONLINE_LIMIT)).fetchall()
    out = []
    for username, avatar in rows:
        info = ad.get_user(username)          # co cache 5 phut trong ad.py
        if info is None:
            continue
        out.append({"username": username,
                    "name": info.get("fullName") or username,
                    "title": info.get("title", ""),
                    "avatar": avatar})
    return out


# ------------------------------------------------------------- tin tuc --
def _news(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT id, title_vi, title_en, cover, category, "
        "       COALESCE(published_at, created_at) "
        "FROM news_post WHERE status = 'published' "
        "ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC LIMIT %s",
        (NEWS_LIMIT,)).fetchall()
    return [{"id": r[0], "title": {"vi": r[1], "en": r[2] or r[1]},
             "cover": r[3], "category": r[4], "publishedAt": r[5].isoformat()}
            for r in rows]


# ---------------------------------------------------------- binh chon --
def _poll(conn, me: str) -> dict | None:
    """Cau hoi binh chon con mo, moi nhat — bo phieu ngay tren cot ben."""
    row = conn.execute(
        "SELECT p.id, p.question, p.multi, p.allow_add, p.anonymous, p.closes_at, "
        "       n.id, n.title_vi, n.title_en "
        "FROM news_poll p JOIN news_post n ON n.id = p.post_id "
        "WHERE n.status = 'published' AND (p.closes_at IS NULL OR p.closes_at > now()) "
        "ORDER BY p.id DESC LIMIT 1").fetchone()
    if not row:
        return None
    poll = news._poll_row(conn, row[:6], me)
    return {"postId": row[6], "postTitle": {"vi": row[7], "en": row[8] or row[7]},
            "poll": poll}


# ------------------------------------------------------- thanh vien moi --
def _newcomers() -> list[dict]:
    try:
        return ad.recent_accounts(NEWCOMER_DAYS)
    except Exception:
        return []


# ------------------------------------------------------------ the ca nhan --
def _me(conn, me: str) -> dict:
    info = ad.get_user(me) or {}
    p = prof._row(conn, me)
    stats = prof._stats(conn, me)
    years = prof._years_since(info.get("whenCreated", ""))
    wall_posts, wall_rx = conn.execute(
        "SELECT (SELECT count(*) FROM wall_post WHERE author = %(u)s AND deleted = false), "
        "       (SELECT count(*) FROM wall_reaction r JOIN wall_post w ON w.id = r.post_id "
        "        WHERE w.author = %(u)s)", {"u": me}).fetchone()
    return {
        "username": me,
        "fullName": info.get("fullName") or me,
        "title": info.get("title", ""),
        "department": (info.get("department") or "").strip(),
        "avatar": p["avatar"],
        "cover": p["cover"],
        "headline": p["headline"],
        "joinedAt": prof._joined_iso(info.get("whenCreated", "")),
        "tenureYears": round(years, 1) if years is not None else None,
        "badges": prof._badges(stats, years)[:3],
        "posts": (wall_posts or 0) + stats["posts"],
        "reactions": (wall_rx or 0) + stats["reactionsReceived"],
    }


@router.get("")
def rail(me: str = Depends(current_user)) -> dict:
    """Tat ca noi dung hai cot ben cua /feed. Phan nao loi thi tra rong."""
    out: dict = {"me": None, "photos": None, "online": [], "news": [],
                 "poll": None, "newcomers": [], "birthdays": []}
    try:
        with _conn() as conn:
            for key, fn in (("me", lambda: _me(conn, me)),
                            ("online", lambda: _online(conn, me)),
                            ("news", lambda: _news(conn)),
                            ("poll", lambda: _poll(conn, me))):
                try:
                    out[key] = fn()
                except Exception:
                    pass                      # o do de trong, cot van dung
    except Exception:
        pass
    try:
        out["photos"] = _photos()
    except Exception:
        pass
    out["newcomers"] = _newcomers()
    return out
