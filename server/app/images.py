"""Nhan anh nguoi dung tai len — dung chung cho ho so va tuong ca nhan.

NGUYEN TAC: khong bao gio ghi thang byte nguoi dung gui len xuong dia. Anh
duoc Pillow GIAI MA roi MA HOA LAI thanh JPEG, nen thu gi nhet kem trong file
(script, EXIF payload, file .php doi duoi .jpg) deu khong con sau khi luu.
File dat ten uuid4 => khong the ghi de file cua nguoi khac.
"""
from __future__ import annotations

import os
import re
import uuid

from fastapi import HTTPException

MAX_IMAGE = 8 * 1024 * 1024
_OWN_FILE = re.compile(r"^[0-9a-f]{32}\.jpg$")


def read_upload(file, limit: int = MAX_IMAGE) -> bytes:
    """Doc file tai len, chan ngay neu qua kich thuoc cho phep."""
    data = file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="file rong")
    if len(data) > limit:
        raise HTTPException(status_code=400,
                            detail=f"ảnh vượt quá {limit // (1024 * 1024)}MB")
    return data


def save_jpeg(data: bytes, out_dir: str, url_prefix: str, *,
              square: int | None = None, box: tuple[int, int] | None = None,
              centering: tuple[float, float] = (0.5, 0.42),
              quality: int = 86) -> str:
    """Ghi anh da chuan hoa, tra ve duong dan web.

    square: cat vuong canh N (dung cho avatar).
    box:    thu nho vua khung (w, h), giu ti le.
    """
    from io import BytesIO
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(BytesIO(data)) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            if square:
                im = ImageOps.fit(im, (square, square), Image.LANCZOS,
                                  centering=centering)
            elif box:
                im.thumbnail(box, Image.LANCZOS)
            os.makedirs(out_dir, exist_ok=True)
            name = uuid.uuid4().hex + ".jpg"
            tmp = os.path.join(out_dir, f".{name}.tmp")
            im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
            # Ghi tam roi doi ten: khong bao gio serve phai file dang viet do.
            os.replace(tmp, os.path.join(out_dir, name))
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="khong doc duoc anh (file hong hoac khong phai anh)") from exc
    return f"{url_prefix}/{name}"


def drop(url: str, out_dir: str, url_prefix: str) -> None:
    """Xoa anh cu cho khoi tich rac. Chi dong toi file do CHINH portal sinh ra
    (ten uuid, dung thu muc) — chuoi la thi bo qua."""
    if not url or not url.startswith(url_prefix + "/"):
        return
    name = os.path.basename(url)
    if not _OWN_FILE.fullmatch(name):
        return
    try:
        os.remove(os.path.join(out_dir, name))
    except OSError:
        pass
