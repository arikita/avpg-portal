#!/usr/bin/env python3
"""Tao san THUMBNAIL cho mot album anh tren file server (anh goc KHONG copy).

Kien truc: portal mount share read-only o /mnt/avp-share bang Kerberos va
resize anh lon khi co nguoi bam xem. Chi rieng thumbnail la nen tao truoc,
vi mo album la tai cung luc hang tram cai — de API tao tai cho thi lan dau
xem album rat cham. Anh moi HR bo vao share van hien duoc ngay (API tu tao
thumb cho rieng anh do), script nay chi de "ham nong" cho muot.

CHAY O DAU: tren hcm-clasvr (10.10.100.128) — may do co san smbclient +
Pillow. Server portal (.136) khong cai 2 goi nay.

Them album moi, 3 buoc:

  # 1) tao thumbnail (tren hcm-clasvr)
  SMB_PASS='...' python3 pull_gallery.py \\
    --src '00. AVP - HOAT DONG THUONG NIEN/2026/1.YEAR END PARTY' \\
    --slug year-end-party-2026 \\
    --title-vi 'Year End Party 2026' --date 2026 --out /tmp/gallery-out

  # 2) day sang portal
  rsync -a /tmp/gallery-out/year-end-party-2026 \\
        internalsvr@10.10.100.136:gallery-stage/

  # 3) tren .136 dat vao dung cho
  sudo mv ~/gallery-stage/year-end-party-2026 /var/www/avp-portal-media/gallery/
  sudo chown -R www-data:www-data /var/www/avp-portal-media/gallery

Xong. API /api/gallery tu thay album moi — KHONG restart, KHONG build lai.
(Truong --src ghi trong album.json chinh la duong dan API dung de tim anh
goc trong /mnt/avp-share, nen phai dung y nhu duong dan tren share.)

Mat khau doc tu bien moi truong SMB_PASS (tai khoan chi can quyen doc, vi du
dcsvr@anvietphatgroup.com) — dung viet mat khau vao file.
"""
from __future__ import annotations
import argparse, io, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import smbclient
from PIL import Image, ImageOps

FULL_MAX, FULL_Q = 1600, 80      # ban xem trong lightbox
THUMB_MAX, THUMB_Q = 480, 75     # o luoi
EXT = (".jpg", ".jpeg", ".png", ".webp")

ap = argparse.ArgumentParser(description=__doc__,
                             formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--host", default="10.10.100.104")
ap.add_argument("--share", default="An Viet Phat")
ap.add_argument("--src", required=True, help="duong dan thu muc anh trong share")
ap.add_argument("--slug", required=True, help="ten thu muc album (a-z0-9-)")
ap.add_argument("--title-vi", required=True)
ap.add_argument("--title-en", default="")
ap.add_argument("--desc-vi", default="")
ap.add_argument("--desc-en", default="")
ap.add_argument("--date", default="")
ap.add_argument("--user", default="dcsvr@anvietphatgroup.com")
ap.add_argument("--out", default="/tmp/gallery-out")
ap.add_argument("--workers", type=int, default=3)
ap.add_argument("--with-full", action="store_true",
                help="tao them ban 1600px (thuong KHONG can: API tu resize khi xem)")
args = ap.parse_args()

SRC = rf"\\{args.host}\{args.share}" + "\\" + args.src.replace("/", "\\").strip("\\")
OUT = os.path.join(args.out, args.slug)

smbclient.register_session(args.host, username=args.user, password=os.environ["SMB_PASS"])
if args.with_full:
    os.makedirs(f"{OUT}/full", exist_ok=True)
os.makedirs(f"{OUT}/thumb", exist_ok=True)

names = sorted(e.name for e in smbclient.scandir(SRC)
               if not e.is_dir() and e.name.lower().endswith(EXT))
print(f"{len(names)} anh nguon", flush=True)

done: list[tuple[str, int, int]] = []
failed: list[str] = []


def one(name: str) -> tuple[str, int, int]:
    stem = os.path.splitext(name)[0].lower().replace(" ", "-")
    out_full, out_thumb = f"{OUT}/full/{stem}.jpg", f"{OUT}/thumb/{stem}.jpg"
    if os.path.exists(out_thumb) and (not args.with_full or os.path.exists(out_full)):
        with Image.open(out_thumb) as im:
            return stem, im.width, im.height          # da lam roi, chay lai thi bo qua
    # Doc theo tung khoi 256KB: doc ca file 10MB mot phat lam can credit SMB
    # ("Request requires 1 credits but only 0 credits are available").
    buf = io.BytesIO()
    with smbclient.open_file(SRC + "\\" + name, "rb") as f:
        while True:
            chunk = f.read(262144)
            if not chunk:
                break
            buf.write(chunk)
    with Image.open(io.BytesIO(buf.getvalue())) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if args.with_full:                            # hiem khi can: API tu resize
            big = im.copy()
            big.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
            big.save(out_full, "JPEG", quality=FULL_Q, optimize=True, progressive=True)
        small = im.copy()
        small.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        small.save(out_thumb, "JPEG", quality=THUMB_Q, optimize=True)
        return stem, small.width, small.height


def guarded(name: str):
    for attempt in range(3):
        try:
            return one(name)
        except Exception as exc:                        # anh loi thi bo qua, bao ro
            if attempt == 2:
                failed.append(f"{name}: {type(exc).__name__} {exc}")
                return None
            time.sleep(1 + attempt * 2)
    return None


with ThreadPoolExecutor(max_workers=args.workers) as pool:
    for i, res in enumerate(pool.map(guarded, names), 1):
        if res:
            done.append(res)
        if i % 100 == 0:
            print(f"  {i}/{len(names)} ({len(failed)} loi)", flush=True)

done.sort()
photos = [{"file": s, "w": w, "h": h} for s, w, h in done]
album = {
    "slug": args.slug,
    # API dung "src" de tim anh goc trong /mnt/avp-share khi resize theo yeu cau
    "src": args.src.replace("\\", "/").strip("/"),
    "title": {"vi": args.title_vi, "en": args.title_en or args.title_vi},
    "desc": {"vi": args.desc_vi, "en": args.desc_en or args.desc_vi},
    "date": args.date,
    "cover": photos[0]["file"] if photos else "",
    "count": len(photos),
}
with open(f"{OUT}/album.json", "w", encoding="utf-8") as f:
    json.dump(album, f, ensure_ascii=False, indent=1)

size = sum(os.path.getsize(os.path.join(r, x))
           for r, _, fs in os.walk(OUT) for x in fs)
print(f"XONG {len(photos)} anh, {size/1048576:.0f} MB, loi {len(failed)}", flush=True)
for line in failed[:20]:
    print("  LOI", line, flush=True)
sys.exit(1 if failed else 0)
