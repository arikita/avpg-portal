-- Ho so ca nhan (Account Profile) — AVP Portal
-- Chi luu phan NGUOI DUNG TU DAT. Ho ten / chuc danh / phong ban / email / so
-- may le van lay tu AD moi lan doc (khong nhan ban, khong lech voi AD).
CREATE TABLE IF NOT EXISTS user_profile (
  username    text PRIMARY KEY,
  headline    text        NOT NULL DEFAULT '',   -- mot dong gioi thieu
  bio         text        NOT NULL DEFAULT '',   -- van ban THUAN, nhieu dong
  avatar      text        NOT NULL DEFAULT '',   -- /media/profile/<uuid>.jpg
  cover       text        NOT NULL DEFAULT '',
  accent      text        NOT NULL DEFAULT '',   -- ma tong mau, trong = mac dinh
  interests   jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- the so thich / ky nang
  workit_key  text        NOT NULL DEFAULT '',   -- ma nhan vien ben Workit (neu can)
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profile OWNER TO avpportal;

-- Chi nhung nguoi da tai anh len moi nam trong bang => index nho.
CREATE INDEX IF NOT EXISTS user_profile_avatar_idx
  ON user_profile (username) WHERE avatar <> '';
