export const APP_NAME = 'Shuni POS';
export const APP_DESCRIPTION = 'Kichik va o‘rta bizneslar uchun savdo va ombor boshqaruvi tizimi';

export const PRODUCT_UNITS = [
  { value: 'dona', label: 'Dona (dona)' },
  { value: 'kg', label: 'Kilogramm (kg)' },
  { value: 'litr', label: 'Litr (l)' },
  { value: 'metr', label: 'Metr (m)' },
  { value: 'quti', label: 'Quti' },
  { value: 'juft', label: 'Juft' },
  { value: 'gramm', label: 'Gramm (g)' },
  { value: 'komplekt', label: 'Komplekt' },
];

export const PAYMENT_TYPES = [
  { value: 'cash', label: 'Naqd pul', icon: 'money-bill-wave', color: 'green' },
  { value: 'card', label: 'Plastik karta', icon: 'credit-card', color: 'blue' },
  { value: 'transfer', label: 'Pul o\'tkazmasi', icon: 'building-columns', color: 'purple' },
  { value: 'credit', label: 'Nasiya / Qarz', icon: 'handshake', color: 'amber' },
] as const;

export const STOCK_DOCUMENT_TYPES = [
  { value: 'purchase', label: 'Kirim (Xarid)' },
  { value: 'adjustment', label: 'Tuzatish (Inventarizatsiya)' },
  { value: 'transfer_in', label: 'Transfer (Kirim)' },
  { value: 'transfer_out', label: 'Transfer (Chiqim)' },
  { value: 'return_in', label: 'Mijozdan qaytarish' },
] as const;

export const USER_ROLES = [
  { value: 'owner', label: 'Do\'kon egasi' },
  { value: 'admin', label: 'Administrator' },
  { value: 'cashier', label: 'Kassir' },
] as const;
