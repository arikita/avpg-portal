#!/usr/bin/env bash
# Chay TRUOC khi commit. Mot lenh, mot ma thoat.
#   bash tools/check.sh
set -Eeuo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n=== %s\n' "$*"; }

step "1/4  tsc --noEmit"
npx tsc --noEmit -p tsconfig.app.json

step "2/4  ng build (production)"
npx ng build --configuration production

step "3/4  ng test"
if grep -q '"test"' angular.json; then
  npx ng test --watch=false --browsers=ChromeHeadless
else
  echo "  (chua cau hinh karma — bo qua)"
fi

step "4/4  pytest"
if [ -d server/tests ]; then
  python3 -m pytest -q server/tests
else
  echo "  (chua co server/tests — bo qua)"
fi

printf '\nTAT CA DAT.\n'
