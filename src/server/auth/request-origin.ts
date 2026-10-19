const localDevelopmentOrigins=new Set([
 'http://localhost:3000','http://localhost:3443','https://localhost:3443',
]);
export function requestOriginAllowed(origin:string|null,expected:string,nodeEnv:string|undefined=process.env.NODE_ENV){
 // Production retains one exact configured origin. These additional origins
 // are only the fixed loopback interfaces of the local development overlay.
 return !origin||origin===expected||nodeEnv==='development'&&localDevelopmentOrigins.has(origin);
}
