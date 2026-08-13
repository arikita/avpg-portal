"""Tin tuc noi bo AVP Portal.

Ai cung xem/comment/react duoc (da xac thuc qua Apache+Kerberos). Chi thanh vien
HR/Marketing (hoac IS) moi dang bai. IS = kiem duyet: an/xoa bai & comment bat ky.
Backend chi TIN header X-Remote-User do Apache dat (xem main.py).

Tinh nang tuong tac: luot xem (news_view), react co ten (facepile), poll/binh chon,
thong bao (reply/comment/reaction toi minh) + badge "NEW" theo news_seen."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
import os
import re
import threading
import uuid
from typing import Any

import psycopg
from fastapi.responses import Response
from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, UploadFile

from .htmlclean import clean_html
from .ad import get_user, is_editor, is_news_author

try:  # pywebpush chi can cho Web Push; thieu cung khong sap app.
    from pywebpush import WebPushException, webpush
except Exception:  # pragma: no cover
    webpush = None
    WebPushException = Exception

router = APIRouter(prefix="/api/news", tags=["news"])
notif_router = APIRouter(prefix="/api/notifications", tags=["notifications"])
push_router = APIRouter(prefix="/api/push", tags=["push"])

# VAPID: private key la duong dan toi file PEM; public la applicationServerKey.
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_SUB = os.environ.get("VAPID_SUB", "mailto:it@anvietphatgroup.com")

DSN = os.environ.get("DATABASE_URL", "")
MEDIA_DIR = os.environ.get("NEWS_MEDIA_DIR", "/var/www/avp-portal-media")
EMOJIS = ["\U0001F44D", "❤️", "\U0001F604", "\U0001F389", "\U0001F44F"]
MAX_UPLOAD = 8 * 1024 * 1024
EXT_OK = {"image/jpeg": ".jpg", "image/png": ".png",
          "image/gif": ".gif", "image/webp": ".webp"}
MAX_DOC = 25 * 1024 * 1024
DOC_OK = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/zip": ".zip",
}
FACEPILE = 5  # so nguoi react hien tren the

POST_COLS = ("id, title_vi, title_en, summary_vi, summary_en, body_vi, body_en, "
             "cover, category, status, pinned, author, author_name, "
             "created_at, updated_at, published_at, comments_enabled")


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def require_author(username: str = Depends(current_user)) -> str:
    if not is_news_author(username):
        raise HTTPException(status_code=403, detail="ban khong co quyen dang tin")
    return username


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


def _bi(payload: dict, key: str, lang: str) -> str:
    v = payload.get(key)
    s = (v.get(lang) or "").strip() if isinstance(v, dict) else ""
    # Noi dung bai la HTML -> PHAI loc lai o server, khong tin trinh duyet.
    return clean_html(s) if key == "body" else s


def _name_of(username: str) -> str:
    info = get_user(username) or {}
    return info.get("fullName") or username


def _post_row(r) -> dict:
    (pid, tvi, ten, svi, sen, bvi, ben, cover, cat, status, pinned,
     author, aname, created, updated, published, comments_on) = r
    return {
        "id": pid,
        "title": {"vi": tvi, "en": ten or tvi},
        "summary": {"vi": svi, "en": sen or svi},
        "body": {"vi": bvi, "en": ben or bvi},
        "cover": cover, "category": cat, "status": status, "pinned": pinned,
        "author": author, "authorName": aname or author,
        "createdAt": created.isoformat(), "updatedAt": updated.isoformat(),
        "publishedAt": published.isoformat() if published else None,
        "commentsEnabled": comments_on,
    }


# ------------------------------------------------------------ reactions --
def _reactions_map(conn, ids: list[int], username: str) -> dict:
    out: dict[int, dict] = {}
    if not ids:
        return out
    for pid, emoji, cnt in conn.execute(
        "SELECT post_id, emoji, count(*) FROM news_reaction "
        "WHERE post_id = ANY(%s) GROUP BY post_id, emoji", (ids,)).fetchall():
        d = out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
        d["counts"][emoji] = cnt
        d["total"] += cnt
    for pid, emoji in conn.execute(
        "SELECT post_id, emoji FROM news_reaction "
        "WHERE post_id = ANY(%s) AND username = %s", (ids, username)).fetchall():
        out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})["mine"] = emoji
    # facepile: vai nguoi react gan nhat cho moi bai
    seen: dict[int, int] = {}
    for pid, name, emoji, uname in conn.execute(
        "SELECT post_id, name, emoji, username FROM news_reaction "
        "WHERE post_id = ANY(%s) ORDER BY created_at DESC", (ids,)).fetchall():
        d = out.setdefault(pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
        if seen.get(pid, 0) < FACEPILE:
            # username de giao dien tra duoc anh dai dien that (app-avatar)
            d["faces"].append({"name": name or uname, "emoji": emoji,
                               "username": uname})
            seen[pid] = seen.get(pid, 0) + 1
    return out


def _reactors(conn, post_id: int) -> list[dict]:
    return [{"username": u, "name": n or u, "emoji": e} for u, n, e in conn.execute(
        "SELECT username, name, emoji FROM news_reaction WHERE post_id = %s "
        "ORDER BY created_at DESC", (post_id,)).fetchall()]


def _comment_counts(conn, ids: list[int]) -> dict:
    if not ids:
        return {}
    return {pid: cnt for pid, cnt in conn.execute(
        "SELECT post_id, count(*) FROM news_comment "
        "WHERE post_id = ANY(%s) AND deleted = false GROUP BY post_id", (ids,)).fetchall()}


def _views_map(conn, ids: list[int]) -> dict:
    if not ids:
        return {}
    return {pid: cnt for pid, cnt in conn.execute(
        "SELECT post_id, count(*) FROM news_view WHERE post_id = ANY(%s) "
        "GROUP BY post_id", (ids,)).fetchall()}


def _comments_tree(conn, post_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT id, parent_id, author, author_name, body, created_at, edited_at, deleted "
        "FROM news_comment WHERE post_id = %s ORDER BY created_at ASC", (post_id,)).fetchall()
    nodes: dict[int, dict] = {}
    for (cid, parent, author, aname, body, created, edited, deleted) in rows:
        nodes[cid] = {
            "id": cid, "parentId": parent, "author": author,
            "authorName": aname or author, "body": "" if deleted else body,
            "deleted": deleted, "createdAt": created.isoformat(),
            "editedAt": edited.isoformat() if edited else None, "replies": [],
        }
    roots: list[dict] = []
    for node in nodes.values():
        parent = node["parentId"]
        (nodes[parent]["replies"] if parent and parent in nodes else roots).append(node)
    return roots


# ----------------------------------------------------------------- poll --
def _poll_row(conn, row, username: str) -> dict:
    poll_id, question, multi, allow_add, anon, closes_at = row
    closed = bool(closes_at and closes_at <= datetime.now(timezone.utc))
    opts = conn.execute("SELECT id, label, added_name FROM news_poll_option "
                        "WHERE poll_id = %s ORDER BY position, id", (poll_id,)).fetchall()
    counts = {oid: cnt for oid, cnt in conn.execute(
        "SELECT option_id, count(*) FROM news_poll_vote WHERE poll_id = %s "
        "GROUP BY option_id", (poll_id,)).fetchall()}
    mine = {r[0] for r in conn.execute(
        "SELECT option_id FROM news_poll_vote WHERE poll_id = %s AND username = %s",
        (poll_id, username)).fetchall()}
    # Binh chon an danh: KHONG tra ve ten ai da chon gi.
    who: dict[int, list[str]] = {}
    if not anon:
        for oid, nm, un in conn.execute(
                "SELECT option_id, name, username FROM news_poll_vote "
                "WHERE poll_id = %s ORDER BY option_id", (poll_id,)).fetchall():
            who.setdefault(oid, []).append(nm or un)
    voters = conn.execute("SELECT count(DISTINCT username) FROM news_poll_vote "
                          "WHERE poll_id = %s", (poll_id,)).fetchone()[0]
    options = [{"id": oid, "label": lb, "votes": counts.get(oid, 0), "mine": oid in mine,
                "addedBy": added, "voters": who.get(oid, [])}
               for oid, lb, added in opts]
    return {"id": poll_id, "question": question, "multi": multi, "options": options,
            "allowAdd": allow_add, "anonymous": anon, "closed": closed,
            "closesAt": closes_at.isoformat() if closes_at else None,
            "totalVoters": voters, "totalVotes": sum(counts.values()), "voted": bool(mine)}


def _polls(conn, post_id: int, username: str) -> list:
    """Tat ca cau hoi binh chon cua mot bai, theo thu tu tao."""
    rows = conn.execute("SELECT id, question, multi, allow_add, anonymous, closes_at "
                        "FROM news_poll WHERE post_id = %s ORDER BY id", (post_id,)).fetchall()
    return [_poll_row(conn, r, username) for r in rows]


def _deadline(raw) -> "datetime | None":
    """Doc thoi han tu chuoi ISO trinh duyet gui len; sai dinh dang thi bo qua."""
    if not raw:
        return None
    try:
        d = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _create_poll(conn, post_id: int, poll: dict) -> None:
    q = (poll.get("question") or "").strip()
    opts = [o.strip() for o in (poll.get("options") or []) if o and o.strip()]
    if len(opts) < 2:
        return
    row = conn.execute(
        "INSERT INTO news_poll (post_id, question, multi, allow_add, anonymous, closes_at) "
        "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
        (post_id, q[:300], bool(poll.get("multi")), bool(poll.get("allowAdd")),
         bool(poll.get("anonymous")), _deadline(poll.get("closesAt")))).fetchone()
    for i, label in enumerate(opts):
        conn.execute("INSERT INTO news_poll_option (poll_id, label, position) "
                     "VALUES (%s,%s,%s)", (row[0], label[:120], i))


def _create_polls(conn, post_id: int, payload: dict) -> None:
    """Mot bai co the co nhieu cau hoi; toi da 20 cau."""
    polls = payload.get("polls")
    if not isinstance(polls, list):
        polls = [payload.get("poll")] if payload.get("poll") else []
    for poll in polls[:20]:
        if isinstance(poll, dict):
            _create_poll(conn, post_id, poll)


# --------------------------------------------------------- notifications --
def _push_worker(recipient: str, title: str, body: str, url: str, tag: str) -> None:
    """Gui Web Push toi moi thiet bi cua recipient (chay o thread rieng, khong
    chan request). Sub het han (404/410) thi xoa."""
    if not webpush or not VAPID_PRIVATE or not recipient:
        return
    try:
        with _conn() as conn:
            subs = conn.execute("SELECT endpoint, p256dh, auth FROM push_subscription "
                                "WHERE username = %s", (recipient,)).fetchall()
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
        dead: list[str] = []
        for endpoint, p256dh, auth in subs:
            try:
                webpush(subscription_info={"endpoint": endpoint,
                                           "keys": {"p256dh": p256dh, "auth": auth}},
                        data=payload, vapid_private_key=VAPID_PRIVATE,
                        vapid_claims={"sub": VAPID_SUB}, timeout=8)
            except WebPushException as ex:
                code = getattr(getattr(ex, "response", None), "status_code", None)
                if code in (404, 410):
                    dead.append(endpoint)
            except Exception:
                pass
        if dead:
            with _conn() as conn:
                conn.execute("DELETE FROM push_subscription WHERE endpoint = ANY(%s)", (dead,))
                conn.commit()
    except Exception:
        pass


def _queue_push(recipient: str, title: str, body: str, url: str, tag: str) -> None:
    if recipient and webpush and VAPID_PRIVATE:
        threading.Thread(target=_push_worker,
                         args=(recipient, title, body, url, tag), daemon=True).start()


def _notify(conn, recipient: str, ntype: str, actor: str, actor_name: str,
            post_id: int, comment_id: int | None, snippet: str) -> None:
    if not recipient or recipient == actor:
        return
    conn.execute(
        "INSERT INTO news_notification (recipient, type, actor, actor_name, post_id, "
        "comment_id, snippet) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (recipient, ntype, actor, actor_name, post_id, comment_id, (snippet or "")[:200]))
    phrase = ("đã trả lời bình luận của bạn" if ntype == "reply"
              else "đã bình luận bài của bạn")
    _queue_push(recipient, "AVP Portal", f"{actor_name} {phrase}",
                f"/news/{post_id}", f"avp-{ntype}-{post_id}")


def _notify_reaction(conn, recipient: str, actor: str, actor_name: str, post_id: int) -> None:
    """Gop reaction: mot thong bao/bai, dem so nguoi (\"X va N nguoi khac\").
    Chi gom cai CHUA doc; da doc roi thi tao moi de bao lai dot sau."""
    if not recipient or recipient == actor:
        return
    total = conn.execute("SELECT count(*) FROM news_reaction WHERE post_id = %s "
                         "AND username <> %s", (post_id, recipient)).fetchone()[0]
    existing = conn.execute(
        "SELECT id FROM news_notification WHERE recipient = %s AND post_id = %s "
        "AND type = 'reaction' AND read_at IS NULL", (recipient, post_id)).fetchone()
    if existing:
        conn.execute("UPDATE news_notification SET actor = %s, actor_name = %s, "
                     "count = %s, created_at = now() WHERE id = %s",
                     (actor, actor_name, total, existing[0]))
    else:
        conn.execute("INSERT INTO news_notification (recipient, type, actor, actor_name, "
                     "post_id, count) VALUES (%s,'reaction',%s,%s,%s,%s)",
                     (recipient, actor, actor_name, post_id, total))
    pre = f"và {total - 1} người khác " if total > 1 else ""
    _queue_push(recipient, "AVP Portal", f"{actor_name} {pre}đã bày tỏ cảm xúc bài của bạn",
                f"/news/{post_id}", f"avp-reaction-{post_id}")


# --------------------------------------------------------------- detail --
def _detail(pid: int, username: str, record_view: bool = False) -> dict:
    with _conn() as conn:
        r = conn.execute(f"SELECT {POST_COLS} FROM news_post WHERE id = %s", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        post = _post_row(r)
        if post["status"] != "published" and post["author"] != username and not is_editor(username):
            raise HTTPException(status_code=404, detail="khong co bai viet")
        if record_view and post["status"] == "published":
            conn.execute("INSERT INTO news_view (post_id, username) VALUES (%s,%s) "
                         "ON CONFLICT DO NOTHING", (pid, username))
            conn.commit()
        post["reactions"] = _reactions_map(conn, [pid], username).get(
            pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
        post["reactors"] = _reactors(conn, pid)
        post["comments"] = _comments_tree(conn, pid)
        polls = _polls(conn, pid, username)
        post["polls"] = polls
        post["poll"] = polls[0] if polls else None      # giu cho ban cu
        post["views"] = _views_map(conn, [pid]).get(pid, 0)
    post["emojis"] = EMOJIS
    post["canEdit"] = (post["author"] == username) or is_editor(username)
    post["canModerate"] = is_editor(username)
    return post


# ----------------------------------------------------------------- feed --
@router.get("")
def feed(username: str = Depends(current_user), category: str | None = None,
         q: str | None = None, peek: int = 0) -> dict:
    """peek=1: chi doc (vd widget trang chu), KHONG danh dau da xem => badge NEW con.
    q=tu khoa: tim khong dau trong tieu de/tom tat/noi dung (bo the HTML)."""
    author = is_news_author(username)
    sql = f"SELECT {POST_COLS} FROM news_post WHERE (status = 'published'"
    args: list[Any] = []
    if author:
        sql += " OR (status IN ('draft', 'hidden') AND author = %s)"
        args.append(username)
    sql += ")"
    if category:
        sql += " AND category = %s"
        args.append(category)
    term = (q or "").strip()
    if term:
        # Gom moi truong tim kiem, bo the HTML khoi body, so sanh khong dau.
        sql += (" AND unaccent(coalesce(title_vi,'')||' '||coalesce(title_en,'')||' '"
                "||coalesce(summary_vi,'')||' '||coalesce(summary_en,'')||' '"
                "||regexp_replace(coalesce(body_vi,'')||' '||coalesce(body_en,''),"
                "'<[^>]+>',' ','g')) ILIKE unaccent(%s)")
        args.append(f"%{term}%")
    sql += " ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC"
    with _conn() as conn:
        rows = conn.execute(sql, tuple(args)).fetchall()
        posts = [_post_row(r) for r in rows]
        ids = [p["id"] for p in posts]
        rx = _reactions_map(conn, ids, username)
        cc = _comment_counts(conn, ids)
        vw = _views_map(conn, ids)
        has_poll = {r[0] for r in conn.execute(
            "SELECT DISTINCT post_id FROM news_poll WHERE post_id = ANY(%s)", (ids,)).fetchall()} if ids else set()
        # danh dau da xem trang tin => badge NEW reset (bo qua khi peek)
        if not peek:
            conn.execute("INSERT INTO news_seen (username, seen_at) VALUES (%s, now()) "
                         "ON CONFLICT (username) DO UPDATE SET seen_at = now()", (username,))
            conn.commit()
    for p in posts:
        p["reactions"] = rx.get(p["id"], {"counts": {}, "mine": None, "total": 0, "faces": []})
        p["commentCount"] = cc.get(p["id"], 0)
        p["views"] = vw.get(p["id"], 0)
        p["hasPoll"] = p["id"] in has_poll
        p.pop("body", None)
    return {"posts": posts, "emojis": EMOJIS, "canPost": author}


@router.get("/{pid}")
def get_post(pid: int, username: str = Depends(current_user)) -> dict:
    return _detail(pid, username, record_view=True)


# ---------------------------------------------------------------- viet --
@router.post("")
def create_post(payload: dict = Body(...), username: str = Depends(require_author)) -> dict:
    title_vi = _bi(payload, "title", "vi")
    if not title_vi:
        raise HTTPException(status_code=400, detail="thieu tieu de")
    status = "draft" if payload.get("status") == "draft" else "published"
    comments_on = payload.get("commentsEnabled")
    comments_on = True if comments_on is None else bool(comments_on)
    aname = _name_of(username)
    with _conn() as conn:
        row = conn.execute(
            "INSERT INTO news_post (title_vi, title_en, summary_vi, summary_en, body_vi, "
            "body_en, cover, category, status, comments_enabled, author, author_name, "
            "published_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, "
            "CASE WHEN %s = 'published' THEN now() ELSE NULL END) RETURNING id",
            (title_vi, _bi(payload, "title", "en"), _bi(payload, "summary", "vi"),
             _bi(payload, "summary", "en"), _bi(payload, "body", "vi"),
             _bi(payload, "body", "en"), (payload.get("cover") or "").strip(),
             (payload.get("category") or "announcement").strip(), status,
             comments_on, username, aname, status)).fetchone()
        _create_polls(conn, row[0], payload)
        conn.commit()
    return _detail(row[0], username)


@router.put("/{pid}")
def update_post(pid: int, payload: dict = Body(...),
                username: str = Depends(require_author)) -> dict:
    with _conn() as conn:
        r = conn.execute(f"SELECT {POST_COLS} FROM news_post WHERE id = %s", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        if r[11] != username and not is_editor(username):
            raise HTTPException(status_code=403, detail="chi tac gia hoac IS duoc sua")
        conn.execute("INSERT INTO news_post_history (post_id, snapshot, changed_by) "
                     "VALUES (%s,%s,%s)",
                     (pid, json.dumps(_post_row(r), ensure_ascii=False), username))
        req_status = payload.get("status")
        status = req_status if req_status in ("draft", "published", "hidden") else r[9]
        comments_on = payload.get("commentsEnabled")
        comments_on = r[16] if comments_on is None else bool(comments_on)
        conn.execute(
            "UPDATE news_post SET title_vi=%s, title_en=%s, summary_vi=%s, summary_en=%s, "
            "body_vi=%s, body_en=%s, cover=%s, category=%s, status=%s, comments_enabled=%s, "
            "updated_at=now(), published_at = CASE WHEN %s='published' AND published_at IS NULL "
            "THEN now() ELSE published_at END WHERE id=%s",
            (_bi(payload, "title", "vi") or r[1], _bi(payload, "title", "en"),
             _bi(payload, "summary", "vi"), _bi(payload, "summary", "en"),
             _bi(payload, "body", "vi"), _bi(payload, "body", "en"),
             (payload.get("cover") if payload.get("cover") is not None else r[7]) or "",
             (payload.get("category") or r[8]).strip(), status, comments_on, status, pid))
        # Chi tao poll neu bai chua co (sua poll da co thi de sau).
        if not conn.execute("SELECT 1 FROM news_poll WHERE post_id = %s", (pid,)).fetchone():
            _create_polls(conn, pid, payload)
        conn.commit()
    return _detail(pid, username)


@router.post("/{pid}/pin")
def pin_post(pid: int, username: str = Depends(current_user)) -> dict:
    if not is_editor(username):
        raise HTTPException(status_code=403, detail="chi IS duoc ghim bai")
    with _conn() as conn:
        r = conn.execute("SELECT pinned FROM news_post WHERE id = %s", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        conn.execute("UPDATE news_post SET pinned = %s WHERE id = %s", (not r[0], pid))
        conn.commit()
    return {"pinned": not r[0]}


@router.delete("/{pid}")
def delete_post(pid: int, username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        r = conn.execute("SELECT author FROM news_post WHERE id = %s", (pid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        if r[0] != username and not is_editor(username):
            raise HTTPException(status_code=403, detail="chi tac gia hoac IS duoc xoa")
        conn.execute("DELETE FROM news_post WHERE id = %s", (pid,))
        conn.commit()
    return {"ok": True}


# --------------------------------------------------------------- react --
@router.post("/{pid}/react")
def react(pid: int, payload: dict = Body(...), username: str = Depends(current_user)) -> dict:
    emoji = payload.get("emoji")
    with _conn() as conn:
        row = conn.execute("SELECT author, author_name FROM news_post "
                           "WHERE id = %s AND status = 'published'", (pid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        if not emoji:
            conn.execute("DELETE FROM news_reaction WHERE post_id = %s AND username = %s",
                         (pid, username))
        elif emoji not in EMOJIS:
            raise HTTPException(status_code=400, detail="emoji khong hop le")
        else:
            cur = conn.execute("SELECT emoji FROM news_reaction WHERE post_id = %s "
                               "AND username = %s", (pid, username)).fetchone()
            if cur and cur[0] == emoji:
                conn.execute("DELETE FROM news_reaction WHERE post_id = %s AND username = %s",
                             (pid, username))
            else:
                conn.execute(
                    "INSERT INTO news_reaction (post_id, username, emoji, name) "
                    "VALUES (%s,%s,%s,%s) ON CONFLICT (post_id, username) DO UPDATE "
                    "SET emoji = EXCLUDED.emoji, created_at = now()",
                    (pid, username, emoji, _name_of(username)))
                if cur is None:  # nguoi moi thi bao (gop lai)
                    _notify_reaction(conn, row[0], username, _name_of(username), pid)
        conn.commit()
        rx = _reactions_map(conn, [pid], username).get(
            pid, {"counts": {}, "mine": None, "total": 0, "faces": []})
    return rx


# --------------------------------------------------------------- poll --
@router.post("/{pid}/poll/{poll_id}/vote")
def poll_vote(pid: int, poll_id: int, payload: dict = Body(...),
              username: str = Depends(current_user)) -> dict:
    """Bo phieu cho MOT cau hoi; tra ve toan bo cac cau hoi cua bai."""
    option_ids = payload.get("optionIds") or []
    with _conn() as conn:
        p = conn.execute("SELECT multi, closes_at FROM news_poll "
                         "WHERE id = %s AND post_id = %s", (poll_id, pid)).fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="khong co cau hoi nay")
        multi, closes_at = p
        if closes_at and closes_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="binh chon da ket thuc")
        valid = {r[0] for r in conn.execute(
            "SELECT id FROM news_poll_option WHERE poll_id = %s", (poll_id,)).fetchall()}
        chosen = [o for o in option_ids if o in valid]
        if not multi:
            chosen = chosen[:1]
        conn.execute("DELETE FROM news_poll_vote WHERE poll_id = %s AND username = %s",
                     (poll_id, username))
        for oid in chosen:
            conn.execute("INSERT INTO news_poll_vote (poll_id, option_id, username, name) "
                         "VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                         (poll_id, oid, username, _name_of(username)))
        conn.commit()
        return {"polls": _polls(conn, pid, username)}


@router.post("/{pid}/poll/{poll_id}/option")
def poll_add_option(pid: int, poll_id: int, payload: dict = Body(...),
                    username: str = Depends(current_user)) -> dict:
    """Nguoi binh chon tu them phuong an — chi khi tac gia bat cho phep."""
    label = (payload.get("label") or "").strip()[:120]
    if not label:
        raise HTTPException(status_code=400, detail="chua nhap phuong an")
    with _conn() as conn:
        p = conn.execute("SELECT allow_add, closes_at FROM news_poll "
                         "WHERE id = %s AND post_id = %s", (poll_id, pid)).fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="khong co cau hoi nay")
        allow_add, closes_at = p
        if not allow_add:
            raise HTTPException(status_code=403, detail="binh chon nay khong cho them phuong an")
        if closes_at and closes_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="binh chon da ket thuc")
        rows = conn.execute("SELECT label, position FROM news_poll_option WHERE poll_id = %s",
                            (poll_id,)).fetchall()
        if len(rows) >= 30:
            raise HTTPException(status_code=400, detail="da toi da 30 phuong an")
        if any(lb.strip().lower() == label.lower() for lb, _ in rows):
            raise HTTPException(status_code=400, detail="phuong an nay da co")
        pos = max((pos for _, pos in rows), default=-1) + 1
        conn.execute("INSERT INTO news_poll_option (poll_id, label, position, added_by, added_name) "
                     "VALUES (%s,%s,%s,%s,%s)",
                     (poll_id, label, pos, username, _name_of(username)))
        conn.commit()
        return {"polls": _polls(conn, pid, username)}


@router.put("/{pid}/polls")
def update_polls(pid: int, payload: dict = Body(...),
                 username: str = Depends(current_user)) -> dict:
    """Sua binh chon cua bai DA DANG (chi tac gia / IS).

    Doi chieu theo id: cau hoi & phuong an co id thi sua tai cho (phieu da bo
    GIU NGUYEN), khong co id thi them moi, con thu nam trong DB ma khong con
    trong danh sach gui len thi XOA — keo theo phieu cua no.
    """
    polls = payload.get("polls")
    if not isinstance(polls, list):
        raise HTTPException(status_code=400, detail="thieu danh sach cau hoi")
    with _conn() as conn:
        row = conn.execute("SELECT author FROM news_post WHERE id = %s", (pid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        if row[0] != username and not is_editor(username):
            raise HTTPException(status_code=403, detail="ban khong sua duoc binh chon nay")

        keep_polls: list[int] = []
        for poll in polls[:20]:
            if not isinstance(poll, dict):
                continue
            opts = [o for o in (poll.get("options") or [])
                    if isinstance(o, dict) and (o.get("label") or "").strip()]
            if len(opts) < 2:
                continue
            q = (poll.get("question") or "").strip()[:300]
            args = (q, bool(poll.get("multi")), bool(poll.get("allowAdd")),
                    bool(poll.get("anonymous")), _deadline(poll.get("closesAt")))
            pid_poll = poll.get("id")
            if pid_poll and conn.execute("SELECT 1 FROM news_poll WHERE id = %s AND post_id = %s",
                                         (pid_poll, pid)).fetchone():
                conn.execute("UPDATE news_poll SET question=%s, multi=%s, allow_add=%s, "
                             "anonymous=%s, closes_at=%s WHERE id = %s", args + (pid_poll,))
            else:
                pid_poll = conn.execute(
                    "INSERT INTO news_poll (post_id, question, multi, allow_add, anonymous, "
                    "closes_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (pid,) + args).fetchone()[0]
            keep_polls.append(pid_poll)

            keep_opts: list[int] = []
            for i, o in enumerate(opts[:30]):
                label = o["label"].strip()[:120]
                oid = o.get("id")
                if oid and conn.execute("SELECT 1 FROM news_poll_option WHERE id = %s "
                                        "AND poll_id = %s", (oid, pid_poll)).fetchone():
                    conn.execute("UPDATE news_poll_option SET label=%s, position=%s WHERE id=%s",
                                 (label, i, oid))
                else:
                    oid = conn.execute("INSERT INTO news_poll_option (poll_id, label, position) "
                                       "VALUES (%s,%s,%s) RETURNING id",
                                       (pid_poll, label, i)).fetchone()[0]
                keep_opts.append(oid)
            conn.execute("DELETE FROM news_poll_option WHERE poll_id = %s AND id <> ALL(%s)",
                         (pid_poll, keep_opts))

        conn.execute("DELETE FROM news_poll WHERE post_id = %s AND id <> ALL(%s)",
                     (pid, keep_polls or [0]))
        conn.commit()
        return {"polls": _polls(conn, pid, username)}


@router.get("/{pid}/poll/export.csv")
def export_poll(pid: int, username: str = Depends(current_user)) -> Response:
    """Ket qua binh chon dang CSV cho tac gia / IS tong hop.

    Co BOM dau file de Excel mo ra khong bi loi dau tieng Viet.
    """
    with _conn() as conn:
        row = conn.execute("SELECT author, title_vi FROM news_post WHERE id = %s",
                           (pid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="khong co bai nay")
        # CHI NGUOI DANG BAI. Co y KHONG mo cho nhom IS: file tai ve co the
        # kem ten tung nguoi da chon, khong phai thu de ai cung cam di duoc.
        if row[0] != username:
            raise HTTPException(status_code=403,
                                detail="chi nguoi dang bai moi tai duoc ket qua")
        polls = _polls(conn, pid, username)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Bài viết", row[1]])
    w.writerow([])
    for i, p in enumerate(polls, 1):
        w.writerow([f"Câu {i}", p["question"]])
        w.writerow(["Số người tham gia", p["totalVoters"],
                    "Ẩn danh" if p["anonymous"] else "", 
                    "Đã kết thúc" if p["closed"] else ""])
        w.writerow(["Phương án", "Số phiếu", "Tỉ lệ %", "" if p["anonymous"] else "Người chọn"])
        for o in p["options"]:
            pct = round(o["votes"] / p["totalVoters"] * 100) if p["totalVoters"] else 0
            w.writerow([o["label"], o["votes"], pct,
                        "" if p["anonymous"] else "; ".join(o.get("voters") or [])])
        w.writerow([])
    data = "\ufeff" + buf.getvalue()
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition":
                             f'attachment; filename="binh-chon-{pid}.csv"'})


# ------------------------------------------------------------- comment --
@router.post("/{pid}/comment")
def add_comment(pid: int, payload: dict = Body(...),
                username: str = Depends(current_user)) -> dict:
    body = (payload.get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="thieu noi dung binh luan")
    if len(body) > 4000:
        raise HTTPException(status_code=400, detail="binh luan qua dai")
    parent = payload.get("parentId")
    aname = _name_of(username)
    with _conn() as conn:
        post = conn.execute("SELECT author, comments_enabled FROM news_post "
                            "WHERE id = %s", (pid,)).fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="khong co bai viet")
        if not post[1]:
            raise HTTPException(status_code=403, detail="bai nay da tat binh luan")
        parent_author = None
        if parent is not None:
            pr = conn.execute("SELECT post_id, author FROM news_comment WHERE id = %s",
                              (parent,)).fetchone()
            if not pr or pr[0] != pid:
                raise HTTPException(status_code=400, detail="binh luan cha khong hop le")
            parent_author = pr[1]
        cid = conn.execute(
            "INSERT INTO news_comment (post_id, parent_id, author, author_name, body) "
            "VALUES (%s,%s,%s,%s,%s) RETURNING id", (pid, parent, username, aname, body)).fetchone()[0]
        if parent_author is not None:
            _notify(conn, parent_author, "reply", username, aname, pid, cid, body)
        else:
            _notify(conn, post[0], "comment", username, aname, pid, cid, body)
        conn.commit()
        tree = _comments_tree(conn, pid)
    return {"comments": tree}


@router.put("/comment/{cid}")
def edit_comment(cid: int, payload: dict = Body(...),
                 username: str = Depends(current_user)) -> dict:
    body = (payload.get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="thieu noi dung binh luan")
    with _conn() as conn:
        r = conn.execute("SELECT author, post_id FROM news_comment WHERE id = %s "
                         "AND deleted = false", (cid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co binh luan")
        if r[0] != username:
            raise HTTPException(status_code=403, detail="chi sua binh luan cua minh")
        conn.execute("UPDATE news_comment SET body = %s, edited_at = now() WHERE id = %s",
                     (body, cid))
        conn.commit()
        tree = _comments_tree(conn, r[1])
    return {"comments": tree}


@router.delete("/comment/{cid}")
def delete_comment(cid: int, username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        r = conn.execute("SELECT author, post_id FROM news_comment WHERE id = %s",
                         (cid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co binh luan")
        if r[0] != username and not is_editor(username):
            raise HTTPException(status_code=403, detail="chi tac gia hoac IS duoc xoa")
        conn.execute("UPDATE news_comment SET deleted = true, body = '' WHERE id = %s", (cid,))
        conn.commit()
        tree = _comments_tree(conn, r[1])
    return {"comments": tree}


# -------------------------------------------------------------- upload --
@router.post("/upload")
def upload(file: UploadFile = File(...), username: str = Depends(require_author)) -> dict:
    """Nhan anh (<=8MB) hoac file dinh kem PDF/Office/zip (<=25MB)."""
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    ext = EXT_OK.get(ctype) or DOC_OK.get(ctype)
    if not ext:
        raise HTTPException(status_code=400, detail="dinh dang file khong duoc phep")
    limit = MAX_UPLOAD if ctype in EXT_OK else MAX_DOC
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=400,
                            detail=f"file vuot qua {limit // (1024 * 1024)}MB")
    os.makedirs(MEDIA_DIR, exist_ok=True)
    name = uuid.uuid4().hex + ext
    with open(os.path.join(MEDIA_DIR, name), "wb") as fh:
        fh.write(data)
    # Ten goc chi de HIEN THI (da bo duong dan + ky tu dieu khien); ten file
    # that tren dia van la uuid nen khong the ghi de file nguoi khac.
    shown = os.path.basename(file.filename or "")[-120:]
    shown = re.sub(r"[\x00-\x1f\x7f<>]", "", shown) or f"file{ext}"
    return {"url": f"/media/{name}", "name": shown}


# ------------------------------------------------------- notifications --
@notif_router.get("")
def list_notifications(username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, type, actor, actor_name, post_id, comment_id, snippet, "
            "created_at, read_at, count, url FROM news_notification WHERE recipient = %s "
            "ORDER BY created_at DESC LIMIT 30", (username,)).fetchall()
        unread = conn.execute("SELECT count(*) FROM news_notification "
                              "WHERE recipient = %s AND read_at IS NULL", (username,)).fetchone()[0]
        seen = conn.execute("SELECT seen_at FROM news_seen WHERE username = %s",
                            (username,)).fetchone()
        if seen:
            unseen = conn.execute(
                "SELECT count(*) FROM news_post WHERE status = 'published' "
                "AND author <> %s AND published_at > %s", (username, seen[0])).fetchone()[0]
        else:
            unseen = conn.execute(
                "SELECT count(*) FROM news_post WHERE status = 'published' "
                "AND author <> %s", (username,)).fetchone()[0]
    # url: bai tuong ca nhan khong nam o /news/<id> nen mang duong dan rieng;
    # rong = giu hanh vi cu (dan toi /news/<postId>).
    items = [{"id": i, "type": t, "actor": a, "actorName": an or a, "postId": pid,
              "commentId": cid, "snippet": s, "createdAt": ca.isoformat(),
              "read": ra is not None, "count": cnt, "url": url or ""}
             for (i, t, a, an, pid, cid, s, ca, ra, cnt, url) in rows]
    return {"items": items, "unread": unread, "unseenNews": unseen}


@notif_router.post("/read")
def mark_read(payload: dict = Body(default={}),
              username: str = Depends(current_user)) -> dict:
    ids = payload.get("ids")
    with _conn() as conn:
        if ids:
            conn.execute("UPDATE news_notification SET read_at = now() "
                         "WHERE recipient = %s AND id = ANY(%s) AND read_at IS NULL",
                         (username, ids))
        else:
            conn.execute("UPDATE news_notification SET read_at = now() "
                         "WHERE recipient = %s AND read_at IS NULL", (username,))
        conn.commit()
    return {"ok": True}


# --------------------------------------------------------- web push (VAPID) --
@push_router.get("/key")
def push_key(username: str = Depends(current_user)) -> dict:
    """applicationServerKey cho trinh duyet subscribe. enabled=false neu chua
    cau hinh VAPID / thieu pywebpush."""
    return {"key": VAPID_PUBLIC, "enabled": bool(VAPID_PUBLIC and webpush)}


@push_router.post("/subscribe")
def push_subscribe(payload: dict = Body(...),
                   username: str = Depends(current_user)) -> dict:
    endpoint = payload.get("endpoint")
    keys = payload.get("keys") or {}
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="thieu thong tin subscription")
    with _conn() as conn:
        conn.execute(
            "INSERT INTO push_subscription (endpoint, username, p256dh, auth) "
            "VALUES (%s,%s,%s,%s) ON CONFLICT (endpoint) DO UPDATE SET "
            "username = EXCLUDED.username, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth",
            (endpoint, username, p256dh, auth))
        conn.commit()
    return {"ok": True}


@push_router.post("/unsubscribe")
def push_unsubscribe(payload: dict = Body(...),
                     username: str = Depends(current_user)) -> dict:
    endpoint = payload.get("endpoint")
    if endpoint:
        with _conn() as conn:
            conn.execute("DELETE FROM push_subscription WHERE endpoint = %s AND username = %s",
                         (endpoint, username))
            conn.commit()
    return {"ok": True}
