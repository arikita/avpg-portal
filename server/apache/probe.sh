#!/bin/bash
# Chay TREN .136. Goi vao 10.10.100.136 (khong phai 127.0.0.1) de Apache thay
# REMOTE_ADDR = 10.10.100.136 — mot IP KHONG nam trong allowlist Basic, tuc
# dong vai mot may nhan vien binh thuong.
H='Host: portal.anvietphatgroup.com'
U='User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0 Safari/537.36'
B=/tmp/_probe_body

probe() {
  local label="$1"; shift
  local hdr
  hdr=$(curl -sk -D- -o "$B" -m 10 "$@" 2>/dev/null)
  local code wa what
  code=$(printf '%s' "$hdr" | head -1 | awk '{print $2}')
  wa=$(printf '%s' "$hdr" | grep -i '^WWW-Authenticate:' | sed 's/^WWW-Authenticate: *//I' | tr -d '\r' | cut -c1-30 | paste -sd'+' -)
  what='?'
  grep -q 'Cổng nội bộ An Việt Phát' "$B" 2>/dev/null && what='TRANG LOGIN MOI'
  grep -qi '<title>401 Unauthorized' "$B" 2>/dev/null && what='401 MAC DINH APACHE'
  grep -qx 'chua dang nhap' "$B" 2>/dev/null && what='"chua dang nhap" (gon)'
  [ -s "$B" ] || what='(rong)'
  printf '%-38s %-4s %-6s %-16s %s\n' "$label" "$code" "$(stat -c%s "$B" 2>/dev/null)B" "${wa:--}" "$what"
}

echo "REMOTE_ADDR ma Apache nhin thay:"
curl -sk -m 10 -H "$H" https://10.10.100.136/api/health | head -c 120; echo
echo
printf '%-38s %-4s %-6s %-16s %s\n' 'PHEP THU' 'MA' 'CO' 'WWW-Authenticate' 'THAN TRA VE'
echo '---------------------------------------------------------------------------------------------'
for p in / /admin /news/43 /khong-co-duong-nay /vendor/adminlte-4.8.5.css; do
  probe "chua xac thuc  $p" -H "$H" -H "$U" "https://10.10.100.136$p"
done
probe "chua xac thuc  /media/anh.jpg"     -H "$H" -H "$U" "https://10.10.100.136/media/anh.jpg"
probe "chua xac thuc  /api/me"            -H "$H" -H "$U" "https://10.10.100.136/api/me"
probe "chua xac thuc  /dang-nhap/"        -H "$H" -H "$U" "https://10.10.100.136/dang-nhap/"
echo
echo 'MO PHONG TRINH DUYET CON NHO MAT KHAU BASIC CU (IP thuong, ngoai allowlist):'
echo '---------------------------------------------------------------------------------------------'
for p in / /admin /api/me /media/anh.jpg; do
  probe "Basic cu     $p" -H "$H" -H "$U" -u 'nguoidung:matkhausai' "https://10.10.100.136$p"
done
rm -f "$B"
