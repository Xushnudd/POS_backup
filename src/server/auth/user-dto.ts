/** Related financial records only need the operator's identity, not contacts. */
export const operatorSelect = { id: true, fullName: true } as const;
/** Contacts are available in the owner-only staff management screen. */
export const staffSelect = { id: true, fullName: true, phone: true, email: true, isActive: true } as const;
