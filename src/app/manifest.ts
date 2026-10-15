import {cookies} from 'next/headers';
import {LOCALE_COOKIE,normalizeLocale} from '@/i18n/locale';
import {translate} from '@/i18n/messages';
import type {MetadataRoute} from 'next';
export default async function manifest():Promise<MetadataRoute.Manifest>{const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);return {id:'/',name:'Shuni POS',short_name:'Shuni POS',description:translate('Savdo va ombor boshqaruvi',locale),lang:locale,start_url:'/pos',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#1e40af',icons:[{src:'/pwa/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/pwa/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]};}
