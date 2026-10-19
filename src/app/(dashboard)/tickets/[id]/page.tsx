import TicketDetail from '@/components/support/TicketDetail'
export default async function TicketPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <TicketDetail id={(await params).id} scope={(await searchParams).scope==='platform'?'platform':'tenant'}/>}
