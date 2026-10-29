import {useEffect,useRef} from 'react';
import {RainRefraction} from './rain-refraction';
import type {GlassBead,GlassWipe,MicroBead} from './rain-refraction';
import {animationsActive,renderBudget,subscribeWeather} from '@/services/render-loop';
const TAU=Math.PI*2;
/** CPU only simulates a small bead pool. Water geometry and refraction use WebGL. */
export function RainGlass({density,wind,size,refraction,pinned,speed,wallpaper,raining,rainfall}:{density:number;wind:number;size:number;refraction:number;pinned:boolean;speed:number;wallpaper:string;raining:boolean;rainfall:number}){
 const ref=useRef<HTMLCanvasElement>(null),lens=useRef<HTMLCanvasElement>(null),renderer=useRef<RainRefraction|null>(null);
 const settings=useRef({density,wind,size,refraction,pinned,speed,wallpaper,raining,rainfall});settings.current={density,wind,size,refraction,pinned,speed,wallpaper,raining,rainfall};
 const redraw=useRef<()=>void>(()=>{});useEffect(()=>{redraw.current()},[density,wind,size,refraction,pinned,speed,raining,rainfall]);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas||!lens.current)return;
  let width=1,height=1,time=0,pressed=false,dropBudget=0,microBudget=0,mergeClock=0,fallbackClock=0;
  let pointer:{x:number;y:number}|null=null;const beads:GlassBead[]=[],wipes:GlassWipe[]=[],micro:MicroBead[]=[];
  const beadLimit=renderBudget().modest?85:145;let fallback:CanvasRenderingContext2D|null=null,sprite:HTMLCanvasElement|null=null;
  renderer.current=new RainRefraction(lens.current,()=>paint(0,true));
  function reset(bead:GlassBead,active=true){bead.x=Math.random()*width;bead.y=Math.random()*height;bead.r=1.8+Math.random()**2*8;bead.speed=2+Math.random()*18;bead.trail=0;bead.phase=Math.random()*TAU;bead.active=active;bead.age=0}
  for(let i=0;i<beadLimit;i++){const bead={}as GlassBead;reset(bead,false);beads.push(bead)}
  function drawFallback(){
   if(!fallback){fallback=canvas!.getContext('2d');sprite=document.createElement('canvas');sprite.width=64;sprite.height=64;const ink=sprite.getContext('2d');if(ink){const gradient=ink.createRadialGradient(25,22,1,32,32,31);gradient.addColorStop(0,'rgba(242,251,250,.16)');gradient.addColorStop(.75,'rgba(12,26,25,.04)');gradient.addColorStop(.93,'rgba(235,247,246,.22)');gradient.addColorStop(1,'transparent');ink.fillStyle=gradient;ink.fillRect(0,0,64,64)}}
   if(!fallback||!sprite)return;const budget=renderBudget(width,height),scale=Math.min(1,budget.scale,Math.sqrt(750000/(width*height)));const w=Math.round(width*scale),h=Math.round(height*scale);
   if(canvas!.width!==w||canvas!.height!==h){canvas!.width=w;canvas!.height=h}fallback.setTransform(scale,0,0,scale,0,0);fallback.clearRect(0,0,width,height);
   for(let i=0;i<micro.length;i+=3){const p=micro[i],r=p.r*(.7+settings.current.size*.7);fallback.drawImage(sprite,p.x*width-r,p.y*height-r,r*2,r*2.2)}
   for(const b of beads){if(!b.active)continue;const r=b.r*(.65+settings.current.size*2.2)*Math.min(1,b.age/.65);fallback.drawImage(sprite,b.x-r,b.y-r*1.18,r*2,r*2.36)}
   fallback.save();fallback.globalCompositeOperation='destination-out';fallback.lineCap='round';fallback.lineWidth=76;
   for(const wipe of wipes){fallback.globalAlpha=(1-wipe.age/5)*.94;fallback.beginPath();fallback.moveTo(wipe.x,wipe.y);fallback.lineTo(wipe.toX,wipe.toY);fallback.stroke()}fallback.restore();
  }
  function paint(dt:number,force=false){
   const p=settings.current,amount=Math.max(0,Math.min(1,p.density)),wanted=Math.round(beadLimit*amount),target=Math.round(Math.min(1700,width*height/950)*amount);
   let changed=force;time+=dt;mergeClock+=dt;fallbackClock+=dt;
   if(micro.length>target){micro.length=target;changed=true}
   if(p.raining){microBudget+=dt*(40+p.rainfall*160)*amount;dropBudget+=dt*(3+p.rainfall*14)*amount}else{microBudget=0;dropBudget=0}
   while(microBudget>=1&&micro.length<target){microBudget--;micro.push({x:Math.random(),y:Math.random(),r:.65+Math.random()*2});changed=true}if(micro.length>=target)microBudget=0;
   while(dropBudget>=1){dropBudget--;let available:GlassBead|undefined;for(let i=0;i<wanted;i++)if(!beads[i].active){available=beads[i];break}if(available){reset(available);changed=true}else{dropBudget=0;break}}
   for(let i=wanted;i<beads.length;i++)if(beads[i].active){beads[i].active=false;changed=true}
   const merge=mergeClock>=.12;if(merge)mergeClock=0;
   for(let i=0;i<wanted;i++){
    const b=beads[i];if(!b.active)continue;if(b.age<.65)changed=true;b.age+=dt;
    if(!p.pinned&&dt){const rolling=b.r>4.8&&Math.sin(time*.65+b.phase)>.25,fall=(rolling?b.speed*(1.2+amount):b.speed*.07)*p.speed*3*dt;
     b.y+=fall;b.x+=rolling?fall*(.06+p.wind*.24)*.17:0;b.trail=rolling?Math.min(85,b.trail+fall):Math.max(0,b.trail-dt*10);changed=changed||fall>0;
     if(b.y>height+25){if(p.raining)reset(b);else b.active=false}
     if(merge&&b.trail>2)for(let j=0;j<i;j++){const other=beads[j];if(other.active){const dx=b.x-other.x,dy=(b.y-other.y)/1.2,r=(b.r+other.r)*(.65+p.size*2.2)*.65;if(dx*dx+dy*dy<r*r){b.r=Math.min(12,Math.sqrt(b.r*b.r+other.r*other.r));b.speed=Math.min(38,b.speed+other.r);other.active=false;changed=true;break}}}
    }
   }
   for(let i=wipes.length-1;i>=0;i--){wipes[i].age+=dt;if(wipes[i].age>5)wipes.splice(i,1);changed=true}
   if(!changed)return;
   const gpu=renderer.current?.draw(micro,beads,wipes,width,height,p.size,p.refraction,p.pinned,time);
   if(gpu){if(canvas!.width!==1){canvas!.width=1;canvas!.height=1}}
   else if(force||fallbackClock>=1/15){fallbackClock=0;drawFallback()}
  }
  function resize(){const previousWidth=width,previousHeight=height;width=innerWidth;height=innerHeight;for(const b of beads){b.x=b.x/previousWidth*width;b.y=b.y/previousHeight*height}paint(0,true)}
  function background(event:PointerEvent){return !(event.target instanceof Element)||!event.target.closest('button,a,input,textarea,select,label,[role="dialog"],.paper-note,.desktop-panel-overlay')}
  function down(event:PointerEvent){if(!background(event)||!animationsActive()||event.button!==0)return;event.preventDefault();window.getSelection()?.removeAllRanges();pressed=true;pointer={x:event.clientX,y:event.clientY}}
  function move(event:PointerEvent){if(!animationsActive()||!background(event)){up();return}const point={x:event.clientX,y:event.clientY};if(pressed&&pointer&&Math.hypot(point.x-pointer.x,point.y-pointer.y)>2){wipes.push({x:pointer.x,y:pointer.y,toX:point.x,toY:point.y,age:0});if(wipes.length>65)wipes.shift();for(const bead of beads){const dx=bead.x-point.x,dy=bead.y-point.y;if(dx*dx+dy*dy<1849)bead.active=false}}pointer=point}
  function up(){pressed=false;pointer=null}
  redraw.current=()=>paint(0,true);resize();renderer.current.setImage(settings.current.wallpaper);
  const stop=subscribeWeather(dt=>paint(dt),()=>paint(0,true));
  window.addEventListener('resize',resize);window.addEventListener('pointerdown',down,{passive:false});window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up,{passive:true});window.addEventListener('pointercancel',up,{passive:true});window.addEventListener('blur',up);
  return()=>{stop();renderer.current?.destroy();renderer.current=null;redraw.current=()=>{};window.removeEventListener('resize',resize);window.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);canvas.width=1;canvas.height=1;if(sprite){sprite.width=1;sprite.height=1}};
 },[]);
 useEffect(()=>{renderer.current?.setImage(wallpaper)},[wallpaper]);
 return <div className="rain-glass" aria-hidden="true"><canvas className="rain-refraction" ref={lens}/><canvas className="rain-surface" ref={ref}/></div>;
}
