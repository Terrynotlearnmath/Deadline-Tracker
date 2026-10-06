"""Build the portable Windows app and a single-file browser edition."""

from __future__ import annotations

import base64
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
RELEASE = ROOT / "release"
APP_EXE = RELEASE / "DeadlineTracker.exe"
LEGACY_APP_DIR = RELEASE / "DeadlineTracker"
BUILD = ROOT / "build"


def build_icon() -> None:
    """Draw the desktop raster icon to match web/icon.svg."""
    scale = 4
    size = 256 * scale
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def box(coords: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        return tuple(value * scale for value in coords)

    draw.rounded_rectangle(box((10, 10, 246, 246)), radius=56 * scale, fill="#142034")
    draw.rounded_rectangle(
        box((11, 11, 245, 245)),
        radius=55 * scale,
        outline=(255, 255, 255, 34),
        width=2 * scale,
    )
    draw.rounded_rectangle(box((54, 67, 202, 204)), radius=24 * scale, fill="#f5f9ff")
    draw.rounded_rectangle(box((54, 67, 202, 132)), radius=24 * scale, fill="#67b8fb")
    draw.rectangle(box((54, 107, 202, 132)), fill="#67b8fb")
    for x in (94, 162):
        draw.line([(x * scale, 57 * scale), (x * scale, 84 * scale)], fill="#dbeeff", width=13 * scale)
        draw.ellipse(box((x - 6, 51, x + 6, 63)), fill="#dbeeff")
        draw.ellipse(box((x - 6, 78, x + 6, 90)), fill="#dbeeff")
    draw.line(
        [(94 * scale, 155 * scale), (118 * scale, 177 * scale), (164 * scale, 128 * scale)],
        fill="#2587e9",
        width=13 * scale,
        joint="curve",
    )

    image = image.resize((256, 256), Image.Resampling.LANCZOS)
    image.save(WEB / "icon.png")
    image.save(WEB / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def build_html() -> None:
    """Inline local assets so the browser edition is one portable file."""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    svg = (WEB / "icon.svg").read_bytes()
    icon_url = "data:image/svg+xml;base64," + base64.b64encode(svg).decode("ascii")
    html = html.replace('href="icon.svg"', f'href="{icon_url}"', 1)
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        "<style>\n" + (WEB / "styles.css").read_text(encoding="utf-8") + "\n</style>",
        1,
    )
    for name in ("fireworks.js", "app.js"):
        script = (WEB / name).read_text(encoding="utf-8")
        if "</script>" in script.lower():
            raise ValueError(f"Cannot inline {name}: it contains a script end tag")
        html = html.replace(f'<script src="{name}"></script>', f"<script>\n{script}\n</script>", 1)
    RELEASE.mkdir(exist_ok=True)
    (RELEASE / "DeadlineTracker.html").write_text(html, encoding="utf-8")


def build_windows_app() -> None:
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--windowed",
        "--onefile",
        "--name",
        "DeadlineTracker",
        "--icon",
        str(WEB / "icon.ico"),
        "--hidden-import",
        "pystray._win32",
        "--add-data",
        f"{WEB};web",
        "--distpath",
        str(RELEASE),
        "--workpath",
        str(BUILD),
        "--specpath",
        str(BUILD),
        str(ROOT / "main.py"),
    ]
    subprocess.run(command, check=True, cwd=ROOT)
    if LEGACY_APP_DIR.exists():
        shutil.rmtree(LEGACY_APP_DIR)


def build_zip() -> None:
    archive = RELEASE / "DeadlineTracker-Windows.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        package.write(APP_EXE, APP_EXE.name)
        package.write(RELEASE / "DeadlineTracker.html", "DeadlineTracker.html")
        package.write(ROOT / "README.txt", "README.txt")


def main() -> None:
    build_icon()
    build_html()
    build_windows_app()
    shutil.copy2(ROOT / "README.txt", RELEASE / "README.txt")
    build_zip()
    if BUILD.exists():
        shutil.rmtree(BUILD)
    print(f"Windows app: {APP_EXE}")
    print(f"Shareable package: {RELEASE / 'DeadlineTracker-Windows.zip'}")
    print(f"Standalone browser file: {RELEASE / 'DeadlineTracker.html'}")


if __name__ == "__main__":
    main()
