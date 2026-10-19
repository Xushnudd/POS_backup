import {spawn} from 'node:child_process'
import {constants} from 'node:os'
import {pathToFileURL} from 'node:url'

// This value is supplied by the same Compose interpolation as services.*.image.
// Values and native errors must never be included in a rejected startup message.
export function validateReleaseRuntime(environment,uid) {
  const image=environment.POS_RELEASE_IMAGE || ''
  if (image!==image.trim() || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(image)) throw new Error('RELEASE_IMMUTABLE_IMAGE_REQUIRED')
  if (environment.NODE_ENV !== 'production') throw new Error('RELEASE_PRODUCTION_MODE_REQUIRED')
  if (!Number.isInteger(uid) || uid <= 0) throw new Error('RELEASE_NON_ROOT_REQUIRED')
}

export function startRelease(command,args,environment=process.env) {
  validateReleaseRuntime(environment,process.getuid?.())
  if (!command || !Array.isArray(args)) throw new Error('RELEASE_COMMAND_REQUIRED')
  const child=spawn(command,args,{env:environment,stdio:'inherit'})
  const handlers=new Map(['SIGTERM','SIGINT'].map(signal=>[signal,()=>child.kill(signal)]))
  for (const [signal,handler] of handlers) process.on(signal,handler)
  const cleanup=()=>{for (const [signal,handler] of handlers) process.off(signal,handler)}
  child.once('error',()=>{cleanup();console.error('RELEASE_CHILD_START_FAILED');process.exitCode=1})
  child.once('exit',(code,signal)=>{cleanup();process.exitCode=signal?128+(constants.signals[signal]||1):(code??1)})
  return child
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {startRelease(process.argv[2],process.argv.slice(3))}
  catch (error) {
    const code=error instanceof Error && /^RELEASE_[A-Z_]+$/.test(error.message)?error.message:'RELEASE_START_REJECTED'
    console.error(code);process.exitCode=1
  }
}
