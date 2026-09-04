#!/usr/bin/env bash
# Chuan bi may chu cho tinh nang ky cam ket bao mat — CHAY TREN .136.
#
#   DOCUMENSO_API_KEY=api_... sudo -E bash tools/setup_cam_ket.sh
#
# Chay lai duoc nhieu lan, khong hong gi neu da lam roi. Lam sau viec, theo
# dung thu tu de moi buoc that bai deu dung lai truoc khi gay hau qua:
#
#   1. goi Python (reportlab, pypdf) — thieu la khong dap duoc chu vao PDF
#   2. font co tieng Viet          — thieu la ten nguoi ky ra dau hoi
#   3. bang cam_ket + DOI CHU SO HUU sang avpportal
#   4. DOCUMENSO_API_KEY vao env file
#   5. copy MA NGUON API (server/app/*.py) + PDF goc + toa do o ky
#   6. restart (KHONG reload) roi goi thu API
#
# VI SAO BUOC 3 CO HAI LENH: chay schema bang `sudo -u postgres psql` thi bang
# thuoc so huu cua role `postgres`, con API ket noi bang role `avpportal` =>
# moi INSERT bi tu choi. Ngay 28/08/2026 dung loi nay da lam bang quiz_attempt
# khong luu duoc dong nao ma khong ai biet, vi quiz.py nuot loi ghi.
#
# VI SAO BUOC 6 LA RESTART CHU KHONG RELOAD: reload chi thay worker gunicorn,
# master giu nguyen moi truong cu => bien DOCUMENSO_API_KEY moi them se KHONG
# duoc doc, va endpoint tra 503 "chua cau hinh" trong khi env file da dung.
# Danh doi: restart lam rot moi ket noi WebSocket dang mo (chat), client tu noi
# lai sau ~1 giay.
set -Eeuo pipefail

# Venv nam o /opt/avp-portal-api/venv, KHONG phai /opt/avp-portal-api —
# thu muc do la WorkingDirectory, ben trong con co app/ tools/ backups/.
# Doan sai cho nay lam script chet ngay buoc 1 (04/09/2026). Nay tu do tu
# chinh unit systemd de khong bao gio phai doan lai.
VENV=${VENV:-}
if [ -z "$VENV" ]; then
  EXEC=$(grep -m1 '^ExecStart=' /etc/systemd/system/avp-portal-api.service 2>/dev/null \
         | sed 's/^ExecStart=//' | awk '{print $1}')
  # ExecStart=/opt/avp-portal-api/venv/bin/gunicorn -> /opt/avp-portal-api/venv
  [ -n "$EXEC" ] && VENV=$(dirname "$(dirname "$EXEC")")
fi
[ -n "$VENV" ] || VENV=/opt/avp-portal-api/venv
ENV_FILE=${ENV_FILE:-/etc/avp-portal-api.env}
APP_DIR=${APP_DIR:-/opt/avp-portal-api/app}
SRC=${SRC:-/home/internalsvr/avp-portal}
DB=${DB:-avpportal}

say() { printf '\n=== %s\n' "$*"; }
die() { printf '\nDUNG LAI: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "can chay bang sudo"

say "1/6  goi Python"
echo "    venv: $VENV"
[ -x "$VENV/bin/pip" ] || die "khong thay $VENV/bin/pip — dat bien VENV tro dung cho"
"$VENV/bin/pip" install --quiet --no-cache-dir reportlab pypdf
"$VENV/bin/python" - <<'EOF'
import reportlab, pypdf
print(f"    reportlab {reportlab.Version} · pypdf {pypdf.__version__}")
EOF

say "2/6  font co tieng Viet"
FONT=/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf
if [ ! -f "$FONT" ]; then
  apt-get install -y fonts-liberation >/dev/null
fi
[ -f "$FONT" ] || die "van khong co $FONT — dat CAM_KET_FONT tro toi font khac"
echo "    $FONT"

say "3/6  bang cam_ket (+ doi chu so huu — xem dau file)"
# ĐỌC FILE BẰNG STDIN, KHONG DUNG -f: `sudo -u postgres psql -f <file>` bat
# chinh user postgres mo file, ma file nay nam trong /home/internalsvr —
# home dir khong cho user khac vao, nen ra "Permission denied" (dinh that
# 04/09/2026). Chuyen huong stdin thi ROOT doc file roi dua noi dung sang.
sudo -u postgres psql -q -d "$DB" < "$SRC/server/schema_camket.sql"
sudo -u postgres psql -q -d "$DB" -c "ALTER TABLE cam_ket OWNER TO $DB"
CHU=$(sudo -u postgres psql -tAd "$DB" -c \
  "SELECT tableowner FROM pg_tables WHERE tablename='cam_ket'")
[ "$CHU" = "$DB" ] || die "cam_ket dang thuoc '$CHU', phai la '$DB'"
echo "    cam_ket thuoc $CHU"

say "4/6  DOCUMENSO_API_KEY"
if [ -n "${DOCUMENSO_API_KEY:-}" ]; then
  # Xoa dong cu neu co roi ghi lai — chay lai script khong nhan doi dong.
  sed -i '/^DOCUMENSO_API_KEY=/d' "$ENV_FILE"
  printf 'DOCUMENSO_API_KEY=%s\n' "$DOCUMENSO_API_KEY" >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "    da ghi vao $ENV_FILE"
elif grep -q '^DOCUMENSO_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  echo "    da co san trong $ENV_FILE, giu nguyen"
else
  die "chua co DOCUMENSO_API_KEY trong $ENV_FILE va cung khong truyen vao"
fi

say "5/6  ma nguon API + nguon ban cam ket sang $APP_DIR"
# BUOC NAY TUNG BI BO SOT (04/09/2026): tools/deploy.sh chi lo frontend va
# tools/, con ma Python thi README ghi la mot lenh `cp` chay tay. Bo qua no
# thi camket.py khong bao gio toi duoc /opt, va /api/cam-ket tra 404 trong khi
# moi thu khac nhin deu "da deploy xong" — dung kieu hong im lang ma ca file
# nay sinh ra de chan. Nay script tu lam, khong de ai phai nho.
cp "$SRC"/server/app/*.py "$APP_DIR"/
install -m 644 "$SRC/docs/cam-ket-bao-mat.pdf" "$SRC/docs/cam-ket-fields.json" "$APP_DIR/"
[ -f "$APP_DIR/camket.py" ] || die "camket.py van chua toi $APP_DIR"
echo "    $(ls "$APP_DIR"/*.py | wc -l) module Python + PDF + toa do o ky"

say "6/6  restart (KHONG reload — xem dau file) va goi thu"
systemctl restart avp-portal-api
sleep 3
systemctl is-active --quiet avp-portal-api || die "service khong len duoc"

# Goi bang mot user KHONG thuoc dien: phai ra apDung=false chu khong phai loi.
MA=$(curl -sS -o /tmp/camket-thu.json -w '%{http_code}' \
     -H 'X-Remote-User: smoke-test' http://127.0.0.1:8000/api/cam-ket || true)
echo "    GET /api/cam-ket -> HTTP $MA"
[ "$MA" = "200" ] || die "API khong tra 200, xem /tmp/camket-thu.json"
grep -q '"apDung"' /tmp/camket-thu.json || die "hinh dang tra ve khong dung — route co ton tai khong?"

# Sau moi lan deploy API phai goi THAT cac endpoint chinh: /api/health = 200
# khong chung minh duoc gi (lan hong 25/08 health van 200 trong khi /api/news
# tra 500 vi mot NameError).
for E in /api/news /api/notifications /api/rail /api/quiz; do
  M=$(curl -sS -o /dev/null -w '%{http_code}' -H 'X-Remote-User: smoke-test' \
      "http://127.0.0.1:8000$E" || true)
  echo "    GET $E -> HTTP $M"
  [ "$M" = "200" ] || die "$E tra $M — module API vua chep len co the hong"
done
echo "    $(head -c 200 /tmp/camket-thu.json)"

say "XONG"
echo "  Nhan vien ky tai : https://portal.anvietphatgroup.com/onboarding/cam-ket"
echo "  Theo doi tai     : https://portal.anvietphatgroup.com/admin/cam-ket"
echo
echo "  Nho chay tiep smoke test — no khoa /api/admin/cam-ket = 403:"
echo "    python3 $SRC/tools/smoke_test.py"
