#!/usr/bin/env python3
"""Dung template "Ban cam ket bao mat" tren Documenso tu docs/cam-ket-bao-mat.pdf.

CHI dat 2 o cho Documenso: CHU KY va NGAY KY.

VI SAO KHONG de Documenso dien ho ten/chuc danh/phong ban:
font ma Documenso dung de dap chu vao PDF chi co Latin-1. "Nguyen Van Thu"
co dau ra "Nguy?n V?n Th?", "thu nghiem" ra "th? nghi?m" — do o mo la
`a e o` (Latin-1) chay duoc con `a u e e` (Latin Extended) thi khong.
Do ngay tren ban da ky that ngay 04/09/2026. Mot ban cam ket ghi sai ten
nguoi ky la mot ban cam ket vo gia tri, nen 6 o danh tinh do PORTAL tu dap
vao PDF bang font co tieng Viet TRUOC khi day len (xem server/app/camket.py).
Documenso chi con dap anh chu ky va ngay dd/MM/yyyy — toan ky tu ASCII.

    DOCUMENSO_API_KEY=api_... python3 tools/documenso_camket.py [--lam-lai]

Chay lai duoc nhieu lan: tim template theo externalId CAMKET_EXTERNAL_ID, co roi
thi bao va dung. --lam-lai xoa template cu rui dung lai (dung khi sua noi dung).

Toa do o ky KHONG go tay o day — doc tu docs/cam-ket-fields.json do
tools/build_cam_ket_pdf.mjs sinh ra. Sua noi dung PDF thi chay lai script do
truoc, roi chay script nay voi --lam-lai.
"""
import json, os, sys, urllib.request, urllib.error, uuid
from pathlib import Path

BASE = os.environ.get("DOCUMENSO_BASE", "https://sign.anvietphatgroup.com")
KEY = os.environ.get("DOCUMENSO_API_KEY", "")
ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs/cam-ket-bao-mat.pdf"
FIELDS = ROOT / "docs/cam-ket-fields.json"

# Dai externalId rieng cho luong cam ket. Tren he thong da co tai lieu dai 'pr-*'
# cua ben mua hang — dung tien to khac de hai ben khong bao gio dam nhau.
CAMKET_EXTERNAL_ID = "camket-template"
TITLE = "Bản cam kết bảo mật thông tin"


def api(method: str, path: str, body=None, raw=None, ctype=None):
    url = f"{BASE}/api/v2{path}"
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", KEY)
    req.add_header("Content-Type", ctype or "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        sys.exit(f"LOI {method} {path} -> {e.code}\n{e.read().decode()[:900]}")


def multipart(path: str, payload: dict, filepath: Path):
    """Documenso /template/create nhan multipart: truong 'payload' (JSON) + 'file'."""
    b = uuid.uuid4().hex
    parts = []
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="payload"\r\n'
                 f'Content-Type: application/json\r\n\r\n{json.dumps(payload)}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; '
                 f'filename="{filepath.name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode())
    parts.append(filepath.read_bytes())
    parts.append(f'\r\n--{b}--\r\n'.encode())
    return api("POST", path, raw=b"".join(parts), ctype=f"multipart/form-data; boundary={b}")


def main() -> int:
    if not KEY:
        return int(bool(sys.stderr.write("Thieu DOCUMENSO_API_KEY\n")))
    for f in (PDF, FIELDS):
        if not f.exists():
            return int(bool(sys.stderr.write(f"Thieu {f} — chay tools/build_cam_ket_pdf.mjs truoc\n")))

    lam_lai = "--lam-lai" in sys.argv
    co = [t for t in api("GET", "/template").get("data", [])
          if t.get("externalId") == CAMKET_EXTERNAL_ID]
    if co and not lam_lai:
        t = co[0]
        print(f"Da co template #{t['id']} \"{t['title']}\" — khong tao lai.")
        print("Muon dung lai tu PDF moi: them --lam-lai")
        return 0
    for t in co:
        api("POST", "/template/delete", {"templateId": t["id"]})
        print(f"Da xoa template cu #{t['id']}")

    spec = json.loads(FIELDS.read_text())
    made = multipart("/template/create", {
        "title": TITLE,
        "externalId": CAMKET_EXTERNAL_ID,
        "visibility": "EVERYONE",
        "meta": {
            "subject": "Bản cam kết bảo mật thông tin — Tập đoàn An Việt Phát",
            "message": ("Chào bạn,\n\nĐây là bản cam kết bảo mật thông tin bạn cần ký sau buổi "
                        "training của phòng Công nghệ thông tin. Bạn có thể ký ngay trên portal "
                        "nội bộ tại mục Hội nhập.\n\nPhòng Công nghệ thông tin"),
            "dateFormat": "dd/MM/yyyy",
            "timezone": "Asia/Ho_Chi_Minh",
            # Documenso KHONG co tieng Viet (enum chi co de/en/fr/es/it/nl/pl/pt-BR/ja/ko/zh).
            # Nhan cac o la tieng Viet vi do la chu tu do, nhung nut bam cua Documenso
            # ("Sign", "Complete") se la tieng Anh. Portal boc ben ngoai bang tieng Viet.
            "language": "en",
            # Nguoi ky go ten hoac ve deu duoc; bo tai anh chu ky vi khong ai
            # co san file chu ky, ma bat tai la mot buoc du de nguoi ta bo cuoc.
            "typedSignatureEnabled": True,
            "drawSignatureEnabled": True,
            "uploadSignatureEnabled": False,
        },
    }, PDF)
    tid = made["id"]
    print(f"Da tao template #{tid} ({made['envelopeId']})")

    rec = api("POST", "/template/recipient/create", {
        "templateId": tid,
        "recipient": {"email": "nhanvien@anvietenergy.com", "name": "Người cam kết",
                      "role": "SIGNER", "signingOrder": 1},
    })
    rid = rec.get("id") or rec.get("recipient", {}).get("id")
    print(f"Da tao nguoi ky mau #{rid}")

    # Chi giu o Documenso that su dap duoc dung. Cac o con lai van nam trong
    # docs/cam-ket-fields.json vi portal can toa do de tu dap.
    DOCUMENSO_DAP = {"chu_ky", "ngay_ky"}
    fields = []
    for f in spec["fields"]:
        if f["key"] not in DOCUMENSO_DAP:
            continue
        meta = {"type": f["type"].lower(), "label": f["label"], "required": True}
        if f["type"] == "SIGNATURE":
            meta = {"type": "signature", "required": True}
        elif f.get("prefill"):
            # readOnly: gia tri do portal bom tu AD, nguoi ky khong sua duoc —
            # neu sua duoc thi ban cam ket ky ten ai cung duoc, mat y nghia.
            #
            # BAY: Documenso tu choi field vua readOnly vua required
            # ("A field cannot be both read-only and required") — nhung no tu choi
            # o TRINH DUYET luc mo trang ky, tra 500 va khung ky trang. API tao
            # template van 200, khong mot dong loi nao. Phai required=False.
            # Khong mat gi: o readOnly da co san gia tri, doi hoi "bat buoc dien"
            # la vo nghia.
            meta["required"] = False
            meta["readOnly"] = True
            meta["fontSize"] = 11
        else:
            meta["fontSize"] = 11
        fields.append({"type": f["type"], "fieldMeta": meta, "recipientId": rid,
                       "pageNumber": f["pageNumber"], "pageX": f["pageX"], "pageY": f["pageY"],
                       "width": f["width"], "height": f["height"]})
    api("POST", "/template/field/create-many", {"templateId": tid, "fields": fields})
    print(f"Da dat {len(fields)} o ky")
    print(f"\nXem tai: {BASE}/templates/{tid}")
    print(f"Dat DOCUMENSO_TEMPLATE_ID={tid} trong /etc/avp-portal-api.env")
    return 0


if __name__ == "__main__":
    sys.exit(main())
