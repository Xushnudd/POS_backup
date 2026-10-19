// Synchronous browser admission for deliberate account/context changes. Form
// guards register without sharing or persisting any field values.
export const PAGE_NAVIGATION_REQUEST='pos:page-navigation-request';
export const PAGE_NAVIGATION_COMMITTED='pos:page-navigation-committed';
export function confirmPageNavigation(){return window.dispatchEvent(new Event(PAGE_NAVIGATION_REQUEST,{cancelable:true}));}
// Call only after an approved server context change succeeded, immediately
// before leaving. A second beforeunload cancellation cannot keep the old page
// active against the new session identity.
export function commitPageNavigation(){window.dispatchEvent(new Event(PAGE_NAVIGATION_COMMITTED));}
