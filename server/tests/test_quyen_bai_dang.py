"""Luat quyen tren bai dang (25/08/2026).

  * Phong Information System (IT) : TOAN QUYEN tren moi bai.
  * Tin tuc                        : tac gia, VA nguoi cung phong voi bai
                                     (trong nhom dang tin HR/MKT/IS).
                                     KHONG cheo sang phong khac.
  * Doi song (tuong)               : chi TAC GIA bai, cong them IT.

Day la loai code sai mot dong la lo quyen ma khong ai thay — nen kiem tung
nhanh mot, ke ca cac truong hop bien.
"""
from __future__ import annotations

import ast
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Luat quyen nam o ad.py chu khong o news.py — news.py keo theo nh3 +
# python-multipart, hai goi chi co trong venv tren .136 nen test se bi SKIP im
# lang tren may dev. Mot luat quyen khong duoc kiem la mot luat quyen se hong.
from app import ad as news


AD_PY = os.path.join(os.path.dirname(__file__), "..", "app", "ad.py")


def _than_ham(ten: str) -> str:
    """Than DUNG cua mot ham trong ad.py — cat bang AST.

    Khong cat bang chuoi: giua hai ham con co code cap module (chinh khoi
    DIR_FILTER co chua CHUA_TAT), cat tho la lay nham sang do va phep do hoa ra
    luon dung du ham co loc hay khong.
    """
    cay = ast.parse(open(AD_PY, encoding="utf-8").read(), AD_PY)
    for nut in cay.body:
        if isinstance(nut, ast.FunctionDef) and nut.name == ten:
            return ast.unparse(nut)
    raise AssertionError(f"khong tim thay ham {ten} trong ad.py")


#: username -> (la IT?, la nguoi dang tin?, phong ban)
NGUOI = {
    "arikita": (True, True, "information system"),    # IT
    "haivl": (True, True, "information system"),      # IT
    "hr1": (False, True, "human resources"),
    "hr2": (False, True, "human resources"),
    "mkt1": (False, True, "marketing"),
    "mkt2": (False, True, "marketing"),
    "ketoan": (False, False, "accounting"),           # khong duoc dang tin
    "khongro": (False, True, ""),                     # AD thieu department
    "khongro2": (False, True, ""),
}


@pytest.fixture(autouse=True)
def gia_lap_ad(monkeypatch):
    monkeypatch.setattr(news, "is_editor", lambda u: NGUOI.get(u, (False, False, ""))[0])
    monkeypatch.setattr(news, "is_news_author", lambda u: NGUOI.get(u, (False, False, ""))[1])
    monkeypatch.setattr(news, "dept_of", lambda u: NGUOI.get(u, (False, False, ""))[2])


class TestTinTuc:
    def test_tac_gia_toan_quyen_tren_bai_minh(self):
        assert news.can_manage_post("mkt1", "mkt1", "marketing")

    def test_cung_phong_thi_duoc(self):
        """Yeu cau: 'toan quyen tren bai dang cua phong ban cua minh'."""
        assert news.can_manage_post("mkt2", "mkt1", "marketing")
        assert news.can_manage_post("hr2", "hr1", "human resources")

    def test_khac_phong_thi_KHONG_duoc(self):
        """Yeu cau: 'khong co quyen thao tac vao bai cua phong ban khac'."""
        assert not news.can_manage_post("hr1", "mkt1", "marketing")
        assert not news.can_manage_post("mkt1", "hr1", "human resources")

    def test_IT_toan_quyen_moi_phong(self):
        """Yeu cau: 'rieng phong IT la toan quyen tren tat ca'."""
        for chu in ("marketing", "human resources", "accounting", ""):
            assert news.can_manage_post("arikita", "mkt1", chu)
            assert news.can_manage_post("haivl", "hr1", chu)

    def test_nguoi_ngoai_nhom_dang_tin_khong_duoc(self):
        """Ke ca khi TRUNG phong ban voi bai."""
        assert not news.can_manage_post("ketoan", "mkt1", "accounting")

    def test_khong_ro_phong_ban_khong_khop_nhau(self):
        """Hai nguoi cung 'khong ro phong' KHONG duoc sua bai cua nhau.

        Neu '' khop '' thi moi tai khoan AD thieu truong department bong nhien
        thao tac duoc bai cua nhau — mo toang quyen ma khong ai thay.
        """
        assert not news.can_manage_post("khongro", "khongro2", "")

    def test_bai_cu_chua_co_cot_phong_thi_tra_AD(self, monkeypatch):
        """Bai dang truoc 25/08 co `author_dept` rong -> tra phong cua tac gia."""
        assert news.can_manage_post("mkt2", "mkt1", "")      # mkt1 -> marketing
        assert not news.can_manage_post("hr1", "mkt1", "")

    def test_phong_ban_viet_lech_van_khop(self, monkeypatch):
        """AD that su co ca 'Marketing' lan ' marketing '."""
        assert news.can_manage_post("mkt2", "mkt1", "  MARKETING  ")


class TestDoiSong:
    """Tuong: chi TAC GIA bai, cong them IT.

    Goi THANG ham that trong ad.py — khong chep lai bieu thuc vao test, vi nhu
    the test chi tu kiem chinh no va doi luat o code that se khong ai bao.
    """

    def test_tac_gia_xoa_duoc_bai_minh(self):
        assert news.can_manage_wall_post("hr1", "hr1")

    def test_nguoi_khac_khong_xoa_duoc(self):
        assert not news.can_manage_wall_post("hr2", "hr1")
        assert not news.can_manage_wall_post("mkt1", "hr1")

    def test_IT_xoa_duoc_moi_bai(self):
        assert news.can_manage_wall_post("arikita", "hr1")

    def test_chu_tuong_KHONG_con_xoa_duoc_bai_nguoi_khac(self):
        """Doi 25/08: truoc day chu tuong xoa duoc bai nguoi khac dang len
        tuong minh. Yeu cau moi: 'chi user dang bai moi co quyen'."""
        assert not news.can_manage_wall_post("hr2", "hr1")

    def test_tac_gia_bai_xoa_duoc_binh_luan_tren_bai_minh(self):
        """Day la phan 'toan quyen tren bai dang' cua luat."""
        assert news.can_delete_wall_comment("hr1", "mkt1", "hr1")

    def test_nguoi_viet_binh_luan_tu_xoa_duoc(self):
        assert news.can_delete_wall_comment("mkt1", "mkt1", "hr1")

    def test_nguoi_ngoai_khong_xoa_duoc_binh_luan(self):
        assert not news.can_delete_wall_comment("ketoan", "mkt1", "hr1")

    def test_IT_xoa_duoc_moi_binh_luan(self):
        assert news.can_delete_wall_comment("haivl", "mkt1", "hr1")


class TestTaiKhoanDaTat:
    """Tai khoan AD da tat KHONG duoc tinh la co quyen (yeu cau 25/08/2026).

    Thuc te ho khong lay noi ve Kerberos nen khong vao duoc portal, nhung de
    cai loc trong CHINH cau LDAP thi moi phep dem va moi bang bao cao noi cung
    mot con so — luc dau dem thieu loc ra 63 nguoi dang tin, loc roi con 15.
    """

    def test_cau_loc_nam_trong_ca_hai_cho_kiem_quyen(self):
        # Doc THANG tu file: fixture o tren da monkeypatch `is_editor` thanh
        # lambda, `inspect.getsource` se doc phai ban gia lap.
        assert "userAccountControl:1.2.840.113556.1.4.803:=2" in news.CHUA_TAT
        for ten_ham in ("is_editor", "_in_group"):
            than = _than_ham(ten_ham)
            assert "CHUA_TAT" in than, f"{ten_ham} quen loc tai khoan da tat"

    def test_get_user_co_y_KHONG_loc(self):
        """`get_user` CO Y khong loc — ten tac gia cua bai cu van phai hien ra
        sau khi nguoi do nghi viec. Loc o day la lam trong ten tren bai cu."""
        assert "CHUA_TAT" not in _than_ham("get_user")
