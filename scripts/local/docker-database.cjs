// Local Compose only: host development DATABASE_URL must not select a container DB.
const {spawn}=require('node:child_process');
function databaseEnvironment(environment){
 const user=environment.POSTGRES_USER||'pos_user',database=environment.POSTGRES_DB||'pos_db';
 if(!environment.POSTGRES_PASSWORD)throw new Error('Local Docker requires POSTGRES_PASSWORD');
 const url='postgresql://'+encodeURIComponent(user)+':'+encodeURIComponent(environment.POSTGRES_PASSWORD)+'@db:5432/'+encodeURIComponent(database);
 return {...environment,DATABASE_URL:url};
}
module.exports={databaseEnvironment};
if(require.main===module){
 let environment;
 try{environment=databaseEnvironment(process.env)}catch{console.error('Local Docker database settings are incomplete');process.exit(1)}
 const args=process.argv.slice(2);
 if(!args.length){console.error('Local Docker process command is required');process.exit(1)}
 const child=spawn(process.execPath,args,{stdio:'inherit',env:environment});
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
 child.on('error',()=>{console.error('Unable to start local Docker process');process.exitCode=1});
 child.on('exit',(code,signal)=>process.exit(code??(signal==='SIGINT'?130:143)));
}
