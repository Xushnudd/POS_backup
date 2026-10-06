import bwipjs from 'bwip-js/node'
import { AccessError } from '../auth/policy'

function options(value:string){
 if(!/^[\x20-\x7e]{2,64}$/.test(value))throw new AccessError(422,'UNSUPPORTED_BARCODE_LABEL','Code128 etiketka uchun 2–64ta ASCII belgi kerak')
 return {bcid:'code128',text:value,scale:2,height:15,includetext:false,paddingwidth:10}
}
export function barcodeModules(value:string){
 const symbol=bwipjs.raw(options(value))[0]
 if(!('sbs' in symbol))throw new Error('Expected linear barcode')
 const bits=Array<boolean>(10).fill(false)
 let black=true
 for(const width of symbol.sbs){bits.push(...Array<boolean>(width).fill(black));black=!black}
 bits.push(...Array<boolean>(10).fill(false))
 return bits
}
export function barcodeSvg(value:string){return bwipjs.toSVG(options(value))}
