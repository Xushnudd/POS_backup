export const SUPPORTED_LOCALES=['uz','ru'] as const;
export type Locale=typeof SUPPORTED_LOCALES[number];
export const LOCALE_COOKIE='pos_locale';
export const INTL_LOCALES:Record<Locale,string>={uz:'uz-Latn-UZ',ru:'ru-RU'};
export function normalizeLocale(value:unknown):Locale{return value==='ru'?'ru':'uz'}
export function localeFromCookie(header:string|null|undefined):Locale{
 const value=header?.split(';').map(part=>part.trim()).find(part=>part.startsWith(LOCALE_COOKIE+'='))?.slice(LOCALE_COOKIE.length+1);
 return normalizeLocale(value);
}
/** Only invoked by client event helpers. Server renderers pass locale explicitly. */
export function browserLocale():Locale{return typeof document==='undefined'?'uz':normalizeLocale(document.documentElement.lang)}
