"""Ghép template.html + style.css + main.js + font/logo/ảnh base64 thành một file index.html tự chứa."""
import base64
import re
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BUILD = ROOT / "build"
IMG = ROOT / "img"
DL = Path(r"C:\Users\PC\Downloads")
OUT = ROOT / "index.html"
FB_URL = "https://www.facebook.com/groups/tinhoatuchu"

FONTS = (  # (file, weight, style)
    ("BeVietnamPro-Regular.woff2", 400, "normal"),
    ("BeVietnamPro-Italic.woff2", 400, "italic"),
    ("BeVietnamPro-Medium.woff2", 500, "normal"),
    ("BeVietnamPro-SemiBold.woff2", 600, "normal"),
    ("BeVietnamPro-Bold.woff2", 700, "normal"),
    ("BeVietnamPro-ExtraBold.woff2", 800, "normal"),
)


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{b64(path)}"


def clean_svg(name: str) -> str:
    s = (DL / name).read_text(encoding="utf-8")
    s = re.sub(r"<metadata>.*?</metadata>", "", s, flags=re.S)
    s = s.replace(' xmlns:c2pa="http://c2pa.org/manifest"', "")
    s = re.sub(r'\s(width|height)="[\d.]+"', "", s, count=2)
    return s


def header_logo() -> str:
    """Logo ngang đen inline; con dấu có thêm một nét viền để vẽ khung một lần khi tải trang."""
    s = clean_svg("tinhtuom-logo-ngang-den.svg")
    s = s.replace("<svg ", '<svg class="logo-h" focusable="false" aria-hidden="true" ', 1)
    m = re.search(r'(<g transform="scale\(0\.36\)">)(<path fill="#000000" fill-rule="evenodd" d="([^"]+)"/>)', s)
    assert m, "không tìm thấy con dấu trong logo ngang"
    d = m.group(3)
    new = (m.group(1)
           + f'<path class="seal-fill" fill="#000000" fill-rule="evenodd" d="{d}"/>'
           + f'<path class="seal-stroke" pathLength="1" d="{d}"/>')
    return s.replace(m.group(0), new, 1)


def logo_symbol() -> str:
    """Logo dọc đen dùng một lần làm <symbol>, footer + popup tham chiếu bằng <use>."""
    s = clean_svg("tinhtuom-logo-doc-den.svg")
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    inner = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", s.strip())
    return (f'<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">'
            f'<symbol id="logo-doc" viewBox="{vb}">{inner}</symbol></svg>')


def font_faces() -> str:
    ofl = (DL / "OFL.txt").read_text(encoding="utf-8").replace("*/", "* /")
    out = ["/* Be Vietnam Pro — tự host, nhúng base64.\n" + ofl + "\n*/"]
    for fname, w, style in FONTS:
        out.append(
            "@font-face{font-family:'Be Vietnam Pro';"
            f"src:url(data:font/woff2;base64,{b64(DL / fname)}) format('woff2');"
            f"font-weight:{w};font-style:{style};font-display:swap}}")
    return "\n".join(out)


def img_tag(path: Path, mime: str, alt: str, cls: str, extra: str = "") -> str:
    w, h = Image.open(path).size
    return (f'<img class="{cls}" src="{data_uri(path, mime)}" width="{w}" height="{h}" '
            f'alt="{alt}" decoding="async" {extra}>').replace(" >", ">")


def partner(path: Path, alt: str, cls: str) -> str:
    w, h = Image.open(path).size  # ảnh đã xuất gấp đôi cỡ hiển thị
    return (f'<img class="p-logo {cls}" src="{data_uri(path, "image/webp")}" width="{w // 2}" '
            f'height="{h // 2}" alt="{alt}" loading="eager" decoding="async">')


ICONS = {
    "CHECK": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
    "X": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>',
    "ALERT": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    "CLOSE": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    "ARROW": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    "DOWN": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14m-6-6 6 6 6-6"/></svg>',
    "SPARK": '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2c.5 5.2 4.8 9.5 10 10-5.2.5-9.5 4.8-10 10-.5-5.2-4.8-9.5-10-10 5.2-.5 9.5-4.8 10-10Z"/></svg>',
    "COMPASS": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z"/></svg>',
    "TOOLS": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
    "SHIELD": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m8.8 12.2 2.3 2.3 4.3-4.6"/></svg>',
}


def main():
    html = (SRC / "template.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    js = (SRC / "main.js").read_text(encoding="utf-8")

    favicon = "data:image/svg+xml," + urllib.parse.quote(clean_svg("tinhtuom-seal-do.svg"), safe=" =:/'\"#,.")
    repl = {
        "{{STYLE}}": css.replace("/*{{FONTS}}*/", font_faces()),
        "{{MAIN_JS}}": js,
        "{{FAVICON}}": favicon,
        "{{LOGO_HEADER}}": header_logo(),
        "{{LOGO_SYMBOL}}": logo_symbol(),
        "{{IMG_NAM}}": img_tag(IMG / "sv-nam.webp", "image/webp", "Sinh viên nam cầm sổ, làm dấu OK",
                               "hero-img hero-img--nam", 'fetchpriority="high" loading="eager"'),
        "{{IMG_NU}}": img_tag(IMG / "sv-nu.webp", "image/webp", "Sinh viên nữ cầm sổ, làm dấu OK",
                              "hero-img hero-img--nu", 'fetchpriority="high" loading="eager"'),
        "{{IMG_NU_SM}}": img_tag(BUILD / "sv-nu-sm.webp", "image/webp", "Sinh viên nữ cầm sổ, làm dấu OK",
                                 "form-aside-img", 'loading="lazy"'),
        "{{IMG_NAM_SM}}": img_tag(BUILD / "sv-nam-sm.webp", "image/webp", "", "modal-img", 'loading="lazy"'),
        "{{P_GURU}}": partner(BUILD / "p-guru.webp", "Guru.edu.vn", "p-guru"),
        "{{P_MAXSKILL}}": partner(BUILD / "p-maxskill.webp", "MaXskill", "p-maxskill"),
        "{{P_MERAKI}}": partner(BUILD / "p-meraki.webp", "Meraki", "p-meraki"),
        "{{FB_URL}}": FB_URL,
    }
    for k, v in ICONS.items():
        repl["{{IC_" + k + "}}"] = v
    for k, v in repl.items():
        html = html.replace(k, v)
    left = re.findall(r"\{\{[A-Z_]+\}\}", html)
    assert not left, left
    OUT.write_text(html, encoding="utf-8")
    print(f"OK {OUT} {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
