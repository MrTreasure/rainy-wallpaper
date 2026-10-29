/** One bounded RAF for weather. No catch-up frames after losing focus. */
type Subscriber={paint:(delta:number,time:number)=>void;staticPaint:()=>void};
const subscribers=new Set<Subscriber>();let frame=0,listening=false,keepAlive=false,focused=true,clock=0,lastTick=0;
let motion:MediaQueryList|undefined;const reduced=()=>motion??=matchMedia('(prefers-reduced-motion: reduce)');
export function animationsActive(){return focused&&!document.hidden&&document.hasFocus()&&!reduced().matches}
export function renderBudget(width=innerWidth,height=innerHeight){
 const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8;
 const modest=memory<=4||(navigator.hardwareConcurrency??8)<=4||width<=760;
 const maxPixels=modest?1_050_000:2_100_000;
 const scale=Math.min(devicePixelRatio||1,modest?1.25:1.75,Math.sqrt(maxPixels/Math.max(1,width*height)),4096/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale,fps:modest?24:30,modest};
}
function tick(now:number){
 frame=0;if(!animationsActive())return;const interval=1000/renderBudget().fps;
 if(!lastTick||now-lastTick>=interval-.5){
  const delta=lastTick?Math.min(.07,(now-lastTick)/1000):0;clock+=delta;lastTick=now;
  for(const subscriber of subscribers)subscriber.paint(delta,clock);
 }
 if(subscribers.size)frame=requestAnimationFrame(tick);
}
function refresh(){
 cancelAnimationFrame(frame);frame=0;lastTick=0;
 const active=animationsActive();document.documentElement.dataset.animationPaused=String(!active);
 if(active&&subscribers.size)frame=requestAnimationFrame(tick);
}
const focus=()=>{focused=true;refresh()};const blur=()=>{focused=false;refresh()};
const reduce=()=>{for(const subscriber of subscribers)subscriber.staticPaint();refresh()};
function listen(){if(listening)return;listening=true;window.addEventListener('focus',focus);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',refresh);reduced().addEventListener('change',reduce);refresh()}
export function subscribeWeather(paint:(delta:number,time:number)=>void,staticPaint:()=>void){
 listen();const subscriber={paint,staticPaint};subscribers.add(subscriber);refresh();
 return()=>{subscribers.delete(subscriber);if(!subscribers.size&&!keepAlive){cancelAnimationFrame(frame);frame=0;lastTick=0;window.removeEventListener('focus',focus);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',refresh);reduced().removeEventListener('change',reduce);listening=false}};
}

export function initializeAnimationFocus(){keepAlive=true;listen()}
