import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const patterns=[
 ['private_key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
 ['aws_access_key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['github_token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
 ['slack_token',/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
 ['stripe_live_secret',/\bsk_live_[A-Za-z0-9]{20,}\b/g],
 ['google_api_key',/\bAIza[A-Za-z0-9_-]{35}\b/g],
];
function findings(text){const rows=[];for(const [kind,expression] of patterns){expression.lastIndex=0;for(const match of text.matchAll(expression))rows.push({kind,line:text.slice(0,match.index).split('\n').length})}return rows;}
function scan(root){
 const names=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean),results=[];let scanned=0;
 for(const name of new Set(names)){
  if(name.startsWith('.git/')||name.startsWith('.codex/')||name.startsWith('.agents/'))continue;
  // Environment/key stores are reported by filename without opening secret bytes.
  if(/(^|\/)\.env(?:$|[._])/.test(name)&&!name.endsWith('.example')){results.push({file:name,line:0,kind:'secret_store_in_repository_inventory'});continue;}
  if(/\.(pem|key|p12|pfx)$/i.test(name)){results.push({file:name,line:0,kind:'key_store_in_repository_inventory'});continue;}
  const full=path.resolve(root,name);if(!full.startsWith(root+path.sep))throw new Error('Invalid repository path');
  let stat;try{stat=fs.lstatSync(full)}catch(error){if(error.code==='ENOENT')continue;throw error}if(!stat.isFile()||stat.size>1024*1024||/\.(png|jpg|jpeg|gif|webp|ico|woff2?|pdf|zip|gpg)$/i.test(name))continue;
  const bytes=fs.readFileSync(full);if(bytes.includes(0))continue;scanned++;for(const item of findings(bytes.toString('utf8')))results.push({file:name,...item});
 }
 return {scanned,findings:results,scope:'working tree tracked and nonignored source; credential stores not opened; git history and container images not scanned'};
}
export {findings,scan};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const report=scan(process.cwd());console.log(JSON.stringify(report,null,2));process.exitCode=report.findings.length?1:0}catch{console.error('Local source scan failed; no file content logged');process.exitCode=2}}
