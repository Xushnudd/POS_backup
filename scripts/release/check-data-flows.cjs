// Read-only, offline inventory gate. Never opens .env, databases or credentials.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const fixed=['src/server/auth/delivery.ts','src/lib/api.ts','src/lib/product-image.ts','src/proxy.ts','src/app/api/products/route.ts','src/app/api/products/[id]/route.ts','src/app/(dashboard)/products/[id]/media/page.tsx','src/server/catalog/variants.ts','src/server/sales/receipt-links.ts','src/server/customers/reminders.ts','public/sw.js'];
function sourceHashes(root=process.cwd()){
 const files=[...fixed];
 function walk(directory){for(const item of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){const file=directory+'/'+item.name;if(item.isSymbolicLink())throw Error('DATA_FLOW_SOURCE_SYMLINK');if(item.isDirectory())walk(file);else if(item.isFile())files.push(file);}}
 walk('src/server/integrations');
 return Object.fromEntries(files.sort().map(file=>{const absolute=path.join(root,file);if(fs.lstatSync(absolute).isSymbolicLink())throw Error('DATA_FLOW_SOURCE_SYMLINK');return [file,createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')]}));
}
function validate(registry,root=process.cwd()){
 if(registry.version!==1||registry.productionDeploymentVerified!==false||!Array.isArray(registry.flows)||!registry.flows.length)throw Error('DATA_FLOW_INVENTORY_INVALID');
 const thirdParty=registry.flows.filter(row=>row.party==='third_party');
 for(const flow of registry.flows)if(!flow.id||!flow.purpose||!Array.isArray(flow.transmittedFields)||!Object.hasOwn(flow,'region')||!Object.hasOwn(flow,'retention')||!Object.hasOwn(flow,'contract')||!flow.credentialOwner)throw Error('DATA_FLOW_FIELDS_MISSING');
 if(thirdParty.some(row=>row.status==='active'))throw Error('DATA_FLOW_EXTERNAL_PROVIDER_NOT_APPROVED');
 if(JSON.stringify(sourceHashes(root))!==JSON.stringify(registry.sourceHashes))throw Error('DATA_FLOW_SOURCE_REVIEW_REQUIRED');
 return {task:'LEG-01.06',activeThirdPartyProviders:0,reviewedFlows:registry.flows.length,sourceFiles:Object.keys(registry.sourceHashes).length,scope:'current_local_core_and_explicitly_disabled_external_boundaries',productionDeploymentVerified:false};
}
if(require.main===module){try{console.log(JSON.stringify(validate(JSON.parse(fs.readFileSync('ops/privacy/data-flows.json','utf8')))))}catch(error){console.error(/^DATA_FLOW_[A-Z_]+$/.test(error.message)?error.message:'DATA_FLOW_CHECK_FAILED');process.exitCode=1;}}
module.exports={sourceHashes,validate};
