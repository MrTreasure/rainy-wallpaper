import {highResolutionWallpaper} from './wallpaper-image';
import type { PaperNoteData } from '@/lib/notes';
export type SoundKind = 'rain'|'wind'|'thunder'|'stream'|'ocean';
export const SOUND_KINDS:SoundKind[]=['rain','wind','thunder','stream','ocean'];
export interface TrackSettings { enabled:boolean; volume:number; intensity:number; detail:number; brightness:number }
export interface AudioSettings { master:number; random:boolean; variation:number; tracks:Record<SoundKind,TrackSettings> }
export interface Wallpaper { id:string; url:string; thumb:string; color:string; author:string; authorUrl:string; sourceUrl:string; description:string; originalUrl?:string|null; width?:number|null; height?:number|null }
export interface User { id:string; displayName:string|null; email:string|null; isSuperAdmin:boolean; avatarUrl?:string|null }
export interface RemoteNote extends PaperNoteData { archived:boolean; version:number; updatedAt?:string|null }
export interface LocalNote extends RemoteNote { dirty:boolean; deleted?:boolean; conflict?:RemoteNote|null; remoteDeleted?:boolean }
export interface DesktopPreferences { audio:AudioSettings; topic:string; wallpaper:Wallpaper|null; dim:number; rainGlass:boolean; glassDensity:number; glassSize:number; glassBlur:number; glassRefraction:number; glassPinned:boolean; glassSpeed:number; glassFalling:boolean; outdoorRain:number; outdoorWind:number; hideNotes:boolean; autoWallpaper:boolean; favoritePhotos:Wallpaper[] }
export interface BoardData { notes:LocalNote[]; preferences:DesktopPreferences; preferencesVersion:number; preferencesDirty:boolean; preferencesConflict?:{data:Partial<DesktopPreferences>;version:number}; migrationIds:string[] }
export interface AppConfig { enabled:boolean; maxNotes:number; defaultPaperColor:string; sound:{enabled:boolean;allowed:SoundKind[];masterLimit:number;randomEnabled:boolean;variationMax:number;thunderLimit:number}; wallpaper:{enabled:boolean;topics:string[];defaultTopic:string;blocked:string[];allowAuto:boolean;intervalMinutes:number} }
export interface ConfigRecord { data:AppConfig;version:number;unsplashConfigured:boolean }
export const DEFAULT_CONFIG:AppConfig={enabled:true,maxNotes:60,defaultPaperColor:'#f2de8e',sound:{enabled:true,allowed:SOUND_KINDS,masterLimit:.85,randomEnabled:true,variationMax:.65,thunderLimit:.55},wallpaper:{enabled:true,topics:['forest','ocean','mountain','rain','city','flowers','jiangnan','wilderness'],defaultTopic:'forest',blocked:[],allowAuto:false,intervalMinutes:30}};
export function defaultAudio():AudioSettings {return {master:.5,random:true,variation:.35,tracks:{rain:{enabled:true,volume:.55,intensity:.5,detail:.45,brightness:.4},wind:{enabled:false,volume:.3,intensity:.45,detail:.5,brightness:.35},thunder:{enabled:false,volume:.3,intensity:.25,detail:.7,brightness:.25},stream:{enabled:false,volume:.5,intensity:.6,detail:.45,brightness:.6},ocean:{enabled:false,volume:.5,intensity:.55,detail:.45,brightness:.4}}}}
export function defaultPreferences():DesktopPreferences{return {audio:defaultAudio(),topic:'forest',wallpaper:null,dim:.2,rainGlass:true,glassDensity:.65,glassSize:.55,glassBlur:.5,glassRefraction:.7,glassPinned:true,glassSpeed:.25,glassFalling:true,outdoorRain:.72,outdoorWind:.35,hideNotes:false,autoWallpaper:false,favoritePhotos:[]}}
export function newLocalNote(color='#f2de8e'):LocalNote{return {id:crypto.randomUUID(),markdown:'## 留一点空白\n\n把此刻的想法，写在这里。\n\n- [ ] 一件想做的小事',color,x:28,y:46,width:310,height:330,angle:-1.6,curl:.6,tape:true,archived:false,version:0,dirty:true,updatedAt:new Date().toISOString()}}
export function emptyBoard(guest:boolean):BoardData{return {notes:guest?[newLocalNote()]:[],preferences:defaultPreferences(),preferencesVersion:0,preferencesDirty:guest,migrationIds:[]}}
const bounded=(n:unknown,fallback:number,min=0,max=1)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export function normalizePreferences(raw:Partial<DesktopPreferences>|null|undefined):DesktopPreferences{
 const p=defaultPreferences();if(!raw||typeof raw!=='object')return p;
 if(raw.audio&&typeof raw.audio==='object'){
  p.audio.master=bounded(raw.audio.master,p.audio.master);p.audio.random=typeof raw.audio.random==='boolean'?raw.audio.random:p.audio.random;p.audio.variation=bounded(raw.audio.variation,p.audio.variation);
  for(const kind of SOUND_KINDS){const t=raw.audio.tracks?.[kind];if(t&&typeof t==='object')p.audio.tracks[kind]={enabled:typeof t.enabled==='boolean'?t.enabled:false,volume:bounded(t.volume,.4),intensity:bounded(t.intensity,.5),detail:bounded(t.detail,.5),brightness:bounded(t.brightness,.5)}}
 }
 p.outdoorRain=bounded(raw.outdoorRain,p.outdoorRain);p.outdoorWind=bounded(raw.outdoorWind,p.outdoorWind);
 p.glassSize=bounded(raw.glassSize,p.glassSize);p.glassBlur=bounded(raw.glassBlur,p.glassBlur);p.glassRefraction=bounded(raw.glassRefraction,p.glassRefraction);p.glassSpeed=bounded(raw.glassSpeed,p.glassSpeed);p.glassPinned=typeof raw.glassPinned==='boolean'?raw.glassPinned:p.glassPinned;p.glassFalling=typeof raw.glassFalling==='boolean'?raw.glassFalling:p.glassFalling;
 // The old 'accumulated rain' recipe accidentally disabled outdoor weather.
 // Migrate only that exact legacy recipe; preserve custom/off and post-rain choices.
 if(raw.outdoorRain===undefined&&raw.glassFalling===false&&raw.glassDensity===.85&&raw.glassSize===.85&&raw.glassBlur===.7&&raw.glassRefraction===.85&&raw.glassPinned===true&&raw.glassSpeed===.15)p.glassFalling=true;
 p.topic=typeof raw.topic==='string'?raw.topic:'forest';p.dim=bounded(raw.dim,.2,0,.8);p.glassDensity=bounded(raw.glassDensity,.65);p.rainGlass=typeof raw.rainGlass==='boolean'?raw.rainGlass:p.rainGlass;p.hideNotes=raw.hideNotes===true;p.autoWallpaper=raw.autoWallpaper===true;
 const photo=(v:unknown):v is Wallpaper=>!!v&&typeof v==='object'&&typeof (v as Wallpaper).id==='string'&&typeof (v as Wallpaper).url==='string'&&(v as Wallpaper).url.startsWith('https://images.unsplash.com/');
 p.wallpaper=photo(raw.wallpaper)?highResolutionWallpaper(raw.wallpaper):null;p.favoritePhotos=Array.isArray(raw.favoritePhotos)?raw.favoritePhotos.filter(photo).slice(0,20).map(highResolutionWallpaper):[];return p;
}
