import {Check,ChevronDown} from 'lucide-react';
import type {DesktopPreferences} from '@/services/desktop-types';

type GlassRecipe=Pick<DesktopPreferences,'glassDensity'|'glassSize'|'glassBlur'|'glassRefraction'|'glassPinned'|'glassSpeed'|'glassFalling'>;
const recipes:{name:string;description:string;settings:GlassRecipe}[]=[
 {name:'细雨朦胧',description:'细密挂珠，窗外微微失焦',settings:{glassDensity:.65,glassSize:.55,glassBlur:.5,glassRefraction:.7,glassPinned:true,glassSpeed:.25,glassFalling:true}},
 {name:'窗上积雨',description:'大颗水珠，安静附着玻璃',settings:{glassDensity:.85,glassSize:.85,glassBlur:.7,glassRefraction:.85,glassPinned:true,glassSpeed:.15,glassFalling:false}},
 {name:'雨夜流淌',description:'水珠缓缓滑落，留下水痕',settings:{glassDensity:.75,glassSize:.7,glassBlur:.65,glassRefraction:.8,glassPinned:false,glassSpeed:.35,glassFalling:true}},
 {name:'初晴留珠',description:'少量挂珠，透过清亮的窗',settings:{glassDensity:.3,glassSize:.65,glassBlur:.15,glassRefraction:.6,glassPinned:true,glassSpeed:.2,glassFalling:false}},
];
export function GlassPanel({preferences:p,onChange}:{preferences:DesktopPreferences;onChange:(patch:Partial<DesktopPreferences>)=>void}){
 return <section className="glass-settings" aria-label="玻璃与水珠设置">
  <h3 className="panel-subheading">眼前的玻璃</h3><p className="glass-description">水珠留在窗上，风景在窗外。</p>
  <div className="glass-recipes">{recipes.map(r=><button type="button" key={r.name} aria-pressed={p.rainGlass&&Object.entries(r.settings).every(([k,v])=>p[k as keyof GlassRecipe]===v)} onClick={()=>onChange({rainGlass:true,...r.settings})}><span>{r.name}<Check size={12}/></span><small>{r.description}</small></button>)}</div>
  <GlassRange label="窗外背景虚化" value={p.glassBlur} onChange={v=>onChange({glassBlur:v})}/>
  <details className="glass-advanced"><summary><span>展开精细调节<small>水珠 · 附着 · 流动 · 折射</small></span><ChevronDown size={16}/></summary>
   <GlassToggle label="开启雨玻璃" checked={p.rainGlass} onChange={v=>onChange({rainGlass:v})}/>
   {p.rainGlass&&<>
    <GlassToggle label="水珠挂在玻璃上" description="保持水珠的位置；关闭后水珠会缓慢滑落" checked={p.glassPinned} onChange={v=>onChange({glassPinned:v})}/>
    <GlassRange label="水珠数量" value={p.glassDensity} onChange={v=>onChange({glassDensity:v})}/>
    <GlassRange label="水珠大小" value={p.glassSize} onChange={v=>onChange({glassSize:v})}/>
    <GlassRange label="水珠折射强度" value={p.glassRefraction} onChange={v=>onChange({glassRefraction:v})}/>
    {!p.glassPinned&&<GlassRange label="水珠滑落速度" value={p.glassSpeed} onChange={v=>onChange({glassSpeed:v})}/>}
    <GlassToggle label="窗外的落雨" description="独立控制远处落雨，不影响玻璃上的挂珠" checked={p.glassFalling} onChange={v=>onChange({glassFalling:v})}/>
   </>}
   <p className="panel-footnote">按住空白玻璃划动，可擦开一小片水珠。便利贴始终清晰。</p>
  </details>
 </section>;
}
function GlassRange({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){return <label className="desktop-range"><span>{label}<output>{Math.round(value*100)}%</output></span><input type="range" min={0} max={1} step={.01} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
function GlassToggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){return <div className="desktop-toggle-row"><div><span>{label}</span>{description&&<small>{description}</small>}</div><button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={()=>onChange(!checked)}><span/></button></div>}
