import {useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiFailure} from '@/services/api';
import {emptyBoard,newLocalNote,normalizePreferences} from '@/services/desktop-types';
import type {BoardData,DesktopPreferences,LocalNote,RemoteNote,User} from '@/services/desktop-types';
import type {PaperNoteData} from '@/lib/notes';
import {readBoard,remotePayload,writeBoard} from '@/services/local-board';

type Envelope={scope:string;data:BoardData};
type SyncStatus='loading'|'local'|'saving'|'synced'|'offline'|'conflict';
const sameContent=(a:RemoteNote,b:RemoteNote)=>JSON.stringify([a.markdown,a.color,a.x,a.y,a.width,a.height,a.angle,a.curl,a.tape,a.archived])===JSON.stringify([b.markdown,b.color,b.x,b.y,b.width,b.height,b.angle,b.curl,b.tape,b.archived]);
export function useBoard(user:User|null){
 const accountId=user?.id??'';
 const desiredScope=accountId?'user:'+accountId:'guest';
 const [envelope,setEnvelope]=useState<Envelope>({scope:'',data:emptyBoard(false)});
 const [status,setStatus]=useState<SyncStatus>('loading');const [error,setError]=useState('');const [storageError,setStorageError]=useState(false);
 const ref=useRef(envelope),epoch=useRef(0),running=useRef(0),activeUser=useRef(user?.id??'');activeUser.current=user?.id??'';
 const [retryKey,setRetryKey]=useState(0);
 const removed=useRef(new Map<string,LocalNote>());
 const commit=useCallback((change:(board:BoardData)=>BoardData)=>{
  const old=ref.current;if(!old.scope)return;
  const next={scope:old.scope,data:change(old.data)};ref.current=next;setEnvelope(next);
  void writeBoard(next.scope,next.data).catch(()=>{setStorageError(true);setStatus('offline');setError('本机存储写入失败，请导出重要内容并检查浏览器存储空间')});
 },[]);
 useEffect(()=>{
  const id=++epoch.current;setStatus('loading');setError('');
  void(async()=>{
   try{
    let data=await readBoard(desiredScope);
    if(accountId){const guest=await readBoard('guest');if(!data.notes.length&&data.preferencesVersion===0&&!data.preferencesDirty)data={...data,preferences:guest.preferences,preferencesDirty:true};const ids=new Set(data.notes.map(n=>n.id));const drafts=guest.notes.filter(n=>!n.deleted&&!ids.has(n.id));if(drafts.length){data={...data,notes:[...data.notes,...drafts.map(n=>({...n,dirty:true,version:0,conflict:undefined}))],migrationIds:[...new Set([...data.migrationIds,...drafts.map(n=>n.id)])]};await writeBoard(desiredScope,data)}}
    if(id!==epoch.current)return;
    const next={scope:desiredScope,data};ref.current=next;setEnvelope(next);setStatus(accountId?'saving':'local');
   }catch(e){if(id===epoch.current){const next={scope:desiredScope,data:emptyBoard(false)};ref.current=next;setEnvelope(next);setStorageError(true);setStatus('offline');setError(e instanceof Error?e.message:'本机存储暂不可用')}}
  })();
  const invalidate=()=>{epoch.current++};return()=>invalidate();
 },[desiredScope,accountId]);
 const sync=useCallback(async()=>{
  const account=activeUser.current,id=epoch.current;if(!account||ref.current.scope!=='user:'+account||running.current===id)return;
  running.current=id;setStatus('saving');setError('');
  const valid=()=>id===epoch.current&&activeUser.current===account&&ref.current.scope==='user:'+account;
  try{
   const [remote,prefs]=await Promise.all([api<{items:RemoteNote[]}>('/notes',{},account),api<{data:Partial<DesktopPreferences>;version:number}>('/preferences',{},account)]);
   if(!valid())return;
   commit(board=>{
    const local=new Map(board.notes.map(n=>[n.id,n]));const merged:LocalNote[]=[];
    for(const r of remote.items){const l=local.get(r.id);local.delete(r.id);
     if(!l||!l.dirty)merged.push({...r,dirty:false});
     else if(l.version===r.version)merged.push(l);
     else if(l.version===0&&sameContent(l,r)&&!l.deleted)merged.push({...r,dirty:false});
     else merged.push({...l,conflict:r});
    }
    for(const l of local.values()){
     if(l.deleted&&l.version>0)continue;
     if(l.version>0){if(l.dirty)merged.push({...l,remoteDeleted:true});}
     else merged.push(l);
    }
    let next={...board,notes:merged};
    if(prefs.version>0){
     if(!board.preferencesDirty||board.preferencesVersion===0){next={...next,preferences:normalizePreferences(prefs.data),preferencesVersion:prefs.version,preferencesDirty:false};}
     else if(board.preferencesVersion!==prefs.version)next.preferencesConflict=prefs;
    }
    return next;
   });
   const pending=[...ref.current.data.notes].filter(n=>n.dirty&&!n.conflict&&!n.remoteDeleted);
   for(const n of pending){
    if(!valid())return;
    if(n.deleted){
     if(n.version>0)await api<void>(`/notes/${n.id}?version=${n.version}`,{method:'DELETE'},account);
     if(!valid())return;commit(b=>({...b,notes:b.notes.filter(x=>x.id!==n.id)}));continue;
    }
    try{
     const saved=await api<RemoteNote>(n.version>0?`/notes/${n.id}`:'/notes',{method:n.version>0?'PUT':'POST',body:JSON.stringify(remotePayload(n))},account);
     if(!valid())return;
     commit(b=>({...b,notes:b.notes.map(current=>current.id===n.id?(sameContent(current,n)&&current.deleted===n.deleted?{...saved,dirty:false}:{...current,version:saved.version,updatedAt:saved.updatedAt,dirty:true}):current)}));
    }catch(e){
     if(!valid())return;
     if(e instanceof ApiFailure&&e.status===409&&e.current){commit(b=>({...b,notes:b.notes.map(x=>x.id===n.id?{...x,conflict:e.current}:x)}));continue}
     if(e instanceof ApiFailure&&e.status===404){commit(b=>({...b,notes:b.notes.map(x=>x.id===n.id?{...x,remoteDeleted:true}:x)}));continue}
     throw e;
    }
   }
   const current=ref.current.data;
   if(current.preferencesDirty&&!current.preferencesConflict){
    try{const saved=await api<{data:DesktopPreferences;version:number}>('/preferences',{method:'PUT',body:JSON.stringify({data:current.preferences,version:current.preferencesVersion})},account);if(!valid())return;commit(b=>({...b,preferencesVersion:saved.version,preferencesDirty:JSON.stringify(b.preferences)!==JSON.stringify(current.preferences)}))}
    catch(e){if(e instanceof ApiFailure&&e.status===409){const latest=await api<{data:DesktopPreferences;version:number}>('/preferences',{},account);if(valid())commit(b=>({...b,preferencesConflict:latest}));}else throw e}
   }
   if(!valid())return;
   const successful=ref.current.data.migrationIds.filter(noteId=>ref.current.data.notes.some(n=>n.id===noteId&&n.version>0&&!n.dirty));
   if(successful.length){const guest=await readBoard('guest');if(!valid())return;await writeBoard('guest',{...guest,notes:guest.notes.filter(n=>!successful.includes(n.id)),preferencesDirty:false});commit(b=>({...b,migrationIds:b.migrationIds.filter(n=>!successful.includes(n))}))}
   const conflicts=ref.current.data.notes.some(n=>n.conflict||n.remoteDeleted)||!!ref.current.data.preferencesConflict;
   setStatus(conflicts?'conflict':'synced');if(conflicts)setError('检测到其他设备的修改，请在同步面板选择保留版本');
  }catch(e){if(valid()){setStatus('offline');setError(e instanceof Error?e.message:'远端同步暂时失败，本机修改仍然保留')}}
  finally{if(running.current===id)running.current=0;}
 },[commit]);
 const dirty=envelope.data.notes.some(n=>n.dirty)||envelope.data.preferencesDirty;
 useEffect(()=>{if(!accountId||envelope.scope!==desiredScope)return;const timer=setTimeout(()=>void sync(),dirty?900:150);return()=>clearTimeout(timer)},[accountId,envelope.scope,desiredScope,dirty,retryKey,sync]);
 useEffect(()=>{if(!accountId||!dirty||status!=='synced')return;const timer=setTimeout(()=>void sync(),1000);return()=>clearTimeout(timer)},[dirty,status,sync,accountId]);
 useEffect(()=>{const again=()=>setRetryKey(n=>n+1);const visible=()=>{if(document.visibilityState==='visible')again()};window.addEventListener('online',again);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('online',again);document.removeEventListener('visibilitychange',visible)}},[]);
 function changeNote(id:string,patch:Partial<PaperNoteData>&{archived?:boolean}){commit(b=>({...b,notes:b.notes.map(n=>n.id===id?{...n,...patch,dirty:true,updatedAt:new Date().toISOString()}:n)}));if(!user)setStatus('local');else if(status==='synced')setStatus('saving');setRetryKey(n=>n+1)}
 function arrangeNotes(positions:{id:string;x:number;y:number}[]){const patches=new Map(positions.map(p=>[p.id,p]));const updatedAt=new Date().toISOString();commit(b=>({...b,preferences:{...b.preferences,hideNotes:false},preferencesDirty:true,notes:b.notes.map(n=>{const p=patches.get(n.id);return p&&!n.deleted&&!n.archived?{...n,x:p.x,y:p.y,dirty:true,updatedAt}:n})}));setStatus(user?'saving':'local');setRetryKey(n=>n+1)}
 function addNote(color:string){const note=newLocalNote(color);note.x=30+Math.random()*40;note.y=35+Math.random()*30;commit(b=>({...b,notes:[...b.notes,note]}));setRetryKey(n=>n+1);return note.id}
 function removeNote(id:string){const note=ref.current.data.notes.find(n=>n.id===id);if(note){removed.current.set(ref.current.scope+':'+id,structuredClone(note));if(removed.current.size>20)removed.current.delete(removed.current.keys().next().value!)}commit(b=>({...b,notes:b.notes.map(n=>n.id===id?{...n,deleted:true,dirty:true}:n)}));setRetryKey(n=>n+1)}
 function restoreNote(id:string){const key=ref.current.scope+':'+id,n=removed.current.get(key);if(!n)return;removed.current.delete(key);commit(b=>({...b,notes:[...b.notes,{...n,id:crypto.randomUUID(),version:0,deleted:false,dirty:true,conflict:undefined,remoteDeleted:false}]}));setRetryKey(n=>n+1)}
 function updatePreferences(patch:Partial<DesktopPreferences>){commit(b=>({...b,preferences:normalizePreferences({...b.preferences,...patch}),preferencesDirty:true}));if(!user)setStatus('local');setRetryKey(n=>n+1)}
 function resolveNote(id:string,local:boolean){commit(b=>({...b,notes:b.notes.flatMap(n=>{
  if(n.id!==id)return[n];
  if(local){if(n.remoteDeleted)return[{...n,id:crypto.randomUUID(),version:0,remoteDeleted:false,conflict:undefined,dirty:true}];return[{...n,version:n.conflict?.version??n.version,conflict:undefined,dirty:true}]}
  return n.conflict?[{...n.conflict,dirty:false}]:[];
 })}));setRetryKey(n=>n+1)}
 function resolvePreferences(local:boolean){commit(b=>{const c=b.preferencesConflict;if(!c)return b;return {...b,preferences:local?b.preferences:normalizePreferences(c.data),preferencesVersion:c.version,preferencesDirty:local,preferencesConflict:undefined}});setRetryKey(n=>n+1)}
 const board=envelope.scope===desiredScope?envelope.data:emptyBoard(false);
 return {board,status,error,storageError,ready:envelope.scope===desiredScope,arrangeNotes,changeNote,addNote,removeNote,restoreNote,updatePreferences,resolveNote,resolvePreferences,retry:()=>setRetryKey(n=>n+1)};
}
