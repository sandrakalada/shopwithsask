"""Character reference set from real footage: person cutouts on a neutral background + labeled contact sheet.
Usage: python3 -I character_sheet.py config.json"""
import json, sys, subprocess, os
import numpy as np, mediapipe as mp
from scipy import ndimage
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw, ImageFont, ImageFilter
cfg=json.load(open(sys.argv[1])); out=cfg['out_dir']; os.makedirs(out,exist_ok=True)
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path=cfg['model']),output_confidence_masks=True))
BG=(236,234,230); font=ImageFont.truetype(cfg['font'],40)
def grab(src,t):
    raw=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',src,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
    return Image.frombuffer('RGB',(1080,1920),raw).copy()
def mask(im):
    small=np.array(im.resize((540,960)))
    r=seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB,data=small))
    m=(1-np.squeeze(r.confidence_masks[0].numpy_view()))
    hard=m>0.5; lab,n=ndimage.label(hard)
    if n>1: sz=ndimage.sum(hard,lab,range(1,n+1)); keep=lab==(np.argmax(sz)+1); m=m*ndimage.binary_dilation(keep,iterations=6)
    m=np.clip((m-0.45)/0.15,0,1)  # hard matte, soft only at the edge
    return Image.fromarray((m*255).astype(np.uint8)).resize(im.size,Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
tiles=[]
for v in cfg['views']:
    im=grab(v['src'],v['t']); m=mask(im)
    if v.get('crop'):
        x0,y0,x1,y1=[int(c) for c in v['crop']]; im=im.crop((x0,y0,x1,y1)); m=m.crop((x0,y0,x1,y1))
    if v.get('keep_bg'): res=im
    else:
        bg=Image.new('RGB',im.size,BG); res=Image.composite(im,bg,m)
        bb=m.point(lambda p:255 if p>40 else 0).getbbox()
        if bb and not v.get('crop'):
            pad=60; bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(im.width,bb[2]+pad),min(im.height,bb[3]+pad)); res=res.crop(bb)
    # fit into 1080x1440 portrait canvas (3:4), no upscale artifacts beyond 2x
    can=Image.new('RGB',(1080,1440),BG); r=min(1080/res.width,1440/res.height); r=min(r,2.4)
    rs=res.resize((int(res.width*r),int(res.height*r)),Image.LANCZOS); can.paste(rs,((1080-rs.width)//2,(1440-rs.height)//2))
    name=f"{cfg['prefix']}-{v['label'].lower().replace(' ','-')}.jpg"; can.save(f'{out}/{name}',quality=95); tiles.append((v['label'],can))
cols=4; rows=(len(tiles)+cols-1)//cols; tw,th=540,720
sheet=Image.new('RGB',(cols*tw,rows*(th+70)),(255,255,255)); d=ImageDraw.Draw(sheet)
for i,(lab,can) in enumerate(tiles):
    x=(i%cols)*tw; y=(i//cols)*(th+70); sheet.paste(can.resize((tw,th),Image.LANCZOS),(x,y))
    d.text((x+20,y+th+14),lab.upper(),font=font,fill=(56,46,39))
sheet.save(f"{out}/{cfg['prefix']}-SHEET.jpg",quality=92); seg.close(); print(len(tiles),'views ->',out)
