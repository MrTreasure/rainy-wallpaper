import {renderBudget} from '@/services/render-loop';
import {program,texture,weatherContext} from './weather-gl';
export type GlassBead={x:number;y:number;r:number;speed:number;trail:number;phase:number;active:boolean;age:number};
export type MicroBead={x:number;y:number;r:number};
export type GlassWipe={x:number;y:number;toX:number;toY:number;age:number};
const corners=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
const shapeVertex=`
 attribute vec2 local;attribute vec2 center;attribute vec2 radius;
 attribute float rotation;attribute float value;attribute float mode;
 uniform vec2 screen;varying vec2 p;varying vec2 radii;varying float amount;varying float kind;
 void main(){p=local;radii=radius;amount=value;kind=mode;float c=cos(rotation),s=sin(rotation);
 vec2 offset=local*radius;vec2 point=center+vec2(c*offset.x-s*offset.y,s*offset.x+c*offset.y);
 gl_Position=vec4(point.x/screen.x*2.-1.,1.-point.y/screen.y*2.,0.,1.);}`;
const shapeFragment=`precision mediump float;varying vec2 p;varying vec2 radii;varying float amount;varying float kind;
 void main(){if(kind>.5){float end=max(0.,abs(p.x)*radii.x-(radii.x-radii.y));float d=length(vec2(end,p.y*radii.y))/radii.y;
 float alpha=(1.-smoothstep(.86,1.,d))*amount;if(alpha<.001)discard;gl_FragColor=vec4(0.,1.,0.,alpha);}
 else{float d=dot(p,p);if(d>=1.)discard;float h=sqrt(1.-d)*amount;gl_FragColor=vec4(vec3(h),1.);}}`;
const lensVertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const lensFragment=`
 #ifdef GL_FRAGMENT_PRECISION_HIGH
 precision highp float;
 #else
 precision mediump float;
 #endif
 varying vec2 uv;uniform sampler2D photo;uniform sampler2D heightmap;
 uniform vec2 screen;uniform vec2 imageSize;uniform vec2 texel;uniform float strength;
 vec2 cover(vec2 p){vec2 expanded=screen+48.;p=(p*screen+24.)/expanded;float aspect=expanded.x/expanded.y;float source=imageSize.x/imageSize.y;
 if(source>aspect)p.x=(p.x-.5)*aspect/source+.5;else p.y=(p.y-.5)*source/aspect+.5;return p;}
 void main(){vec3 field=texture2D(heightmap,uv).rgb;float h=field.r;float wiped=max(0.,field.g-field.r);if(h<.008&&wiped<.006)discard;
 vec2 gradient=vec2(texture2D(heightmap,uv+vec2(texel.x,0.)).r-texture2D(heightmap,uv-vec2(texel.x,0.)).r,
 texture2D(heightmap,uv+vec2(0.,texel.y)).r-texture2D(heightmap,uv-vec2(0.,texel.y)).r);
 vec3 normal=normalize(vec3(-gradient*5.5,1.));vec3 transmitted=refract(vec3(0.,0.,-1.),normal,1./1.333);
 vec2 bend=transmitted.xy*(18.+strength*125.)/screen;
 vec3 color=texture2D(photo,cover(clamp(uv+bend,vec2(.001),vec2(.999)))).rgb;
 float fresnel=.0204+.9796*pow(1.-normal.z,5.);vec3 reflection=mix(vec3(.12,.18,.18),vec3(.8,.88,.91),smoothstep(-.65,.8,normal.y));
 color=mix(color,reflection,min(.42,fresnel*2.2));vec3 light=normalize(vec3(-.45,.85,1.5));
 float specular=pow(max(dot(normal,normalize(light+vec3(0.,0.,1.))),0.),115.);float slope=smoothstep(.02,.28,length(gradient));
 color=color*(1.-slope*.13)+vec3(.94,.98,1.)*specular*slope*.6;
 float meniscus=smoothstep(.01,.07,h)*(1.-smoothstep(.07,.23,h));color*=1.-meniscus*.19;
 color=mix(color,texture2D(photo,cover(uv)).rgb,wiped);float alpha=max(smoothstep(.012,.13,h)*(.92+strength*.08),wiped);gl_FragColor=vec4(color*alpha,alpha);}`;
class ShapeBatch{
 readonly buffer:WebGLBuffer|null;private vertices:Float32Array;count=0;
 constructor(private gl:WebGLRenderingContext,capacity:number){this.buffer=gl.createBuffer();this.vertices=new Float32Array(capacity*54);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.byteLength,gl.DYNAMIC_DRAW)}
 reset(){this.count=0}
 add(x:number,y:number,rx:number,ry:number,rotation:number,value:number,mode=0){
  if((this.count+1)*54>this.vertices.length)return;let offset=this.count++*54;
  for(let i=0;i<12;i+=2){this.vertices[offset++]=corners[i];this.vertices[offset++]=corners[i+1];this.vertices[offset++]=x;this.vertices[offset++]=y;this.vertices[offset++]=rx;this.vertices[offset++]=ry;this.vertices[offset++]=rotation;this.vertices[offset++]=value;this.vertices[offset++]=mode}
 }
 upload(){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,this.vertices.subarray(0,this.count*54))}
 draw(attributes:number[]){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);let offset=0;for(let i=0;i<attributes.length;i++){const size=i<3?2:1;gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,36,offset*4);offset+=size}gl.drawArrays(gl.TRIANGLES,0,this.count*6);for(const attribute of attributes)gl.disableVertexAttribArray(attribute)}
 destroy(){this.gl.deleteBuffer(this.buffer)}
}
/** All water heights and lens pixels stay on the GPU; no per-frame canvas upload. */
export class RainRefraction{
 private gl:WebGLRenderingContext|null;private lens:WebGLProgram|null=null;private shapes:WebGLProgram|null=null;
 private quad:WebGLBuffer|null=null;private photo:WebGLTexture|null=null;private mask:WebGLTexture|null=null;private target:WebGLFramebuffer|null=null;
 private micro:ShapeBatch|null=null;private beads:ShapeBatch|null=null;private wipes:ShapeBatch|null=null;
 private attributes:number[]=[];private position=0;private uniforms:Record<string,WebGLUniformLocation|null>={};private shapeScreen:WebGLUniformLocation|null=null;
 private image:HTMLImageElement|null=null;private imageWidth=1;private imageHeight=1;private ready=false;private serial=0;private source='';private microKey='';private maxTexture=2048;private maskWidth=0;private maskHeight=0;private maximum:EXT_blend_minmax|null=null;
 get active(){return !!this.shapes&&!this.gl?.isContextLost()}
 private lost=(event:Event)=>{event.preventDefault();this.ready=false};
 private restored=()=>{try{this.initialize();const url=this.source;this.source='';this.setImage(url);this.repaint()}catch{this.ready=false}};
 constructor(private canvas:HTMLCanvasElement,private repaint:()=>void){this.gl=weatherContext(canvas);try{this.initialize()}catch{this.release();this.ready=false}canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored)}
 private initialize(){
  const gl=this.gl;if(!gl)return;this.lens=program(gl,lensVertex,lensFragment);this.shapes=program(gl,shapeVertex,shapeFragment);
  this.maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);this.maximum=gl.getExtension('EXT_blend_minmax');this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,corners,gl.STATIC_DRAW);
  this.photo=texture(gl);this.mask=texture(gl);this.target=gl.createFramebuffer();this.micro=new ShapeBatch(gl,1700);this.beads=new ShapeBatch(gl,300);this.wipes=new ShapeBatch(gl,65);
  this.attributes=['local','center','radius','rotation','value','mode'].map(name=>gl.getAttribLocation(this.shapes!,name));this.shapeScreen=gl.getUniformLocation(this.shapes,'screen');this.position=gl.getAttribLocation(this.lens,'position');
  for(const name of ['photo','heightmap','screen','imageSize','texel','strength'])this.uniforms[name]=gl.getUniformLocation(this.lens,name);
  this.maskWidth=0;this.maskHeight=0;this.microKey='';gl.clearColor(0,0,0,0);
 }
 private cancelImage(){if(this.image){this.image.onload=null;this.image.onerror=null;this.image.removeAttribute('src');this.image=null}}
 setImage(url:string){
  if(this.source===url)return;this.source=url;const generation=++this.serial;this.cancelImage();
  if(!url){this.ready=false;this.repaint();return}if(!this.gl||!this.lens)return;
  const image=new Image();this.image=image;image.crossOrigin='anonymous';image.decoding='async';
  image.onload=async()=>{
   let bitmap:ImageBitmap|null=null;let scratch:HTMLCanvasElement|null=null;
   try{
    const budget=renderBudget(),limit=Math.min(this.maxTexture,budget.modest?2048:3072),ratio=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
    const w=Math.max(1,Math.round(image.naturalWidth*ratio)),h=Math.max(1,Math.round(image.naturalHeight*ratio));let pixels:TexImageSource=image;
    if(ratio<1){if(typeof createImageBitmap==='function'){bitmap=await createImageBitmap(image,{resizeWidth:w,resizeHeight:h,resizeQuality:'high',imageOrientation:'flipY'});pixels=bitmap}else{scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;const ctx=scratch.getContext('2d');if(!ctx)throw Error('Image resize unavailable');ctx.drawImage(image,0,0,w,h);pixels=scratch}}
    if(generation!==this.serial||!this.gl||this.gl.isContextLost())return;const gl=this.gl;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.photo);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.imageWidth=w;this.imageHeight=h;this.ready=true;this.repaint();
   }catch{if(generation===this.serial)this.ready=false}finally{bitmap?.close();if(scratch){scratch.width=1;scratch.height=1}if(generation===this.serial)this.cancelImage()}
  };
  image.onerror=()=>{if(generation===this.serial){this.cancelImage();this.repaint()}};image.src=url;
 }
 draw(points:MicroBead[],beads:GlassBead[],wipes:GlassWipe[],width:number,height:number,size:number,strength:number,pinned:boolean,time:number){
  const gl=this.gl;if(!gl||!this.shapes||!this.lens||!this.micro||!this.beads||!this.wipes||gl.isContextLost())return false;
  const budget=renderBudget(width,height);const w=Math.min(this.maxTexture,budget.width),h=Math.min(this.maxTexture,budget.height);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  if(this.maskWidth!==w||this.maskHeight!==h){gl.bindTexture(gl.TEXTURE_2D,this.mask);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.mask,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)return false;this.maskWidth=w;this.maskHeight=h}
  const key=`${points.length}:${width}:${height}:${size}`;
  if(key!==this.microKey){this.microKey=key;this.micro.reset();for(const point of points){const r=point.r*(.7+size*.7);this.micro.add(point.x*width,point.y*height,r,r*1.1,0,.67)}this.micro.upload()}
  this.beads.reset();for(const b of beads){if(!b.active)continue;const arrival=Math.min(1,b.age/.65),growth=arrival*arrival*(3-2*arrival);if(growth<.002)continue;const radius=b.r*(.65+size*2.2)*growth,rolling=!pinned&&b.r>4.8&&Math.sin(time*.65+b.phase)>.25;
   if(b.trail>1)this.beads.add(b.x,b.y-b.trail/2,Math.max(.6,radius*.14),b.trail/2,0,.31);
   this.beads.add(b.x,b.y,radius*(1+.08*Math.sin(b.phase)),radius*(1.12+(rolling?.24:.07)+.06*Math.cos(b.phase)),Math.sin(b.phase)*.12,.92);
  }this.beads.upload();this.wipes.reset();for(const wipe of wipes){const dx=wipe.toX-wipe.x,dy=wipe.toY-wipe.y;this.wipes.add((wipe.x+wipe.toX)/2,(wipe.y+wipe.toY)/2,Math.hypot(dx,dy)/2+38,38,Math.atan2(dy,dx),(1-wipe.age/5)*.94,1)}this.wipes.upload();
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.shapes);gl.uniform2f(this.shapeScreen,width,height);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.blendEquation(this.maximum?this.maximum.MAX_EXT:gl.FUNC_ADD);
  this.micro.draw(this.attributes);this.beads.draw(this.attributes);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.wipes.draw(this.attributes);gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clear(gl.COLOR_BUFFER_BIT);if(!this.ready)return true;
  gl.useProgram(this.lens);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.photo);gl.uniform1i(this.uniforms.photo,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.mask);gl.uniform1i(this.uniforms.heightmap,1);
  gl.uniform2f(this.uniforms.screen,width,height);gl.uniform2f(this.uniforms.imageSize,this.imageWidth,this.imageHeight);gl.uniform2f(this.uniforms.texel,1.25/width,1.25/height);gl.uniform1f(this.uniforms.strength,strength);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(this.position);return true;
 }
 private release(){const gl=this.gl;if(!gl)return;this.micro?.destroy();this.beads?.destroy();this.wipes?.destroy();gl.deleteTexture(this.photo);gl.deleteTexture(this.mask);gl.deleteFramebuffer(this.target);gl.deleteBuffer(this.quad);gl.deleteProgram(this.lens);gl.deleteProgram(this.shapes);this.shapes=null;this.lens=null}
 destroy(){this.serial++;this.cancelImage();this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);this.release();this.gl?.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1}
}
