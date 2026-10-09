import {NextRequest,NextResponse} from 'next/server'
export function proxy(request:NextRequest){
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64'),development=process.env.NODE_ENV==='development'
 let apiOrigin='';try{const url=new URL(process.env.NEXT_PUBLIC_API_URL??'');if(url.protocol==='https:'||development&&url.protocol==='http:')apiOrigin=url.origin;}catch{/* Relative API paths use self. */}
 const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https:","font-src 'self' data:",`connect-src 'self' ${apiOrigin}${development?' ws: wss:':''}`,"worker-src 'self' blob:","media-src 'self' blob:","frame-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'self'"].join('; ')
 const incoming=new Headers(request.headers);incoming.set('x-nonce',nonce);incoming.set('Content-Security-Policy',csp)
 const response=NextResponse.next({request:{headers:incoming}});response.headers.set('Content-Security-Policy',csp);response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','same-origin');response.headers.set('X-Frame-Options','SAMEORIGIN');response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!api/|pwa/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js)$).*)']}
