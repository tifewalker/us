"""Generates the PWA icons + iOS launch images into public/.

Run from the repo root:  python scripts/generate-web-icons.py   (needs Pillow)
Design (DESIGN.md): the Fluent 3D "beach with umbrella" icon on a sunset → sand
gradient; launch images add "Us" in Fraunces italic.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
ICONS = os.path.join(PUBLIC, "icons")
SPLASH = os.path.join(PUBLIC, "splash")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(SPLASH, exist_ok=True)

BEACH = Image.open(os.path.join(ROOT, "assets", "icons3d", "beach.png")).convert("RGBA")
FONT = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "fraunces", "600SemiBold_Italic", "Fraunces_600SemiBold_Italic.ttf")

SUNSET = (0xFF, 0x8C, 0x69)
SAND = (0xF5, 0xD7, 0xA1)
INK_OCEAN = (0x0E, 0x3A, 0x4F)


def gradient(w, h, top=SUNSET, bottom=SAND):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def icon(size, art_scale):
    img = gradient(size, size).convert("RGBA")
    art = BEACH.resize((round(size * art_scale),) * 2, Image.LANCZOS)
    img.alpha_composite(art, ((size - art.width) // 2, round((size - art.height) / 2 + size * 0.02)))
    return img.convert("RGB")  # no transparency — iOS masks the corners itself


def save(img, path):
    img.save(path, optimize=True)
    print("wrote", os.path.relpath(path, ROOT), img.size)


# App icons
base = icon(1024, 0.62)
for name, s in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-32.png", 32), ("favicon-48.png", 48)]:
    save(base.resize((s, s), Image.LANCZOS), os.path.join(ICONS, name))
# Maskable: keep the art inside the 80% safe zone
save(icon(1024, 0.5).resize((512, 512), Image.LANCZOS), os.path.join(ICONS, "icon-maskable-512.png"))

# iOS launch images (portrait), device px
SIZES = [
    (1320, 2868), (1206, 2622),  # 16 Pro Max / 16 Pro
    (1290, 2796), (1179, 2556),  # 14–15 Pro Max & Plus / 14–16 Pro & 15–16
    (1284, 2778), (1170, 2532),  # 12–13 Pro Max & 14 Plus / 12–14
    (1242, 2688), (1125, 2436),  # XS Max, 11 Pro Max / X, XS, 11 Pro
    (828, 1792), (750, 1334),    # XR, 11 / SE 2–3, 8
]
for w, h in SIZES:
    img = gradient(w, h).convert("RGBA")
    art_size = round(w * 0.42)
    art = BEACH.resize((art_size, art_size), Image.LANCZOS)
    img.alpha_composite(art, ((w - art_size) // 2, round(h * 0.36)))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, round(w * 0.16))
    text = "Us"
    tw = draw.textlength(text, font=font)
    draw.text(((w - tw) / 2, h * 0.36 + art_size + w * 0.04), text, font=font, fill=INK_OCEAN)
    save(img.convert("RGB"), os.path.join(SPLASH, f"launch-{w}x{h}.png"))
