-- He thong phat hien loi (telemetry) — AVP Portal
--
-- Vi sao TU HOST chu khong dung Sentry/Clarity: cung ly do da loai Microsoft
-- Clarity — du lieu nguoi dung KHONG duoc roi mang noi bo. Doi lai phai tu lam
-- phan gop nhom, do la ly do bang app_error luu MOT DONG CHO MOI LOAI LOI chu
-- khong phai moi lan xay ra (kieu Sentry). Khong gop nhom thi 40.000 loi giong
-- nhau se thanh bai rac khong ai doc.

-- ---------------------------------------------------------------------------
-- 1) app_error — mot dong cho moi LOAI loi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_error (
  id           bigserial   PRIMARY KEY,
  -- sha256(source | kind | message da chuan hoa | khung stack dau).
  -- TINH O SERVER, khong tin client gui len.
  fingerprint  text        NOT NULL UNIQUE,
  source       text        NOT NULL,                 -- client | server | user
  severity     text        NOT NULL,                 -- critical | error | warning | info
  kind         text        NOT NULL,                 -- ChunkLoadError, HTTP500, UnhandledRejection, UserReport...
  message      text        NOT NULL,
  -- route/endpoint DA LOC PII: /profile/* chu khong phai /profile/haivl
  route        text        NOT NULL DEFAULT '',
  endpoint     text        NOT NULL DEFAULT '',
  http_status  int,
  count        bigint      NOT NULL DEFAULT 1,
  users_hit    int         NOT NULL DEFAULT 1,       -- so nguoi KHAC NHAU dinh loi nay
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'new',   -- new | ack | resolved
  resolved_by  text,
  resolved_at  timestamptz,
  build_id     text        NOT NULL DEFAULT ''       -- biet loi thuoc ban build nao
);
ALTER TABLE app_error OWNER TO avpportal;

-- Trang /admin/errors LUON loc theo (status, severity) roi sap theo last_seen.
CREATE INDEX IF NOT EXISTS app_error_list_idx
  ON app_error (status, severity, last_seen DESC);
-- Sau moi lan deploy: "ban build moi co de ra loi gi chua?"
CREATE INDEX IF NOT EXISTS app_error_build_idx
  ON app_error (build_id, first_seen DESC);

-- ---------------------------------------------------------------------------
-- 2) app_error_event — mau tho, giu 30 ngay, toi da 20 mau moi fingerprint
-- ---------------------------------------------------------------------------
-- Gop nhom cho biet "loi gi, bao nhieu nguoi"; con day moi cho biet "tai sao".
CREATE TABLE IF NOT EXISTS app_error_event (
  id         bigserial   PRIMARY KEY,
  error_id   bigint      NOT NULL REFERENCES app_error(id) ON DELETE CASCADE,
  username   text        NOT NULL DEFAULT '',
  user_agent text        NOT NULL DEFAULT '',
  url        text        NOT NULL DEFAULT '',
  stack      text        NOT NULL DEFAULT '',
  request_id text        NOT NULL DEFAULT '',   -- khop voi X-Request-Id o response
  -- breadcrumb: 20 hanh dong cuoi truoc khi loi. TUYET DOI khong chua noi dung
  -- chat / tin nhan — xem ghi chu rieng tu o cuoi file.
  context    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_error_event OWNER TO avpportal;

CREATE INDEX IF NOT EXISTS app_error_event_eid_idx
  ON app_error_event (error_id, created_at DESC);
-- Cho cron don rac theo tuoi.
CREATE INDEX IF NOT EXISTS app_error_event_age_idx
  ON app_error_event (created_at);

-- ---------------------------------------------------------------------------
-- 2b) app_error_user — dem CHINH XAC so nguoi dinh moi loi
-- ---------------------------------------------------------------------------
-- Khong the dem tu app_error_event vi bang do chi giu 20 mau/fingerprint.
-- Bang nay chi 2 cot nen re; app_error.users_hit lay tu day.
CREATE TABLE IF NOT EXISTS app_error_user (
  error_id bigint NOT NULL REFERENCES app_error(id) ON DELETE CASCADE,
  username text   NOT NULL,
  PRIMARY KEY (error_id, username)
);
ALTER TABLE app_error_user OWNER TO avpportal;

-- ---------------------------------------------------------------------------
-- 3) app_alert_sent — chong spam thong bao
-- ---------------------------------------------------------------------------
-- BAT BUOC cap nhat bang INSERT ... ON CONFLICT DO UPDATE (nguyen tu).
-- API chay 2 uvicorn worker: doc-roi-ghi se lam CA HAI worker cung gui push.
CREATE TABLE IF NOT EXISTS app_alert_sent (
  fingerprint text        PRIMARY KEY,
  last_sent   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_alert_sent OWNER TO avpportal;

-- ---------------------------------------------------------------------------
-- 4) app_request_stat — rollup moi phut: bat "CHAM" chu khong chi "LOI"
-- ---------------------------------------------------------------------------
-- KHONG luu p95: khong the tinh p95 bang UPSERT ma khong giu ca phan bo.
-- Thay bang ms_sum (ra trung binh), ms_max, va n_slow (dem request > 3s) —
-- du de bao "cham", trung thuc hon la mot con so p95 sai.
CREATE TABLE IF NOT EXISTS app_request_stat (
  minute   timestamptz NOT NULL,
  endpoint text        NOT NULL,          -- da gom nhom: /api/news/{id} chu khong phai /api/news/42
  n        int         NOT NULL DEFAULT 0,
  n_4xx    int         NOT NULL DEFAULT 0,
  n_5xx    int         NOT NULL DEFAULT 0,
  n_slow   int         NOT NULL DEFAULT 0,
  ms_sum   bigint      NOT NULL DEFAULT 0,
  ms_max   int         NOT NULL DEFAULT 0,
  PRIMARY KEY (minute, endpoint)
);
ALTER TABLE app_request_stat OWNER TO avpportal;

CREATE INDEX IF NOT EXISTS app_request_stat_minute_idx
  ON app_request_stat (minute DESC);

-- ---------------------------------------------------------------------------
-- 5) app_metric — chi so NGHIEP VU theo gio
-- ---------------------------------------------------------------------------
-- Day la tang bat loai bug TE NHAT: loi KHONG nem exception. Form gui xong mat
-- du lieu, feed tra ve rong, chat bao "da gui" ma khong ai nhan — khong co
-- exception nao de bat, app_error se hien "0 loi" trong khi user dang chui.
-- Cach duy nhat thay duoc: coi so lieu nghiep vu la CAM BIEN, so voi trung vi
-- 4 tuan cung khung gio; lech qua nguong thi sinh mot su kien warning.
CREATE TABLE IF NOT EXISTS app_metric (
  hour timestamptz NOT NULL,
  name text        NOT NULL,   -- wall_post | chat_message | login | news_view | upload | poll_vote
  n    int         NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, name)
);
ALTER TABLE app_metric OWNER TO avpportal;

CREATE INDEX IF NOT EXISTS app_metric_name_idx
  ON app_metric (name, hour DESC);

-- ---------------------------------------------------------------------------
-- 6) app_page_view — luot xem trang, TU HOST
-- ---------------------------------------------------------------------------
-- Phuong an nay tung bi gac ngay 18/08 khi chon GA4. Lam lai o day vi GA4
-- KHONG tra loi duoc cau hoi quan trong nhat: AI / PHONG BAN NAO thuc su dung
-- portal — dieu khoan GA cam gui PII nen da phai boi /profile/<user> thanh
-- /profile/*. Bang nay o lai mang noi bo nen khong vuong dieu do.
--
-- Mot dong moi (gio, route, nguoi) => dem duoc CHINH XAC so nguoi rieng biet,
-- khong phai uoc luong. 1700 nguoi x ~20 route x 10 gio lam viec van nho.
CREATE TABLE IF NOT EXISTS app_page_view (
  hour       timestamptz NOT NULL,
  route      text        NOT NULL,          -- da loc PII
  username   text        NOT NULL,
  department text        NOT NULL DEFAULT '',
  n          int         NOT NULL DEFAULT 1,
  PRIMARY KEY (hour, route, username)
);
ALTER TABLE app_page_view OWNER TO avpportal;

CREATE INDEX IF NOT EXISTS app_page_view_hour_idx
  ON app_page_view (hour DESC);
CREATE INDEX IF NOT EXISTS app_page_view_dept_idx
  ON app_page_view (department, hour DESC);

-- ---------------------------------------------------------------------------
-- Luu tru / don rac  (chay bang cron, xem tools/telemetry_prune.sql)
-- ---------------------------------------------------------------------------
--   app_error_event : xoa > 30 ngay
--   app_error       : xoa ban da 'resolved' > 90 ngay
--   app_request_stat: xoa > 30 ngay
--   app_metric      : GIU LAU (>= 1 nam) — can 4 tuan cung ky de do bat thuong
--   app_page_view   : xoa > 180 ngay
-- Khong don thi mot loi lap mot trieu lan se lam day dia .136 (chi con ~8 GB).

-- ---------------------------------------------------------------------------
-- RIENG TU — luat cung, doc truoc khi sua bat ky cho nao
-- ---------------------------------------------------------------------------
-- 1. TUYET DOI khong ghi noi dung chat / tin nhan / noi dung bai viet vao
--    context hay message. Breadcrumb chi luu TEN hanh dong va route.
-- 2. route/url phai qua safePath() truoc khi luu (/profile/<user> -> /profile/*).
-- 3. Bang nay ghi kem username = co tinh chat giam sat nhan vien. Nguoi xem
--    duoc gioi han o CONTENT_ADMIN_USERS, va da ghi mot dong minh bach trong
--    trang tro giup. Doi pham vi nguoi xem thi phai sua ca hai cho.
