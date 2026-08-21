#!/usr/bin/env python3
"""Dua cac bai tin da toi gio hen len song (systemd timer chay moi phut).

Dung chung ham publish_due() cua app/news.py nen thong bao + Web Push cho tac
gia giong het duong API. Chay bang python cua venv API:
    /opt/avp-portal-api/venv/bin/python /opt/avp-portal-api/publish_scheduled.py
"""
from __future__ import annotations

import sys
import threading

sys.path.insert(0, "/opt/avp-portal-api")

from app.news import _conn, publish_due   # noqa: E402


def main() -> int:
    with _conn() as conn:
        ids = publish_due(conn)
    if ids:
        # Web Push chay o thread daemon -> doi no gui xong roi hay thoat.
        for t in threading.enumerate():
            if t is not threading.current_thread():
                t.join(20)
        print("da dang bai hen gio:", ", ".join(str(i) for i in ids))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
