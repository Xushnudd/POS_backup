import {translate,localizeOwnedMessage,type MessageKey,type MessageValues} from '../i18n/messages';
import {LOCALE_COOKIE,normalizeLocale,localeFromCookie,type Locale} from '../i18n/locale';
let locale:Locale=localeFromCookie(document.cookie);
try{if(!document.cookie.split(';').some(part=>part.trim().startsWith(LOCALE_COOKIE+'=')))locale=normalizeLocale(localStorage.getItem(LOCALE_COOKIE))}catch{/* Preference may be unavailable; cash storage is independent. */}
export const currentLocale=()=>locale;
export const t=(key:MessageKey,values?:MessageValues)=>translate(key,locale,values);
export const messageText=(text:string)=>localizeOwnedMessage(text,locale);
function paint(){
 document.documentElement.lang=locale;
 for(const element of document.querySelectorAll<HTMLElement>('[data-i18n]'))element.textContent=t(element.dataset.i18n as MessageKey);
 for(const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria]'))element.setAttribute('aria-label',t(element.dataset.i18nAria as MessageKey));
 const select=document.querySelector<HTMLSelectElement>('#language');if(select)select.value=locale;
}
function changed(next:Locale){locale=next;paint();window.dispatchEvent(new Event('pos:display-locale'));}
function choose(next:Locale){
 document.cookie=`${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
 try{localStorage.setItem(LOCALE_COOKIE,next)}catch{/* Only a display preference. */}
 changed(next);
}
const select=document.querySelector<HTMLSelectElement>('#language');if(select)select.addEventListener('change',()=>choose(normalizeLocale(select.value)));
window.addEventListener('storage',event=>{if(event.key===LOCALE_COOKIE&&event.newValue!==null)changed(normalizeLocale(event.newValue))});
paint();
