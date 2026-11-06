"""Builds the background-removal model served at /models/isnet/.

Downloads ISNet (general use, Apache-2.0, from the rembg releases), applies
dynamic uint8 quantisation while keeping the input, high-resolution and output
layers in fp32 (quality stays close to the original, ~50 MB instead of 178 MB),
then splits it into parts below Cloudflare's 25 MiB per-file limit.

Run: python3 scripts/prepare-model.py   (needs onnx + onnxruntime)
"""
import hashlib
import json
import os
import urllib.request

import onnx
from onnxruntime.quantization import QuantType, quantize_dynamic

URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
SHA256 = "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a"
CACHE = os.path.expanduser("~/.cache/localkit-models")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "isnet")
PART = 20 * 1024 * 1024

os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
src = os.path.join(CACHE, "isnet-general-use.onnx")
if not os.path.exists(src):
    print("downloading", URL)
    urllib.request.urlretrieve(URL, src)
assert hashlib.sha256(open(src, "rb").read()).hexdigest() == SHA256, "checksum mismatch"

quant = os.path.join(CACHE, "isnet-mixed.onnx")
if not os.path.exists(quant):
    convs = [n.name for n in onnx.load(src).graph.node if n.op_type == "Conv"]
    keep = ("/conv_in", "/side", "/outconv", "/stage1/", "/stage1d/", "/stage2/", "/stage2d/")
    quantize_dynamic(src, quant, weight_type=QuantType.QUInt8, nodes_to_exclude=[c for c in convs if c.startswith(keep)])

data = open(quant, "rb").read()
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
parts = []
for i in range(0, len(data), PART):
    name = f"isnet.onnx.part{len(parts)}"
    open(os.path.join(OUT, name), "wb").write(data[i : i + PART])
    parts.append(name)
manifest = {"size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "parts": parts, "input": 1024}
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)
print(f"{len(data) / 1e6:.1f} MB in {len(parts)} parts -> {os.path.relpath(OUT)}")
