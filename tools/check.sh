#!/usr/bin/env bash
# Chay TRUOC khi commit. Mot lenh, mot ma thoat.
#   bash tools/check.sh
set -Eeuo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n=== %s\n' "$*"; }

step "1/5  tsc --noEmit"
npx tsc --noEmit -p tsconfig.app.json

step "2/5  ng build (production)"
npx ng build --configuration production

step "3/5  bootstrap that trong trinh duyet"
# Buoc nay ton tai vi su co 22/08/2026: vong lap DI (NG0200) lam app khong
# khoi dong noi, nguoi dung thay trang trang — ma tsc, ng build, Karma va
# smoke_test DEU XANH. Khong cai nao nap app trong trinh duyet ca.
node tools/boot_check.mjs

step "4/5  ng test"
if grep -q '"test"' angular.json; then
  # KHONG truyen --browsers: co do ghi de launcher ChromeHeadlessNoSandbox
  # trong karma.conf.js, va Chrome khong sandbox duoc tren VM nay.
  npx ng test --watch=false
else
  echo "  (chua cau hinh karma — bo qua)"
fi

step "5/5  pytest"
if [ -d server/tests ]; then
  python3 -m pytest -q server/tests
else
  echo "  (chua co server/tests — bo qua)"
fi

printf '\nTAT CA DAT.\n'
