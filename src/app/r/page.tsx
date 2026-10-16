import type {Metadata} from 'next';
import ElectronicReceiptView from '@/components/pos/ElectronicReceiptView';
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};
export default function ReceiptPage(){return <ElectronicReceiptView/>;}
