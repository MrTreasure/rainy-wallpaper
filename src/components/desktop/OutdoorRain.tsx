import {useEffect,useRef} from 'react';
import type {CSSProperties} from 'react';
import {OutdoorRainGL} from './outdoor-rain-gl';
import {renderBudget,subscribeWeather} from '@/services/render-loop';
/** GPU rain, with a bounded low-rate fallback if hardware acceleration is absent. */
export function OutdoorRain({intensity,wind}:{intensity:number;wind:number}){
 const gpuCanvas=useRef<HTMLCanvasElement>(null),fallbackCanvas=useRef<HTMLCanvasElement>(null),settings=useRef({intensity,wind});settings.current={intensity,wind};
 const redraw=useRef<()=>void>(()=>{});useEffect(()=>redraw.current(),[intensity,wind]);
 useEffect(()=>{
  const canvas=gpuCanvas.current,fallback=fallbackCanvas.current;if(!canvas||!fallback)return;const gpu=new OutdoorRainGL(canvas);
  let ctx:CanvasRenderingContext2D|null=null,width=0,height=0,elapsed=0;const count=renderBudget().modest?100:180,pool=new Float32Array(count*4);
  function draw(dt:number,time:number,force=false){
   if(gpu.draw(time,settings.current.intensity,settings.current.wind)){if(fallback!.width!==1){fallback!.width=1;fallback!.height=1}return}
   elapsed+=dt;if(!force&&elapsed<1/15)return;const delta=Math.min(.1,elapsed);elapsed=0;
   if(!ctx)ctx=fallback!.getContext('2d');if(!ctx)return;
   if(width!==innerWidth||height!==innerHeight){width=innerWidth;height=innerHeight;const scale=Math.min(.75,renderBudget().scale,Math.sqrt(750000/(width*height)));fallback!.width=Math.round(width*scale);fallback!.height=Math.round(height*scale);for(let i=0;i<pool.length;i+=4){pool[i]=Math.random()*width;pool[i+1]=Math.random()*height;pool[i+2]=260+Math.random()*700;pool[i+3]=10+Math.random()*35}}
   const scale=fallback!.width/width;ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);ctx.strokeStyle='rgba(211,233,240,.25)';ctx.lineWidth=1;ctx.beginPath();const slope=.1+settings.current.wind*.55;
   for(let i=0;i<Math.floor(count*settings.current.intensity)*4;i+=4){pool[i]+=pool[i+2]*delta*slope;pool[i+1]+=pool[i+2]*delta;if(pool[i+1]>height+60||pool[i]>width+60){pool[i]=Math.random()*width;pool[i+1]=-60}ctx.moveTo(pool[i],pool[i+1]);ctx.lineTo(pool[i]-pool[i+3]*slope,pool[i+1]-pool[i+3])}ctx.stroke();
  }
  let time=0;redraw.current=()=>draw(0,time,true);draw(0,time,true);const stop=subscribeWeather((dt,t)=>{time=t;draw(dt,t)},()=>draw(0,time,true));const resize=()=>draw(0,time,true);window.addEventListener('resize',resize);
  return()=>{stop();redraw.current=()=>{};window.removeEventListener('resize',resize);gpu.destroy();fallback.width=1;fallback.height=1};
 },[]);
 return <div className="outdoor-rain" aria-hidden="true" style={{'--rain-strength':intensity,'--rain-wind':wind}as CSSProperties}><div className="outdoor-rain-haze"/><canvas className="outdoor-rain-gpu" ref={gpuCanvas}/><canvas className="outdoor-rain-fallback" ref={fallbackCanvas}/></div>;
}
