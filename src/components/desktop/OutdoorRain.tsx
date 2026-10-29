import {useEffect,useRef} from 'react';
import type {CSSProperties} from 'react';

type Drop={x:number;y:number;speed:number;length:number;width:number;phase:number};
const layers=[
 {count:850,speed:260,length:13,width:.7,opacity:.28,scale:.85},
 {count:420,speed:560,length:29,width:1.05,opacity:.38,scale:1.25},
 {count:100,speed:1040,length:56,width:1.7,opacity:.45,scale:1.5},
];

/** Rain in the outdoor scene, separate from the water attached to the glass. */
export function OutdoorRain({intensity,wind}:{intensity:number;wind:number}){
 const root=useRef<HTMLDivElement>(null),settings=useRef({intensity,wind});settings.current={intensity,wind};
 useEffect(()=>{
  const canvases=Array.from(root.current?.querySelectorAll('canvas')??[]);
  const contexts=canvases.map(canvas=>canvas.getContext('2d'));
  if(contexts.length!==3||contexts.some(context=>!context))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,frame=0,last=0,time=0;
  const pools:Drop[][]=[[],[],[]],scales:number[]=[];
  // Small cached tapered exposures avoid a gradient allocation for every rain line.
  const sprite=document.createElement('canvas');sprite.width=12;sprite.height=128;
  const ink=sprite.getContext('2d');if(!ink)return;
  const exposure=ink.createLinearGradient(0,0,0,128);
  exposure.addColorStop(0,'rgba(207,225,230,0)');exposure.addColorStop(.3,'rgba(207,225,230,.28)');exposure.addColorStop(.82,'rgba(225,239,241,.92)');exposure.addColorStop(1,'rgba(225,239,241,.12)');
  ink.fillStyle=exposure;ink.beginPath();ink.moveTo(5,0);ink.lineTo(7,0);ink.quadraticCurveTo(11,82,8,124);ink.quadraticCurveTo(6,132,4,124);ink.quadraticCurveTo(1,82,5,0);ink.fill();
  function reset(drop:Drop,layer:number,anywhere=false){
   const spec=layers[layer];drop.x=Math.random()*(width+height*.85)-height*.7;drop.y=anywhere?Math.random()*height:-Math.random()*height*.3-80;
   drop.speed=spec.speed*(.72+Math.random()*.56);drop.length=spec.length*(.65+Math.random()*.75);drop.width=spec.width*(.7+Math.random()*.65);drop.phase=Math.random()*Math.PI*2;
  }
  function paint(dt:number){
   time+=dt;const amount=Math.max(0,Math.min(1,settings.current.intensity)),breeze=Math.max(0,Math.min(1,settings.current.wind));
   const gust=Math.sin(time*.38)*.15+Math.sin(time*.17+1.3)*.1;
   const slope=.1+breeze*(.55+gust),surge=.88+Math.sin(time*.27)*.12;
   contexts.forEach((context,index)=>{
    const ctx=context!,scale=scales[index],spec=layers[index];ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    const count=Math.round(pools[index].length*amount*(.88+surge*.12));
    for(let i=0;i<count;i++){
     const drop=pools[index][i],localSlope=slope+Math.sin(drop.phase+time*.35)*breeze*.06;
     const distance=drop.speed*(.7+amount*.65)*dt;drop.y+=distance;drop.x+=distance*localSlope;
     if(drop.y>height+drop.length||drop.x>width+100)reset(drop,index);
     const angle=-Math.atan(localSlope),c=Math.cos(angle),s=Math.sin(angle);
     const curtain=.78+Math.sin(drop.x/width*7+time*.5+drop.phase)*.22;
     ctx.globalAlpha=spec.opacity*(.6+amount*.4)*curtain;
     ctx.setTransform(scale*c,scale*s,-scale*s,scale*c,drop.x*scale,drop.y*scale);
     const length=drop.length*(.72+amount*.5);
     ctx.drawImage(sprite,-drop.width/2,-length,drop.width,length);
    }
    ctx.globalAlpha=1;ctx.setTransform(scale,0,0,scale,0,0);
   });
  }
  function resize(){
   width=innerWidth;height=innerHeight;const area=Math.max(.4,Math.min(1.8,width*height/(1920*1080)));
   canvases.forEach((canvas,index)=>{
    const scale=Math.min(devicePixelRatio||1,layers[index].scale,4096/Math.max(width,height));scales[index]=scale;
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    pools[index]=Array.from({length:Math.round(layers[index].count*area)},()=>{const drop={}as Drop;reset(drop,index,true);return drop});
   });paint(0);
  }
  function tick(now:number){
   frame=0;if(document.hidden||reduced.matches)return;
   if(!last||now-last>=32){paint(last?Math.min(.07,(now-last)/1000):0);last=now}
   frame=requestAnimationFrame(tick);
  }
  function resume(){cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);else paint(0)}
  resize();resume();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume)};
 },[]);
 return <div ref={root} className="outdoor-rain" aria-hidden="true" style={{'--rain-strength':intensity,'--rain-wind':wind}as CSSProperties}>
  <div className="outdoor-rain-haze"/><canvas className="outdoor-rain-far"/><canvas className="outdoor-rain-middle"/><canvas className="outdoor-rain-near"/>
 </div>;
}
