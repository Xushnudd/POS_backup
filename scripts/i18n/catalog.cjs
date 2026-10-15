/* Owned UI text inventory. This never scans credentials, user databases or DOM.
 * Apply only reviewed dictionary entries; API/protocol/body values are excluded. */
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const roots=['src/app','src/components','src/context','src/hooks'];
const attributes=new Set(['label','title','subtitle','placeholder','helperText','text','aria-label','aria-description','aria-valuetext','alt']);
const protocol=new Set(['SKU','UTC','POS','CSV','XLSX','PDF','JSON','HTML','URL','ID','UZS','TOTP','OTP','MFA','PIN','Shuni POS','Shuni','S','SMS','O‘zbekcha','Русский']);
const isHuman=(text,kind)=>/[A-Za-zА-Яа-я]/.test(text)&&!protocol.has(text)&&!/^[/#]|^https?:|^[^\s]+@[^\s]+$/.test(text)&&!(kind==='message'&&/^[A-Z0-9_]+$/.test(text));
function normalized(text){return text.replace(/&apos;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function files(dir,result=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())files(file,result);else if(file.endsWith('.tsx')&&!file.includes('/api/'))result.push(file)}return result}
function owner(node){let current=node.parent;while(current){if(ts.isFunctionDeclaration(current)&&current.name&&/^(?:[A-Z]|use[A-Z])/.test(current.name.text)&&current.body)return current;if((ts.isArrowFunction(current)||ts.isFunctionExpression(current))&&ts.isBlock(current.body)){let parent=current.parent;if(ts.isVariableDeclaration(parent)&&/^[A-Z]/.test(parent.name.getText()))return current;if(ts.isCallExpression(parent)&&/(?:forwardRef|memo)$/.test(parent.expression.getText()))return current;}current=current.parent}return null}
// Only string leaves of display expressions. Never inspect function call/body,
// object payloads, attribute values such as href/value, or arbitrary runtime data.
function displayLiteral(node){
 let current=node;
 while(current.parent){const parent=current.parent;
  if(ts.isJsxExpression(parent)){const host=parent.parent;return !ts.isJsxAttribute(host)||attributes.has(host.name.getText());}
  if(ts.isConditionalExpression(parent)){if(current===parent.condition)return false;current=parent;continue;}
  if(ts.isBinaryExpression(parent)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(parent.operatorToken.kind)){if(current===parent.left&&parent.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return false;current=parent;continue;}
  if(ts.isParenthesizedExpression(parent)){current=parent;continue;}
  return false;
 }return false;
}
function scan(file){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),items=[];
 function add(node,text,kind){const key=normalized(text);if(isHuman(key,kind))items.push({key,file,start:node.getStart(ast),end:node.getEnd(),kind,owner:owner(node),raw:node.getText(ast)})}
 function walk(node){if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='label'&&ts.isStringLiteral(node.initializer)&&owner(node))add(node.initializer,node.initializer.text,'option');if(ts.isStringLiteral(node)&&displayLiteral(node))add(node,node.text,'expression');if(ts.isJsxText(node))add(node,node.text,'jsx');
  if(ts.isJsxAttribute(node)&&attributes.has(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer))add(node.initializer,node.initializer.text,'attribute');
  if(ts.isNewExpression(node)&&node.expression.getText(ast)==='Error'&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0],node.arguments[0].text,'message');
  if(ts.isCallExpression(node)&&/^(?:notifyError|notifySuccess|notifyWarning|notifyInfo|(?:window\.)?(?:confirm|alert)|set(?:\w*Error|\w*Message|Ack))$/.test(node.expression.getText(ast))&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0],node.arguments[0].text,'message');
  ts.forEachChild(node,walk)}walk(ast);return {source,ast,items}
}
const command=process.argv[2]??'scan',selected=process.argv.slice(3),targets=selected.length?selected:roots.flatMap(root=>files(root));
const uz=JSON.parse(fs.readFileSync('src/dictionary/ui.uz.json','utf8')),ru=JSON.parse(fs.readFileSync('src/dictionary/ui.ru.json','utf8'));
if(command==='scan'){
 const entries=new Map();for(const file of targets)for(const item of scan(file).items){if(!entries.has(item.key))entries.set(item.key,{key:item.key,reviewed:Object.hasOwn(uz,item.key)&&Object.hasOwn(ru,item.key),files:[]});const entry=entries.get(item.key);if(!entry.files.includes(file))entry.files.push(file)}
 process.stdout.write(JSON.stringify({kind:'direct_owned_literals_only',notIncluded:['option/module maps','templates','server errors','offline screen'],count:entries.size,missing:[...entries.values()].filter(entry=>!entry.reviewed),reviewed:[...entries.values()].filter(entry=>entry.reviewed)},null,2)+'\n');
}else if(command==='apply'){
 for(const file of targets){const {source,ast,items}=scan(file),patches=[],owners=new Set();
  for(const item of items){if(item.kind==='message')continue;if(!Object.hasOwn(uz,item.key)||!Object.hasOwn(ru,item.key)||!ru[item.key].trim())continue;if(!item.owner)continue;
   if(item.owner.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword))continue;
   owners.add(item.owner);const call='tr('+JSON.stringify(item.key)+')';let text=call;
   if(item.kind==='attribute')text='{'+call+'}';
   if(item.kind==='jsx'){const raw=item.raw,inline=!/[\n\r]/.test(raw);text=(inline&&/^\s/.test(raw)?"{' '}":'')+'{'+call+'}'+(inline&&/\s$/.test(raw)?"{' '}":'')}
   patches.push({start:item.start,end:item.end,text});
  }
  if(!patches.length)continue;
  for(const component of owners){const body=component.body;if(!/\{\s*t\s*:\s*tr\s*\}\s*=\s*useTranslation/.test(body.getText(ast)))patches.push({start:body.getStart(ast)+1,end:body.getStart(ast)+1,text:'\n const {t:tr}=useTranslation();\n'})}
  let prefix='';if(!source.includes("from '@/context/LocaleContext'"))prefix="import {useTranslation} from '@/context/LocaleContext';\n";
  if(!/^['"]use client['"];?/.test(source.trimStart()))prefix="'use client';\n"+prefix;
  const insertion=/^\s*['"]use client['"];?/.exec(source)?.[0].length??0;patches.push({start:insertion,end:insertion,text:'\n'+prefix});
  patches.sort((left,right)=>right.start-left.start||right.end-left.end);let next=source;for(const patch of patches)next=next.slice(0,patch.start)+patch.text+next.slice(patch.end);fs.writeFileSync(file,next);process.stdout.write(file+': '+items.filter(item=>Object.hasOwn(ru,item.key)).length+' owned literals reviewed\n');
 }
}else throw Error('Use scan or apply');
