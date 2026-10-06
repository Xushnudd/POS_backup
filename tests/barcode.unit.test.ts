import {test} from 'node:test'
import assert from 'node:assert/strict'
import Code128Reader from '@zxing/library/cjs/core/oned/Code128Reader'
import BitArray from '@zxing/library/cjs/core/common/BitArray'
import {barcodeModules,barcodeSvg} from '@/server/catalog/labels'

test('Generated labels decode to original ASCII including leading zeros and punctuation',()=>{
 for(const value of ['00123456789012','INT-001a23bc456d789e','hello & <world>','12',' '.repeat(2),'A'.repeat(64)]){
  const modules=barcodeModules(value),row=new BitArray(modules.length*2)
  modules.forEach((black,index)=>{if(black){row.set(index*2);row.set(index*2+1)}})
  assert.equal(new Code128Reader().decodeRow(0,row).getText(),value)
  assert.match(barcodeSvg(value),/^<svg/)
 }
})
test('Unsupported labels fail explicitly without changing stored barcode',()=>{
 for(const value of ['x','a'.repeat(65),'ўзбек','abc\nxyz'])assert.throws(()=>barcodeSvg(value),{code:'UNSUPPORTED_BARCODE_LABEL'})
})
