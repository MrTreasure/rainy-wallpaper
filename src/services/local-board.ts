import {emptyBoard,normalizePreferences} from './desktop-types';
import type {BoardData,LocalNote} from './desktop-types';
let opened:Promise<IDBDatabase>|undefined;
function database(){if(!opened)opened=new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('rainy-wallpaper-desktop',1);
 request.onupgradeneeded=()=>{request.result.createObjectStore('boards')};
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};
 request.onerror=()=>reject(new Error('本机存储无法打开，请检查浏览器的存储权限'));
 request.onblocked=()=>reject(new Error('请关闭旧版本页面后重试'));
});return opened}
export async function readBoard(scope:string):Promise<BoardData>{const db=await database();const raw=await new Promise<BoardData|undefined>((resolve,reject)=>{const request=db.transaction('boards','readonly').objectStore('boards').get(scope);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 if(!raw)return emptyBoard(scope==='guest');
 const notes:LocalNote[]=Array.isArray(raw.notes)?raw.notes.filter(n=>n&&typeof n.id==='string'&&typeof n.markdown==='string').map(n=>({...n,height:typeof n.height==='number'?n.height:330,version:n.version??0,dirty:n.dirty===true})):[];
 return {...emptyBoard(false),...raw,notes,preferences:normalizePreferences(raw.preferences),migrationIds:Array.isArray(raw.migrationIds)?raw.migrationIds:[]};
}
let writes=Promise.resolve();
export function writeBoard(scope:string,board:BoardData):Promise<void>{const snapshot=structuredClone(board);const job=writes.catch(()=>{}).then(async()=>{const db=await database();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('boards','readwrite');transaction.objectStore('boards').put(snapshot,scope);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})});writes=job;return job}
export function remotePayload(note:LocalNote){const {dirty:_dirty,deleted:_deleted,conflict:_conflict,remoteDeleted:_remoteDeleted,...remote}=note;return remote}
