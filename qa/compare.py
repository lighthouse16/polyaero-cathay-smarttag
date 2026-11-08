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
from PIL import Image,ImageChops,ImageEnhance,ImageOps,ImageDraw
import numpy as np
p=argparse.ArgumentParser()
p.add_argument('--reference',required=True)
p.add_argument('--actual',required=True)
p.add_argument('--reference-roi',type=int,nargs=4,metavar=('X','Y','WIDTH','HEIGHT'))
p.add_argument('--actual-roi',type=int,nargs=4)
p.add_argument('--output',default='qa/results/compare')
a=p.parse_args()
ref=Image.open(a.reference).convert('RGB');actual=Image.open(a.actual).convert('RGB')
if a.reference_roi:
 x,y,w,h=a.reference_roi;ref=ref.crop((x,y,x+w,y+h))
if a.actual_roi:
 x,y,w,h=a.actual_roi;actual=actual.crop((x,y,x+w,y+h))
if ref.size != actual.size:
 print(f'WARNING dimensions differ: ref {ref.size}, actual {actual.size}; resized actual for preliminary comparison ONLY')
 actual=actual.resize(ref.size,Image.Resampling.LANCZOS)
arr1=np.asarray(ref).astype('float32');arr2=np.asarray(actual).astype('float32')
mae=float(np.abs(arr1-arr2).mean());rmse=float(np.sqrt(np.square(arr1-arr2).mean()))
print(f'MAE RGB pixel: {mae:.3f}/255; RMSE: {rmse:.3f}/255. Neither is a visual similarity percentage.')
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
Image.blend(ref,actual,.5).save(str(out)+'_overlay.png')
diff=ImageChops.difference(ref,actual)
ImageEnhance.Contrast(diff).enhance(2.8).save(str(out)+'_diff.png')
side=Image.new('RGB',(ref.width*2,ref.height),(255,255,255));side.paste(ref,(0,0));side.paste(actual,(ref.width,0));side.save(str(out)+'_side_by_side.png')
