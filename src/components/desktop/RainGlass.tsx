import {useEffect,useRef} from 'react';
import {RainRefraction} from './rain-refraction';

type Bead={x:number;y:number;r:number;speed:number;trail:number;phase:number};
type Wipe={x:number;y:number;toX:number;toY:number;age:number};
const TAU=Math.PI*2;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** A live glass surface. Pointer listeners leave notes, controls and scrolling alone. */
export function RainGlass({density,wind,size,refraction,pinned,speed,wallpaper}:{density:number;wind:number;size:number;refraction:number;pinned:boolean;speed:number;wallpaper:string}){
 const ref=useRef<HTMLCanvasElement>(null),lens=useRef<HTMLCanvasElement>(null),renderer=useRef<RainRefraction|null>(null),settings=useRef({density,wind,size,refraction,pinned,speed,wallpaper});settings.current={density,wind,size,refraction,pinned,speed,wallpaper};
 const redraw=useRef<()=>void>(()=>{});
 useEffect(()=>{redraw.current()},[density,wind,size,refraction,pinned,speed]);
 useEffect(()=>{
  const canvas=ref.current,context=canvas?.getContext('2d');if(!canvas||!context)return;
  const heightmap=document.createElement('canvas'),water=heightmap.getContext('2d'),micro=document.createElement('canvas'),microWater=micro.getContext('2d');
  if(!water||!microWater||!lens.current)return;
  renderer.current=new RainRefraction(lens.current,()=>redraw.current());renderer.current.setImage(settings.current.wallpaper);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,frame=0,last=0,time=0,microKey='',pressed=false;
  let pointer:{x:number;y:number}|null=null;
  const beads:Bead[]=[],wipes:Wipe[]=[];
  const mobile=matchMedia('(max-width:760px)').matches;
  const beadLimit=mobile?85:145;
  function resetBead(bead:Bead,anywhere=false){
   bead.x=Math.random()*width;bead.y=anywhere?Math.random()*height:-25;
   bead.r=1.8+Math.pow(Math.random(),2)*8;bead.speed=2+Math.random()*18;
   bead.trail=0;bead.phase=Math.random()*TAU;
  }
  function resize(){
   const oldWidth=width,oldHeight=height;width=window.innerWidth;height=window.innerHeight;
   const scale=Math.min(devicePixelRatio||1,2,4096/Math.max(width,height));canvas!.width=Math.round(width*scale);canvas!.height=Math.round(height*scale);context!.setTransform(scale,0,0,scale,0,0);
   const maskScale=Math.min(devicePixelRatio||1,2,4096/Math.max(width,height));heightmap.width=Math.round(width*maskScale);heightmap.height=Math.round(height*maskScale);water!.setTransform(maskScale,0,0,maskScale,0,0);
   if(!beads.length){for(let i=0;i<beadLimit;i++){const bead={} as Bead;resetBead(bead,true);beads.push(bead)}}
   else{for(const b of beads){b.x=b.x/oldWidth*width;b.y=b.y/oldHeight*height}}
   paint(0);
  }
  function buildMicroWater(){
   const key=`${heightmap.width}:${heightmap.height}:${settings.current.density}:${settings.current.size}`;if(key===microKey)return;microKey=key;
   micro.width=heightmap.width;micro.height=heightmap.height;const scale=micro.width/width;microWater!.setTransform(scale,0,0,scale,0,0);
   const count=Math.round(Math.min(1700,width*height/950)*settings.current.density);
   const patches=Array.from({length:18},()=>({x:Math.random()*width,y:Math.random()*height}));
   for(let i=0;i<count;i++){const patch=patches[i%patches.length];const x=i%3?patch.x+(Math.random()-.5)*width*.35:Math.random()*width,y=i%3?patch.y+(Math.random()-.5)*height*.4:Math.random()*height,r=(.65+Math.random()*2)*( .7+settings.current.size*.7);
    const cap=microWater!.createRadialGradient(x,y,0,x,y,r);cap.addColorStop(0,'#aaa');cap.addColorStop(.55,'#777');cap.addColorStop(1,'black');microWater!.fillStyle=cap;microWater!.beginPath();microWater!.ellipse(x,y,r,r*1.1,0,0,TAU);microWater!.fill();
   }
  }
  function background(event:PointerEvent){return !(event.target instanceof Element)||!event.target.closest('button,a,input,textarea,select,label,[role="dialog"],.paper-note,.desktop-panel-overlay')}
  function down(event:PointerEvent){if(!background(event)||reduced.matches||event.button!==0)return;pressed=true;pointer={x:event.clientX,y:event.clientY}}
  function move(event:PointerEvent){
   if(reduced.matches||!background(event)){pressed=false;pointer=null;return}
   const point={x:event.clientX,y:event.clientY};
   if(pointer){const distance=Math.hypot(point.x-pointer.x,point.y-pointer.y);
    if(pressed&&distance>2){wipes.push({x:pointer.x,y:pointer.y,toX:point.x,toY:point.y,age:0});if(wipes.length>65)wipes.shift();for(const b of beads)if(Math.hypot(b.x-point.x,b.y-point.y)<43)b.y=height+30;}
   }
   pointer=point;
  }
  function up(){pressed=false;pointer=null}
  function paint(dt:number){
   const ctx=context!;const amount=clamp(settings.current.density,0,1),breeze=clamp(settings.current.wind,0,1),slant=.06+breeze*.24;
   time+=dt;ctx.clearRect(0,0,width,height);water!.clearRect(0,0,width,height);water!.globalCompositeOperation='lighten';buildMicroWater();water!.drawImage(micro,0,0,micro.width,micro.height,0,0,width,height);
   if(dt&&!settings.current.pinned)for(let i=0;i<Math.round(beadLimit*amount);i++){
    const b=beads[i];if(b.trail<2)continue;
    for(let j=0;j<i;j++){const other=beads[j];if(Math.hypot(b.x-other.x,(b.y-other.y)/1.2)<(b.r+other.r)*(.65+settings.current.size*2.2)*.65){b.r=Math.min(12,Math.sqrt(b.r*b.r+other.r*other.r));b.speed=Math.min(38,b.speed+other.r);resetBead(other);break}}
   }
   for(let i=0;i<Math.round(beadLimit*amount);i++){
    const b=beads[i];const radius=b.r*(.65+settings.current.size*2.2);const rolling=!settings.current.pinned&&b.r>4.8&&Math.sin(time*.65+b.phase)>.25;
    if(dt){const fall=settings.current.pinned?0:(rolling?b.speed*(1.2+amount):b.speed*.07)*settings.current.speed*3*dt;b.y+=fall;b.x+=rolling?fall*slant*.17:0;b.trail=rolling?Math.min(85,b.trail+fall):Math.max(0,b.trail-dt*10);if(b.y>height+25)resetBead(b,settings.current.pinned)}
    if(b.trail>1){water!.save();water!.lineCap='round';water!.beginPath();water!.moveTo(b.x-Math.sin(b.phase)*2,b.y-b.trail);water!.quadraticCurveTo(b.x-2,b.y-b.trail*.4,b.x,b.y);const trail=water!.createLinearGradient(b.x,b.y-b.trail,b.x,b.y);trail.addColorStop(0,'#000');trail.addColorStop(1,'#555');water!.strokeStyle=trail;water!.lineWidth=Math.max(1,radius*.28);water!.stroke();water!.restore()}
    water!.save();water!.translate(b.x,b.y);water!.rotate(Math.sin(b.phase)*.12);water!.scale(1+.08*Math.sin(b.phase),1.12+(rolling?.24:.07)+.06*Math.cos(b.phase));const bulb=water!.createRadialGradient(0,0,0,0,0,radius);for(let stop=0;stop<=16;stop++){const t=stop/16;const cap=Math.round(Math.sqrt(Math.max(0,1-t*t))*235);bulb.addColorStop(t,`rgb(${cap},${cap},${cap})`)}water!.fillStyle=bulb;water!.beginPath();water!.arc(0,0,radius,0,TAU);water!.fill();water!.restore();
    if(!renderer.current?.active){
     // A restrained fallback while the photo is loading or WebGL is unavailable.
     ctx.save();ctx.translate(b.x,b.y);ctx.scale(1,1.18);
     const glass=ctx.createRadialGradient(-radius*.2,-radius*.3,0,0,0,radius);
     glass.addColorStop(0,'rgba(242,251,250,.09)');glass.addColorStop(.75,'rgba(12,26,25,.06)');glass.addColorStop(1,'rgba(12,26,25,0)');
     ctx.fillStyle=glass;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();
     ctx.beginPath();ctx.ellipse(-radius*.24,-radius*.4,radius*.28,radius*.1,-.4,Math.PI,TAU);ctx.strokeStyle='rgba(242,251,250,.24)';ctx.lineWidth=.65;ctx.stroke();ctx.restore();
    }
   }
   // A finger or held mouse clears a narrow path; water slowly returns to it.
   ctx.save();ctx.globalCompositeOperation='destination-out';ctx.lineCap='round';ctx.strokeStyle='#000';
   for(let i=wipes.length-1;i>=0;i--){const w=wipes[i];w.age+=dt;if(w.age>5){wipes.splice(i,1);continue}ctx.globalAlpha=(1-w.age/5)*.94;ctx.lineWidth=76;ctx.beginPath();ctx.moveTo(w.x,w.y);ctx.lineTo(w.toX,w.toY);ctx.stroke()}
   ctx.restore();
   water!.save();water!.globalCompositeOperation='source-over';water!.strokeStyle='#00ff00';water!.lineCap='round';water!.lineWidth=76;for(const w of wipes){water!.globalAlpha=(1-w.age/5)*.94;water!.beginPath();water!.moveTo(w.x,w.y);water!.lineTo(w.toX,w.toY);water!.stroke()}water!.restore();
   renderer.current?.draw(heightmap,width,height,settings.current.refraction);


  }
  function draw(now:number){frame=0;if(document.hidden||reduced.matches)return;if(now-last>=33){const dt=last?Math.min(.06,(now-last)/1000):1/30;last=now;paint(dt)}frame=requestAnimationFrame(draw)}
  function resume(){cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);else paint(0)}
  redraw.current=()=>paint(0);
  resize();resume();window.addEventListener('resize',resize);window.addEventListener('pointerdown',down,{passive:true});window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up,{passive:true});window.addEventListener('pointercancel',up,{passive:true});window.addEventListener('blur',up);document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{renderer.current?.destroy();renderer.current=null;redraw.current=()=>{};cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume)};
 },[]);
 useEffect(()=>{renderer.current?.setImage(wallpaper)},[wallpaper]);
 return <div className="rain-glass" aria-hidden="true"><canvas className="rain-refraction" ref={lens}/><canvas className="rain-surface" ref={ref}/></div>;
}
