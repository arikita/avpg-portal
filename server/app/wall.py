"""Tuong ca nhan tren trang ho so — AVP Portal.

QUYEN (user chot 13/08/2026):
  dang bai   — CHI chu ho so, tren tuong CUA CHINH MINH.
  sua bai    — tac gia bai do.
  xoa bai    — tac gia, chu tuong, hoac IS (kiem duyet).
  cam xuc    — ai dang nhap cung duoc, moi nguoi mot cam xuc/bai.
  binh luan  — ai dang nhap cung duoc; xoa duoc boi nguoi viet, chu tuong, IS.

NOI DUNG LA VAN BAN THUAN (khong phai HTML nhu bai bao trang tin): the HTML bi
go o server, frontend render bang interpolation cua Angular. Duong dan trong
chu do frontend tach ra thanh link — KHONG co duong nao chen HTML vao trang.
"""
from __future__ import annotations

import os
import re
from typing import Any

import psycopg
from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, UploadFile

from .ad import (can_delete_wall_comment, can_manage_wall_post, get_user,
                 is_editor, list_directory)
from .images import MAX_IMAGE, drop, read_upload, save_jpeg
from .news import _queue_push          # dung lai duong Web Push da co
from .telemetry import bump_metric

router = APIRouter(prefix="/api/wall", tags=["wall"])
# Bang tin chung: KHONG dat duoi /api/wall vi se dam vao /api/wall/{owner}
# (duong dan "feed" se bi hieu la ten mot nguoi).
feed_router = APIRouter(prefix="/api/feed", tags=["wall"])

DSN = os.environ.get("DATABASE_URL", "")
MEDIA_DIR = os.environ.get("NEWS_MEDIA_DIR", "/var/www/avp-portal-media")
WALL_DIR = os.path.join(MEDIA_DIR, "wall")
WALL_URL = "/media/wall"
WALL_BOX = (1600, 1600)

EMOJIS = ["\U0001F44D", "❤️", "\U0001F604", "\U0001F389", "\U0001F44F"]
MAX_BODY = 3000
MAX_COMMENT = 1500
PAGE = 10

# Tai khoan chay kiem thu tu dong (Playwright / smoke test). Bai cua ho KHONG
# duoc len bang tin chung: /feed gop bai tuong cua MOI NGUOI, nen kich ban
# "dang bai roi xoa" chay 30 phut/lan se rai bai test cho ca cong ty nhin thay
# trong khoang giua hai buoc. Da co tien le phai don 8 bai claude-demo-* +
# 7 bai tin TEST ngay 20/08/2026.
# De TRONG = khong loc ai (mac dinh hien nay).
TEST_ACCOUNTS = [u.strip().lower() for u in
                 os.environ.get("TEST_ACCOUNTS", "").split(",") if u.strip()]
# Bai "nong" co the co hang tram binh luan; tra het kem theo moi bai trong
# trang bang tin lam phinh ca payload lan so DOM node. Chi kem 3 cai MOI NHAT,
# phan con lai lay rieng qua GET /{pid}/comments khi nguoi dung bam "Xem them".
COMMENT_PREVIEW = 3

_SAFE = re.compile(r"[A-Za-z0-9._-]{1,64}")
_TAG = re.compile(r"<[^>]*>")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


def _plain(s: Any, limit: int) -> str:
    text = s if isinstance(s, str) else ""
    text = _CTRL.sub("", _TAG.sub("", text)).replace("\r\n", "\n")
    return re.sub(r"\n{3,}", "\n\n", text).strip()[:limit]


def _name_of(username: str) -> str:
    return (get_user(username) or {}).get("fullName") or username


def _image_url(raw: Any) -> str:
    """Chi nhan duong dan anh do CHINH endpoint upload cua tuong sinh ra."""
    url = raw if isinstance(raw, str) else ""
    return url if re.fullmatch(rf"{WALL_URL}/[0-9a-f]{{32}}\.jpg", url) else ""


# --------------------------------------------------------------- doc bai --
POST_COLS = ("id, owner, author, author_name, body, image, created_at, edited_at")


def _post(r, rx: dict, comments: dict, viewer: str, moderator: bool) -> dict:
    pid, owner, author, aname, body, image, created, edited = r
    cm = comments.get(pid) or {"items": [], "total": 0}
    return {
        "id": pid, "owner": owner, "author": author, "authorName": aname or author,
        "body": body, "image": image,
        "createdAt": created.isoformat(),
        "editedAt": edited.isoformat() if edited else None,
        "reactions": rx.get(pid, {"counts": {}, "mine": None, "total": 0, "faces": []}),
        "comments": cm["items"],
        # Tong so binh luan THAT — `comments` o tren co the moi la 3 cai dau.
        "commentTotal": cm["total"],
        # Luat 25/08/2026: bai tren Doi song thuoc ve NGUOI VIET. Chi tac gia
        # co toan quyen (sua, xoa, xoa binh luan tren bai minh); rieng phong
        # Information System (IT) toan quyen o moi noi.
        #
        # Truoc day CHU TUONG (`owner`) cung xoa duoc bai nguoi khac dang len
        # tuong minh. Da bo theo yeu cau — xem ghi chu trong CLAUDE.md.
        "canEdit": can_manage_wall_post(viewer, author),
        "canDelete": can_manage_wall_post(viewer, author),
    }


def _reactions(conn, ids: list[int], viewer: str) -> dict:
    out: dict[int, dict] = {}
    if not ids:
        return out
    for pid, emoji, cnt in conn.execute(
            "SELECT post_id, emoji, count(*) FROM wall_reaction "
            "WHERE post_id = ANY(%s) GROUP BY post_id, emoji", (ids,)).fetchall():
        d = out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
        d["counts"][emoji] = cnt
        d["total"] += cnt
    for pid, emoji in conn.execute(
            "SELECT post_id, emoji FROM wall_reaction "
            "WHERE post_id = ANY(%s) AND username = %s", (ids, viewer)).fetchall():
        out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})["mine"] = emoji
    seen: dict[int, int] = {}
    for pid, name, uname, emoji in conn.execute(
            "SELECT post_id, name, username, emoji FROM wall_reaction "
            "WHERE post_id = ANY(%s) ORDER BY created_at DESC", (ids,)).fetchall():
        d = out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
        if seen.get(pid, 0) < 5:
            d["faces"].append({"name": name or uname, "username": uname, "emoji": emoji})
            seen[pid] = seen.get(pid, 0) + 1
    return out


def _comments(conn, ids: list[int], viewer: str, post_author: dict[int, str],
              moderator: bool, limit: int | None = COMMENT_PREVIEW) -> dict:
    """{post_id: {"items": [...], "total": n}} — `limit` cai MOI NHAT moi bai.

    Lay N cai moi nhat nhung tra ve theo thu tu CU -> MOI, dung thu tu doc tren
    giao dien. `limit=None` = lay het (dung cho endpoint "xem them").
    `total` luon la tong so that, khong phu thuoc limit.
    """
    out: dict[int, dict] = {}
    if not ids:
        return out
    sql = ("SELECT id, post_id, author, author_name, body, created_at, edited_at, total "
           "FROM (SELECT id, post_id, author, author_name, body, created_at, edited_at, "
           "             row_number() OVER (PARTITION BY post_id "
           "                                ORDER BY created_at DESC, id DESC) AS rn, "
           "             count(*) OVER (PARTITION BY post_id) AS total "
           "      FROM wall_comment WHERE post_id = ANY(%s) AND deleted = false) t ")
    args: list[Any] = [ids]
    if limit is not None:
        sql += "WHERE rn <= %s "
        args.append(limit)
    sql += "ORDER BY post_id, created_at ASC, id ASC"
    for cid, pid, author, aname, body, created, edited, total in conn.execute(
            sql, tuple(args)).fetchall():
        d = out.setdefault(pid, {"items": [], "total": total})
        d["items"].append({
            "id": cid, "author": author, "authorName": aname or author, "body": body,
            "createdAt": created.isoformat(),
            "editedAt": edited.isoformat() if edited else None,
            # Tac gia BAI don duoc binh luan tren bai cua minh — do la phan
            # "toan quyen tren bai dang" cua luat moi.
            "canDelete": can_delete_wall_comment(viewer, author,
                                                 post_author.get(pid) or ""),
        })
    return out


@router.get("/{owner}")
def wall(owner: str, offset: int = 0, viewer: str = Depends(current_user)) -> dict:
    """Tuong cua mot nguoi, moi nhat truoc. offset de bam 'Xem them'."""
    if owner == "me":
        owner = viewer
    if not _SAFE.fullmatch(owner):
        raise HTTPException(status_code=404, detail="khong co tuong nay")
    offset = max(0, min(offset, 5000))
    moderator = is_editor(viewer)
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT {POST_COLS} FROM wall_post WHERE owner = %s AND deleted = false "
            "ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (owner, PAGE + 1, offset)).fetchall()
        more = len(rows) > PAGE
        rows = rows[:PAGE]
        ids = [r[0] for r in rows]
        rx = _reactions(conn, ids, viewer)
        cm = _comments(conn, ids, viewer, {r[0]: r[2] for r in rows}, moderator)
        total = conn.execute("SELECT count(*) FROM wall_post WHERE owner = %s "
                             "AND deleted = false", (owner,)).fetchone()[0]
    return {
        "owner": owner,
        "posts": [_post(r, rx, cm, viewer, moderator) for r in rows],
        "more": more,
        "total": total,
        "emojis": EMOJIS,
        "canPost": owner == viewer,     # chi chu ho so dang len tuong minh
    }


# --------------------------------------------------------------- bang tin --
def _dept_mates(viewer: str) -> list[str] | None:
    """Username nhung nguoi CUNG PHONG BAN voi nguoi dang xem (ke ca chinh ho).

    None = khong xac dinh duoc phong ban => goi y phia tren: bo loc, hien tat ca.
    LUU Y: danh ba AD chi gom nguoi CO SO MAY LE nen day khong phai toan bo
    phong ban — da noi ro tren giao dien.
    """
    me = get_user(viewer) or {}
    dept = (me.get("department") or "").strip()
    if not dept:
        return None
    try:
        data = list_directory()
    except Exception:
        return None
    for d in data.get("departments", []):
        if d.get("name") == dept:
            names = [c.get("username", "") for c in d.get("contacts", []) if c.get("username")]
            return sorted(set(names) | {viewer})
    return [viewer]


@feed_router.get("")
def feed(offset: int = 0, scope: str = "all",
         viewer: str = Depends(current_user)) -> dict:
    """Bang tin chung: bai tuong cua MOI NGUOI, moi nhat truoc.

    scope=dept: chi nguoi cung phong ban (theo danh ba AD).
    """
    offset = max(0, min(offset, 5000))
    moderator = is_editor(viewer)
    mates = _dept_mates(viewer) if scope == "dept" else None
    # Xin phong ban ma khong tra ra duoc thi noi that voi giao dien, dung im
    # lang hien tat ca nhu the da loc.
    scope_used = "dept" if (scope == "dept" and mates is not None) else "all"

    sql = f"SELECT {POST_COLS} FROM wall_post WHERE deleted = false"
    args: list[Any] = []
    # Chinh chu tai khoan test van thay bai cua minh (de kich ban e2e kiem
    # duoc "dang xong co hien khong"), chi NGUOI KHAC la khong thay.
    if TEST_ACCOUNTS and viewer.lower() not in TEST_ACCOUNTS:
        sql += " AND lower(author) <> ALL(%s)"
        args.append(TEST_ACCOUNTS)
    if scope_used == "dept":
        sql += " AND owner = ANY(%s)"
        args.append(mates)
    sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    args += [PAGE + 1, offset]

    with _conn() as conn:
        rows = conn.execute(sql, tuple(args)).fetchall()
        more = len(rows) > PAGE
        rows = rows[:PAGE]
        ids = [r[0] for r in rows]
        rx = _reactions(conn, ids, viewer)
        # Bang tin gom bai cua nhieu nguoi => quyen xoa binh luan phai tinh
        # theo TAC GIA cua chinh bai do. Truyen ca bang mot lan (truoc day goi
        # _comments mot lan cho MOI bai — 20 truy van cho mot trang).
        cm = _comments(conn, ids, viewer, {r[0]: r[2] for r in rows}, moderator)
        total = conn.execute(
            "SELECT count(*) FROM wall_post WHERE deleted = false"
            + (" AND owner = ANY(%s)" if scope_used == "dept" else ""),
            (mates,) if scope_used == "dept" else ()).fetchone()[0]
    return {
        "owner": viewer,
        "posts": [_post(r, rx, cm, viewer, moderator) for r in rows],
        "more": more,
        "total": total,
        "emojis": EMOJIS,
        "canPost": True,          # dang tu bang tin = dang len tuong CUA MINH
        "scope": scope_used,
    }


def _one(conn, pid: int, viewer: str) -> dict:
    r = conn.execute(f"SELECT {POST_COLS} FROM wall_post WHERE id = %s "
                     "AND deleted = false", (pid,)).fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="khong co bai nay")
    moderator = is_editor(viewer)
    rx = _reactions(conn, [pid], viewer)
    cm = _comments(conn, [pid], viewer, {pid: r[2]}, moderator)
    return _post(r, rx, cm, viewer, moderator)


# --------------------------------------------------------------- viet bai --
@router.post("")
def create(payload: dict = Body(...), username: str = Depends(current_user)) -> dict:
    """Dang bai len tuong CUA CHINH MINH. Gui `owner` khac = 403."""
    owner = (payload.get("owner") or username).strip() or username
    if owner != username:
        raise HTTPException(status_code=403,
                            detail="chi chu ho so moi dang duoc len tuong nay")
    body = _plain(payload.get("body"), MAX_BODY)
    image = _image_url(payload.get("image"))
    if not body and not image:
        raise HTTPException(status_code=400, detail="bai viet trong")
    with _conn() as conn:
        pid = conn.execute(
            "INSERT INTO wall_post (owner, author, author_name, body, image) "
            "VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (owner, username, _name_of(username), body, image)).fetchone()[0]
        conn.commit()
        # Dem su kien nghiep vu: bai dang/gio tut bat thuong = co gi do hong
        # ma KHONG nem exception nao. Xem app_metric + _check_anomaly().
        bump_metric("wall_post")
        return _one(conn, pid, username)


@router.put("/{pid}")
def update(pid: int, payload: dict = Body(...),
           username: str = Depends(current_user)) -> dict:
    body = _plain(payload.get("body"), MAX_BODY)
    image = _image_url(payload.get("image"))
    if not body and not image:
        raise HTTPException(status_code=400, detail="bai viet trong")
    with _conn() as conn:
        r = conn.execute("SELECT author, image FROM wall_post WHERE id = %s "
                         "AND deleted = false", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        if r[0] != username:
            raise HTTPException(status_code=403, detail="ban khong sua duoc bai nay")
        conn.execute("UPDATE wall_post SET body = %s, image = %s, edited_at = now() "
                     "WHERE id = %s", (body, image, pid))
        conn.commit()
        if r[1] and r[1] != image:
            drop(r[1], WALL_DIR, WALL_URL)
        return _one(conn, pid, username)


@router.delete("/{pid}")
def remove(pid: int, username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        r = conn.execute("SELECT owner, author, image FROM wall_post WHERE id = %s "
                         "AND deleted = false", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        owner, author, image = r
        # Chi TAC GIA (hoac IT) — chu tuong khong con xoa duoc bai nguoi khac
        # dang len tuong minh. Xem ghi chu trong _post().
        if not can_manage_wall_post(username, author):
            raise HTTPException(status_code=403, detail="ban khong xoa duoc bai nay")
        # Xoa han: tuong khong can bia mo nhu binh luan long nhau ben trang tin.
        conn.execute("DELETE FROM wall_post WHERE id = %s", (pid,))
        conn.commit()
    drop(image, WALL_DIR, WALL_URL)
    return {"ok": True, "id": pid}


# --------------------------------------------------------------- cam xuc --
@router.post("/{pid}/react")
def react(pid: int, payload: dict = Body(...),
          username: str = Depends(current_user)) -> dict:
    emoji = payload.get("emoji")
    with _conn() as conn:
        r = conn.execute("SELECT owner, author FROM wall_post WHERE id = %s "
                         "AND deleted = false", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        if emoji is None or emoji == "":
            conn.execute("DELETE FROM wall_reaction WHERE post_id = %s AND username = %s",
                         (pid, username))
        else:
            if emoji not in EMOJIS:
                raise HTTPException(status_code=400, detail="cam xuc khong hop le")
            conn.execute(
                "INSERT INTO wall_reaction (post_id, username, name, emoji) "
                "VALUES (%s,%s,%s,%s) ON CONFLICT (post_id, username) DO UPDATE SET "
                "emoji = EXCLUDED.emoji, created_at = now()",
                (pid, username, _name_of(username), emoji))
            _notify(conn, r[1], username, pid, r[0], "reaction", "")
        conn.commit()
        return _one(conn, pid, username)


# ------------------------------------------------------------- binh luan --
@router.get("/{pid}/comments")
def all_comments(pid: int, viewer: str = Depends(current_user)) -> dict:
    """Toan bo binh luan cua mot bai — cho nut "Xem them N binh luan".

    Trang bang tin/tuong chi kem COMMENT_PREVIEW cai moi nhat moi bai.
    """
    with _conn() as conn:
        r = conn.execute("SELECT author FROM wall_post WHERE id = %s AND deleted = false",
                         (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        cm = _comments(conn, [pid], viewer, {pid: r[0]}, is_editor(viewer), limit=None)
    d = cm.get(pid) or {"items": [], "total": 0}
    return {"comments": d["items"], "total": d["total"]}


@router.post("/{pid}/comment")
def add_comment(pid: int, payload: dict = Body(...),
                username: str = Depends(current_user)) -> dict:
    body = _plain(payload.get("body"), MAX_COMMENT)
    if not body:
        raise HTTPException(status_code=400, detail="thieu noi dung binh luan")
    with _conn() as conn:
        r = conn.execute("SELECT owner, author FROM wall_post WHERE id = %s "
                         "AND deleted = false", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        conn.execute("INSERT INTO wall_comment (post_id, author, author_name, body) "
                     "VALUES (%s,%s,%s,%s)", (pid, username, _name_of(username), body))
        _notify(conn, r[1], username, pid, r[0], "comment", body)
        conn.commit()
        bump_metric("wall_comment")
        return _one(conn, pid, username)


@router.delete("/comment/{cid}")
def delete_comment(cid: int, username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        r = conn.execute(
            "SELECT c.author, p.author, p.id FROM wall_comment c "
            "JOIN wall_post p ON p.id = c.post_id WHERE c.id = %s AND c.deleted = false",
            (cid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co binh luan nay")
        author, post_author, pid = r
        # Nguoi viet binh luan, TAC GIA BAI, hoac IT.
        if not can_delete_wall_comment(username, author, post_author):
            raise HTTPException(status_code=403, detail="ban khong xoa duoc binh luan nay")
        conn.execute("DELETE FROM wall_comment WHERE id = %s", (cid,))
        conn.commit()
        return _one(conn, pid, username)


# ------------------------------------------------------------------ anh --
@router.post("/image")
def upload_image(file: UploadFile = File(...),
                 username: str = Depends(current_user)) -> dict:
    data = read_upload(file.file, MAX_IMAGE)
    return {"url": save_jpeg(data, WALL_DIR, WALL_URL, box=WALL_BOX)}


# ------------------------------------------------------------ thong bao --
def _notify(conn, recipient: str, actor: str, pid: int, owner: str,
            kind: str, snippet: str) -> None:
    """Bao cho tac gia bai tuong.

    Dung chung bang news_notification nhung PHAI qua cot `wall_post_id`:
    `post_id` co khoa ngoai sang news_post va id hai ben trung day so, nhet
    vao do se tro nham sang mot bai tin. `url` de chuong biet dan di dau."""
    if not recipient or recipient == actor:
        return
    aname = _name_of(actor)
    url = f"/profile/{owner}"
    ntype = "wall_reaction" if kind == "reaction" else "wall_comment"
    if ntype == "wall_reaction":
        # Gom cam xuc: mot thong bao/bai chua doc, dem so nguoi.
        total = conn.execute("SELECT count(*) FROM wall_reaction WHERE post_id = %s "
                             "AND username <> %s", (pid, recipient)).fetchone()[0]
        existing = conn.execute(
            "SELECT id FROM news_notification WHERE recipient = %s AND wall_post_id = %s "
            "AND type = %s AND read_at IS NULL", (recipient, pid, ntype)).fetchone()
        if existing:
            conn.execute("UPDATE news_notification SET actor = %s, actor_name = %s, "
                         "count = %s, created_at = now() WHERE id = %s",
                         (actor, aname, total, existing[0]))
            return
        conn.execute("INSERT INTO news_notification (recipient, type, actor, actor_name,"
                     " wall_post_id, count, url) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                     (recipient, ntype, actor, aname, pid, total, url))
        pre = f"và {total - 1} người khác " if total > 1 else ""
        _queue_push(recipient, "AVP Portal",
                    f"{aname} {pre}đã bày tỏ cảm xúc bài trên tường của bạn",
                    url, f"avp-wall-rx-{pid}")
        return
    conn.execute("INSERT INTO news_notification (recipient, type, actor, actor_name, "
                 "wall_post_id, snippet, url) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                 (recipient, ntype, actor, aname, pid, snippet[:200], url))
    _queue_push(recipient, "AVP Portal", f"{aname} đã bình luận bài trên tường của bạn",
                url, f"avp-wall-cm-{pid}")
