"""Bai kiem tra hoi nhap IT: dap an, hang rao quyen, va HAI FILE PHAI KHOP.

De bai va dap an CO Y nam o hai noi (xem ghi chu dau server/app/quiz.py: dap an
di vao bundle la bai kiem tra thanh vo nghia). Cai gia phai tra la chung co the
lech nhau — doi ten mot lua chon ben frontend thi khong co gi bao loi, chi la
tu do tro di moi nguoi tra loi cau do deu SAI. Khong ai chet, khong log nao do,
bang thong ke cu the ma xau di.

Day la cai test bat dung chuyen do, cung mot tinh than voi test_ten_chua_
dinh_nghia.py: doc ca hai file roi hoi mot cau don gian — "chung con noi cung
mot thu khong?".
"""
from __future__ import annotations

import inspect
import os
import re

import pytest

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import quiz  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTENT = os.path.join(REPO, "src", "app", "content", "quiz.content.ts")

# Cau hoi: `id: 'x',` roi xuong dong toi `topic: 'y',`
_Q_ID = re.compile(r"id:\s*'([^']+)',\s*\n\s*topic:\s*'([^']+)',")
# Lua chon: `{ id: 'x', text: {` — luon nam gon tren mot dong
_O_ID = re.compile(r"\{\s*id:\s*'([^']+)',\s*text:\s*\{")
# Chu de khai bao trong QUIZ_TOPICS: `{ id: 'x', label: {`
_T_ID = re.compile(r"\{\s*id:\s*'([^']+)',\s*label:\s*\{")
_PASS = re.compile(r"QUIZ_PASS\s*=\s*(\d+)")
_DRAW = re.compile(r"QUIZ_DRAW\s*=\s*(\d+)")


def doc_de_bai() -> dict:
    """Doc quiz.content.ts -> cau hoi, lua chon, chu de, diem dat, so cau boc.

    Khong dung thu vien JS/TS nao: chi can biet cac ID, va chung deu la chuoi
    nguyen ven trong dau nhay don.
    """
    src = open(CONTENT, encoding="utf-8").read()

    # Danh dau vi tri cua tung ID roi duyet theo thu tu xuat hien: gap ID cau
    # thi mo mot cau moi, gap ID lua chon thi bo vao cau dang mo.
    moc = [(m.start(), "q", m.group(1), m.group(2)) for m in _Q_ID.finditer(src)]
    moc += [(m.start(), "o", m.group(1), "") for m in _O_ID.finditer(src)]
    moc.sort()

    lua_chon: dict[str, list[str]] = {}
    chu_de: dict[str, str] = {}
    cau = None
    for _, loai, ten, extra in moc:
        if loai == "q":
            cau = ten
            lua_chon[cau] = []
            chu_de[cau] = extra
        elif cau is not None:
            lua_chon[cau].append(ten)

    return {
        "lua_chon": lua_chon,
        "chu_de": chu_de,
        "chu_de_khai_bao": [m.group(1) for m in _T_ID.finditer(src)],
        "diem_dat": int(_PASS.search(src).group(1)),
        "so_cau_boc": int(_DRAW.search(src).group(1)),
    }


khong_co_frontend = not os.path.exists(CONTENT)
ly_do = (f"khong thay {CONTENT} — dang chay tren may chi co API "
         f"(/opt/avp-portal-api). Phep doi chieu nay phai chay o clasvr, noi co "
         f"ca hai nua cua kho.")


def de(n: int | None = None) -> list[str]:
    """Mot de bai hop le gom `n` cau dau tien trong kho."""
    return list(quiz.ANSWERS)[: n if n is not None else quiz.DRAW]


class TestKhoCauHoi:
    """Nhung dieu kiem duoc ma KHONG can toi frontend — luon chay, moi noi."""

    def test_kho_du_50_cau(self):
        assert quiz.POOL == 50
        assert len(quiz.ANSWERS) == quiz.POOL

    def test_moi_luot_boc_10(self):
        assert quiz.DRAW == 10
        assert quiz.DRAW < quiz.POOL, "boc bang ca kho thi khong con la boc"

    def test_diem_dat_nam_trong_khoang_hop_le(self):
        assert 0 < quiz.PASS <= quiz.DRAW

    def test_khong_cau_nao_trung_id(self):
        assert len(set(quiz.ANSWERS)) == len(quiz.ANSWERS)


@pytest.mark.skipif(khong_co_frontend, reason=ly_do)
class TestHaiFileKhopNhau:
    def test_du_cau_hoi_hai_ben(self):
        d = doc_de_bai()["lua_chon"]
        assert set(d) == set(quiz.ANSWERS), (
            "Danh sach cau hoi lech nhau. Thua o frontend: "
            f"{sorted(set(d) - set(quiz.ANSWERS))}; thua o server: "
            f"{sorted(set(quiz.ANSWERS) - set(d))}")

    def test_moi_dap_an_la_mot_lua_chon_co_that(self):
        d = doc_de_bai()["lua_chon"]
        for cau, dung in quiz.ANSWERS.items():
            assert dung in d.get(cau, []), (
                f"Cau '{cau}': dap an '{dung}' khong co trong cac lua chon "
                f"{d.get(cau)}. Ai do vua doi ten lua chon ben quiz.content.ts.")

    def test_moi_cau_deu_co_lua_chon_khong_trung(self):
        d = doc_de_bai()["lua_chon"]
        for cau, cac in d.items():
            assert len(cac) >= 2, f"Cau '{cau}' chi co {len(cac)} lua chon"
            assert len(set(cac)) == len(cac), f"Cau '{cau}' co lua chon trung id"

    def test_diem_dat_va_so_cau_boc_hai_ben_bang_nhau(self):
        d = doc_de_bai()
        assert d["diem_dat"] == quiz.PASS, (
            f"quiz.content.ts ghi dat = {d['diem_dat']}, quiz.py ghi {quiz.PASS}. "
            "Nguoi lam bai se doc mot con so, con server cham theo con so khac.")
        assert d["so_cau_boc"] == quiz.DRAW, (
            f"content boc {d['so_cau_boc']} cau, server doi dung {quiz.DRAW} — "
            "moi bai nop se an 400.")

    def test_moi_cau_deu_co_chu_de_da_khai_bao(self):
        d = doc_de_bai()
        khai_bao = set(d["chu_de_khai_bao"])
        for cau, t in d["chu_de"].items():
            assert t in khai_bao, f"Cau '{cau}' co chu de '{t}' khong nam trong QUIZ_TOPICS"

    def test_khong_chu_de_nao_rong(self):
        """Chu de rong lam vong boc thieu mat mot cau roi phai bu bang cau bat
        ky — de bai van du 10 nhung khong con can nhu thiet ke."""
        d = doc_de_bai()
        dung = set(d["chu_de"].values())
        thua = [t for t in d["chu_de_khai_bao"] if t not in dung]
        assert not thua, f"Chu de khai bao ma khong co cau nao: {thua}"

    def test_so_chu_de_khong_vuot_so_cau_boc(self):
        """Nhieu chu de hon so cau boc thi co chu de KHONG BAO GIO duoc hoi —
        va khong co gi bao cho ai biet dieu do."""
        d = doc_de_bai()
        assert len(d["chu_de_khai_bao"]) <= quiz.DRAW, (
            f"{len(d['chu_de_khai_bao'])} chu de nhung moi luot chi boc "
            f"{quiz.DRAW} cau")


class TestChamDiem:
    def test_lam_dung_het_thi_dat(self):
        d = de()
        kq = quiz.quiz_submit({"drawn": d, "answers": {q: quiz.ANSWERS[q] for q in d}},
                              username="nguoimoi")
        assert kq["score"] == quiz.DRAW and kq["passed"] and kq["wrong"] == []

    def test_bo_trong_thi_khong_dat(self):
        d = de()
        kq = quiz.quiz_submit({"drawn": d, "answers": {}}, username="nguoimoi")
        assert kq["score"] == 0 and not kq["passed"]
        assert sorted(kq["wrong"]) == sorted(d), "cau bo trong phai tinh la sai"

    def test_sai_ba_cau_thi_truot(self):
        d = de()
        bai = {q: quiz.ANSWERS[q] for q in d}
        for cau in d[:3]:
            bai[cau] = "chon-bay-ba"
        kq = quiz.quiz_submit({"drawn": d, "answers": bai}, username="nguoimoi")
        assert kq["score"] == quiz.DRAW - 3
        assert not kq["passed"], "8/10 moi dat; 7/10 khong duoc coi la dat"

    def test_chi_cham_dung_de_da_boc(self):
        """Tra loi dung mot cau KHONG nam trong de khong duoc cong diem."""
        d = de()
        ngoai_de = [q for q in quiz.ANSWERS if q not in d]
        bai = {q: quiz.ANSWERS[q] for q in d[:5]}
        bai.update({q: quiz.ANSWERS[q] for q in ngoai_de})
        kq = quiz.quiz_submit({"drawn": d, "answers": bai}, username="nguoimoi")
        assert kq["score"] == 5

    def test_khong_tra_ve_dap_an_dung(self):
        """Nop bua mot lan ma lay duoc de thi bai kiem tra chi con la mot vong
        lam thu tuc — xem ghi chu (2) dau quiz.py."""
        kq = quiz.quiz_submit({"drawn": de(), "answers": {}}, username="nguoimoi")
        assert set(kq) == {"score", "total", "pass", "passed", "wrong"}

    def test_de_thieu_hoac_thua_cau_thi_400(self):
        from fastapi import HTTPException
        for so in (0, 9, 11, 50):
            with pytest.raises(HTTPException) as e:
                quiz.quiz_submit({"drawn": de(so), "answers": {}}, username="nguoimoi")
            assert e.value.status_code == 400, f"de {so} cau van duoc nhan"

    def test_de_co_cau_trung_thi_400(self):
        from fastapi import HTTPException
        d = de()
        d[1] = d[0]
        with pytest.raises(HTTPException) as e:
            quiz.quiz_submit({"drawn": d, "answers": {}}, username="nguoimoi")
        assert e.value.status_code == 400

    def test_de_co_cau_khong_co_that_thi_400(self):
        from fastapi import HTTPException
        d = de()
        d[0] = "cau-tu-bia-ra"
        with pytest.raises(HTTPException) as e:
            quiz.quiz_submit({"drawn": d, "answers": {}}, username="nguoimoi")
        assert e.value.status_code == 400

    def test_drawn_khong_phai_list_thi_400(self):
        from fastapi import HTTPException
        for xau in ({"a": "b"}, "abcdefghij", None, 10):
            with pytest.raises(HTTPException) as e:
                quiz.quiz_submit({"drawn": xau, "answers": {}}, username="nguoimoi")
            assert e.value.status_code == 400

    def test_answers_khong_phai_dict_thi_400(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as e:
            quiz.quiz_submit({"drawn": de(), "answers": ["a", "b"]}, username="nguoimoi")
        assert e.value.status_code == 400

    def test_seconds_bay_ba_khong_lam_sap(self):
        for xau in ("abc", -5, 10**9, None):
            kq = quiz.quiz_submit({"drawn": de(), "answers": {}, "seconds": xau},
                                  username="nguoimoi")
            assert kq["score"] == 0


class TestHangRaoQuyen:
    """Moi route deu phai doi dang nhap — hang rao o CHU KY HAM, khong phai
    mot dong `if` trong than ham (de bi xoa nham khi sua logic)."""

    @pytest.mark.parametrize(
        "route",
        [r for r in quiz.router.routes if getattr(r, "endpoint", None)],
        ids=lambda r: r.path,
    )
    def test_route_doi_dang_nhap(self, route):
        deps = [p.default.dependency
                for p in inspect.signature(route.endpoint).parameters.values()
                if hasattr(p.default, "dependency")]
        assert quiz.current_user in deps, f"{route.path} khong doi dang nhap"

    def test_khong_co_header_thi_401(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as e:
            quiz.current_user(None)
        assert e.value.status_code == 401

    def test_ten_dang_nhap_duoc_boc_khoi_realm(self):
        assert quiz.current_user("antv@ANVIETPHATGROUP.COM") == "antv"
        assert quiz.current_user("ANVIETPHATGROUP\\antv") == "antv"
