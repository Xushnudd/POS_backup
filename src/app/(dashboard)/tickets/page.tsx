import TicketList from '@/components/support/TicketList'
export default async function TicketsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,get=(key:string)=>typeof params[key]==='string'?params[key] as string:''
 return <TicketList query={{scope:get('scope')==='platform'?'platform':'tenant',page:Number(get('page')||1),state:get('state'),severity:get('severity'),search:get('search')}}/>
}
