import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createScaleBarcodeParser,scaleBarcodeProfileSchema,type ScaleBarcodeProfile} from '@/server/catalog/barcodes/scale-parser'
// Deliberately synthetic format: no real scale/model certification.
const profile:ScaleBarcodeProfile={id:'synthetic-only',version:1,approved:true,length:12,prefix:'91',productCode:{offset:2,length:4},value:{offset:6,length:5,decimalPlaces:3,kind:'quantity'},checksum:{kind:'provider',ruleId:'synthetic-check',field:{offset:11,length:1}}}
const checksum={ruleId:'synthetic-check',verify:({checksum}:{checksum:string})=>checksum==='7'}
test('Scale profile parses exact decimal strings and leading zero product identity only with explicit approval',()=>{
 assert.deepEqual(createScaleBarcodeParser([profile],[checksum]).parse('910012012347'),{profileId:'synthetic-only',profileVersion:1,productCode:'0012',kind:'quantity',value:'1.234'})
 assert.equal(createScaleBarcodeParser([{...profile,value:{...profile.value,kind:'total_price',decimalPlaces:2}}],[checksum]).parse('910012012347').value,'12.34')
 assert.equal(createScaleBarcodeParser([{...profile,value:{...profile.value,decimalPlaces:0}}],[checksum]).parse('910012012347').value,'1234')
})
test('Unknown, unapproved, malformed and ambiguous profiles are never automatically interpreted',()=>{
 for(const profiles of [[],[{...profile,approved:false}]])assert.throws(()=>createScaleBarcodeParser(profiles,[checksum]).parse('910012012347'),{code:'SCALE_BARCODE_UNKNOWN'})
 for(const barcode of ['','910012012347 ','+910012012347','９１００１２０１２３４７','91001201234\n'])assert.throws(()=>createScaleBarcodeParser([profile],[checksum]).parse(barcode),{code:'SCALE_BARCODE_INVALID'})
 assert.throws(()=>createScaleBarcodeParser([profile,{...profile,id:'another'}],[checksum]).parse('910012012347'),{code:'SCALE_BARCODE_AMBIGUOUS'})
})
test('Missing checksum implementation, invalid checksum, exceptions and zero value fail closed',()=>{
 assert.throws(()=>createScaleBarcodeParser([profile]).parse('910012012347'),{code:'SCALE_CHECKSUM_UNAVAILABLE'})
 assert.throws(()=>createScaleBarcodeParser([profile],[checksum]).parse('910012012348'),{code:'SCALE_CHECKSUM_INVALID'})
 assert.throws(()=>createScaleBarcodeParser([profile],[{ruleId:checksum.ruleId,verify(){throw Error('synthetic verifier failure')}}]).parse('910012012347'),{code:'SCALE_CHECKSUM_INVALID'})
 assert.throws(()=>createScaleBarcodeParser([profile],[checksum]).parse('910012000007'),{code:'SCALE_VALUE_INVALID'})
})
test('Malformed configuration rejects overlap, range, precision, duplicate IDs and forged profile fields',()=>{
 for(const input of [{...profile,length:4},{...profile,productCode:{offset:0,length:4}},{...profile,value:{...profile.value,offset:10}},{...profile,value:{...profile.value,decimalPlaces:6}},{...profile,protocol:'invented'}])assert.equal(scaleBarcodeProfileSchema.safeParse(input).success,false)
 assert.throws(()=>createScaleBarcodeParser([profile,profile]),{code:'SCALE_PROFILE_DUPLICATE'})
 assert.throws(()=>createScaleBarcodeParser([profile],[checksum,checksum]),{code:'SCALE_PROFILE_DUPLICATE'})
})
