import type {Metadata} from 'next';
import ReminderView from '@/components/customers/ReminderView';
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};
export default function ReminderPage(){return <ReminderView/>;}
