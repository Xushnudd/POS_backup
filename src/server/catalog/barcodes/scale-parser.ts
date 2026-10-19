import {z} from 'zod'
import {AccessError} from '../../auth/policy'

// Positions are zero-based offsets in an explicitly approved digit string.
// There are no vendor profiles or implicit EAN/checksum defaults here.
const field=z.object({offset:z.number().int().min(0).max(127),length:z.number().int().min(1).max(128)}).strict()
const valueField=field.extend({decimalPlaces:z.number().int().min(0).max(6)})
export const scaleBarcodeProfileSchema=z.object({
 id:z.string().trim().min(1).max(100),version:z.number().int().positive(),approved:z.boolean(),
 length:z.number().int().min(1).max(128),prefix:z.string().regex(/^[0-9]{1,128}$(?![\s\S])/),
 productCode:field,
 value:valueField.extend({kind:z.enum(['quantity','unit_price','total_price'])}),
 checksum:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('none')}).strict(),
  z.object({kind:z.literal('provider'),ruleId:z.string().trim().min(1).max(100),field}).strict(),
 ]),
}).strict().superRefine((profile,ctx)=>{
 const fields=[profile.productCode,profile.value,...(profile.checksum.kind==='provider'?[profile.checksum.field]:[])]
 if(profile.prefix.length>profile.length||fields.some(row=>row.offset+row.length>profile.length))ctx.addIssue({code:'custom',message:'Profile field exceeds barcode length'})
 if(profile.value.decimalPlaces>profile.value.length)ctx.addIssue({code:'custom',message:'Decimal precision exceeds value field'})
 const spans=[{offset:0,length:profile.prefix.length},...fields]
 for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++)if(spans[i].offset<spans[j].offset+spans[j].length&&spans[j].offset<spans[i].offset+spans[i].length)ctx.addIssue({code:'custom',message:'Profile fields overlap'})
})
export type ScaleBarcodeProfile=z.infer<typeof scaleBarcodeProfileSchema>
export interface ScaleChecksumVerifier{
 readonly ruleId:string
 verify(input:{barcode:string;checksum:string;profile:Readonly<ScaleBarcodeProfile>}):boolean
}
export interface ScaleBarcodeParser{
 parse(barcode:string):{profileId:string;profileVersion:number;productCode:string;kind:'quantity'|'unit_price'|'total_price';value:string}
}
function exactValue(digits:string,places:number){
 const padded=digits.padStart(places+1,'0')
 const whole=(places?padded.slice(0,-places):padded).replace(/^0+(?=\d)/,'')
 return places?whole+'.'+padded.slice(-places):whole
}
/** Trusted server configuration only. This parser does not resolve products,
 * authorize prices/discounts, or replace normal barcode lookup. */
export function createScaleBarcodeParser(profiles:readonly ScaleBarcodeProfile[],verifiers:readonly ScaleChecksumVerifier[]=[]):ScaleBarcodeParser{
 if(profiles.length>100||verifiers.length>100)throw new AccessError(400,'SCALE_PROFILE_LIMIT')
 const configured=profiles.map(profile=>{
  const parsed=scaleBarcodeProfileSchema.parse(profile)
  Object.freeze(parsed.productCode);Object.freeze(parsed.value)
  if(parsed.checksum.kind==='provider')Object.freeze(parsed.checksum.field)
  Object.freeze(parsed.checksum)
  return Object.freeze(parsed)
 })
 if(new Set(configured.map(row=>row.id)).size!==configured.length||new Set(verifiers.map(row=>row.ruleId)).size!==verifiers.length)throw new AccessError(400,'SCALE_PROFILE_DUPLICATE')
 const rules=new Map(verifiers.map(row=>[row.ruleId,row]))
 return {parse(barcode){
  if(!/^[0-9]{1,128}$(?![\s\S])/.test(barcode))throw new AccessError(400,'SCALE_BARCODE_INVALID')
  const matches=configured.filter(row=>row.approved&&row.length===barcode.length&&barcode.startsWith(row.prefix))
  if(matches.length===0)throw new AccessError(422,'SCALE_BARCODE_UNKNOWN')
  if(matches.length!==1)throw new AccessError(409,'SCALE_BARCODE_AMBIGUOUS')
  const profile=matches[0]
  const slice=(row:{offset:number;length:number})=>barcode.slice(row.offset,row.offset+row.length)
  if(profile.checksum.kind==='provider'){
   const verifier=rules.get(profile.checksum.ruleId)
   if(!verifier)throw new AccessError(503,'SCALE_CHECKSUM_UNAVAILABLE')
   // A vendor verifier exception must never authorize a code.
   let verified=false
   try{verified=verifier.verify({barcode,checksum:slice(profile.checksum.field),profile})===true}catch{verified=false}
   if(!verified)throw new AccessError(422,'SCALE_CHECKSUM_INVALID')
  }
  const value=exactValue(slice(profile.value),profile.value.decimalPlaces)
  if(!/[1-9]/.test(value))throw new AccessError(422,'SCALE_VALUE_INVALID')
  return {profileId:profile.id,profileVersion:profile.version,productCode:slice(profile.productCode),kind:profile.value.kind,value}
 }}
}
