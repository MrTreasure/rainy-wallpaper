import {useState} from 'react';
import {ArrowDownRight,ArrowRight,CloudRain,Leaf,Maximize2,Volume2,Waves} from 'lucide-react';

export type EntryScene='rain'|'forest'|'ocean';
export interface EntryOptions {scene:EntryScene;rain:boolean;fullscreen:boolean;sound:boolean}
const scenes=[
 {id:'rain',name:'雨窗',caption:'听雨落下来',icon:CloudRain},
 {id:'forest',name:'林间',caption:'风穿过树梢',icon:Leaf},
 {id:'ocean',name:'海边',caption:'等一阵潮汐',icon:Waves},
] as const;

export function EntryScreen({leaving,ready,onEnter,onRainChange,onSceneChange}:{leaving:boolean;ready:boolean;onEnter:(options:EntryOptions)=>void;onRainChange:(enabled:boolean)=>void;onSceneChange:(scene:EntryScene)=>void}){
 const [scene,setScene]=useState<EntryScene>('rain');
 const [rain,setRain]=useState(true),[fullscreen,setFullscreen]=useState(true);
 return <section className={`entry-screen ${leaving?'is-leaving':''}`} aria-labelledby="entry-title" inert={leaving}>
  <div className="entry-coordinate" aria-hidden="true"><span>给自己，一点留白</span><span>YOUR OWN QUIET CORNER</span></div>
  <div className="entry-content">
   <p className="entry-eyebrow"><span/> A MOMENT, JUST FOR YOU</p>
   <h1 id="entry-title">把喧嚣，<br/>留在<span>窗外。</span></h1>
   <p className="entry-description">听一场雨，放空一会儿。<br/>让念头落在纸上，让时间慢下来。</p>
   <div className="entry-scenes" role="group" aria-label="选择窗外风景与声音场景">
    {scenes.map(s=><button key={s.id} type="button" aria-pressed={scene===s.id} onClick={()=>{setScene(s.id);onSceneChange(s.id)}}><s.icon size={17} strokeWidth={1.4}/><span>{s.name}</span><small>{s.caption}</small></button>)}
   </div>
   <div className="entry-actions">
    <button type="button" className="entry-enter" disabled={!ready||leaving} onClick={()=>onEnter({scene,rain,fullscreen,sound:true})}><Volume2 size={16}/><span>{ready?'开启声音，进入':'正在打开你的桌面'}</span><ArrowRight size={20} strokeWidth={1.3}/></button>
    <button type="button" className="entry-silent" disabled={!ready||leaving} onClick={()=>onEnter({scene,rain,fullscreen,sound:false})}>静音进入 <ArrowDownRight size={15}/></button>
   </div>
   <div className="entry-options">
    <label><input type="checkbox" checked={rain} onChange={e=>{setRain(e.target.checked);onRainChange(e.target.checked)}}/><CloudRain size={13}/>雨滴互动</label>
    <label><input type="checkbox" checked={fullscreen} onChange={e=>setFullscreen(e.target.checked)}/><Maximize2 size={12}/>全屏进入</label>
   </div>
  </div>
  <aside className="entry-side-note" aria-hidden="true"><span className="entry-side-line"/><span>此刻，只需要在这里。</span><small>NOTHING TO RUSH.</small></aside>
  <footer className="entry-footer"><span className="entry-live-dot"/><span>{rain?'轻触泛起涟漪 · 按住划动，拭去水珠':'一张风景，一点自己的时间'}</span><span className="entry-footer-rule"/><span>无需登录，也能留下想法</span></footer>
 </section>;
}
