import { fixed } from '@/lib/money';
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount===null || amount===undefined) return "0 so‘m";
  try {
    const cents=fixed(amount);const absolute=cents<BigInt(0)?-cents:cents;
    const integer=(absolute/BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    const fraction=absolute%BigInt(100);
    return (cents<BigInt(0)?'-':'')+integer+(fraction?'.'+fraction.toString().padStart(2,'0'):'')+" so‘m";
  } catch {return "0 so‘m";}
}

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0';
  }
  const num = Number(val);
  // If decimal has numbers, keep up to 2-3 decimal places
  if (num % 1 !== 0) {
    const parts = num.toFixed(3).replace(/\.?0+$/, '').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatDate(
  dateInput?: string | Date | null,
  includeTime: boolean = false
): string {
  if (!dateInput) return '-';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (!includeTime) {
      return `${day}.${month}.${year}`;
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('998')) {
    return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
  }
  if (cleaned.length === 9) {
    return `+998 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}-${cleaned.slice(7, 9)}`;
  }
  return phone;
}
