import type { User } from './desktop-types';
export const API_BASE=(import.meta.env.VITE_API_BASE_URL||'https://api.mrtreasure.cc/v1/rainy-wallpaper').replace(/\/$/,'');
export const IDENTITY_BASE=(import.meta.env.VITE_IDENTITY_BASE_URL||'https://api.mrtreasure.cc/v1/auth').replace(/\/$/,'');
export const CANONICAL_SITE=import.meta.env.VITE_CANONICAL_SITE||'https://rain.mrtreasure.cc/';
export const CAN_AUTH=typeof location==='undefined'||location.origin===new URL(CANONICAL_SITE).origin||location.hostname===new URL(API_BASE).hostname||location.hostname.endsWith('.mrtreasure.cc')||['localhost','127.0.0.1'].includes(location.hostname);
export class ApiFailure extends Error {constructor(public status:number,public code:string,message:string,public current?:unknown){super(message)}}
export async function requestJSON<T>(url:string,init:RequestInit={},account?:string):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{...init,credentials:CAN_AUTH?'include':'omit',headers:{...(init.body?{'Content-Type':'application/json'}:{}),...(account?{'X-Account-Id':account}:{}),...init.headers},signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)})}catch(error){if(init.signal?.aborted)throw error;throw new ApiFailure(0,'NETWORK_UNAVAILABLE','网络暂时不可用，本机内容仍然保留')}
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new ApiFailure(response.status,error.code??'REQUEST_FAILED',error.message??error.error??`请求失败（${response.status}）`,error.current)}
 return (response.status===204?undefined:await response.json()) as T;
}
export function api<T>(path:string,init:RequestInit={},account?:string){return requestJSON<T>(API_BASE+path,init,account)}
export async function login(email:string,password:string){return requestJSON<{user:User}>(IDENTITY_BASE+'/email/login',{method:'POST',body:JSON.stringify({email,password,applicationId:'rainy-wallpaper'})})}
export function logout(){return requestJSON<void>(IDENTITY_BASE+'/session',{method:'DELETE'})}
