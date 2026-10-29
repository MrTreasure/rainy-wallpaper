import type {AudioSettings,AppConfig,SoundKind} from '@/services/desktop-types';
import {SOUND_KINDS} from '@/services/desktop-types';
export class AmbientEngine {
 private context:AudioContext|null=null;private node:AudioWorkletNode|null=null;private master:GainNode|null=null;private gains:GainNode[]=[];private starting:Promise<void>|null=null;
 async play(settings:AudioSettings,policy:AppConfig['sound']){
  if(!policy.enabled)throw new Error('声音合成暂时由管理员关闭');
  if(this.starting)await this.starting;
  if(!this.context){this.starting=this.create().finally(()=>{this.starting=null});await this.starting}
  this.update(settings,policy);await this.context!.resume();if(this.context!.state!=='running')throw new Error('请再次点击播放以启动声音');
 }
 private async create(){
  if(!window.AudioContext||!window.AudioWorkletNode)throw new Error('当前浏览器不支持实时声音合成，请使用新版 Chrome、Edge 或 Safari');
  const context=new AudioContext({latencyHint:'playback'});this.context=context;
  try{
   await context.audioWorklet.addModule(new URL('./ambient-processor.js?no-inline',import.meta.url));
   const node=new AudioWorkletNode(context,'ambient-desktop',{numberOfInputs:0,numberOfOutputs:5,outputChannelCount:[2,2,2,2,2]});this.node=node;
   const master=context.createGain();master.gain.value=0;this.master=master;
   const compressor=context.createDynamicsCompressor();compressor.threshold.value=-10;compressor.knee.value=8;compressor.ratio.value=8;compressor.attack.value=.012;compressor.release.value=.3;
   master.connect(compressor);compressor.connect(context.destination);
   this.gains=SOUND_KINDS.map((_,i)=>{const gain=context.createGain();gain.gain.value=0;node.connect(gain,i);gain.connect(master);return gain});
  }catch(error){await context.close();this.context=null;throw error}
 }
 update(settings:AudioSettings,policy:AppConfig['sound']){
  if(!this.context||!this.node||!this.master)return;const now=this.context.currentTime;
  const safe=structuredClone(settings);safe.random=settings.random&&policy.randomEnabled;safe.variation=Math.min(settings.variation,policy.variationMax);
  this.master.gain.setTargetAtTime(policy.enabled?Math.min(Math.max(0,settings.master),policy.masterLimit)*.72:0,now,.18);
  SOUND_KINDS.forEach((kind:SoundKind,i)=>{const track=safe.tracks[kind];track.enabled=track.enabled&&policy.allowed.includes(kind)&&policy.enabled;const ceiling=kind==='thunder'?policy.thunderLimit:1;this.gains[i].gain.setTargetAtTime(track.enabled?Math.min(Math.max(0,track.volume),ceiling):0,now,.25)});
  this.node.port.postMessage({type:'config',config:safe});
 }
 async pause(){if(this.context)await this.context.suspend()}
 async close(){const context=this.context;this.context=null;this.node=null;this.master=null;this.gains=[];if(context&&context.state!=='closed')await context.close()}
 get running(){return this.context?.state==='running'}
}
