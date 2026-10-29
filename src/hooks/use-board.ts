import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyBoard,newLocalNote,normalizePreferences} from '@/services/desktop-types';
import type {BoardData,DesktopPreferences,LocalNote,Wallpaper} from '@/services/desktop-types';
import type {PaperNoteData} from '@/lib/notes';
import {readBoard,readDeviceBoard,writeBoard} from '@/services/local-board';

/** Personal content never goes through an API, including after login. */
export function useBoard(){
 const [board,setBoard]=useState<BoardData>(()=>emptyBoard(false)),[ready,setReady]=useState(false);
 const [status,setStatus]=useState<'loading'|'saving'|'local'|'offline'>('loading'),[error,setError]=useState('');
 const ref=useRef(board),loaded=useRef(false),revision=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const removed=useRef(new Map<string,LocalNote>());
 const persist=useCallback(()=>{
  clearTimeout(timer.current);timer.current=undefined;if(!loaded.current)return;
  const version=revision.current;
  void writeBoard('device',ref.current).then(()=>{if(version===revision.current){setStatus('local');setError('')}}).catch(()=>{setStatus('offline');setError('本机保存失败，请导出备份并检查浏览器存储空间')});
 },[]);
 const commit=useCallback((change:(data:BoardData)=>BoardData)=>{
  if(!loaded.current)return;const next=change(ref.current);ref.current=next;revision.current++;setBoard(next);setStatus('saving');
  // Coalesce typing, sliders and dragging; keep at most one pending snapshot.
  clearTimeout(timer.current);timer.current=setTimeout(persist,200);
 },[persist]);
 useEffect(()=>{
  let alive=true;void readDeviceBoard().then(data=>{if(!alive)return;ref.current=data;loaded.current=true;setBoard(data);setReady(true);setStatus('local')}).catch(e=>{if(alive){const temporary=emptyBoard(true);ref.current=temporary;loaded.current=true;setBoard(temporary);setReady(true);setStatus('offline');setError(e instanceof Error?e.message:'无法读取本机内容，请导出备份')}});
  const flush=()=>{if(timer.current!==undefined)persist()};
  const hidden=()=>{if(document.hidden)flush()};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);
  return()=>{alive=false;flush();loaded.current=false;window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden)};
 },[persist]);
 const changeNote=useCallback((id:string,patch:Partial<PaperNoteData>&{archived?:boolean})=>commit(b=>({...b,notes:b.notes.map(n=>n.id===id?{...n,...patch,updatedAt:new Date().toISOString()}:n)})),[commit]);
 function arrangeNotes(positions:{id:string;x:number;y:number}[]){const patches=new Map(positions.map(p=>[p.id,p]));const updatedAt=new Date().toISOString();commit(b=>({...b,preferences:{...b.preferences,hideNotes:false},notes:b.notes.map(n=>{const p=patches.get(n.id);return p&&!n.archived?{...n,x:p.x,y:p.y,updatedAt}:n})}))}
 function addNote(color:string){const note=newLocalNote(color);note.x=30+Math.random()*40;note.y=35+Math.random()*30;commit(b=>({...b,notes:[...b.notes,note]}));return note.id}
 function removeNote(id:string){const note=ref.current.notes.find(n=>n.id===id);if(note){removed.current.set(id,note);if(removed.current.size>20)removed.current.delete(removed.current.keys().next().value!)}commit(b=>({...b,notes:b.notes.filter(n=>n.id!==id)}))}
 function restoreNote(id:string){const note=removed.current.get(id);if(!note)return;removed.current.delete(id);commit(b=>({...b,notes:[...b.notes,note]}))}
 const updatePreferences=useCallback((patch:Partial<DesktopPreferences>)=>commit(b=>({...b,preferences:normalizePreferences({...b.preferences,...patch})})),[commit]);
 function rememberWallpaper(photo:Wallpaper,topic:string){commit(b=>({...b,preferences:{...b.preferences,wallpaper:photo,topic},wallpaperHistory:[{photo,topic,usedAt:new Date().toISOString()},...b.wallpaperHistory.filter(item=>item.photo.id!==photo.id)].slice(0,100)}))}
 function removeHistory(id:string){commit(b=>({...b,wallpaperHistory:b.wallpaperHistory.filter(item=>item.photo.id!==id)}))}
 async function importCachedAccount(id:string){
  const cached=await readBoard('user:'+id);if(!cached)return 0;const ids=new Set(ref.current.notes.map(n=>n.id)),notes=cached.notes.filter(n=>!ids.has(n.id));
  commit(b=>({...b,notes:[...b.notes,...notes],preferences:{...b.preferences,favoritePhotos:[...b.preferences.favoritePhotos,...cached.preferences.favoritePhotos.filter(p=>!b.preferences.favoritePhotos.some(f=>f.id===p.id))].slice(0,20)}}));return notes.length;
 }
 return {board,status,error,storageError:status==='offline',ready,arrangeNotes,changeNote,addNote,removeNote,restoreNote,updatePreferences,rememberWallpaper,removeHistory,importCachedAccount,retry:persist};
}
