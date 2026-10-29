import {useCallback,useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowDownToLine,Archive,LayoutGrid,Check,ChevronRight,Cloud,CloudOff,CloudRain,Expand,Heart,Image,Leaf,LoaderCircle,LogIn,LogOut,Maximize2,Minimize2,MoreHorizontal,NotebookPen,PanelRightClose,Pause,Pencil,Play,Plus,RefreshCw,Settings2,SlidersHorizontal,StickyNote,Sun,Trash2,UserRound,Volume2,Waves,Wind,X,Zap} from 'lucide-react';
import {PaperNote} from '@/components/PaperNote';
import {RainGlass} from './RainGlass';
import {OutdoorRain} from './OutdoorRain';
import {AccountForm} from './AccountForm';
import {GlassPanel} from './GlassPanel';
import {EntryScreen} from './EntryScreen';
import type {EntryOptions} from './EntryScreen';
import {PAPER_COLORS,noteTitle} from '@/lib/notes';
import {arrangeNotePositions} from '@/lib/note-layout';
import {useBoard} from '@/hooks/use-board';
import {api,ApiFailure,logout,API_BASE,CAN_SYNC,CANONICAL_SITE} from '@/services/api';
import {DEFAULT_CONFIG,defaultAudio,SOUND_KINDS} from '@/services/desktop-types';
import type {AudioSettings,AppConfig,ConfigRecord,SoundKind,TrackSettings,User,Wallpaper} from '@/services/desktop-types';
import {highResolutionWallpaper} from '@/services/wallpaper-image';
import {AmbientEngine} from '@/audio/engine';
import {RAIN_PRESETS,rainPresetAudio,rainPresetPreferences,rainSoundIsPlaying} from '@/services/rain-presets';

const sounds:{id:SoundKind;name:string;icon:typeof Wind;a:string;b:string}[]=[{id:'rain',name:'雨声',icon:CloudRain,a:'雨滴密度',b:'雨滴大小'},{id:'wind',name:'风声',icon:Wind,a:'风力',b:'阵风起伏'},{id:'thunder',name:'雷声',icon:Zap,a:'出现频率',b:'远近与回响'},{id:'stream',name:'溪水',icon:Leaf,a:'水流强度',b:'气泡细节'},{id:'ocean',name:'海浪',icon:Waves,a:'浪的大小',b:'涌浪周期'}];
const topics:Record<string,string>={forest:'森林',ocean:'海边',mountain:'山野',rain:'雨天',city:'城市',flowers:'花草',jiangnan:'江南雨巷',wilderness:'荒野'};
type Drawer='sound'|'wallpaper'|'notes'|'note'|'account'|'sync'|null;
const credit='https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB';
function sceneAudio(kind:'rain'|'forest'|'ocean'|'stream'){
 const audio=defaultAudio();for(const track of SOUND_KINDS)audio.tracks[track].enabled=false;
 if(kind==='rain')return rainPresetAudio('medium',audio);
 if(kind==='forest'){audio.tracks.wind.enabled=true;audio.tracks.wind.volume=.6;audio.tracks.stream.enabled=true;audio.tracks.stream.volume=.18}
 if(kind==='ocean'){audio.tracks.ocean.enabled=true;audio.tracks.wind.enabled=true;audio.tracks.wind.volume=.2}
 if(kind==='stream')audio.tracks.stream.enabled=true;
 return audio;
}


export function Desktop(){
 const [user,setUser]=useState<User|null>(null),[config,setConfig]=useState<AppConfig>(DEFAULT_CONFIG),[connected,setConnected]=useState(false);
 const board=useBoard(user),prefs=board.board.preferences;
 const [entered,setEntered]=useState(false),[showIntro,setShowIntro]=useState(true),[introRain,setIntroRain]=useState(true);
 useEffect(()=>{if(!entered)return;const timer=setTimeout(()=>setShowIntro(false),700);return()=>clearTimeout(timer)},[entered]);
 const [selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<string|null>(null),[drawer,setDrawer]=useState<Drawer>(null);
 const [controls,setControls]=useState(true),[playing,setPlaying]=useState(false),[audioBusy,setAudioBusy]=useState(false),[fullscreen,setFullscreen]=useState(false);
 const [photoBusy,setPhotoBusy]=useState(false),[toast,setToast]=useState(''),[deleted,setDeleted]=useState<string|null>(null);

 const canvasRef=useRef<HTMLDivElement>(null),dockRef=useRef<HTMLDivElement>(null),engine=useRef(new AmbientEngine()),hideTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const photoSeq=useRef(0),initialPhoto=useRef(false),latest=useRef({prefs,board,config,drawer});latest.current={prefs,board,config,drawer};
 const visibleNotes=board.board.notes.filter(n=>!n.deleted&&!n.archived),activeNote=visibleNotes.find(n=>n.id===selected);
 useEffect(()=>{if(board.ready&&visibleNotes.length&&!visibleNotes.some(n=>n.id===selected))setSelected(visibleNotes[0].id)},[board.ready,visibleNotes,selected]);
 useEffect(()=>{document.title='静间 · 白噪音与 Markdown 便利贴'},[]);
 const notify=useCallback((message:string)=>setToast(message),[]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>{setToast('');setDeleted(null)},5500);return()=>clearTimeout(timer)},[toast]);
 useEffect(()=>{
  let cancelled=false;
  api<ConfigRecord>('/config').then(c=>{if(!cancelled){setConfig(c.data);setConnected(true)}}).catch(()=>{if(!cancelled)notify('远端暂不可用，你仍然可以在本机使用便利贴和声音')});
  const session=()=>api<{user:User}>('/session').then(s=>{if(!cancelled)setUser(s.user)}).catch(e=>{if(!cancelled&&e instanceof ApiFailure&&[401,403].includes(e.status))setUser(null)});
  if(CAN_SYNC)void session();const visible=()=>{if(CAN_SYNC&&document.visibilityState==='visible')void session()};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',visible)};
 },[notify]);
 useEffect(()=>{engine.current.update(prefs.audio,config.sound)},[prefs.audio,config.sound]);
 useEffect(()=>()=>{void engine.current.close()},[]);
 const showControls=useCallback(()=>{setControls(true);clearTimeout(hideTimer.current);hideTimer.current=setTimeout(()=>{if(!latest.current.drawer&&!dockRef.current?.matches(':hover')&&!dockRef.current?.contains(document.activeElement))setControls(false)},3500)},[]);
 useEffect(()=>{showControls();const move=(event:PointerEvent)=>{if(event.pointerType==='touch'||event.clientY>innerHeight-110)showControls()};window.addEventListener('pointermove',move,{passive:true});return()=>{clearTimeout(hideTimer.current);window.removeEventListener('pointermove',move)}},[showControls]);
 useEffect(()=>{if(drawer){setControls(true);clearTimeout(hideTimer.current)}else showControls()},[drawer,showControls]);
 useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});else notify('此浏览器不支持原生全屏，页面已铺满当前窗口')}catch{notify('浏览器暂未允许全屏，请再次点击全屏按钮')}}
 async function toggleAudio(next?:AudioSettings){if(audioBusy)return;setAudioBusy(true);try{if(playing&&!next){await engine.current.pause();setPlaying(false)}else{await engine.current.play(next??latest.current.prefs.audio,latest.current.config.sound);setPlaying(true)}}catch(e){notify(e instanceof Error?e.message:'声音暂时无法播放')}finally{setAudioBusy(false)}}
 function changeAudio(patch:Partial<AudioSettings>){board.updatePreferences({audio:{...prefs.audio,...patch}})}
 function changeTrack(kind:SoundKind,patch:Partial<TrackSettings>){changeAudio({tracks:{...prefs.audio.tracks,[kind]:{...prefs.audio.tracks[kind],...patch}}})}
 function preset(kind:'rain'|'forest'|'ocean'|'stream'){
  const audio=sceneAudio(kind);board.updatePreferences({audio});void toggleAudio(audio);
 }
 function rainPreset(id:string){const patch=rainPresetPreferences(id,prefs);board.updatePreferences(patch);void toggleAudio(patch.audio)}
 async function previewThunder(){if(audioBusy)return;setAudioBusy(true);try{await engine.current.play(latest.current.prefs.audio,latest.current.config.sound);engine.current.previewThunder();setPlaying(true)}catch(e){notify(e instanceof Error?e.message:'雷声暂时无法播放')}finally{setAudioBusy(false)}}
 function enterDesktop(options:EntryOptions){
  if(!board.ready||entered)return;
  const audio=sceneAudio(options.scene);
  // Both capabilities start directly in the button gesture, before awaiting work.
  if(options.fullscreen&&!document.fullscreenElement)void toggleFullscreen();
  board.updatePreferences({audio,rainGlass:options.rain,glassFalling:options.rain});
  setEntered(true);showControls();
  if(options.sound)void toggleAudio(audio);
 }
 function openEntrance(){
  if(!entered)return;
  setDrawer(null);setEditing(null);setIntroRain(true);setShowIntro(true);setEntered(false);
  void engine.current.pause();setPlaying(false);
 }

 async function nextWallpaper(topic=latest.current.prefs.topic){
  const seq=++photoSeq.current;setPhotoBusy(true);
  try{const current=latest.current.prefs.wallpaper;const data=await api<{items:Wallpaper[]}>(`/wallpapers?topic=${encodeURIComponent(topic)}&exclude=${encodeURIComponent(current?.id??'')}`);const result=data.items[0];if(!result)throw new Error('这个主题暂时没有可用壁纸');const photo=highResolutionWallpaper(result);
   await new Promise<void>((resolve,reject)=>{const image=new window.Image();const timeout=setTimeout(()=>{image.onload=null;image.onerror=null;reject(new Error('壁纸加载超时，当前画面会保留'))},30000);image.onload=()=>{clearTimeout(timeout);resolve()};image.onerror=()=>{clearTimeout(timeout);reject(new Error('壁纸暂时无法加载，当前画面会保留'))};image.src=photo.url});
   if(seq!==photoSeq.current)return;latest.current.board.updatePreferences({wallpaper:photo,topic});
   void api<void>('/wallpaper/use',{method:'POST',body:JSON.stringify({id:photo.id})}).catch(()=>{setTimeout(()=>{void api<void>('/wallpaper/use',{method:'POST',body:JSON.stringify({id:photo.id})}).catch(()=>{})},3000)});
  }catch(e){if(seq===photoSeq.current)notify(e instanceof Error?e.message:'壁纸暂时不可用')}finally{if(seq===photoSeq.current)setPhotoBusy(false)}
 }
 const nextPhotoRef=useRef(nextWallpaper);nextPhotoRef.current=nextWallpaper;
 useEffect(()=>{if(!board.ready||initialPhoto.current)return;initialPhoto.current=true;if(!prefs.wallpaper)void nextPhotoRef.current()},[board.ready,prefs.wallpaper]);
 useEffect(()=>{if(!config.wallpaper.allowAuto||!prefs.autoWallpaper)return;const timer=setInterval(()=>{if(!document.hidden)void nextPhotoRef.current()},Math.max(5,config.wallpaper.intervalMinutes)*60000);return()=>clearInterval(timer)},[config.wallpaper.allowAuto,config.wallpaper.intervalMinutes,prefs.autoWallpaper]);
 function addNote(){if(board.board.notes.filter(n=>!n.deleted).length>=config.maxNotes){notify('当前便利贴数量已达到上限');return}const id=board.addNote(config.defaultPaperColor);setSelected(id);setEditing(id);showControls()}
 function arrangeNotes(){
  const area=canvasRef.current?.getBoundingClientRect()??{width:innerWidth- (innerWidth<=760?36:52),height:innerHeight-(innerWidth<=760?185:130)};
  board.arrangeNotes(arrangeNotePositions(visibleNotes,area.width,area.height,{width:innerWidth,height:innerHeight}));
  setEditing(null);setDrawer(null);showControls();notify('已按纸张大小整理便利贴');
 }
 const actions=useRef({addNote,toggleAudio,toggleFullscreen});actions.current={addNote,toggleAudio,toggleFullscreen};
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(!entered)return;if(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable))return;if(event.ctrlKey||event.metaKey||event.altKey)return;if(event.key.toLowerCase()==='f'){event.preventDefault();void actions.current.toggleFullscreen()}if(event.key.toLowerCase()==='n'){event.preventDefault();actions.current.addNote()}if(event.code==='Space'){event.preventDefault();void actions.current.toggleAudio()}if(event.key.toLowerCase()==='h'){event.preventDefault();latest.current.board.updatePreferences({hideNotes:!latest.current.prefs.hideNotes});setControls(false)}if(event.key==='Escape'){setDrawer(null);setEditing(null);showControls()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[showControls,entered]);

 async function signOut(){try{await logout();setUser(null);setSelected(null);setEditing(null);notify('已退出登录，账号笔记保留在独立本机空间')}catch(e){notify(e instanceof Error?e.message:'退出失败，请重试')}}
 function exportNotes(){const data={format:'rainy-wallpaper-notes',version:1,notes:board.board.notes.filter(n=>!n.deleted).map(({dirty:_d,conflict:_c,...n})=>n),preferences:prefs};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='我的便利贴-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function favorite(){const photo=prefs.wallpaper;if(!photo)return;const exists=prefs.favoritePhotos.some(p=>p.id===photo.id);board.updatePreferences({favoritePhotos:exists?prefs.favoritePhotos.filter(p=>p.id!==photo.id):[photo,...prefs.favoritePhotos].slice(0,20)})}
 function removeFavorite(id:string){
  board.updatePreferences({favoritePhotos:prefs.favoritePhotos.filter(photo=>photo.id!==id)});
  notify('已从收藏移除');
 }

 const title:Record<Exclude<Drawer,null>,string>={sound:'听见此刻',wallpaper:'窗外与雨玻璃',notes:'纸上的小事',note:'这张便利贴',account:user?'我的账号':'登录 / 注册',sync:'本机与云端'};
 const glassActive=entered?prefs.rainGlass:introRain;
 const rainPlaying=rainSoundIsPlaying(playing,prefs.audio,config.sound);
 const outdoorActive=rainPlaying&&(entered?prefs.glassFalling:introRain);
 const selectedNote=activeNote??visibleNotes[0];
 const syncText=board.storageError?'本机保存失败':{loading:'读取本机',local:'已存本机',saving:'同步中',synced:'已同步',offline:'本机已保留',conflict:'有版本待确认'}[board.status];
 return <main className={`note-app desktop-app ${controls?'controls-visible':''} ${entered?'':'is-entrance'}`} style={{'--wallpaper-dim':prefs.dim,'--glass-blur':`${prefs.glassBlur*14}px`} as CSSProperties}>
  <div className="wallpaper-layer" style={prefs.wallpaper?{backgroundImage:`url("${prefs.wallpaper.url}")`,backgroundColor:prefs.wallpaper.color}:undefined}/><div className="wallpaper-shade"/>
  {outdoorActive&&prefs.outdoorRain>0&&<OutdoorRain intensity={prefs.outdoorRain} wind={prefs.outdoorWind}/>}
  {!entered&&<div className="entry-vignette" aria-hidden="true"/>}
  {glassActive&&<RainGlass raining={outdoorActive&&prefs.outdoorRain>0} rainfall={prefs.outdoorRain} density={prefs.glassDensity} wind={prefs.audio.tracks.wind.enabled?prefs.audio.tracks.wind.intensity:.15} size={prefs.glassSize} refraction={prefs.glassRefraction} pinned={prefs.glassPinned} speed={prefs.glassSpeed} wallpaper={prefs.wallpaper?.url??''}/>}
  <button type="button" className="desktop-wordmark" onClick={openEntrance} aria-label="返回静间首页" title="返回首页"><CloudRain size={20} strokeWidth={1.2}/><span>静间</span><small>JUST BE HERE.</small></button>
  {showIntro&&<EntryScreen leaving={entered} ready={board.ready} onEnter={enterDesktop} onRainChange={setIntroRain} onSceneChange={scene=>{const topic=scene==='rain'?'rain':scene;if(config.wallpaper.topics.includes(topic))void nextPhotoRef.current(topic)}}/>}
  {entered&&!prefs.hideNotes&&<div className="paper-board desktop-board" ref={canvasRef} onPointerDown={e=>{if(e.target===e.currentTarget){setSelected(null);setEditing(null)}}} onClick={e=>{if(e.target===e.currentTarget)showControls()}}>
   {visibleNotes.map(note=><PaperNote allowOverflow key={note.id} note={note} selected={note.id===selected} boardRef={canvasRef} onSelect={()=>setSelected(note.id)} onChange={patch=>board.changeNote(note.id,patch)} editing={editing===note.id} onEditingChange={value=>setEditing(value?note.id:null)}/>)}
  </div>}
  {entered&&prefs.hideNotes&&<button type="button" className="wake-surface" aria-label="唤出桌面控制条" onClick={showControls}/>}
  <button type="button" className={`desktop-sync ${controls?'':'is-quiet'}`} onClick={()=>setDrawer('sync')} title={syncText}>{user?<Cloud size={13}/>:<StickyNote size={13}/>}<span>{syncText}</span></button>
  {entered&&visibleNotes.length===0&&board.ready&&!prefs.hideNotes&&<button type="button" className="empty-desktop" onClick={addNote}><Plus size={22}/><span>贴一张，记下此刻</span></button>}
  <div className="dock-wake-zone" onPointerEnter={showControls} onClick={showControls}/>
  <div className="desktop-dock" ref={dockRef} onPointerEnter={showControls} onFocusCapture={showControls} aria-label="桌面控制条">
   <button type="button" className="dock-play" onClick={()=>void toggleAudio()} aria-label={playing?'暂停白噪音':'播放白噪音'} title="播放 / 暂停（空格）" disabled={audioBusy}>{audioBusy?<LoaderCircle size={19} className="spin"/>:playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button>
   <button type="button" className="dock-sound-label" onClick={()=>setDrawer('sound')}><span>{playing?'此刻，慢下来':'听一会儿自然'}</span><small>{sounds.filter(s=>prefs.audio.tracks[s.id].enabled).map(s=>s.name).join(' · ')||'选择喜欢的声音'}</small></button>
   <span className="dock-divider"/>
   <DockButton label="调节声音" active={drawer==='sound'} onClick={()=>setDrawer('sound')}><SlidersHorizontal size={18}/></DockButton>
   <DockButton label="换一张壁纸" onClick={()=>void nextWallpaper()} disabled={photoBusy}>{photoBusy?<LoaderCircle size={18} className="spin"/>:<RefreshCw size={17}/>}</DockButton>
   <DockButton label="选择壁纸与雨窗" active={drawer==='wallpaper'} onClick={()=>setDrawer('wallpaper')}><Image size={18}/></DockButton>
   <span className="dock-divider"/>
   <DockButton label="新便利贴（N）" onClick={addNote}><Plus size={20}/></DockButton>
   <DockButton label="全部便利贴" active={drawer==='notes'} onClick={()=>setDrawer('notes')}><NotebookPen size={18}/></DockButton>
   <DockButton label="一键整理便利贴" onClick={arrangeNotes} disabled={!visibleNotes.length}><LayoutGrid size={17}/></DockButton>
   <DockButton label={fullscreen?'退出全屏':'全屏沉浸（F）'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</DockButton>
   <DockButton label="账号与设置" active={drawer==='account'} onClick={()=>setDrawer('account')}><UserRound size={18}/></DockButton>
  </div>
  <div className="desktop-shortcuts" aria-hidden={!controls}>空格 播放 / 暂停 <span>·</span> N 贴一张 <span>·</span> F 全屏 <span>·</span> H 隐藏 / 显示便利贴</div>
  {prefs.wallpaper&&<div className="wallpaper-attribution"><a href={prefs.wallpaper.authorUrl} target="_blank" rel="noopener noreferrer">{prefs.wallpaper.author}</a><span> / </span><a href={prefs.wallpaper.sourceUrl} target="_blank" rel="noopener noreferrer">Unsplash</a></div>}
  <a className="qmuse-credit" href={credit} target="_blank" rel="noopener noreferrer">本应用通过QMuseVibeCoding平台搭建</a>
  <Dialog.Root open={!!drawer} onOpenChange={open=>{if(!open)setDrawer(null)}}><Dialog.Portal><Dialog.Overlay className="desktop-panel-overlay"/><Dialog.Content className="desktop-panel" aria-describedby="panel-description"><header><div><p className="panel-eyebrow">A LITTLE ROOM FOR YOURSELF</p><Dialog.Title>{drawer?title[drawer]:''}</Dialog.Title></div><Dialog.Close className="panel-close" aria-label="收起面板"><X size={18}/></Dialog.Close></header><Dialog.Description id="panel-description" className="panel-description">{drawer==='sound'?'每一种声音，都可以慢慢调。':drawer==='note'?'Markdown 写下想法，纸张留住温度。':drawer==='wallpaper'?'换一种风景，也换一种心情。':drawer==='account'?'不登录也能使用，登录后可在不同设备同步。':'留住此刻，也给下一次相遇。'}</Dialog.Description>
   <div className="desktop-panel-body">
   {drawer==='sound'&&<>
    <div className="sound-presets">{(['rain','forest','stream','ocean']as const).map(k=><button type="button" key={k} onClick={()=>preset(k)}>{({rain:'雨夜',forest:'林间',stream:'溪谷',ocean:'海边'})[k]}</button>)}</div>
    <div className="rain-sound-presets" role="group" aria-label="雨声与天气预设">{RAIN_PRESETS.map(p=><button type="button" key={p.id} aria-pressed={(['rain','wind','thunder']as const).every(kind=>Object.entries(p[kind]).every(([key,value])=>prefs.audio.tracks[kind][key as keyof TrackSettings]===value))&&prefs.outdoorRain===p.outdoorRain&&prefs.outdoorWind===p.outdoorWind} disabled={audioBusy||!config.sound.enabled||!config.sound.allowed.includes('rain')} onClick={()=>rainPreset(p.id)} title={p.description}><strong>{p.name}</strong><small>{p.description}</small></button>)}</div>
    <Range label="总音量" value={prefs.audio.master} max={config.sound.masterLimit} onChange={value=>changeAudio({master:value})}/>
    <Toggle label="自然随机变化" description="在你的设置范围里，缓慢变化强弱与细节" checked={prefs.audio.random&&config.sound.randomEnabled} onChange={value=>changeAudio({random:value})} disabled={!config.sound.randomEnabled}/>
    {prefs.audio.random&&<Range label="变化幅度" value={Math.min(prefs.audio.variation,config.sound.variationMax)} max={config.sound.variationMax} onChange={value=>changeAudio({variation:value})}/>}
    <div className="sound-tracks">{sounds.map(s=>{const track=prefs.audio.tracks[s.id],allowed=config.sound.allowed.includes(s.id)&&config.sound.enabled;return <section className={`sound-track ${track.enabled?'enabled':''}`} key={s.id}><div className="track-heading"><s.icon size={19}/><h3>{s.name}</h3><Toggle label={`开启${s.name}`} compact checked={track.enabled&&allowed} disabled={!allowed} onChange={value=>changeTrack(s.id,{enabled:value})}/></div>{track.enabled&&allowed&&<div className="track-controls"><Range label="音量" value={track.volume} max={s.id==='thunder'?config.sound.thunderLimit:1} onChange={value=>changeTrack(s.id,{volume:value})}/><Range label={s.a} value={track.intensity} onChange={value=>changeTrack(s.id,{intensity:value})}/><Range label={s.b} value={track.detail} onChange={value=>changeTrack(s.id,{detail:value})}/><Range label="音色明亮度" value={track.brightness} onChange={value=>changeTrack(s.id,{brightness:value})}/>{s.id==='thunder'&&<button type="button" className="panel-secondary" onClick={()=>void previewThunder()} disabled={audioBusy||track.volume<=0||prefs.audio.master<=0||config.sound.thunderLimit<=0||config.sound.masterLimit<=0}><Zap size={14}/>试听雷声</button>}</div>}</section>})}</div>
    <p className="panel-footnote">雨声播放时才会下雨；暂停或关闭雨声后停雨。开启雷声后约 1–3 秒出现首声，之后按频率自然间隔，也可点击试听。</p>
   </>}
   {drawer==='wallpaper'&&<>
    <GlassPanel preferences={prefs} onChange={board.updatePreferences}/>
    <h3 className="panel-subheading wallpaper-section-title">窗外的世界</h3>
    <div className="wallpaper-topics">{config.wallpaper.topics.map(t=><button type="button" className={prefs.topic===t?'active':''} key={t} onClick={()=>void nextWallpaper(t)} disabled={photoBusy}>{topics[t]??t}</button>)}</div>
    <button type="button" className="panel-primary" onClick={()=>void nextWallpaper()} disabled={photoBusy}>{photoBusy?<LoaderCircle className="spin" size={15}/>:<RefreshCw size={15}/>}换一张风景</button>
    <button type="button" className="panel-secondary" onClick={favorite} disabled={!prefs.wallpaper}><Heart size={15} fill={prefs.favoritePhotos.some(p=>p.id===prefs.wallpaper?.id)?'currentColor':'none'}/>{prefs.favoritePhotos.some(p=>p.id===prefs.wallpaper?.id)?'已收藏这张壁纸':'收藏这张壁纸'}</button>
    {prefs.wallpaper&&<a className="panel-secondary" href={`${API_BASE}/wallpaper/download/${encodeURIComponent(prefs.wallpaper.id)}`} download target="_blank" rel="noopener noreferrer"><ArrowDownToLine size={15}/>下载高清原图</a>}
    <Range label="让背景暗一点" value={prefs.dim} max={.8} onChange={value=>board.updatePreferences({dim:value})}/>
    {config.wallpaper.allowAuto&&<Toggle label="自动换风景" description={`每 ${config.wallpaper.intervalMinutes} 分钟换一张`} checked={prefs.autoWallpaper} onChange={value=>board.updatePreferences({autoWallpaper:value})}/>}
    <p className="wallpaper-quality">优先 4K 风景 · 下载保留原始尺寸{prefs.wallpaper?.width&&prefs.wallpaper?.height?` · ${prefs.wallpaper.width} × ${prefs.wallpaper.height}`:''}</p>
    {prefs.favoritePhotos.length>0&&<section className="favorite-photos"><h3>喜欢的风景</h3><div>{prefs.favoritePhotos.map(p=><div className="favorite-photo-item" key={p.id}>
     <button className="favorite-photo-use" type="button" onClick={()=>{board.updatePreferences({wallpaper:highResolutionWallpaper(p)});void api('/wallpaper/use',{method:'POST',body:JSON.stringify({id:p.id})}).catch(()=>{})}} aria-label={`使用 ${p.author} 的壁纸`} aria-pressed={prefs.wallpaper?.id===p.id}><img src={p.thumb} alt={p.description} loading="lazy"/></button>
     <button className="favorite-photo-remove" type="button" onClick={()=>removeFavorite(p.id)} aria-label={`从收藏移除 ${p.author} 的壁纸`} title="从收藏移除"><Trash2 size={13}/></button>
    </div>)}</div></section>}
   </>}
   {drawer==='notes'&&<>
    <button type="button" className="panel-primary" onClick={()=>{addNote();setDrawer(null)}}><Plus size={16}/>贴一张新便利贴</button>
    <button type="button" className="panel-secondary" disabled={!visibleNotes.length} onClick={arrangeNotes}><LayoutGrid size={16}/>一键整理便利贴</button>
    <Toggle label="隐藏便利贴" checked={prefs.hideNotes} onChange={value=>board.updatePreferences({hideNotes:value})}/>
    <div className="note-list">{board.board.notes.filter(n=>!n.deleted).map(n=><div className="note-list-row" key={n.id}><button type="button" onClick={()=>{setSelected(n.id);if(n.archived)board.changeNote(n.id,{archived:false});board.updatePreferences({hideNotes:false});setDrawer('note')}}><span style={{background:n.color}}/><div><strong>{noteTitle(n.markdown)}</strong><small>{n.archived?'已收起':n.dirty?'本机已保留':'已同步'}</small></div></button><button type="button" aria-label={n.archived?'展开便利贴':'收起便利贴'} onClick={()=>board.changeNote(n.id,{archived:!n.archived})}><Archive size={15}/></button><button type="button" aria-label="移除便利贴" onClick={()=>{board.removeNote(n.id);setDeleted(n.id);notify('已移除便利贴，可撤销')}}><Trash2 size={15}/></button></div>)}</div>
    <button type="button" className="panel-secondary" onClick={exportNotes}><ArrowDownToLine size={15}/>导出全部便利贴</button>
   </>}
   {drawer==='note'&&selectedNote&&<>
    <label className="desktop-markdown-label">Markdown 原文<textarea className="desktop-markdown-source" value={selectedNote.markdown} maxLength={20000} spellCheck={false} onChange={e=>board.changeNote(selectedNote.id,{markdown:e.target.value})}/></label>
    <h3 className="panel-subheading">纸张颜色</h3><div className="desktop-paper-colors">{PAPER_COLORS.map(c=><button type="button" key={c.value} style={{background:c.value}} aria-label={c.name} aria-pressed={selectedNote.color===c.value} onClick={()=>board.changeNote(selectedNote.id,{color:c.value})}>{selectedNote.color===c.value&&<Check size={16}/>}</button>)}<input type="color" aria-label="自定义纸色" value={selectedNote.color} onChange={e=>board.changeNote(selectedNote.id,{color:e.target.value})}/></div>
    <div className="desktop-dimensions"><label>宽度<input type="number" min={180} max={1000} value={selectedNote.width} onChange={e=>board.changeNote(selectedNote.id,{width:Math.min(1000,Math.max(180,Number(e.target.value)))})}/><span>px</span></label><label>高度<input type="number" min={160} max={1000} value={selectedNote.height} onChange={e=>board.changeNote(selectedNote.id,{height:Math.min(1000,Math.max(160,Number(e.target.value)))})}/><span>px</span></label></div>
    <Range label="随手贴的角度" value={selectedNote.angle} min={-8} max={8} step={.1} display={`${selectedNote.angle.toFixed(1)}°`} onChange={value=>board.changeNote(selectedNote.id,{angle:value})}/><Range label="纸角翘起" value={selectedNote.curl} onChange={value=>board.changeNote(selectedNote.id,{curl:value})}/><Toggle label="纸胶带" checked={selectedNote.tape} onChange={value=>board.changeNote(selectedNote.id,{tape:value})}/>
    <button type="button" className="panel-secondary" onClick={()=>{setSelected(selectedNote.id);setEditing(selectedNote.id);setDrawer(null)}}><Pencil size={15}/>回到纸上编辑与拖拽尺寸</button>
   </>}
   {drawer==='note'&&!selectedNote&&<p className="panel-footnote">先选中或新增一张便利贴。</p>}
   {drawer==='account'&&<>
    {user?<div className="account-card"><span className="account-avatar"><UserRound size={24}/></span><strong>{user.displayName??user.email??'我的账号'}</strong><small>{user.email}</small><span className="account-sync-label"><Cloud size={13}/>{syncText}</span><button type="button" className="panel-secondary" onClick={()=>void signOut()}><LogOut size={14}/>退出登录</button></div>:CAN_SYNC?<AccountForm onSuccess={account=>{setUser(account);setDrawer(null);notify('已登录，正在合并并同步本机草稿')}}/>:<div className="account-site-link"><p className="panel-footnote">在这里无需登录，便利贴会保存在当前浏览器。需要登录、注册或跨设备同步时，请打开独立站。两个站点的本机草稿分别保存，可以先导出备份。</p><a className="panel-primary" href={CANONICAL_SITE} target="_blank" rel="noopener noreferrer"><LogIn size={15}/>打开独立站登录 / 注册</a></div>}
    <button type="button" className="panel-secondary" onClick={()=>setDrawer('sync')}><Cloud size={15}/>查看保存与同步状态<ChevronRight size={14}/></button><button type="button" className="panel-secondary" onClick={exportNotes}><ArrowDownToLine size={15}/>导出本机备份</button>
    {user?.isSuperAdmin&&<a className="panel-secondary" href="https://orbit.mrtreasure.cc/rainy-wallpaper/#/admin" target="_blank" rel="noopener noreferrer"><Settings2 size={15}/>在 Orbit 管理本应用</a>}
    <p className="panel-footnote">按 F 进入全屏；移动鼠标到底部或轻触背景唤出操作。页面使用浏览器支持的原生全屏能力。</p>
   </>}
   {drawer==='sync'&&<>
    <div className="sync-card">{board.status==='offline'?<CloudOff size={27}/>:user?<Cloud size={27}/>:<StickyNote size={27}/>}<h3>{syncText}</h3><p>{board.storageError?'本机持久存储暂不可用，请先导出当前内容。':user?'账号内容在本机保留一份，联网后自动同步。':'内容保存在当前浏览器，不需要账号。登录后才会同步到账号。'}</p></div>
    {board.error&&<p className="panel-error" role="status">{board.error}</p>}
    {user&&<button type="button" className="panel-primary" onClick={board.retry}><RefreshCw size={15}/>重新同步</button>}
    {board.board.notes.filter(n=>n.conflict||n.remoteDeleted).map(n=><div className="conflict-card" key={n.id}><h4>{noteTitle(n.markdown)}</h4><p>{n.remoteDeleted?'其他设备已移除这张便利贴。':'其他设备也修改了这张便利贴。'}</p><div><button type="button" onClick={()=>board.resolveNote(n.id,true)}>保留本机版本</button><button type="button" onClick={()=>board.resolveNote(n.id,false)}>采用远端版本</button></div></div>)}
    {board.board.preferencesConflict&&<div className="conflict-card"><h4>桌面设置有更新</h4><div><button type="button" onClick={()=>board.resolvePreferences(true)}>保留本机设置</button><button type="button" onClick={()=>board.resolvePreferences(false)}>采用远端设置</button></div></div>}
    <button type="button" className="panel-secondary" onClick={exportNotes}><ArrowDownToLine size={15}/>先导出一份备份</button>
    {!user&&<button type="button" className="panel-secondary" onClick={()=>setDrawer('account')}><LogIn size={15}/>登录后同步</button>}
   </>}
   </div><footer className="desktop-panel-footer"><span className={`status-dot ${connected?'':'offline'}`}/>{user?'账号同步':'本机优先，安心记录'}<span>静间</span></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  {toast&&<div className="desktop-toast" role="status"><span>{toast}</span>{deleted&&<button type="button" onClick={()=>{board.restoreNote(deleted);setDeleted(null);setToast('已恢复便利贴')}}>撤销</button>}<button type="button" aria-label="关闭提示" onClick={()=>{setToast('');setDeleted(null)}}><X size={13}/></button></div>}
 </main>;
}
function DockButton({label,active,onClick,disabled,children}:{label:string;active?:boolean;onClick:()=>void;disabled?:boolean;children:React.ReactNode}){return <button type="button" className={`dock-button ${active?'active':''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>}
function Range({label,value,onChange,min=0,max=1,step=.01,display}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number;display?:string}){return <label className="desktop-range"><span>{label}<output>{display??Math.round(Math.min(max,value)*100)+'%'}</output></span><input type="range" min={min} max={max} step={step} value={Math.min(max,Math.max(min,value))} onChange={e=>onChange(Number(e.target.value))}/></label>}
function Toggle({label,description,checked,onChange,disabled,compact}:{label:string;description?:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean;compact?:boolean}){return <div className={`desktop-toggle-row ${compact?'compact':''}`}>{!compact&&<div><span>{label}</span>{description&&<small>{description}</small>}</div>}<button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={()=>onChange(!checked)}><span/></button></div>}
