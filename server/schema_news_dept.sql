-- Phong ban CUA BAI VIET, ghi lai luc dang (25/08/2026).
--
-- VI SAO LUU VAO BAI thay vi tra AD moi lan kiem quyen:
--   1. Bai thuoc ve PHONG DA DANG NO. Nguoi viet chuyen phong thi bai khong
--      duoc doi chu theo — neu tra AD luc kiem, mot nguoi HR chuyen sang MKT
--      se lam ca kho bai cu cua HR roi sang tay MKT.
--   2. Kiem quyen chay o moi request; tra AD la them mot vong LDAP moi lan.
--
-- Chuoi da chuan hoa (strip + lower) de so sanh khong dinh cach viet lech.
ALTER TABLE news_post ADD COLUMN IF NOT EXISTS author_dept text NOT NULL DEFAULT '';

-- Loc theo phong la truy van thuong xuyen khi ai do mo /admin/news.
CREATE INDEX IF NOT EXISTS news_post_author_dept_idx ON news_post (author_dept);
