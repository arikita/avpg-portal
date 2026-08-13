-- Chat noi bo — AVP Portal
-- Nhan rieng 1-1 (dm) + phong nhieu nguoi (group).

CREATE TABLE IF NOT EXISTS chat_conversation (
  id         bigserial PRIMARY KEY,
  kind       text        NOT NULL CHECK (kind IN ('dm', 'group')),
  title      text        NOT NULL DEFAULT '',        -- chi phong nhom
  -- Khoa chong tao trung cuoc tro chuyen 1-1: "usera|userb" da sap xep.
  -- NULL cho phong nhom (UNIQUE bo qua NULL nen tao bao nhieu phong cung duoc).
  dm_key     text UNIQUE,
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_at    timestamptz NOT NULL DEFAULT now()      -- de sap xep danh sach
);

CREATE TABLE IF NOT EXISTS chat_member (
  conv_id      bigint      NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
  username     text        NOT NULL,
  name         text        NOT NULL DEFAULT '',
  joined_at    timestamptz NOT NULL DEFAULT now(),
  -- Moc da doc: dem tin chua doc = so tin moi hon moc nay.
  last_read_at timestamptz NOT NULL DEFAULT to_timestamp(0),
  PRIMARY KEY (conv_id, username)
);
CREATE INDEX IF NOT EXISTS chat_member_user_idx ON chat_member (username);

CREATE TABLE IF NOT EXISTS chat_message (
  id          bigserial PRIMARY KEY,
  conv_id     bigint      NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
  sender      text        NOT NULL,
  sender_name text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  image       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted     boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS chat_message_conv_idx ON chat_message (conv_id, id DESC);

-- Ai dang online: WebSocket cap nhat moc nay luc ket noi va moi nhip tim.
CREATE TABLE IF NOT EXISTS chat_presence (
  username  text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now()
);

-- Ve vao cua WebSocket.
--
-- VI SAO CAN: trinh duyet KHONG lam duoc xac thuc Kerberos/Negotiate tren
-- ban bat tay WebSocket (khong gui duoc header tu dat, va 401 tren handshake
-- lam ket noi hong luon). Nen: goi mot API HTTP binh thuong (da qua Kerberos)
-- de xin ve, roi mo WebSocket kem ve do. Ve DUNG MOT LAN, song 60 giay.
-- Nam trong DB chu khong trong RAM vi API chay 2 worker: ve phat o worker nay
-- co the duoc dung o worker kia.
CREATE TABLE IF NOT EXISTS chat_ws_ticket (
  token      text PRIMARY KEY,
  username   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_conversation OWNER TO avpportal;
ALTER TABLE chat_member       OWNER TO avpportal;
ALTER TABLE chat_message      OWNER TO avpportal;
ALTER TABLE chat_presence     OWNER TO avpportal;
ALTER TABLE chat_ws_ticket    OWNER TO avpportal;
ALTER SEQUENCE chat_conversation_id_seq OWNER TO avpportal;
ALTER SEQUENCE chat_message_id_seq      OWNER TO avpportal;
