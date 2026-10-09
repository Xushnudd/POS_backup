import {NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {deploymentState} from '@/server/deployment/state'
export const dynamic='force-dynamic'
export const GET=withApi(async()=>NextResponse.json({success:true,data:await deploymentState()}),{touchSession:false})
