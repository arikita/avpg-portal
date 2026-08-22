"""Chat noi bo — AVP Portal.

Nhan rieng 1-1 va phong nhieu nguoi, tin nhan den TUC THI qua WebSocket.

===========================================================================
HAI DIEM KIEN TRUC QUAN TRONG — doc truoc khi sua
===========================================================================

1. XAC THUC WEBSOCKET BANG "VE", KHONG PHAI KERBEROS.
   Ca portal xac thuc bang Kerberos o Apache (X-Remote-User). Nhung trinh
   duyet KHONG lam duoc Negotiate tren ban bat tay WebSocket: khong dat duoc
   header, va gap 401 la ket noi hong han. Nen luong la:
       GET /api/chat/ws-ticket   (HTTP thuong -> da qua Kerberos)  -> ve
       WS  /api/ws/chat?t=<ve>   (Apache chi chuyen tiep, khong doi auth)
   Ve DUNG MOT LAN, song 60 giay, xoa ngay khi dung. Ke khong co ve bi dong
   ket noi lap tuc. Ve nam trong BANG chu khong trong RAM vi API chay 2
   worker (ve phat o worker nay co the duoc dung o worker kia).

2. HAI WORKER => PHAI CO DUONG TRUYEN GIUA CHUNG.
   Uvicorn chay --workers 2. Nguoi gui co the dang noi vao worker A, nguoi
   nhan vao worker B, moi worker chi giu duoc socket cua rieng no. Dung
   LISTEN/NOTIFY cua PostgreSQL lam duong truyen: worker nao ghi tin thi
   NOTIFY, moi worker nghe kenh 'chat_evt' roi day xuong socket cua minh.
   Goi tin NOTIFY chi mang ID (gioi han 8000 byte), noi dung do tung worker
   tu doc lai tu DB.

NOI DUNG LA VAN BAN THUAN: the HTML bi go o server, giao dien ve bang binding
cua Angular. Anh qua chung duong Pillow giai-ma-roi-ma-hoa-lai nhu tuong.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
from typing import Any

import psycopg
from fastapi import (APIRouter, Body, Depends, File, Header, HTTPException,
                     UploadFile, WebSocket, WebSocketDisconnect)

from .ad import get_user, is_editor, list_people
from .images import MAX_IMAGE, read_upload, save_jpeg
from .news import _queue_push          # dung lai duong Web Push da co
from .telemetry import bump_metric

log = logging.getLogger("avp.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])
ws_router = APIRouter(prefix="/api/ws", tags=["chat"])

DSN = os.environ.get("DATABASE_URL", "")
MEDIA_DIR = os.environ.get("NEWS_MEDIA_DIR", "/var/www/avp-portal-media")
CHAT_DIR = os.path.join(MEDIA_DIR, "chat")
CHAT_URL = "/media/chat"
CHAT_BOX = (1600, 1600)

MAX_BODY = 4000
MAX_TITLE = 80
PAGE = 40
MAX_MEMBERS = 50
TICKET_TTL = 60            # giay
PRESENCE_TTL = 75          # coi la online neu thay trong khoang nay
NOTIFY_CHANNEL = "chat_evt"

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
    url = raw if isinstance(raw, str) else ""
    return url if re.fullmatch(rf"{CHAT_URL}/[0-9a-f]{{32}}\.jpg", url) else ""


def _dm_key(a: str, b: str) -> str:
    return "|".join(sorted([a.lower(), b.lower()]))


def _require_member(conn, conv_id: int, username: str) -> tuple[str, str]:
    """Chan nguoi ngoai doc/ghi cuoc tro chuyen. Tra (kind, title)."""
    row = conn.execute(
        "SELECT c.kind, c.title FROM chat_conversation c "
        "JOIN chat_member m ON m.conv_id = c.id AND m.username = %s "
        "WHERE c.id = %s", (username, conv_id)).fetchone()
    if not row:
        # Khong phan biet "khong ton tai" voi "khong duoc vao" => khong lo
        # cho nguoi la biet cuoc tro chuyen nao dang ton tai.
        raise HTTPException(status_code=404, detail="khong co cuoc tro chuyen nay")
    return row


# ===========================================================================
#  Danh sach cuoc tro chuyen
# ===========================================================================
def _members(conn, conv_ids: list[int]) -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    if not conv_ids:
        return out
    for cid, uname, name in conn.execute(
            "SELECT conv_id, username, name FROM chat_member "
            "WHERE conv_id = ANY(%s) ORDER BY name", (conv_ids,)).fetchall():
        out.setdefault(cid, []).append({"username": uname, "name": name or uname})
    return out


def _online(conn, usernames: list[str]) -> set[str]:
    if not usernames:
        return set()
    rows = conn.execute(
        "SELECT username FROM chat_presence WHERE username = ANY(%s) "
        f"AND last_seen > now() - interval '{PRESENCE_TTL} seconds'",
        (usernames,)).fetchall()
    return {r[0] for r in rows}


def _online_all(conn) -> set[str]:
    """Moi nguoi dang online, ten viet thuong — de so khop khong ke hoa/thuong
    (AD tra `HaiVL`, phien dang nhap ghi `haivl`)."""
    rows = conn.execute(
        "SELECT username FROM chat_presence "
        f"WHERE last_seen > now() - interval '{PRESENCE_TTL} seconds'").fetchall()
    return {r[0].lower() for r in rows}


def _conv_list(conn, username: str) -> list[dict]:
    rows = conn.execute(
        "SELECT c.id, c.kind, c.title, c.last_at, m.last_read_at "
        "FROM chat_conversation c JOIN chat_member m ON m.conv_id = c.id "
        "WHERE m.username = %s ORDER BY c.last_at DESC LIMIT 100",
        (username,)).fetchall()
    ids = [r[0] for r in rows]
    mem = _members(conn, ids)
    everyone = sorted({m["username"] for ms in mem.values() for m in ms})
    online = _online(conn, everyone)

    last: dict[int, dict] = {}
    unread: dict[int, int] = {}
    if ids:
        # Tin cuoi cua tung cuoc tro chuyen.
        for cid, sender, sname, body, image, created in conn.execute(
                "SELECT DISTINCT ON (conv_id) conv_id, sender, sender_name, body, "
                "image, created_at FROM chat_message WHERE conv_id = ANY(%s) "
                "AND deleted = false ORDER BY conv_id, id DESC", (ids,)).fetchall():
            last[cid] = {"sender": sender, "senderName": sname or sender,
                         "body": body, "image": image, "at": created.isoformat()}
        for cid, cnt in conn.execute(
                "SELECT m.conv_id, count(x.id) FROM chat_member m "
                "LEFT JOIN chat_message x ON x.conv_id = m.conv_id "
                "  AND x.created_at > m.last_read_at AND x.sender <> %s "
                "  AND x.deleted = false "
                "WHERE m.username = %s AND m.conv_id = ANY(%s) GROUP BY m.conv_id",
                (username, username, ids)).fetchall():
            unread[cid] = cnt

    out = []
    for cid, kind, title, last_at, _read in rows:
        people = mem.get(cid, [])
        others = [p for p in people if p["username"] != username]
        if kind == "dm":
            other = others[0] if others else {"username": username, "name": "?"}
            name = other["name"]
            peer = other["username"]
        else:
            name = title or ", ".join(p["name"] for p in others[:3])
            peer = ""
        out.append({
            "id": cid, "kind": kind, "title": title, "name": name, "peer": peer,
            "members": people,
            "online": bool(peer and peer in online) if kind == "dm"
                      else any(p["username"] in online for p in others),
            "lastAt": last_at.isoformat(),
            "last": last.get(cid),
            "unread": unread.get(cid, 0),
        })
    return out


@router.get("/conversations")
def conversations(username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        items = _conv_list(conn, username)
    return {"conversations": items, "me": username}


@router.get("/people")
def people(username: str = Depends(current_user)) -> dict:
    """Toan bo nhan vien + ai dang online.

    Chatbox mo len la thay ngay het moi nguoi, khong phai bam "nhan tin moi".
    Danh sach AD co cache 15 phut trong ad.py nen goi lai moi phut chi ton
    dung mot cau SELECT bang presence.
    """
    me = (username or "").lower()
    with _conn() as conn:
        online = _online_all(conn)
    return {"people": [{**p, "online": p["username"].lower() in online}
                       for p in list_people() if p["username"].lower() != me]}


# ===========================================================================
#  Tao cuoc tro chuyen
# ===========================================================================
@router.post("/dm")
def open_dm(payload: dict = Body(...), username: str = Depends(current_user)) -> dict:
    """Mo (hoac tao) cuoc tro chuyen 1-1 voi mot nguoi."""
    other = (payload.get("username") or "").strip()
    if not other or not _SAFE.fullmatch(other):
        raise HTTPException(status_code=400, detail="thieu nguoi nhan")
    if other.lower() == username.lower():
        raise HTTPException(status_code=400, detail="khong the nhan tin cho chinh minh")
    if get_user(other) is None:
        raise HTTPException(status_code=404, detail="khong tim thay nguoi nay")

    key = _dm_key(username, other)
    with _conn() as conn:
        row = conn.execute("SELECT id FROM chat_conversation WHERE dm_key = %s",
                           (key,)).fetchone()
        if row:
            cid = row[0]
        else:
            cid = conn.execute(
                "INSERT INTO chat_conversation (kind, dm_key, created_by) "
                "VALUES ('dm', %s, %s) RETURNING id", (key, username)).fetchone()[0]
            conn.execute(
                "INSERT INTO chat_member (conv_id, username, name) VALUES (%s,%s,%s), "
                "(%s,%s,%s) ON CONFLICT DO NOTHING",
                (cid, username, _name_of(username), cid, other, _name_of(other)))
            conn.commit()
        items = _conv_list(conn, username)
    return {"id": cid, "conversations": items}


@router.post("/group")
def create_group(payload: dict = Body(...), username: str = Depends(current_user)) -> dict:
    title = _plain(payload.get("title"), MAX_TITLE)
    raw = payload.get("members")
    members = []
    if isinstance(raw, list):
        for u in raw:
            u = (u or "").strip() if isinstance(u, str) else ""
            if u and _SAFE.fullmatch(u) and u.lower() != username.lower():
                members.append(u)
    members = sorted(set(members))[:MAX_MEMBERS]
    if not title:
        raise HTTPException(status_code=400, detail="phong chat can co ten")
    if not members:
        raise HTTPException(status_code=400, detail="chon it nhat mot thanh vien")

    with _conn() as conn:
        cid = conn.execute(
            "INSERT INTO chat_conversation (kind, title, created_by) "
            "VALUES ('group', %s, %s) RETURNING id", (title, username)).fetchone()[0]
        rows = [(cid, username, _name_of(username))]
        rows += [(cid, u, _name_of(u)) for u in members]
        conn.cursor().executemany(
            "INSERT INTO chat_member (conv_id, username, name) VALUES (%s,%s,%s) "
            "ON CONFLICT DO NOTHING", rows)
        conn.commit()
        items = _conv_list(conn, username)
    _publish({"t": "conv", "conv": cid,
              "to": [username] + members})
    return {"id": cid, "conversations": items}


@router.post("/{conv_id}/members")
def add_member(conv_id: int, payload: dict = Body(...),
               username: str = Depends(current_user)) -> dict:
    """Them nguoi vao phong nhom (thanh vien nao cung moi duoc)."""
    who = (payload.get("username") or "").strip()
    if not who or not _SAFE.fullmatch(who) or get_user(who) is None:
        raise HTTPException(status_code=404, detail="khong tim thay nguoi nay")
    with _conn() as conn:
        kind, _ = _require_member(conn, conv_id, username)
        if kind != "group":
            raise HTTPException(status_code=400,
                                detail="khong them nguoi vao cuoc tro chuyen rieng duoc")
        n = conn.execute("SELECT count(*) FROM chat_member WHERE conv_id = %s",
                         (conv_id,)).fetchone()[0]
        if n >= MAX_MEMBERS:
            raise HTTPException(status_code=400, detail="phong da du thanh vien")
        conn.execute("INSERT INTO chat_member (conv_id, username, name) "
                     "VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                     (conv_id, who, _name_of(who)))
        conn.commit()
        items = _conv_list(conn, username)
    _publish({"t": "conv", "conv": conv_id, "to": [who]})
    return {"conversations": items}


@router.delete("/{conv_id}/members/me")
def leave(conv_id: int, username: str = Depends(current_user)) -> dict:
    """Roi phong nhom. Cuoc tro chuyen 1-1 thi khong roi duoc."""
    with _conn() as conn:
        kind, _ = _require_member(conn, conv_id, username)
        if kind != "group":
            raise HTTPException(status_code=400,
                                detail="khong roi cuoc tro chuyen rieng duoc")
        conn.execute("DELETE FROM chat_member WHERE conv_id = %s AND username = %s",
                     (conv_id, username))
        # Phong khong con ai thi don luon, khong de rac lai trong DB.
        left = conn.execute("SELECT count(*) FROM chat_member WHERE conv_id = %s",
                            (conv_id,)).fetchone()[0]
        if left == 0:
            conn.execute("DELETE FROM chat_conversation WHERE id = %s", (conv_id,))
        conn.commit()
        items = _conv_list(conn, username)
    return {"conversations": items}


@router.put("/{conv_id}")
def rename(conv_id: int, payload: dict = Body(...),
           username: str = Depends(current_user)) -> dict:
    title = _plain(payload.get("title"), MAX_TITLE)
    if not title:
        raise HTTPException(status_code=400, detail="ten phong khong duoc de trong")
    with _conn() as conn:
        kind, _ = _require_member(conn, conv_id, username)
        if kind != "group":
            raise HTTPException(status_code=400, detail="khong doi ten duoc")
        conn.execute("UPDATE chat_conversation SET title = %s WHERE id = %s",
                     (title, conv_id))
        conn.commit()
        items = _conv_list(conn, username)
    _publish({"t": "conv", "conv": conv_id})
    return {"conversations": items}


# ===========================================================================
#  Tin nhan
# ===========================================================================
def _msg_row(r) -> dict:
    mid, sender, sname, body, image, created, deleted = r
    return {"id": mid, "sender": sender, "senderName": sname or sender,
            "body": "" if deleted else body, "image": "" if deleted else image,
            "at": created.isoformat(), "deleted": deleted}


@router.get("/{conv_id}/messages")
def messages(conv_id: int, before: int = 0,
             username: str = Depends(current_user)) -> dict:
    """Tin cu hon `before` (0 = moi nhat). Tra theo thu tu cu -> moi."""
    with _conn() as conn:
        _require_member(conn, conv_id, username)
        sql = ("SELECT id, sender, sender_name, body, image, created_at, deleted "
               "FROM chat_message WHERE conv_id = %s")
        args: list[Any] = [conv_id]
        if before:
            sql += " AND id < %s"
            args.append(before)
        sql += " ORDER BY id DESC LIMIT %s"
        args.append(PAGE + 1)
        rows = conn.execute(sql, tuple(args)).fetchall()
        more = len(rows) > PAGE
        rows = rows[:PAGE]
    return {"messages": [_msg_row(r) for r in reversed(rows)], "more": more}


def _push_new_message(conn, conv_id: int, sender: str, sender_name: str,
                      body: str, image: str) -> None:
    """Web Push cho thanh vien KHONG con mo portal (khong co WebSocket song).

    Ai dang mo portal thi chinh trang bao bang Notification cua tab (xem
    chat.service.ts) — day them push nua se hien hai lan cung mot tin. Ai dong
    tab roi thi truoc day KHONG nhan duoc gi ca, day la cho vua bit."""
    others = [u for (u,) in conn.execute(
        "SELECT username FROM chat_member WHERE conv_id = %s AND username <> %s",
        (conv_id, sender)).fetchall()]
    if not others:
        return
    online = _online(conn, others)
    offline = [u for u in others if u not in online]
    if not offline:
        return
    row = conn.execute("SELECT kind, title FROM chat_conversation WHERE id = %s",
                       (conv_id,)).fetchone()
    title = sender_name or sender
    if row and row[0] == "group" and row[1]:
        title = f"{title} · {row[1]}"
    preview = body[:120] if body else ("📷 Đã gửi một ảnh" if image else "")
    for who in offline:
        _queue_push(who, title, preview, "/chat", f"avp-chat-{conv_id}")


@router.post("/{conv_id}/messages")
def send(conv_id: int, payload: dict = Body(...),
         username: str = Depends(current_user)) -> dict:
    body = _plain(payload.get("body"), MAX_BODY)
    image = _image_url(payload.get("image"))
    if not body and not image:
        raise HTTPException(status_code=400, detail="tin nhan trong")
    with _conn() as conn:
        _require_member(conn, conv_id, username)
        r = conn.execute(
            "INSERT INTO chat_message (conv_id, sender, sender_name, body, image) "
            "VALUES (%s,%s,%s,%s,%s) "
            "RETURNING id, sender, sender_name, body, image, created_at, deleted",
            (conv_id, username, _name_of(username), body, image)).fetchone()
        conn.execute("UPDATE chat_conversation SET last_at = now() WHERE id = %s",
                     (conv_id,))
        # Nguoi gui coi nhu da doc den chinh tin minh vua gui.
        conn.execute("UPDATE chat_member SET last_read_at = now() "
                     "WHERE conv_id = %s AND username = %s", (conv_id, username))
        conn.commit()
        bump_metric("chat_message")
        _push_new_message(conn, conv_id, username, _name_of(username), body, image)
    msg = _msg_row(r)
    _publish({"t": "msg", "conv": conv_id, "msg": msg["id"]})
    return {"message": msg}


@router.delete("/message/{mid}")
def delete_message(mid: int, username: str = Depends(current_user)) -> dict:
    """Thu hoi tin cua minh (IS thu hoi duoc tin bat ky). Giu bia mo cho khoi
    thung luong hoi thoai."""
    with _conn() as conn:
        r = conn.execute("SELECT conv_id, sender FROM chat_message WHERE id = %s",
                         (mid,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="khong co tin nhan nay")
        conv_id, sender = r
        _require_member(conn, conv_id, username)
        if sender != username and not is_editor(username):
            raise HTTPException(status_code=403, detail="ban khong thu hoi duoc tin nay")
        conn.execute("UPDATE chat_message SET deleted = true, body = '', image = '' "
                     "WHERE id = %s", (mid,))
        conn.commit()
    _publish({"t": "msg", "conv": conv_id, "msg": mid})
    return {"ok": True}


@router.post("/{conv_id}/read")
def mark_read(conv_id: int, username: str = Depends(current_user)) -> dict:
    with _conn() as conn:
        _require_member(conn, conv_id, username)
        conn.execute("UPDATE chat_member SET last_read_at = now() "
                     "WHERE conv_id = %s AND username = %s", (conv_id, username))
        conn.commit()
    _publish({"t": "read", "conv": conv_id, "by": username})
    return {"ok": True}


@router.post("/image")
def upload_image(file: UploadFile = File(...),
                 username: str = Depends(current_user)) -> dict:
    data = read_upload(file.file, MAX_IMAGE)
    return {"url": save_jpeg(data, CHAT_DIR, CHAT_URL, box=CHAT_BOX)}


# ===========================================================================
#  Ve vao WebSocket
# ===========================================================================
@router.get("/ws-ticket")
def ws_ticket(username: str = Depends(current_user)) -> dict:
    """Ve dung mot lan de mo WebSocket (xem giai thich dau file)."""
    token = secrets.token_urlsafe(32)
    with _conn() as conn:
        conn.execute(f"DELETE FROM chat_ws_ticket WHERE created_at < now() "
                     f"- interval '{TICKET_TTL} seconds'")
        conn.execute("INSERT INTO chat_ws_ticket (token, username) VALUES (%s,%s)",
                     (token, username))
        conn.commit()
    return {"ticket": token, "ttl": TICKET_TTL}


def _redeem(token: str) -> str | None:
    """Doi ve lay username. Ve bien mat ngay khi dung (dung mot lan)."""
    if not token or len(token) > 128:
        return None
    try:
        with _conn() as conn:
            r = conn.execute(
                "DELETE FROM chat_ws_ticket WHERE token = %s AND created_at > now() "
                f"- interval '{TICKET_TTL} seconds' RETURNING username",
                (token,)).fetchone()
            conn.commit()
            return r[0] if r else None
    except Exception:
        return None


# ===========================================================================
#  Duong truyen giua cac worker (PostgreSQL LISTEN/NOTIFY)
# ===========================================================================
# Socket dang mo CUA RIENG worker nay: {username: {WebSocket, ...}}
_live: dict[str, set[WebSocket]] = {}
_loop: asyncio.AbstractEventLoop | None = None


def _publish(event: dict) -> None:
    """Bao cho MOI worker (ke ca chinh minh) rang co viec moi.

    Goi tin chi mang ID; noi dung do tung worker doc lai tu DB. Loi o day
    khong duoc lam hong request dang chay — cung lam la tin den cham.
    """
    try:
        with _conn() as conn:
            conn.execute("SELECT pg_notify(%s, %s)",
                         (NOTIFY_CHANNEL, json.dumps(event, ensure_ascii=False)))
            conn.commit()
    except Exception as exc:
        log.warning("chat: khong publish duoc (%s)", type(exc).__name__)


async def _fanout(event: dict) -> None:
    """Nhan mot su kien tu kenh NOTIFY, day xuong cac socket cua worker nay."""
    conv_id = event.get("conv")
    kind = event.get("t")
    targets: list[str] = event.get("to") or []
    if conv_id and not targets:
        targets = await asyncio.to_thread(_members_of, conv_id)
    if not targets:
        return
    # Chi lam viec khi worker nay that su co ai dang noi.
    here = [u for u in targets if _live.get(u)]
    if not here:
        return

    payload: dict = {"type": kind, "convId": conv_id}
    if kind == "msg":
        row = await asyncio.to_thread(_load_message, int(event["msg"]))
        if row is None:
            return
        payload["message"] = row
    elif kind == "typing":
        payload["user"] = event.get("by")
        payload["name"] = event.get("name")
    elif kind == "read":
        payload["user"] = event.get("by")
    elif kind == "presence":
        payload["user"] = event.get("by")
        payload["online"] = event.get("online")

    data = json.dumps(payload, ensure_ascii=False)
    for user in here:
        for ws in list(_live.get(user, ())):
            # Nguoi go khong can nhan lai chinh tin hieu "dang go" cua minh.
            if kind == "typing" and event.get("by") == user:
                continue
            try:
                await ws.send_text(data)
            except Exception:
                _live.get(user, set()).discard(ws)


def _members_of(conv_id: int) -> list[str]:
    try:
        with _conn() as conn:
            return [r[0] for r in conn.execute(
                "SELECT username FROM chat_member WHERE conv_id = %s",
                (conv_id,)).fetchall()]
    except Exception:
        return []


def _load_message(mid: int) -> dict | None:
    try:
        with _conn() as conn:
            r = conn.execute(
                "SELECT id, sender, sender_name, body, image, created_at, deleted "
                "FROM chat_message WHERE id = %s", (mid,)).fetchone()
        return _msg_row(r) if r else None
    except Exception:
        return None


async def listener() -> None:
    """Nghe kenh NOTIFY suot doi worker; dut thi noi lai.

    Chay bang mot ket noi RIENG (autocommit) — psycopg yeu cau vay cho LISTEN.
    """
    global _loop
    _loop = asyncio.get_running_loop()
    delay = 1
    while True:
        try:
            aconn = await psycopg.AsyncConnection.connect(DSN, autocommit=True)
        except Exception as exc:
            log.warning("chat: chua ket noi duoc de nghe (%s)", type(exc).__name__)
            await asyncio.sleep(min(delay, 30))
            delay = min(delay * 2, 30)
            continue
        delay = 1
        try:
            await aconn.execute(f"LISTEN {NOTIFY_CHANNEL}")
            log.info("chat: dang nghe kenh %s", NOTIFY_CHANNEL)
            async for note in aconn.notifies():
                try:
                    await _fanout(json.loads(note.payload))
                except Exception as exc:
                    log.warning("chat: goi tin hong (%s)", type(exc).__name__)
        except Exception as exc:
            log.warning("chat: dut ket noi nghe (%s), noi lai", type(exc).__name__)
        finally:
            try:
                await aconn.close()
            except Exception:
                pass
        await asyncio.sleep(1)


# ===========================================================================
#  WebSocket
# ===========================================================================
def _touch_presence(username: str, online: bool = True) -> None:
    try:
        with _conn() as conn:
            if online:
                conn.execute(
                    "INSERT INTO chat_presence (username, last_seen) VALUES (%s, now()) "
                    "ON CONFLICT (username) DO UPDATE SET last_seen = now()", (username,))
            else:
                conn.execute("DELETE FROM chat_presence WHERE username = %s", (username,))
            conn.commit()
    except Exception:
        pass


@ws_router.websocket("/chat")
async def chat_socket(ws: WebSocket, t: str = "") -> None:
    username = await asyncio.to_thread(_redeem, t)
    if not username:
        # Dong ngay, khong nhan byte nao cua ke khong co ve.
        await ws.close(code=4401)
        return
    await ws.accept()
    _live.setdefault(username, set()).add(ws)
    await asyncio.to_thread(_touch_presence, username, True)
    peers = await asyncio.to_thread(_peers_of, username)
    await asyncio.to_thread(_publish, {"t": "presence", "by": username,
                                       "online": True, "to": peers})
    try:
        await ws.send_text(json.dumps({"type": "ready", "user": username}))
        while True:
            raw = await ws.receive_text()
            if len(raw) > 4096:
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            kind = msg.get("t")
            if kind == "ping":
                await asyncio.to_thread(_touch_presence, username, True)
                await ws.send_text('{"type":"pong"}')
            elif kind == "typing":
                conv = msg.get("conv")
                if isinstance(conv, int):
                    # KHONG ghi DB: bao dang go la thu song nhanh, mat cung khong sao.
                    await asyncio.to_thread(
                        _publish, {"t": "typing", "conv": conv, "by": username,
                                   "name": _name_of(username)})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.info("chat: socket dut (%s)", type(exc).__name__)
    finally:
        socks = _live.get(username)
        if socks:
            socks.discard(ws)
            if not socks:
                _live.pop(username, None)
                await asyncio.to_thread(_touch_presence, username, False)
                peers = await asyncio.to_thread(_peers_of, username)
                await asyncio.to_thread(_publish, {"t": "presence", "by": username,
                                                   "online": False, "to": peers})


def _peers_of(username: str) -> list[str]:
    """Nhung nguoi co chung cuoc tro chuyen — chi bao trang thai cho ho."""
    try:
        with _conn() as conn:
            return [r[0] for r in conn.execute(
                "SELECT DISTINCT m2.username FROM chat_member m1 "
                "JOIN chat_member m2 ON m2.conv_id = m1.conv_id "
                "WHERE m1.username = %s AND m2.username <> %s",
                (username, username)).fetchall()]
    except Exception:
        return []
