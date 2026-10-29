/** Live wallpaper sampling through a water height field. No photo pixels leave the browser. */
export class RainRefraction {
 private gl:WebGLRenderingContext|null;
 get active(){return this.ready}
 private program:WebGLProgram|null=null;
 private buffer:WebGLBuffer|null=null;
 private photo:WebGLTexture|null=null;
 private mask:WebGLTexture|null=null;
 private image:HTMLImageElement|null=null;
 private imageWidth=1;private imageHeight=1;private ready=false;private serial=0;private source='';
 private lost=(event:Event)=>{event.preventDefault();this.ready=false};
 private restored=()=>{try{this.initialize();const url=this.source;this.source='';this.setImage(url)}catch{this.ready=false}};
 constructor(private canvas:HTMLCanvasElement,private repaint:()=>void){
  this.gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
  try{this.initialize()}catch{this.ready=false}
  canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored);
 }
 private initialize(){
  const gl=this.gl;if(!gl)return;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type);if(!s)throw Error('Shader unavailable');gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Glass shader unavailable')}return s};
  const vertex=shader(gl.VERTEX_SHADER,`attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`);
  const fragment=shader(gl.FRAGMENT_SHADER,`
   #ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
   #else
   precision mediump float;
   #endif
   varying vec2 uv;uniform sampler2D photo;uniform sampler2D heightmap;
   uniform vec2 screen;uniform vec2 imageSize;uniform vec2 texel;uniform float strength;
   vec2 cover(vec2 p){vec2 expanded=screen+48.;p=(p*screen+24.)/expanded;float aspect=expanded.x/expanded.y;float source=imageSize.x/imageSize.y;
    if(source>aspect)p.x=(p.x-.5)*aspect/source+.5;else p.y=(p.y-.5)*source/aspect+.5;return p;}
   void main(){
    vec3 field=texture2D(heightmap,uv).rgb;float h=field.r;float wiped=max(0.,field.g-field.r);
    if(h<.008&&wiped<.006)discard;
    // Central differences use CSS pixel spacing, independent of the backing resolution.
    vec2 gradient=vec2(texture2D(heightmap,uv+vec2(texel.x,0.)).r-texture2D(heightmap,uv-vec2(texel.x,0.)).r,
     texture2D(heightmap,uv+vec2(0.,texel.y)).r-texture2D(heightmap,uv-vec2(0.,texel.y)).r);
    vec3 normal=normalize(vec3(-gradient*5.5,1.));
    vec3 transmitted=refract(vec3(0.,0.,-1.),normal,1./1.333);
    // A water lens bends the sharp, full-resolution scene beneath the blurred glass.
    vec2 bend=transmitted.xy*(18.+strength*125.)/screen;
    vec3 color=texture2D(photo,cover(clamp(uv+bend,vec2(.001),vec2(.999)))).rgb;
    float fresnel=.0204+.9796*pow(1.-normal.z,5.);
    vec3 reflection=mix(vec3(.12,.18,.18),vec3(.8,.88,.91),smoothstep(-.65,.8,normal.y));
    color=mix(color,reflection,min(.42,fresnel*2.2));
    // Small directional reflections, never a white ring around the whole drop.
    vec3 light=normalize(vec3(-.45,.85,1.5));
    float specular=pow(max(dot(normal,normalize(light+vec3(0.,0.,1.))),0.),115.);
    float slope=smoothstep(.02,.28,length(gradient));
    color=color*(1.-slope*.13)+vec3(.94,.98,1.)*specular*slope*.6;
    float meniscus=smoothstep(.01,.07,h)*(1.-smoothstep(.07,.23,h));
    color*=1.-meniscus*.19;
    color=mix(color,texture2D(photo,cover(uv)).rgb,wiped);
    float alpha=max(smoothstep(.012,.13,h)*(.92+strength*.08),wiped);
    gl_FragColor=vec4(color,alpha);
   }`);
  const program=gl.createProgram();if(!program)throw Error('Glass program unavailable');gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);throw Error('Glass program unavailable')}
  this.program=program;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t};
  this.photo=texture();this.mask=texture();gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.clearColor(0,0,0,0);
 }
 setImage(url:string){
  if(this.source===url)return;this.source=url;const generation=++this.serial;this.ready=false;
  if(this.image){this.image.onload=null;this.image.onerror=null}if(!url||!this.gl||!this.program){this.repaint();return}
  const image=new Image();this.image=image;image.crossOrigin='anonymous';image.decoding='async';
  image.onload=()=>{if(generation!==this.serial||!this.gl)return;const gl=this.gl;try{let source:HTMLImageElement|HTMLCanvasElement=image;const limit=Math.min(4096,Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||2048);if(Math.max(image.naturalWidth,image.naturalHeight)>limit){const canvas=document.createElement('canvas'),ratio=limit/Math.max(image.naturalWidth,image.naturalHeight);canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);const context=canvas.getContext('2d');if(!context)throw Error('Glass texture unavailable');context.drawImage(image,0,0,canvas.width,canvas.height);source=canvas}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.photo);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);this.imageWidth=source instanceof HTMLImageElement?source.naturalWidth:source.width;this.imageHeight=source instanceof HTMLImageElement?source.naturalHeight:source.height;this.ready=gl.getError()===gl.NO_ERROR}catch{this.ready=false}this.repaint()};
  image.onerror=()=>{if(generation===this.serial){this.ready=false;this.repaint()}};image.src=url;
 }
 draw(heightmap:HTMLCanvasElement,width:number,height:number,strength:number){
  const gl=this.gl;if(!gl||!this.program||gl.isContextLost())return;
  const scale=Math.min(devicePixelRatio||1,2,4096/width,4096/height);const w=Math.round(width*scale),h=Math.round(height*scale);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT);if(!this.ready)return;
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const position=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.photo);gl.uniform1i(gl.getUniformLocation(this.program,'photo'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.mask);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,heightmap);gl.uniform1i(gl.getUniformLocation(this.program,'heightmap'),1);
  gl.uniform2f(gl.getUniformLocation(this.program,'screen'),width,height);gl.uniform2f(gl.getUniformLocation(this.program,'imageSize'),this.imageWidth,this.imageHeight);gl.uniform2f(gl.getUniformLocation(this.program,'texel'),1.25/width,1.25/height);gl.uniform1f(gl.getUniformLocation(this.program,'strength'),strength);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 destroy(){this.serial++;if(this.image){this.image.onload=null;this.image.onerror=null}const gl=this.gl;if(gl){gl.deleteTexture(this.photo);gl.deleteTexture(this.mask);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program)}this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored)}
}
