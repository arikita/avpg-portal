"""Bat "ten chua dinh nghia" trong server/app/*.py bang AST — KHONG import.

Vi sao can: `news.py` `wall.py` `gallery.py` keo theo `nh3` + `python-multipart`,
hai goi chi co trong venv tren .136 => tren may dev moi test dung toi chung deu
SKIP im lang. `ast.parse` chi bao loi CU PHAP, ma xoa nham mot ham thi cu phap
van dung.

25/08/2026 da tra gia: mot lan sua co script lo xoa ca cum `_conn` `_bi`
`_name_of` `_post_row` trong `news.py`. 123 test qua, `ast.parse` qua, day len
production roi `/api/news` moi 500 — `NameError: name '_conn' is not defined`.
Phep do nay bat dung loi do trong 0,05 giay, trước khi cham vao server.

Day khong phai pyflakes day du (khong theo vet luong dieu khien), no chi tra
loi mot cau: TEN NAY CO DUOC DINH NGHIA O DAU KHONG. The la du cho kieu hong
noi tren, va khong bao dong gia.
"""
from __future__ import annotations

import ast
import builtins
import os

import pytest

APP = os.path.join(os.path.dirname(__file__), "..", "app")
BUILTIN = set(dir(builtins)) | {"__name__", "__file__", "__doc__", "__package__"}


def _rang_buoc(node: ast.AST) -> set[str]:
    """Moi ten mot pham vi TAO RA: tham so, gan, for, with-as, except-as, def."""
    ten: set[str] = set()

    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
        a = node.args
        for arg in [*a.posonlyargs, *a.args, *a.kwonlyargs]:
            ten.add(arg.arg)
        if a.vararg:
            ten.add(a.vararg.arg)
        if a.kwarg:
            ten.add(a.kwarg.arg)

    than = node.body if isinstance(getattr(node, "body", None), list) else []
    for con in than:
        for sub in ast.walk(con):
            # Khong chui vao def/lambda long ben trong: chung co pham vi rieng,
            # ten cua chung khong ro ri nguoc ra ngoai.
            if isinstance(sub, ast.Name) and isinstance(sub.ctx, (ast.Store, ast.Del)):
                ten.add(sub.id)
            elif isinstance(sub, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                ten.add(sub.name)
            elif isinstance(sub, (ast.Import, ast.ImportFrom)):
                for al in sub.names:
                    ten.add((al.asname or al.name).split(".")[0])
            elif isinstance(sub, (ast.Global, ast.Nonlocal)):
                ten.update(sub.names)
            elif isinstance(sub, ast.ExceptHandler) and sub.name:
                ten.add(sub.name)
    return ten


def _kiem(duong_dan: str) -> list[str]:
    cay = ast.parse(open(duong_dan, encoding="utf-8").read(), duong_dan)
    ngoai = BUILTIN | _rang_buoc(cay)
    thieu: list[str] = []

    def di(nut: ast.AST, thay_duoc: set[str]) -> None:
        for con in ast.iter_child_nodes(nut):
            if isinstance(con, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                di(con, thay_duoc | _rang_buoc(con))
            elif isinstance(con, ast.ClassDef):
                di(con, thay_duoc | _rang_buoc(con))
            else:
                if isinstance(con, ast.Name) and isinstance(con.ctx, ast.Load):
                    if con.id not in thay_duoc:
                        thieu.append(f"dong {con.lineno}: {con.id}")
                di(con, thay_duoc)

    di(cay, ngoai)
    return thieu


FILE = sorted(f for f in os.listdir(APP) if f.endswith(".py"))


@pytest.mark.parametrize("ten_file", FILE)
def test_khong_co_ten_chua_dinh_nghia(ten_file: str) -> None:
    thieu = _kiem(os.path.join(APP, ten_file))
    assert not thieu, f"{ten_file} dung ten chua dinh nghia:\n  " + "\n  ".join(thieu)


def test_so_cot_POST_COLS_khop_voi_post_row() -> None:
    """`_post_row` boc tuple theo dung thu tu POST_COLS.

    Lech mot cot thi KHONG co ngoai le nao — moi truong nhay mot bac, tieu de
    thanh tom tat. Chi doc bang AST vi news.py khong import duoc o may dev.
    """
    duong_dan = os.path.join(APP, "news.py")
    cay = ast.parse(open(duong_dan, encoding="utf-8").read(), duong_dan)

    cot = None
    for nut in cay.body:
        if isinstance(nut, ast.Assign) and getattr(nut.targets[0], "id", "") == "POST_COLS":
            cot = ast.literal_eval(nut.value)
    assert cot, "khong tim thay POST_COLS"
    so_cot = len([c for c in cot.split(",") if c.strip()])

    boc = None
    for nut in ast.walk(cay):
        if isinstance(nut, ast.FunctionDef) and nut.name == "_post_row":
            for sub in ast.walk(nut):
                if isinstance(sub, ast.Assign) and isinstance(sub.targets[0], ast.Tuple):
                    boc = len(sub.targets[0].elts)
    assert boc, "khong tim thay cho boc tuple trong _post_row"
    assert boc == so_cot, f"POST_COLS co {so_cot} cot nhung _post_row boc {boc}"
