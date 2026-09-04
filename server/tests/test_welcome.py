"""Test anh chao mung nhan vien moi — xem server/app/welcome_anh.py.

Import `welcome_anh` chu KHONG import `welcome`: file kia khai `Form()` nen keo
theo `python-multipart`, goi chi co trong venv tren .136. Import no o day thi
tren may dev ca file test SKIP IM LANG — dung cai bay CLAUDE.md da ghi o muc
quyen bai dang, va mot test bi skip im lang la mot test khong ton tai.

BA THU FILE NAY KHOA:

  1. CHU TIENG VIET TREN ANH. Font thieu glyph thi Pillow ve o vuong hoac bo
     dau, anh van ra du 1000x700 va van tai ve duoc — chi la ten nguoi moi bi
     sai. Dung kieu hong da dinh voi Documenso sang 04/09. Test doc NGUOC:
     ve anh voi mot ten day dau roi so vung pixel co chu voi anh nen trong.

  2. HANG RAO PHONG BAN. Sai chieu la mo cho ca 850 nguoi mot endpoint nhan
     file tai len.

  3. BO CUC KHONG TROI. Toa do chep tu ban Sharp/SVG cu; doi mot con so la anh
     ra khac ban moi nguoi da quen ma khong ai bao.
"""
from __future__ import annotations

import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))

from server.app import welcome_anh as w  # noqa: E402


def _anh_thu(mau=(30, 90, 160), co=(400, 400)) -> bytes:
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", co, mau).save(b, format="PNG")
    return b.getvalue()


GIA_TRI = {
    "ho_ten": "Nguyễn Thị Mai",
    "chuc_vu": "Chuyên viên Nhân sự",
    "phong_ban": "Nhân sự",
    "dien_thoai": "0901 234 567",
    "ngay_bat_dau": "04-09-2026",
}


class TestTaiNguyen:
    def test_co_du_goi(self):
        """Thieu Pillow thi FAIL chu khong SKIP — khong co no thi tinh nang
        khong chay duoc tren server."""
        import importlib
        assert importlib.util.find_spec("PIL"), (
            "thieu Pillow — `pip install Pillow` trong venv /opt/avp-portal-api")

    def test_co_du_4_tep_tai_nguyen(self):
        """Nen, logo va hai font. Thieu mot cai thi endpoint tra 500 trong khi
        module van import binh thuong — `cp *.py` khong dong toi thu muc con."""
        for ten in ("bg.jpg", "logo.png", "Philosopher-Regular.ttf",
                    "Philosopher-Bold.ttf"):
            assert os.path.exists(os.path.join(w.ASSETS, ten)), \
                f"thieu {ten} trong {w.ASSETS}"


class TestChuTiengViet:
    """Phep do quan trong nhat — xem ghi chu (1) dau file."""

    def test_font_co_du_dau_tieng_viet(self):
        """Doi font khac ma font do thieu dau thi chu ra o vuong, khong ai bao.
        Chon san cac chu NGOAI Latin-1 (ễ ă ử ệ ữ ị) vi do la phan bi mat —
        `â ê ô` van chay ke ca voi font hong nen khong dung de kiem duoc."""
        from PIL import Image, ImageDraw
        f = w._font(True, 40)
        for ky_tu in "ễăửệữịỗằẫ":
            anh = Image.new("L", (80, 80), 0)
            ImageDraw.Draw(anh).text((5, 5), ky_tu, font=f, fill=255)
            assert anh.getbbox() is not None, f"font khong ve duoc {ky_tu!r}"

    def test_ten_co_dau_hien_len_anh(self):
        """Ve hai lan — mot lan co ten, mot lan de trong — roi so. Vung chu
        phai KHAC nhau. Neu font nuot chu thi hai anh giong het."""
        from PIL import Image, ImageChops
        co_ten = Image.open(io.BytesIO(w.ve_anh(GIA_TRI, _anh_thu(), nu=True)))
        trong = dict(GIA_TRI, ho_ten="")
        khong = Image.open(io.BytesIO(w.ve_anh(trong, _anh_thu(), nu=True)))
        khac = ImageChops.difference(co_ten.convert("RGB"), khong.convert("RGB"))
        assert khac.getbbox() is not None, "ten khong duoc ve len anh"
        # Vung khac nhau phai nam o dong "Ho va ten" (y quanh 420), khong phai
        # o dau khac — bat truong hop chu bi ve nham cho.
        _, top, _, bot = khac.getbbox()
        assert 380 <= top <= 425 and bot <= 445, f"chu ten ve sai cho: {(top, bot)}"


class TestHangRaoPhongBan:
    @pytest.mark.parametrize("phong", ["Human Resources", "human resources",
                                       " Information System ", "Information System"])
    def test_hai_phong_duoc_dung(self, phong):
        assert w.duoc_dung(phong) is True

    @pytest.mark.parametrize("phong", ["Sales", "Marketing", "", None, "HR",
                                       "Human Resource"])
    def test_con_lai_khong_duoc(self, phong):
        """`HR` va `Human Resource` (thieu s) KHONG duoc tinh la khop — de lot
        thi bat ky ai co `department` gan giong deu vao duoc."""
        assert w.duoc_dung(phong) is False


class TestBoCuc:
    def test_anh_ra_dung_kich_thuoc(self):
        from PIL import Image
        im = Image.open(io.BytesIO(w.ve_anh(GIA_TRI, _anh_thu(), nu=False)))
        assert im.size == w.KHUNG == (1000, 700)

    def test_toa_do_khong_troi(self):
        """Chep tu ban Sharp/SVG cu. Doi mot con so la anh ra khac ban moi
        nguoi da quen — khoa lai de doi thi phai co y."""
        assert w.AVATAR == (200, 200) and w.AVATAR_TAI == (50, 100)
        assert w.LOGO_RONG == 300 and w.LOGO_TAI == (520, 30)
        assert [y for _, _, y, _ in w.DONG] == [420, 450, 480, 510, 540]
        assert w.MAU_TEN == "#ff0000", "ten ung vien ve mau do nhu ban cu"

    def test_anh_khong_vuong_van_cat_duoc(self):
        """Anh chan dung it khi vuong. Phai cat giua roi bo tron, khong duoc
        keo meo mat nguoi."""
        from PIL import Image
        im = Image.open(io.BytesIO(w.ve_anh(GIA_TRI, _anh_thu(co=(1200, 400)), nu=False)))
        assert im.size == (1000, 700)

    def test_tep_khong_phai_anh_thi_bao_loi_ro(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as e:
            w.ve_anh(GIA_TRI, b"day khong phai anh", nu=False)
        assert e.value.status_code == 400


class TestLamSachDuLieu:
    def test_cat_chuoi_qua_dai(self):
        assert len(w.sach("x" * 500)) == w.MAX_CHU

    def test_bo_ky_tu_dieu_khien(self):
        assert w.sach("Nguyễn\x00 Văn\x1f An") == "Nguyễn Văn An"

    def test_doi_ngay_sang_dmy(self):
        assert w.ngay_dmy("2026-09-04") == "04-09-2026"

    def test_ngay_sai_dinh_dang_thi_giu_nguyen(self):
        """Khong duoc nem loi — nguoi dung go tay mot dinh dang khac thi in
        nguyen van con hon la 500 giua chung."""
        assert w.ngay_dmy("04/09/2026") == "04/09/2026"
        assert w.ngay_dmy("") == ""
