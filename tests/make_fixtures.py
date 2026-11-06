"""Generates synthetic test files (no personal data) into tests/fixtures/.

Run: python3 tests/make_fixtures.py
"""
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def photo(w, h, seed):
    """A noisy, photo-like image that compresses poorly (like a real phone photo)."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            v = int(127 + 60 * math.sin(x / 37 + seed) + 40 * math.cos(y / 53))
            px[x, y] = (
                max(0, min(255, v + rnd.randint(-30, 30))),
                max(0, min(255, int(v * 0.8) + rnd.randint(-30, 30))),
                max(0, min(255, 200 - v // 2 + rnd.randint(-30, 30))),
            )
    d = ImageDraw.Draw(img)
    d.rectangle([w * 0.1, h * 0.1, w * 0.9, h * 0.35], fill=(250, 250, 245))
    for i in range(6):
        y = h * 0.14 + i * h * 0.03
        d.rectangle([w * 0.14, y, w * (0.5 + 0.3 * rnd.random()), y + h * 0.012], fill=(40, 40, 40))
    return img


def make_text_pdf(path, pages, with_photo=True, title="Report"):
    c = canvas.Canvas(path, pagesize=A4)
    W, H = A4
    for i in range(pages):
        c.setFont("Helvetica-Bold", 22)
        c.drawString(60, H - 80, f"{title} page {i + 1}")
        c.setFont("Helvetica", 11)
        for line in range(18):
            c.drawString(60, H - 120 - line * 16, f"Line {line + 1}: The quick brown fox jumps over the lazy dog {i}-{line}.")
        if with_photo:
            img = photo(1800, 1200, seed=i + len(title))
            c.drawImage(ImageReader(img), 60, 80, width=W - 120, height=(W - 120) * 2 / 3)
        c.showPage()
    c.save()


print("photos…", file=sys.stderr)
p1 = photo(2400, 3200, 1)
p1.save(os.path.join(OUT, "scan-portrait.jpg"), quality=92)

# JPEG stored sideways with EXIF orientation 6 (rotate 90° CW to display), like phone cameras do
p2 = photo(3200, 2400, 2)
exif = Image.Exif()
exif[0x0112] = 6
p2.save(os.path.join(OUT, "phone-exif-rotated.jpg"), quality=92, exif=exif.tobytes())

# PNG with transparency
png = Image.new("RGBA", (900, 600), (0, 0, 0, 0))
d = ImageDraw.Draw(png)
d.ellipse([100, 50, 800, 550], fill=(229, 72, 59, 220))
d.rectangle([300, 200, 600, 400], fill=(47, 125, 225, 255))
png.save(os.path.join(OUT, "logo-transparent.png"))

photo(1600, 1200, 3).save(os.path.join(OUT, "landscape.webp"), quality=90)

# HEIC via macOS sips, if available
heic = os.path.join(OUT, "iphone.heic")
try:
    subprocess.run(["sips", "-s", "format", "heic", os.path.join(OUT, "scan-portrait.jpg"), "--out", heic],
                   check=True, capture_output=True)
except Exception as e:  # noqa: BLE001
    print("skip heic:", e, file=sys.stderr)

# photo with camera + GPS EXIF (synthetic location: Monas, Jakarta)
gps_img = photo(1200, 900, 4)
ex = Image.Exif()
ex[0x010F] = "FakeCam"
ex[0x0110] = "FakeCam Z9"
ex[0x0132] = "2026:11:01 10:20:30"
gps = ex.get_ifd(0x8825)
gps[1] = "S"
gps[2] = (6.0, 10.0, 31.0)
gps[3] = "E"
gps[4] = (106.0, 49.0, 39.0)
gps_img.save(os.path.join(OUT, "gps-photo.jpg"), quality=90, exif=ex.tobytes())

# a real subject for background removal: macOS ships sample animal photos
sample = "/Library/User Pictures/Animals/Parrot.heic"
if os.path.exists(sample):
    subprocess.run(["sips", "-s", "format", "jpeg", sample, "--out", os.path.join(OUT, "parrot.jpg")], capture_output=True)

print("pdfs…", file=sys.stderr)
make_text_pdf(os.path.join(OUT, "report-3p.pdf"), 3, title="Report")
make_text_pdf(os.path.join(OUT, "notes-2p.pdf"), 2, with_photo=False, title="Notes")

# password-protected (user password "rahasia")
w = PdfWriter(clone_from=PdfReader(os.path.join(OUT, "notes-2p.pdf")))
w.encrypt(user_password="rahasia", owner_password="owner", algorithm="AES-128")
w.write(os.path.join(OUT, "locked-rahasia.pdf"))

# owner-password only: opens without a password but is encrypted (very common)
w = PdfWriter(clone_from=PdfReader(os.path.join(OUT, "notes-2p.pdf")))
w.encrypt(user_password="", owner_password="owner", algorithm="RC4-128")
w.write(os.path.join(OUT, "restricted.pdf"))

for f in sorted(os.listdir(OUT)):
    print(f"{os.path.getsize(os.path.join(OUT, f)):>10}  {f}")
