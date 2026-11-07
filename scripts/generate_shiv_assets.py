from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math, random
ROOT=Path("assets/shiv-sweet-marts-diwali")
S=ROOT/"sprites"; H=ROOT/"sheets"
S.mkdir(parents=True,exist_ok=True); H.mkdir(parents=True,exist_ok=True)
GREEN=(144,193,65,255); TEAL=(0,189,204,255); GOLD=(239,177,57,255); CREAM=(255,232,177,255); INK=(16,33,31,255); ORANGE=(226,111,44,255)
def save(name,size,draw):
 im=Image.new("RGBA",size,(0,0,0,0)); d=ImageDraw.Draw(im)
 draw(d,size)
 im=im.filter(ImageFilter.GaussianBlur(0.25)); im.save(S/(name+".png"),optimize=True)
def sweet(d,cx,cy,r,color):
 d.ellipse((cx-r+5,cy-r+8,cx+r+5,cy+r+8),fill=(0,0,0,35))
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=color,outline=(135,78,35,255),width=max(2,r//12))
 d.ellipse((cx-r*.55,cy-r*.58,cx+r*.5,cy+r*.22),fill=(255,255,230,95))
 d.ellipse((cx-r*.18,cy-r*.18,cx+r*.18,cy+r*.18),fill=GOLD)
def diya(d,cx,cy,s):
 d.ellipse((cx-s,cy-s*.28,cx+s,cy+s*.55),fill=ORANGE,outline=GOLD,width=5)
 d.polygon([(cx-s*.35,cy-s*.08),(cx,cy-s*1.2),(cx+s*.35,cy-s*.08)],fill=GOLD)
 d.ellipse((cx-s*.16,cy-s*.72,cx+s*.16,cy-s*.28),fill=CREAM)
def petals(d,cx,cy,r):
 for i in range(12):
  a=math.pi*2*i/12; x=cx+math.cos(a)*r*.56; y=cy+math.sin(a)*r*.56
  d.ellipse((x-r*.28,y-r*.18,x+r*.28,y+r*.18),fill=GOLD)
 d.ellipse((cx-r*.22,cy-r*.22,cx+r*.22,cy+r*.22),fill=ORANGE)
save("pedha-single",(220,180),lambda d,s:sweet(d,110,88,65,(192,127,64,255)))
save("barfi-single",(220,180),lambda d,s:(d.polygon([(110,15),(200,90),(110,165),(20,90)],fill=(244,218,157,255),outline=GOLD),d.line((60,90,110,48,160,90,110,132,60,90),fill=(255,255,235,255),width=7)))
def six(d,s):
 for y in (48,125):
  for x in (48,110,172): sweet(d,x,y,27,(190,125,65,255))
save("pedha-cluster-six",(220,180),six)
def trio(d,s):
 for x,y in [(70,55),(150,55),(110,130)]:
  d.polygon([(x,y-35),(x+38,y),(x,y+35),(x-38,y)],fill=(244,218,157,255),outline=GOLD)
  d.line((x-18,y,x,y-18,x+18,y),fill=(255,255,240,255),width=4)
save("barfi-trio",(220,180),trio)
save("diya-single",(190,180),lambda d,s:diya(d,95,118,70))
save("diya-pair",(260,170),lambda d,s:(diya(d,75,115,58),diya(d,185,115,58)))
save("rangoli-motif",(220,190),lambda d,s:(petals(d,110,95,85),d.ellipse((70,55,150,135),outline=TEAL,width=7),d.ellipse((88,73,132,117),fill=GREEN)))
def marigold(d,s):
 for x,y in [(55,65),(110,50),(165,70),(85,120),(145,125)]: petals(d,x,y,34)
save("marigold-cluster",(240,180),marigold)
save("marigold-corner",(260,170),marigold)
def toran(d,s):
 d.arc((12,0,228,180),0,180,fill=GREEN,width=12)
 for x in range(25,225,28):
  d.ellipse((x-10,80,x+10,100),fill=GOLD); d.polygon([(x-8,96),(x+8,96),(x,132)],fill=ORANGE)
save("toran-segment",(240,150),toran)
def box(d,s):
 d.rounded_rectangle((22,55,218,165),radius=16,fill=TEAL,outline=GOLD,width=7)
 d.polygon([(22,55),(120,12),(218,55),(120,95)],fill=GREEN,outline=GOLD)
 d.rectangle((105,56,135,165),fill=GOLD); d.ellipse((85,5,120,48),outline=GOLD,width=9); d.ellipse((120,5,155,48),outline=GOLD,width=9)
save("sweet-gift-box",(240,190),box)
save("sweet-box-lid",(240,160),lambda d,s:d.polygon([(15,65),(120,12),(225,65),(120,120)],fill=GREEN,outline=GOLD))
save("sweet-box-base",(240,150),lambda d,s:d.rounded_rectangle((25,20,215,135),radius=15,fill=TEAL,outline=GOLD,width=8))
save("paper-burst",(230,150),lambda d,s:d.polygon([(115,0),(140,48),(220,25),(175,75),(230,110),(155,112),(115,150),(85,105),(0,115),(55,72),(20,30),(90,48)],fill=GOLD))
# hero composition
im=Image.new("RGBA",(760,980),(0,0,0,0)); d=ImageDraw.Draw(im)
d.ellipse((45,825,715,955),fill=(0,0,0,45))
d.rounded_rectangle((70,390,690,850),radius=48,fill=TEAL,outline=GOLD,width=14)
d.polygon([(70,390),(380,230),(690,390),(380,550)],fill=GREEN,outline=GOLD)
d.polygon([(70,390),(380,550),(690,390),(690,485),(380,650),(70,485)],fill=(57,135,112,255))
d.rectangle((350,390,410,850),fill=GOLD)
d.ellipse((275,230,390,345),outline=GOLD,width=18); d.ellipse((370,230,485,345),outline=GOLD,width=18)
for x,y,r in [(230,575,65),(380,650,65),(530,575,65),(230,735,65),(380,760,65),(530,735,65)]: sweet(d,x,y,r,(194,129,66,255))
diya(d,115,880,62); diya(d,645,880,62); petals(d,380,135,80)
im.save(H/"hero-1.png",optimize=True)
