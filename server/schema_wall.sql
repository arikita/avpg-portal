-- Tuong ca nhan (wall) tren trang ho so — AVP Portal
--
-- QUY UOC QUYEN (user chot 13/08/2026): CHI CHU HO SO dang bai len tuong cua
-- minh; moi nguoi khac tha cam xuc + binh luan. Cot `author` van duoc giu
-- rieng voi `owner` de sau nay muon cho dong nghiep viet len tuong nguoi khac
-- thi khong phai doi luoc do.

CREATE TABLE IF NOT EXISTS wall_post (
  id          bigserial PRIMARY KEY,
  owner       text        NOT NULL,          -- tuong cua ai
  author      text        NOT NULL,          -- ai viet (hien tai = owner)
  author_name text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  image       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz,
  deleted     boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS wall_post_owner_idx
  ON wall_post (owner, created_at DESC) WHERE deleted = false;

-- Mot nguoi mot cam xuc cho moi bai; doi emoji = UPDATE.
CREATE TABLE IF NOT EXISTS wall_reaction (
  post_id    bigint      NOT NULL REFERENCES wall_post (id) ON DELETE CASCADE,
  username   text        NOT NULL,
  name       text        NOT NULL DEFAULT '',
  emoji      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, username)
);

-- Binh luan PHANG (khong long nhau) — tuong la cho noi ngan, khong phai
-- dien dan; long nhau de danh cho trang tin.
CREATE TABLE IF NOT EXISTS wall_comment (
  id          bigserial PRIMARY KEY,
  post_id     bigint      NOT NULL REFERENCES wall_post (id) ON DELETE CASCADE,
  author      text        NOT NULL,
  author_name text        NOT NULL DEFAULT '',
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz,
  deleted     boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS wall_comment_post_idx ON wall_comment (post_id, created_at);

-- Chuong thong bao: bai tuong khong nam o /news/<id> nen can duong dan rieng.
-- Trong = giu nguyen hanh vi cu (dan toi /news/<postId>).
ALTER TABLE news_notification ADD COLUMN IF NOT EXISTS url text NOT NULL DEFAULT '';

-- CHU Y: `post_id` co KHOA NGOAI sang news_post, va id bai tuong TRUNG DAY SO
-- voi id bai tin => nhet id bai tuong vao do thi hoac vi pham khoa ngoai, hoac
-- (te hon) lot qua roi thong bao tro NHAM sang mot bai tin. Bai tuong PHAI di
-- bang cot rieng. ON DELETE CASCADE: xoa bai tuong thi thong bao cua no bay theo.
ALTER TABLE news_notification ADD COLUMN IF NOT EXISTS wall_post_id bigint
  REFERENCES wall_post (id) ON DELETE CASCADE;

ALTER TABLE wall_post ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '';
ALTER TABLE wall_post OWNER TO avpportal;
ALTER TABLE wall_reaction OWNER TO avpportal;
ALTER TABLE wall_comment OWNER TO avpportal;
ALTER SEQUENCE wall_post_id_seq OWNER TO avpportal;
ALTER SEQUENCE wall_comment_id_seq OWNER TO avpportal;
