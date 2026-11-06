import React from "react";
import {
  AbsoluteFill, Composition, Img, Sequence, interpolate,
  registerRoot, staticFile, useCurrentFrame
} from "raea";

const W = 1080, H = 1920, FPS = 30;
const C = { ink: "#080D12", cream: "#F4EFE6", amber: "#F4B544", red: "#D85B45", teal: "#7FB9A8", muted: "#AAB3B7" };

function clamp(v:number, a:number, b:number) { return Math.max(a, Math.min(b, v)); }
function Scene({ index, title, kicker, body, image, accent=C.amber, children }:any) {
  const f = useCurrentFrame();
  const enter = interpolate(f,[0,22],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const drift = interpolate(f,[0,180],[1.04,1.16],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const pan = interpolate(f,[0,180],[0,-34],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <AbsoluteFill style={{background:C.ink,color:C.cream,fontFamily:"Arial, sans-serif",overflow:"hidden"}}>
    <AbsoluteFill style={{opacity:0.23}}>
      <Img src={staticFile(image)} style={{width:"100%",height:"100%",objectFit:"cover",transform:`translateY(${pan}px) scale(${drift})`}} />
    </AbsoluteFill>
    <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(4,8,12,.18) 0%,rgba(4,8,12,.28) 30%,rgba(4,8,12,.94) 75%,#080D12 100%)"}}/>
    <div style={{position:"absolute",left:72,right:72,top:250,display:"flex",justifyContent:"space-between",fontSize:23,letterSpacing:5,color:C.muted}}>
      <span>INDIA / 2026</span><span>FIELD NOTES　{String(index).padStart(2,"0")}</span>
    </div>
    <div style={{position:"absolute",left:72,right:72,top:430,opacity:enter,transform:`translateY(${(1-enter)*42}px)`}}>
      <div style={{fontSize:24,letterSpacing:7,color:accent,fontWeight:700,marginBottom:34}}>{kicker.toUpperCase()}</div>
      <div style={{fontSize:92,lineHeight:0.99,fontWeight:800,letterSpacing:-3,maxWidth:900}}>{title}</div>
      <div style={{width:112,height:7,background:accent,marginTop:42,marginBottom:34}}/>
      <div style={{fontSize:34,lineHeight:1.42,color:"#E0E1DC",maxWidth:850}}>{body}</div>
    </div>
    {children}
    <div style={{position:"absolute",bottom:480,left:72,right:72,height:3,background:"rgba(255,255,255,.22)"}}>
      <div style={{height:3,width:`${clamp((f/180)*100,0,100)}%`,background:accent}}/>
    </div>
    <div style={{position:"absolute",bottom:430,left:72,fontSize:18,letterSpacing:4,color:"#929B9E"}}>POVERTY IS NOT A LACK OF AMBITION.</div>
  </AbsoluteFill>;
}
function DataBars() {
 const f=useCurrentFrame();
 const vals=[.92,.72,.58,.42,.28];
 return <div style={{position:"absolute",left:74,right:74,bottom:250,display:"flex",gap:18,alignItems:"end",height:260}}>
 {vals.map((v,i)=><div key={i} style={{flex:1,height:`${v*100}%`,background:i===0?C.amber:"rgba(244,239,230,.72)",transform:`scaleY(${interpolate(f,[12+i*8,55+i*8],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})})`,transformOrigin:"bottom",borderTop:"5px solid "+(i===0?C.red:C.cream)}}/>)}
 </div>;
}
function NumberBeat({value,label}) {
 const f=useCurrentFrame(); const n=Math.round(interpolate(f,[8,70],[0,value],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
 return <div style={{position:"absolute",left:72,bottom:280,color:C.cream}}>
 <div style={{fontSize:150,fontWeight:900,letterSpacing:-8,color:C.amber}}>{n.toLocaleString("en-IN")}</div>
 <div style={{fontSize:28,letterSpacing:3,maxWidth:800,lineHeight:1.4}}>{label}</div>
 </div>;
}
function Opening(){return <Scene index={1} kicker="A documentary on access" title={<>THE OTHER<br/>SIDE OF INDIA.</>} body="India moves forward. Millions still wait for basic services and opportunity." image="poverty/dharavi-aerial.jpg" accent={C.amber}/>;}
function Divide(){return <Scene index={2} kicker="The urban divide" title={<>ONE CITY.<br/>TWO REALITIES.</>} body="Glass towers stand beside crowded settlements. Access shapes opportunity." image="poverty/dharavi-street.jpg" accent={C.red}/>;}
function Work(){return <Scene index={3} kicker="Work and income" title={<>A DAY'S WORK.<br/>AN UNCERTAIN TOMORROW.</>} body="For informal workers, one missed day can erase income. Hard work does not ensure security." image="poverty/vendor.jpg" accent={C.amber}/>;}
function Rural(){return <Scene index={4} kicker="Rural livelihoods" title={<>WHEN THE HARVEST<br/>IS NOT ENOUGH.</>} body="Small farms face changing weather, rising costs and uncertain markets." image="poverty/farmer.jpg" accent={C.teal}/>;}
function Water(){return <Scene index={5} kicker="Basic services" title={<>TIME SPENT<br/>FINDING WATER.</>} body="When water is far away, families lose time, health and opportunity." image="poverty/water.jpg" accent={C.teal}/>;}
function School(){return <Scene index={6} kicker="Education" title={<>TALENT IS EVERYWHERE.<br/>ACCESS IS NOT.</>} body="A child's future depends on classrooms, safe travel and time to learn." image="poverty/classroom.jpg" accent={C.amber}/>;}
function Systems(){return <Scene index={7} kicker="The structure" title={<>POVERTY IS NOT<br/>ONE PROBLEM.</>} body="Housing, health, education and work are linked. One gap can deepen another." image="poverty/dharavi-aerial.jpg" accent={C.red}><DataBars/></Scene>;}
function Change(){return <Scene index={8} kicker="What changes the equation" title={<>MAKE THE BASICS<br/>RELIABLE.</>} body="Reliable services, decent work, resilient farms and affordable housing create change." image="poverty/classroom.jpg" accent={C.teal}/>;}
function End(){return <Scene index={9} kicker="The measure of progress" title={<>PROGRESS MEANS<br/>NO ONE LEFT<br/>WAITING.</>} body="India moves forward when dignity and opportunity reach every home." image="poverty/dharavi-aerial.jpg" accent={C.amber}/>;}

function Film(){
 return <AbsoluteFill style={{background:C.ink}}>
  <Sequence from={0} durationInFrames={150}><Opening/></Sequence>
  <Sequence from={150} durationInFrames={150}><Divide/></Sequence>
  <Sequence from={300} durationInFrames={150}><Work/></Sequence>
  <Sequence from={450} durationInFrames={150}><Rural/></Sequence>
  <Sequence from={600} durationInFrames={150}><Water/></Sequence>
  <Sequence from={750} durationInFrames={150}><School/></Sequence>
  <Sequence from={900} durationInFrames={150}><Systems/></Sequence>
  <Sequence from={1050} durationInFrames={150}><Change/></Sequence>
  <Sequence from={1200} durationInFrames={150}><End/></Sequence>
 </AbsoluteFill>;
}
registerRoot(() => <Composition id="poverty-in-india-raea" component={Film} width={W} height={H} fps={FPS} durationInFrames={1350}/>);
