export type StepUpBinding = {action: string; operationKey: string; payloadHash: string}
type StepUpRequest = StepUpBinding & {finish: (approved: boolean) => void; signal: AbortSignal; accepted: boolean}
export const STEP_UP_EVENT = 'pos:critical-step-up'
export type {StepUpRequest}
export function stepUpBinding(value: unknown): StepUpBinding | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.action !== 'string' || !/^[a-z][a-z0-9_.]{2,80}$/.test(row.action) || typeof row.operationKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.operationKey) || typeof row.payloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(row.payloadHash)) return null
  return {action: row.action, operationKey: row.operationKey, payloadHash: row.payloadHash}
}
export function requestStepUp(binding: StepUpBinding): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise(resolve => {
    let finished = false
    const controller = new AbortController()
    const timer = setTimeout(() => finish(false), 5 * 60000)
    const finish = (approved: boolean) => {
      if (finished) return
      finished = true; clearTimeout(timer); controller.abort(); resolve(approved)
    }
    const request: StepUpRequest = {...binding, finish, signal:controller.signal, accepted:false}
    window.dispatchEvent(new CustomEvent<StepUpRequest>(STEP_UP_EVENT, {detail: request}))
    if (!request.accepted) finish(false)
  })
}
