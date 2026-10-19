/** Only identifiers are persisted: prices and permissions always come from the server. */
export const QUICK_PRODUCT_LIMIT = 12;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function quickProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && uuid.test(id)))].slice(0, QUICK_PRODUCT_LIMIT);
}
export function quickProductKey(organizationId: string, userId: string, registerId: string): string {
  return 'pos-quick-products-v1:' + JSON.stringify([organizationId, userId, registerId]);
}
