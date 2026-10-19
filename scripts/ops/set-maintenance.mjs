import {open,rename,unlink,stat,lstat} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
const [path,mode,message,expectedEndAt,...extra]=process.argv.slice(2);
if(!path||!isAbsolute(path)||!['on','off'].includes(mode)||!message||message.trim().length<3||message.trim().length>500||extra.length||(expectedEndAt&&!z.iso.datetime({offset:true}).safeParse(expectedEndAt).success)){console.error('Usage: node scripts/ops/set-maintenance.mjs /absolute/operator/state.json on|off "reason" [ISO expected end]');process.exit(1)}
const parent=await stat(dirname(path));if(!parent.isDirectory()||(parent.mode&0o022)!==0)throw new Error('Operator directory must not be group/world writable');
try{const current=await lstat(path);if(!current.isFile()||current.isSymbolicLink()||(current.mode&0o022)!==0)throw new Error('Existing state must be a safe regular file')}catch(e){if(e.code!=='ENOENT')throw e}
const temp=path+'.'+randomUUID(),data=JSON.stringify({maintenance:mode==='on',message:message.trim(),...(expectedEndAt?{expectedEndAt:new Date(expectedEndAt).toISOString()}:{})})+'\n';
let file;
try{file=await open(temp,'wx',0o640);await file.writeFile(data);await file.sync();await file.close();file=undefined;await rename(temp,path);const directory=await open(dirname(path),'r');try{await directory.sync()}finally{await directory.close()}console.info(mode==='on'?'Drain enabled; already admitted operations may finish; preserve local queues.':'Drain disabled; retry original pending operation keys.')}finally{await file?.close().catch(()=>undefined);await unlink(temp).catch(()=>undefined)}
