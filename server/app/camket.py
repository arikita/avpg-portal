"""Ky cam ket bao mat thong tin (/onboarding/cam-ket) — 04/09/2026.

VI SAO CO FILE NAY: nhan vien moi duoc phong IT training, lam bai kiem tra
(/onboarding/kiem-tra), roi ky cam ket bao mat. Truoc day buoc ky la giay:
in ra, ky tay, scan, cat tu — nen khong ai tra loi duoc "ai chua ky" ma khong
lat tu ho so. Bang `cam_ket` tra loi dung cau do.

He thong ky la Documenso self-hosted san co (sign.anvietphatgroup.com, tren
hcm-procsvr .130). Portal KHONG tu lam chu ky so — no chi tao tai lieu, nhung
khung ky cua Documenso vao trang, roi hoi lai trang thai.

BON QUYET DINH THIET KE, deu co ly do:

  1. PORTAL TU DAP DANH TINH VAO PDF, KHONG DE DOCUMENSO DIEN.
     Font ma Documenso dung de dap chu vao PDF chi phu Latin-1: "Nguyen Van
     Thu" co dau ra "Nguy?n V?n Th?", "thu nghiem" ra "th? nghi?m" (a e o chay,
     a u e thi khong). Do that tren ban da ky ngay 04/09/2026, khong phai suy
     doan. Mot ban cam ket ghi sai ten nguoi ky la mot ban cam ket vo gia tri.
     Nen portal dap 5 dong danh tinh vao PDF bang font co tieng Viet TRUOC khi
     day len; Documenso chi con dap anh chu ky va ngay dd/MM/yyyy — toan ASCII.
     Loi them: danh tinh nam han trong PDF, khong ai sua duoc, chac hon co
     `readOnly` cua Documenso.

  2. MOI NGUOI MOT TAI LIEU RIENG, KHONG DUNG TEMPLATE.
     He qua truc tiep cua (1): PDF khac nhau tung nguoi thi khong the dung
     chung mot template. Template #4 tren Documenso chi de NGUOI xem truoc
     trong giao dien Documenso — PORTAL KHONG DUNG NO. Sua template do khong
     doi duoc gi o day; noi dung nam o docs/cam-ket-bao-mat.pdf.

  3. TOA DO O KY DOC TU FILE, KHONG GO TAY.
     `docs/cam-ket-fields.json` do `tools/build_cam_ket_pdf.mjs` sinh ra moi
     lan render. Noi dung ban cam ket con duoc sua; them mot dong o Dieu 5 la
     khoi ky truot xuong ma PDF van trong binh thuong — chi den luc nhan vien
     ky moi thay chu ky nam de len chu.

  4. KHONG DUNG WEBHOOK.
     Trang thai ky doc thang tu Documenso khi nguoi dung mo trang
     (`_dong_bo`). Webhook them mot duong vao phai mo, phai xac thuc, va phai
     dung day khi Documenso restart — trong khi so nguoi ky la vai nguoi moi
     thang. Doi lai: trang thai chi cap nhat khi co ai do nhin vao, du cho
     bang "ai chua ky".

AI PHAI KY: tai khoan AD tao TU `CAM_KET_TU_NGAY` tro di (mac dinh
2026-09-04, ngay user chot). Nguoi vao truoc do khong thay gi ca — day la
yeu cau cua user, khong phai gioi han ky thuat. Doi mot bien moi trong
/etc/avp-portal-api.env la mo rong duoc, nho `systemctl restart` chu khong
`reload`.

BANG: xem `server/schema_camket.sql`. File nay VAN tu tao bang neu chua co
(`_ensure`) — nho bai hoc quiz_attempt: deploy quen chay psql thi nguoi ky
xong gap 500. Va nho `ALTER TABLE ... OWNER TO avpportal` neu tao bang bang
`sudo -u postgres psql`.
"""
from __future__ import annotations

import io
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from typing import Any

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException

from .ad import get_user

router = APIRouter(prefix="/api/cam-ket", tags=["cam-ket"])

DSN = os.environ.get("DATABASE_URL", "")

# --- Documenso ---------------------------------------------------------------
BASE = os.environ.get("DOCUMENSO_BASE", "https://sign.anvietphatgroup.com").rstrip("/")
KEY = os.environ.get("DOCUMENSO_API_KEY", "")

#: Gui email moi ky hay khong. Mac dinh KHONG: portal la kenh duy nhat, va
#: giao dien Documenso khong co tieng Viet nen mot email tieng Anh tu he thong
#: la thu de lam nhan vien moi hoang mang hon la nhac viec. Email BAO HOAN TAT
#: (kem ban da ky) van duoc gui du dat NONE — do la email dang gui.
GUI_EMAIL = os.environ.get("CAM_KET_GUI_EMAIL", "").strip().lower() in ("1", "true", "yes")

#: Ai phai ky: tai khoan AD tao tu ngay nay tro di (YYYY-MM-DD).
TU_NGAY = os.environ.get("CAM_KET_TU_NGAY", "2026-09-04")

# --- File nguon --------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))


def _tim(ten: str, bien: str) -> str:
    """PDF goc / toa do o. Tim CA HAI cho vi hai moi truong dat khac nhau:

      - trong kho git thi chung nam o `docs/`
      - tren server thi /opt/avp-portal-api/app khong co thu muc docs/, deploy
        copy sang canh module

    Tim ca hai chu khong bat deploy phai nho: quen mot buoc copy thi nguoi dau
    tien bam Ky gap 500, va loi do khong xuat hien o bat ky test nao.
    """
    tu_env = os.environ.get(bien, "")
    for p in (tu_env,
              os.path.join(_HERE, ten),
              os.path.join(_HERE, "..", "..", "docs", ten)):
        if p and os.path.exists(p):
            return os.path.abspath(p)
    return tu_env or os.path.join(_HERE, ten)


PDF_PATH = _tim("cam-ket-bao-mat.pdf", "CAM_KET_PDF")
FIELDS_PATH = _tim("cam-ket-fields.json", "CAM_KET_FIELDS")

#: Font de dap chu — BAT BUOC phu tieng Viet (xem ghi chu (1) dau file).
#: Liberation Serif hop voi than tai lieu; DejaVu la duong lui vi goi
#: fonts-dejavu-core gan nhu may Ubuntu nao cung co.
FONT_UNG_VIEN = [
    os.environ.get("CAM_KET_FONT", ""),
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

#: Cac o portal tu dap. Phan con lai (chu ky, ngay ky) de Documenso lo.
TU_DAP = ("ho_ten", "chuc_danh", "phong_ban", "email", "ho_ten_2")
#: Cac o giao cho Documenso.
DOCUMENSO_DAP = ("chu_ky", "ngay_ky")

_SAFE_USER = re.compile(r"[A-Za-z0-9._-]{1,64}")


# ---------------------------------------------------------------- nguoi dung --
def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _ngay_tao(info: dict) -> str:
    """AD whenCreated `20260904071233.0Z` -> `2026-09-04`. Rong neu khong doc duoc."""
    m = re.match(r"(\d{4})(\d{2})(\d{2})", info.get("whenCreated") or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def _thuoc_dien(info: dict) -> bool:
    """Nguoi nay co phai ky khong: tai khoan AD tao tu TU_NGAY tro di.

    Khong doc duoc whenCreated thi tra False — tha bo sot con hon dua ca cong
    ty vao dien phai ky vi mot loi tra cuu LDAP.
    """
    ngay = _ngay_tao(info)
    return bool(ngay) and ngay >= TU_NGAY


# ------------------------------------------------------------------- dap PDF --
_font_name: str | None = None


def _font() -> str:
    """Dang ky font mot lan. Loi RO RANG neu may chua cai font nao co tieng Viet."""
    global _font_name
    if _font_name:
        return _font_name
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    for path in FONT_UNG_VIEN:
        if path and os.path.exists(path):
            pdfmetrics.registerFont(TTFont("CamKet", path))
            _font_name = "CamKet"
            return _font_name
    raise HTTPException(
        status_code=500,
        detail="khong tim thay font co tieng Viet de dap vao PDF — "
               "cai `apt install fonts-liberation` hoac dat CAM_KET_FONT")


def _o_dap() -> list[dict]:
    """Toa do cac o, doc tu file do build_cam_ket_pdf.mjs sinh ra."""
    with open(FIELDS_PATH, encoding="utf-8") as fh:
        return json.load(fh)["fields"]


def _dap_pdf(gia_tri: dict[str, str]) -> bytes:
    """Dap danh tinh vao PDF goc bang font co tieng Viet. Xem ghi chu (1).

    Moi trang mot lop phu; `showPage()` BAT BUOC goi ke ca khi trang do khong
    co o nao, khong thi reportlab sinh ra it trang hon ban goc va merge lech.
    """
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    font = _font()
    so_trang = len(PdfReader(PDF_PATH).pages)
    W, H = A4
    o = _o_dap()

    phu = []
    for trang in range(1, so_trang + 1):
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont(font, 11)
        for f in o:
            if f["pageNumber"] != trang or f["key"] not in gia_tri:
                continue
            val = (gia_tri.get(f["key"]) or "").strip()
            if not val:
                continue
            x = f["pageX"] / 100 * W
            # pageY tinh tu MEP TREN xuong (goc toa do cua Documenso), con
            # reportlab tinh tu mep duoi len — nen phai lat. 0.78 la duong co
            # chu trong o cao `height`, canh cho chu ngoi tren net gach.
            y = H - (f["pageY"] / 100 * H) - (f["height"] / 100 * H) * 0.78
            c.drawString(x + 4, y, val)
        c.showPage()
        c.save()
        buf.seek(0)
        phu.append(PdfReader(buf).pages[0])

    # `clone_from` gan trang vao writer TRUOC khi merge. Cach cu (merge roi
    # add_page) bi pypdf danh dau la khong dang tin cay va se bo o pypdf 7.
    ra = PdfWriter(clone_from=PDF_PATH)
    for i, trang in enumerate(ra.pages):
        trang.merge_page(phu[i])
    out = io.BytesIO()
    ra.write(out)
    return out.getvalue()


# ------------------------------------------------------------- goi Documenso --
def _api(method: str, path: str, body: Any = None,
         raw: bytes | None = None, ctype: str | None = None) -> Any:
    if not KEY:
        raise HTTPException(status_code=503,
                            detail="chua cau hinh DOCUMENSO_API_KEY")
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(f"{BASE}/api/v2{path}", data=data, method=method)
    req.add_header("Authorization", KEY)
    req.add_header("Content-Type", ctype or "application/json")
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body_bytes = resp.read()
            if resp.headers.get("content-type", "").startswith("application/pdf"):
                return body_bytes
            return json.loads(body_bytes or b"null")
    except urllib.error.HTTPError as exc:                      # noqa: PERF203
        chi_tiet = exc.read().decode("utf-8", "replace")[:300]
        raise HTTPException(status_code=502,
                            detail=f"Documenso tra {exc.code}: {chi_tiet}") from exc
    except Exception as exc:                                   # noqa: BLE001
        raise HTTPException(status_code=502,
                            detail=f"khong goi duoc Documenso: {exc}") from exc


def _multipart(path: str, payload: dict, ten_file: str, noi_dung: bytes) -> Any:
    b = uuid.uuid4().hex
    parts = [
        f'--{b}\r\nContent-Disposition: form-data; name="payload"\r\n'
        f'Content-Type: application/json\r\n\r\n{json.dumps(payload)}\r\n'.encode(),
        f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{ten_file}"\r\n'
        f'Content-Type: application/pdf\r\n\r\n'.encode(),
        noi_dung,
        f'\r\n--{b}--\r\n'.encode(),
    ]
    return _api("POST", path, raw=b"".join(parts),
                ctype=f"multipart/form-data; boundary={b}")


def _tao_tai_lieu(username: str, info: dict) -> tuple[int, str]:
    """Dap PDF -> tao tai lieu -> dat 2 o -> phat hanh. Tra (documentId, token)."""
    ho_ten = (info.get("fullName") or username).strip()
    email = (info.get("mail") or "").strip()
    if not email:
        # Documenso bat buoc co email cho nguoi ky. Tai khoan AD thieu truong
        # `mail` thi khong ky duoc — bao ro chu dung tu bia mot dia chi.
        raise HTTPException(status_code=409,
                            detail="tai khoan AD chua co dia chi email, "
                                   "lien he phong Cong nghe thong tin")

    pdf = _dap_pdf({
        "ho_ten": ho_ten,
        "ho_ten_2": ho_ten,
        "chuc_danh": (info.get("title") or "").strip(),
        "phong_ban": (info.get("department") or "").strip(),
        "email": email,
    })

    made = _multipart("/document/create", {
        "title": f"Cam kết bảo mật — {ho_ten}",
        # Dai externalId rieng. Tren he thong da co tai lieu dai `pr-*` cua ben
        # mua hang; `camket-` de hai ben khong bao gio dam nhau.
        "externalId": f"camket-{username}",
        "visibility": "EVERYONE",
        "recipients": [{"email": email, "name": ho_ten,
                        "role": "SIGNER", "signingOrder": 1}],
        "meta": {
            "subject": "Bản cam kết bảo mật thông tin — Tập đoàn An Việt Phát",
            "message": ("Chào bạn,\n\nĐây là bản cam kết bảo mật thông tin cần ký sau "
                        "buổi training của phòng Công nghệ thông tin. Bạn có thể ký ngay "
                        "trên portal nội bộ, mục Hội nhập.\n\nPhòng Công nghệ thông tin"),
            "dateFormat": "dd/MM/yyyy",
            "timezone": "Asia/Ho_Chi_Minh",
            # Documenso khong co tieng Viet (enum chi de/en/fr/es/it/nl/pl/
            # pt-BR/ja/ko/zh). Nut cua no se la tieng Anh; portal boc tieng
            # Viet ben ngoai khung ky.
            "language": "en",
            "typedSignatureEnabled": True,
            "drawSignatureEnabled": True,
            # Bo tai anh chu ky: khong ai co san file chu ky, ma bat tai la
            # mot buoc du de nguoi ta bo cuoc giua chung.
            "uploadSignatureEnabled": False,
        },
    }, f"cam-ket-{username}.pdf", pdf)
    doc_id = int(made["id"])

    # /document/create chi tra {id, envelopeId} — phai hoi lai de biet
    # recipientId truoc khi dat o.
    doc = _api("GET", f"/document/{doc_id}")
    rid = doc["recipients"][0]["id"]

    fields = []
    for f in _o_dap():
        if f["key"] not in DOCUMENSO_DAP:
            continue
        meta: dict[str, Any] = {"type": f["type"].lower(), "required": True}
        if f["type"] != "SIGNATURE":
            meta["label"] = f["label"]
            meta["fontSize"] = 11
        fields.append({"type": f["type"], "fieldMeta": meta, "recipientId": rid,
                       "pageNumber": f["pageNumber"], "pageX": f["pageX"],
                       "pageY": f["pageY"], "width": f["width"], "height": f["height"]})
    _api("POST", "/document/field/create-many", {"documentId": doc_id, "fields": fields})

    _api("POST", "/document/distribute", {
        "documentId": doc_id,
        "meta": {"distributionMethod": "EMAIL" if GUI_EMAIL else "NONE"},
    })

    doc = _api("GET", f"/document/{doc_id}")
    return doc_id, doc["recipients"][0]["token"]


def _trang_thai_documenso(doc_id: int) -> tuple[str, str]:
    """(signingStatus, signedAt ISO) cua nguoi ky dau tien."""
    doc = _api("GET", f"/document/{doc_id}")
    r = (doc.get("recipients") or [{}])[0]
    return r.get("signingStatus") or "", r.get("signedAt") or ""


# --------------------------------------------------------------------- bang --
def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


_ready = False


def _ensure(conn) -> None:
    global _ready
    if _ready:
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cam_ket (
          username    text        PRIMARY KEY,
          full_name   text        NOT NULL DEFAULT '',
          department  text        NOT NULL DEFAULT '',
          email       text        NOT NULL DEFAULT '',
          joined_at   date,
          document_id bigint,
          token       text        NOT NULL DEFAULT '',
          status      text        NOT NULL DEFAULT 'DANG_KY',
          created_at  timestamptz NOT NULL DEFAULT now(),
          signed_at   timestamptz
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS cam_ket_status_idx "
                 "ON cam_ket (status, created_at DESC)")
    conn.commit()
    _ready = True


def _dong(conn, username: str) -> dict | None:
    row = conn.execute(
        "SELECT username, full_name, department, email, document_id, token, "
        "       status, signed_at FROM cam_ket WHERE username = %s",
        (username,)).fetchone()
    if not row:
        return None
    keys = ("username", "fullName", "department", "email", "documentId",
            "token", "status", "signedAt")
    d = dict(zip(keys, row))
    d["signedAt"] = d["signedAt"].isoformat() if d["signedAt"] else ""
    return d


def _dong_bo(conn, dong: dict) -> dict:
    """Hoi Documenso xem da ky chua roi ghi lai. Xem ghi chu (4) dau file.

    Documenso chet KHONG duoc lam hong trang: tra ve trang thai dang luu.
    """
    if dong["status"] == "DA_KY" or not dong.get("documentId"):
        return dong
    try:
        status, signed_at = _trang_thai_documenso(int(dong["documentId"]))
    except Exception:                                          # noqa: BLE001
        return dong
    if status == "SIGNED":
        conn.execute("UPDATE cam_ket SET status = 'DA_KY', signed_at = "
                     "coalesce(%s::timestamptz, now()) WHERE username = %s",
                     (signed_at or None, dong["username"]))
        conn.commit()
        dong["status"] = "DA_KY"
        dong["signedAt"] = signed_at
    elif status == "REJECTED":
        conn.execute("UPDATE cam_ket SET status = 'TU_CHOI' WHERE username = %s",
                     (dong["username"],))
        conn.commit()
        dong["status"] = "TU_CHOI"
    return dong


def _tra_ve(dong: dict | None, info: dict, thuoc_dien: bool) -> dict:
    """Hinh dang tra ve cho frontend. KHONG bao gio kem token cua nguoi khac."""
    return {
        "apDung": thuoc_dien,
        "tuNgay": TU_NGAY,
        "joinedAt": _ngay_tao(info),
        "fullName": (info.get("fullName") or "").strip(),
        "department": (info.get("department") or "").strip(),
        "title": (info.get("title") or "").strip(),
        "email": (info.get("mail") or "").strip(),
        "status": (dong or {}).get("status", "CHUA_KY"),
        "signedAt": (dong or {}).get("signedAt", ""),
        "signUrl": (f"{BASE}/embed/sign/{dong['token']}"
                    if dong and dong.get("token") and dong.get("status") != "DA_KY" else ""),
    }


# ------------------------------------------------------------------ endpoint --
@router.get("")
def trang_thai(username: str = Depends(current_user)) -> dict:
    """Trang thai cua CHINH nguoi dang dang nhap.

    Chi tra token ky cua chinh ho. Token la thu duy nhat can de ky thay nguoi
    khac, nen no khong duoc xuat hien o bat ky endpoint nao khac — ke ca
    /api/admin/cam-ket.
    """
    info = get_user(username) or {}
    thuoc = _thuoc_dien(info)
    dong = None
    try:
        with _conn() as conn:
            _ensure(conn)
            dong = _dong(conn, username)
            if dong:
                dong = _dong_bo(conn, dong)
    except Exception:                                          # noqa: BLE001
        # DB hong thi van hien trang, mat phan "da ky chua".
        pass
    return _tra_ve(dong, info, thuoc)


@router.post("/ky")
def bat_dau_ky(username: str = Depends(current_user)) -> dict:
    """Tao tai lieu (neu chua co) va tra ve duong dan khung ky.

    Goi lai nhieu lan KHONG tao them tai lieu: bang khoa theo username, va
    Documenso cung nhan externalId `camket-<username>`. Nguoi dung bam nut hai
    lan, hay mo hai tab, deu ra cung mot ban.
    """
    if not _SAFE_USER.fullmatch(username):
        raise HTTPException(status_code=400, detail="ten dang nhap khong hop le")
    info = get_user(username) or {}
    if not _thuoc_dien(info):
        raise HTTPException(
            status_code=403,
            detail=f"ban cam ket ap dung cho tai khoan tao tu {TU_NGAY} tro di")

    with _conn() as conn:
        _ensure(conn)
        dong = _dong(conn, username)
        if dong:
            dong = _dong_bo(conn, dong)
            if dong["status"] == "DA_KY" or dong.get("token"):
                return _tra_ve(dong, info, True)

        doc_id, token = _tao_tai_lieu(username, info)
        conn.execute("""
            INSERT INTO cam_ket (username, full_name, department, email,
                                 joined_at, document_id, token, status)
                 VALUES (%s, %s, %s, %s, %s, %s, %s, 'DANG_KY')
            ON CONFLICT (username) DO UPDATE
                    SET document_id = excluded.document_id,
                        token = excluded.token,
                        status = 'DANG_KY'
        """, (username, (info.get("fullName") or username).strip(),
              (info.get("department") or "").strip(),
              (info.get("mail") or "").strip(),
              _ngay_tao(info) or None, doc_id, token))
        conn.commit()
        dong = _dong(conn, username)

    return _tra_ve(dong, info, True)


@router.get("/ban-da-ky")
def tai_ban_da_ky(username: str = Depends(current_user)):
    """Tai ban PDF da ky cua CHINH minh.

    Doc thang tu Documenso chu khong luu ban thu hai o portal: dia .136 chi
    ~19GB, va hai noi giu cung mot van ban la hai noi co the lech nhau.
    """
    from fastapi import Response

    with _conn() as conn:
        _ensure(conn)
        dong = _dong(conn, username)
        if dong:
            dong = _dong_bo(conn, dong)
    if not dong or dong["status"] != "DA_KY" or not dong.get("documentId"):
        raise HTTPException(status_code=404, detail="chua co ban da ky")

    pdf = _api("GET", f"/document/{int(dong['documentId'])}/download")
    if not isinstance(pdf, bytes):
        raise HTTPException(status_code=502, detail="Documenso khong tra ve PDF")
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition":
                 f'attachment; filename="cam-ket-bao-mat-{username}.pdf"'})
