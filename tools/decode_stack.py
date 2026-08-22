#!/usr/bin/env python3
"""Giai ma stack trace da minify bang sourcemap cua dung ban build.

Vi sao can: production build minify het, nen loi bat duoc chi hien
`t.n is not a function` o `chunk-ABC123.js:1:45678` — vo dung. File .map
KHONG nam trong /var/www (de o do la lo ma nguon), deploy.sh cat sang
/opt/avp-portal-maps/<build_id>/.

  python3 tools/decode_stack.py <build_id> "chunk-ABC123.js:1:45678"
  python3 tools/decode_stack.py <build_id> < stack.txt

Khong can thu vien ngoai: tu giai ma VLQ cua sourcemap.
"""
import json
import os
import re
import sys

MAPS = os.environ.get("MAPS", "/opt/avp-portal-maps")
B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def vlq_decode(seg: str) -> list[int]:
    out, shift, acc = [], 0, 0
    for ch in seg:
        d = B64.index(ch)
        acc |= (d & 31) << shift
        if d & 32:
            shift += 5
            continue
        val = acc >> 1
        out.append(-val if acc & 1 else val)
        shift, acc = 0, 0
    return out


def build_index(mapping: str):
    """Tra ve {dong_sinh_ra: [(cot_sinh_ra, idx_nguon, dong_nguon, cot_nguon)]}."""
    idx: dict[int, list[tuple[int, int, int, int]]] = {}
    src = sline = scol = 0
    for gline, line in enumerate(mapping.split(";")):
        gcol = 0
        for seg in line.split(","):
            if not seg:
                continue
            f = vlq_decode(seg)
            gcol += f[0]
            if len(f) >= 4:
                src += f[1]
                sline += f[2]
                scol += f[3]
                idx.setdefault(gline, []).append((gcol, src, sline, scol))
    return idx


def lookup(smap: dict, line: int, col: int) -> str:
    idx = build_index(smap.get("mappings", ""))
    row = idx.get(line - 1)
    if not row:
        return "(khong co mapping cho dong nay)"
    best = None
    for gcol, s, sl, sc in row:
        if gcol <= col - 1:
            best = (s, sl, sc)
        else:
            break
    if best is None:
        best = (row[0][1], row[0][2], row[0][3])
    s, sl, sc = best
    name = smap.get("sources", ["?"])[s] if s < len(smap.get("sources", [])) else "?"
    return f"{name}:{sl + 1}:{sc + 1}"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    build_id = sys.argv[1]
    stack = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else sys.stdin.read()

    d = os.path.join(MAPS, build_id)
    if not os.path.isdir(d):
        print(f"khong co sourcemap cua build '{build_id}' trong {MAPS}")
        print("cac ban dang giu:", ", ".join(sorted(os.listdir(MAPS))) if os.path.isdir(MAPS) else "(khong co)")
        return 1

    cache: dict[str, dict] = {}
    frames = 0
    decoded = 0
    for m in re.finditer(r"([\w.-]+\.js):(\d+):(\d+)", stack):
        frames += 1
        fname, line, col = m.group(1), int(m.group(2)), int(m.group(3))
        mp = os.path.join(d, fname + ".map")
        if not os.path.isfile(mp):
            print(f"  {m.group(0)}  ->  (khong co {fname}.map)")
            continue
        if fname not in cache:
            cache[fname] = json.load(open(mp, encoding="utf-8"))
        print(f"  {m.group(0)}  ->  {lookup(cache[fname], line, col)}")
        decoded += 1
    if not frames:
        print("khong tim thay khung nao dang <file>.js:<dong>:<cot> trong stack")
        return 1
    if not decoded:
        print(f"tim thay {frames} khung nhung khong co .map nao khop — "
              f"kiem lai build_id (dang tra trong {d})")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
