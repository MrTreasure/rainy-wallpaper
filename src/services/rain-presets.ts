import {defaultAudio} from './desktop-types';
import type {AppConfig,AudioSettings,DesktopPreferences,TrackSettings} from './desktop-types';

type RainPreset={id:string;name:string;description:string;rain:TrackSettings;wind:TrackSettings;thunder:TrackSettings;outdoorRain:number;outdoorWind:number;glassDensity:number;glassSize:number;glassSpeed:number};
export const RAIN_PRESETS:RainPreset[]=[
 {id:'light',name:'小雨',description:'轻柔细雨，微风，无雷声',rain:{enabled:true,volume:.38,intensity:.18,detail:.18,brightness:.55},wind:{enabled:true,volume:.08,intensity:.12,detail:.16,brightness:.3},thunder:{enabled:false,volume:.3,intensity:.1,detail:.85,brightness:.2},outdoorRain:.28,outdoorWind:.12,glassDensity:.35,glassSize:.25,glassSpeed:.15},
 {id:'medium',name:'中雨',description:'绵密雨声，微风，偶有远雷',rain:{enabled:true,volume:.6,intensity:.5,detail:.45,brightness:.45},wind:{enabled:true,volume:.18,intensity:.35,detail:.45,brightness:.35},thunder:{enabled:true,volume:.4,intensity:.2,detail:.8,brightness:.25},outdoorRain:.6,outdoorWind:.3,glassDensity:.65,glassSize:.5,glassSpeed:.3},
 {id:'heavy',name:'暴雨',description:'密集大雨，强风，滚动雷声',rain:{enabled:true,volume:.78,intensity:.9,detail:.8,brightness:.33},wind:{enabled:true,volume:.38,intensity:.65,detail:.72,brightness:.38},thunder:{enabled:true,volume:.52,intensity:.65,detail:.55,brightness:.4},outdoorRain:.9,outdoorWind:.62,glassDensity:.85,glassSize:.7,glassSpeed:.6},
 {id:'typhoon',name:'台风',description:'疾风骤雨，强阵风，频繁雷声',rain:{enabled:true,volume:.84,intensity:1,detail:.95,brightness:.25},wind:{enabled:true,volume:.65,intensity:.96,detail:.95,brightness:.4},thunder:{enabled:true,volume:.5,intensity:.8,detail:.48,brightness:.4},outdoorRain:1,outdoorWind:.95,glassDensity:.96,glassSize:.85,glassSpeed:.8},
];
export function rainPresetAudio(id:string,base:AudioSettings=defaultAudio()):AudioSettings{
 const p=RAIN_PRESETS.find(p=>p.id===id)??RAIN_PRESETS[1],audio=structuredClone(base);
 audio.tracks.rain={...p.rain};audio.tracks.wind={...p.wind};audio.tracks.thunder={...p.thunder};
 audio.tracks.stream.enabled=false;audio.tracks.ocean.enabled=false;return audio;
}
export function rainPresetPreferences(id:string,base:DesktopPreferences):Partial<DesktopPreferences>{
 const p=RAIN_PRESETS.find(p=>p.id===id)??RAIN_PRESETS[1];
 return {audio:rainPresetAudio(p.id,base.audio),rainGlass:true,glassFalling:true,outdoorRain:p.outdoorRain,outdoorWind:p.outdoorWind,glassDensity:p.glassDensity,glassSize:p.glassSize,glassSpeed:p.glassSpeed};
}
export function rainSoundIsPlaying(playing:boolean,audio:AudioSettings,policy:AppConfig['sound']){
 return playing&&policy.enabled&&policy.allowed.includes('rain')&&audio.tracks.rain.enabled&&audio.tracks.rain.volume>0&&Math.min(audio.master,policy.masterLimit)>0;
}
