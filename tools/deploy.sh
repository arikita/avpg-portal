#!/usr/bin/env bash
# Deploy frontend AVP Portal — co kiem tra va TU KHOI PHUC khi hong.
#
# Vi sao co file nay: ngay 13/08/2026 quy trinh copy tay da lam TRANG SITE THAT.
# Hai nguyen nhan, ca hai deu duoc chan o day:
#   1. `ng build | tail` nuot mat ma thoat => build hong van tuong thanh cong.
#      O day KHONG pipe, va `set -o pipefail`.
#   2. Copy de len ma khong don => chunk cu con nam lai, trinh duyet giu
#      index.html cu se tai chunk cu va CHAY CODE CU MA KHONG BAO LOI.
#      O day chay clean_deploy.py --apply.
#
# Chay tren .136:  bash tools/deploy.sh
set -Eeuo pipefail

SRC=${SRC:-/home/internalsvr/avp-portal}
DIST="$SRC/dist/avp-portal/browser"
LIVE=${LIVE:-/var/www/avp-portal}
BACKUPS=${BACKUPS:-/var/backups/avp-portal}
MAPS=${MAPS:-/opt/avp-portal-maps}
KEEP_BUILDS=${KEEP_BUILDS:-5}
STAMP=$(date +%Y%m%d-%H%M%S)

say() { printf '\n=== %s\n' "$*"; }
die() { printf '\nDUNG LAI: %s\n' "$*" >&2; exit 1; }

# Script can quyen root cho /var/www, /var/backups va /opt, NHUNG build thi
# KHONG duoc chay bang root: no se de lai dist/ va .angular/cache thuoc root
# trong thu muc cua nguoi dung, lan build sau bang tai khoan thuong se hong.
OWNER=$(stat -c %U "$SRC")
run_as_owner() {
  if [ "$(id -u)" = "0" ] && [ "$OWNER" != "root" ]; then
    runuser -u "$OWNER" -- env "HOME=$(getent passwd "$OWNER" | cut -d: -f6)" "$@"
  else
    "$@"
  fi
}

say "1/8  build (khong pipe — phai giu duoc ma thoat)"
cd "$SRC"
run_as_owner rm -rf dist
run_as_owner npx ng build --configuration production
[ -f "$DIST/index.html" ] || die "build xong ma khong co index.html"

say "1b/8  app co bootstrap duoc khong (chan TRUOC khi cham /var/www)"
# Su co 22/08/2026: vong lap DI (NG0200) => trang trang. Build thanh cong,
# test xanh, smoke test xanh — chi mot lan nap that trong trinh duyet moi thay.
# Bo qua duoc bang SKIP_BOOT_CHECK=1 khi may khong co Chrome, NHUNG khi do
# phai tu kiem bang tay: deploy mu la dung cach da gay su co.
if [ "${SKIP_BOOT_CHECK:-0}" = "1" ]; then
  echo "  BO QUA theo yeu cau — nho tu kiem bang tay"
elif [ -z "${CHROME_BIN:-}" ] && ! command -v chromium >/dev/null 2>&1 \
     && ! command -v google-chrome >/dev/null 2>&1; then
  die "khong tim thay Chrome de kiem bootstrap. Dat CHROME_BIN, hoac chay lai
     voi SKIP_BOOT_CHECK=1 neu chap nhan deploy ma khong kiem"
else
  run_as_owner node "$SRC/tools/boot_check.mjs" "$DIST" \
    || die "app KHONG bootstrap duoc — /var/www chua bi dung toi"
fi

say "2/8  sinh build.json — NGUON DUY NHAT cua build_id"
# build_id dung o 4 cho (bang app_error, /api/health, thu muc sourcemap, nut Bao
# loi). Moi cho tu sinh mot kieu la khong doi chieu duoc — nen chi mot nguon.
BUILD_ID=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo nogit)-$STAMP
printf '{"build":"%s","at":"%s"}\n' "$BUILD_ID" "$(date -Is)" > "$DIST/build.json"
chown "$OWNER" "$DIST/build.json" 2>/dev/null || true
echo "  build_id = $BUILD_ID"

say "3/8  tach sourcemap ra khoi thu muc web"
# `hidden: true` khien bundle khong tro toi .map, nhung file .map van khong duoc
# nam trong /var/www — de o do la bat ky ai cung tai ve doc duoc ma nguon.
mkdir -p "$MAPS/$BUILD_ID"
if compgen -G "$DIST/*.map" > /dev/null; then
  mv "$DIST"/*.map "$MAPS/$BUILD_ID/"
  echo "  chuyen $(ls -1 "$MAPS/$BUILD_ID" | wc -l) file .map -> $MAPS/$BUILD_ID"
fi
# Giu KEEP_BUILDS ban gan nhat — dia .136 chi con ~7.8 GB.
ls -1dt "$MAPS"/*/ 2>/dev/null | tail -n +$((KEEP_BUILDS + 1)) | while read -r d; do
  rm -rf "$d"; echo "  don sourcemap cu: $d"
done

say "4/8  sao luu ban dang chay"
mkdir -p "$BACKUPS"
BK="$BACKUPS/$STAMP"
cp -a "$LIVE" "$BK"
echo "  $BK"
ls -1dt "$BACKUPS"/*/ 2>/dev/null | tail -n +$((KEEP_BUILDS + 1)) | while read -r d; do
  rm -rf "$d"; echo "  don ban luu cu: $d"
done

rollback() {
  printf '\n!!! HONG — khoi phuc ban truoc do\n' >&2
  rm -rf "${LIVE:?}"/*
  cp -a "$BK"/. "$LIVE"/
  printf '    da khoi phuc tu %s\n' "$BK" >&2
}

say "5/8  chep ban moi"
cp -a "$DIST"/. "$LIVE"/

say "6/8  don chunk rac (bat buoc — xem dau file)"
python3 "$SRC/tools/clean_deploy.py" --apply || { rollback; die "clean_deploy that bai"; }

say "6b/8  dong bo tools sang /opt (www-data phai doc duoc — home cua nguoi
     dung khong cho www-data vao, systemd timer se bao Errno 13)"
install -d -o root -g root -m 755 /opt/avp-portal-api/tools
install -m 755 "$SRC/tools/smoke_test.py" "$SRC/tools/prune_telemetry.py" \
        "$SRC/tools/decode_stack.py" /opt/avp-portal-api/tools/

say "6c/8  chep nguon ban cam ket sang canh module API"
# camket.py doc PDF goc + toa do o ky tu canh chinh no. Trong kho git chung
# nam o docs/, nhung /opt/avp-portal-api/app khong co thu muc do. Quen buoc
# nay thi nguoi dau tien bam Ky gap 500, va khong mot test nao bat duoc.
if [ -f "$SRC/docs/cam-ket-bao-mat.pdf" ] && [ -d /opt/avp-portal-api/app ]; then
  install -m 644 "$SRC/docs/cam-ket-bao-mat.pdf" "$SRC/docs/cam-ket-fields.json" \
          /opt/avp-portal-api/app/
fi

say "7/8  smoke test"
if ! python3 "$SRC/tools/smoke_test.py"; then
  rollback
  die "smoke test that bai — da khoi phuc, site van song"
fi

say "8/8  XONG"
echo "  build_id : $BUILD_ID"
echo "  sao luu  : $BK"
echo "  sourcemap: $MAPS/$BUILD_ID"
echo
echo "LUU Y: doi ma API thi dung 'systemctl reload avp-portal-api' (KHONG restart)."
