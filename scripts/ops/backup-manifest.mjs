import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const hash=async file=>{const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);return digest.digest('hex');};
const allowed=['APP_ORIGIN','POS_FILE_QUOTA_BYTES','RECONCILE_INTERVAL_MS'];
async function main(){
const [mode,file,output]=process.argv.slice(2);
if(mode==='write'){
 const appVersion=process.env.POS_BACKUP_APP_VERSION;
 if(!appVersion||appVersion.length>200||!/^[a-zA-Z0-9._:@/+\-]+$/.test(appVersion))throw new Error('Explicit POS_BACKUP_APP_VERSION is required');
 const recoveryReference=process.env.POS_SECRET_RECOVERY_REFERENCE;
 if(!recoveryReference||recoveryReference.length>500)throw new Error('Explicit POS_SECRET_RECOVERY_REFERENCE is required; never place secret values here');
 const configuration=Object.fromEntries(allowed.filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 if(configuration.APP_ORIGIN){const origin=new URL(configuration.APP_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.origin!==configuration.APP_ORIGIN)throw new Error('Backup APP_ORIGIN must be an exact HTTPS origin');}
 if(configuration.POS_FILE_QUOTA_BYTES&&(!/^\d+$/.test(configuration.POS_FILE_QUOTA_BYTES)||Number(configuration.POS_FILE_QUOTA_BYTES)<1||Number(configuration.POS_FILE_QUOTA_BYTES)>1073741824))throw new Error('Invalid backed up file quota');
 if(configuration.RECONCILE_INTERVAL_MS&&(!/^\d+$/.test(configuration.RECONCILE_INTERVAL_MS)||Number(configuration.RECONCILE_INTERVAL_MS)<60000))throw new Error('Invalid backed up reconciliation interval');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const packages=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const manifest={formatVersion:1,createdAt:new Date().toISOString(),appVersion,database:{sha256:await hash(file),assets:'FileAsset PostgreSQL bytea in the same pg_dump snapshot',documents:'Posted business documents and journals in the same pg_dump snapshot'},configuration,secretRecoveryReference:recoveryReference,runtime:{node:process.version,next:packages.dependencies.next,prisma:packages.devDependencies.prisma}};
 fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
}else if(mode==='verify'||mode==='export'){
 if(fs.statSync(file).size>16384)throw new Error('Manifest too large');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));if(manifest.formatVersion!==1||manifest.database?.sha256!==await hash(output)||!manifest.appVersion||!manifest.secretRecoveryReference||!manifest.configuration||Object.keys(manifest.configuration).some(key=>!allowed.includes(key)))throw new Error('Backup manifest/dump/configuration mismatch');
 const directory=process.env.RESTORE_CONFIGURATION_DIRECTORY;
 if(directory){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw new Error('Restore configuration directory must be private');
  if(fs.existsSync(path.join(directory,'recovery-manifest.json')))throw new Error('Recovery manifest already exists');
  if(mode==='export')fs.writeFileSync(path.join(directory,'recovery-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
 }
}else throw new Error('Supported modes: write/verify');

}
main().catch(()=>{process.stderr.write("Backup manifest validation failed; check explicit version/configuration/recovery inputs and matching encrypted files\n");process.exitCode=1;});
