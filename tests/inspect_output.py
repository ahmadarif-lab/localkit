"""Prints a JSON summary of a produced file (PDF, image or ZIP of those)."""
import io
import json
import sys
import zipfile

from PIL import Image
from pypdf import PdfReader


def pdf_info(data):
    r = PdfReader(io.BytesIO(data))
    pages = []
    for p in r.pages:
        box = p.mediabox
        pages.append({
            "w": round(float(box.width)),
            "h": round(float(box.height)),
            "rotate": int(p.get("/Rotate", 0) or 0),
            "text": (p.extract_text() or "").strip()[:60],
        })
    return {"type": "pdf", "size": len(data), "pages": pages}


def img_info(data):
    im = Image.open(io.BytesIO(data))
    return {"type": "image", "format": im.format, "size": len(data), "w": im.width, "h": im.height, "mode": im.mode}


def info(name, data):
    if data[:4] == b"%PDF":
        return pdf_info(data)
    if data[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(data))
        return {"type": "zip", "entries": {n: info(n, z.read(n)) for n in z.namelist()}}
    return img_info(data)


path = sys.argv[1]
with open(path, "rb") as f:
    print(json.dumps(info(path, f.read())))
