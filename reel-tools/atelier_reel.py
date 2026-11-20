"""Atelier-reveal reel (no AI): dark emerging close-ups, sound design, silence drop, boom reveal, brand end card.
Usage: python3 -I atelier_reel.py config.json   (see config keys below)"""
import subprocess, json, math, sys, os
import numpy as np, mediapipe as mp
from scipy import ndimage, signal
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw, ImageFont, ImageFilter
cfg=json.load(open(sys.argv[1])); B=cfg['brand']; W,H,FPS,SR=1080,1920,30,44100
SERIF=f'{B}/PlayfairDisplay-BoldItalic.ttf'; SANS=f'{B}/Montserrat-ExtraBold.ttf'; F4=f'{B}/ReadexPro-400.ttf'
CREAM=(246,241,234); BROWN=(56,46,39)
GRADE=("curves=all='0/0.02 0.5/0.47 1/0.95',eq=saturation=0.92:contrast=1.06,"
       "colorbalance=rm=0.03:bm=-0.03:rh=0.02:bh=-0.02,noise=alls=6:allf=t")
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=mpt.BaseOptions(model_asset_path=cfg['model']),output_confidence_masks=True))
def footage(src,start,dur,speed=1.0,zoom=1.0,cx=.5,cy=.5,push=0.05):
    n=int(round(dur*FPS)); w=W/zoom; h=H/zoom; x=max(0,min(W-w,cx*W-w/2)); y=max(0,min(H-h,cy*H-h/2))
    vf=(f"crop={w:.0f}:{h:.0f}:{x:.0f}:{y:.0f},scale={W}:{H}:flags=lanczos," if zoom>1 else "")+\
       f"setpts=PTS/{speed},fps={FPS},scale=w='{W}*(1+{push}*n/{n})':h='{H}*(1+{push}*n/{n})':eval=frame,crop={W}:{H},{GRADE}"
    raw=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-t',str(dur*speed+0.3),'-i',src,'-vf',vf,'-frames:v',str(n),'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
    fr=[np.frombuffer(raw[i*W*H*3:(i+1)*W*H*3],np.uint8).reshape(H,W,3).astype(np.float32) for i in range(len(raw)//(W*H*3))]
    while len(fr)<n: fr.append(fr[-1])
    return fr[:n]
VIG=None
def vignette(strength):
    global VIG
    if VIG is None:
        yy,xx=np.mgrid[0:H,0:W]; r=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2); VIG=np.clip(1-0.55*r**2,0,1)
    return 1-(1-VIG)*strength
def person(f):
    small=np.array(Image.fromarray(f.astype(np.uint8)).resize((540,960)))
    r=seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB,data=small))
    m=(1-np.squeeze(r.confidence_masks[0].numpy_view()))>0.5
    lab,n=ndimage.label(m)
    if n>1: sz=ndimage.sum(m,lab,range(1,n+1)); m=lab==(np.argmax(sz)+1)
    m=Image.fromarray((ndimage.binary_fill_holes(m)*255).astype(np.uint8)).resize((W,H),Image.BILINEAR).filter(ImageFilter.GaussianBlur(6))
    return np.array(m,np.float32)[...,None]/255
def text_img(runs,alpha=1.0,blur=0,scale=1.0,dy=0):
    fs=[ImageFont.truetype(f,int(s*scale)) for _,f,s in runs]; dd=ImageDraw.Draw(Image.new('RGBA',(1,1)))
    ws=[dd.textlength(t,font=fo) for (t,_,_),fo in zip(runs,fs)]; asc=max(fo.getmetrics()[0] for fo in fs); dsc=max(fo.getmetrics()[1] for fo in fs)
    im=Image.new('RGBA',(int(sum(ws)+20*(len(runs)-1))+80,asc+dsc+80),(0,0,0,0)); d=ImageDraw.Draw(im); x=40
    for (t,_,_),fo,w in zip(runs,fs,ws):
        d.text((x,40+asc-fo.getmetrics()[0]+dy),t,font=fo,fill=(255,255,255,int(255*alpha))); x+=w+20
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur>0.3 else im
def put(f,im,cy):
    base=Image.fromarray(np.clip(f,0,255).astype(np.uint8)).convert('RGBA'); base.alpha_composite(im,(int(W/2-im.width/2),int(cy-im.height/2)))
    return np.array(base.convert('RGB'),np.float32)
from collections import deque
VID=os.path.splitext(cfg['out'])[0]+'.video.mp4'
writer=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
   '-vf','format=yuv420p','-c:v','libx264','-preset','medium','-crf','17','-profile:v','high',VID],stdin=subprocess.PIPE)
class Frames:
    def __init__(s,keep=12): s.buf=deque(); s.keep=keep; s.n=0
    def append(s,f):
        s.buf.append(np.clip(f,0,255).astype(np.uint8)); s.n+=1
        while len(s.buf)>s.keep: writer.stdin.write(s.buf.popleft().tobytes())
    def __iadd__(s,lst):
        for f in lst: s.append(f)
        return s
    def __len__(s): return s.n
    def flush(s):
        while s.buf: writer.stdin.write(s.buf.popleft().tobytes())
frames=Frames(); cues=[]
def now(): return len(frames)/FPS
for sh in cfg['shots']:
    t0=now(); seq=footage(cfg['src'],sh['start'],sh['dur'],sh.get('speed',1),sh.get('zoom',1),sh.get('cx',.5),sh.get('cy',.5))
    n=len(seq)
    for s in sh.get('sfx',[]): cues.append((t0+s[1],s[0]))
    for i,f in enumerate(seq):
        t=i/FPS; p=t/(n/FPS)
        if sh.get('dark_bg'):
            m=person(f); f=f*(m+(1-m)*0.07)
        if sh.get('emerge'):
            e=min(1,t/sh['emerge']); f=f*(e**1.6)
            if e<1: f=np.array(Image.fromarray(f.astype(np.uint8)).filter(ImageFilter.GaussianBlur((1-e)*14)),np.float32)
        if sh.get('lift'):  # reveal: exposure jump on the hit then settle
            f=f*(0.55+0.45*min(1,t/0.25))
        if sh.get('sweep'):
            x=(p*1.6-0.3)*W; xx=np.arange(W)[None,:,None]; f=f+np.exp(-((xx-x)/90)**2)*38
        f=f*vignette(sh.get('vignette',0.8))[...,None]
        if i>=n-sh.get('fade_out',0): f=f*((n-i)/sh['fade_out'])
        if sh.get('text'):
            tx=sh['text']; lt=t-tx.get('at',0.4)
            for li,runs in enumerate(tx['lines']):
                q=min(1,max(0,(lt-li*0.25)/0.6)); 
                if q<=0: continue
                qe=1-(1-q)**3; out=min(1,max(0,(n/FPS-t)/0.3))
                if tx['voice']=='blur': im=text_img(runs,alpha=qe*out,blur=(1-qe)*12,scale=1.04-0.04*qe)
                else: im=text_img(runs,alpha=min(1,q*2)*out,dy=int((1-qe)*18))
                f=put(f,im,H*0.58+li*118)
        frames.append(f)
    if sh.get('black_after'):
        nb=int(round(sh['black_after']*FPS))
        for s in sh.get('sfx_black',[]): cues.append((now()+s[1],s[0]))
        frames+= [np.zeros((H,W,3),np.uint8)]*nb
# end card with zoom-through
logo=Image.open(f'{B}/logo-dark.png'); end=Image.new('RGB',(W,H),CREAM); d=ImageDraw.Draw(end)
lg=logo.resize((560,int(560*logo.height/logo.width)),Image.LANCZOS); end.paste(lg,(260,780),lg)
for yy,tx,f,sz in [(1000,'S T Y L E   W I T H O U T   L I M I T S',F4,30),(1500,'shopwithsask.com',F4,34)]:
    fo=ImageFont.truetype(f,sz); d.text(((W-d.textlength(tx,font=fo))/2,yy),tx,font=fo,fill=BROWN)
E=np.array(end,np.float32); N=12; cues.append((now()-N/FPS,'whoosh'))
tail=list(frames.buf); frames.buf.clear()
for i,fr in enumerate(tail[-N:]):
    k=1.06**(i+1); im=Image.fromarray(fr); w,h=int(W*k),int(H*k)
    im=im.resize((w,h),Image.BILINEAR).crop(((w-W)//2,(h-H)//2,(w-W)//2+W,(h-H)//2+H)).filter(ImageFilter.GaussianBlur(i*1.4))
    a=max(0,(i-4)/(N-4)); writer.stdin.write(np.clip(np.array(im,np.float32)*(1-a)+E*a,0,255).astype(np.uint8).tobytes())
Eb=E.astype(np.uint8).tobytes(); nend=int(2.4*FPS)
for _ in range(nend): writer.stdin.write(Eb)
frames.n+=nend; writer.stdin.close(); writer.wait()
total=len(frames)/FPS
# ---------- sound design (synthesized foley, no music)
rng=np.random.default_rng(7); L=int(total*SR)+SR; mix=np.zeros(L)
def bp(x,lo,hi,order=2): b,a=signal.butter(order,[lo/(SR/2),hi/(SR/2)],'band'); return signal.lfilter(b,a,x)
def lp(x,f,order=2): b,a=signal.butter(order,f/(SR/2)); return signal.lfilter(b,a,x)
def env(n,att,dec): t=np.arange(n)/SR; return np.minimum(t/att,1)*np.exp(-t/dec)
def rustle(dur=0.7):
    n=int(dur*SR); x=bp(rng.standard_normal(n),900,7000)
    am=np.abs(lp(rng.standard_normal(n),18))*6; am=am/am.max()
    return 0.5*x*am*np.hanning(n)
def click():
    n=int(0.08*SR); t=np.arange(n)/SR
    return 0.55*(np.sin(2*np.pi*2300*t)*np.exp(-t/0.008)+0.6*bp(rng.standard_normal(n),3000,9000)*np.exp(-t/0.004))
def whoosh(dur=0.5):
    n=int(dur*SR); x=rng.standard_normal(n); out=np.zeros(n); seglen=512
    for i in range(0,n,seglen):
        fc=400+3200*np.sin(np.pi*i/n); out[i:i+seglen]=bp(x[i:i+seglen+256],fc*0.6,fc*1.4)[:len(out[i:i+seglen])]
    return 0.5*out*np.sin(np.pi*np.arange(n)/n)**2
def riser(dur=1.4):
    n=int(dur*SR); t=np.arange(n)/SR; f=60+500*(t/dur)**2
    tone=np.sin(2*np.pi*np.cumsum(f)/SR)*0.25; nz=bp(rng.standard_normal(n),200,4000)*0.3
    return (tone+nz)*(t/dur)**2.2
def boom(dur=3.0):
    n=int(dur*SR); t=np.arange(n)/SR; f=58*np.exp(-t*1.2)+32
    sub=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.9)
    hit=lp(rng.standard_normal(n),900)*np.exp(-t/0.06)*1.2
    tail=bp(rng.standard_normal(n),120,2500)*np.exp(-t/0.7)*0.15
    return 0.9*sub+hit+tail
def thread(dur=0.8):
    out=np.zeros(int(dur*SR))
    for k in range(int(dur*14)):
        c=click()*0.35; i=int(k/14*SR); out[i:i+len(c)]+=c[:len(out)-i]
    return out
import soundfile as sf
def load(path,gain_db=0.0):
    x,sr=sf.read(path,always_2d=True); x=x.mean(axis=1)
    if sr!=SR: x=signal.resample_poly(x,SR,sr)
    return x*10**(gain_db/20)
SFX=cfg.get('sfx_files',{})
LIB={k:(lambda v=v: load(v[0],v[1])) for k,v in SFX.items()}
for k,fn in {'rustle':rustle,'click':click,'whoosh':whoosh,'riser':riser,'boom':boom,'thread':thread}.items(): LIB.setdefault(k,fn)
for t,name in cues:
    s=LIB[name](); i=int(t*SR); mix[i:i+len(s)]+=s[:L-i]
room=lp(rng.standard_normal(L),300)*0.02
if cfg.get('bed'):
    bd=cfg['bed']; x,sr=sf.read(bd['file'],start=int(bd['start']*44100),frames=int((total+2)*44100),always_2d=True); x=x.mean(axis=1)*10**(bd.get('gain_db',-8)/20)
    bed=np.zeros(L); bed[:min(L,len(x))]=x[:L]
    fi=int(0.6*SR); bed[:fi]*=np.linspace(0,1,fi)
    d0=int(bd['drop']*SR); r0=int(bd['resume']*SR)
    fo=int(0.25*SR); bed[d0-fo:d0]*=np.linspace(1,0,fo); bed[d0:r0]=0
    ri=int(1.5*SR); bed[r0:r0+ri]*=np.linspace(0,1,ri); bed[r0:]*=10**(bd.get('after_db',-4)/20)
    mix=mix+bed
gaps=[(g0,g1) for g0,g1 in cfg.get('silence',[])]
for g0,g1 in gaps: room[int(g0*SR):int(g1*SR)]=0; mix[int(g0*SR):int(g1*SR)]*=0
mix=(mix+room)[:int(total*SR)]
fade=int(1.2*SR); mix[-fade:]*=np.linspace(1,0,fade)
mix=mix/np.max(np.abs(mix))*0.9
wav=os.path.splitext(cfg['out'])[0]+'.wav'
import wave
with wave.open(wav,'w') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',VID,'-i',wav,'-af','loudnorm=I=-14:TP=-1','-c:v','copy',
   '-c:a','aac','-b:a','192k','-ac','2','-shortest','-movflags','+faststart',cfg['out']],check=True)
os.remove(wav); os.remove(VID); seg.close(); print(round(total,2), [ (round(t,2),n) for t,n in cues])
