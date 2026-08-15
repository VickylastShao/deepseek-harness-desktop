#!/usr/bin/env python3
"""Generate deterministic README media from the repository's real screenshots.

Requires Pillow and CairoSVG. The output files are intentionally committed so
README rendering does not depend on a build step or a third-party image host.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = PROJECT_ROOT / "docs" / "images"
SOCIAL_PREVIEW = IMAGE_DIR / "social-preview.png"
WORKFLOW_GIF = IMAGE_DIR / "desktop-workflow.gif"

NAVY = (7, 17, 31)
NAVY_LIGHT = (13, 36, 62)
BLUE = (77, 107, 254)
WHITE = (245, 248, 255)
MUTED = (174, 192, 214)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu") / name,
        Path("/usr/share/fonts/dejavu") / name,
        Path("C:/Windows/Fonts") / ("arialbd.ttf" if bold else "arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def cjk_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("/usr/share/fonts/opentype/noto") / ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc"),
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return font(size, bold=bold)


def gradient(size: tuple[int, int], start: tuple[int, int, int], end: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            ratio = (x / max(width - 1, 1)) * 0.72 + (y / max(height - 1, 1)) * 0.28
            pixels[x, y] = tuple(round(a + (b - a) * ratio) for a, b in zip(start, end))
    return image


def render_logo(size: int) -> Image.Image:
    png = cairosvg.svg2png(
        url=str(PROJECT_ROOT / "docs" / "app-icon.svg"),
        output_width=size,
        output_height=size,
    )
    return Image.open(BytesIO(png)).convert("RGBA")


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    return copy


def rounded_screenshot(source: Path, box: tuple[int, int], radius: int = 18) -> Image.Image:
    screenshot = contain(Image.open(source).convert("RGB"), box)
    mask = Image.new("L", screenshot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, screenshot.width - 1, screenshot.height - 1), radius=radius, fill=255)
    result = screenshot.convert("RGBA")
    result.putalpha(mask)
    return result


def paste_with_shadow(canvas: Image.Image, image: Image.Image, position: tuple[int, int], blur: int = 24) -> None:
    x, y = position
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = image.getchannel("A")
    shadow_patch = Image.new("RGBA", image.size, (0, 0, 0, 150))
    shadow_patch.putalpha(alpha)
    shadow.alpha_composite(shadow_patch, (x, y + 14))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(image, position)


def generate_social_preview(output: Path = SOCIAL_PREVIEW) -> None:
    canvas = gradient((1280, 640), NAVY, NAVY_LIGHT).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    logo = render_logo(106)
    canvas.alpha_composite(logo, (68, 64))

    draw.text((68, 202), "DeepSeek", font=font(52, bold=True), fill=WHITE)
    draw.text((68, 263), "Harness Desktop", font=font(41, bold=True), fill=(124, 153, 255))
    draw.text((68, 342), "DeepSeek Harness,", font=font(27), fill=MUTED)
    draw.text((68, 378), "without the terminal.", font=font(27), fill=MUTED)

    draw.rounded_rectangle((68, 474, 420, 532), radius=29, fill=BLUE)
    draw.text((98, 490), "Windows  ·  macOS  ·  Linux", font=font(18, bold=True), fill=WHITE)
    draw.text((68, 560), "Unofficial community desktop host", font=font(16), fill=MUTED)

    screenshot = rounded_screenshot(IMAGE_DIR / "deepseek-harness-main.png", (670, 470), radius=20)
    paste_with_shadow(canvas, screenshot, (562, 93))
    draw.rounded_rectangle((562, 93, 562 + screenshot.width - 1, 93 + screenshot.height - 1), radius=20, outline=(76, 105, 146, 255), width=2)

    canvas.convert("RGB").save(output, format="PNG", optimize=True)


def workflow_frame(source: Path, number: str, english: str, chinese: str) -> Image.Image:
    canvas = gradient((960, 600), NAVY, NAVY_LIGHT).convert("RGBA")
    screenshot = rounded_screenshot(source, (900, 510), radius=16)
    x = (canvas.width - screenshot.width) // 2
    y = 24 + max(0, (510 - screenshot.height) // 2)
    paste_with_shadow(canvas, screenshot, (x, y), blur=16)

    panel_top = 500
    overlay = Image.new("RGBA", (960, 100), (7, 17, 31, 232))
    canvas.alpha_composite(overlay, (0, panel_top))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((32, 522, 78, 568), radius=23, fill=BLUE)
    number_box = draw.textbbox((0, 0), number, font=font(21, bold=True))
    number_width = number_box[2] - number_box[0]
    draw.text((55 - number_width / 2, 532), number, font=font(21, bold=True), fill=WHITE)
    draw.text((98, 518), english, font=font(23, bold=True), fill=WHITE)
    draw.text((98, 551), chinese, font=cjk_font(18), fill=MUTED)
    return canvas.convert("RGB")


def generate_workflow_gif(output: Path = WORKFLOW_GIF) -> None:
    scenes = [
        workflow_frame(IMAGE_DIR / "desktop-startup.png", "1", "Launch without a terminal", "无需命令行即可启动"),
        workflow_frame(IMAGE_DIR / "deepseek-harness-main.png", "2", "Work in the upstream Harness UI", "使用未经修改的上游 Harness 界面"),
        workflow_frame(IMAGE_DIR / "desktop-control-center-hero.png", "3", "Control updates, health, and support", "管理更新、运行状态与诊断"),
    ]

    frames: list[Image.Image] = []
    durations: list[int] = []
    hold_durations = [1700, 2600, 2100]

    for index, scene in enumerate(scenes):
        frames.append(scene)
        durations.append(hold_durations[index])

    palette_frames = [frame.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
    palette_frames[0].save(
        output,
        format="GIF",
        save_all=True,
        append_images=palette_frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )


def verify_outputs(social_preview: Path = SOCIAL_PREVIEW, workflow_gif: Path = WORKFLOW_GIF) -> None:
    with Image.open(social_preview) as image:
        if image.size != (1280, 640):
            raise RuntimeError(f"Unexpected social preview size: {image.size}")
    with Image.open(workflow_gif) as image:
        if image.size != (960, 600):
            raise RuntimeError(f"Unexpected workflow GIF size: {image.size}")
    if social_preview.stat().st_size >= 1024 * 1024:
        raise RuntimeError("Social preview exceeds 1 MiB")
    if workflow_gif.stat().st_size > 5 * 1024 * 1024:
        raise RuntimeError("Workflow GIF exceeds 5 MiB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify committed media reproduces byte for byte")
    args = parser.parse_args()

    if args.check:
        canonical_fonts = [
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
            Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
        ]
        if not sys.platform.startswith("linux") or not all(candidate.exists() for candidate in canonical_fonts):
            parser.error("--check requires Linux with the canonical DejaVu and Noto CJK fonts")
        with TemporaryDirectory(prefix="deepseek-harness-media-") as directory:
            temporary = Path(directory)
            social_preview = temporary / SOCIAL_PREVIEW.name
            workflow_gif = temporary / WORKFLOW_GIF.name
            generate_social_preview(social_preview)
            generate_workflow_gif(workflow_gif)
            verify_outputs(social_preview, workflow_gif)
            if social_preview.read_bytes() != SOCIAL_PREVIEW.read_bytes():
                raise RuntimeError(f"{SOCIAL_PREVIEW.relative_to(PROJECT_ROOT)} is stale; regenerate README media")
            if workflow_gif.read_bytes() != WORKFLOW_GIF.read_bytes():
                raise RuntimeError(f"{WORKFLOW_GIF.relative_to(PROJECT_ROOT)} is stale; regenerate README media")
        print("Committed README media is reproducible")
        return

    generate_social_preview()
    generate_workflow_gif()
    verify_outputs()
    print(f"Generated {SOCIAL_PREVIEW.relative_to(PROJECT_ROOT)} ({SOCIAL_PREVIEW.stat().st_size} bytes)")
    print(f"Generated {WORKFLOW_GIF.relative_to(PROJECT_ROOT)} ({WORKFLOW_GIF.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
