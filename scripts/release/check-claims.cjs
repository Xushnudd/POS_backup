/* Read-only release gate. Reviews are explicit, never inferred from a checkbox
 * or silently refreshed. Public bundles contain wording, not proof internals. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const COPY='src/release/public-copy.ts',REGISTRY='tasks/release/PUBLIC_CLAIMS.json';
const SURFACES=['src/components/landing/LandingContent.tsx','src/app/page.tsx','src/app/layout.tsx','src/app/manifest.ts','src/context/LocaleContext.tsx'];
const RUNTIME_SOURCES=['src/i18n/messages.ts','src/i18n/locale.ts','src/i18n/format.ts','src/lib/money.ts'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function copyKeys(source){
 const ast=ts.createSourceFile(COPY,source,ts.ScriptTarget.Latest,true),result={};
 function unwrap(node){while(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node))node=node.expression;return node;}
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='PUBLIC_COPY'&&node.initializer){const object=unwrap(node.initializer);if(!ts.isObjectLiteralExpression(object))throw Error('COPY_MUST_BE_LITERAL');for(const field of object.properties){if(!ts.isPropertyAssignment(field)||!ts.isStringLiteral(field.initializer))throw Error('COPY_MUST_BE_STATIC');const id=field.name.getText(ast).replace(/^['"]|['"]$/g,'');if(Object.hasOwn(result,id))throw Error('COPY_DUPLICATE');result[id]=field.initializer.text;}}ts.forEachChild(node,visit);}visit(ast);return result;
}
function check(root=process.cwd(),overrides={}){
 const problems=[],read=file=>Object.hasOwn(overrides,file)?overrides[file]:fs.readFileSync(path.join(root,file),'utf8');
 const report=(code,file,id)=>problems.push({code,file,...(id?{id}:{})});
 const registry=JSON.parse(read(REGISTRY)),copy=copyKeys(read(COPY)),uz=JSON.parse(read('src/dictionary/ui.uz.json')),ru=JSON.parse(read('src/dictionary/ui.ru.json'));
 const originalIds=new Set([...read('tasks/PLAN1.md').matchAll(/^- \[[ x]\] \*\*([A-Z]+-\d+\.\d+)\*\*/gm)].map(match=>match[1]));
 const accepted=new Set([...read('tasks/PLAN1.md').matchAll(/^- \[x\] \*\*([A-Z]+-\d+\.\d+)\*\*/gm)].map(match=>match[1]));
 if(registry.schemaVersion!==1)report('UNSUPPORTED_REGISTRY',REGISTRY);
 for(const file of RUNTIME_SOURCES)if(digest(read(file))!==registry.runtimeSha256?.[file])report('PUBLIC_RUNTIME_REVIEW_REQUIRED',file);
 const proofData={};for(const [id,proof] of Object.entries(registry.proofs??{})){
  if(!/^tasks\/evidence\/[a-z0-9-]+\.json$/.test(proof.file)){report('UNSAFE_PROOF_PATH',REGISTRY,id);continue;}
  const text=read(proof.file);if(digest(text)!==proof.sha256)report('PROOF_HASH_CHANGED',proof.file,id);proofData[id]=JSON.parse(text);
 }
 for(const [id,group] of Object.entries(registry.groups??{})){
  if(!group.originalIds?.length||!group.proofs?.length||!Object.keys(group.sourceAnchors??{}).length)report('INCOMPLETE_CAPABILITY_PROOF',REGISTRY,id);
  for(const task of group.originalIds??[])if(!accepted.has(task))report('UNACCEPTED_ORIGINAL',REGISTRY,task);
  for(const proof of group.proofs??[])if(!proofData[proof])report('MISSING_PROOF',REGISTRY,proof);
  for(const [file,anchor] of Object.entries(group.sourceAnchors??{})){
   if(!/^src\/server\/[a-zA-Z0-9/_-]+\.ts$|^tests\/[a-zA-Z0-9_-]+\.(?:integration|unit)\.test\.ts$/.test(file)){report('UNSAFE_SOURCE_ANCHOR',REGISTRY,id);continue;}
   if(digest(read(file))!==anchor.sha256)report('CAPABILITY_SOURCE_CHANGED',file,id);
   const attested=proofData[anchor.proof]?.sourceSha256?.[file];
   if(attested!==anchor.sha256)report('SOURCE_NOT_ATTESTED',file,id);
  }
 }
 const usage={};
 for(const file of SURFACES){
  const source=read(file),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),used=new Set();
  if(digest(source)!==registry.surfaceSha256?.[file])report('PUBLIC_SURFACE_REVIEW_REQUIRED',file);
  function refs(node){const ids=[];function walk(child){if(ts.isPropertyAccessExpression(child)&&child.expression.getText(ast)==='PUBLIC_COPY')ids.push(child.name.text);ts.forEachChild(child,walk);}walk(node);return ids;}
  function visit(node){
   if(ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==='PUBLIC_COPY'){const id=node.name.text;used.add(id);if(!Object.hasOwn(copy,id))report('UNKNOWN_PUBLIC_COPY',file,id);}
   if(ts.isElementAccessExpression(node)&&node.expression.getText(ast)==='PUBLIC_COPY')report('DYNAMIC_PUBLIC_COPY_FORBIDDEN',file);
   if(ts.isCallExpression(node)&&['tr','translate'].includes(node.expression.getText(ast))&&!refs(node.arguments[0]??node).length&&!(file==='src/context/LocaleContext.tsx'&&node.arguments[0]?.getText(ast)==='key'))report('UNREGISTERED_TRANSLATION',file);
   if(file!=='src/context/LocaleContext.tsx'&&ts.isJsxText(node)){const value=node.getText(ast).replace(/\s+/g,' ').trim();if(/[\p{L}]/u.test(value)&&value!=='Shuni POS')report('UNREGISTERED_RENDERED_TEXT',file);}
   if(ts.isPropertyAssignment(node)&&['title','description'].includes(node.name.getText(ast))&&ts.isStringLiteral(node.initializer))report('UNREGISTERED_METADATA',file);
   if(ts.isJsxAttribute(node)&&['aria-label','title','alt','label','placeholder'].includes(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer)&&/[\p{L}]/u.test(node.initializer.text))report('UNREGISTERED_DISPLAY_ATTRIBUTE',file);
   if(file==='src/components/landing/LandingContent.tsx'&&ts.isImportDeclaration(node)&&!['@/release/public-copy','@/context/LocaleContext','next/link','@/server/billing/public-pricing'].includes(node.moduleSpecifier.text))report('UNAUDITED_PUBLIC_COMPONENT_IMPORT',file);
   ts.forEachChild(node,visit);
  }visit(ast);usage[file]=used;
 }
 for(const [id,key] of Object.entries(copy)){
  const entry=registry.copy?.[id];if(!entry){report('UNREVIEWED_COPY',COPY,id);continue;}
  if(!['claim','boundary','neutral'].includes(entry.kind))report('INVALID_COPY_KIND',REGISTRY,id);
  if(!entry.surfaces?.length)report('COPY_SURFACE_REQUIRED',REGISTRY,id);
  for(const file of entry.surfaces??[])if(!usage[file]?.has(id))report('REQUIRED_COPY_NOT_RENDERED',file,id);
  for(const file of SURFACES)if(usage[file].has(id)&&!entry.surfaces?.includes(file))report('UNREVIEWED_COPY_SURFACE',file,id);
  for(const [locale,dict] of Object.entries({uz,ru}))if(typeof dict[key]!=='string'||!dict[key].trim()||digest(dict[key])!==entry.textSha256?.[locale])report('TEXT_REVIEW_REQUIRED',REGISTRY,id+':'+locale);
  if(entry.kind==='claim'&&!entry.groups?.length)report('CLAIM_WITHOUT_CAPABILITY',REGISTRY,id);
  for(const group of entry.groups??[])if(!registry.groups?.[group])report('UNKNOWN_CAPABILITY',REGISTRY,group);
  for(const boundary of entry.requiredBoundaries??[])if(registry.copy?.[boundary]?.kind!=='boundary'||!usage[SURFACES[0]].has(boundary))report('CLAIM_BOUNDARY_MISSING',REGISTRY,id);
 }
 for(const id of Object.keys(registry.copy??{}))if(!Object.hasOwn(copy,id))report('STALE_COPY_REVIEW',REGISTRY,id);
 for(const unavailable of registry.unavailable??[]){
  if(registry.copy?.[unavailable.notice]?.kind!=='boundary'||!usage[SURFACES[0]].has(unavailable.notice))report('UNAVAILABLE_BOUNDARY_MISSING',REGISTRY,unavailable.id);
  if(!unavailable.originalIds?.length)report('UNAVAILABLE_SOURCE_REQUIRED',REGISTRY,unavailable.id);
  for(const original of unavailable.originalIds??[]){if(!originalIds.has(original))report('UNKNOWN_ORIGINAL',REGISTRY,original);if(accepted.has(original))report('UNAVAILABLE_SCOPE_NEEDS_REVIEW',REGISTRY,original);}
 }
 function walk(directory){for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){const file=directory+'/'+entry.name;if(entry.isDirectory())walk(file);else if(/\.[cm]?[jt]sx?$/.test(file)&&/(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*dictionary\/(?:uz|ru)(?:\.json)?['"]/.test(read(file)))report('INACTIVE_MARKETING_DICTIONARY_IMPORTED',file);}}walk('src');
 return {copyEntries:Object.keys(copy).length,capabilities:Object.keys(registry.groups??{}).length,proofs:Object.keys(proofData).length,surfaces:SURFACES.length,problems};
}
module.exports={check,copyKeys,digest,COPY,REGISTRY,SURFACES,RUNTIME_SOURCES};
if(require.main===module){try{const result=check();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.problems.length?1:0;}catch{console.error('Public claim review failed: missing or malformed local review/proof source');process.exitCode=2;}}
