import {fixed} from './money'
function text(value:bigint){const negative=value<BigInt(0);if(negative)value=-value;const whole=value/BigInt(1000000),fraction=(value%BigInt(1000000)).toString().padStart(6,'0').replace(/0+$/,'');return (negative?'-':'')+whole+(fraction?'.'+fraction:'')}
export function clientBaseQuantity(quantity:string,ratio:string,precision=6){
 if(!/^\d+(\.\d{1,6})?$/.test(quantity)||!/^\d+(\.\d{1,6})?$/.test(ratio))throw new Error('Miqdor va nisbat ko‘pi6 kasr belgili bo‘lsin');const q=fixed(quantity,6),r=fixed(ratio,6),product=q*r;
 if(q<=BigInt(0)||r<=BigInt(0)||r>=BigInt(100000000000000)||product%BigInt(1000000)!==BigInt(0))throw new Error('Birlik miqdori aniq konvertatsiya qilinmadi');const base=product/BigInt(1000000);
 if(!Number.isInteger(precision)||precision<0||precision>6||base%BigInt(10)**BigInt(6-precision)!==BigInt(0)||base>=BigInt(100000000000000000000))throw new Error('Miqdor asosiy birlik aniqligiga mos emas');return text(base)
}
export function clientQuantitySum(first:string,second:string|number){return text(fixed(first,6)+fixed(second,6))}
