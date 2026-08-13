"""BO LOC HTML — TANG 2 (server).

Bai viet luu HTML nen truoc khi ghi vao DB phai loc lai o day, KHONG tin bo
loc chay tren trinh duyet (nguoi ta co the goi thang API bang curl).

Dung nh3 (ammonia — thu vien Rust chuyen viec nay) lo phan kho: doc HTML hong,
can bang the, xu ly ky tu dac biet. Phan rieng cua minh — thuoc tinh CSS nao
duoc phep, lop CSS nao duoc phep, iframe duoc tro di dau — lam bang
attribute_filter.

Danh sach cho phep o day phai KHOP voi ban tren trinh duyet
(src/app/shared/util/html-safe.ts).
"""
from __future__ import annotations
import re

import nh3

TAGS = {
    "p", "br", "hr", "h2", "h3", "h4",
    "b", "strong", "i", "em", "u", "s", "del", "mark", "sub", "sup",
    "code", "pre", "blockquote",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "span", "div", "iframe",
}

ATTRS = {
    # nh3 tu them rel="noopener noreferrer" (link_rel) nen KHONG duoc liet ke "rel" o day.
    "a": {"href", "title", "class", "style", "target"},
    "img": {"src", "alt", "title", "width", "height", "class", "style", "loading"},
    "iframe": {"src", "width", "height", "class", "allowfullscreen", "loading",
               "referrerpolicy", "allow"},
    "td": {"colspan", "rowspan", "class", "style"},
    "th": {"colspan", "rowspan", "class", "style"},
    "*": {"class", "style"},
}

CLASSES = {"video", "fig", "fig-left", "fig-center", "fig-right", "att", "tbl"}

# Chi thuoc tinh TRANG TRI vo hai. KHONG position/top/left/z-index/float/opacity.
STYLES = {
    "color", "background-color", "background", "text-align", "font-size", "line-height",
    "font-weight", "font-style", "font-family", "text-decoration", "text-transform",
    "letter-spacing", "text-shadow",
    "width", "max-width", "min-width", "height", "max-height",
    "margin", "margin-left", "margin-right", "margin-top", "margin-bottom",
    "padding", "padding-left", "padding-right", "padding-top", "padding-bottom",
    "border", "border-color", "border-width", "border-style", "border-radius",
    "border-top", "border-bottom", "border-left", "border-right", "box-shadow",
    "vertical-align", "display", "white-space",
}
STYLE_VALUE = re.compile(r"""^[a-z0-9 .,%#()/_'"+-]{1,240}$""", re.I)
STYLE_BAD = re.compile(r"url\(|expression|javascript:|@import|<|\\|position|fixed|sticky|absolute", re.I)

# Chi duoc nhung video tu dung hai noi nay.
EMBED = re.compile(
    r"^https://(www\.youtube(-nocookie)?\.com/embed/[\w-]{6,20}"
    r"|player\.vimeo\.com/video/\d{5,15})(\?[\w=&%.-]*)?$", re.I)

MAX_BODY = 400_000  # ~400KB HTML cho mot bai la qua du


def _clean_style(value: str) -> str:
    out = []
    for part in (value or "").split(";"):
        if ":" not in part:
            continue
        prop, _, val = part.partition(":")
        prop, val = prop.strip().lower(), val.strip()
        if prop not in STYLES or not val:
            continue
        if STYLE_BAD.search(val) or not STYLE_VALUE.match(val):
            continue
        out.append(f"{prop}: {val}")
    return "; ".join(out)


def _attr_filter(tag: str, attr: str, value: str) -> str | None:
    if attr == "style":
        return _clean_style(value) or None
    if attr == "class":
        keep = [c for c in (value or "").split() if c in CLASSES]
        return " ".join(keep) or None
    if tag == "iframe" and attr == "src":
        # Dia chi la thi bo thuoc tinh -> khung rong, ban tren trinh duyet se
        # vut han the do khi ve ra man hinh.
        return value if EMBED.match(value or "") else None
    if attr in {"width", "height", "colspan", "rowspan"}:
        return value if re.fullmatch(r"\d{1,4}", value or "") else None
    return value


def clean_html(html: str) -> str:
    """Loc mot doan HTML nguoi dung gui len. Chuoi tra ve la an toan de luu."""
    if not html:
        return ""
    if len(html) > MAX_BODY:
        html = html[:MAX_BODY]
    return nh3.clean(
        html,
        tags=TAGS,
        attributes=ATTRS,
        attribute_filter=_attr_filter,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
        strip_comments=True,
    )
