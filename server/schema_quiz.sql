-- Bai kiem tra sau buoi hoi nhap IT (28/08/2026) — xem server/app/quiz.py.
--
-- GIU MOI LAN LAM, KHONG UPSERT theo username: mot nguoi dat 8/10 ngay lan
-- dau va mot nguoi dat 8/10 o lan thu sau la hai tinh huong khac han nhau, va
-- do la dieu phong IT can nhin thay. Bang chi lon theo so nguoi x so lan lam
-- (vai nghin dong), khong can don dinh ky.
--
-- Cot `wrong` la thu co gia tri nhat o day: gom lai theo cau se ra "cau nao ca
-- cong ty hay sai" — tuc la phan nao cua buoi training khong vao dau ai. Do la
-- thong tin de sua BUOI TRAINING, khong phai de cham diem nhan vien.
--
-- PHAI CO CA `drawn` (10 cau cua luot do) chu khong chi `wrong`. Kho co 50 cau
-- va moi luot chi boc 10, nen "cau X sai 9 luot" tu no khong noi len gi: 9 tren
-- 12 lan duoc hoi la mot van de, 9 tren 200 lan thi khong. Mau so nam o `drawn`.
--
-- `department` chot lai luc lam bai (giong news_post.author_dept): nguoi
-- chuyen phong thi ket qua cu van thuoc ve phong luc do.
CREATE TABLE IF NOT EXISTS quiz_attempt (
  id          bigserial PRIMARY KEY,
  username    text        NOT NULL,
  full_name   text        NOT NULL DEFAULT '',
  department  text        NOT NULL DEFAULT '',
  score       int         NOT NULL,
  total       int         NOT NULL,
  passed      boolean     NOT NULL,
  -- Bai lam day du: {"<id cau>": "<id lua chon>"}. Giu lai de sau nay con
  -- phan tich duoc "nguoi sai cau USB thuong chon phuong an nao".
  answers     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- 10 cau da boc cho luot nay = MAU SO khi tinh ti le sai cua tung cau.
  drawn       text[]      NOT NULL DEFAULT '{}',
  wrong       text[]      NOT NULL DEFAULT '{}',
  seconds     int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Truy van thuong xuyen: lich su cua mot nguoi, va bang xep theo thoi gian.
CREATE INDEX IF NOT EXISTS quiz_attempt_user_idx
  ON quiz_attempt (username, created_at DESC);

-- Bang tao truoc 28/08/2026 (ban 10 cau co dinh) khong co cot nay.
ALTER TABLE quiz_attempt ADD COLUMN IF NOT EXISTS drawn text[] NOT NULL DEFAULT '{}';
