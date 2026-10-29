import {useEffect,useState} from 'react';
import {LoaderCircle,LogIn,Mail} from 'lucide-react';
import {api,ApiFailure,login} from '@/services/api';
import type {User} from '@/services/desktop-types';
const message=(e:unknown)=>{
 if(e instanceof ApiFailure){const messages:Record<string,string>={INVALID_CREDENTIALS:'邮箱或密码不正确，请检查后重试',EMAIL_ALREADY_REGISTERED:'这个邮箱已经注册过，可以直接登录',APPLICATION_ACCESS_DENIED:'当前账号暂时无法使用此应用，请联系管理员',RATE_LIMITED:'操作过于频繁，请稍后再试'};return messages[e.code]??e.message}
 return e instanceof Error?e.message:'操作暂未成功，请稍后再试';
};
export function AccountForm({onSuccess}:{onSuccess:(user:User)=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState('');
 const [busy,setBusy]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[hint,setHint]=useState(false),[sent,setSent]=useState(false),[cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer)},[cooldown]);
 function changeMode(value:'login'|'register'){setMode(value);setError('');setHint(false);setSent(false)}
 function failed(e:unknown){setError(message(e));setHint(e instanceof ApiFailure&&['EMAIL_ALREADY_REGISTERED','INVALID_CREDENTIALS'].includes(e.code))}
 async function sendCode(){setError('');setHint(false);setSending(true);try{const result=await api<{challengeId:string}>('/auth/register/code',{method:'POST',body:JSON.stringify({email}),signal:AbortSignal.timeout(30000)});setChallenge(result.challengeId);setSent(true);setCooldown(60)}catch(e){failed(e);if(e instanceof ApiFailure&&e.status===429)setCooldown(60)}finally{setSending(false)}}
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');setHint(false);try{
  if(mode==='register'&&(!challenge||!code)){setError('请先获取并填写邮箱验证码');return}
  const result=mode==='login'?await login(email,password):await api<{user:User}>('/auth/register',{method:'POST',body:JSON.stringify({challengeId:challenge,code,password,displayName:name.trim()}),signal:AbortSignal.timeout(30000)});
  setPassword('');onSuccess(result.user);
 }catch(e){failed(e)}finally{setBusy(false)}}
 return <div className="account-form">
  <p className="panel-footnote">匿名设备每天可查询 10 次新壁纸，普通账号每天 50 次；重复使用本机历史不扣次数。每天按北京时间重置。登录仅用于查询额度。</p>
  <div className="account-tabs" role="group" aria-label="账号操作"><button type="button" aria-pressed={mode==='login'} onClick={()=>changeMode('login')} disabled={busy||sending}>登录</button><button type="button" aria-pressed={mode==='register'} onClick={()=>changeMode('register')} disabled={busy||sending}>注册</button></div>
  <form className="desktop-login" onSubmit={submit}>
   <label>邮箱<input type="email" autoComplete="username" required value={email} onChange={e=>{setEmail(e.target.value);setChallenge('');setCode('');setSent(false);setHint(false);setError('')}} maxLength={254} placeholder="请输入邮箱" disabled={busy||sending}/></label>
   {mode==='register'&&<><label>昵称（选填）<input autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)} maxLength={32} disabled={busy}/></label><label>邮箱验证码<div className="account-code-row"><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} pattern="[0-9]{6}" maxLength={6} required placeholder="六位验证码" disabled={busy}/><button type="button" onClick={()=>void sendCode()} disabled={sending||busy||cooldown>0||!/^\S+@\S+\.\S+$/.test(email)}>{sending?<LoaderCircle size={14} className="spin"/>:cooldown?`${cooldown} 秒后重试`:'发送验证码'}</button></div></label>{sent&&<p className="account-code-sent" role="status"><Mail size={13}/>验证码已发送，请查看邮箱和垃圾邮件。</p>}</>}
   <label>密码<input type="password" autoComplete={mode==='register'?'new-password':'current-password'} required minLength={mode==='register'?8:undefined} maxLength={mode==='register'?20:128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
   {mode==='register'&&<p className="panel-footnote">8–20 个字符，不能是纯数字。</p>}
   {error&&<p role="alert" className="panel-error">{error}</p>}
   {hint&&<div className="account-existing-hint"><p>你是否曾在战雷工作台注册过？可以使用相同的邮箱和密码登录这里。</p>{mode==='register'&&<button type="button" onClick={()=>changeMode('login')}>使用已有账号登录</button>}</div>}
   <button type="submit" className="panel-primary" disabled={busy||sending}>{busy?<LoaderCircle size={15} className="spin"/>:<LogIn size={15}/>} {mode==='login'?'登录':'注册并登录'}</button>
   <p className="panel-footnote">便利贴、收藏、壁纸历史与设置仅存当前浏览器，登录后也不上传、不跨设备同步。清除浏览器数据后无法自动恢复，请定期导出备份。</p>
  </form>
 </div>;
}
