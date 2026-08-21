-- Hen gio phat hanh bai tin (18/08/2026).
--   status = 'scheduled' + scheduled_at = luc bai tu dong len song.
--   Timer avp-news-publish (moi phut) va API (feed / mo bai) deu goi
--   publish_due() -> UPDATE ... RETURNING nen khong the dang trung.
ALTER TABLE news_post ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Chi so mot phan: chi cac bai dang cho, tra cuu moi phut khong ton gi.
CREATE INDEX IF NOT EXISTS news_post_scheduled_idx
    ON news_post (scheduled_at) WHERE status = 'scheduled';

ALTER TABLE news_post OWNER TO avpportal;
