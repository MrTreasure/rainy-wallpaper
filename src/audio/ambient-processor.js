/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class AmbientProcessor extends AudioWorkletProcessor {
 constructor(){
  super();this.time=0;this.config={random:true,variation:.35,tracks:{}};this.names=['rain','wind','thunder','stream','ocean'];
  this.layers=this.names.map(()=>({left:0,right:0,drift:1,target:1,nextChange:20+Math.random()*45,nextEvent:35+Math.random()*60,event:0,eventAge:0,eventDuration:5,bubbles:[0,0],phase:[0,0],freq:[500,650],wavePeriod:11}));
  this.port.onmessage=e=>{if(e.data?.type==='config')this.config=e.data.config};
 }
 process(_inputs,outputs){
  const rate=sampleRate,dt=1/rate,count=outputs[0]?.[0]?.length??128;
  for(let layer=0;layer<5;layer++){
   const track=this.config.tracks?.[this.names[layer]],out=outputs[layer],s=this.layers[layer];
   if(!out?.length)continue;
   if(!track?.enabled){for(const channel of out)channel.fill(0);continue}
   const intensity=Math.max(0,Math.min(1,track.intensity??.5)),detail=Math.max(0,Math.min(1,track.detail??.5)),bright=Math.max(0,Math.min(1,track.brightness??.5));
   if(this.time>s.nextChange){s.target=this.config.random?1-Math.random()*Math.min(.9,this.config.variation??.35):1;s.nextChange=this.time+40+Math.random()*80;s.wavePeriod=7+detail*11+Math.random()*2}
   if(!this.config.random)s.target=1;
   s.drift+=(s.target-s.drift)*.0008;
   const windEnvelope=.65+.22*Math.sin(this.time*(.14+detail*.2))+.13*Math.sin(this.time*.071+layer);
   const wavePhase=(this.time/s.wavePeriod)%1;
   const waveEnvelope=Math.pow(Math.max(0,Math.sin(wavePhase*Math.PI)),1.5);
   for(let i=0;i<count;i++){
    const now=this.time+i*dt;
    if(layer===2&&now>s.nextEvent){s.eventAge=0;s.eventDuration=3+detail*5+Math.random()*2;s.event=.55+Math.random()*.4;s.nextEvent=now+25+(1-intensity)*150+Math.random()*70}
    if(layer===2)s.eventAge+=dt;
    for(let ch=0;ch<out.length;ch++){
     const noise=Math.random()*2-1,key=ch?'right':'left';let value=0;
     if(layer===0){
      s[key]+=(noise-s[key])*(.08+bright*.35);
      if(Math.random()<(4+intensity*45)/rate){s.bubbles[ch]=.3+detail*.7;s.freq[ch]=(750+Math.random()*1900)/(0.5+detail);s.phase[ch]=0}
      s.bubbles[ch]*=1-(.0009+(1-detail)*.002);s.phase[ch]+=s.freq[ch]/rate*6.283185;
      value=s[key]*(.17+intensity*.33)+s.bubbles[ch]*Math.sin(s.phase[ch])*.17;
     }else if(layer===1){s[key]+=(noise-s[key])*(.008+bright*.05);value=s[key]*3*(.3+intensity*.7)*windEnvelope;
     }else if(layer===2){s[key]+=(noise-s[key])*.009;const envelope=s.eventAge<.55?s.eventAge/.55:Math.exp(-(s.eventAge-.55)/(s.eventDuration*.27));value=s[key]*3.5*envelope*s.event*(.4+intensity*.6);if(s.eventAge<.08)value+=noise*(1-detail)*.08;
     }else if(layer===3){s[key]+=(noise-s[key])*(.07+bright*.25);if(Math.random()<(4+detail*23)/rate){s.bubbles[ch]=.18+Math.random()*.25;s.freq[ch]=400+Math.random()*1400;s.phase[ch]=0}s.bubbles[ch]*=.998;s.phase[ch]+=s.freq[ch]/rate*6.283185;value=s[key]*(.2+intensity*.3)+Math.sin(s.phase[ch])*s.bubbles[ch]*.24;
     }else{s[key]+=(noise-s[key])*(.025+bright*.12);value=s[key]*2*(.035+waveEnvelope*(.18+intensity*.52));value+=noise*.035*Math.pow(waveEnvelope,.6)}
     out[ch][i]=Math.tanh(value*s.drift);
    }
   }
  }
  this.time+=count*dt;return true;
 }
}
registerProcessor('ambient-desktop',AmbientProcessor);
