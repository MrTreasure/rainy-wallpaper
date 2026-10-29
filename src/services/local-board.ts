import {emptyBoard,normalizePreferences} from './desktop-types';
import type {BoardData,LocalNote} from './desktop-types';
let opened:Promise<IDBDatabase>|undefined;
function database(){if(!opened)opened=new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('rainy-wallpaper-desktop',1);
 request.onupgradeneeded=()=>{request.result.createObjectStore('boards')};
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=undefined};resolve(db)};
 request.onerror=()=>{opened=undefined;reject(new Error('本机存储无法打开，请检查浏览器的存储权限'))};
 request.onblocked=()=>reject(new Error('请关闭旧版本页面后重试'));
});return opened}
function normalizeBoard(raw:Partial<BoardData>):BoardData{
 const notes:LocalNote[]=Array.isArray(raw.notes)?raw.notes.filter(n=>n&&typeof n.id==='string'&&typeof n.markdown==='string'&&!(n as LocalNote&{deleted?:boolean}).deleted).map(n=>({id:n.id,markdown:n.markdown,color:n.color,x:n.x,y:n.y,width:n.width,height:typeof n.height==='number'?n.height:330,angle:n.angle,curl:n.curl,tape:n.tape,archived:n.archived===true,updatedAt:n.updatedAt})):[];
 const history=Array.isArray(raw.wallpaperHistory)?raw.wallpaperHistory.flatMap(item=>{const photo=normalizePreferences({wallpaper:item?.photo}).wallpaper;return photo&&typeof item.topic==='string'&&typeof item.usedAt==='string'?[{...item,photo}]:[]}).slice(0,100):[];
 return {notes,preferences:normalizePreferences(raw.preferences),wallpaperHistory:history};
}
export async function readBoard(scope:string):Promise<BoardData|null>{const db=await database();const raw=await new Promise<BoardData|undefined>((resolve,reject)=>{const request=db.transaction('boards','readonly').objectStore('boards').get(scope);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return raw?normalizeBoard(raw):null}
export async function readDeviceBoard(){const current=await readBoard('device');if(current)return current;const data=await readBoard('guest')??emptyBoard(true);await writeBoard('device',data);return data}
let writes=Promise.resolve();
export function writeBoard(scope:string,board:BoardData):Promise<void>{
 // Boards are immutable. Let IndexedDB clone once at put(), rather than copying
 // the complete Markdown/photo collection on every pointer movement as well.
 const job=writes.catch(()=>{}).then(async()=>{const db=await database();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('boards','readwrite');transaction.objectStore('boards').put(board,scope);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})});writes=job;return job;
}
