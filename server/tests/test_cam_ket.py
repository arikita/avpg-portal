"""Test ky cam ket bao mat (/api/cam-ket) — xem server/app/camket.py.

BON THU FILE NAY KHOA, deu la nhung thu hong ma KHONG nem exception:

  1. FONT. Documenso dap chu bang font chi phu Latin-1: "Nguyen Van Thu" co dau
     ra "Nguy?n V?n Th?". Ca thiet ke o day sinh ra de tranh dieu do — portal
     tu dap chu bang font co tieng Viet. Neu ai do doi font, doi cach dap, hay
     server thieu goi, thi ban cam ket van ra 3 trang trong binh thuong, chi
     co ten nguoi ky la sai. Test `TestDapChuTiengViet` doc nguoc chu ra khoi
     PDF va so tung ky tu.

  2. TOKEN RO RI. Token la thu duy nhat can de ky THAY nguoi khac. No chi duoc
     di ve cho chinh chu. Mot `SELECT *` vo y o /api/admin/cam-ket la du de
     bien trang quan tri thanh cong cu mao danh chu ky.

  3. HAI FILE LECH NHAU. Danh sach o nam o docs/cam-ket-fields.json (do script
     render sinh ra), con viec "o nay ai dap" nam trong camket.py. Them mot o
     vao ban cam ket ma quen phan loai thi o do khong ai dap ca — PDF ra dep,
     cho do de trong.

  4. DIEN AP DUNG. Sai chieu so sanh ngay la hoac ca 850 nguoi bong phai ky,
     hoac khong ai phai ky. Ca hai deu im lang.
"""
from __future__ import annotations

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))

from server.app import camket  # noqa: E402


# ------------------------------------------------------------------ dien ap dung --
def _ad(when: str) -> dict:
    """Mot ban ghi AD toi thieu voi whenCreated dang LDAP."""
    return {"whenCreated": when, "fullName": "Nguyễn Văn Thử",
            "mail": "thu@anvietenergy.com", "department": "Information System"}


class TestDienApDung:
    def test_dung_ngay_chot_la_phai_ky(self):
        """Bien duoi la NGAY CHOT chu khong phai ngay hom sau — nguoi tao tai
        khoan dung hom chot van thuoc dien."""
        assert camket._thuoc_dien(_ad("20260904071233.0Z")) is True

    def test_truoc_ngay_chot_thi_khong(self):
        assert camket._thuoc_dien(_ad("20260903235959.0Z")) is False

    def test_sau_ngay_chot_thi_co(self):
        assert camket._thuoc_dien(_ad("20270115090000.0Z")) is True

    def test_khong_doc_duoc_whenCreated_thi_KHONG_thuoc_dien(self):
        """Tha bo sot mot nguoi con hon dua ca cong ty vao dien phai ky vi mot
        loi tra cuu LDAP. Sai chieu o day la 850 nguoi nhan tai lieu ky."""
        for xau in ({}, {"whenCreated": ""}, {"whenCreated": "khong-phai-ngay"},
                    {"whenCreated": None}):
            assert camket._thuoc_dien(xau) is False, xau

    def test_ngay_tao_doi_dung_dinh_dang(self):
        assert camket._ngay_tao(_ad("20260904071233.0Z")) == "2026-09-04"
        assert camket._ngay_tao({}) == ""



class TestCuaMoThem:
    """CAM_KET_MO_THEM — mo cho dung mot nguoi ma khong ha ngay chot.

    Luat chinh chi co MOT moc ngay: muon cho mot nguoi ky thi cach duy nhat
    con lai la ha ngay chot, tuc mo cho ca 850 nhan vien cung luc. Danh sach
    nay ton tai de khong phai lam vay.
    """

    def test_nguoi_trong_danh_sach_luon_thuoc_dien(self, monkeypatch):
        monkeypatch.setattr(camket, "MO_THEM", {"haivl"})
        cu = _ad("20190301000000.0Z")          # tai khoan tu 2019
        assert camket._thuoc_dien(cu, "haivl") is True
        assert camket._thuoc_dien(cu, "nguoikhac") is False

    def test_nhan_ca_dang_email(self, monkeypatch):
        """Nguoi dat bien nghi bang email, REMOTE_USER lai la sAMAccountName.
        Bat hai ben khop nhau la mot cai bay khong bao gio bao loi — chi im
        lang khong mo cho ai ca."""
        monkeypatch.setattr(camket, "MO_THEM",
                            camket._doc_mo_them("haivl@anvietenergy.com"))
        assert camket.MO_THEM == {"haivl"}
        assert camket._thuoc_dien(_ad("20190301000000.0Z"), "haivl") is True
        # REMOTE_USER doi khi cung mang dang UPN
        assert camket._thuoc_dien(_ad("20190301000000.0Z"),
                                  "haivl@anvietenergy.com") is True

    def test_nhieu_nguoi_ngan_bang_dau_phay(self):
        assert camket._doc_mo_them(" haivl , huybg@anvietenergy.com ,, ") == {
            "haivl", "huybg"}

    def test_rong_thi_khong_mo_cho_ai(self):
        assert camket._doc_mo_them("") == set()
        assert camket._doc_mo_them("  ,  ") == set()

    def test_khong_co_username_thi_van_theo_ngay(self, monkeypatch):
        """Goi thieu username khong duoc bien thanh 'mo cho tat ca'."""
        monkeypatch.setattr(camket, "MO_THEM", {"haivl"})
        assert camket._thuoc_dien(_ad("20190301000000.0Z")) is False

# ------------------------------------------------------------- hai file lech nhau --
class TestOKyKhongLech:
    """docs/cam-ket-fields.json (script sinh) vs phan loai trong camket.py."""

    def test_moi_o_deu_co_nguoi_dap(self):
        keys = {f["key"] for f in camket._o_dap()}
        phan_loai = set(camket.TU_DAP) | set(camket.DOCUMENSO_DAP)
        thieu = keys - phan_loai
        assert not thieu, (
            f"o {sorted(thieu)} khong duoc phan loai — se khong ai dap vao, "
            "cho do de trong ma PDF van ra binh thuong")

    def test_khong_phan_loai_o_khong_ton_tai(self):
        keys = {f["key"] for f in camket._o_dap()}
        thua = (set(camket.TU_DAP) | set(camket.DOCUMENSO_DAP)) - keys
        assert not thua, f"phan loai nhac toi o khong co that: {sorted(thua)}"

    def test_khong_o_nao_bi_dap_hai_lan(self):
        assert not (set(camket.TU_DAP) & set(camket.DOCUMENSO_DAP))

    def test_chu_ky_va_ngay_ky_thuoc_ve_documenso(self):
        """Hai o nay PHAI do Documenso dap: chu ky la anh nguoi ta ve, con ngay
        ky phai la ngay he thong ghi nhan, khong phai ngay portal doan truoc."""
        assert set(camket.DOCUMENSO_DAP) == {"chu_ky", "ngay_ky"}

    def test_toa_do_nam_trong_trang(self):
        for f in camket._o_dap():
            assert 0 <= f["pageX"] < 100 and 0 <= f["pageY"] < 100, f
            assert f["pageX"] + f["width"] <= 100.5, f
            assert f["pageY"] + f["height"] <= 100.5, f
            assert f["pageNumber"] >= 1, f


# --------------------------------------------------------------- dap chu tieng Viet --
class TestDapChuTiengViet:
    """Phep do quan trong nhat trong file nay — xem ghi chu (1) dau file."""

    def test_co_du_goi_de_dap_pdf(self):
        """Thieu goi thi FAIL chu khong SKIP: khong co hai goi nay thi tinh
        nang khong chay duoc tren server, va mot test bi skip im lang la kieu
        hong toi te nhat."""
        import importlib
        for goi in ("reportlab", "pypdf"):
            assert importlib.util.find_spec(goi), (
                f"thieu goi {goi} — `pip install {goi}` trong venv "
                "/opt/avp-portal-api tren .136")

    def test_pdf_goc_ton_tai(self):
        assert os.path.exists(camket.PDF_PATH), (
            f"khong thay {camket.PDF_PATH} — chay "
            "`node tools/build_cam_ket_pdf.mjs` truoc")

    def test_chu_co_dau_ra_dung_trong_pdf(self):
        """Doc NGUOC chu ra khoi PDF va so tung ky tu.

        Day la hang rao chan dung loi da lam hong ban ky dau tien: "Nguyễn Văn
        Thử" bi dap thanh "Nguy?n V?n Th?". Chon san cac chu co dau nam NGOAI
        Latin-1 (ễ ă ử ệ ưở ữ) vi chinh chung la phan bi mat — `â ê ô` van
        chay ke ca voi font hong nen khong dung de kiem duoc.
        """
        from pypdf import PdfReader
        import io

        gia_tri = {
            "ho_ten": "Nguyễn Văn Thử",
            "ho_ten_2": "Nguyễn Văn Thử",
            "chuc_danh": "Trưởng phòng Kỹ thuật",
            "phong_ban": "Nghiên cứu & Phát triển",
            "email": "thu@anvietenergy.com",
        }
        pdf = camket._dap_pdf(gia_tri)
        assert pdf[:4] == b"%PDF"

        doc = PdfReader(io.BytesIO(pdf))
        chu = "\n".join((t.extract_text() or "") for t in doc.pages)
        for khoa, val in gia_tri.items():
            assert val in chu, (
                f"o {khoa}: khong tim thay {val!r} trong PDF — font dang dung "
                "khong co du chu tieng Viet, hoac cho dap bi lech trang")

    def test_giu_nguyen_so_trang(self):
        """Lop phu thieu `showPage()` cho trang khong co o nao thi merge lech,
        chu cua trang 2 dap len trang 1. So trang la cach re nhat de phat hien."""
        from pypdf import PdfReader
        import io

        goc = len(PdfReader(camket.PDF_PATH).pages)
        ra = len(PdfReader(io.BytesIO(camket._dap_pdf({"ho_ten": "A"}))).pages)
        assert ra == goc

    def test_o_bo_trong_thi_khong_dap_gi(self):
        """Tai khoan AD thieu `title` thi dong Chuc danh de trong, khong dap
        chuoi rong hay chu 'None' vao giay."""
        from pypdf import PdfReader
        import io

        pdf = camket._dap_pdf({"ho_ten": "Nguyễn Văn Thử", "chuc_danh": "   "})
        chu = "".join((t.extract_text() or "") for t in
                      PdfReader(io.BytesIO(pdf)).pages)
        assert "None" not in chu


# ------------------------------------------------------------------ token ro ri --
class TestTokenKhongRoRi:
    def test_tra_ve_khong_kem_token_tho(self):
        """`_tra_ve` duoc phep tra signUrl (chua token) cho CHINH CHU, nhung
        khong duoc tra rieng truong `token` — de khong ai vo tinh log no."""
        dong = {"status": "DANG_KY", "token": "BIMAT123", "signedAt": ""}
        ra = camket._tra_ve(dong, _ad("20260904000000.0Z"), True)
        assert "token" not in ra
        assert ra["signUrl"].endswith("/embed/sign/BIMAT123")

    def test_da_ky_roi_thi_khong_con_duong_ky(self):
        """Ky xong thi signUrl phai rong — de lai la mot duong con song de
        ai do mo lai bang link cu."""
        dong = {"status": "DA_KY", "token": "BIMAT123", "signedAt": "2026-09-04T02:00:00Z"}
        ra = camket._tra_ve(dong, _ad("20260904000000.0Z"), True)
        assert ra["signUrl"] == ""

    def test_chua_co_dong_nao_thi_trang_thai_la_chua_ky(self):
        ra = camket._tra_ve(None, _ad("20260904000000.0Z"), True)
        assert ra["status"] == "CHUA_KY"
        assert ra["signUrl"] == ""

    def test_admin_khong_doc_cot_token(self):
        """Doc thang ma nguon /api/admin/cam-ket: cau SELECT khong duoc nhac
        toi cot `token`, va cung khong duoc dung `SELECT *`."""
        from server.app import admin
        import ast
        import inspect
        import textwrap

        # Bo docstring truoc khi soi: chinh docstring cua ham do giai thich vi
        # sao khong duoc dung token, nen so chuoi tho se bao dong gia.
        cay = ast.parse(textwrap.dedent(inspect.getsource(admin.cam_ket))).body[0]
        if (cay.body and isinstance(cay.body[0], ast.Expr)
                and isinstance(cay.body[0].value, ast.Constant)
                and isinstance(cay.body[0].value.value, str)):
            cay.body = cay.body[1:]
        nguon = ast.unparse(cay)
        assert "token" not in nguon, (
            "/api/admin/cam-ket khong duoc dung toi token — do la thu duy nhat "
            "can de ky thay nguoi khac")
        assert "SELECT *" not in nguon.upper().replace("SELECT  *", "SELECT *")


# ---------------------------------------------------------------------- cau hinh --
class TestCauHinh:
    def test_ngay_chot_dung_dinh_dang(self):
        """So sanh ngay o `_thuoc_dien` la SO SANH CHUOI, chi dung khi ca hai
        ben deu la YYYY-MM-DD. Dat CAM_KET_TU_NGAY thanh '4/9/2026' thi phep so
        sanh van chay, van khong bao loi, va tra ket qua vo nghia."""
        import re
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", camket.TU_NGAY), camket.TU_NGAY

    def test_mac_dinh_khong_gui_email_moi_ky(self):
        """Mac dinh phai la KHONG gui: giao dien Documenso khong co tieng Viet,
        mot email tieng Anh tu he thong la la thu de lam nhan vien moi hoang
        mang hon la nhac viec. Bat bang CAM_KET_GUI_EMAIL khi da san sang."""
        assert camket.GUI_EMAIL is False or os.environ.get("CAM_KET_GUI_EMAIL")

    def test_documenso_base_khong_co_dau_gach_cuoi(self):
        """URL ky duoc ghep bang f-string; thua dau `/` la ra `//embed/sign/`."""
        assert not camket.BASE.endswith("/")
