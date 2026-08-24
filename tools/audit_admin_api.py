"""Soat 6 endpoint quan tri: hang rao quyen, hinh dang du lieu, thoi gian, tham so.

    python3 tools/audit_admin_api.py        # chay TREN .136 (goi 127.0.0.1:8000)

Goi thang cong 8000 kem header X-Remote-User nen khong can ve Kerberos. Kiem
dung ba thu de sai nhat:
  - hang rao: admin=200, nguoi la=403. Ra 200 cho nguoi la la ro ri du lieu
    giam sat nhan vien (app_page_view ghi kem username + phong ban).
  - hinh dang: thieu mot khoa la giao dien hien o trong ma khong bao loi gi.
  - tham so: days=/status=/q= co that su doi ket qua khong.
"""
import json, time, urllib.request, urllib.error

BASE = "http://127.0.0.1:8000"
def call(path, user="arikita"):
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(
            BASE + path, headers={"X-Remote-User": user}), timeout=45)
        return r.status, json.loads(r.read() or b"{}"), int((time.time() - t) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, {}, int((time.time() - t) * 1000)

def need(d, keys, ten):
    thieu = [k for k in keys if k not in d]
    print(f"    {'OK ' if not thieu else 'THIEU'} {ten}" + (f" -> {thieu}" if thieu else ""))
    return not thieu

print("=== 1. HANG RAO QUYEN ===")
for p in ("/api/admin/overview", "/api/admin/analytics", "/api/admin/ga4",
          "/api/admin/news", "/api/admin/users", "/api/admin/system"):
    a, _, _ = call(p, "arikita")
    b, _, _ = call(p, "nhanvien-bat-ky")
    c, _, _ = call(p, "haivl")
    print(f"  {p:26} admin={a} haivl={c} nguoi-la={b}"
          + ("  <-- HONG" if not (a == 200 and c == 200 and b == 403) else ""))

print("\n=== 2. HINH DANG DU LIEU + THOI GIAN ===")
st, ov, ms = call("/api/admin/overview")
print(f"  overview  {st} {ms}ms")
need(ov, ["buildId","telemetry","dbOk","today","yesterday","series","errors",
          "errors24h","req5m","counts","todo","recentContent"], "du khoa")
print(f"    series {len(ov.get('series',[]))} diem (mong doi 14)"
      + ("" if len(ov.get('series',[])) == 14 else "  <-- SAI"))

st, an, ms = call("/api/admin/analytics?days=30")
print(f"  analytics {st} {ms}ms")
need(an, ["days","series","routes","departments","people","hours","active","totals"], "du khoa")
print(f"    series {len(an.get('series',[]))} diem (mong doi 30)"
      + ("" if len(an.get('series',[])) == 30 else "  <-- SAI"))

st, ga, ms = call("/api/admin/ga4?days=28")
print(f"  ga4       {st} {ms}ms  configured={ga.get('configured')} ok={ga.get('ok')}")
if ga.get("ok"):
    need(ga, ["totals","series","pages","devices","realtimeUsers"], "du khoa")

st, nw, ms = call("/api/admin/news")
print(f"  news      {st} {ms}ms  {len(nw.get('items',[]))} bai, counts={nw.get('counts')}")
if nw.get("items"):
    need(nw["items"][0], ["id","title","category","status","pinned","author","authorName",
                          "createdAt","publishedAt","scheduledAt","hasCover","views",
                          "comments","reactions","polls"], "du khoa moi bai")

st, us, ms = call("/api/admin/users")
print(f"  users     {st} {ms}ms  {len(us.get('admins',[]))} admin, "
      f"{len(us.get('online',[]))} online, {len(us.get('active',[]))} hoat dong")
need(us, ["admins","online","active","contributors","days","pushUsers","profilesWithAvatar"], "du khoa")

st, sy, ms = call("/api/admin/system")
print(f"  system    {st} {ms}ms")
need(sy, ["buildId","telemetry","dbOk","dbSize","ga4","units","disk","media",
          "tables","lastStat","lastPageView","retention","metrics"], "du khoa")
xau = [u["unit"] for u in sy.get("units", []) if u["state"] not in ("active", "waiting")]
print(f"    {len(sy.get('units',[]))} unit, khong active/waiting: {xau or 'khong co'}")
print(f"    {len(sy.get('tables',[]))} bang, dia con {sy.get('disk',{}).get('freeGb')} GB")

print("\n=== 3. THAM SO ===")
for d in (7, 30, 90):
    _, a, _ = call(f"/api/admin/analytics?days={d}")
    print(f"  analytics days={d:<3} -> {len(a.get('series',[]))} diem, "
          f"{a['totals']['views']} luot xem")
for s in ("", "published", "draft", "scheduled", "hidden"):
    _, n, _ = call(f"/api/admin/news?status={s}")
    print(f"  news status={s or '(tat ca)':<12} -> {len(n.get('items',[]))} bai")
_, n, _ = call("/api/admin/news?q=sinh%20nhat")
print(f"  news q='sinh nhat'      -> {len(n.get('items',[]))} bai")
