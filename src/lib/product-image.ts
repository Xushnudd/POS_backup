// Legacy external URLs remain metadata, but must never become browser requests.
export const internalProductImagePattern=/^\/api\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isInternalProductImage(value:unknown):value is string {
 return typeof value==='string'&&internalProductImagePattern.test(value)
}
