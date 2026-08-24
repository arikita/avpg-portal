"""Test bang dieu khien quan tri (/api/admin).

Cung tinh than voi test_security.py: KHONG co gang phu het cac cau SQL thong ke
— chung doc thi hong cung chi ra so sai, con hong o hang rao quyen thi lo toan
bo hoat dong cua tung nhan vien. Chi bam vao:

  1. HANG RAO — MOI route trong file admin.py phai di qua _require_admin. Bang
     app_page_view ghi kem username, ho ten AD va phong ban, nen mot route quen
     hang rao la ro ri du lieu giam sat nhan vien.
  2. GA4 THIEU KHOA phai tra huong dan, KHONG duoc nem 500 — neu no 500 thi ca
     tab Luot truy cap trang trong ke ca phan tu host von van chay duoc.
  3. Danh sach unit systemd la CO DINH trong ma nguon, khong nhan tu request.

KHONG dung fastapi.testclient: no doi them goi httpx2 ma venv tren .136 khong
co, va them mot phu thuoc chi de chay test la doi lech moi truong test voi moi
truong that. Kiem tra hang rao bang cach doc thang bang dinh tuyen — chat che
hon goi HTTP, vi no bat duoc CA route chua ai nghi ra cach goi.

Chay:  python3 -m pytest -q server/tests
"""
import inspect
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("TELEMETRY_ENABLED", "1")
os.environ.setdefault("DATABASE_URL", "")          # khong dung DB that

from server.app import ad, admin  # noqa: E402


def routes():
    """Moi route thuc su dang gan trong router — khong phai danh sach viet tay,
    de endpoint moi them vao tu dong bi kiem."""
    return [r for r in admin.router.routes if getattr(r, "endpoint", None)]


class TestMoiRouteDeuCoHangRao:
    def test_co_du_sau_endpoint(self):
        paths = {r.path for r in routes()}
        assert paths == {"/api/admin/" + p for p in
                         ("overview", "analytics", "ga4", "news", "users", "system")}

    @pytest.mark.parametrize("route", routes(), ids=lambda r: r.path)
    def test_route_phu_thuoc_require_admin(self, route):
        """Hang rao phai nam o CHU KY HAM (Depends), khong phai mot dong `if`
        long trong than ham — dong `if` de bi xoa nham khi sua truy van."""
        deps = [
            p.default.dependency
            for p in inspect.signature(route.endpoint).parameters.values()
            if hasattr(p.default, "dependency")
        ]
        assert admin._require_admin in deps, f"{route.path} thieu _require_admin"

    def test_khong_co_route_ghi_nao(self):
        """admin.py CHI DOC. Sua noi dung van qua PUT /api/content (co ghi
        content_history), doi trang thai loi van qua /api/telemetry. Mot duong
        ghi cho moi thu — khong nhan ban luat kiem tra."""
        for r in routes():
            assert r.methods == {"GET"}, f"{r.path} co method ghi: {r.methods}"


class TestRequireAdmin:
    def test_nguoi_ngoai_allowlist_bi_tu_choi(self, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        with pytest.raises(HTTPException) as e:
            admin._require_admin("nhanvien")
        assert e.value.status_code == 403

    def test_danh_sach_trong_thi_khong_ai_vao_duoc(self, monkeypatch):
        # DE TRONG = KHONG AI, khong phai ai cung vao.
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", set())
        with pytest.raises(HTTPException):
            admin._require_admin("arikita")

    def test_nguoi_trong_allowlist_di_qua(self, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        assert admin._require_admin("arikita") == "arikita"

    @pytest.mark.parametrize("raw,ten", [
        ("AVPG\\Arikita", "Arikita"),               # dang DOMAIN\user
        ("ARIKITA@anvietphatgroup.com", "ARIKITA"),  # dang UPN
        ("  arikita  ", "arikita"),
    ])
    def test_chuan_hoa_ten_giong_phan_con_lai_cua_he_thong(self, raw, ten, monkeypatch):
        """Apache dat X-Remote-User o ba dang khac nhau tuy duong xac thuc
        (Kerberos / Basic / form). Ba dang do phai ra cung mot ket luan quyen."""
        assert admin.current_user(raw) == ten
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        assert admin._require_admin(admin.current_user(raw)) == ten

    def test_thieu_header_thi_401(self):
        with pytest.raises(HTTPException) as e:
            admin.current_user(None)
        assert e.value.status_code == 401

    @pytest.mark.parametrize("bad", ["arikita)(cn=*", "arikita\x00admin", "*"])
    def test_ten_ban_khong_lot_qua_duoc(self, bad, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        with pytest.raises(HTTPException):
            admin._require_admin(admin.current_user(bad))


class TestGa4ThieuKhoa:
    """Chua cau hinh khoa KHONG phai la loi — la trang thai binh thuong cho den
    khi ai do tao service account ben Google."""

    def test_khong_co_khoa_thi_tra_huong_dan(self, monkeypatch):
        monkeypatch.setattr(admin, "GA4_SA_JSON", "")
        body = admin.ga4(days=28, username="arikita")
        assert body["configured"] is False
        assert body["reason"] == "no_key"
        assert len(body["setup"]) >= 4          # 4 buoc tao service account
        assert body["measurementId"] == "G-0D97GKKZ6W"

    def test_tro_toi_file_khong_ton_tai(self, monkeypatch):
        monkeypatch.setattr(admin, "GA4_SA_JSON", "/khong/co/file.json")
        body = admin.ga4(days=28, username="arikita")
        assert body["reason"] == "key_missing"
        assert body["setup"]

    def test_khoa_hong_thi_bao_loi_chu_khong_nem(self, monkeypatch, tmp_path):
        """Khoa sai dinh dang RAT de xay ra (chep thieu, sai file). Phai ra mot
        dong loi doc duoc chu khong phai exception lam trang ca tab."""
        bad = tmp_path / "ga4.json"
        bad.write_text('{"client_email": "x@y.iam.gserviceaccount.com",'
                       ' "private_key": "khong-phai-pem"}')
        monkeypatch.setattr(admin, "GA4_SA_JSON", str(bad))
        monkeypatch.setattr(admin, "_ga4_token", {"value": "", "exp": 0.0})
        body = admin.ga4(days=28, username="arikita")
        assert body["configured"] is True and body["ok"] is False
        assert body["error"]
        assert body["setup"]                    # van chi duoc cach sua


class TestUnitSystemd:
    def test_danh_sach_unit_co_dinh_trong_ma_nguon(self):
        """Neu ten unit lay tu query string thi endpoint nay thanh cong cu do
        trang thai MOI dich vu cua may chu qua trinh duyet."""
        assert all(isinstance(u, str) and isinstance(lbl, str) for u, lbl in admin.UNITS)
        assert any(u.startswith("avp-portal-api") for u, _ in admin.UNITS)
        assert "unit" not in inspect.signature(admin.system).parameters

    def test_unit_khong_ton_tai_khong_lam_no_ham(self):
        st = admin._unit_state("khong-he-co-unit-nay.service")
        assert st["unit"] == "khong-he-co-unit-nay.service"
        assert st["state"] in ("unknown", "inactive")


class TestTruyVanKhongLamSapTrang:
    def test_mot_bang_thieu_thi_tra_rong_chu_khong_nem(self):
        """12 o so lieu doc tu 12 bang. Bang telemetry chua tao tren mot may nao
        do khong duoc lam ca bang dieu khien trang."""
        class ConnGia:
            def execute(self, *a, **k):
                raise RuntimeError('relation "app_page_view" does not exist')

            def rollback(self):
                pass

        assert admin._rows(ConnGia(), "SELECT 1") == []
        assert admin._one(ConnGia(), "SELECT 1") == 0
        assert admin._one(ConnGia(), "SELECT 1", default="?") == "?"
