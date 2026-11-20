#!/bin/bash
# Restores reel-editing assets into a work dir (default: ./reel-work). Safe to re-run.
set -e
W=${1:-reel-work}; mkdir -p "$W/brand" "$W/models"
pip install -q mediapipe scipy >/dev/null 2>&1 || true
apt-get install -y -q libegl1 libgles2 >/dev/null 2>&1 || (apt-get update -q >/dev/null && apt-get install -y -q libegl1 libgles2 >/dev/null) || true
cd "$W/brand"
[ -f logo-black.png ] || curl -s -m 30 "https://shopwithsask.com/cdn/shop/files/sask-logo-black.png" -o logo-black.png
for spec in "Readex+Pro:wght@400|ReadexPro-400" "Playfair+Display:ital,wght@1,700|PlayfairDisplay-BoldItalic" "Montserrat:wght@800|Montserrat-ExtraBold"; do
  q=${spec%%|*}; n=${spec##*|}; [ -f "$n.ttf" ] && continue
  url=$(curl -s -m 20 -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=$q" | grep -oE 'https://fonts.gstatic.com[^)]*' | head -1); curl -s -m 20 "$url" -o "$n.ttf"
done
python3 -I -c "
from PIL import Image; import numpy as np
a=np.array(Image.open('logo-black.png').convert('RGBA')).astype(float)
o=np.zeros_like(a); o[...,:3]=13; o[...,3]=a[...,3]; Image.fromarray(o.astype('uint8')).save('logo-dark.png')"
cd ../models
[ -f selfie_multiclass.tflite ] || curl -s -m 60 -o selfie_multiclass.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
echo "ready: $W"
