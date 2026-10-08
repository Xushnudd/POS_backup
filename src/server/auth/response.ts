// Defense in depth after endpoint DTO selection. Authentication credentials are
// never JSON response fields. Invitation capabilities are explicitly returned
// once to an authorized owner by the invitation endpoint, not session tokens.
const credentials = new Set(['password','passwordhash','tokenhash','resettoken','secret','apikey','privatekey','clientsecret','accesstoken','refreshtoken','sessiontoken','authorization','cookie','credentials']);
const costs = new Set(['costprice','unitcost','profit','profitmargin','cost']);
export function sanitizeResponse(value: unknown, role?: string): unknown {
  if (Array.isArray(value)) return value.map(row => sanitizeResponse(row, role));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => {
    const normalized=key.toLowerCase().replace(/[_-]/g,'');
    return !credentials.has(normalized) && !(normalized==='token' && (value as Record<string,unknown>)[key]!=='cookie-session') && !(role==='cashier' && costs.has(normalized));
  }).map(([key, row]) => [key,sanitizeResponse(row,role)]));
}
