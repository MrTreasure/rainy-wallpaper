import {renderBudget} from '@/services/render-loop';
import {program,weatherContext} from './weather-gl';
const vertex=`
 attribute vec2 local;attribute vec2 seed;attribute vec4 spec;attribute float rank;
 uniform vec2 screen;uniform float time;uniform float intensity;uniform float wind;
 varying vec2 p;varying float alpha;varying float focus;
 void main(){p=local;float gust=sin(time*.38)*.15+sin(time*.17+1.3)*.1;
 float slope=.1+wind*(.55+gust)+sin(spec.w+time*.35)*wind*.06;
 float y=mod(seed.y*(screen.y+160.)+time*spec.x*(.7+intensity*.65),screen.y+160.)-80.;
 float x=mod(seed.x*(screen.x+screen.y*.9)+(y+80.)*slope,screen.x+screen.y*.9)-screen.y*.7;
 float length=spec.y*(.72+intensity*.5);vec2 point=vec2(x,y)+vec2(local.x*spec.z*.5+local.y*length*.5*slope,local.y*length*.5);
 focus=spec.y/56.;float curtain=.78+sin(x/screen.x*7.+time*.5+spec.w)*.22;
 alpha=mix(.28,.45,clamp(focus,0.,1.))*(.6+intensity*.4)*curtain;
 gl_Position=rank>intensity?vec4(2.,2.,0.,1.):vec4(point.x/screen.x*2.-1.,1.-point.y/screen.y*2.,0.,1.);}`;
const fragment=`precision mediump float;varying vec2 p;varying float alpha;varying float focus;
 void main(){float edge=1.-smoothstep(mix(.0,.4,focus),1.,abs(p.x));float t=(p.y+1.)*.5;
 float exposure=smoothstep(0.,.65,t)*(1.-smoothstep(.85,1.,t));
 gl_FragColor=vec4(.83,.91,.94,edge*exposure*alpha);}`;
const corners=[-1,-1,1,-1,-1,1,-1,1,1,-1,1,1];
/** Static seeds uploaded once. Falling positions are calculated by the vertex shader. */
export class OutdoorRainGL{
 private gl:WebGLRenderingContext|null;private shader:WebGLProgram|null=null;private buffer:WebGLBuffer|null=null;
 private attributes:number[]=[];private uniforms:Record<string,WebGLUniformLocation|null>={};private count=0;private width=0;private height=0;
 private lost=(event:Event)=>event.preventDefault();private restored=()=>{this.shader=null;this.buffer=null;this.width=0;try{this.initialize()}catch{this.shader=null}};
 get active(){return !!this.shader&&!this.gl?.isContextLost()}
 constructor(private canvas:HTMLCanvasElement){this.gl=weatherContext(canvas);try{this.initialize()}catch{this.destroyBuffers()}canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored)}
 private initialize(){const gl=this.gl;if(!gl)return;this.shader=program(gl,vertex,fragment);this.buffer=gl.createBuffer();this.attributes=['local','seed','spec','rank'].map(name=>gl.getAttribLocation(this.shader!,name));for(const name of ['screen','time','intensity','wind'])this.uniforms[name]=gl.getUniformLocation(this.shader,name);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0)}
 draw(time:number,intensity:number,wind:number){
  const gl=this.gl;if(!gl||!this.shader||gl.isContextLost())return false;const width=innerWidth,height=innerHeight,budget=renderBudget(width,height);
  if(width!==this.width||height!==this.height){
   this.width=width;this.height=height;this.canvas.width=budget.width;this.canvas.height=budget.height;
   const area=Math.max(.4,Math.min(1.8,width*height/(1920*1080)))*(budget.modest?.7:1),layers=[{count:850,speed:260,length:13,width:.7},{count:420,speed:560,length:29,width:1.05},{count:100,speed:1040,length:56,width:1.7}];
   this.count=layers.reduce((total,layer)=>total+Math.round(layer.count*area),0);const data=new Float32Array(this.count*54);let offset=0;
   for(const layer of layers){const count=Math.round(layer.count*area);for(let i=0;i<count;i++){const x=Math.random(),y=Math.random(),speed=layer.speed*(.72+Math.random()*.56),length=layer.length*(.65+Math.random()*.75),lineWidth=layer.width*(.7+Math.random()*.65),phase=Math.random()*Math.PI*2;for(let c=0;c<12;c+=2){data[offset++]=corners[c];data[offset++]=corners[c+1];data[offset++]=x;data[offset++]=y;data[offset++]=speed;data[offset++]=length;data[offset++]=lineWidth;data[offset++]=phase;data[offset++]=(i+.5)/count}}}
   gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  }
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.shader);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);let offset=0;
  for(let i=0;i<this.attributes.length;i++){const size=i<2?2:i===2?4:1;gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],size,gl.FLOAT,false,36,offset*4);offset+=size}
  gl.uniform2f(this.uniforms.screen,width,height);gl.uniform1f(this.uniforms.time,time);gl.uniform1f(this.uniforms.intensity,Math.max(0,Math.min(1,intensity)));gl.uniform1f(this.uniforms.wind,Math.max(0,Math.min(1,wind)));gl.drawArrays(gl.TRIANGLES,0,this.count*6);return true;
 }
 private destroyBuffers(){if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.shader)}this.shader=null;this.buffer=null}
 destroy(){this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);this.destroyBuffers();this.gl?.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1}
}
