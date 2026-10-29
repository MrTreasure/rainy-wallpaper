import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist-pages/',root);
await rm(out,{recursive:true,force:true});await mkdir(new URL('assets/',out),{recursive:true});
await cp(new URL('dist/index.html',root),new URL('index.html',out));
for(const name of await readdir(new URL('dist/assets/',root))){if(/\.(js|css)$/.test(name))await cp(new URL('dist/assets/'+name,root),new URL('assets/'+name,out))}
const csp="default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self' https://static.cloudflareinsights.com; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.unsplash.com; font-src 'self' data:; connect-src 'self' https://api.mrtreasure.cc https://cloudflareinsights.com";
await writeFile(new URL('_headers',out),`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n/\n  Cache-Control: no-store\n/index.html\n  Cache-Control: no-store\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
const html=await readFile(new URL('index.html',out),'utf8');
if(!html.includes('/assets/'))throw Error('Pages build must use the root base path');
console.log('Pages assets prepared; scripts/styles are immutable and HTML revalidates.');
