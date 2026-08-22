"""Test phan BAO MAT va phan VUA VIET MOI.

Co y KHONG co gang phu 3.100 dong backend da chay on dinh — chi bam vao nhung
cho ma hong se gay hau qua that: leo thang quyen, gia mao danh tinh, XSS, va
cac gioi han cua duong ong telemetry.

Chay:  python3 -m pytest -q server/tests
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("TELEMETRY_ENABLED", "1")
os.environ.setdefault("DATABASE_URL", "")          # khong dung DB that

from server.app import ad, telemetry  # noqa: E402


# ------------------------------------------------------------- quyen --
class TestCanAdminContent:
    """Danh sach TRONG phai co nghia la KHONG AI vao duoc, khong phai ai cung vao."""

    def test_danh_sach_trong_thi_tu_choi(self, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", set())
        assert ad.can_admin_content("arikita") is False

    def test_dung_ten_thi_cho(self, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        assert ad.can_admin_content("arikita") is True

    def test_khong_phan_biet_hoa_thuong_va_bo_domain(self, monkeypatch):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        assert ad.can_admin_content("ARIKITA@anvietphatgroup.com") is True
        assert ad.can_admin_content("AVPG\\Arikita") is True

    @pytest.mark.parametrize("bad", [
        "", "   ", None,
        "arikita; DROP TABLE app_error",
        "../../etc/passwd",
        "arikita)(objectClass=*",      # chen LDAP filter
        "arikita\x00admin",
    ])
    def test_dau_vao_ban_thi_tu_choi(self, monkeypatch, bad):
        monkeypatch.setattr(ad, "CONTENT_ADMIN_USERS", {"arikita"})
        assert ad.can_admin_content(bad) is False


# --------------------------------------------------------- loc PII --
class TestSafePath:
    """Phai KHOP y het safePath() ben src/app/shared/util/safe-path.ts."""

    @pytest.mark.parametrize("vao,ra", [
        ("/profile/haivl", "/profile/*"),
        ("/wall/haivl", "/wall/*"),
        ("/profile/haivl?tab=posts#top", "/profile/*"),
        ("/feed", "/feed"),
        ("/news/42", "/news/42"),
        ("/news/profile/haivl", "/news/profile/haivl"),
        ("", ""),
    ])
    def test_khop_ban_frontend(self, vao, ra):
        assert telemetry._safe_path(vao) == ra

    def test_cat_do_dai(self):
        assert len(telemetry._safe_path("/x" * 400)) == 300


class TestGroupEndpoint:
    """Khong gom thi moi bai viet de ra mot dong rieng trong app_request_stat."""

    @pytest.mark.parametrize("vao,ra", [
        ("/api/news/42", "/api/news/{id}"),
        ("/api/news/42/comment", "/api/news/{id}/comment"),
        ("/api/profile/photo/avatar", "/api/profile/photo/avatar"),
        ("/api/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
         "/api/x/{uuid}"),
    ])
    def test_gom_nhom(self, vao, ra):
        assert telemetry._group_endpoint(vao) == ra


# ------------------------------------------------------- van tay loi --
class TestFingerprint:
    def test_cung_loi_khac_con_so_van_gop_MOT_nhom(self):
        a = telemetry._fingerprint("client", "Error", "khong tai duoc bai 42", "")
        b = telemetry._fingerprint("client", "Error", "khong tai duoc bai 4711", "")
        assert a == b, "chuan hoa message phai bo con so, khong thi moi bai mot dong"

    def test_loi_khac_han_thi_khac_nhom(self):
        a = telemetry._fingerprint("client", "Error", "khong tai duoc bai", "")
        b = telemetry._fingerprint("client", "Error", "khong gui duoc tin nhan", "")
        assert a != b

    def test_khac_nguon_thi_khac_nhom(self):
        a = telemetry._fingerprint("client", "Error", "loi giong nhau", "")
        b = telemetry._fingerprint("server", "Error", "loi giong nhau", "")
        assert a != b


# ---------------------------------------------------------- muc do --
class TestSeverity:
    def test_chunkload_la_critical(self):
        # Xep critical CO CHU DICH: day dung la dau hieu cua bay chunk rac
        # da lam trang site 13/08, va la loi hien HOAN TOAN im lang.
        assert telemetry._severity("client", "ChunkLoadError", "Loading chunk 5 failed", None) == "critical"

    def test_5xx_la_error(self):
        assert telemetry._severity("client", "HTTP500", "GET /api/x tra 500", 500) == "error"

    def test_nguoi_dung_bao_loi_la_info(self):
        assert telemetry._severity("user", "UserReport", "trang cham qua", None) == "info"


# ------------------------------------------------------- rate limit --
class TestRateLimit:
    def test_chan_sau_nguong(self, monkeypatch):
        monkeypatch.setattr(telemetry, "_rate", {})
        ok = sum(1 for _ in range(200) if telemetry._rate_ok("ai-do"))
        assert ok <= telemetry.RATE_PER_MIN, f"cho qua {ok} su kien/phut"

    def test_moi_nguoi_dem_rieng(self, monkeypatch):
        monkeypatch.setattr(telemetry, "_rate", {})
        for _ in range(200):
            telemetry._rate_ok("nguoi-a")
        assert telemetry._rate_ok("nguoi-b") is True


# --------------------------------------------- duong ghi loi khong duoc sap --
class TestRecordKhongNem:
    def test_khong_co_DB_van_khong_nem(self, monkeypatch):
        """record() ma nem thi loi that se keo sap request that."""
        monkeypatch.setattr(telemetry, "DSN", "")
        assert telemetry.record("client", "Error", "thu") is None

    def test_DB_hong_van_khong_nem(self, monkeypatch):
        monkeypatch.setattr(telemetry, "DSN", "postgresql://khong-co-that/xxx")

        def no(*a, **k):
            raise RuntimeError("DB chet")

        monkeypatch.setattr(telemetry, "_conn", no)
        assert telemetry.record("client", "Error", "thu") is None
