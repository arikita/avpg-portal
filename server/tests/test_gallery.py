"""Thu vien anh: hang rao quyen, loc duong dan, va hinh dang du lieu.

Cung tinh than voi test_admin.py: danh sach route lay TU ROUTER chu khong viet
tay, de endpoint moi them vao tu dong bi kiem.
"""
from __future__ import annotations

import inspect
import json
import os

import pytest
from fastapi import HTTPException

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import gallery  # noqa: E402


def manage_routes():
    return [r for r in gallery.manage_router.routes if getattr(r, "endpoint", None)]


def read_routes():
    return [r for r in gallery.router.routes if getattr(r, "endpoint", None)]


class TestHangRaoQuyen:
    """Quan ly album dung LAI nhom cua quyen dang tin (HR/Marketing/IS).

    Du an co y tach ba loai quyen; day la loai thu tu neu khong dung lai —
    xem ghi chu dau gallery.py.
    """

    @pytest.mark.parametrize("route", manage_routes(), ids=lambda r: r.path)
    def test_moi_route_quan_ly_deu_qua_require_editor(self, route):
        """Hang rao phai o CHU KY HAM (Depends), khong phai mot dong `if` long
        trong than ham — dong `if` de bi xoa nham khi sua logic."""
        deps = [
            p.default.dependency
            for p in inspect.signature(route.endpoint).parameters.values()
            if hasattr(p.default, "dependency")
        ]
        assert gallery.require_editor in deps, f"{route.path} thieu require_editor"

    @pytest.mark.parametrize("route", read_routes(), ids=lambda r: r.path)
    def test_route_doc_van_doi_dang_nhap(self, route):
        deps = [
            p.default.dependency
            for p in inspect.signature(route.endpoint).parameters.values()
            if hasattr(p.default, "dependency")
        ]
        assert gallery.current_user in deps, f"{route.path} khong doi dang nhap"

    def test_khong_phai_editor_thi_bi_tu_choi(self, monkeypatch):
        monkeypatch.setattr(gallery, "is_news_author", lambda u: False)
        with pytest.raises(HTTPException) as e:
            gallery.require_editor("nguoila")
        assert e.value.status_code == 403

    def test_la_editor_thi_qua(self, monkeypatch):
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        assert gallery.require_editor("haivl") == "haivl"


class TestLocDuongDan:
    """Chuoi tu client di THANG vao duong dan file — phai loc, khong thi doc
    duoc file ngoai thu muc anh."""

    @pytest.mark.parametrize("bad", ["../etc", "/etc/passwd", "a/../../b"])
    def test_sources_chan_thoat_thu_muc(self, bad, monkeypatch):
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        with pytest.raises(HTTPException) as e:
            gallery.manage_sources(path=bad, username="haivl")
        assert e.value.status_code == 400

    @pytest.mark.parametrize("bad", ["../x", "CHU-HOA", "a" * 80, "manage"])
    def test_tao_album_chan_slug_xau(self, bad, monkeypatch):
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        with pytest.raises(HTTPException) as e:
            gallery.manage_create({"slug": bad, "src": "abc"}, username="haivl")
        assert e.value.status_code == 400

    def test_tao_album_chan_nguon_thoat_thu_muc(self, monkeypatch):
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        with pytest.raises(HTTPException) as e:
            gallery.manage_create({"slug": "hop-le", "src": "../../etc"}, username="haivl")
        assert e.value.status_code == 400

    def test_manage_khong_duoc_thanh_ten_album(self):
        """`/api/gallery/manage` phai la khu quan ly, khong duoc bi mot album
        ten `manage` nuot mat."""
        assert "manage" in gallery.RESERVED


class TestSuaMeta:
    """Anh bia / anh noi bat do client gui len — chi duoc nhan ten anh CO THAT."""

    @pytest.fixture
    def album(self, tmp_path, monkeypatch):
        monkeypatch.setattr(gallery, "GALLERY_DIR", str(tmp_path))
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        monkeypatch.setattr(gallery, "_index", lambda s, m: [("anh-01", "anh-01.jpg")])
        d = tmp_path / "test-album" / "thumb"
        d.mkdir(parents=True)
        (d / "anh-01.jpg").write_bytes(b"x")
        (tmp_path / "test-album" / "album.json").write_text(
            json.dumps({"slug": "test-album", "src": "X", "photos": [{"file": "anh-01"}]}),
            encoding="utf-8")
        return "test-album"

    def test_bia_la_anh_co_that_thi_nhan(self, album):
        out = gallery.manage_update(album, {"cover": "anh-01"}, username="haivl")
        assert out["ok"] is True
        assert gallery._album_meta(album)["cover"] == "anh-01"

    def test_bia_bia_dat_thi_bi_go(self, album):
        gallery.manage_update(album, {"cover": "../../../etc/passwd"}, username="haivl")
        assert gallery._album_meta(album)["cover"] == ""

    def test_anh_noi_bat_loc_theo_anh_co_that(self, album):
        gallery.manage_update(album, {"featured": ["anh-01", "khong-co"]}, username="haivl")
        assert gallery._album_meta(album)["featured"] == ["anh-01"]

    @pytest.mark.parametrize("st", ["public", "draft", "hidden"])
    def test_nhan_ba_trang_thai_hop_le(self, album, st):
        gallery.manage_update(album, {"status": st}, username="haivl")
        assert gallery._album_meta(album)["status"] == st

    def test_bo_qua_trang_thai_la(self, album):
        gallery.manage_update(album, {"status": "public"}, username="haivl")
        gallery.manage_update(album, {"status": "xoa-het-di"}, username="haivl")
        assert gallery._album_meta(album)["status"] == "public"

    def test_album_nhap_khong_hien_voi_nguoi_thuong(self, album, monkeypatch):
        """Nhap/an chi nguoi co quyen quan ly moi thay — de Marketing chuan bi
        truoc roi mo sau, giong hen gio cua tin tuc."""
        gallery.manage_update(album, {"status": "draft"}, username="haivl")
        monkeypatch.setattr(gallery, "is_news_author", lambda u: False)
        assert gallery.gallery_index(username="nguoithuong")["albums"] == []
        with pytest.raises(HTTPException) as e:
            gallery.gallery_album(album, username="nguoithuong")
        assert e.value.status_code == 404

    def test_album_cong_khai_thi_ai_cung_thay(self, album, monkeypatch):
        gallery.manage_update(album, {"status": "public"}, username="haivl")
        monkeypatch.setattr(gallery, "is_news_author", lambda u: False)
        cards = gallery.gallery_index(username="nguoithuong")["albums"]
        assert [c["slug"] for c in cards] == [album]


class TestCotBenKhongLoAlbumNhap:
    """Cot ben cua /feed lay anh tu thu vien — phai loc theo `status`.

    Album nhap la thu Marketing dang chuan bi; lot ra /feed thi ca cong ty thay
    truoc khi ho kip mo. Truoc 25/08/2026 rail lay bua album cuoi cung theo thu
    tu chu cai, khong he xet trang thai.
    """

    @pytest.fixture
    def kho(self, tmp_path, monkeypatch):
        monkeypatch.setattr(gallery, "GALLERY_DIR", str(tmp_path))
        for slug, status, year in [("cong-khai", "public", "2024"),
                                   ("z-nhap", "draft", "2026"),
                                   ("z-an", "hidden", "2026")]:
            d = tmp_path / slug / "thumb"
            d.mkdir(parents=True)
            for i in range(6):
                (d / f"{slug}-{i}.jpg").write_bytes(b"x")
            (tmp_path / slug / "album.json").write_text(
                json.dumps({"slug": slug, "status": status, "date": year,
                            "title": {"vi": slug, "en": slug}}), encoding="utf-8")
        return gallery

    def test_chi_lay_album_cong_khai(self, kho):
        """`z-nhap` dung sau theo thu tu chu cai VA nam nam moi hon — dung luat
        cu thi no duoc chon. Gio phai bi loai."""
        out = kho.rail_photos()
        assert out["slug"] == "cong-khai"
        assert all("/cong-khai/" in p["thumb"] for p in out["photos"])

    def test_khong_co_album_cong_khai_thi_tra_rong(self, kho, tmp_path):
        for slug in ("cong-khai",):
            (tmp_path / slug / "album.json").write_text(
                json.dumps({"slug": slug, "status": "draft"}), encoding="utf-8")
        out = kho.rail_photos()
        assert out["photos"] == [] and out["slug"] == ""

    def test_uu_tien_anh_noi_bat(self, kho, tmp_path):
        """Marketing ghim tam nao thi cot ben lay dung nhung tam do."""
        (tmp_path / "cong-khai" / "album.json").write_text(
            json.dumps({"slug": "cong-khai", "status": "public", "date": "2024",
                        "title": {"vi": "x", "en": "x"},
                        "featured": ["cong-khai-2", "cong-khai-4"]}), encoding="utf-8")
        got = {p["thumb"].rsplit("/", 1)[-1][:-4] for p in kho.rail_photos()["photos"]}
        assert got == {"cong-khai-2", "cong-khai-4"}


class TestCoTheAlbum:
    """Co cua the album do Marketing chon — quyen bien tap "bo mat" trang."""

    @pytest.fixture
    def album(self, tmp_path, monkeypatch):
        monkeypatch.setattr(gallery, "GALLERY_DIR", str(tmp_path))
        monkeypatch.setattr(gallery, "is_news_author", lambda u: True)
        monkeypatch.setattr(gallery, "_index", lambda s, m: [("a-1", "a-1.jpg")])
        d = tmp_path / "alb" / "thumb"
        d.mkdir(parents=True)
        (d / "a-1.jpg").write_bytes(b"x")
        (tmp_path / "alb" / "album.json").write_text(
            json.dumps({"slug": "alb", "src": "X"}), encoding="utf-8")
        return "alb"

    def test_mac_dinh_la_thuong(self, album):
        assert gallery._album_card(album, gallery._album_meta(album))["size"] == "thuong"

    @pytest.mark.parametrize("co", ["noibat", "thuong", "gon"])
    def test_nhan_ba_co_hop_le(self, album, co):
        gallery.manage_update(album, {"size": co}, username="haivl")
        assert gallery._album_card(album, gallery._album_meta(album))["size"] == co

    def test_co_la_thi_giu_nguyen_co_cu(self, album):
        gallery.manage_update(album, {"size": "noibat"}, username="haivl")
        gallery.manage_update(album, {"size": "to-dung"}, username="haivl")
        assert gallery._album_card(album, gallery._album_meta(album))["size"] == "noibat"

    def test_album_cu_khong_co_truong_size_van_doc_duoc(self, album):
        """album.json cu (truoc 25/08) khong co `size` — khong duoc vo."""
        meta = gallery._album_meta(album)
        assert "size" not in meta
        assert gallery._album_card(album, meta)["size"] == "thuong"
