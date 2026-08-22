#!/usr/bin/env python3
"""Don du lieu telemetry cu de bang khong phinh vo han (bay so 6 trong plan).

Chinh sach giu (quyet dinh D16 — nhat ky co kem ten dang nhap):
  app_error_event  30 ngay   mau tho, cai nang nhat vi co stack + breadcrumb
  app_error        90 ngay   chi nhung dong DA 'resolved'
  app_request_stat 30 ngay   so lieu theo phut, nhieu dong nhat
  app_page_view    90 ngay   theo gio, nhe
  app_metric       giu HET   can it nhat 4 tuan de so trung vi; ca nam cung nho
  app_error_user   theo app_error (ON DELETE CASCADE)

Chay hang ngay qua systemd timer avp-telemetry-prune.timer.
"""
import os
import sys

import psycopg

DSN = os.environ.get("DATABASE_URL", "")
if not DSN:
    print("thieu DATABASE_URL")
    sys.exit(1)

PLAN = [
    ("app_error_event", "created_at < now() - interval '30 days'"),
    ("app_error", "status = 'resolved' AND resolved_at < now() - interval '90 days'"),
    ("app_request_stat", "minute < now() - interval '30 days'"),
    ("app_page_view", "hour < now() - interval '90 days'"),
]

with psycopg.connect(DSN, connect_timeout=10) as conn:
    for table, cond in PLAN:
        n = conn.execute(f"DELETE FROM {table} WHERE {cond}").rowcount
        print(f"  {table:18} xoa {n}")
    conn.commit()
    for table in ("app_error", "app_error_event", "app_request_stat",
                  "app_page_view", "app_metric"):
        c = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        print(f"  {table:18} con {c}")
print("xong")
