"""Ve anh chao mung nhan vien moi — phan LOGIC THUAN (04/09/2026).

TACH KHOI `welcome.py` CO Y: file kia khai `Form()` nen keo theo
`python-multipart`, goi chi co trong venv tren .136. De chung mot cho thi
tren may dev module khong import duoc va `test_welcome.py` SKIP IM LANG —
dung cai bay da ghi trong CLAUDE.md o muc quyen bai dang. O day khong co
FastAPI route nao nen test chay duoc o moi may.

VI SAO KEO VE: truoc day viec nay do mot app rieng lam — frontend tren Vercel,
backend Express+Sharp tren Render, ca hai deu la ha tang cong cong ben ngoai.
Nghia la **anh chan dung that cua nhan vien that duoc tai len mot dich vu mien
phi o nuoc ngoai** moi lan dung. Anh khong bi luu lai (ghep xong tra ve ngay)
nhung no co di qua. Cong them backend goi mien phi ngu sau 15 phut khong dung
=> lan goi dau mat 30-60 giay, nguoi dung ngoi nhin man hinh khong biet la
hong hay dang chay.

Nay ghep ngay tren .136: anh khong roi mang noi bo, khong con cho khoi dong.

BON DIEU DANG BIET:

  1. DAY LA HANG RAO THAT, KHAC voi trang /tuyen-dung.
     Trang /tuyen-dung chi loc hien thi o trinh duyet (xem ghi chu dau
     features/recruit/recruit.ts) vi no khong co gi de bao ve. Endpoint nay
     THI CO: no nhan file tai len va ton CPU de ghep anh, nen phai chan o
     server. `_require_tuyen_dung` lam viec do.

  2. BO CUC CHEP NGUYEN tu ban Sharp/SVG cu — cung toa do, cung co chu, cung
     mau. Doi mot con so o day la anh ra khac ban ma moi nguoi da quen.
     Toa do trong SVG la DUONG CO CHU (baseline), nen Pillow phai ve bang
     `anchor="ls"`/`"ms"` chu khong phai mac dinh (goc tren-trai) — sai cho
     nay thi moi dong chu tut xuong dung mot khoang bang chieu cao chu.

  3. FONT PHILOSOPHER CO DU CHU VIET — da kiem truoc khi dung, khong tin
     suong. Font thieu glyph thi chu ra o vuong hoac mat dau ma khong bao gi,
     dung kieu hong da dinh voi Documenso sang nay.

  4. KHONG LUU GI CA. Anh vao, anh ra, het. Khong ghi dia, khong ghi DB.
     Anh chan dung nhan vien la du lieu ca nhan — khong luu thi khong phai
     nghi den chuyen giu bao lau va ai xoa.
"""
from __future__ import annotations

import io
import os
import re
from typing import Any

from fastapi import HTTPException

#: Phong ban duoc dung. Giong bo loc o frontend, nhung DAY moi la hang rao.
PHONG_DUOC_DUNG = {"information system", "human resources"}

_HERE = os.path.dirname(os.path.abspath(__file__))


def _tim_assets() -> str:
    """Thu muc tai nguyen. Tim ca hai cho vi hai moi truong dat khac nhau —
    cung ly do voi camket._tim(): trong kho git thi nam duoi server/app/assets,
    tren server thi deploy chep sang canh module."""
    for p in (os.environ.get("WELCOME_ASSETS", ""),
              os.path.join(_HERE, "assets", "welcome")):
        if p and os.path.isdir(p):
            return p
    return os.path.join(_HERE, "assets", "welcome")


ASSETS = _tim_assets()

# --- Bo cuc: chep nguyen tu ban SVG cu, xem ghi chu (2) dau file -------------
KHUNG = (1000, 700)
AVATAR = (200, 200)
AVATAR_TAI = (50, 100)          # left, top
LOGO_RONG = 300
LOGO_TAI = (520, 30)

MAU_TIEU_DE = "#054256"
MAU_TEN = "#ff0000"
MAU_DEN = "#000000"
MAU_CHAN = "#333333"

#: Nhan ben trai + toa do duong co chu. Thu tu giu nguyen ban cu.
DONG = [
    ("Họ và tên:", "ho_ten", 420, MAU_TEN),
    ("Chức vụ:", "chuc_vu", 450, MAU_DEN),
    ("Phòng ban:", "phong_ban", 480, MAU_DEN),
    ("Số điện thoại:", "dien_thoai", 510, MAU_DEN),
    ("Ngày bắt đầu:", "ngay_bat_dau", 540, MAU_DEN),
]

TIEU_DE_PHU = "Đại gia đình An Việt Phát hân hoan chào đón thành viên mới!"
CHAN_1 = ("An Việt Phát Group tin tưởng và kỳ vọng {xung} sẽ phát huy tối đa "
          "năng lực chuyên môn, không")
CHAN_2 = ("ngừng học hỏi, phát triển và gặt hái nhiều thành công trong quá "
          "trình đồng hành cùng Công ty.")

#: Chan rac. Anh 5MB giong ban cu; chuoi dai hon nay thi tran ra khoi khung.
MAX_ANH = 5 * 1024 * 1024
MAX_CHU = 80


def sach(s: str | None) -> str:
    """Bo ky tu dieu khien va cat bot. Khong can chong XML injection nhu ban
    cu — Pillow ve chu thang, khong ghep qua SVG, nen khong co cho de chen."""
    s = (s or "").strip()
    s = re.sub(r"[\x00-\x1f\x7f]", "", s)
    return s[:MAX_CHU]


def ngay_dmy(s: str | None) -> str:
    """`2026-09-04` -> `04-09-2026`. Sai dinh dang thi tra nguyen ban."""
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", (s or "").strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else sach(s)


def _font(dam: bool, co: int):
    from PIL import ImageFont
    ten = "Philosopher-Bold.ttf" if dam else "Philosopher-Regular.ttf"
    duong = os.path.join(ASSETS, ten)
    if not os.path.exists(duong):
        raise HTTPException(status_code=500, detail=f"thieu font {ten} trong {ASSETS}")
    return ImageFont.truetype(duong, co)


def ve_anh(gia_tri: dict[str, str], anh_goc: bytes, nu: bool) -> bytes:
    from PIL import Image, ImageDraw

    nen_p = os.path.join(ASSETS, "bg.jpg")
    logo_p = os.path.join(ASSETS, "logo.png")
    for p in (nen_p, logo_p):
        if not os.path.exists(p):
            raise HTTPException(status_code=500, detail=f"thieu tai nguyen {p}")

    nen = Image.open(nen_p).convert("RGB").resize(KHUNG, Image.LANCZOS)

    # Anh dai dien: cat vuong o giua roi bo tron (giong `fit: cover` cua Sharp).
    try:
        av = Image.open(io.BytesIO(anh_goc)).convert("RGB")
    except Exception as exc:                                   # noqa: BLE001
        raise HTTPException(status_code=400, detail="tep tai len khong phai anh") from exc
    canh = min(av.size)
    l = (av.width - canh) // 2
    t = (av.height - canh) // 2
    av = av.crop((l, t, l + canh, t + canh)).resize(AVATAR, Image.LANCZOS)
    mat_na = Image.new("L", AVATAR, 0)
    ImageDraw.Draw(mat_na).ellipse((0, 0, AVATAR[0] - 1, AVATAR[1] - 1), fill=255)
    nen.paste(av, AVATAR_TAI, mat_na)

    logo = Image.open(logo_p).convert("RGBA")
    logo = logo.resize((LOGO_RONG, round(logo.height * LOGO_RONG / logo.width)), Image.LANCZOS)
    nen.paste(logo, LOGO_TAI, logo)

    d = ImageDraw.Draw(nen)
    # `anchor="ls"` = neo theo DUONG CO CHU ben trai, "ms" = giua. Xem ghi chu (2).
    d.text((280, 280), "WELCOME NEW STAFF", font=_font(True, 50),
           fill=MAU_TIEU_DE, anchor="ls")
    d.text((500, 350), TIEU_DE_PHU, font=_font(True, 30), fill=MAU_DEN, anchor="ms")

    nhan_f, gt_f = _font(False, 24), _font(True, 24)
    for nhan, khoa, y, mau in DONG:
        d.text((50, y), nhan, font=nhan_f, fill=MAU_DEN, anchor="ls")
        d.text((250, y), gia_tri.get(khoa, ""), font=gt_f, fill=mau, anchor="ls")

    chan_f = _font(False, 20)
    xung = "Chị" if nu else "Anh"
    d.text((500, 600), CHAN_1.format(xung=xung), font=chan_f, fill=MAU_CHAN, anchor="ms")
    d.text((500, 628), CHAN_2, font=chan_f, fill=MAU_CHAN, anchor="ms")

    ra = io.BytesIO()
    nen.save(ra, format="PNG")
    return ra.getvalue()


def duoc_dung(department: str | None) -> bool:
    """Phong ban nay co duoc dung cong cu khong. Tach ra de test duoc ma khong
    phai dung toi FastAPI."""
    return (department or "").strip().lower() in PHONG_DUOC_DUNG
