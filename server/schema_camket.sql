-- Ky cam ket bao mat (04/09/2026) — xem server/app/camket.py.
--
-- MOI NGUOI MOT DONG, khac han quiz_attempt (giu moi lan lam). Bai kiem tra
-- lam lai duoc khong gioi han va so lan lam la thong tin co gia tri; con cam
-- ket thi ky mot lan la xong — giu nhieu dong chi tao ra cau hoi "ban nao moi
-- la ban co hieu luc".
--
-- BAN PDF DA KY KHONG NAM O DAY, chi co `document_id` tro sang Documenso.
-- Dia .136 chi ~19GB, va quan trong hon: hai noi giu cung mot van ban la hai
-- noi co the lech nhau. Documenso da co san nhat ky kiem toan kem IP cho tung
-- chu ky — do moi la bang chung, khong phai file PDF nam trong thu muc nao do.
--
-- `token` la thu duy nhat can de ky THAY nguoi khac. No chi duoc tra ve cho
-- chinh chu o GET /api/cam-ket; KHONG duoc lot vao /api/admin/cam-ket hay bat
-- ky cho nao khac. Co test khoa dieu nay trong test_cam_ket.py.
--
-- `department` va `joined_at` chot lai luc tao tai lieu (giong
-- news_post.author_dept): nguoi chuyen phong thi ban cam ket cu van thuoc ve
-- phong luc ky.
CREATE TABLE IF NOT EXISTS cam_ket (
  username    text        PRIMARY KEY,
  full_name   text        NOT NULL DEFAULT '',
  department  text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  -- Ngay tao tai khoan AD. Giu lai de tra loi "vao lam bao lau moi ky" ma
  -- khong phai hoi lai LDAP cho tung dong.
  joined_at   date,
  -- Tai lieu ben Documenso. NULL = da vao trang nhung chua bam ky lan nao.
  document_id bigint,
  token       text        NOT NULL DEFAULT '',
  -- DANG_KY | DA_KY | TU_CHOI. Nguoi chua co dong nao trong bang thi frontend
  -- hien CHUA_KY — khong tao dong rong chi de ghi "chua lam gi ca".
  status      text        NOT NULL DEFAULT 'DANG_KY',
  created_at  timestamptz NOT NULL DEFAULT now(),
  signed_at   timestamptz
);

-- Truy van thuong xuyen o /admin: "ai chua ky", xep theo thoi gian.
CREATE INDEX IF NOT EXISTS cam_ket_status_idx ON cam_ket (status, created_at DESC);

-- BAY DA DINH VOI quiz_attempt (28/08/2026): chay file nay bang
-- `sudo -u postgres psql` thi bang thuoc so huu cua role `postgres`, con API
-- ket noi bang role `avpportal` ⇒ INSERT bi tu choi. camket.py KHONG nuot loi
-- ghi (khac quiz.py) nen se thay 500 ngay, nhung van chay hai lenh nay cho
-- chac:
--   ALTER TABLE cam_ket OWNER TO avpportal;
