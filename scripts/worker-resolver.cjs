const Module=require('node:module'),path=require('node:path'),original=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){
 if(name.startsWith('@/'))name=path.join(__dirname,'../.worker-build/src',name.slice(2));
 return original.call(this,name,parent,...rest);
};
