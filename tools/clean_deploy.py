#!/usr/bin/env python3
"""Don file rac trong thu muc deploy Angular.

Deploy tu truoc gio la `cp -r dist/* /var/www/avp-portal/` — chi de len,
KHONG BAO GIO xoa. Moi lan build sinh ten file moi (co ma bam noi dung) nen
thu muc tich luy moi the he chunk. Hau qua that: trinh duyet nao con giu
index.html cu se tai dung chunk cu (van nam tren dia) => chay code cu ma
khong he bao loi, sua gi cung tuong nhu khong an.

Chi xoa file co TEN DANG MA BAM cua Angular va KHONG con trong ban build
hien tai — khong dong toi anh, font hay bat cu thu gi khac.
"""
import os, re, sys

LIVE = "/var/www/avp-portal"
DIST = "/home/internalsvr/avp-portal/dist/avp-portal/browser"
HASHED = re.compile(r"^(chunk|main|polyfills|styles|scripts)-[A-Z0-9]{8}\.(js|css)(\.map)?$")

if not os.path.isfile(os.path.join(DIST, "index.html")):
    print("  DUNG LAI: ban build khong co index.html"); sys.exit(1)

keep = set(os.listdir(DIST))
junk = [f for f in os.listdir(LIVE)
        if HASHED.fullmatch(f) and f not in keep and os.path.isfile(os.path.join(LIVE, f))]

size = sum(os.path.getsize(os.path.join(LIVE, f)) for f in junk)
print(f"  file dang co   : {len(os.listdir(LIVE))}")
print(f"  file rac se xoa: {len(junk)}  ({size/1024/1024:.1f} MB)")
if "--apply" not in sys.argv:
    print("  (chay thu, chua xoa gi)"); sys.exit(0)

for f in junk:
    os.remove(os.path.join(LIVE, f))
print(f"  da xoa {len(junk)} file")
print(f"  con lai        : {len(os.listdir(LIVE))}")
