/* Owned UI text inventory. This never scans credentials, user databases or DOM.
 * Apply only reviewed dictionary entries; API/protocol/body values are excluded. */
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const roots=['src/app','src/components','src/context','src/hooks'];
const attributes=new Set(['label','title','subtitle','placeholder','helperText','text','aria-label','aria-description','aria-valuetext','alt','review']);
const protocol=new Set(['SKU','UTC','POS','CSV','XLSX','PDF','JSON','HTML','URL','ID','UZS','TOTP','OTP','MFA','PIN','Shuni POS','Shuni','S','SMS','UZ','RU','O‘zbekcha','Русский']);
const isHuman=(text,kind)=>/[A-Za-zА-Яа-я]/.test(text)&&!protocol.has(text)&&!/^[/#]|^https?:|^[^\s]+@[^\s]+$/.test(text)&&!(kind==='message'&&/^[A-Z0-9_]+$/.test(text));
function normalized(text){return text.replace(/&apos;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function files(dir,result=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())files(file,result);else if(file.endsWith('.tsx')&&!file.includes('/api/'))result.push(file)}return result}
function owner(node){let current=node.parent;while(current){if(ts.isFunctionDeclaration(current)&&current.name&&/^(?:[A-Z]|use[A-Z])/.test(current.name.text)&&current.body)return current;if((ts.isArrowFunction(current)||ts.isFunctionExpression(current))&&ts.isBlock(current.body)){let parent=current.parent;if(ts.isVariableDeclaration(parent)&&/^[A-Z]/.test(parent.name.getText()))return current;if(ts.isCallExpression(parent)&&/(?:forwardRef|memo)$/.test(parent.expression.getText()))return current;}current=current.parent}return null}
// Only string leaves of display expressions. Never inspect function call/body,
// object payloads, attribute values such as href/value, or arbitrary runtime data.
function displayLiteral(node){
 for(let parent=node.parent;parent&&!ts.isFunctionDeclaration(parent);parent=parent.parent){
  if(ts.isCallExpression(parent)&&/^(?:tr|t|translate|translateKnownLabel|localizeOwnedLabels|uiMessage|messageText)$/.test(parent.expression.getText()))return false;
  if(ts.isVariableDeclaration(parent)&&['review','label'].includes(parent.name.getText()))return true;
 }
 let current=node;
 while(current.parent){const parent=current.parent;
  if(ts.isJsxExpression(parent)){const host=parent.parent;return !ts.isJsxAttribute(host)||attributes.has(host.name.getText());}
  if(ts.isConditionalExpression(parent)){if(current===parent.condition)return false;current=parent;continue;}
  if(ts.isBinaryExpression(parent)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.PlusToken].includes(parent.operatorToken.kind)){if(current===parent.left&&parent.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return false;current=parent;continue;}
  if(ts.isPropertyAssignment(parent)&&parent.name.getText()==='label'&&current===parent.initializer&&owner(parent))return true;
  if(ts.isPropertyAssignment(parent)&&ts.isObjectLiteralExpression(parent.parent)&&parent.parent.properties.every(property=>ts.isPropertyAssignment(property)&&ts.isStringLiteral(property.initializer))){current=parent.parent;continue;}
  if(ts.isElementAccessExpression(parent)&&current===parent.expression){current=parent;continue;}
  if(ts.isPropertyAccessExpression(parent)&&parent.name.text==='map'&&current===parent.expression){current=parent;continue;}
  if(ts.isCallExpression(parent)&&current===parent.expression&&ts.isPropertyAccessExpression(parent.expression)&&parent.expression.name.text==='map'){current=parent;continue;}
  if(ts.isAsExpression(parent)||ts.isTypeAssertionExpression(parent)){current=parent;continue;}
  if(ts.isArrayLiteralExpression(parent)){current=parent;continue;}
  if(ts.isParenthesizedExpression(parent)){current=parent;continue;}
  return false;
 }return false;
}
function scan(file){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),items=[];
 function add(node,text,kind){const key=normalized(text);if(isHuman(key,kind))items.push({key,file,start:node.getStart(ast),end:node.getEnd(),kind,owner:owner(node),raw:node.getText(ast)})}
 function messageLeaves(node){if(ts.isStringLiteral(node)){add(node,node.text,'message');return;}if(ts.isConditionalExpression(node)){messageLeaves(node.whenTrue);messageLeaves(node.whenFalse)}else if(ts.isBinaryExpression(node)){messageLeaves(node.left);messageLeaves(node.right)}}
 function walk(node){
  if(ts.isTemplateExpression(node)&&displayLiteral(node)){
   const parts=node.head.text+node.templateSpans.map(span=>span.literal.text).join('');
   if(/[A-Za-z]/.test(parts)){const key=node.head.text+node.templateSpans.map((span,index)=>'{value'+(index+1)+'}'+span.literal.text).join('');items.push({key,file,start:node.getStart(ast),end:node.getEnd(),kind:'template',owner:owner(node),raw:node.getText(ast),values:node.templateSpans.map((span,index)=>({name:'value'+(index+1),expression:span.expression.getText(ast)}))});}
  }
  if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='label'&&ts.isStringLiteral(node.initializer)&&owner(node))add(node.initializer,node.initializer.text,'option');if(ts.isStringLiteral(node)&&displayLiteral(node))add(node,node.text,'expression');if(ts.isJsxText(node))add(node,node.text,'jsx');
  if(ts.isJsxAttribute(node)&&attributes.has(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer))add(node.initializer,node.initializer.text,'attribute');
  if(ts.isNewExpression(node)&&node.expression.getText(ast)==='Error'&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0],node.arguments[0].text,'message');
  if(ts.isCallExpression(node)&&/^(?:notifyError|notifySuccess|notifyWarning|notifyInfo|(?:window\.)?(?:confirm|alert)|set(?:\w*Error|\w*Message|Ack))$/.test(node.expression.getText(ast))&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0],node.arguments[0].text,'message');
  if((ts.isNewExpression(node)&&node.expression.getText(ast)==='Error'||ts.isCallExpression(node)&&/^(?:notifyError|notifySuccess|notifyWarning|notifyInfo|(?:window\.)?(?:confirm|alert)|set(?:\w*Error\w*|\w*Message|Ack))$/.test(node.expression.getText(ast)))&&node.arguments?.[0])messageLeaves(node.arguments[0]);
  if(ts.isCallExpression(node)&&/^(?:displayErrorMessage|errorMessage)$/.test(node.expression.getText(ast))&&node.arguments?.[1])messageLeaves(node.arguments[1]);
  ts.forEachChild(node,walk)}walk(ast);return {source,ast,items}
}
function tableItems(table){
 const source=fs.readFileSync(table.file,'utf8'),ast=ts.createSourceFile(table.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),items=[];
 const literal=node=>{while(ts.isAsExpression(node)||ts.isParenthesizedExpression(node))node=node.expression;if(ts.isCallExpression(node)&&node.expression.getText(ast)==='localizeOwnedLabels')return node.arguments[0];return node};
 function add(node){if(node&&(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)))items.push({key:node.text,file:table.file,kind:'owned_table'})}
 function fields(node){if(ts.isPropertyAssignment(node)){const key=node.name.text;if(['label','title','help','message','nextAction'].includes(key))add(node.initializer);if(key==='steps'&&ts.isArrayLiteralExpression(node.initializer))node.initializer.elements.forEach(add)}ts.forEachChild(node,fields)}
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===table.name&&node.initializer){const data=literal(node.initializer);if(data&&ts.isObjectLiteralExpression(data)&&table.kind==='record')data.properties.forEach(property=>{if(ts.isPropertyAssignment(property))add(property.initializer)});else if(data&&ts.isArrayLiteralExpression(data)&&table.kind==='pairs')data.elements.forEach(row=>{if(ts.isArrayLiteralExpression(row))add(row.elements[1])});else if(data&&(ts.isArrayLiteralExpression(data)||ts.isObjectLiteralExpression(data)))fields(data)}ts.forEachChild(node,visit)}visit(ast);
 if(!items.length)throw Error('OWNED_TABLE_NOT_FOUND: '+table.file+'#'+table.name);return items;
}
function staticItems(file){const source=fs.readFileSync(file,'utf8'),items=[];for(const match of source.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g))items.push({key:normalized(match[1].replace(/&#x27;/g,"'")),file,kind:'static_annotation'});return items;}
const command=process.argv[2]??'scan',selected=process.argv.slice(3),targets=selected.length?selected:roots.flatMap(root=>files(root));
const uz=JSON.parse(fs.readFileSync('src/dictionary/ui.uz.json','utf8')),ru=JSON.parse(fs.readFileSync('src/dictionary/ui.ru.json','utf8'));
const dataTokens=new Set(['code','receivedOn','expiresOn','mxikRequired','taxRequired','markingRequired','product','category','cashier','store','supplier','payment','pending','conflict','synced','rejected','fiscal','sms','printer_agent','hosting','backup','other','quantity','damagedQuantity','shortageQuantity','firstResponseMinutes','escalationMinutes']);
const developerErrors=new Set(['useAuth must be used within an AuthProvider','useNotification must be used within a NotificationProvider','useOrganization must be used within an OrganizationProvider']);
if(command==='scan'||command==='check'){
 const owned=targets.flatMap(file=>scan(file).items);
 if(!selected.length){for(const table of JSON.parse(fs.readFileSync('scripts/i18n/owned-tables.json','utf8')))owned.push(...tableItems(table));for(const file of ['public/pwa/cash.html','public/pwa/offline.html'])owned.push(...staticItems(file));}
 const entries=new Map();for(const item of owned){const file=item.file;if(!entries.has(item.key))entries.set(item.key,{key:item.key,reviewed:Object.hasOwn(uz,item.key)&&typeof ru[item.key]==='string'&&Boolean(ru[item.key].trim()),files:[]});const entry=entries.get(item.key);if(!entry.files.includes(file))entry.files.push(file)}
 const missing=[...entries.values()].filter(entry=>!entry.reviewed&&!dataTokens.has(entry.key)&&!developerErrors.has(entry.key));if(command==='check'){process.stdout.write(JSON.stringify({checked:entries.size,unreviewed:missing.length,missing})+'\n');if(missing.length)process.exitCode=1;}else process.stdout.write(JSON.stringify({kind:'owned_display_literals_templates_and_canonical_messages',notIncluded:['user and original document data','unregistered runtime/server diagnostics'],count:entries.size,missing:[...entries.values()].filter(entry=>!entry.reviewed),reviewed:[...entries.values()].filter(entry=>entry.reviewed)},null,2)+'\n');
}else if(command==='apply'){
 for(const file of targets){const {source,ast,items}=scan(file),patches=[],owners=new Set();
  for(const item of items){if(item.kind==='message')continue;if(!Object.hasOwn(uz,item.key)||!Object.hasOwn(ru,item.key)||!ru[item.key].trim())continue;if(!item.owner)continue;
   if(item.owner.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword))continue;
   owners.add(item.owner);const call='tr('+JSON.stringify(item.key)+(item.values?',{'+item.values.map(value=>value.name+':String('+value.expression+')').join(',')+'}':'')+')';let text=call;
   if(item.kind==='expression'){const leading=/^['"](\s*)/.exec(item.raw)?.[1]??'',trailing=/(\s*)['"]$/.exec(item.raw)?.[1]??'';text=(leading?JSON.stringify(leading)+'+':'')+call+(trailing?'+'+JSON.stringify(trailing):'');}
   if(item.kind==='attribute')text='{'+call+'}';
   if(item.kind==='jsx'){const raw=item.raw,inline=!/[\n\r]/.test(raw);text=(inline&&/^\s/.test(raw)?"{' '}":'')+'{'+call+'}'+(inline&&/\s$/.test(raw)?"{' '}":'')}
   patches.push({start:item.start,end:item.end,text});
  }
  if(!patches.length)continue;
  for(const component of owners){const body=component.body;if(!body.statements.some(statement=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>ts.isObjectBindingPattern(declaration.name)&&declaration.initializer&&ts.isCallExpression(declaration.initializer)&&declaration.initializer.expression.getText(ast)==='useTranslation'&&declaration.name.elements.some(element=>element.name.getText(ast)==='tr'&&element.propertyName?.getText(ast)==='t'))))patches.push({start:body.getStart(ast)+1,end:body.getStart(ast)+1,text:'\n const {t:tr}=useTranslation();\n'})}
  let prefix='';if(!source.includes("from '@/context/LocaleContext'"))prefix="import {useTranslation} from '@/context/LocaleContext';\n";
  if(!/^['"]use client['"];?/.test(source.trimStart()))prefix="'use client';\n"+prefix;
  const insertion=/^\s*['"]use client['"];?/.exec(source)?.[0].length??0;if(prefix)patches.push({start:insertion,end:insertion,text:'\n'+prefix});
  patches.sort((left,right)=>right.start-left.start||right.end-left.end);let next=source;for(const patch of patches)next=next.slice(0,patch.start)+patch.text+next.slice(patch.end);fs.writeFileSync(file,next);process.stdout.write(file+': '+items.filter(item=>Object.hasOwn(ru,item.key)).length+' owned literals reviewed\n');
 }
}else throw Error('Use scan, check or apply');
