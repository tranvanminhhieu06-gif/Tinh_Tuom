"""Ghép template.html + main.js + logo SVG + ảnh base64 thành một file index.html tự chứa."""
import base64
import random
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BUILD = ROOT / "build"
DL = Path(r"C:\Users\PC\Downloads")
OUT = ROOT / "index.html"
FB_URL = "https://www.facebook.com/groups/tinhoatuchu"


def clean_svg(name: str) -> str:
    s = (DL / name).read_text(encoding="utf-8")
    s = re.sub(r"<metadata>.*?</metadata>", "", s, flags=re.S)
    s = s.replace(' xmlns:c2pa="http://c2pa.org/manifest"', "")
    s = re.sub(r'\s(width|height)="[\d.]+"', "", s, count=2)
    return s


def inline_logo(name: str, cls: str, label: str, decorative: bool = False) -> str:
    s = clean_svg(name)
    attrs = f'class="{cls}" focusable="false" '
    attrs += 'aria-hidden="true" ' if decorative else f'role="img" aria-label="{label}" '
    return s.replace("<svg ", "<svg " + attrs, 1)


def header_logo() -> str:
    """Logo ngang đen; con dấu có thêm một nét viền để vẽ lộ dần một lần (nét mờ đi khi xong)."""
    s = inline_logo("tinhtuom-logo-ngang-den.svg", "logo-h", "Tinh Tươm", decorative=True)
    m = re.search(r'(<g transform="scale\(0\.36\)">)(<path fill="#000000" fill-rule="evenodd" d="([^"]+)"/>)', s)
    assert m, "không tìm thấy con dấu"
    d = m.group(3)
    new = (m.group(1)
           + f'<path class="seal-fill" fill="#000000" fill-rule="evenodd" d="{d}"/>'
           + f'<path class="seal-stroke" pathLength="1" d="{d}"/>')
    return s.replace(m.group(0), new, 1)


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def arrow_svg() -> str:
    """Mũi tên hạt tĩnh (mobile / reduced-motion) — cùng hình với trường hạt WebGL."""
    poly = [(0.5, 0.02), (0.93, 0.47), (0.645, 0.47), (0.645, 0.98), (0.355, 0.98), (0.355, 0.47), (0.07, 0.47)]

    def inside(x, y):
        c = False
        j = len(poly) - 1
        for i in range(len(poly)):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c

    rnd = random.Random(7)
    size, step = 400, 9
    dots = []
    for gy in range(0, size, step):
        for gx in range(0, size, step):
            x = gx + step / 2 + rnd.uniform(-2.6, 2.6)
            y = gy + step / 2 + rnd.uniform(-2.6, 2.6)
            if inside(x / size, y / size):
                r = rnd.choice((1.5, 1.8, 2.1))
                dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}"/>')
    return ('<svg class="arrow-static" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" '
            'focusable="false" aria-hidden="true"><g fill="#000" fill-opacity=".72">'
            + "".join(dots) + "</g></svg>")


ICON_CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" '
              'stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>')
ICON_X = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" '
          'aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>')


def main():
    from PIL import Image

    html = (SRC / "template.html").read_text(encoding="utf-8")
    js = (SRC / "main.js").read_text(encoding="utf-8")

    seal = clean_svg("tinhtuom-seal-do.svg")
    favicon = "data:image/svg+xml," + urllib.parse.quote(seal, safe=" =:/'\"#,.")

    widths = {}
    for key, fname, h in (("GURU", "guru.jpg", 40), ("MAXSKILL", "maxskill.png", 34), ("MERAKI", "meraki.png", 56)):
        im = Image.open(BUILD / fname)
        widths[key] = round(im.width * h / im.height)

    repl = {
        "{{MAIN_JS}}": js,
        "{{FAVICON}}": favicon,
        "{{LOGO_HEADER}}": header_logo(),
        "{{LOGO_FOOTER}}": inline_logo("tinhtuom-logo-doc-trang.svg", "logo-v", "Tinh Tươm", decorative=True),
        "{{LOGO_MODAL}}": inline_logo("tinhtuom-logo-doc-den.svg", "logo-v", "Tinh Tươm"),
        "{{IMG_GURU}}": data_uri(BUILD / "guru.jpg", "image/jpeg"),
        "{{IMG_MAXSKILL}}": data_uri(BUILD / "maxskill.webp", "image/webp"),
        "{{IMG_MERAKI}}": data_uri(BUILD / "meraki.webp", "image/webp"),
        "{{W_GURU}}": str(widths["GURU"]),
        "{{W_MAXSKILL}}": str(widths["MAXSKILL"]),
        "{{W_MERAKI}}": str(widths["MERAKI"]),
        "{{ARROW_SVG}}": arrow_svg(),
        "{{ICON_CHECK_TH}}": ICON_CHECK.replace("<svg ", '<svg class="th-icon" ', 1),
        "{{ICON_X_TH}}": ICON_X.replace("<svg ", '<svg class="th-icon" ', 1),
        "{{ICON_CHECK}}": ICON_CHECK,
        "{{ICON_X}}": ICON_X,
        "{{FB_URL}}": FB_URL,
    }
    for k, v in repl.items():
        html = html.replace(k, v)
    left = re.findall(r"\{\{[A-Z_]+\}\}", html)
    assert not left, left
    OUT.write_text(html, encoding="utf-8")
    print(f"OK {OUT} {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
