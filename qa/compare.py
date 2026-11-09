#!/usr/bin/env python3
"""Compare a reference UI crop with a rendered app screenshot. Requires Pillow.

Usage:
 python qa/compare.py --reference references/01_my_bookings.png --actual qa/captures/01_my_bookings.png --reference-roi 40 125 785 1582 --output qa/results/01

The reference PNG is a concept mockup with an iPhone FRAME, which an app does not render.
Select and adjust reference-roi to cover only the ACTUAL app viewport. Avoid comparing frames.
Screenshots MUST depict same device dimensions, scaling, and scroll position.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance
import numpy as np

p=argparse.ArgumentParser(description='Reference comparison with explicit content ROIs and uniform scaling.')
p.add_argument('--reference',required=True)
p.add_argument('--actual',required=True)
p.add_argument('--reference-roi',type=int,nargs=4)
p.add_argument('--actual-roi',type=int,nargs=4)
p.add_argument('--uniform',action='store_true',help='Uniformly scale reference to actual width; never stretch actual.')
p.add_argument('--strict',action='store_true',help='Reject dimensions that differ after explicit scaling.')
p.add_argument('--output',default='qa/results/compare')
a=p.parse_args()

def crop(image,roi):
    if not roi: return image
    x,y,w,h=roi
    if min(x,y)<0 or min(w,h)<=0 or x+w>image.width or y+h>image.height:
        p.error(f'ROI {roi} exceeds image {image.size}')
    return image.crop((x,y,x+w,y+h))

ref=crop(Image.open(a.reference).convert('RGB'),a.reference_roi)
actual=crop(Image.open(a.actual).convert('RGB'),a.actual_roi)
scale=1.0
if a.uniform:
    scale=actual.width/ref.width
    ref=ref.resize((actual.width,round(ref.height*scale)),Image.Resampling.LANCZOS)
if ref.size!=actual.size:
    if a.strict: p.error(f'Dimensions differ: reference {ref.size}, actual {actual.size}')
    print(f'WARNING dimensions differ: ref {ref.size}, actual {actual.size}; resized actual for preliminary comparison ONLY')
    actual=actual.resize(ref.size,Image.Resampling.LANCZOS)
arr1=np.asarray(ref).astype('float32');arr2=np.asarray(actual).astype('float32')
mae=float(np.abs(arr1-arr2).mean());rmse=float(np.sqrt(np.square(arr1-arr2).mean()))
print(f'Uniform reference scale: {scale:.6f}; content pixels: {ref.size}; MAE: {mae:.3f}/255; RMSE: {rmse:.3f}/255. Not a fidelity percentage.')
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
Image.blend(ref,actual,.5).save(str(out)+'_overlay.png')
ImageEnhance.Contrast(ImageChops.difference(ref,actual)).enhance(2.8).save(str(out)+'_diff.png')
side=Image.new('RGB',(ref.width*2,ref.height),'white');side.paste(ref,(0,0));side.paste(actual,(ref.width,0));side.save(str(out)+'_side_by_side.png')
