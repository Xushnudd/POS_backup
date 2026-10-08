// Client calculations use fixed-point BigInt; numbers are only display values.
export function fixed(value:string|number,scale=2):bigint {
 const input=String(value)
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(input)
 if (!match) throw new Error('Invalid decimal')
 const fraction=match[3]??'',digits=fraction.padEnd(scale,'0').slice(0,scale)
 let result=BigInt(match[2]+digits)
 if (Number(fraction[scale]??0)>=5) result+=BigInt(1)
 return match[1]? -result:result
}
export function displayed(value:bigint,scale=2):number {
 if (value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Display range exceeded')
 return Number(value)/10**scale
}
export function clientLine(quantity:number,price:number,discount=0) {
 const product=fixed(quantity,6)*fixed(price,2),denominator=BigInt(1000000)
 const cents=(product+denominator/BigInt(2))/denominator-fixed(discount,2)
 return displayed(cents<BigInt(0)?BigInt(0):cents)
}
export function clientPercentage(base:string|number,percent:string|number){
 const rate=fixed(percent,2);if(rate<BigInt(0)||rate>BigInt(10000))throw new Error('Invalid discount percentage');
 return displayed((fixed(base,2)*rate+BigInt(5000))/BigInt(10000));
}
