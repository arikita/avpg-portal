"""Bai kiem tra sau buoi hoi nhap IT (/onboarding/kiem-tra) — 28/08/2026.

VI SAO CO FILE NAY: phong IT training nhan vien moi, nhung "da ngoi nghe"
khong dong nghia voi "da nam duoc". Truoc day khong co cach nao biet ai thuc
su nho quy dinh nao, va cung khong biet PHAN NAO cua buoi training khong vao
dau ai. Bang `quiz_attempt` tra loi ca hai cau hoi do.

BON QUYET DINH THIET KE, deu co ly do:

  1. DAP AN CHI NAM O DAY, CHAM DIEM CHAY O SERVER.
     `src/app/content/quiz.content.ts` (cau hoi + lua chon) di thang vao bundle
     JavaScript ma trinh duyet tai ve — de dap an o do thi mo DevTools la thay
     het, bai kiem tra thanh vo nghia. Client chi gui len 10 cau da boc + cac
     `optionId` da chon. Doi lai: sua cau hoi phai sua HAI file, nen co
     `server/tests/test_quiz.py` doi chieu id hai ben.

  2. NOP BAI XONG CHI NOI "CAU NAO SAI", KHONG NOI "DAP AN DUNG LA GI".
     Neu tra ve dap an dung thi mot lan nop bua la lay duoc de, roi truyen tay
     nhau. Nguoi lam bai van biet minh phai hoc lai o dau: moi cau co san duong
     dan toi dung muc trong /onboarding hoac /regulations (truong `ref` ben
     file content).

  3. GIU LAI MOI LAN LAM, KHONG GHI DE.
     Lam lai duoc la co y — muc tieu la nguoi ta NHO, khong phai de loai ai.
     Nhung so lan lam duoc hien trong /admin: mot nguoi dat 10/10 o lan thu 6
     doc rat khac mot nguoi dat ngay lan dau, va IT can nhin thay khac biet do.

  4. KHO 50 CAU, MOI LUOT BOC 10 (28/08/2026).
     CLIENT BOC, SERVER CHAM DUNG 10 CAU DUOC GUI LEN. Server kiem hinh dang:
     dung 10 id, khong trung nhau, deu co that trong kho — sai thi 400.
     DIEU NAY KHONG CHAN duoc nguoi sua JavaScript de tu chon 10 cau de nhat;
     no chi chan bai lam rac va nham lan. Chap nhan co y: bai nay cho phep lam
     lai khong gioi han va moi luot deu duoc ghi lai, nen ke bo cong sua JS de
     "boc" cau de van phai biet dap an, va so lan lam cua ho hien ngay trong
     /admin. Muon chan han thi phai de SERVER boc va ky de (HMAC hoac bang
     `quiz_draw`) — dat hon nhieu so voi thu doi lay duoc.

BANG: xem `server/schema_quiz.sql`. File nay VAN tu tao bang neu chua co
(`_ensure`) — deploy ma quen chay psql thi 850 nguoi bam "Nop bai" gap 500,
mot cai gia qua dat cho mot lenh CREATE TABLE IF NOT EXISTS.
"""
from __future__ import annotations

import json
import os
from typing import Any

import psycopg
from fastapi import APIRouter, Body, Depends, Header, HTTPException

from .ad import get_user

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

DSN = os.environ.get("DATABASE_URL", "")

#: So cau moi luot lam. Doi so nay thi doi luon `QUIZ_DRAW` ben quiz.content.ts.
DRAW = 10

#: So cau dung toi thieu de dat. Doi so nay thi doi luon `QUIZ_PASS` ben
#: quiz.content.ts — test_quiz.py khoa hai gia tri bang nhau.
PASS = 8

#: Dap an dung: id cau hoi -> id lua chon. Thu tu khong quan trong; ten thi co
#: — chung phai trung tung ky tu voi QUIZ_QUESTIONS ben frontend.
ANSWERS: dict[str, str] = {
    # --- tai khoan & mat khau ---
    "mot-mat-khau": "doi-theo",
    "muon-tai-khoan": "tu-choi",
    "ten-tai-khoan": "antv",
    "mat-khau-manh": "avp-manh",
    "doi-mat-khau-lan-dau": "ctrl-alt-del",
    "ghi-mat-khau": "dan-man-hinh",              # hoi cach nao VI PHAM
    "dung-tai-khoan-nguoi-khac": "khong-duoc",
    # --- email ---
    "dung-luong-dinh-kem": "20mb",
    "email-cong-cong": "khong-duoc",
    "email-nac-danh": "gia-mao",
    "chuyen-tiep-tai-lieu": "khong-duoc",
    "chu-ky-email": "trang-cong-cu",
    # --- mang & dien thoai ---
    "wifi-khach": "wifi-khach",
    "wifi-nhan-vien-dang-nhap": "tai-khoan-ad",
    "so-may-nhanh": "bam-0",
    "pha-hoai-mang": "thay-doi-mang",
    # --- thiet bi ---
    "thao-lap-may": "gui-yeu-cau",
    "may-ca-nhan": "phai-xin-phep",
    "dien-thoai-khoa-ma": "khoa-ma",
    "laptop-ngoai-gio": "cat-di",
    "laptop-ben-ngoai": "mo-chia-se",            # hoi yeu cau nao KHONG dung
    "may-in": "kiem-may-in",
    # --- phan mem ---
    "cai-phan-mem": "gui-yeu-cau-it",
    "phan-mem-lau": "da-dang-ky",
    "choi-game": "bi-cam",
    "diet-virus": "cap-nhat",
    "ban-quyen": "co-the-sa-thai",
    # --- bao mat ---
    "khoa-man-hinh": "win-l",
    "usb": "chi-doc",
    "phishing": "bao-it-ngay",
    "usb-la": "giao-it",
    "gui-tai-lieu-nhay-cam": "ma-hoa-kenh-khac",
    "kenh-gui-mat-khau": "kenh-khac",
    "tai-lieu-bat-buoc-ma-hoa": "luong-tai-chinh",
    "xam-nhap": "bao-it",
    # --- du lieu ---
    "so-huu-du-lieu": "cong-ty",
    "kiem-tra-thu-muc": "co-quyen",
    "may-nguoi-khac": "khong-duoc",
    "luu-tai-lieu": "o-mang",
    "file-ca-nhan-tai-ve": "khong-duoc-luu",
    # --- ho tro IT ---
    "helpdesk": "email-helpdesk",
    "thong-tin-ticket": "day-du",
    "ad-nhan-dien": "tu-dong-ad",
    "sla-khan-cap": "30-phut",
    "quen-mat-khau": "gui-ticket",
    "portal-ghi-log": "ten-trang-thao-tac",
    # --- quy dinh chung ---
    "gio-nghi-trua": "gio-nghi-trua",
    "che-tai": "toi-truy-to",
    "hanh-vi-cam": "dat-phong-hop",              # hoi hanh vi nao KHONG bi cam
    "workit-dat-phong": "workit",
}

#: Tong so cau trong kho.
POOL = len(ANSWERS)

#: Chan rac vao DB. Nguoi dung that gui toi da 10 cap chuoi ngan.
_MAX_KEYS = 60
_MAX_LEN = 64


def current_user(x_remote_user: str | None = Header(default=None)) -> str:
    if not x_remote_user:
        raise HTTPException(status_code=401, detail="khong xac dinh duoc nguoi dung")
    return x_remote_user.split("@")[0].split("\\")[-1].strip()


def _conn():
    return psycopg.connect(DSN, connect_timeout=5)


_ready = False


def _ensure(conn) -> None:
    """Tao bang neu chua co. Chay mot lan cho moi tien trinh."""
    global _ready
    if _ready:
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS quiz_attempt (
          id          bigserial PRIMARY KEY,
          username    text        NOT NULL,
          full_name   text        NOT NULL DEFAULT '',
          department  text        NOT NULL DEFAULT '',
          score       int         NOT NULL,
          total       int         NOT NULL,
          passed      boolean     NOT NULL,
          answers     jsonb       NOT NULL DEFAULT '{}'::jsonb,
          drawn       text[]      NOT NULL DEFAULT '{}',
          wrong       text[]      NOT NULL DEFAULT '{}',
          seconds     int         NOT NULL DEFAULT 0,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
    """)
    # `CREATE TABLE IF NOT EXISTS` KHONG them cot vao bang da co san. Bang nay
    # doi tu 10 cau co dinh sang kho 50 cau ngay 28/08 — may nao da tao bang
    # theo ban cu se thieu cot `drawn`.
    conn.execute("ALTER TABLE quiz_attempt ADD COLUMN IF NOT EXISTS drawn text[] "
                 "NOT NULL DEFAULT '{}'")
    conn.execute("CREATE INDEX IF NOT EXISTS quiz_attempt_user_idx "
                 "ON quiz_attempt (username, created_at DESC)")
    conn.commit()
    _ready = True


def _de_bai(payload: Any) -> list[str]:
    """10 cau cua luot nay, lay tu client va KIEM HINH DANG.

    Khong tin so luong hay noi dung tu client: dung DRAW cau, khong trung nhau,
    va deu phai co that trong kho. Xem ghi chu (4) dau file ve viec dieu nay
    CHAN duoc gi va khong chan duoc gi.
    """
    if not isinstance(payload, list) or len(payload) != DRAW:
        raise HTTPException(status_code=400,
                            detail=f"bai lam phai gom dung {DRAW} cau")
    de = [q for q in payload if isinstance(q, str) and len(q) <= _MAX_LEN]
    if len(set(de)) != DRAW or any(q not in ANSWERS for q in de):
        raise HTTPException(status_code=400, detail="danh sach cau hoi khong hop le")
    return de


def _clean(payload: Any, de: list[str]) -> dict[str, str]:
    """Loc `answers`: chi giu cap chuoi ngan thuoc dung de bai cua luot nay."""
    if not isinstance(payload, dict) or len(payload) > _MAX_KEYS:
        raise HTTPException(status_code=400, detail="du lieu bai lam khong hop le")
    trong_de = set(de)
    return {k: v for k, v in payload.items()
            if isinstance(k, str) and isinstance(v, str)
            and len(k) <= _MAX_LEN and len(v) <= _MAX_LEN and k in trong_de}


@router.get("")
def quiz_status(username: str = Depends(current_user)) -> dict:
    """Trang thai cua CHINH nguoi dang dang nhap: da lam chua, diem cao nhat.

    Khong tra ve bai lam cu — nguoi hoc khong can, va tra ve la them mot
    duong ro ri dap an.
    """
    row = None
    try:
        with _conn() as conn:
            _ensure(conn)
            row = conn.execute(
                """SELECT count(*), coalesce(max(score), 0), bool_or(passed),
                          max(created_at)
                     FROM quiz_attempt WHERE username = %s""",
                (username,),
            ).fetchone()
    except Exception:                                          # noqa: BLE001
        # DB hong thi van cho nguoi ta lam bai — mat phan "da lam lan truoc",
        # khong mat ca trang.
        pass

    attempts, best, passed, last = (row or (0, 0, False, None))
    return {
        "total": DRAW,
        "pool": POOL,
        "pass": PASS,
        "attempts": attempts or 0,
        "best": best or 0,
        "passed": bool(passed),
        "lastAt": last.isoformat() if last else "",
    }


@router.post("/submit")
def quiz_submit(payload: dict = Body(...), username: str = Depends(current_user)) -> dict:
    """Cham bai, ghi lai, tra ve diem + DANH SACH CAU SAI (khong kem dap an)."""
    de = _de_bai(payload.get("drawn"))
    answers = _clean(payload.get("answers"), de)
    seconds = payload.get("seconds")
    seconds = int(seconds) if isinstance(seconds, (int, float)) and 0 <= seconds < 86400 else 0

    # Cau bo trong tinh la SAI, khong phai loi 400: nguoi ta vua lam xong bai,
    # dung bat ho lam lai tu dau vi mot o quen bam.
    wrong = [q for q in de if answers.get(q) != ANSWERS[q]]
    score = DRAW - len(wrong)
    passed = score >= PASS

    # AD tra loi cham hay tra loi hong deu KHONG duoc chan viec nop bai —
    # ten day du chi de bang trong /admin doc de hon, khong phai du lieu goc.
    try:
        info = get_user(username) or {}
    except Exception:                                          # noqa: BLE001
        info = {}
    try:
        with _conn() as conn:
            _ensure(conn)
            conn.execute(
                """INSERT INTO quiz_attempt
                     (username, full_name, department, score, total, passed,
                      answers, drawn, wrong, seconds)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)""",
                (username, info.get("fullName") or username,
                 (info.get("department") or "").strip(),
                 score, DRAW, passed, json.dumps(answers), de, wrong, seconds),
            )
            conn.commit()
    except Exception:                                          # noqa: BLE001
        # Ghi hong thi van phai tra ket qua cho nguoi lam bai. Mat mot dong
        # thong ke con hon bat ho lam lai tu dau.
        pass

    return {"score": score, "total": DRAW, "pass": PASS,
            "passed": passed, "wrong": sorted(wrong)}
