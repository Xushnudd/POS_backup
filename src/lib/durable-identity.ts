/** Several commands share one endpoint. Match the server command discriminant,
 * never current mutable fields, so unrelated pending jobs/steps stay distinct.
 * This is a UI recovery selector; server authorization and payload hash remain required. */
export function durableIdentity(path:string,body:unknown):string{
 if(!body||typeof body!=='object'||Array.isArray(body))return '';
 const value=body as Record<string,unknown>;
 if(path==='/jobs'&&typeof value.type==='string')return 'type:'+value.type;
 if(path==='/onboarding'&&typeof value.step==='string')return 'step:'+value.step;
 if(path==='/billing/payments'&&typeof value.billingInvoiceId==='string')return 'invoice:'+value.billingInvoiceId;
 if(path==='/billing/plans'&&typeof value.code==='string')return 'plan:'+value.code;
 if((path==='/billing/assign'||path==='/billing/costs')&&typeof value.targetOrganizationId==='string')return 'target:'+value.targetOrganizationId;
 if(/^\/brands\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)){
  if(typeof value.name==='string')return 'brand:name';
  if(typeof value.isActive==='boolean')return 'brand:status';
 }
 return '';
}
