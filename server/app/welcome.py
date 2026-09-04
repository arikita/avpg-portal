"""Endpoint anh chao mung — /api/tuyen-dung/anh-chao-mung (04/09/2026).

CHI CO ROUTE o day. Toan bo phan ve anh nam o `welcome_anh.py` vi file nay
khai `Form()`, keo theo `python-multipart` — goi chi co trong venv tren .136.
Gop lai thi test tren may dev khong import duoc va se SKIP IM LANG.

HANG RAO O DAY LA HANG RAO THAT, khac voi trang /tuyen-dung (chi loc hien thi
o trinh duyet): endpoint nay nhan file tai len va ton CPU de ghep anh.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Response, UploadFile

from .ad import get_user
from .welcome_anh import MAX_ANH, duoc_dung, ngay_dmy, sach, ve_anh

router = APIRouter(prefix="/api/tuyen-dung", tags=["tuyen-dung"])


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _require_tuyen_dung(username: str = Depends(current_user)) -> str:
    """Hang rao THAT — xem ghi chu (1) dau file.

    Loc theo `department` cua AD chu khong theo nhom bao mat: nhom
    `Human Resources` con chua nguoi ngoai phong va 40 tai khoan da nghi.
    """
    try:
        info = get_user(username) or {}
    except Exception:                                          # noqa: BLE001
        info = {}
    if not duoc_dung(info.get("department")):
        raise HTTPException(status_code=403,
                            detail="chi phong Nhan su va Cong nghe thong tin")
    return username


@router.post("/anh-chao-mung")
async def anh_chao_mung(
    image: UploadFile,
    name: str = Form(""),
    position: str = Form(""),
    department: str = Form(""),
    phone: str = Form(""),
    startDate: str = Form(""),
    gender: str = Form(""),
    username: str = Depends(_require_tuyen_dung),
) -> Any:
    """Ghep anh chao mung, tra ve PNG. Khong luu gi — xem ghi chu (4) dau file."""
    raw = await image.read(MAX_ANH + 1)
    if len(raw) > MAX_ANH:
        raise HTTPException(status_code=413, detail="anh qua 5MB")
    if not raw:
        raise HTTPException(status_code=400, detail="chua chon anh dai dien")

    png = ve_anh({
        "ho_ten": sach(name),
        "chuc_vu": sach(position),
        "phong_ban": sach(department),
        "dien_thoai": sach(phone),
        "ngay_bat_dau": ngay_dmy(startDate),
    }, raw, nu=(gender or "").strip() == "Nữ")

    return Response(content=png, media_type="image/png",
                    headers={"Content-Disposition": 'inline; filename="chao-mung.png"'})
