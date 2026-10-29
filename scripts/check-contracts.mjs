import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const pinned=JSON.parse(await readFile(new URL('contracts/manifest.json',root),'utf8'));
for(const [path,expected] of Object.entries(pinned)){
 const actual=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
 if(actual!==expected)throw Error(`Protobuf contract changed: ${path}. Update the canonical contract and all consumers before changing the pinned digest.`);
}
console.log(`Protobuf snapshots verified: ${Object.keys(pinned).length}`);
// The private monorepo gate remains mandatory when that registry is available.
const shared=new URL('../service-contracts/scripts/check.mjs',root);
let available=true;try{await access(shared)}catch(error){if(error.code!=='ENOENT')throw error;available=false}
if(available){const result=spawnSync(process.execPath,[shared.pathname],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
