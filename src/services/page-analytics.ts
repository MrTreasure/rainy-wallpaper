/** Optional official aggregate page analytics. Never sends note/query/identity events. */
export function installPageAnalytics(){
 const token=import.meta.env.VITE_CF_ANALYTICS_TOKEN;
 if(location.origin!=='https://rain.mrtreasure.cc'||!token||!/^[a-f0-9]{32}$/i.test(token))return;
 const install=()=>{if(document.querySelector('script[data-cf-beacon],script[src^="https://static.cloudflareinsights.com/beacon.min.js"]'))return;const script=document.createElement('script');script.defer=true;script.src='https://static.cloudflareinsights.com/beacon.min.js';script.dataset.cfBeacon=JSON.stringify({token,spa:false});document.head.append(script)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
