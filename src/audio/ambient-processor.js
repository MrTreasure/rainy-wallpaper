/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class AmbientProcessor extends AudioWorkletProcessor {
 constructor(){
  super();this.time=0;this.config={random:true,variation:.35,tracks:{}};this.names=['rain','wind','thunder','stream','ocean'];
  this.layers=this.names.map(()=>({left:0,right:0,drift:1,target:1,nextChange:20+Math.random()*45,nextEvent:35+Math.random()*60,event:0,eventAge:0,eventDuration:5,mid:[0,0],bubbles:[0,0],phase:[0,0],freq:[500,650],wavePeriod:11}));
  this.port.onmessage=e=>{
   if(e.data?.type==='config'){
    const wasEnabled=this.config.tracks?.thunder?.enabled;this.config=e.data.config;
    if(this.config.tracks?.thunder?.enabled&&!wasEnabled)this.layers[2].nextEvent=this.time+.8+Math.random()*1.4;
   }
   if(e.data?.type==='thunder'&&this.config.tracks?.thunder?.enabled)this.thunder(this.config.tracks.thunder,this.time);
  };
 }
 thunder(track,now){
  const s=this.layers[2],detail=Math.max(0,Math.min(1,track.detail??.5)),intensity=Math.max(0,Math.min(1,track.intensity??.5));
  s.eventAge=0;s.eventDuration=4+detail*6+Math.random()*2;s.event=.8+Math.random()*.18;
  s.nextEvent=now+(8+(1-intensity)*35)*(.8+Math.random()*.5);
 }
 process(_inputs,outputs){
  const rate=sampleRate,dt=1/rate,count=outputs[0]?.[0]?.length??128;
  for(let layer=0;layer<5;layer++){
   const track=this.config.tracks?.[this.names[layer]],out=outputs[layer],s=this.layers[layer];
   if(!out?.length)continue;
   if(!track?.enabled){for(const channel of out)channel.fill(0);continue}
   // Silent thunder gaps do not synthesize/filter 96,000 noise samples per second.
   if(layer===2&&s.event===0&&this.time+count*dt<s.nextEvent){for(const channel of out)channel.fill(0);continue}
   const intensity=Math.max(0,Math.min(1,track.intensity??.5)),detail=Math.max(0,Math.min(1,track.detail??.5)),bright=Math.max(0,Math.min(1,track.brightness??.5));
   if(this.time>s.nextChange){s.target=this.config.random?1-Math.random()*Math.min(.9,this.config.variation??.35):1;s.nextChange=this.time+40+Math.random()*80;s.wavePeriod=7+detail*11+Math.random()*2}
   if(!this.config.random)s.target=1;
   s.drift+=(s.target-s.drift)*.0008;
   const windEnvelope=.65+.22*Math.sin(this.time*(.14+detail*.2))+.13*Math.sin(this.time*.071+layer);
   const wavePhase=(this.time/s.wavePeriod)%1;
   const waveEnvelope=Math.pow(Math.max(0,Math.sin(wavePhase*Math.PI)),1.5);
   const thunderLow=layer===2?1-Math.exp(-6.283185*(70+(1-detail)*130)/rate):0;
   const thunderMid=layer===2?1-Math.exp(-6.283185*(260+(1-detail)*800)/rate):0;
   const oceanFoam=layer===4?.035*Math.pow(waveEnvelope,.6):0;
   for(let i=0;i<count;i++){
    const now=this.time+i*dt;
    if(layer===2&&now>=s.nextEvent)this.thunder(track,now);
    if(layer===2)s.eventAge+=dt;
    for(let ch=0;ch<out.length;ch++){
     const noise=Math.random()*2-1,key=ch?'right':'left';let value=0;
     if(layer===0){
      s[key]+=(noise-s[key])*(.08+bright*.35);
      if(Math.random()<(4+intensity*45)/rate){s.bubbles[ch]=.3+detail*.7;s.freq[ch]=(750+Math.random()*1900)/(0.5+detail);s.phase[ch]=0}
      s.bubbles[ch]*=1-(.0009+(1-detail)*.002);s.phase[ch]+=s.freq[ch]/rate*6.283185;
      value=s[key]*(.17+intensity*.33)+s.bubbles[ch]*Math.sin(s.phase[ch])*.17;
     }else if(layer===1){s[key]+=(noise-s[key])*(.008+bright*.05);value=s[key]*3*(.3+intensity*.7)*windEnvelope;
     }else if(layer===2){
      s[key]+=(noise-s[key])*thunderLow;
      s.mid[ch]+=(noise-s.mid[ch])*thunderMid;
      if(s.event>0){
       const age=s.eventAge,attack=Math.min(1,age/(.09+detail*.24));
       const tail=Math.exp(-age/(s.eventDuration*.28));
       const roll=.75+.16*Math.sin(age*7.3)+.09*Math.sin(age*13.1+ch*.6);
       const echo=Math.exp(-Math.pow((age-.8-detail*.7)/.5,2))*.22;
       const envelope=attack*(tail*roll+echo);
       const crack=Math.exp(-age/(.045+detail*.09))*(1-detail)*.16;
       value=((s[key]*4.4+s.mid[ch]*.65)*envelope*(.65+intensity*.35)+noise*crack)*s.event;
       if(age>s.eventDuration*1.5)s.event=0;
      }

     }else if(layer===3){s[key]+=(noise-s[key])*(.07+bright*.25);if(Math.random()<(4+detail*23)/rate){s.bubbles[ch]=.18+Math.random()*.25;s.freq[ch]=400+Math.random()*1400;s.phase[ch]=0}s.bubbles[ch]*=.998;s.phase[ch]+=s.freq[ch]/rate*6.283185;value=s[key]*(.2+intensity*.3)+Math.sin(s.phase[ch])*s.bubbles[ch]*.24;
     }else{s[key]+=(noise-s[key])*(.025+bright*.12);value=s[key]*2*(.035+waveEnvelope*(.18+intensity*.52));value+=noise*oceanFoam}
     out[ch][i]=Math.tanh(value*s.drift);
    }
   }
  }
  this.time+=count*dt;return true;
 }
}
registerProcessor('ambient-desktop',AmbientProcessor);
