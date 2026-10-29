import {api} from './api';
import type {Wallpaper} from './desktop-types';
export interface WallpaperQuota {used:number;limit:number|null;remaining:number|null;day:string;timezone:string}
type Device={id:string;ticket:string};
const key='rainy-wallpaper-device-v1';let pending:Promise<Device>|undefined;
function storedDevice():Device|null{
 try{const raw=localStorage.getItem(key);if(!raw)return null;const parsed=JSON.parse(raw);return typeof parsed.id==='string'&&/^[0-9a-f-]{36}$/.test(parsed.id)&&typeof parsed.ticket==='string'&&/^[0-9a-f]{64}$/.test(parsed.ticket)?parsed:null}catch(error){if(error instanceof SyntaxError)return null;throw new Error('请允许本机存储后查询壁纸')}
}
async function device():Promise<Device>{
 const saved=storedDevice();if(saved)return saved;
 if(!pending){const register=async()=>{const existing=storedDevice();if(existing)return existing;const result=await api<Device>('/device',{method:'POST'});const concurrent=storedDevice();if(concurrent)return concurrent;localStorage.setItem(key,JSON.stringify(result));return result};
  // Concurrent tabs share one registered device, rather than separate quotas.
  pending=(navigator.locks?navigator.locks.request('rainy-wallpaper-device',register):register()).finally(()=>{pending=undefined});
 }return pending;
}
async function headers(){const d=await device();return {'X-Device-Id':d.id,'X-Device-Ticket':d.ticket}}
export async function wallpaperQuota(){return api<WallpaperQuota>('/quota',{headers:await headers()})}
export async function queryWallpaper(topic:string,exclude:string,signal:AbortSignal){
 const identity=await headers();signal.throwIfAborted();
 return api<{items:Wallpaper[];quota:WallpaperQuota}>(`/wallpapers?topic=${encodeURIComponent(topic)}&exclude=${encodeURIComponent(exclude)}`,{signal,headers:{...identity,'X-Request-Id':crypto.randomUUID()}});
}
export function abortableDelay(milliseconds:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const done=()=>{signal.removeEventListener('abort',abort);resolve()};const timer=setTimeout(done,milliseconds);function abort(){clearTimeout(timer);reject(signal.reason)}signal.addEventListener('abort',abort,{once:true})})}
/** Remove obsolete image handlers and src as soon as the next choice arrives. */
export function loadWallpaperImage(url:string,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 signal.throwIfAborted();const image=new Image();image.decoding='async';image.crossOrigin='anonymous';
 const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);image.onload=null;image.onerror=null;image.removeAttribute('src')};
 const abort=()=>{cleanup();reject(signal.reason)};const timer=setTimeout(()=>{cleanup();reject(new Error('高清壁纸加载较慢，预览会保留，可再次切换'))},45000);
 image.onload=()=>{cleanup();resolve()};image.onerror=()=>{cleanup();reject(new Error('壁纸暂时无法加载，当前画面会保留'))};signal.addEventListener('abort',abort,{once:true});image.src=url;
 })}
